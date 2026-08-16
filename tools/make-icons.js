/* Generates all PWA icons as PNGs with zero dependencies.
   Run:  node tools/make-icons.js
   Draws the Chromatic mark: a paint-accurate (RYB) hue disc on ink. */

const zlib = require('zlib');
const fs = require('fs');
const path = require('path');

/* ── PNG encoder ── */
const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();
function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}
function encodePNG(w, h, rgba) {
  const stride = w * 4;
  const raw = Buffer.alloc((stride + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (stride + 1)] = 0; // filter: none
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // colour type RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/* ── colour maths (mirrors the app) ── */
const RYB = [[0,0],[30,15],[60,30],[90,45],[120,60],[150,90],[180,120],[210,180],[240,240],[270,265],[300,280],[330,320],[360,360]];
function rybToRgbHue(h) {
  h = ((h % 360) + 360) % 360;
  for (let i = 0; i < RYB.length - 1; i++) {
    const [a, c] = RYB[i], [b, d] = RYB[i + 1];
    if (h >= a && h <= b) return c + ((h - a) / (b - a)) * (d - c);
  }
  return h;
}
function hslToRgb(h, s, l) {
  h = ((h % 360) + 360) % 360; s /= 100; l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = n => {
    const k = (n + h / 30) % 12;
    return 255 * (l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1));
  };
  return [f(0), f(8), f(4)];
}
const lerp = (a, b, t) => a + (b - a) * t;

/* ── the mark ── */
// wheelR / bgRadius are fractions of the icon edge.
function drawIcon(size, { wheelR = 0.40, bgRadius = 0.22, bleed = false }) {
  const SS = 3;                       // supersample factor
  const W = size * SS;
  const buf = Buffer.alloc(W * W * 4);
  const c = W / 2;
  const R = wheelR * W;
  const br = bleed ? 0 : bgRadius * W;
  const INK = [23, 24, 27];
  const CENTRE = [250, 249, 247];

  for (let y = 0; y < W; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      const dx = x - c + 0.5, dy = y - c + 0.5;
      const d = Math.hypot(dx, dy);

      // background: rounded square (or full bleed for maskable)
      let inBg = true;
      if (!bleed) {
        const qx = Math.abs(dx) - (W / 2 - br), qy = Math.abs(dy) - (W / 2 - br);
        if (qx > 0 && qy > 0) inBg = Math.hypot(qx, qy) <= br;
      }
      if (!inBg) { buf[i + 3] = 0; continue; }

      // subtle warm vignette on the ink field
      const v = Math.min(1, d / (W * 0.72));
      let r = INK[0] + 10 * (1 - v), g = INK[1] + 8 * (1 - v), b = INK[2] + 6 * (1 - v);

      if (d <= R) {
        let ang = (Math.atan2(dy, dx) * 180) / Math.PI - 90; // 0° at top
        const hue = rybToRgbHue(((ang % 360) + 360) % 360);
        const t = d / R;
        let col;
        if (t < 0.55) {
          const mid = hslToRgb(hue, 82, 60);
          const k = t / 0.55;
          col = [lerp(CENTRE[0], mid[0], k), lerp(CENTRE[1], mid[1], k), lerp(CENTRE[2], mid[2], k)];
        } else {
          const mid = hslToRgb(hue, 82, 60), out = hslToRgb(hue, 90, 42);
          const k = (t - 0.55) / 0.45;
          col = [lerp(mid[0], out[0], k), lerp(mid[1], out[1], k), lerp(mid[2], out[2], k)];
        }
        const shade = 1 - 0.18 * Math.max(0, (t - 0.92) / 0.08); // rim darkening
        r = col[0] * shade; g = col[1] * shade; b = col[2] * shade;
      }
      buf[i] = Math.max(0, Math.min(255, Math.round(r)));
      buf[i + 1] = Math.max(0, Math.min(255, Math.round(g)));
      buf[i + 2] = Math.max(0, Math.min(255, Math.round(b)));
      buf[i + 3] = 255;
    }
  }

  // box downsample to target size
  const out = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const j = ((y * SS + sy) * W + (x * SS + sx)) * 4;
          const al = buf[j + 3] / 255;
          r += buf[j] * al; g += buf[j + 1] * al; b += buf[j + 2] * al; a += al;
        }
      }
      const n = SS * SS, o = (y * size + x) * 4;
      out[o] = a ? Math.round(r / a) : 0;
      out[o + 1] = a ? Math.round(g / a) : 0;
      out[o + 2] = a ? Math.round(b / a) : 0;
      out[o + 3] = Math.round((a / n) * 255);
    }
  }
  return encodePNG(size, size, out);
}

const dir = path.join(__dirname, '..', 'icons');
fs.mkdirSync(dir, { recursive: true });

const jobs = [
  ['icon-192.png', 192, { wheelR: 0.40, bgRadius: 0.22 }],
  ['icon-512.png', 512, { wheelR: 0.40, bgRadius: 0.22 }],
  // maskable: keep the mark inside the 40%-radius safe zone, background full-bleed
  ['maskable-192.png', 192, { wheelR: 0.30, bleed: true }],
  ['maskable-512.png', 512, { wheelR: 0.30, bleed: true }],
  ['apple-touch-icon.png', 180, { wheelR: 0.42, bleed: true }],
  ['favicon-32.png', 32, { wheelR: 0.46, bgRadius: 0.20 }],
  ['favicon-64.png', 64, { wheelR: 0.46, bgRadius: 0.20 }],
];
for (const [name, size, opts] of jobs) {
  fs.writeFileSync(path.join(dir, name), drawIcon(size, opts));
  console.log('wrote icons/' + name + '  (' + size + 'px)');
}

/* Browsers request /favicon.ico implicitly regardless of <link rel=icon>.
   A PNG-payload ICO (valid since Vista) avoids a 404 on every cold load. */
function pngToIco(png, size) {
  const dir = Buffer.alloc(6);
  dir.writeUInt16LE(0, 0);            // reserved
  dir.writeUInt16LE(1, 2);            // type: icon
  dir.writeUInt16LE(1, 4);            // one image
  const entry = Buffer.alloc(16);
  entry[0] = size >= 256 ? 0 : size;  // width  (0 means 256)
  entry[1] = size >= 256 ? 0 : size;  // height
  entry[2] = 0;                       // palette size
  entry[3] = 0;                       // reserved
  entry.writeUInt16LE(1, 4);          // colour planes
  entry.writeUInt16LE(32, 6);         // bits per pixel
  entry.writeUInt32LE(png.length, 8);
  entry.writeUInt32LE(22, 12);        // offset = 6 + 16
  return Buffer.concat([dir, entry, png]);
}
const ico = pngToIco(drawIcon(32, { wheelR: 0.46, bgRadius: 0.20 }), 32);
fs.writeFileSync(path.join(__dirname, '..', 'favicon.ico'), ico);
console.log('wrote favicon.ico  (32px)');
