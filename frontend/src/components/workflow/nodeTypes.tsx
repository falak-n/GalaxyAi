"use client";

import { Handle, Position, useEdges, type NodeProps } from "@xyflow/react";
import { Loader2 } from "lucide-react";
import { useCallback, useState } from "react";
import { uploadFileToTransloadit } from "@/lib/transloaditClient";
import { useWorkflowStore } from "@/store/workflowStore";

const shell =
  "nf-node-card w-[260px] rounded-xl border border-nf-line bg-nf-card p-3 text-nf-text shadow-[0_4px_12px_rgba(0,0,0,0.4)]";

const titleCls = "mb-2 text-sm font-semibold text-nf-text";

const fieldLabelCls = "mb-1 text-xs text-nf-muted";

const nfInput =
  "w-full rounded-lg border border-nf-line bg-nf-bg p-2 text-[13px] text-nf-text outline-none focus:border-nf-primary";

const nfTextarea = `${nfInput} resize-none`;

const nfSelect = `${nfInput} appearance-none`;

const handleCls =
  "!h-[10px] !w-[10px] !min-h-[10px] !min-w-[10px] !rounded-full !border-2 !border-nf-bg !bg-nf-primary";

function RunningWrap({ id, children }: { id: string; children: React.ReactNode }) {
  const running = useWorkflowStore((s) => s.running[id]);
  return <div className={running ? `${shell} nf-node-running` : shell}>{children}</div>;
}

export function TextNode({ id, data }: NodeProps) {
  const update = useWorkflowStore((s) => s.updateNodeData);
  const value = String(data.value ?? "");
  return (
    <RunningWrap id={id}>
      <p className={titleCls}>Text</p>
      <textarea className={`${nfTextarea} h-24`} value={value} onChange={(e) => update(id, { value: e.target.value })} />
      <Handle type="source" position={Position.Right} id="output" className={handleCls} />
    </RunningWrap>
  );
}

const imgAccept = "image/jpeg,image/png,image/webp,image/gif,.jpg,.jpeg,.png,.webp,.gif";
const vidAccept = "video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm,.m4v";

const fileInputCls =
  "mb-2 w-full text-xs text-nf-muted file:mr-2 file:rounded-lg file:border-0 file:bg-nf-card file:px-2 file:py-2 file:text-nf-text";

export function UploadImageNode({ id, data }: NodeProps) {
  const update = useWorkflowStore((s) => s.updateNodeData);
  const url = data.url ? String(data.url) : "";
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const onFile = useCallback(
    async (f: File | null) => {
      if (!f) return;
      setErr(null);
      setBusy(true);
      try {
        const u = await uploadFileToTransloadit(f);
        update(id, { url: u });
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Upload failed");
      } finally {
        setBusy(false);
      }
    },
    [id, update],
  );

  return (
    <RunningWrap id={id}>
      <p className={titleCls}>Upload Image</p>
      <input type="file" accept={imgAccept} disabled={busy} className={fileInputCls} onChange={(e) => onFile(e.target.files?.[0] ?? null)} />
      {busy ? (
        <div className="flex items-center gap-2 text-xs text-nf-muted">
          <Loader2 className="h-4 w-4 animate-spin" /> Uploading…
        </div>
      ) : null}
      {err ? <p className="text-xs text-nf-error">{err}</p> : null}
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className="mt-2 max-h-40 w-full rounded-lg object-contain" />
      ) : null}
      <Handle type="source" position={Position.Right} id="output" className={handleCls} />
    </RunningWrap>
  );
}

export function UploadVideoNode({ id, data }: NodeProps) {
  const update = useWorkflowStore((s) => s.updateNodeData);
  const url = data.url ? String(data.url) : "";
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const onFile = useCallback(
    async (f: File | null) => {
      if (!f) return;
      setErr(null);
      setBusy(true);
      try {
        const u = await uploadFileToTransloadit(f);
        update(id, { url: u });
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Upload failed");
      } finally {
        setBusy(false);
      }
    },
    [id, update],
  );

  return (
    <RunningWrap id={id}>
      <p className={titleCls}>Upload Video</p>
      <input type="file" accept={vidAccept} disabled={busy} className={fileInputCls} onChange={(e) => onFile(e.target.files?.[0] ?? null)} />
      {busy ? (
        <div className="flex items-center gap-2 text-xs text-nf-muted">
          <Loader2 className="h-4 w-4 animate-spin" /> Uploading…
        </div>
      ) : null}
      {err ? <p className="text-xs text-nf-error">{err}</p> : null}
      {url ? <video src={url} controls className="mt-2 max-h-40 w-full rounded-lg" /> : null}
      <Handle type="source" position={Position.Right} id="output" className={handleCls} />
    </RunningWrap>
  );
}

const models = ["gemini-2.0-flash", "gemini-1.5-flash", "gemini-1.5-pro"];

