// PWAアイコン（pwa-192.png / pwa-512.png）を生成する簡易スクリプト
// 外部ツール不要: RGBA を組み立てて zlib で PNG エンコードする。
// 使い方: node scripts/gen-icons.mjs
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';

function crc32(buf) {
  let c;
  const table = [];
  for (let n = 0; n < 256; n++) {
    c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  let crc = 0xffffffff;
  for (const b of buf) crc = table[(crc ^ b) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function makePng(size) {
  // 図柄: 緑地に樹冠（濃緑の円）＋幹（茶の矩形）
  const bg = [0x2e, 0x7d, 0x32];      // 緑
  const canopy = [0xe8, 0xf5, 0xe9];  // 淡緑（樹冠）
  const trunk = [0x6d, 0x4c, 0x41];   // 茶（幹）
  const cx = size / 2;
  const cy = size * 0.42;
  const r = size * 0.28;
  const raw = Buffer.alloc((size * 4 + 1) * size);
  let p = 0;
  for (let y = 0; y < size; y++) {
    raw[p++] = 0; // フィルタなし
    for (let x = 0; x < size; x++) {
      let [rr, gg, bb] = bg;
      const inCanopy = (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
      const inTrunk =
        Math.abs(x - cx) <= size * 0.045 && y > cy && y < size * 0.82;
      if (inCanopy) [rr, gg, bb] = canopy;
      else if (inTrunk) [rr, gg, bb] = trunk;
      raw[p++] = rr;
      raw[p++] = gg;
      raw[p++] = bb;
      raw[p++] = 255;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;  // ビット深度
  ihdr[9] = 6;  // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

mkdirSync('public', { recursive: true });
writeFileSync('public/pwa-192.png', makePng(192));
writeFileSync('public/pwa-512.png', makePng(512));
console.log('generated public/pwa-192.png, public/pwa-512.png');
