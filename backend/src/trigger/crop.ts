import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { task } from "@trigger.dev/sdk/v3";
import { uploadBytes } from "../transloaditUpload";

const ffprobe = () => process.env.FFPROBE_PATH ?? "ffprobe";
const ffmpegBin = () => process.env.FFMPEG_PATH ?? "ffmpeg";

function probeSize(imagePath: string): { w: number; h: number } {
  const out = execFileSync(
    ffprobe(),
    [
      "-v",
      "error",
      "-select_streams",
      "v:0",
      "-show_entries",
      "stream=width,height",
      "-of",
      "csv=p=0",
      imagePath,
    ],
    { encoding: "utf-8" },
  ).trim();
  const [w, h] = out.split(",").map(Number);
  if (!w || !h) throw new Error("ffprobe: could not read dimensions");
  return { w, h };
}

export const cropImage = task({
  id: "crop-image",
  run: async (payload: {
    imageUrl: string;
    xPercent: number;
    yPercent: number;
    widthPercent: number;
    heightPercent: number;
  }) => {
    const dir = mkdtempSync(join(tmpdir(), "nf-crop-"));
    try {
      const input = join(dir, "in.img");
      const output = join(dir, "out.jpg");
      const res = await fetch(payload.imageUrl);
      if (!res.ok) throw new Error("Failed to download image");
      writeFileSync(input, Buffer.from(await res.arrayBuffer()));

      const { w, h } = probeSize(input);
      const x = Math.round((payload.xPercent / 100) * w);
      const y = Math.round((payload.yPercent / 100) * h);
      const cw = Math.max(1, Math.round((payload.widthPercent / 100) * w));
      const ch = Math.max(1, Math.round((payload.heightPercent / 100) * h));

      execFileSync(ffmpegBin(), ["-y", "-i", input, "-vf", `crop=${cw}:${ch}:${x}:${y}`, output], {
        stdio: "pipe",
      });

      const buf = readFileSync(output);
      const url = await uploadBytes(buf, "crop.jpg", "image/jpeg");
      return { url };
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  },
});