export function LlmNode({ id, data }: NodeProps) {
  const edges = useEdges();
  const update = useWorkflowStore((s) => s.updateNodeData);
  const sysLocked = edges.some((e) => e.target === id && e.targetHandle === "system_prompt");
  const userLocked = edges.some((e) => e.target === id && e.targetHandle === "user_message");
  const model = String(data.model ?? models[0]);

  return (
    <RunningWrap id={id}>
      <p className={titleCls}>Run Any LLM</p>
      <select className={`${nfSelect} mb-2`} value={model} onChange={(e) => update(id, { model: e.target.value })}>
        {models.map((m) => (
          <option key={m} value={m}>
            {m}
          </option>
        ))}
      </select>
      <p className={fieldLabelCls}>System prompt</p>
      <textarea
        disabled={sysLocked}
        className={`${nfTextarea} mb-2 h-16 disabled:opacity-40`}
        value={String(data.systemPrompt ?? "")}
        onChange={(e) => update(id, { systemPrompt: e.target.value })}
      />
      <p className={fieldLabelCls}>User message</p>
      <textarea
        disabled={userLocked}
        className={`${nfTextarea} mb-2 h-16 disabled:opacity-40`}
        placeholder="User message"
        value={String(data.userMessage ?? "")}
        onChange={(e) => update(id, { userMessage: e.target.value })}
      />
      {data.result ? (
        <div className="mt-2 rounded-lg border border-nf-line bg-nf-bg p-3 text-[13px] leading-relaxed text-nf-text">{String(data.result)}</div>
      ) : null}
      {data.error ? <p className="mt-2 text-xs text-nf-error">{String(data.error)}</p> : null}
      <Handle type="target" position={Position.Left} id="system_prompt" className={`${handleCls} !top-[92px]`} />
      <Handle type="target" position={Position.Left} id="user_message" className={`${handleCls} !top-[148px]`} />
      <Handle type="target" position={Position.Left} id="images" className={`${handleCls} !top-[204px]`} />
      <Handle type="source" position={Position.Right} id="output" className={handleCls} />
    </RunningWrap>
  );
}

export function CropImageNode({ id, data }: NodeProps) {
  const edges = useEdges();
  const update = useWorkflowStore((s) => s.updateNodeData);
  const pct = (h: string) => edges.some((e) => e.target === id && e.targetHandle === h);
  const imgLocked = edges.some((e) => e.target === id && e.targetHandle === "image_url");

  return (
    <RunningWrap id={id}>
      <p className={titleCls}>Crop Image</p>
      {!imgLocked ? (
        <input
          placeholder="Image URL"
          className={`${nfInput} mb-2`}
          value={String(data.imageUrl ?? "")}
          onChange={(e) => update(id, { imageUrl: e.target.value })}
        />
      ) : null}
      <div className="grid grid-cols-2 gap-2 text-[13px]">
        <label className="text-nf-muted">
          x%
          <input
            type="number"
            disabled={pct("x_percent")}
            className={`${nfInput} mt-0.5 disabled:opacity-40`}
            value={Number(data.xPercent ?? 0)}
            onChange={(e) => update(id, { xPercent: Number(e.target.value) })}
          />
        </label>
        <label className="text-nf-muted">
          y%
          <input
            type="number"
            disabled={pct("y_percent")}
            className={`${nfInput} mt-0.5 disabled:opacity-40`}
            value={Number(data.yPercent ?? 0)}
            onChange={(e) => update(id, { yPercent: Number(e.target.value) })}
          />
        </label>
        <label className="text-nf-muted">
          w%
          <input
            type="number"
            disabled={pct("width_percent")}
            className={`${nfInput} mt-0.5 disabled:opacity-40`}
            value={Number(data.widthPercent ?? 100)}
            onChange={(e) => update(id, { widthPercent: Number(e.target.value) })}
          />
        </label>
        <label className="text-nf-muted">
          h%
          <input
            type="number"
            disabled={pct("height_percent")}
            className={`${nfInput} mt-0.5 disabled:opacity-40`}
            value={Number(data.heightPercent ?? 100)}
            onChange={(e) => update(id, { heightPercent: Number(e.target.value) })}
          />
        </label>
      </div>
      {data.result ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={String(data.result)} alt="" className="mt-2 max-h-32 w-full rounded-lg object-contain" />
      ) : null}
      <Handle type="target" position={Position.Left} id="image_url" className={`${handleCls} !top-10`} />
      <Handle type="target" position={Position.Left} id="x_percent" className={`${handleCls} !top-16`} />
      <Handle type="target" position={Position.Left} id="y_percent" className={`${handleCls} !top-[88px]`} />
      <Handle type="target" position={Position.Left} id="width_percent" className={`${handleCls} !top-[112px]`} />
      <Handle type="target" position={Position.Left} id="height_percent" className={`${handleCls} !top-[136px]`} />
      <Handle type="source" position={Position.Right} id="output" className={handleCls} />
    </RunningWrap>
  );
}

export function ExtractFrameNode({ id, data }: NodeProps) {
  const edges = useEdges();
  const update = useWorkflowStore((s) => s.updateNodeData);
  const tsLocked = edges.some((e) => e.target === id && e.targetHandle === "timestamp");
  const vidLocked = edges.some((e) => e.target === id && e.targetHandle === "video_url");

  return (
    <RunningWrap id={id}>
      <p className={titleCls}>Extract Frame</p>
      {!vidLocked ? (
        <input
          placeholder="Video URL"
          className={`${nfInput} mb-2`}
          value={String(data.videoUrl ?? "")}
          onChange={(e) => update(id, { videoUrl: e.target.value })}
        />
      ) : null}
      <label className="text-[13px] text-nf-muted">
        Timestamp (sec or %)
        <input
          disabled={tsLocked}
          className={`${nfInput} mt-1 disabled:opacity-40`}
          value={String(data.timestamp ?? "0")}
          onChange={(e) => update(id, { timestamp: e.target.value })}
        />
      </label>
      {data.result ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={String(data.result)} alt="" className="mt-2 max-h-32 w-full rounded-lg object-contain" />
      ) : null}
      <Handle type="target" position={Position.Left} id="video_url" className={`${handleCls} !top-10`} />
      <Handle type="target" position={Position.Left} id="timestamp" className={`${handleCls} !top-16`} />
      <Handle type="source" position={Position.Right} id="output" className={handleCls} />
    </RunningWrap>
  );
}

export const nodeTypes = {
  text: TextNode,
  uploadImage: UploadImageNode,
  uploadVideo: UploadVideoNode,
  llm: LlmNode,
  cropImage: CropImageNode,
  extractFrame: ExtractFrameNode,
};
