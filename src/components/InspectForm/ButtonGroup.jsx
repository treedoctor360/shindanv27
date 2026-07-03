// 汎用ボタン選択（プルダウンの置き換え）
// 現場で素早くタップ入力するため、選択肢をボタンで並べる。
// もう一度同じボタンを押すと選択解除（未評価に戻る）。

export default function ButtonGroup({ options, value, onChange, columns }) {
  // options: [{ value, label, hint?, tone? }]  tone は色分け（活力度の評点など）
  return (
    <div
      className="btn-group"
      style={columns ? { gridTemplateColumns: `repeat(${columns}, 1fr)` } : undefined}
    >
      {options.map((opt) => {
        const selected = String(value) === String(opt.value);
        const cls = ['btn-choice'];
        if (selected) cls.push('selected');
        if (opt.tone) cls.push(`tone-${opt.tone}`);
        return (
          <button
            key={String(opt.value)}
            type="button"
            className={cls.join(' ')}
            aria-pressed={selected}
            onClick={() => onChange(selected ? '' : opt.value)}
          >
            <span className="btn-choice-label">{opt.label}</span>
            {opt.hint && <span className="btn-choice-hint">{opt.hint}</span>}
          </button>
        );
      })}
    </div>
  );
}
