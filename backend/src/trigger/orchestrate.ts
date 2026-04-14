import { task, tasks } from "@trigger.dev/sdk/v3";
import { prisma } from "../db";
import type { PlanEdge, PlanNode } from "../execPlan";
import { TASK_IDS } from "../taskIds";

type Seeds = Record<string, Record<string, unknown>>;

function mergeData(node: PlanNode, seed: Record<string, unknown> | undefined) {
  return { ...(node.data ?? {}), ...(seed ?? {}) } as Record<string, unknown>;
}

function initialOutput(node: PlanNode, data: Record<string, unknown>): string | undefined {
  switch (node.type) {
    case "text":
      return data.value != null ? String(data.value) : undefined;
    case "uploadImage":
    case "uploadVideo":
      return data.url ? String(data.url) : undefined;
    case "llm":
      return data.result ? String(data.result) : undefined;
    case "cropImage":
    case "extractFrame":
      return data.result ? String(data.result) : undefined;
    default:
      return undefined;
  }
}

function isPassive(type: string) {
  return type === "text" || type === "uploadImage" || type === "uploadVideo";
}

function incoming(nodeId: string, handle: string | null, edges: PlanEdge[]) {
  return edges.filter((e) => e.target === nodeId && e.targetHandle === handle);
}

function sourceValue(sourceId: string, outputs: Map<string, string>): string {
  const v = outputs.get(sourceId);
  if (v == null || v === "") throw new Error(`Missing output from node ${sourceId}`);
  return v;
}

function resolveText(
  nodeId: string,
  handle: string,
  edges: PlanEdge[],
  outputs: Map<string, string>,
  data: Record<string, unknown>,
): string | undefined {
  const conns = incoming(nodeId, handle, edges);
  if (conns.length) {
    return sourceValue(conns[0]!.source, outputs);
  }
  if (handle === "system_prompt") return data.systemPrompt != null ? String(data.systemPrompt) : undefined;
  if (handle === "user_message") return data.userMessage != null ? String(data.userMessage) : "";
  if (handle === "x_percent") return String(data.xPercent ?? "0");
  if (handle === "y_percent") return String(data.yPercent ?? "0");
  if (handle === "width_percent") return String(data.widthPercent ?? "100");
  if (handle === "height_percent") return String(data.heightPercent ?? "100");
  if (handle === "timestamp") return String(data.timestamp ?? "0");
  return undefined;
}

function resolveImages(
  nodeId: string,
  edges: PlanEdge[],
  outputs: Map<string, string>,
  data: Record<string, unknown>,
): string[] {
  const conns = incoming(nodeId, "images", edges);
  const urls = conns.map((e) => sourceValue(e.source, outputs));
  const manual = data.imageUrlsManual;
  if (Array.isArray(manual)) {
    for (const u of manual) urls.push(String(u));
  }
  return urls;
}

async function mark(
  runId: string,
  nodeId: string,
  patch: { status: string; durationMs?: number; output?: string | null; error?: string | null },
) {
  await prisma.runNodeResult.updateMany({ where: { runId, nodeId }, data: patch });
}

