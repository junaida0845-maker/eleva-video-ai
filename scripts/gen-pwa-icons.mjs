// Generates PWA icons for ELEVA.
// Each PNG has: #0a0a0a background + centered "ELEVA" in Cormorant Garamond-ish gold (#c9a84c).
// Run: node scripts/gen-pwa-icons.mjs
import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const outDir = path.resolve(process.cwd(), 'icons');
await mkdir(outDir, { recursive: true });

const BG = '#0a0a0a';
const FG = '#c9a84c';

// Generic SVG builder. We use sharp's built-in font rendering (font-family fallback).
// Letterspacing + weight approximates Cormorant Garamond Bold in spirit; the PNG renderer
// on this box doesn't ship Cormorant, so we fall back to a serif stack and keep tracking wide.
function svgFor(size) {
  // Font size scales with output size. 22% of side is a good target for a 5-letter mark.
  const fs = Math.round(size * 0.22);
  const letterSpacing = Math.max(1, Math.round(size * 0.015));
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="100%" height="100%" fill="${BG}"/>
  <text x="50%" y="50%"
        text-anchor="middle"
        dominant-baseline="central"
        fill="${FG}"
        font-family="'Cormorant Garamond','Garamond','Times New Roman',serif"
        font-weight="700"
        font-size="${fs}"
        letter-spacing="${letterSpacing}">ELEVA</text>
</svg>`;
}

const targets = [
  { size: 32,  name: 'icon-32.png' },
  { size: 180, name: 'icon-180.png' },       // apple-touch-icon
  { size: 192, name: 'icon-192.png' },
  { size: 512, name: 'icon-512.png' },
  { size: 512, name: 'icon-512-maskable.png' } // same art, declared "any maskable" in manifest
];

for (const t of targets) {
  const svg = svgFor(t.size);
  const outPath = path.join(outDir, t.name);
  await sharp(Buffer.from(svg)).png().toFile(outPath);
  console.log('wrote', outPath);
}

// favicon.ico (32x32 PNG-in-ICO is widely supported)
await sharp(Buffer.from(svgFor(32))).resize(32, 32).toFile(path.join(outDir, 'favicon.png'));
console.log('done');
