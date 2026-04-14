import { prisma } from "@nextflow/backend";
import { NextResponse } from "next/server";
import { getUserId } from "@/lib/auth";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const wf = await prisma.workflow.findFirst({ where: { id, userId } });
  if (!wf) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const graph = JSON.parse(wf.graphJson) as { nodes: unknown[]; edges: unknown[] };
  return NextResponse.json({ name: wf.name, ...graph });
}
