// 写真ZIP出力 — v26.8 の runPhotoZipExport を移植
// jszip は大きいので動的import（使う瞬間に読み込む）。
// ファイル名は v26 と同じ「<樹木No>_<連番>.<拡張子>」。
// folderSplit=true で樹木ごとのフォルダに分ける。

import { db } from '../../db/db.js';
import { dlBlob } from '../download.js';

/**
 * 指定した records の写真をZIPにまとめてダウンロードさせる。
 * @param {Object[]} records - 対象record（写真の無いものは自動で除外）
 * @param {{folderSplit?: boolean, onProgress?: (done:number, total:number)=>void}} [opts]
 * @returns {{records: number, photos: number}} 出力件数
 */
export async function exportPhotoZip(records, opts = {}) {
  const { folderSplit = true, onProgress } = opts;

  // 写真を持つrecordだけを対象にする
  const rows = await db.photos.bulkGet(records.map((r) => r.id));
  const targets = [];
  records.forEach((r, i) => {
    const images = rows[i]?.images ?? [];
    if (images.length > 0) targets.push({ r, images });
  });
  if (targets.length === 0) return { records: 0, photos: 0 };

  const { default: JSZip } = await import('jszip');
  const zip = new JSZip();
  const total = targets.reduce((s, t) => s + t.images.length, 0);
  let done = 0;

  for (const { r, images } of targets) {
    // ファイル名に使えない文字を除去
    const no = String(r.treeNo || r.id).replace(/[\\/:*?"<>|]/g, '_');
    const folder = folderSplit ? zip.folder(no) : zip;
    for (let i = 0; i < images.length; i++) {
      const m = String(images[i]).match(/^data:image\/(jpeg|png|webp);base64,(.+)$/);
      if (!m) continue;
      const ext = m[1] === 'jpeg' ? 'jpg' : m[1];
      folder.file(`${no}_${String(i + 1).padStart(2, '0')}.${ext}`, m[2], { base64: true });
      done += 1;
      onProgress?.(done, total);
      // UIを固めないよう1枚ごとに処理を譲る（v26と同じ）
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }

  const blob = await zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 }
  });
  dlBlob(blob, `樹木写真_${new Date().toISOString().slice(0, 10)}.zip`);
  return { records: targets.length, photos: done };
}
