import { prisma } from "@nextflow/backend";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getUserId } from "@/lib/auth";

const schema = z.object({
  name: z.string().min(1).max(200),
  nodes: z.array(z.unknown()),
  edges: z.array(z.unknown()),
});

export async function POST(req: Request) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const json = await req.json().catch(() => ({}));
  const body = schema.safeParse(json);
  if (!body.success) {
    return NextResponse.json({ error: body.error.flatten() }, { status: 400 });
  }
  const wf = await prisma.workflow.create({
    data: {
      userId,
      name: body.data.name,
      graphJson: JSON.stringify({ nodes: body.data.nodes, edges: body.data.edges }),
    },
  });
  return NextResponse.json({ id: wf.id });
}
