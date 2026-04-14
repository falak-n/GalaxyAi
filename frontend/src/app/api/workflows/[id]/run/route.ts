import {
  assertDag,
  buildLayers,
  prisma,
  TASK_IDS,
  type PlanEdge,
  type PlanNode,
} from "@nextflow/backend";
import { tasks } from "@trigger.dev/sdk/v3";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getUserId } from "@/lib/auth";

const nodeSchema = z.object({
  id: z.string(),
  type: z.string(),
  data: z.record(z.unknown()).optional(),
});

const edgeSchema = z.object({
  source: z.string(),
  target: z.string(),
  sourceHandle: z.string().nullable().optional(),
  targetHandle: z.string().nullable().optional(),
});

const bodySchema = z.object({
  mode: z.enum(["full", "selection", "single"]),
  targetIds: z.array(z.string()).default([]),
  nodes: z.array(nodeSchema),
  edges: z.array(edgeSchema),
});

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id: workflowId } = await ctx.params;
  const wf = await prisma.workflow.findFirst({ where: { id: workflowId, userId } });
  if (!wf) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const json = await req.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const body = parsed.data;

  const planNodes: PlanNode[] = body.nodes.map((n) => ({
    id: n.id,
    type: n.type,
    data: n.data,
  }));
  const planEdges: PlanEdge[] = body.edges.map((e) => ({
    source: e.source,
    target: e.target,
    sourceHandle: e.sourceHandle ?? null,
    targetHandle: e.targetHandle ?? null,
  }));

  try {
    assertDag(planNodes, planEdges);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Invalid graph";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  let layers: string[][];
  let exec: Set<string>;
  try {
    const p = buildLayers(planNodes, planEdges, body.mode, body.targetIds);
    layers = p.layers;
    exec = p.exec;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Invalid run";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  const seeds: Record<string, Record<string, unknown>> = {};
  for (const n of body.nodes) seeds[n.id] = { ...(n.data ?? {}) };

  const run = await prisma.workflowRun.create({
    data: {
      workflowId,
      userId,
      mode: body.mode,
      status: "running",
      nodes: {
        create: [...exec].map((nodeId) => ({
          nodeId,
          nodeType: body.nodes.find((n) => n.id === nodeId)?.type ?? "unknown",
          status: "pending",
        })),
      },
    },
  });

  if (!process.env.TRIGGER_SECRET_KEY) {
    await prisma.workflowRun.update({
      where: { id: run.id },
      data: { status: "failed", completedAt: new Date() },
    });
    return NextResponse.json({ error: "TRIGGER_SECRET_KEY is not set" }, { status: 500 });
  }

  await tasks.trigger(TASK_IDS.orchestrate, {
    runId: run.id,
    layers,
    exec: [...exec],
    nodes: planNodes,
    edges: planEdges,
    seeds,
  });

  return NextResponse.json({ runId: run.id });
}
