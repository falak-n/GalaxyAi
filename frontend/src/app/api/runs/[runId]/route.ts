import { prisma } from "@nextflow/backend";
import { NextResponse } from "next/server";
import { getUserId } from "@/lib/auth";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ runId: string }> },
) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { runId } = await ctx.params;
  const run = await prisma.workflowRun.findFirst({
    where: { id: runId, userId },
    include: { nodes: true },
  });
  if (!run) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({
    id: run.id,
    workflowId: run.workflowId,
    mode: run.mode,
    status: run.status,
    startedAt: run.startedAt,
    completedAt: run.completedAt,
    nodes: run.nodes.map((n) => ({
      nodeId: n.nodeId,
      nodeType: n.nodeType,
      status: n.status,
      durationMs: n.durationMs,
      output: n.output,
      error: n.error,
    })),
  });
}
