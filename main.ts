// The Passport Page of a Country That Isn't There
// make.fun bounty: the-passport-page-of-a-countr-2-20261121-0318
//
// A Node 22 program (standard library only, no network, no image or font
// files) that draws one invented passport spread — the Republic of
// Thalassia — as pixels it computes itself, and writes it to
// /output/entry.png (or $MAKEFUN_OUTPUT_DIR/entry.png).
//
// The spread is built to read as a real working document:
//  * left page: the data page — portrait, personal data, MRZ strip with
//    real ICAO check digits, a language column;
//  * right page: the visa page — arrival/departure stamps from three
//    neighbouring countries, every date after the passport's issue date,
//    plus a "Lightkeeper's Visa" condition and a harbour-fee stamp: the
//    one telling detail of paperwork that reveals what Thalassia is.
//
// All dates agree: issued 12 MAR 2024, expires 11 MAR 2034; holder born
// 14 JUN 1988 in Port Halcyon; every stamp falls between issue and today.

import * as fs from "node:fs";
import * as path from "node:path";
import * as zlib from "node:zlib";

// ---------------------------------------------------------------------------
// Deterministic PRNG (mulberry32) — the program must be deterministic.
// ---------------------------------------------------------------------------
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------------------
// 5x7 bitmap font. Each glyph is 7 rows of 5 bits, top row first.
// Only capitals, digits and the punctuation the document needs.
// ---------------------------------------------------------------------------
const FONT: Record<string, number[]> = {
  "0": [0b01110, 0b10001, 0b10011, 0b10101, 0b11001, 0b10001, 0b01110],
  "1": [0b00100, 0b01100, 0b00100, 0b00100, 0b00100, 0b00100, 0b01110],
  "2": [0b01110, 0b10001, 0b00001, 0b00110, 0b01000, 0b10000, 0b11111],
  "3": [0b11111, 0b00010, 0b00100, 0b00010, 0b00001, 0b10001, 0b01110],
  "4": [0b00010, 0b00110, 0b01010, 0b10010, 0b11111, 0b00010, 0b00010],
  "5": [0b11111, 0b10000, 0b11110, 0b00001, 0b00001, 0b10001, 0b01110],
  "6": [0b00110, 0b01000, 0b10000, 0b11110, 0b10001, 0b10001, 0b01110],
  "7": [0b11111, 0b00001, 0b00010, 0b00100, 0b01000, 0b01000, 0b01000],
  "8": [0b01110, 0b10001, 0b10001, 0b01110, 0b10001, 0b10001, 0b01110],
  "9": [0b01110, 0b10001, 0b10001, 0b01111, 0b00001, 0b00010, 0b01100],
  A: [0b01110, 0b10001, 0b10001, 0b11111, 0b10001, 0b10001, 0b10001],
  B: [0b11110, 0b10001, 0b10001, 0b11110, 0b10001, 0b10001, 0b11110],
  C: [0b01110, 0b10001, 0b10000, 0b10000, 0b10000, 0b10001, 0b01110],
  D: [0b11110, 0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b11110],
  E: [0b11111, 0b10000, 0b10000, 0b11110, 0b10000, 0b10000, 0b11111],
  F: [0b11111, 0b10000, 0b10000, 0b11110, 0b10000, 0b10000, 0b10000],
  G: [0b01110, 0b10001, 0b10000, 0b10111, 0b10001, 0b10001, 0b01111],
  H: [0b10001, 0b10001, 0b10001, 0b11111, 0b10001, 0b10001, 0b10001],
  I: [0b01110, 0b00100, 0b00100, 0b00100, 0b00100, 0b00100, 0b01110],
  J: [0b00111, 0b00010, 0b00010, 0b00010, 0b00010, 0b10010, 0b01100],
  K: [0b10001, 0b10010, 0b10100, 0b11000, 0b10100, 0b10010, 0b10001],
  L: [0b10000, 0b10000, 0b10000, 0b10000, 0b10000, 0b10000, 0b11111],
  M: [0b10001, 0b11011, 0b10101, 0b10101, 0b10001, 0b10001, 0b10001],
  N: [0b10001, 0b11001, 0b10101, 0b10011, 0b10001, 0b10001, 0b10001],
  O: [0b01110, 0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b01110],
  P: [0b11110, 0b10001, 0b10001, 0b11110, 0b10000, 0b10000, 0b10000],
  Q: [0b01110, 0b10001, 0b10001, 0b10001, 0b10101, 0b10010, 0b01101],
  R: [0b11110, 0b10001, 0b10001, 0b11110, 0b10100, 0b10010, 0b10001],
  S: [0b01111, 0b10000, 0b10000, 0b01110, 0b00001, 0b00001, 0b11110],
  T: [0b11111, 0b00100, 0b00100, 0b00100, 0b00100, 0b00100, 0b00100],
  U: [0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b01110],
  V: [0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b01010, 0b00100],
  W: [0b10001, 0b10001, 0b10001, 0b10101, 0b10101, 0b10101, 0b01010],
  X: [0b10001, 0b10001, 0b01010, 0b00100, 0b01010, 0b10001, 0b10001],
  Y: [0b10001, 0b10001, 0b01010, 0b00100, 0b00100, 0b00100, 0b00100],
  Z: [0b11111, 0b00001, 0b00010, 0b00100, 0b01000, 0b10000, 0b11111],
  " ": [0, 0, 0, 0, 0, 0, 0],
  "!": [0b00100, 0b00100, 0b00100, 0b00100, 0b00100, 0b00000, 0b00100],
  '"': [0b01010, 0b01010, 0, 0, 0, 0, 0],
  "#": [0b01010, 0b01010, 0b11111, 0b01010, 0b11111, 0b01010, 0b01010],
  "%": [0b11001, 0b11010, 0b00010, 0b00100, 0b01000, 0b01011, 0b10011],
  "&": [0b01100, 0b10010, 0b10100, 0b01000, 0b10101, 0b10010, 0b01101],
  "'": [0b00100, 0b00100, 0b01000, 0, 0, 0, 0],
  "(": [0b00010, 0b00100, 0b01000, 0b01000, 0b01000, 0b00100, 0b00010],
  ")": [0b01000, 0b00100, 0b00010, 0b00010, 0b00010, 0b00100, 0b01000],
  "*": [0, 0b10101, 0b01110, 0b11111, 0b01110, 0b10101, 0],
  "+": [0, 0b00100, 0b00100, 0b01110, 0b00100, 0b00100, 0],
  ",": [0, 0, 0, 0, 0b01100, 0b00100, 0b01000],
  "-": [0, 0, 0, 0b01110, 0, 0, 0],
  ".": [0, 0, 0, 0, 0, 0b01100, 0b01100],
  "/": [0b00001, 0b00010, 0b00010, 0b00100, 0b01000, 0b01000, 0b10000],
  ":": [0, 0b01100, 0b01100, 0, 0b01100, 0b01100, 0],
  ";": [0, 0b01100, 0b01100, 0, 0b01100, 0b00100, 0b01000],
  "<": [0b00010, 0b00100, 0b01000, 0b10000, 0b01000, 0b00100, 0b00010],
  "=": [0, 0, 0b11111, 0, 0b11111, 0, 0],
  ">": [0b01000, 0b00100, 0b00010, 0b00001, 0b00010, 0b00100, 0b01000],
  "?": [0b01110, 0b10001, 0b00001, 0b00110, 0b00100, 0, 0b00100],
  "@": [0b01110, 0b10001, 0b10111, 0b10101, 0b10110, 0b10000, 0b01110],
  "[": [0b01110, 0b01000, 0b01000, 0b01000, 0b01000, 0b01000, 0b01110],
  "]": [0b01110, 0b00010, 0b00010, 0b00010, 0b00010, 0b00010, 0b01110],
  _: [0, 0, 0, 0, 0, 0, 0b11111],
  "·": [0, 0, 0b01100, 0b01100, 0, 0, 0],
  "’": [0b00100, 0b00100, 0b01000, 0, 0, 0, 0],
  "—": [0, 0, 0, 0b01110, 0, 0, 0],
};

