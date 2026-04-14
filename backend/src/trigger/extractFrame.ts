import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { task } from "@trigger.dev/sdk/v3";
import { uploadBytes } from "../transloaditUpload";

const ffprobe = () => process.env.FFPROBE_PATH ?? "ffprobe";
const ffmpegBin = () => process.env.FFMPEG_PATH ?? "ffmpeg";

function probeDuration(videoPath: string): number {
  const out = execFileSync(
    ffprobe(),
    [
      "-v",
      "error",
      "-show_entries",
      "format=duration",
      "-of",
      "default=noprint_wrappers=1:nokey=1",
      videoPath,
    ],
    { encoding: "utf-8" },
  ).trim();
  const d = Number(out);
  if (!Number.isFinite(d)) throw new Error("ffprobe: could not read duration");
  return d;
}

export const extractFrame = task({
  id: "extract-frame",
  run: async (payload: { videoUrl: string; timestamp: string }) => {
    const dir = mkdtempSync(join(tmpdir(), "nf-extract-"));
    try {
      const input = join(dir, "in.vid");
      const output = join(dir, "frame.jpg");
      const res = await fetch(payload.videoUrl);
      if (!res.ok) throw new Error("Failed to download video");
      writeFileSync(input, Buffer.from(await res.arrayBuffer()));

      const duration = probeDuration(input);
      let seconds = 0;
      const ts = payload.timestamp.trim();
      if (ts.endsWith("%")) {
        const p = Number(ts.slice(0, -1));
        if (!Number.isFinite(p)) throw new Error("Invalid timestamp percentage");
        seconds = (p / 100) * duration;
      } else {
        seconds = Number(ts);
        if (!Number.isFinite(seconds)) throw new Error("Invalid timestamp parameter");
      }
      seconds = Math.min(Math.max(0, seconds), Math.max(0, duration - 0.01));

      execFileSync(
        ffmpegBin(),
        ["-y", "-ss", String(seconds), "-i", input, "-frames:v", "1", "-q:v", "2", output],
        { stdio: "pipe" },
      );

      const buf = readFileSync(output);
      const url = await uploadBytes(buf, "frame.jpg", "image/jpeg");
      return { url };
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  },
});
