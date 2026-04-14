import { prisma } from "@nextflow/backend";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getUserId } from "@/lib/auth";

const createSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  graph: z
    .object({
      nodes: z.array(z.unknown()).default([]),
      edges: z.array(z.unknown()).default([]),
    })
    .optional(),
});

export async function GET() {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const rows = await prisma.workflow.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    select: { id: true, name: true, updatedAt: true },
  });
  return NextResponse.json({ workflows: rows });
}

export async function POST(req: Request) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const json = await req.json().catch(() => ({}));
  const body = createSchema.safeParse(json);
  if (!body.success) {
    return NextResponse.json({ error: body.error.flatten() }, { status: 400 });
  }
  const graph = body.data.graph ?? { nodes: [], edges: [] };
  const wf = await prisma.workflow.create({
    data: {
      userId,
      name: body.data.name ?? "Untitled",
      graphJson: JSON.stringify(graph),
    },
  });
  return NextResponse.json({ id: wf.id });
}
