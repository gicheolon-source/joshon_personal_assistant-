/* 앱 아이콘 PNG 생성 (의존성 없음): 보라 배경 + 가운데 Jarvis 오브. node build/icons.cjs */
const fs = require('fs'), zlib = require('zlib');
const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc = buf => { let c = 0xffffffff; for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([len, td, c]); };
const mix = (a, b, t) => Math.round(a + (b - a) * Math.max(0, Math.min(1, t)));

function png(size, file) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  const cx = size / 2, cy = size / 2, R = size * 0.30;
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      const d = Math.hypot(x - cx, y - cy) / R;           // 0 중심 → 1 오브 가장자리
      let r = 0x5B, g = 0x2E, b = 0xE0;                      // 배경 보라 (살짝 그라데이션)
      const t = y / size; r = mix(0x6A, 0x3A, t); g = mix(0x3C, 0x1E, t); b = mix(0xF0, 0xB8, t);
      if (d < 1.28 && d > 1.12) { r = mix(r, 0x9A, 0.55); g = mix(g, 0xE6, 0.55); b = mix(b, 0xFF, 0.55); }   // 링
      if (d <= 1) {
        const stops = [[0, [0xF4, 0xFE, 0xFF]], [0.2, [0x8A, 0xF1, 0xFF]], [0.45, [0x2F, 0xA8, 0xFF]], [0.75, [0x25, 0x49, 0xD8]], [1, [0x14, 0x0F, 0x4A]]];
        let i = 0; while (i < stops.length - 2 && d > stops[i + 1][0]) i++;
        const [a0, c0] = stops[i], [a1, c1] = stops[i + 1], k = (d - a0) / (a1 - a0);
        r = mix(c0[0], c1[0], k); g = mix(c0[1], c1[1], k); b = mix(c0[2], c1[2], k);
      }
      const o = y * (size * 4 + 1) + 1 + x * 4; raw[o] = r; raw[o + 1] = g; raw[o + 2] = b; raw[o + 3] = 255;
    }
  }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 6;
  fs.writeFileSync(file, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]));
}
png(192, 'public/icon-192.png'); png(512, 'public/icon-512.png'); png(180, 'public/apple-touch-icon.png');
console.log('icons ok');
