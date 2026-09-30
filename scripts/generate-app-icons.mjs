// Uses Next.js's installed Sharp dependency; no external design asset or download.
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const nextRequire = createRequire(require.resolve("next/package.json"));
const sharp = nextRequire("sharp");
const svg =
  Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
<defs><radialGradient id="sphere" cx="32%" cy="25%"><stop stop-color="#f8fcff"/><stop offset=".35" stop-color="#8bafc8"/><stop offset="1" stop-color="#285b83"/></radialGradient></defs>
<rect width="512" height="512" fill="#f3f6f8"/>
<g stroke="#7696b0" stroke-width="8" fill="none"><path d="M256 256L164 164M256 256L363 211M256 256L281 370M164 164L363 211L281 370Z" stroke-linejoin="round"/>
<ellipse cx="256" cy="256" rx="161" ry="125" transform="rotate(-25 256 256)" stroke-width="3"/></g>
<g fill="url(#sphere)"><circle cx="256" cy="256" r="65"/><circle cx="164" cy="164" r="28"/><circle cx="363" cy="211" r="32"/><circle cx="281" cy="370" r="26"/></g></svg>`);
for (const [name, size] of [
  ["atom-192", 192],
  ["atom-512", 512],
  ["atom-maskable-512", 512],
  ["apple-touch-icon", 180],
]) {
  await sharp(svg).resize(size, size).png().toFile(`public/icons/${name}.png`);
}
