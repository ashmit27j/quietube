#!/usr/bin/env node
/**
 * Generates every brand asset from one geometry, defined once below.
 *
 * Rendered by loading real SVG in Chromium via Playwright and screenshotting
 * it — not a raster library — so beziers and the vendored webfont render
 * exactly as a browser would show them. Never hand-edit a PNG; edit the
 * geometry here and regenerate.
 *
 * The mark: a wave that settles into a flat line ("quiet surf" is flat
 * water — the same idea as the product), with the flat tail breaking out to
 * the right, which also reads as a Q. Black and white only, no play-button
 * shape, no red — Chrome Web Store trademark rules forbid anything
 * confusable with YouTube's mark.
 *
 * Run: node tools/gen-brand.mjs
 */
import { chromium } from 'playwright';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const brandDir = join(root, 'brand');
const iconsDir = join(root, 'src/icons');
const storeDir = join(root, 'store');
for (const d of [brandDir, iconsDir, storeDir]) mkdirSync(d, { recursive: true });

// ── palette ──────────────────────────────────────────────────────────────
const INK = '#f5f5f7';
const BG = '#111113';
const GREY_BACKDROP = '#58595b';

// ── geometry (one 120x120 viewBox for everything) ───────────────────────
const WAVE_D = 'M20 74 C35 74, 31 35, 55 35 C67 35, 67 74, 83 74 L116 74';
const WAVE_STROKE_WIDTH = 9;
const RING = { cx: 58, cy: 60, r: 42, strokeWidth: 9 };
// Where the ring turns to mush at small sizes (16/32px) — wave only, redrawn
// bolder rather than just scaling the full mark down.
const SMALL_D = 'M14 74 C24 74, 27 34, 50 34 C73 34, 76 74, 92 74 L116 74';
const SMALL_STROKE_WIDTH = 13;

// ── font ─────────────────────────────────────────────────────────────────
const fontPath = join(brandDir, 'outfit-500.woff2');
const fontBase64 = readFileSync(fontPath).toString('base64');
const fontFace = `
  @font-face {
    font-family: 'Outfit';
    font-weight: 500;
    font-style: normal;
    src: url(data:font/woff2;base64,${fontBase64}) format('woff2');
  }
`;

// ── SVG builders ─────────────────────────────────────────────────────────

/** The full mark: ring + wave, ink-coloured strokes, transparent background. */
function markSvg({ ink = INK } = {}) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">
  <circle cx="${RING.cx}" cy="${RING.cy}" r="${RING.r}" fill="none" stroke="${ink}" stroke-width="${RING.strokeWidth}"/>
  <path d="${WAVE_D}" fill="none" stroke="${ink}" stroke-width="${WAVE_STROKE_WIDTH}" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;
}

/** The small mark: wave only, bolder stroke, no ring — for 16/32px use. */
function markSimpleSvg({ ink = INK } = {}) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">
  <path d="${SMALL_D}" fill="none" stroke="${ink}" stroke-width="${SMALL_STROKE_WIDTH}" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;
}

/** The app icon: BG rounded square, mark centred at 0.82 scale. */
function iconSvg({ size, simple }) {
  const scale = 0.82;
  const translate = (120 * (1 - scale)) / 2;
  const inner = simple ? markSimpleSvg({ ink: INK }) : markSvg({ ink: INK });
  const innerBody = inner.replace(/^<svg[^>]*>|<\/svg>$/g, '');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 120 120">
  <rect x="0" y="0" width="120" height="120" rx="27" fill="${BG}"/>
  <g transform="translate(${translate} ${translate}) scale(${scale})">
    ${innerBody}
  </g>
</svg>`;
}

/** The lockup: mark + wordmark text, for use on a supplied backdrop colour. */
function wordmarkSvg({ backdrop = null, ink = INK, embedFont = true } = {}) {
  const markBody = markSvg({ ink }).replace(/^<svg[^>]*>|<\/svg>$/g, '');
  const bg = backdrop ? `<rect x="0" y="0" width="560" height="150" fill="${backdrop}"/>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 560 150">
  <style>${embedFont ? fontFace : ''}</style>
  ${bg}
  <g transform="translate(10 15)">
    ${markBody}
  </g>
  <text x="150" y="96" font-family="Outfit, sans-serif" font-size="76" font-weight="500" letter-spacing="-1.5" fill="${ink}">QuietSurf</text>
</svg>`;
}

// ── write the portable SVG files ─────────────────────────────────────────
writeFileSync(join(brandDir, 'mark.svg'), markSvg());
writeFileSync(join(brandDir, 'mark-simple.svg'), markSimpleSvg());
writeFileSync(join(brandDir, 'wordmark.svg'), wordmarkSvg({ backdrop: BG }));
console.log('wrote brand/mark.svg, brand/mark-simple.svg, brand/wordmark.svg');

// ── render everything else to PNG via a real browser ─────────────────────
const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 1 });

async function renderToPng(svg, size, outPath, { transparent = false } = {}) {
  const [w, h] = Array.isArray(size) ? size : [size, size];
  await page.setViewportSize({ width: w, height: h });
  await page.setContent(
    `<!doctype html><html><head><style>html,body{margin:0;padding:0;background:${transparent ? 'transparent' : '#fff'}}svg{display:block}</style></head><body>${svg}</body></html>`
  );
  await page.evaluate(() => document.fonts.ready);
  await page.locator('svg').screenshot({ path: outPath, omitBackground: transparent });
  console.log(`wrote ${outPath.split(root)[1].replace(/^[\\/]/, '').replace(/\\/g, '/')}`);
}

// icons: RING+WAVE at 48/128, SMALL wave-only at 16/32
await renderToPng(iconSvg({ size: 16, simple: true }), 16, join(iconsDir, '16.png'));
await renderToPng(iconSvg({ size: 32, simple: true }), 32, join(iconsDir, '32.png'));
await renderToPng(iconSvg({ size: 48, simple: false }), 48, join(iconsDir, '48.png'));
await renderToPng(iconSvg({ size: 128, simple: false }), 128, join(iconsDir, '128.png'));

// mark-512.png: the mark alone, transparent background
await renderToPng(markSvg(), 512, join(brandDir, 'mark-512.png'), { transparent: true });

// wordmark PNGs: same two colours as everywhere else, no third colour
// invented — light backdrop is just the ink/backdrop pair flipped.
await renderToPng(wordmarkSvg({ backdrop: BG, ink: INK }), [560, 150], join(brandDir, 'wordmark-dark.png'));
await renderToPng(wordmarkSvg({ backdrop: INK, ink: BG }), [560, 150], join(brandDir, 'wordmark-light.png'));
await renderToPng(wordmarkSvg({ backdrop: GREY_BACKDROP, ink: INK }), [560, 150], join(brandDir, 'wordmark-grey.png'));

// store/promo-440x280.png: the lockup, dark backdrop, centred
const promoSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 440 280">
  <style>${fontFace}</style>
  <rect x="0" y="0" width="440" height="280" fill="${BG}"/>
  <g transform="translate(50 76) scale(0.75)">
    ${wordmarkSvg({ ink: INK }).replace(/^<svg[^>]*>|<\/svg>$/g, '').replace(/<style>.*?<\/style>/s, '')}
  </g>
  <text x="60" y="200" font-family="Outfit, sans-serif" font-size="20" font-weight="500" fill="#9a9a9d">Free forever. No account. No tracking.</text>
</svg>`;
await renderToPng(promoSvg, [440, 280], join(storeDir, 'promo-440x280.png'));

await browser.close();
console.log('done.');
