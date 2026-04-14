import crypto from "node:crypto";

function signParams(params: Record<string, unknown>, secret: string) {
  const encoded = JSON.stringify(params);
  const signature = crypto.createHmac("sha384", secret).update(encoded).digest("hex");
  return { encoded, signature };
}

export async function uploadBytes(
  buffer: Buffer,
  filename: string,
  mime: string,
): Promise<string> {
  const key = process.env.TRANSLOADIT_KEY;
  const secret = process.env.TRANSLOADIT_SECRET;
  const templateId = process.env.TRANSLOADIT_TEMPLATE_ID;
  if (!key || !secret || !templateId) {
    throw new Error("Transloadit env vars missing (TRANSLOADIT_KEY, TRANSLOADIT_SECRET, TRANSLOADIT_TEMPLATE_ID)");
  }

  const expires = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  const params: Record<string, unknown> = {
    auth: { key, expires },
    template_id: templateId,
  };

  const { encoded, signature } = signParams(params, secret);
  const form = new FormData();
  form.set("params", encoded);
  form.set("signature", signature);
  form.set(
    "file",
    new Blob([new Uint8Array(buffer)], { type: mime }),
    filename,
  );

  const res = await fetch("https://api2.transloadit.com/assemblies", {
    method: "POST",
    body: form,
  });
  const json = (await res.json()) as {
    ok?: string;
    error?: string;
    message?: string;
    results?: Record<string, { ssl_url?: string }[]>;
  };
  if (!res.ok || json.ok !== "ASSEMBLY_COMPLETED") {
    throw new Error(json.error || json.message || "Transloadit assembly failed");
  }
  const firstStep = Object.values(json.results ?? {})[0]?.[0];
  const url = firstStep?.ssl_url;
  if (!url) throw new Error("Transloadit: no ssl_url in results");
  return url;
}
