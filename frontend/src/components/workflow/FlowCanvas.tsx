"use client";

import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  Panel,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Connection,
  type Edge,
  type OnSelectionChangeParams,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Hand, Link2, MousePointer2, Plus, Redo2, Scissors, Undo2 } from "lucide-react";
import { useCallback, useEffect, useRef } from "react";
import { isValidConnection as nfValid } from "@/lib/graph";
import { useWorkflowStore } from "@/store/workflowStore";
import { nodeTypes } from "./nodeTypes";

function CanvasInner() {
  const nodes = useWorkflowStore((s) => s.nodes);
  const edges = useWorkflowStore((s) => s.edges);
  const onNodesChange = useWorkflowStore((s) => s.onNodesChange);
  const onEdgesChange = useWorkflowStore((s) => s.onEdgesChange);
  const onConnect = useWorkflowStore((s) => s.onConnect);
  const addNode = useWorkflowStore((s) => s.addNode);
  const undo = useWorkflowStore((s) => s.undo);
  const redo = useWorkflowStore((s) => s.redo);
  const setSelectedIds = useWorkflowStore((s) => s.setSelectedIds);

  const { fitView, screenToFlowPosition } = useReactFlow();
  const selectionKeyRef = useRef<string>("");

  const addTextAt = useCallback(
    (clientX: number, clientY: number) => {
      const pos = screenToFlowPosition({ x: clientX, y: clientY });
      addNode({
        id: crypto.randomUUID(),
        type: "text",
        position: pos,
        data: { label: "text", value: "" },
      });
    },
    [addNode, screenToFlowPosition],
  );

  const addTextAtViewportCenter = useCallback(() => {
    const pane = document.querySelector(".react-flow__pane");
    const r = pane?.getBoundingClientRect();
    if (r) {
      addTextAt(r.left + r.width / 2, r.top + r.height / 2);
    } else {
      addTextAt(window.innerWidth / 2, window.innerHeight / 2);
    }
  }, [addTextAt]);

  const isValidConnection = useCallback(
    (c: Connection | Edge) =>
      nfValid(nodes, {
        source: c.source,
        target: c.target,
        sourceHandle: c.sourceHandle ?? null,
        targetHandle: c.targetHandle ?? null,
      }),
    [nodes],
  );

  const onSelectionChange = useCallback(
    ({ nodes: selected }: OnSelectionChangeParams) => {
      const key = selected
        .map((n) => n.id)
        .sort()
        .join("\0");
      if (key === selectionKeyRef.current) return;
      selectionKeyRef.current = key;
      setSelectedIds(selected.map((n) => n.id));
    },
    [setSelectedIds],
  );

  useEffect(() => {
    if (nodes.length === 0) return;
    const id = requestAnimationFrame(() => {
      fitView({ padding: 0.2, duration: 0 });
    });
    return () => cancelAnimationFrame(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps --
  }, [nodes.length]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target;
      if (t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement || t instanceof HTMLSelectElement) {
        return;
      }
      if (e.key === "n" || e.key === "N") {
        if (e.metaKey || e.ctrlKey || e.altKey) return;
        e.preventDefault();
        addTextAtViewportCenter();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [addTextAtViewportCenter]);

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const type = e.dataTransfer.getData("application/nextflow");
      if (!type) return;
      const pos = screenToFlowPosition({ x: e.clientX, y: e.clientY });
      addNode({
        id: crypto.randomUUID(),
        type,
        position: pos,
        data: { label: type },
      });
    },
    [addNode, screenToFlowPosition],
  );

  const onPaneDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      if ((e.target as HTMLElement).closest(".react-flow__node")) return;
      if (!(e.target as HTMLElement).closest(".react-flow__pane")) return;
      e.preventDefault();
      addTextAt(e.clientX, e.clientY);
    },
    [addTextAt],
  );

  const onPaneContextMenu = useCallback(
    (e: React.MouseEvent | MouseEvent) => {
      e.preventDefault();
      if ((e.target as HTMLElement).closest(".react-flow__node")) return;
      addTextAt(e.clientX, e.clientY);
    },
    [addTextAt],
  );

  const toolbarBtn =
    "rounded-xl p-2 text-nf-muted transition hover:bg-nf-card hover:text-nf-text disabled:opacity-30";
  const toolbarBtnActive =
    "rounded-xl p-2 text-nf-text bg-nf-card border border-nf-line shadow-[0_6px_18px_rgba(0,0,0,0.45)]";

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onConnect={onConnect}
      isValidConnection={isValidConnection}
      nodeTypes={nodeTypes}
      deleteKeyCode={["Backspace", "Delete"]}
      defaultEdgeOptions={{ animated: true, style: { stroke: "#7C3AED", strokeWidth: 2 } }}
      onSelectionChange={onSelectionChange}
      onDrop={onDrop}
      onDragOver={onDragOver}
      onDoubleClick={onPaneDoubleClick}
      onPaneContextMenu={onPaneContextMenu}
      zoomOnDoubleClick={false}
      proOptions={{ hideAttribution: true }}
      className="!bg-nf-bg"
    >
      <Background gap={20} size={1} color="#2a2a3a" variant={BackgroundVariant.Dots} />
      <MiniMap
        position="bottom-right"
        className="!m-4 !rounded-xl !border !border-nf-line !bg-nf-panel"
        maskColor="rgba(0,0,0,0.5)"
      />
      <Controls
        showInteractive={false}
        className="!m-4 !rounded-xl !border !border-nf-line !bg-nf-panel !shadow-none"
      />
      {nodes.length === 0 ? (
        <Panel position="top-center" className="pointer-events-none mt-[22vh] max-w-md text-center">
          <p className="text-[15px] font-medium tracking-tight text-nf-muted">
            Add a node. Double click, right click, or press N
          </p>
          <p className="mt-3 text-xs leading-relaxed text-nf-muted opacity-80">
            Or use Quick Access / drag types / <span className="text-nf-muted">Sample</span> in the header.
          </p>
        </Panel>
      ) : null}
      <Panel position="bottom-center" className="mb-6">
        <div className="flex items-center gap-1 rounded-full border border-nf-line bg-nf-panel/70 px-2 py-2 shadow-[0_18px_60px_rgba(0,0,0,0.7)] backdrop-blur">
          <button type="button" className={toolbarBtn} title="Undo" onClick={() => undo()}>
            <Undo2 className="h-4 w-4" />
          </button>
          <button type="button" className={toolbarBtn} title="Redo" onClick={() => redo()}>
            <Redo2 className="h-4 w-4" />
          </button>
          <div className="mx-1 h-6 w-px bg-nf-line" aria-hidden />
          <button type="button" className={toolbarBtnActive} title="Add node" onClick={() => addTextAtViewportCenter()}>
            <Plus className="h-4 w-4" />
          </button>
          <button type="button" className={toolbarBtn} title="Select">
            <MousePointer2 className="h-4 w-4" />
          </button>
          <button type="button" className={toolbarBtn} title="Hand tool">
            <Hand className="h-4 w-4" />
          </button>
          <button type="button" className={toolbarBtn} title="Cut">
            <Scissors className="h-4 w-4" />
          </button>
          <button type="button" className={toolbarBtn} title="Link">
            <Link2 className="h-4 w-4" />
          </button>
        </div>
      </Panel>
    </ReactFlow>
  );
}

export function FlowCanvas() {
  return (
    <div className="relative h-full min-h-0 w-full flex-1">
      <ReactFlowProvider>
        <CanvasInner />
      </ReactFlowProvider>
    </div>
  );
}
