export type PlanNode = { id: string; type: string; data?: Record<string, unknown> };
export type PlanEdge = {
  source: string;
  target: string;
  sourceHandle: string | null;
  targetHandle: string | null;
};

export type RunMode = "full" | "selection" | "single";

function incomingSources(
  nodeId: string,
  edges: PlanEdge[],
  exec: Set<string>,
): string[] {
  return edges.filter((e) => e.target === nodeId && exec.has(e.source)).map((e) => e.source);
}

function hasCycle(nodes: PlanNode[], edges: PlanEdge[]): boolean {
  const ids = new Set(nodes.map((n) => n.id));
  const adj = new Map<string, string[]>();
  for (const e of edges) {
    if (!ids.has(e.source) || !ids.has(e.target)) continue;
    if (!adj.has(e.source)) adj.set(e.source, []);
    adj.get(e.source)!.push(e.target);
  }
  const state = new Map<string, 0 | 1 | 2>();
  for (const n of nodes) state.set(n.id, 0);
  const dfs = (u: string): boolean => {
    state.set(u, 1);
    for (const v of adj.get(u) ?? []) {
      if (state.get(v) === 1) return true;
      if (state.get(v) === 0 && dfs(v)) return true;
    }
    state.set(u, 2);
    return false;
  };
  for (const n of nodes) {
    if (state.get(n.id) === 0 && dfs(n.id)) return true;
  }
  return false;
}

export function assertDag(nodes: PlanNode[], edges: PlanEdge[]) {
  if (hasCycle(nodes, edges)) throw new Error("Workflow must be a DAG (cycles are not allowed)");
}

function execSet(mode: RunMode, targetIds: string[], allIds: Set<string>): Set<string> {
  if (mode === "full") return allIds;
  const targets = targetIds.filter((id) => allIds.has(id));
  if (!targets.length) throw new Error("No target nodes to run");
  if (mode === "single") return new Set([targets[0]!]);
  return new Set(targets);
}

export function buildLayers(
  nodes: PlanNode[],
  edges: PlanEdge[],
  mode: RunMode,
  targetIds: string[],
): { exec: Set<string>; layers: string[][] } {
  const allIds = new Set(nodes.map((n) => n.id));
  const exec = execSet(mode, targetIds, allIds);
  const remaining = new Set(exec);
  const layers: string[][] = [];
  const done = new Set<string>();

  while (remaining.size) {
    const layer: string[] = [];
    for (const id of remaining) {
      const deps = incomingSources(id, edges, exec);
      if (deps.every((d) => done.has(d))) layer.push(id);
    }
    if (!layer.length) throw new Error("Invalid graph: unable to schedule layer");
    for (const id of layer) {
      remaining.delete(id);
      done.add(id);
    }
    layers.push(layer);
  }
  return { exec, layers };
}
