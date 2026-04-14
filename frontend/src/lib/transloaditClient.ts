type AssemblyJson = {
  ok?: string;
  assembly_ssl_url?: string;
  error?: string;
  message?: string;
  uploads?: { ssl_url?: string; url?: string }[];
  results?: Record<string, { ssl_url?: string }[]>;
};

async function pollAssembly(url: string): Promise<AssemblyJson> {
  for (let i = 0; i < 60; i++) {
    const res = await fetch(url);
    const json = (await res.json()) as AssemblyJson;
    if (json.ok === "ASSEMBLY_COMPLETED") return json;
    if (json.ok === "ASSEMBLY_FAILED" || json.error) throw new Error(json.error || json.message || "Assembly failed");
    await new Promise((r) => setTimeout(r, 1500));
  }
  throw new Error("Transloadit assembly timeout");
}

export async function uploadFileToTransloadit(file: File): Promise<string> {
  const sig = await fetch("/api/transloadit/params", { method: "POST" }).then((r) => {
    if (!r.ok) throw new Error("Failed to get Transloadit signature");
    return r.json() as Promise<{ params: string; signature: string }>;
  });

  const form = new FormData();
  form.set("params", sig.params);
  form.set("signature", sig.signature);
  form.set("file", file);

  const res = await fetch("https://api2.transloadit.com/assemblies", { method: "POST", body: form });
  const json = (await res.json()) as AssemblyJson;
  if (!res.ok) throw new Error(json.error || json.message || "Upload failed");

  const final =
    json.ok === "ASSEMBLY_COMPLETED"
      ? json
      : json.assembly_ssl_url
        ? await pollAssembly(json.assembly_ssl_url)
        : json;

  if (final.ok !== "ASSEMBLY_COMPLETED") {
    throw new Error(final.error || final.message || "Transloadit did not complete");
  }
  const step = Object.values(final.results ?? {})[0]?.[0];
  const url = step?.ssl_url || final.uploads?.[0]?.ssl_url || final.uploads?.[0]?.url;
  if (!url) throw new Error("No file URL from Transloadit");
  return url;
}
