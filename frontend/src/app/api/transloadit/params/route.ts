import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { getUserId } from "@/lib/auth";

export async function POST() {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const key = process.env.TRANSLOADIT_KEY;
  const secret = process.env.TRANSLOADIT_SECRET;
  const templateId = process.env.TRANSLOADIT_TEMPLATE_ID;
  if (!key || !secret || !templateId) {
    return NextResponse.json({ error: "Transloadit is not configured" }, { status: 500 });
  }

  const expires = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  const params = { auth: { key, expires, nonce: crypto.randomUUID() }, template_id: templateId };
  const encoded = JSON.stringify(params);
  const digest = crypto.createHmac("sha384", secret).update(encoded).digest("hex");
  const signature = `sha384:${digest}`;
  return NextResponse.json({ params: encoded, signature });
}
