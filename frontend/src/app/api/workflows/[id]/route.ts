import { prisma } from "@nextflow/backend";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getUserId } from "@/lib/auth";

const putSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  graph: z.object({
    nodes: z.array(z.unknown()),
    edges: z.array(z.unknown()),
  }),
});

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const wf = await prisma.workflow.findFirst({ where: { id, userId } });
  if (!wf) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({
    id: wf.id,
    name: wf.name,
    graph: JSON.parse(wf.graphJson) as { nodes: unknown[]; edges: unknown[] },
  });
}

export async function PUT(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const json = await req.json().catch(() => ({}));
  const body = putSchema.safeParse(json);
  if (!body.success) {
    return NextResponse.json({ error: body.error.flatten() }, { status: 400 });
  }
  const wf = await prisma.workflow.findFirst({ where: { id, userId } });
  if (!wf) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await prisma.workflow.update({
    where: { id },
    data: {
      name: body.data.name ?? wf.name,
      graphJson: JSON.stringify(body.data.graph),
    },
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const wf = await prisma.workflow.findFirst({ where: { id, userId } });
  if (!wf) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await prisma.workflow.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
