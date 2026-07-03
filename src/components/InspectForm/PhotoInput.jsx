// 写真入力: ファイル選択 → 縮小圧縮（canvas） → dataURL化
// 通常写真も位置写真も同じ仕組みで photos テーブルに入る（保存の一元化）。

import { useRef } from 'react';

// 長辺の上限と JPEG 品質（設定画面で変えられるようにする場合はここを引数化）
const MAX_EDGE = 1280;
const JPEG_QUALITY = 0.7;

function compressImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('ファイルの読み込みに失敗しました'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('画像の解析に失敗しました'));
      img.onload = () => {
        const scale = Math.min(1, MAX_EDGE / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', JPEG_QUALITY));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

export default function PhotoInput({ images, onChange }) {
  const inputRef = useRef(null);

  const handleFiles = async (e) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    try {
      const compressed = await Promise.all(files.map(compressImage));
      onChange([...images, ...compressed]);
    } catch (err) {
      alert(err.message);
    } finally {
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const removeAt = (index) => {
    onChange(images.filter((_, i) => i !== index));
  };

  return (
    <div className="photo-input">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleFiles}
      />
      <div className="photo-thumbs">
        {images.map((src, i) => (
          <div key={i} className="photo-thumb">
            <img src={src} alt={`写真${i + 1}`} />
            <button type="button" onClick={() => removeAt(i)} aria-label="削除">
              ×
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
