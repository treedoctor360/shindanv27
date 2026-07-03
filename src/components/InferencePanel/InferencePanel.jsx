// 推論入力タブ（record.inference に保存）
// 「観察した事実」と「推定」を分けて書く訓練を兼ねた入力欄。
// 成り立ての樹木医が思考の筋道を残せるようにする。

const FIELDS = [
  {
    key: 'fact',
    label: '観察した事実',
    placeholder: '例: 南側の大枝基部に開口空洞（幅約15cm）。周囲にカミキリムシの脱出孔多数。'
  },
  {
    key: 'hypothesis',
    label: '推定される原因',
    placeholder: '例: 過去の剪定痕からの腐朽進行と推定。'
  },
  {
    key: 'verification',
    label: '検証の方法',
    placeholder: '例: 打音検査で空洞範囲を確認。必要に応じ貫入抵抗測定。'
  },
  {
    key: 'nextAction',
    label: '次の一手',
    placeholder: '例: 空洞範囲確定後に大枝の切除可否を判断。それまで立入制限を要請。'
  }
];

export default function InferencePanel({ inference, onChange }) {
  const value = inference ?? {};
  return (
    <div className="inference-panel">
      <p className="hint">
        事実と推定を分けて記録します。検索可能な事実は公的資料で裏取りしてから記載してください。
      </p>
      {FIELDS.map((f) => (
        <label key={f.key} className="field">
          <span>{f.label}</span>
          <textarea
            rows={2}
            value={value[f.key] ?? ''}
            placeholder={f.placeholder}
            onChange={(e) => onChange({ ...value, [f.key]: e.target.value })}
          />
        </label>
      ))}
    </div>
  );
}