export const workflowOrchestrate = task({
  id: TASK_IDS.orchestrate,
  run: async (payload: {
    runId: string;
    layers: string[][];
    exec: string[];
    nodes: PlanNode[];
    edges: PlanEdge[];
    seeds: Seeds;
  }) => {
    const { runId, layers, exec, nodes, edges, seeds } = payload;
    const execSet = new Set(exec);
    const nodesById = new Map(nodes.map((n) => [n.id, n]));
    const outputs = new Map<string, string>();

    for (const n of nodes) {
      const data = mergeData(n, seeds[n.id]);
      const o = initialOutput(n, data);
      if (o !== undefined) outputs.set(n.id, o);
    }

    try {
      for (const layer of layers) {
        const active = layer.filter((id) => execSet.has(id));
        await Promise.all(
          active.map(async (nodeId) => {
            const node = nodesById.get(nodeId);
            if (!node) return;
            const data = mergeData(node, seeds[node.id]);
            const t0 = Date.now();

            if (isPassive(node.type)) {
              const out = initialOutput(node, data) ?? "";
              outputs.set(node.id, out);
              await mark(runId, node.id, {
                status: "completed",
                durationMs: Math.max(1, Date.now() - t0),
                output: out.slice(0, 8000),
              });
              return;
            }

            await mark(runId, node.id, { status: "running" });

            try {
              if (node.type === "cropImage") {
                const imgEdges = incoming(nodeId, "image_url", edges);
                const imageUrl = imgEdges.length
                  ? sourceValue(imgEdges[0]!.source, nodesById, outputs)
                  : data.imageUrl
                    ? String(data.imageUrl)
                    : "";
                if (!imageUrl) throw new Error("Missing image_url");

                const xp = Number(resolveText(nodeId, "x_percent", edges, outputs, data) ?? "0");
                const yp = Number(resolveText(nodeId, "y_percent", edges, outputs, data) ?? "0");
                const wp = Number(resolveText(nodeId, "width_percent", edges, outputs, data) ?? "100");
                const hp = Number(resolveText(nodeId, "height_percent", edges, outputs, data) ?? "100");

                const handle = await tasks.triggerAndWait(TASK_IDS.crop, {
                  imageUrl,
                  xPercent: xp,
                  yPercent: yp,
                  widthPercent: wp,
                  heightPercent: hp,
                });
                if (!handle.ok) throw new Error(handle.error?.message || "crop failed");
                const url = (handle.output as { url: string }).url;
                outputs.set(node.id, url);
                await mark(runId, node.id, {
                  status: "completed",
                  durationMs: Date.now() - t0,
                  output: url,
                });
                return;
              }

              if (node.type === "extractFrame") {
                const vEdges = incoming(nodeId, "video_url", edges);
                const videoUrl = vEdges.length
                  ? sourceValue(vEdges[0]!.source, nodesById, outputs)
                  : data.videoUrl
                    ? String(data.videoUrl)
                    : "";
                if (!videoUrl) throw new Error("Missing video_url");
                const ts = String(resolveText(nodeId, "timestamp", edges, outputs, data) ?? "0");

                const handle = await tasks.triggerAndWait(TASK_IDS.extractFrame, {
                  videoUrl,
                  timestamp: ts,
                });
                if (!handle.ok) throw new Error(handle.error?.message || "extract failed");
                const url = (handle.output as { url: string }).url;
                outputs.set(node.id, url);
                await mark(runId, node.id, {
                  status: "completed",
                  durationMs: Date.now() - t0,
                  output: url,
                });
                return;
              }

              if (node.type === "llm") {
                const sys = resolveText(nodeId, "system_prompt", edges, outputs, data) as string | undefined;
                const user = resolveText(nodeId, "user_message", edges, outputs, data) as string;
                if (!user) throw new Error("user_message is required");
                const imgs = resolveImages(nodeId, edges, outputs, data);
                const model = String(data.model ?? "gemini-2.0-flash");

                const handle = await tasks.triggerAndWait(TASK_IDS.llm, {
                  model,
                  systemPrompt: sys,
                  userMessage: user,
                  imageUrls: imgs.length ? imgs : undefined,
                });
                if (!handle.ok) throw new Error(handle.error?.message || "llm failed");
                const text = (handle.output as { text: string }).text;
                outputs.set(node.id, text);
                await mark(runId, node.id, {
                  status: "completed",
                  durationMs: Date.now() - t0,
                  output: text.slice(0, 8000),
                });
                return;
              }

              await mark(runId, node.id, {
                status: "completed",
                durationMs: Date.now() - t0,
                output: outputs.get(node.id) ?? "",
              });
            } catch (e) {
              const msg = e instanceof Error ? e.message : "Unknown error";
              await mark(runId, node.id, {
                status: "failed",
                durationMs: Date.now() - t0,
                error: msg,
              });
              throw e;
            }
          }),
        );
      }

      await prisma.workflowRun.update({
        where: { id: runId },
        data: { status: "completed", completedAt: new Date() },
      });
      return { ok: true as const };
    } catch {
      await prisma.workflowRun.update({
        where: { id: runId },
        data: { status: "failed", completedAt: new Date() },
      });
      throw new Error("workflow failed");
    }
  },
});