// ---------------------------------------------------------------------------
// Minimal PNG encoder: signature, IHDR, IDAT (zlib), IEND, correct CRC32.
// ---------------------------------------------------------------------------
const CRC_TABLE: Uint32Array = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Buffer): Buffer {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, "ascii");
  data.copy(out, 8);
  const crc = crc32(Buffer.concat([Buffer.from(type, "ascii"), data]));
  out.writeUInt32BE(crc, 8 + data.length);
  return out;
}

function encodePNG(width: number, height: number, rgb: Uint8Array): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type 2 = RGB
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace
  // Raw scanlines: one filter byte (0 = none) per row, then RGB triples.
  const raw = Buffer.alloc(height * (1 + width * 3));
  for (let y = 0; y < height; y++) {
    raw[y * (1 + width * 3)] = 0;
    Buffer.from(rgb.buffer, y * width * 3, width * 3).copy(
      raw,
      y * (1 + width * 3) + 1,
    );
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", idat),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

// ---------------------------------------------------------------------------
// Colour helpers
// ---------------------------------------------------------------------------
type RGB = [number, number, number];
const NAVY: RGB = [28, 42, 74];
const INK: RGB = [32, 34, 44];
const LABEL_GREY: RGB = [107, 100, 85];
const PAPER: RGB = [246, 241, 226];
const PAPER_DARK: RGB = [233, 228, 210];
const GOLD: RGB = [176, 141, 58];

function blend(dst: RGB, src: RGB, a: number): RGB {
  return [
    Math.round(dst[0] * (1 - a) + src[0] * a),
    Math.round(dst[1] * (1 - a) + src[1] * a),
    Math.round(dst[2] * (1 - a) + src[2] * a),
  ];
}

// ---------------------------------------------------------------------------
// Canvas: an RGB pixel buffer with the drawing primitives the spread needs.
// ---------------------------------------------------------------------------
class Canvas {
  readonly w: number;
  readonly h: number;
  readonly px: Uint8Array; // 3 bytes per pixel, row-major

  constructor(w: number, h: number, fill: RGB = [255, 255, 255]) {
    this.w = w;
    this.h = h;
    this.px = new Uint8Array(w * h * 3);
    this.fillRect(0, 0, w, h, fill);
  }

  set(x: number, y: number, c: RGB, a = 1): void {
    const ix = Math.round(x);
    const iy = Math.round(y);
    if (ix < 0 || iy < 0 || ix >= this.w || iy >= this.h) return;
    const o = (iy * this.w + ix) * 3;
    if (a >= 1) {
      this.px[o] = c[0];
      this.px[o + 1] = c[1];
      this.px[o + 2] = c[2];
    } else {
      this.px[o] = Math.round(this.px[o] * (1 - a) + c[0] * a);
      this.px[o + 1] = Math.round(this.px[o + 1] * (1 - a) + c[1] * a);
      this.px[o + 2] = Math.round(this.px[o + 2] * (1 - a) + c[2] * a);
    }
  }

  fillRect(x: number, y: number, w: number, h: number, c: RGB, a = 1): void {
    const x0 = Math.max(0, Math.floor(x));
    const y0 = Math.max(0, Math.floor(y));
    const x1 = Math.min(this.w, Math.ceil(x + w));
    const y1 = Math.min(this.h, Math.ceil(y + h));
    for (let yy = y0; yy < y1; yy++) {
      for (let xx = x0; xx < x1; xx++) this.set(xx, yy, c, a);
    }
  }

  rect(x: number, y: number, w: number, h: number, c: RGB, t = 1): void {
    this.fillRect(x, y, w, t, c);
    this.fillRect(x, y + h - t, w, t, c);
    this.fillRect(x, y, t, h, c);
    this.fillRect(x + w - t, y, t, h, c);
  }

  hline(x0: number, x1: number, y: number, c: RGB, t = 1): void {
    this.fillRect(Math.min(x0, x1), y, Math.abs(x1 - x0), t, c);
  }

  vline(x: number, y0: number, y1: number, c: RGB, t = 1): void {
    this.fillRect(x, Math.min(y0, y1), t, Math.abs(y1 - y0), c);
  }

  line(x0: number, y0: number, x1: number, y1: number, c: RGB, t = 1): void {
    // Bresenham, with thickness by stamping a small square at each step.
    let dx = Math.abs(x1 - x0);
    let dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    let x = Math.round(x0);
    let y = Math.round(y0);
    const r = Math.max(0, Math.floor(t / 2));
    for (;;) {
      this.fillRect(x - r, y - r, 2 * r + 1, 2 * r + 1, c);
      if (x === Math.round(x1) && y === Math.round(y1)) break;
      const e2 = 2 * err;
      if (e2 >= dy) {
        err += dy;
        x += sx;
      }
      if (e2 <= dx) {
        err += dx;
        y += sy;
      }
    }
  }

  fillCircle(cx: number, cy: number, r: number, c: RGB, a = 1): void {
    for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) {
      for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
        const dx = x - cx;
        const dy = y - cy;
        if (dx * dx + dy * dy <= r * r) this.set(x, y, c, a);
      }
    }
  }

  circle(cx: number, cy: number, r: number, c: RGB, t = 1): void {
    for (let y = Math.floor(cy - r - t); y <= Math.ceil(cy + r + t); y++) {
      for (let x = Math.floor(cx - r - t); x <= Math.ceil(cx + r + t); x++) {
        const d = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
        if (Math.abs(d - r) <= t / 2) this.set(x, y, c);
      }
    }
  }

  fillEllipse(cx: number, cy: number, rx: number, ry: number, c: RGB, a = 1,
    clip?: [number, number, number, number]): void {
    const x0 = clip ? Math.max(Math.floor(cx - rx), clip[0]) : Math.floor(cx - rx);
    const x1 = clip ? Math.min(Math.ceil(cx + rx), clip[2]) : Math.ceil(cx + rx);
    const y0 = clip ? Math.max(Math.floor(cy - ry), clip[1]) : Math.floor(cy - ry);
    const y1 = clip ? Math.min(Math.ceil(cy + ry), clip[3]) : Math.ceil(cy + ry);
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const dx = (x - cx) / rx;
        const dy = (y - cy) / ry;
        if (dx * dx + dy * dy <= 1) this.set(x, y, c, a);
      }
    }
  }

  // Fill a triangle by scanline.
  fillTriangle(
    ax: number, ay: number, bx: number, by: number,
    cx: number, cy: number, c: RGB, a = 1,
  ): void {
    const minX = Math.floor(Math.min(ax, bx, cx));
    const maxX = Math.ceil(Math.max(ax, bx, cx));
    const minY = Math.floor(Math.min(ay, by, cy));
    const maxY = Math.ceil(Math.max(ay, by, cy));
    const d = (ax - cx) * (by - cy) - (bx - cx) * (ay - cy);
    if (d === 0) return;
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const s = ((x - cx) * (by - cy) - (bx - cx) * (y - cy)) / d;
        const t = ((ax - cx) * (y - cy) - (x - cx) * (ay - cy)) / d;
        if (s >= 0 && t >= 0 && s + t <= 1) this.set(x, y, c, a);
      }
    }
  }

  // Five-point star, filled as a fan of triangles from its centre.
  fillStar(cx: number, cy: number, rOuter: number, rInner: number, c: RGB, a = 1): void {
    const pts: [number, number][] = [];
    for (let i = 0; i < 10; i++) {
      const r = i % 2 === 0 ? rOuter : rInner;
      const ang = -Math.PI / 2 + (i * Math.PI) / 5;
      pts.push([cx + r * Math.cos(ang), cy + r * Math.sin(ang)]);
    }
    for (let i = 0; i < 10; i++) {
      const p = pts[i];
      const q = pts[(i + 1) % 10];
      this.fillTriangle(cx, cy, p[0], p[1], q[0], q[1], c, a);
    }
  }

  // A gentle wave line, like a coastline on a chart.
  wave(x0: number, x1: number, yBase: number, amp: number, period: number, c: RGB, t = 1): void {
    for (let x = x0; x <= x1; x++) {
      const y = yBase + amp * Math.sin(((x - x0) / period) * Math.PI * 2);
      this.fillRect(x, Math.round(y), 1, t, c);
    }
  }

  textWidth(s: string, scale: number, spacing = 1): number {
    if (s.length === 0) return 0;
    return s.length * (5 * scale + spacing) - spacing;
  }

  text(s: string, x: number, y: number, scale: number, c: RGB, spacing = 1): void {
    let cx = Math.round(x);
    const cy = Math.round(y);
    for (const ch of s) {
      const g = FONT[ch] ?? FONT["?"];
      for (let row = 0; row < 7; row++) {
        const bits = g[row];
        for (let col = 0; col < 5; col++) {
          if (bits & (1 << (4 - col))) {
            this.fillRect(cx + col * scale, cy + row * scale, scale, scale, c);
          }
        }
      }
      cx += 5 * scale + spacing;
    }
  }

  textCentered(s: string, cx: number, y: number, scale: number, c: RGB, spacing = 1): void {
    this.text(s, cx - this.textWidth(s, scale, spacing) / 2, y, scale, c, spacing);
  }

  // Blit another canvas rotated about (cx, cy) by angleDeg, nearest sample.
  blitRotated(src: Canvas, cx: number, cy: number, angleDeg: number, alpha = 1): void {
    const a = (angleDeg * Math.PI) / 180;
    const cos = Math.cos(a);
    const sin = Math.sin(a);
    const hw = src.w / 2;
    const hh = src.h / 2;
    const rad = Math.ceil(Math.sqrt(hw * hw + hh * hh));
    for (let dy = -rad; dy <= rad; dy++) {
      for (let dx = -rad; dx <= rad; dx++) {
        // Inverse-rotate the destination offset back into source space.
        const sx = dx * cos + dy * sin + hw;
        const sy = -dx * sin + dy * cos + hh;
        const six = Math.floor(sx);
        const siy = Math.floor(sy);
        if (six < 0 || siy < 0 || six >= src.w || siy >= src.h) continue;
        const so = (siy * src.w + six) * 3;
        // Source pixels left pure white are treated as transparent.
        if (src.px[so] === 255 && src.px[so + 1] === 255 && src.px[so + 2] === 255) continue;
        this.set(cx + dx, cy + dy, [src.px[so], src.px[so + 1], src.px[so + 2]], alpha);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// MRZ (ICAO 9303): check digits with weights 7, 3, 1; A=10 ... Z=35, '<'=0.
// ---------------------------------------------------------------------------
function mrzValue(ch: string): number {
  if (ch >= "0" && ch <= "9") return ch.charCodeAt(0) - 48;
  if (ch >= "A" && ch <= "Z") return ch.charCodeAt(0) - 55;
  return 0;
}

function mrzCheck(s: string): number {
  const w = [7, 3, 1];
  let sum = 0;
  for (let i = 0; i < s.length; i++) sum += mrzValue(s[i]) * w[i % 3];
  return sum % 10;
}

function buildMRZ(): [string, string] {
  const line1 = ("P<THA" + "VOSS<<MARA<ELIN").padEnd(44, "<");
  const docNo = "TH4829137";
  const dob = "880614"; // 14 JUN 1988
  const expiry = "340311"; // 11 MAR 2034
  const personal = "<<<<<<<<<<<<<<";
  const docCheck = mrzCheck(docNo);
  const dobCheck = mrzCheck(dob);
  const expCheck = mrzCheck(expiry);
  const perCheck = mrzCheck(personal);
  const composite = mrzCheck(
    docNo + docCheck + dob + dobCheck + expiry + expCheck + personal + perCheck,
  );
  const line2 =
    docNo + docCheck + "THA" + dob + dobCheck + "F" + expiry + expCheck +
    personal + perCheck + composite;
  if (line1.length !== 44 || line2.length !== 44) {
    throw new Error(`MRZ length wrong: ${line1.length} / ${line2.length}`);
  }
  return [line1, line2];
}

// ---------------------------------------------------------------------------
// The Thalassian emblem: a ring, a five-point star, three waves below it —
// a lighthouse nation's arms. Drawn at (cx, cy) with radius r.
// ---------------------------------------------------------------------------
function drawEmblem(cv: Canvas, cx: number, cy: number, r: number, c: RGB, a = 1): void {
  cv.circle(cx, cy, r, c, Math.max(1, Math.round(r / 12)));
  cv.circle(cx, cy, r * 0.82, c, 1);
  cv.fillStar(cx, cy - r * 0.08, r * 0.52, r * 0.22, c, a);
  cv.wave(cx - r * 0.62, cx + r * 0.62, cy + r * 0.52, r * 0.08, r * 0.62, c, Math.max(1, Math.round(r / 14)));
  cv.wave(cx - r * 0.5, cx + r * 0.5, cy + r * 0.68, r * 0.07, r * 0.5, c, Math.max(1, Math.round(r / 14)));
}

// The Thalassian flag: deep teal, white, gold — a star on the middle band.
function drawFlag(cv: Canvas, x: number, y: number, w: number, h: number): void {
  const band = h / 3;
  cv.fillRect(x, y, w, band, [18, 84, 96]);
  cv.fillRect(x, y + band, w, band, [244, 240, 228]);
  cv.fillRect(x, y + 2 * band, w, band, [176, 141, 58]);
  cv.fillStar(x + w / 2, y + h / 2, band * 0.42, band * 0.18, [18, 84, 96]);
  cv.rect(x, y, w, h, NAVY, 1);
}

// The holder's portrait: a silhouette against a pale studio backdrop,
// with faint horizontal scan lines, as a passport photo reads.
function drawPhoto(cv: Canvas, x: number, y: number, w: number, h: number): void {
  for (let yy = 0; yy < h; yy++) {
    const t = yy / h;
    const c: RGB = [
      Math.round(185 + (143 - 185) * t),
      Math.round(199 + (165 - 199) * t),
      Math.round(214 + (187 - 214) * t),
    ];
    cv.fillRect(x, y + yy, w, 1, c);
  }
  // Faint scan lines.
  for (let yy = 4; yy < h; yy += 6) cv.fillRect(x, y + yy, w, 1, [160, 175, 192], 0.5);
  // Head and shoulders, in silhouette: a bust, not a keyhole.
  const cx = x + w / 2;
  const headR = w * 0.19;
  const headCy = y + h * 0.33;
  // Neck.
  cv.fillRect(cx - headR * 0.3, headCy + headR * 0.7, headR * 0.6, h * 0.12, [44, 58, 82]);
  // Shoulders: a wide ellipse whose top arc forms the bust line,
  // clipped to the photo frame.
  cv.fillEllipse(cx, y + h * 1.02, w * 0.46, h * 0.3, [44, 58, 82], 1, [x, y, x + w, y + h]);
  // Head.
  cv.fillCircle(cx, headCy, headR, [44, 58, 82]);
  cv.rect(x, y, w, h, NAVY, 2);
  // Corner ticks, like a photo booth frame.
  const t = 8;
  cv.fillRect(x - 1, y - 1, t, 2, INK);
  cv.fillRect(x - 1, y - 1, 2, t, INK);
  cv.fillRect(x + w - t + 1, y - 1, t, 2, INK);
  cv.fillRect(x + w - 1, y - 1, 2, t, INK);
}

// One border-control stamp, drawn on its own small canvas so the caller
// can rotate it onto the visa page.
function makeStamp(
  kind: string, place: string, date: string, code: string, ink: RGB,
): Canvas {
  const W = 214;
  const H = 104;
  const s = new Canvas(W, H, [255, 255, 255]);
  s.rect(4, 4, W - 8, H - 8, ink, 3);
  s.rect(10, 10, W - 20, H - 20, ink, 1);
  s.textCentered(kind, W / 2, 16, 1, ink, 2);
  s.hline(16, W - 16, 28, ink, 1);
  s.textCentered(place, W / 2, 36, 2, ink, 1);
  s.textCentered(date, W / 2, 58, 1, ink, 2);
  s.hline(16, W - 16, 74, ink, 1);
  s.textCentered(code, W / 2, 80, 1, ink, 1);
  return s;
}

// ---------------------------------------------------------------------------
// The spread.
// ---------------------------------------------------------------------------
const W = 1024;
const H = 640;

function drawSpread(): Canvas {
  const cv = new Canvas(W, H, [38, 38, 44]); // dark desk under the open book

  // Paper grain: low-frequency value noise, so the PNG stays small.
  const rng = mulberry32(20261121);
  const gw = 64;
  const gh = 40;
  const grid: number[] = [];
  for (let i = 0; i < (gw + 1) * (gh + 1); i++) grid.push(rng() * 2 - 1);
  const noiseAt = (x: number, y: number): number => {
    const fx = (x / W) * gw;
    const fy = (y / H) * gh;
    const x0 = Math.floor(fx);
    const y0 = Math.floor(fy);
    const tx = fx - x0;
    const ty = fy - y0;
    const g = (ix: number, iy: number) => grid[iy * (gw + 1) + ix];
    const v =
      g(x0, y0) * (1 - tx) * (1 - ty) +
      g(x0 + 1, y0) * tx * (1 - ty) +
      g(x0, y0 + 1) * (1 - tx) * ty +
      g(x0 + 1, y0 + 1) * tx * ty;
    return v * 4;
  };

  // Two pages with a gutter shadow between them.
  const pages = [
    { x: 20, y: 20, w: 476, h: 600 },
    { x: 528, y: 20, w: 476, h: 600 },
  ];
  for (const p of pages) {
    cv.fillRect(p.x + 4, p.y + 5, p.w, p.h, [0, 0, 0], 0.35);
    cv.fillRect(p.x, p.y, p.w, p.h, PAPER);
    for (let y = p.y; y < p.y + p.h; y++) {
      for (let x = p.x; x < p.x + p.w; x++) {
        const n = noiseAt(x, y);
        const o = (y * W + x) * 3;
        cv.px[o] = Math.max(0, Math.min(255, cv.px[o] + n));
        cv.px[o + 1] = Math.max(0, Math.min(255, cv.px[o + 1] + n));
        cv.px[o + 2] = Math.max(0, Math.min(255, cv.px[o + 2] + n));
      }
    }
    cv.rect(p.x, p.y, p.w, p.h, [120, 110, 88], 1);
  }
  // Gutter shading on the inner edges.
  for (let y = 20; y < 620; y++) {
    cv.fillRect(492, y, 4, 1, [0, 0, 0], 0.12);
    cv.fillRect(528, y, 4, 1, [0, 0, 0], 0.12);
  }

  // ================= LEFT PAGE: the data page =================
  const L = 20; // left page x
  // Faint guilloche arcs across the data page.
  for (let i = 0; i < 12; i++) {
    const yBase = 150 + i * 26;
    cv.wave(L + 16, L + 460, yBase, 5, 46, [196, 208, 220], 1);
  }

  drawEmblem(cv, L + 44, 62, 26, NAVY);
  cv.textCentered("REPUBLIC OF THALASSIA", L + 258, 40, 2, NAVY);
  cv.textCentered("PASSPORT", L + 258, 66, 3, NAVY);
  cv.textCentered("PASSEPORT", L + 258, 92, 1, LABEL_GREY, 2);
  drawFlag(cv, L + 406, 38, 54, 36);
  cv.hline(L + 16, L + 460, 112, NAVY, 2);

  // Type / code / number row.
  cv.text("TYPE", L + 24, 124, 1, LABEL_GREY);
  cv.text("P", L + 24, 136, 2, INK);
  cv.text("CODE", L + 120, 124, 1, LABEL_GREY);
  cv.text("THA", L + 120, 136, 2, INK);
  cv.text("PASSPORT NO.", L + 240, 124, 1, LABEL_GREY);
  cv.text("TH4829137", L + 240, 136, 2, INK);

  // Portrait.
  drawPhoto(cv, L + 24, 168, 150, 190);
  // Holder's signature under the photo.
  const sigY = 372;
  for (let x = 0; x < 140; x++) {
    const y = sigY + Math.round(4 * Math.sin(x / 9) + 2 * Math.sin(x / 3.7));
    cv.set(L + 29 + x, y, [40, 60, 120]);
    cv.set(L + 29 + x, y + 1, [40, 60, 120]);
  }
  cv.hline(L + 24, L + 174, 384, INK, 1);
  cv.text("SIGNATURE OF HOLDER", L + 24, 390, 1, LABEL_GREY);
  // Language column: the paperwork detail on the data page.
  cv.text("LANGUAGES", L + 24, 414, 1, LABEL_GREY);
  cv.text("THALASSIAN", L + 24, 428, 1, INK);
  cv.text("ENGLISH", L + 24, 440, 1, INK);
  cv.text("FRENCH", L + 24, 452, 1, INK);
  cv.text("ISSUING AUTHORITY", L + 24, 472, 1, LABEL_GREY);
  cv.text("PORT HALCYON", L + 24, 484, 1, INK);

  // Personal data, one column, labels over values, consistent sizes.
  const fields: [string, string][] = [
    ["SURNAME", "VOSS"],
    ["GIVEN NAMES", "MARA ELIN"],
    ["NATIONALITY", "THALASSIAN"],
    ["DATE OF BIRTH", "14 JUN 1988"],
    ["PLACE OF BIRTH", "PORT HALCYON"],
    ["SEX", "F"],
    ["DATE OF ISSUE", "12 MAR 2024"],
    ["DATE OF EXPIRY", "11 MAR 2034"],
  ];
  let fy = 168;
  for (const [label, value] of fields) {
    cv.text(label, L + 198, fy, 1, LABEL_GREY);
    cv.text(value, L + 198, fy + 11, 2, INK);
    fy += 40;
  }

  // Machine-readable zone, with real check digits.
  const [mrz1, mrz2] = buildMRZ();
  cv.fillRect(L + 16, 504, 444, 100, PAPER_DARK);
  cv.hline(L + 16, L + 460, 504, NAVY, 1);
  cv.text(mrz1, L + 18, 522, 2, INK, 0);
  cv.text(mrz2, L + 18, 548, 2, INK, 0);
  cv.textCentered("THIS PASSPORT REMAINS THE PROPERTY OF THE REPUBLIC OF THALASSIA",
    L + 238, 584, 1, LABEL_GREY);

  // ================= RIGHT PAGE: the visa page =================
  const R = 528; // right page x
  cv.textCentered("VISAS", R + 238, 40, 2, NAVY);
  cv.textCentered("PAGES 12 - 13", R + 238, 64, 1, LABEL_GREY, 2);
  cv.hline(R + 16, R + 460, 88, NAVY, 2);

  // Faint watermark emblem behind the stamps.
  drawEmblem(cv, R + 238, 300, 110, [200, 205, 215], 0.55);

  // Six stamps, 2 columns x 3 rows, each slightly rotated.
  // Travel history, all after the 12 MAR 2024 issue:
  //   out of Thalassia 02 APR 2024, into Kestrel Coast 04 APR 2024,
  //   into Dunmere 19 JUL 2024, out of Dunmere 02 AUG 2024,
  //   into the Isle of Sorren 02 OCT 2024, into Kestrel Coast 28 JAN 2025.
  const BLUE: RGB = [31, 78, 156];
  const PURPLE: RGB = [107, 63, 160];
  const GREEN: RGB = [46, 125, 79];
  const stamps: { kind: string; place: string; date: string; code: string; ink: RGB; rot: number }[] = [
    { kind: "DEPARTURE", place: "THALASSIA", date: "02 APR 2024", code: "PORT HALCYON", ink: BLUE, rot: -6 },
    { kind: "ARRIVAL", place: "KESTREL COAST", date: "04 APR 2024", code: "HARBOUR GATE 3", ink: BLUE, rot: 4 },
    { kind: "ARRIVAL", place: "DUNMERE", date: "19 JUL 2024", code: "NORTH PIER", ink: PURPLE, rot: -3 },
    { kind: "DEPARTURE", place: "DUNMERE", date: "02 AUG 2024", code: "NORTH PIER", ink: PURPLE, rot: 6 },
    { kind: "ARRIVAL", place: "ISLE OF SORREN", date: "02 OCT 2024", code: "FERRY TERMINAL", ink: GREEN, rot: -5 },
    { kind: "ARRIVAL", place: "KESTREL COAST", date: "28 JAN 2025", code: "HARBOUR GATE 3", ink: GREEN, rot: 3 },
  ];
  const stampXs = [R + 28, R + 254];
  const stampYs = [104, 220, 336];
  stamps.forEach((s, i) => {
    const stamp = makeStamp(s.kind, s.place, s.date, s.code, s.ink);
    const cx = stampXs[i % 2] + 107;
    const cy = stampYs[Math.floor(i / 2)] + 52;
    cv.blitRotated(stamp, cx, cy, s.rot, 0.85);
  });

  // The telling detail: the visa condition box, with a fee stamp over it.
  const boxY = 456;
  cv.fillRect(R + 16, boxY, 444, 148, [250, 246, 232]);
  cv.rect(R + 16, boxY, 444, 148, NAVY, 2);
  cv.text("CONDITIONS OF STAY", R + 32, boxY + 14, 1, NAVY, 2);
  cv.hline(R + 32, R + 200, boxY + 28, NAVY, 1);
  cv.text("LIGHTKEEPER'S VISA - 90 DAYS.", R + 32, boxY + 38, 1, INK);
  cv.text("NO PAID WORK EXCEPT", R + 32, boxY + 52, 1, INK);
  cv.text("HARBOUR DUTIES.", R + 32, boxY + 66, 1, INK);
  cv.text("FEE PAID: 12 TIDE-CROWNS.", R + 32, boxY + 86, 1, INK);
  cv.text("REPORT TO THE HARBOURMASTER", R + 32, boxY + 106, 1, INK);
  cv.text("WITHIN 48 HOURS OF ARRIVAL.", R + 32, boxY + 120, 1, INK);
  // Small red fee stamp overlapping the box corner.
  const fee = new Canvas(150, 44, [255, 255, 255]);
  fee.rect(2, 2, 146, 40, [156, 61, 46], 2);
  fee.textCentered("FEE PAID", 75, 8, 1, [156, 61, 46], 2);
  fee.textCentered("12 TIDE-CROWNS", 75, 24, 1, [156, 61, 46], 1);
  cv.blitRotated(fee, R + 380, boxY + 18, -8, 0.9);

  return cv;
}

// ---------------------------------------------------------------------------
// Main: draw, encode, validate, write.
// ---------------------------------------------------------------------------
function main(): void {
  const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? "/output";
  const outPath = path.join(outDir, "entry.png");
  fs.mkdirSync(outDir, { recursive: true });

  const cv = drawSpread();
  const png = encodePNG(W, H, cv.px);

  // Gate validation, in-program: the entry must be a whole PNG,
  // at most 1,048,576 bytes and at most 1024x1024 pixels.
  if (png.length > 1_048_576) {
    throw new Error(`entry.png too large: ${png.length} bytes (max 1,048,576)`);
  }
  if (W > 1024 || H > 1024) {
    throw new Error(`entry too large: ${W}x${H} (max 1024x1024)`);
  }
  // Read the file back: parse the PNG header and confirm the dimensions.
  if (png.readUInt32BE(16) !== W || png.readUInt32BE(20) !== H) {
    throw new Error("PNG header dimensions do not match the canvas");
  }
  if (png[12] !== 0x49 || png[13] !== 0x48 || png[14] !== 0x44 || png[15] !== 0x52) {
    throw new Error("first chunk is not IHDR");
  }
  const [mrz1, mrz2] = buildMRZ();
  if (mrz1.length !== 44 || mrz2.length !== 44) {
    throw new Error("MRZ lines are not 44 characters");
  }

  fs.writeFileSync(outPath, png);
  const back = fs.readFileSync(outPath);
  if (!back.equals(png)) throw new Error("read-back mismatch");
  console.log(`wrote ${outPath}: ${png.length} bytes, ${W}x${H}`);
  console.log(`MRZ: ${mrz1}`);
  console.log(`MRZ: ${mrz2}`);
}

main();
