import { GoogleGenerativeAI } from "@google/generative-ai";
import { task } from "@trigger.dev/sdk/v3";

async function fetchAsInlinePart(url: string): Promise<{ inlineData: { data: string; mimeType: string } }> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch image: ${url}`);
  const mimeType = res.headers.get("content-type") || "image/jpeg";
  const buf = Buffer.from(await res.arrayBuffer());
  return { inlineData: { data: buf.toString("base64"), mimeType } };
}

export const llmNode = task({
  id: "llm-node",
  run: async (payload: {
    model: string;
    systemPrompt?: string;
    userMessage: string;
    imageUrls?: string[];
  }) => {
    const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    if (!apiKey) throw new Error("GOOGLE_GENERATIVE_AI_API_KEY is not set");

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: payload.model,
      systemInstruction: payload.systemPrompt?.trim() || undefined,
    });

    const parts: Array<
      { text: string } | { inlineData: { data: string; mimeType: string } }
    > = [{ text: payload.userMessage }];

    if (payload.imageUrls?.length) {
      for (const u of payload.imageUrls) {
        parts.push(await fetchAsInlinePart(u));
      }
    }

    const result = await model.generateContent({ contents: [{ role: "user", parts }] });
    const text = result.response.text();
    if (!text) throw new Error("Empty LLM response");
    return { text };
  },
});
