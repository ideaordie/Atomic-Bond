// Local authoring tool only. No credentials, production requests or live data.
import { chromium } from "@playwright/test";
import { spawn } from "node:child_process";
import { mkdir, writeFile, rename } from "node:fs/promises";
import { resolve } from "node:path";

const ffmpeg = process.env.FFMPEG_BIN;
if (!ffmpeg)
  throw new Error("Set FFMPEG_BIN to a trusted local FFmpeg executable.");
const origin = new URL(
  process.env.INTRODUCTION_REVIEW_ORIGIN || "http://127.0.0.1:3131",
);
if (
  origin.protocol !== "http:" ||
  !["localhost", "127.0.0.1"].includes(origin.hostname)
)
  throw new Error("Export requires a loopback development server.");
const directory = resolve("artifacts/introduction-export");
await mkdir(directory, { recursive: true });
const temporary = resolve(directory, "render.partial.mp4");
const destination = resolve(directory, "Atomic_Bond_Introduction_1080p.mp4");
const encoder = spawn(
  ffmpeg,
  [
    "-hide_banner",
    "-loglevel",
    "error",
    "-n",
    "-f",
    "image2pipe",
    "-framerate",
    "30",
    "-vcodec",
    "png",
    "-i",
    "pipe:0",
    "-an",
    "-c:v",
    "libx264",
    "-preset",
    "medium",
    "-crf",
    "17",
    "-pix_fmt",
    "yuv420p",
    "-vf",
    "scale=in_range=pc:out_range=tv:out_color_matrix=bt709",
    "-color_primaries",
    "bt709",
    "-color_trc",
    "bt709",
    "-colorspace",
    "bt709",
    "-color_range",
    "tv",
    "-movflags",
    "+faststart",
    temporary,
  ],
  { windowsHide: true, stdio: ["pipe", "ignore", "pipe"] },
);
let errors = "";
encoder.stderr.on("data", (chunk) => {
  errors += chunk;
});
const completion = new Promise((resolve, reject) => {
  encoder.on("error", reject);
  encoder.on("close", (code) =>
    code === 0 ? resolve() : reject(new Error(`Encoder failed: ${errors}`)),
  );
});
// Attach rejection immediately while frames are being generated.
completion.catch(() => {});
const browser = await chromium.launch();
try {
  const page = await browser.newPage({
    viewport: { width: 1920, height: 1080 },
    reducedMotion: "no-preference",
  });
  await page.route("**/*", (route) =>
    new URL(route.request().url()).origin === origin.origin
      ? route.continue()
      : route.abort(),
  );
  await page.goto(new URL("/review/introduction", origin).href);
  const canvas = page.getByTestId("introduction-canvas");
  await page.waitForFunction(() =>
    document.querySelector("canvas")?.hasAttribute("data-render-ms"),
  );
  const keyFrames = new Set([0, 60, 228, 429, 600, 749]);
  for (let frame = 0; frame < 750; frame++) {
    const time = frame / 30;
    await page
      .getByRole("slider", { name: "Timeline seconds" })
      .fill(String(Number(time.toFixed(6))));
    await page.waitForFunction(
      (expected) =>
        document.querySelector("canvas")?.getAttribute("data-time") ===
        expected,
      time.toFixed(3),
    );
    const data = await canvas.evaluate(async (element) => {
      await new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      );
      return element.toDataURL("image/png");
    });
    const png = Buffer.from(data.split(",")[1], "base64");
    await new Promise((resolve, reject) =>
      encoder.stdin.write(png, (error) => (error ? reject(error) : resolve())),
    );
    if (keyFrames.has(frame))
      await writeFile(
        resolve(directory, `source-${String(frame).padStart(3, "0")}.png`),
        png,
      );
    if (frame === 0)
      await writeFile(resolve("public/introduction-poster.png"), png);
    if (frame % 150 === 0) console.log(`Rendered ${frame}/750 frames`);
  }
  encoder.stdin.end();
  await completion;
  await rename(temporary, destination);
  console.log("Export complete: 750 deterministic frames, 30 fps, 25 seconds.");
} finally {
  await browser.close();
  if (encoder.exitCode === null) encoder.kill();
}
