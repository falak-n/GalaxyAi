import type { Edge, Node } from "@xyflow/react";

export function hasCycle(nodes: Node[], edges: Edge[]): boolean {
  const ids = new Set(nodes.map((n) => n.id));
  const adj = new Map<string, string[]>();
  for (const e of edges) {
    if (!ids.has(e.source) || !ids.has(e.target)) continue;
    if (!adj.has(e.source)) adj.set(e.source, []);
    adj.get(e.source)!.push(e.target);
  }
  const st = new Map<string, 0 | 1 | 2>();
  for (const n of nodes) st.set(n.id, 0);
  const dfs = (u: string): boolean => {
    st.set(u, 1);
    for (const v of adj.get(u) ?? []) {
      if (st.get(v) === 1) return true;
      if (st.get(v) === 0 && dfs(v)) return true;
    }
    st.set(u, 2);
    return false;
  };
  for (const n of nodes) {
    if (st.get(n.id) === 0 && dfs(n.id)) return true;
  }
  return false;
}

type Port = "text" | "image" | "video";

function outPort(nodeType: string | undefined): Port | null {
  switch (nodeType) {
    case "text":
    case "llm":
      return "text";
    case "uploadImage":
    case "cropImage":
    case "extractFrame":
      return "image";
    case "uploadVideo":
      return "video";
    default:
      return null;
  }
}

function inPort(targetHandle: string | null | undefined): Port | null {
  if (!targetHandle) return null;
  if (["system_prompt", "user_message", "x_percent", "y_percent", "width_percent", "height_percent", "timestamp"].includes(targetHandle)) {
    return "text";
  }
  if (targetHandle === "image_url" || targetHandle === "images") return "image";
  if (targetHandle === "video_url") return "video";
  return null;
}

export function isValidConnection(nodes: Node[], connection: {
  source: string;
  target: string;
  sourceHandle: string | null;
  targetHandle: string | null;
}): boolean {
  const src = nodes.find((n) => n.id === connection.source);
  const tgt = nodes.find((n) => n.id === connection.target);
  if (!src || !tgt) return false;
  if (connection.sourceHandle !== "output") return false;
  const o = outPort(src.type);
  const i = inPort(connection.targetHandle);
  if (!o || !i) return false;
  return o === i;
}
