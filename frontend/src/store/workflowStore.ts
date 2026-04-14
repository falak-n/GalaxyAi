import {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  type Connection,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
} from "@xyflow/react";
import { create } from "zustand";
import { hasCycle } from "@/lib/graph";

type Snap = { nodes: Node[]; edges: Edge[] };

const cap = 80;
const clone = (nodes: Node[], edges: Edge[]): Snap => ({
  nodes: JSON.parse(JSON.stringify(nodes)),
  edges: JSON.parse(JSON.stringify(edges)),
});

type State = {
  nodes: Node[];
  edges: Edge[];
  past: Snap[];
  future: Snap[];
  leftOpen: boolean;
  rightOpen: boolean;
  workflowId: string | null;
  workflowName: string;
  selectedIds: string[];
  running: Record<string, boolean>;
  setWorkflowMeta: (id: string | null, name: string) => void;
  setWorkflowName: (name: string) => void;
  setLeftOpen: (v: boolean) => void;
  setRightOpen: (v: boolean) => void;
  setSelectedIds: (ids: string[]) => void;
  setRunning: (id: string, on: boolean) => void;
  clearRunning: () => void;
  load: (nodes: Node[], edges: Edge[]) => void;
  onNodesChange: (c: NodeChange[]) => void;
  onEdgesChange: (c: EdgeChange[]) => void;
  onConnect: (c: Connection) => void;
  addNode: (n: Node) => void;
  updateNodeData: (id: string, patch: Record<string, unknown>) => void;
  undo: () => void;
  redo: () => void;
  pushHistory: () => void;
};

export const useWorkflowStore = create<State>((set, get) => ({
  nodes: [],
  edges: [],
  past: [],
  future: [],
  leftOpen: true,
  rightOpen: true,
  workflowId: null,
  workflowName: "Untitled",
  selectedIds: [],
  running: {},
  setWorkflowMeta: (id, name) =>
    set((s) => ({
      workflowId: id ?? s.workflowId,
      workflowName: name,
    })),
  setWorkflowName: (name) => set({ workflowName: name }),
  setLeftOpen: (v) => set({ leftOpen: v }),
  setRightOpen: (v) => set({ rightOpen: v }),
  setSelectedIds: (ids) => set({ selectedIds: ids }),
  setRunning: (id, on) =>
    set((s) => ({ running: { ...s.running, [id]: on } })),
  clearRunning: () => set({ running: {} }),
  load: (nodes, edges) => set({ nodes, edges, past: [], future: [] }),
  pushHistory: () => {
    const { nodes, edges, past } = get();
    const next = [...past, clone(nodes, edges)].slice(-cap);
    set({ past: next, future: [] });
  },
  onNodesChange: (changes) => {
    if (changes.some((c) => c.type === "remove")) get().pushHistory();
    set({ nodes: applyNodeChanges(changes, get().nodes) });
  },
  onEdgesChange: (changes) => {
    if (changes.some((c) => c.type === "remove")) get().pushHistory();
    set({ edges: applyEdgeChanges(changes, get().edges) });
  },
  onConnect: (c) => {
    const next = addEdge(c, get().edges);
    if (hasCycle(get().nodes, next)) return;
    get().pushHistory();
    set({ edges: next });
  },
  addNode: (n) => {
    get().pushHistory();
    set({ nodes: [...get().nodes, n] });
  },
  updateNodeData: (id, patch) =>
    set({
      nodes: get().nodes.map((node) =>
        node.id === id
          ? { ...node, data: { ...node.data, ...patch } }
          : node,
      ),
    }),
  undo: () => {
    const { past, future, nodes, edges } = get();
    if (!past.length) return;
    const prev = past[past.length - 1]!;
    set({
      nodes: prev.nodes,
      edges: prev.edges,
      past: past.slice(0, -1),
      future: [clone(nodes, edges), ...future],
    });
  },
  redo: () => {
    const { past, future, nodes, edges } = get();
    if (!future.length) return;
    const nxt = future[0]!;
    set({
      nodes: nxt.nodes,
      edges: nxt.edges,
      future: future.slice(1),
      past: [...past, clone(nodes, edges)],
    });
  },
}));
