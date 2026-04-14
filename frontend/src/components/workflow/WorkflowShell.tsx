"use client";

import { UserButton } from "@clerk/nextjs";
import {
  ArrowLeft,
  Box,
  Bot,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clapperboard,
  Download,
  History,
  Import,
  ImageIcon,
  LayoutGrid,
  Moon,
  PanelLeft,
  Search,
  Share2,
  Sparkles,
  Type,
  Upload,
  Video,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { getSampleWorkflow } from "@/lib/sampleWorkflow";
import { useWorkflowStore } from "@/store/workflowStore";
import { FlowCanvas } from "./FlowCanvas";

const quick = [
  { type: "text", label: "Text", icon: Type },
  { type: "uploadImage", label: "Upload Image", icon: ImageIcon },
  { type: "uploadVideo", label: "Upload Video", icon: Video },
  { type: "llm", label: "Run Any LLM", icon: Bot },
  { type: "cropImage", label: "Crop Image", icon: Sparkles },
  { type: "extractFrame", label: "Extract Frame", icon: Clapperboard },
] as const;

type RunRow = {
  id: string;
  mode: string;
  status: string;
  startedAt: string;
  completedAt: string | null;
};

type RunNodeRow = {
  nodeId: string;
  nodeType: string;
  status: string;
  durationMs: number | null;
  output: string | null;
  error: string | null;
};

export default function WorkflowShell() {
  const workflowId = useWorkflowStore((s) => s.workflowId);
  const workflowName = useWorkflowStore((s) => s.workflowName);
  const nodes = useWorkflowStore((s) => s.nodes);
  const edges = useWorkflowStore((s) => s.edges);
  const leftOpen = useWorkflowStore((s) => s.leftOpen);
  const rightOpen = useWorkflowStore((s) => s.rightOpen);
  const selectedIds = useWorkflowStore((s) => s.selectedIds);
  const load = useWorkflowStore((s) => s.load);
  const setWorkflowMeta = useWorkflowStore((s) => s.setWorkflowMeta);
  const setWorkflowName = useWorkflowStore((s) => s.setWorkflowName);
  const setLeftOpen = useWorkflowStore((s) => s.setLeftOpen);
  const setRightOpen = useWorkflowStore((s) => s.setRightOpen);
  const addNode = useWorkflowStore((s) => s.addNode);
  const undo = useWorkflowStore((s) => s.undo);
  const redo = useWorkflowStore((s) => s.redo);
  const updateNodeData = useWorkflowStore((s) => s.updateNodeData);
  const setRunning = useWorkflowStore((s) => s.setRunning);
  const clearRunning = useWorkflowStore((s) => s.clearRunning);

  const [q, setQ] = useState("");
  const [runs, setRuns] = useState<RunRow[]>([]);
  const [pickRun, setPickRun] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [runDetail, setRunDetail] = useState<{
    id: string;
    mode: string;
    startedAt: string;
    nodes: RunNodeRow[];
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const refreshRuns = useCallback(async () => {
    if (!workflowId) return;
    const r = await fetch(`/api/workflows/${workflowId}/runs`);
    if (!r.ok) return;
    const j = (await r.json()) as { runs: RunRow[] };
    setRuns(j.runs);
  }, [workflowId]);

  useEffect(() => {
    void (async () => {
      try {
        const listRes = await fetch("/api/workflows");
        if (!listRes.ok) {
          const body = (await listRes.json().catch(() => ({}))) as { error?: string };
          setErr(
            typeof body.error === "string"
              ? body.error
              : `Could not load workflows (${listRes.status}). Set DATABASE_URL in frontend/.env.local and run Prisma migrate.`,
          );
          load([], []);
          return;
        }
        const list = (await listRes.json()) as { workflows: { id: string; name: string }[] };
        let id = localStorage.getItem("nextflow_wf_id");
        let w = list.workflows.find((x) => x.id === id);
        if (!w && list.workflows[0]) w = list.workflows[0];
        if (!w) {
          const createRes = await fetch("/api/workflows", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: "{}",
          });
          if (!createRes.ok) {
            const body = (await createRes.json().catch(() => ({}))) as { error?: string };
            setErr(body.error ?? `Could not create workflow (${createRes.status}). Check DATABASE_URL.`);
            load([], []);
            return;
          }
          const c = (await createRes.json()) as { id: string };
          id = c.id;
          localStorage.setItem("nextflow_wf_id", id);
          setWorkflowMeta(id, "Untitled");
          load([], []);
          return;
        }
        id = w.id;
        localStorage.setItem("nextflow_wf_id", id);
        const wfRes = await fetch(`/api/workflows/${id}`);
        if (!wfRes.ok) {
          const body = (await wfRes.json().catch(() => ({}))) as { error?: string };
          setErr(body.error ?? `Could not open workflow (${wfRes.status}).`);
          load([], []);
          return;
        }
        const wf = (await wfRes.json()) as { name: string; graph: { nodes: never[]; edges: never[] } };
        setWorkflowMeta(id, wf.name);
        load(wf.graph.nodes as never[], wf.graph.edges as never[]);
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Network error while loading workflow.");
        load([], []);
      }
    })();
  }, [load, setWorkflowMeta]);

  useEffect(() => {
    void refreshRuns();
  }, [refreshRuns]);

  const save = async () => {
    if (!workflowId) return;
    setErr(null);
    setBusy(true);
    try {
      await fetch(`/api/workflows/${workflowId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: workflowName, graph: { nodes, edges } }),
      });
      await refreshRuns();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  };

  const run = async (mode: "full" | "selection" | "single") => {
    if (!workflowId) return;
    setErr(null);
    await save();
    const targetIds =
      mode === "full" ? [] : mode === "single" ? selectedIds.slice(0, 1) : selectedIds;
    if (mode !== "full" && !targetIds.length) {
      setErr("Select at least one node.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/workflows/${workflowId}/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, targetIds, nodes, edges }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((j as { error?: string }).error || "Run failed");
      const runId = (j as { runId: string }).runId;
      await pollRun(runId);
      await refreshRuns();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Run failed");
    } finally {
      setBusy(false);
    }
  };

  const pollRun = async (runId: string) => {
    for (let i = 0; i < 120; i++) {
      const r = await fetch(`/api/runs/${runId}`);
      const data = (await r.json()) as {
        status: string;
        nodes: RunNodeRow[];
      };
      for (const n of data.nodes) {
        setRunning(n.nodeId, n.status === "running" || n.status === "pending");
      }
      if (data.status === "completed" || data.status === "failed") {
        clearRunning();
        for (const n of data.nodes) {
          if (n.status === "failed") {
            updateNodeData(n.nodeId, { error: n.error ?? "Failed", result: undefined });
          } else if (n.output) {
            if (n.nodeType === "llm") {
              updateNodeData(n.nodeId, { result: n.output, error: undefined });
            }
            if (n.nodeType === "cropImage" || n.nodeType === "extractFrame") {
              updateNodeData(n.nodeId, { result: n.output, error: undefined });
            }
          }
        }
        return;
      }
      await new Promise((x) => setTimeout(x, 1000));
    }
    clearRunning();
    setErr("Run timed out while waiting for status.");
  };

  const exportJson = async () => {
    if (!workflowId) return;
    await fetch(`/api/workflows/${workflowId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: workflowName, graph: { nodes, edges } }),
    }).catch(() => null);
    const r = await fetch(`/api/workflows/${workflowId}/export`);
    const j = await r.json();
    const blob = new Blob([JSON.stringify(j, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${workflowName.replace(/\s+/g, "-")}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const importJson = async (file: File | null) => {
    if (!file) return;
    setErr(null);
    const text = await file.text();
    const data = JSON.parse(text) as { name: string; nodes: never[]; edges: never[] };
    const res = await fetch("/api/workflows/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((j as { error?: string }).error || "Import failed");
    const id = (j as { id: string }).id;
    localStorage.setItem("nextflow_wf_id", id);
    setWorkflowMeta(id, data.name);
    load(data.nodes, data.edges);
    void refreshRuns();
  };

  const addCenter = (type: string) => {
    addNode({
      id: crypto.randomUUID(),
      type,
      position: { x: 260 + Math.random() * 60, y: 220 + Math.random() * 60 },
      data: { label: type },
    });
  };

  const loadSample = () => {
    const s = getSampleWorkflow();
    load(s.nodes as never[], s.edges as never[]);
  };

  const openRun = async (id: string) => {
    setPickRun(id);
    const r = await fetch(`/api/runs/${id}`);
    const d = (await r.json()) as { id: string; mode: string; startedAt: string; nodes: RunNodeRow[] };
    setRunDetail(d);
  };

  const filtered = quick.filter((x) => x.label.toLowerCase().includes(q.trim().toLowerCase()));

  const hdrGhost =
    "rounded-lg border border-nf-line bg-transparent px-2.5 py-2 text-xs text-nf-text hover:bg-nf-card disabled:opacity-40";

  return (
    <div className="nf-workflow-ui flex h-screen max-h-screen overflow-hidden bg-nf-bg text-nf-text">
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex h-14 shrink-0 items-center gap-3 bg-transparent px-4">
          <div className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              className="inline-flex items-center gap-2 rounded-2xl bg-nf-panel/70 px-3 py-2 text-sm font-medium text-nf-text hover:bg-nf-panel"
            >
              <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-nf-card">
                <Sparkles className="h-4 w-4 text-nf-text" />
              </div>
              <span>{workflowName || "Untitled"}</span>
              <ChevronDown className="h-4 w-4 text-nf-muted" />
            </button>
            {menuOpen ? (
              <div className="absolute left-0 top-[52px] z-50 w-[280px] overflow-hidden rounded-3xl border border-nf-line bg-nf-panel shadow-[0_20px_60px_rgba(0,0,0,0.7)]">
                <button type="button" className="flex w-full items-center gap-3 px-4 py-3 text-sm text-nf-text hover:bg-nf-card">
                  <ArrowLeft className="h-4 w-4 text-nf-muted" /> Back
                </button>
                <button type="button" className="flex w-full items-center gap-3 px-4 py-3 text-sm text-nf-muted hover:bg-nf-card hover:text-nf-text">
                  <LayoutGrid className="h-4 w-4" /> Turn into App
                </button>
                <div className="my-1 h-px bg-nf-line" />
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    fileRef.current?.click();
                  }}
                  className="flex w-full items-center gap-3 px-4 py-3 text-sm text-nf-text hover:bg-nf-card"
                >
                  <Import className="h-4 w-4 text-nf-muted" /> Import
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    void exportJson();
                  }}
                  className="flex w-full items-center gap-3 px-4 py-3 text-sm text-nf-text hover:bg-nf-card"
                >
                  <Download className="h-4 w-4 text-nf-muted" /> Export
                </button>
                <div className="my-1 h-px bg-nf-line" />
                <button type="button" className="flex w-full items-center justify-between px-4 py-3 text-sm text-nf-text hover:bg-nf-card">
                  <span className="flex items-center gap-3">
                    <Box className="h-4 w-4 text-nf-muted" /> Workspaces
                  </span>
                  <ChevronRight className="h-4 w-4 text-nf-muted" />
                </button>
              </div>
            ) : null}
            <input
              ref={fileRef}
              type="file"
              accept="application/json"
              className="hidden"
              onChange={(e) => void importJson(e.target.files?.[0] ?? null).catch((er) => setErr(String(er)))}
            />
          </div>

          <div className="flex-1" />
          <button type="button" className="inline-flex items-center gap-2 rounded-2xl border border-nf-line bg-nf-panel/60 px-3 py-2 text-sm text-nf-text hover:bg-nf-panel">
            <Moon className="h-4 w-4 text-nf-muted" />
          </button>
          <button type="button" className="inline-flex items-center gap-2 rounded-2xl border border-nf-line bg-nf-panel/60 px-4 py-2 text-sm text-nf-text hover:bg-nf-panel">
            <Share2 className="h-4 w-4 text-nf-muted" />
            Share
          </button>
          <button type="button" className="inline-flex items-center gap-2 rounded-2xl border border-nf-line bg-nf-panel/60 px-4 py-2 text-sm text-nf-text hover:bg-nf-panel">
            Turn workflow into app
          </button>
          <button type="button" className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-nf-primary text-white hover:bg-nf-primary-hover">
            <Sparkles className="h-4 w-4" />
          </button>
          <UserButton afterSignOutUrl="/sign-in" />
        </header>
        {err ? (
          <div className="bg-nf-error/15 px-3 py-2 text-center text-xs text-nf-error">{err}</div>
        ) : null}
        <div className="flex min-h-0 flex-1">
          <aside
            className={`relative flex shrink-0 flex-col border-r border-nf-line bg-nf-panel transition-[width] duration-200 ease-in-out ${leftOpen ? "w-[260px]" : "w-11"}`}
          >
            {leftOpen ? (
              <>
                <div className="px-4 pb-3 pt-4">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-nf-muted" />
                    <input
                      placeholder="Search nodes"
                      value={q}
                      onChange={(e) => setQ(e.target.value)}
                      className="w-full rounded-xl border border-nf-line bg-nf-bg py-2 pl-9 pr-3 text-xs text-nf-text outline-none placeholder:text-nf-muted focus:border-nf-primary"
                    />
                  </div>
                </div>
                <div className="px-4 pb-2 text-[11px] font-medium uppercase tracking-[0.16em] text-nf-muted">
                  Quick Access
                </div>
                <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-4 pb-4">
                  {filtered.map((b) => {
                    const Icon = b.icon;
                    return (
                      <button
                        key={b.type}
                        type="button"
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.setData("application/nextflow", b.type);
                          e.dataTransfer.effectAllowed = "move";
                        }}
                        onClick={() => addCenter(b.type)}
                        className="flex w-full items-center gap-3 rounded-xl border border-transparent bg-transparent px-3 py-3 text-left text-sm text-nf-text hover:border-nf-line hover:bg-nf-card"
                      >
                        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-nf-card">
                          <Icon className="h-4 w-4 text-nf-muted" />
                        </div>
                        <div className="min-w-0">
                          <div className="truncate font-medium">{b.label}</div>
                          <div className="text-xs text-nf-muted">Click or drag onto canvas</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
                <div className="border-t border-nf-line px-4 py-3">
                  <div className="grid grid-cols-2 gap-2">
                    <button type="button" disabled={busy} onClick={() => void run("selection")} className={hdrGhost}>
                      Selected
                    </button>
                    <button type="button" disabled={busy} onClick={() => void run("single")} className={hdrGhost}>
                      Single
                    </button>
                  </div>
                </div>
              </>
            ) : null}
          </aside>
          <div className="min-w-0 flex-1">
            <FlowCanvas />
          </div>
          <aside
            className={`relative flex shrink-0 flex-col border-l border-nf-line bg-nf-panel transition-[width] duration-200 ease-in-out ${rightOpen ? "w-[320px]" : "w-11"}`}
          >
            <button
              type="button"
              onClick={() => setRightOpen(!rightOpen)}
              className="absolute left-2 top-2 z-10 rounded-lg border border-nf-line bg-nf-card p-1 text-nf-muted hover:text-nf-text"
              aria-label="Toggle history"
            >
              {rightOpen ? <ChevronRight className="h-4 w-4" /> : <History className="h-4 w-4" />}
            </button>
            {rightOpen ? (
              <div className="flex h-full flex-col pt-11">
                <div className="flex items-center justify-between px-4 pb-2">
                  <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-nf-muted">
                    Workflow History
                  </div>
                  <div className="rounded-full bg-nf-card px-2 py-1 text-[10px] text-nf-muted">{runs.length}</div>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto">
                  {runs.map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => void openRun(r.id)}
                      className={`w-full border-b border-nf-line px-3 py-3 text-left text-xs transition-colors hover:bg-nf-card ${pickRun === r.id ? "bg-nf-card" : ""}`}
                    >
                      <div className="font-medium text-nf-text">{r.mode}</div>
                      <div className="mt-1 text-[11px] text-nf-muted">{new Date(r.startedAt).toLocaleString()}</div>
                      <div className="mt-1 text-[11px] text-nf-muted">{r.status}</div>
                    </button>
                  ))}
                </div>
                {runDetail ? (
                  <div className="max-h-[45vh] shrink-0 overflow-y-auto border-t border-nf-line p-3 text-xs">
                    <div className="mb-2 font-medium text-nf-text">
                      Run — {new Date(runDetail.startedAt).toLocaleString()} ({runDetail.mode})
                    </div>
                    {runDetail.nodes.map((n) => (
                      <div key={n.nodeId} className="border-b border-nf-line py-3 last:border-b-0">
                        <div className="text-[13px] text-nf-text">
                          {n.nodeType} ({n.nodeId.slice(0, 8)}…) {n.status === "completed" ? "✓" : n.status === "failed" ? "✗" : "…"}{" "}
                          {n.durationMs != null ? `${(n.durationMs / 1000).toFixed(1)}s` : ""}
                        </div>
                        {n.output ? <div className="mt-1 break-all text-nf-muted">Output: {n.output.slice(0, 400)}</div> : null}
                        {n.error ? <div className="mt-1 text-nf-error">Error: {n.error}</div> : null}
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
          </aside>
        </div>
      </div>
    </div>
  );
}
