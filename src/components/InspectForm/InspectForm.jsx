// 点検入力フォーム
// - 判定表示は必ず純粋関数（logic/diagnosis.js）の返り値を映すだけ
// - 機能①: 所見ドラフト挿入
// - 機能②: 精密診断への誘導バナー
// - 機能③: 樹種・腐朽菌の知識サジェスト
// - 補助: 同一 treeNo の経年比較（活力度平均のトレンド）

import { useEffect, useMemo, useState } from 'react';
import { useRecordStore } from '../../store/useRecordStore.js';
import { db } from '../../db/db.js';
import { DECLINE_ITEMS, DECLINE_ITEM_IDS, SCORE_LABELS } from '../../data/declineItems.js';
import { HEALTH_ITEMS } from '../../data/healthItems.js';
import { FUNGUS_OPTIONS, findSpeciesKnowledge, findFungusKnowledge } from '../../data/knowledge.js';
import { evaluateRecord } from '../../logic/diagnosis.js';
import { generateFindings, needsPrecisionDiagnosis } from '../../logic/findings.js';
import PhotoInput from './PhotoInput.jsx';
import ButtonGroup from './ButtonGroup.jsx';
import LocationPicker from './LocationPicker.jsx';
import InferencePanel from '../InferencePanel/InferencePanel.jsx';

// v26 実データの表記（「晴れ」）に合わせる
const WEATHER_OPTIONS = ['晴れ', '曇り', '雨', '雪'];
// 活力度 評点ボタンの色トーン（0=良 → 4=悪）
const SCORE_TONES = ['g0', 'g1', 'g2', 'g3', 'g4'];
// 健全度 グレードの色トーン
const GRADE_TONES = { A: 'g0', B: 'g2', C: 'g3', D: 'g4' };
const MEASURE_OPTIONS = [
  '経過観察',
  '枯枝・危険枝の剪定',
  '支柱・ケーブリング',
  '精密診断（機器診断）',
  '土壌改良・根系保護',
  '病虫害防除',
  '伐採の検討'
];

function emptyRecord(defaults = {}, projectId = '') {
  return {
    id: crypto.randomUUID(),
    projectId,
    treeNo: '',
    surveyDate: new Date().toISOString().slice(0, 10),
    weather: '晴れ',
    inspector: defaults.inspector ?? '',
    species: '',
    family: '',
    scientificName: '',
    nickname: '',
    location: '',
    treeHeight: '',
    trunkGirth: '',
    latitude: '',
    longitude: '',
    scores: {},
    health: {},
    fungus: [],
    fungusOther: '',
    comment: '',
    measures: [],
    inference: {},
    _sentToGAS: false,
    _sentToGASAt: null
  };
}

export default function InspectForm({ onSaved }) {
  const { records, editingId, setEditingId, saveRecord, settings, projects, activeProjectId } =
    useRecordStore();
  const [record, setRecord] = useState(() => emptyRecord(settings, activeProjectId));
  const [images, setImages] = useState([]);
  const [saving, setSaving] = useState(false);

  // 編集対象の読込（editingId が変わったら本体＋写真を Dexie から取得）。
  // 新規への切り替え（リセット）は effect でやると反映が遅れて直後の入力を
  // 消してしまうため、ここでは扱わず resetToNew() でその場で行う。
  useEffect(() => {
    if (!editingId) return undefined;
    let cancelled = false;
    (async () => {
      const target = await db.records.get(editingId);
      const photoRow = await db.photos.get(editingId);
      if (!cancelled && target) {
        setRecord({ ...emptyRecord(settings), ...target });
        setImages(photoRow?.images ?? []);
      }
    })();
    return () => {
      cancelled = true;
    };
    // settings は初期値の inspector にだけ使うので依存に含めない
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingId]);

  // 新規入力に切り替える（フォームを即時リセット・現在の案件を引き継ぐ）
  const resetToNew = () => {
    setEditingId(null);
    setRecord(emptyRecord(settings, activeProjectId));
    setImages([]);
  };

  // ---- 判定（常に純粋関数の結果を表示するだけ） ----
  const { avg, worst, overall } = useMemo(
    () => evaluateRecord(record, DECLINE_ITEM_IDS),
    [record]
  );
  const precisionWarning = useMemo(() => needsPrecisionDiagnosis(record), [record]);

  // ---- 機能③: 知識サジェスト ----
  const speciesInfo = useMemo(() => findSpeciesKnowledge(record.species), [record.species]);
  const fungusInfos = useMemo(
    () => (record.fungus ?? []).map(findFungusKnowledge).filter(Boolean),
    [record.fungus]
  );

  // ---- 補助: 同一 treeNo の経年比較 ----
  const history = useMemo(() => {
    if (!record.treeNo) return [];
    return records
      .filter((r) => r.treeNo === record.treeNo && r.id !== record.id && r.avg != null)
      .sort((a, b) => (a.surveyDate ?? '').localeCompare(b.surveyDate ?? ''));
  }, [records, record.treeNo, record.id]);
  const worsening =
    history.length > 0 && avg != null && avg > history[history.length - 1].avg + 0.001;

  const set = (key, value) => setRecord((prev) => ({ ...prev, [key]: value }));
  const setScore = (id, value) =>
    setRecord((prev) => ({ ...prev, scores: { ...prev.scores, [id]: value === '' ? '' : Number(value) } }));
  const setHealth = (id, value) =>
    setRecord((prev) => ({ ...prev, health: { ...prev.health, [id]: value } }));
  const toggleInList = (key, value) =>
    setRecord((prev) => {
      const list = prev[key] ?? [];
      return {
        ...prev,
        [key]: list.includes(value) ? list.filter((v) => v !== value) : [...list, value]
      };
    });

  // 地図のピン操作から緯度経度を更新
  const setLatLng = (lat, lng) =>
    setRecord((prev) => ({ ...prev, latitude: lat.toFixed(6), longitude: lng.toFixed(6) }));

  // GPS取得（現在地を緯度経度欄へ）
  const takeGPS = () => {
    if (!navigator.geolocation) {
      alert('この端末では位置情報を取得できません');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setRecord((prev) => ({
          ...prev,
          latitude: pos.coords.latitude.toFixed(6),
          longitude: pos.coords.longitude.toFixed(6)
        }));
      },
      (err) => alert(`位置情報の取得に失敗しました: ${err.message}`),
      { enableHighAccuracy: true, timeout: 15000 }
    );
  };

  // 機能①: 所見ドラフト挿入
  const insertFindingsDraft = () => {
    const { text } = generateFindings(record, DECLINE_ITEM_IDS);
    set('comment', record.comment ? `${record.comment}\n${text}` : text);
  };

  // 保存: 判定値を純粋関数で確定してから Dexie へ
  const handleSave = async () => {
    if (!record.treeNo) {
      alert('樹木番号を入力してください');
      return;
    }
    setSaving(true);
    try {
      const evaluated = evaluateRecord(record, DECLINE_ITEM_IDS);
      const toSave = {
        ...record,
        avg: evaluated.avg,
        worstHealth: evaluated.worst,
        overall: evaluated.overall ? evaluated.overall.grade : null,
        overallText: evaluated.overall ? evaluated.overall.gradeText : null
      };
      await saveRecord(toSave, images);
      resetToNew();
      onSaved?.();
    } finally {
      setSaving(false);
    }
  };

  const activeProject = projects.find((p) => p.id === record.projectId);

  return (
    <div className="inspect-form">
      {/* ---- 案件（プロジェクト） ---- */}
      <div className="project-bar">
        <span className="project-bar-label">案件</span>
        <ButtonGroup
          options={[
            { value: '', label: '未設定' },
            ...projects.map((p) => ({ value: p.id, label: p.name }))
          ]}
          value={record.projectId ?? ''}
          onChange={(v) => set('projectId', v || '')}
        />
        <span className="hint">
          {activeProject ? `この記録は「${activeProject.name}」に登録されます` : '案件の登録は「設定」タブから'}
        </span>
      </div>

      {/* ---- 判定サマリー（常時表示） ---- */}
      <div className={`judge-summary grade-${overall?.grade ?? 'none'}`}>
        <div className="judge-main">
          総合判定: <strong>{overall ? `${overall.grade} ${overall.gradeText}` : '未入力'}</strong>
        </div>
        <div className="judge-sub">
          活力度平均 {avg != null ? avg.toFixed(2) : '—'}
          {overall?.declineLevel ? `（衰退度${overall.declineLevel}）` : ''} ／ 健全度最悪{' '}
          {worst ?? '—'}
        </div>
      </div>

      {/* ---- 機能②: 精密診断への誘導 ---- */}
      {precisionWarning && (
        <div className="banner banner-warning">
          ⚠️ 外観所見あり（子実体・開口空洞・腐朽部露出等）。腐朽は外観に現れなくても内部で
          進行している場合が多いため、機器診断（打音／貫入抵抗／レジストグラフ等）の要否を
          検討してください。
        </div>
      )}

      {/* ---- 悪化傾向の検知（経年比較） ---- */}
      {worsening && (
        <div className="banner banner-warning">
          📉 前回調査（{history[history.length - 1].surveyDate}: 平均{' '}
          {history[history.length - 1].avg.toFixed(2)}）より活力度が悪化しています。
        </div>
      )}

      {/* ---- 基本情報 ---- */}
      <fieldset>
        <legend>基本情報</legend>
        <div className="grid2">
          <label className="field">
            <span>樹木番号 *</span>
            <input value={record.treeNo} onChange={(e) => set('treeNo', e.target.value)} />
          </label>
          <label className="field">
            <span>調査日</span>
            <input
              type="date"
              value={record.surveyDate}
              onChange={(e) => set('surveyDate', e.target.value)}
            />
          </label>
          <div className="field">
            <span>天候</span>
            <ButtonGroup
              options={WEATHER_OPTIONS.map((w) => ({ value: w, label: w }))}
              value={record.weather}
              onChange={(v) => set('weather', v)}
            />
          </div>
          <label className="field">
            <span>調査者</span>
            <input value={record.inspector} onChange={(e) => set('inspector', e.target.value)} />
          </label>
          <label className="field">
            <span>樹種</span>
            <input value={record.species} onChange={(e) => set('species', e.target.value)} />
          </label>
          <label className="field">
            <span>科名</span>
            <input value={record.family} onChange={(e) => set('family', e.target.value)} />
          </label>
          <label className="field">
            <span>学名</span>
            <input
              value={record.scientificName}
              onChange={(e) => set('scientificName', e.target.value)}
            />
          </label>
          <label className="field">
            <span>愛称</span>
            <input value={record.nickname} onChange={(e) => set('nickname', e.target.value)} />
          </label>
          <label className="field">
            <span>場所</span>
            <input value={record.location} onChange={(e) => set('location', e.target.value)} />
          </label>
          <label className="field">
            <span>樹高 (m)</span>
            <input
              type="number"
              step="0.1"
              value={record.treeHeight}
              onChange={(e) => set('treeHeight', e.target.value)}
            />
          </label>
          <label className="field">
            <span>幹周 (cm)</span>
            <input
              type="number"
              step="1"
              value={record.trunkGirth}
              onChange={(e) => set('trunkGirth', e.target.value)}
            />
          </label>
          <div className="field field-wide">
            <span>位置（緯度・経度）</span>
            <div className="gps-row">
              <input
                placeholder="緯度"
                value={record.latitude}
                onChange={(e) => set('latitude', e.target.value)}
              />
              <input
                placeholder="経度"
                value={record.longitude}
                onChange={(e) => set('longitude', e.target.value)}
              />
              <button type="button" onClick={takeGPS}>
                📍 GPS
              </button>
            </div>
            <LocationPicker
              lat={Number(record.latitude)}
              lng={Number(record.longitude)}
              onChange={setLatLng}
            />
          </div>
        </div>

        {/* 機能③: 樹種サジェスト */}
        {speciesInfo && (
          <div className="banner banner-info">
            <strong>{speciesInfo.species}</strong>（{speciesInfo.family}） 頻出病虫害:{' '}
            {speciesInfo.pests.join('、')}。{speciesInfo.notes}
            <div className="source">
              出典: {speciesInfo.source}
              {!speciesInfo.verified && '（出典確認中）'}
            </div>
          </div>
        )}
      </fieldset>

      {/* ---- 活力度 17項目（ボタン入力） ---- */}
      <fieldset>
        <legend>活力度（衰退度）評価 — 0〜4</legend>
        <div className="item-list">
          {DECLINE_ITEMS.map((item) => (
            <div key={item.id} className="item-row-btn">
              <div className="item-head">
                <em className="group-tag">{item.group}</em> {item.label}
              </div>
              <ButtonGroup
                columns={5}
                options={(item.desc ?? SCORE_LABELS.map((s) => s.label)).map((d, i) => ({
                  value: i,
                  label: String(i),
                  hint: d,
                  tone: SCORE_TONES[i]
                }))}
                value={record.scores[item.id] ?? ''}
                onChange={(v) => setScore(item.id, v)}
              />
            </div>
          ))}
        </div>
      </fieldset>

      {/* ---- 健全度 14項目（ボタン入力） ---- */}
      <fieldset>
        <legend>健全度（外観診断）評価 — A〜D</legend>
        <div className="item-list">
          {HEALTH_ITEMS.map((item) => (
            <div key={item.id} className="item-row-btn">
              <div className="item-head">
                <em className="group-tag">{item.group}</em> {item.label}
                {item.precision && <em className="precision-tag" title="精密診断誘導の対象">⚑</em>}
              </div>
              <ButtonGroup
                columns={item.grades.length}
                options={item.grades.map((g) => ({
                  value: g.value,
                  label: g.value,
                  hint: g.label,
                  tone: GRADE_TONES[g.value]
                }))}
                value={record.health[item.id] ?? ''}
                onChange={(v) => setHealth(item.id, v)}
              />
            </div>
          ))}
        </div>
      </fieldset>

      {/* ---- 腐朽菌 ---- */}
      <fieldset>
        <legend>腐朽菌（子実体の確認）</legend>
        <div className="check-row">
          {FUNGUS_OPTIONS.map((name) => (
            <label key={name} className="check">
              <input
                type="checkbox"
                checked={(record.fungus ?? []).includes(name)}
                onChange={() => toggleInList('fungus', name)}
              />
              {name}
            </label>
          ))}
        </div>
        <label className="field">
          <span>その他（種名）</span>
          <input
            value={record.fungusOther}
            onChange={(e) => set('fungusOther', e.target.value)}
          />
        </label>
        {/* 機能③: 腐朽菌サジェスト */}
        {fungusInfos.map((info) => (
          <div key={info.name} className="banner banner-info">
            <strong>{info.name}</strong>（{info.decayType} / 主な部位: {info.decayPart}）{' '}
            {info.riskNote}
            <div className="source">
              出典: {info.source}
              {!info.verified && '（出典確認中）'}
            </div>
          </div>
        ))}
      </fieldset>

      {/* ---- 写真 ---- */}
      <fieldset>
        <legend>写真（通常＋位置写真）</legend>
        <PhotoInput images={images} onChange={setImages} />
      </fieldset>

      {/* ---- 推論入力 ---- */}
      <fieldset>
        <legend>推論入力</legend>
        <InferencePanel
          inference={record.inference}
          onChange={(inference) => set('inference', inference)}
        />
      </fieldset>

      {/* ---- 所見・対策 ---- */}
      <fieldset>
        <legend>所見・対策</legend>
        <div className="field">
          <span>所見</span>
          <textarea
            rows={5}
            value={record.comment}
            onChange={(e) => set('comment', e.target.value)}
          />
          <button type="button" onClick={insertFindingsDraft}>
            ✍️ 判定根拠からドラフト挿入（機能①）
          </button>
        </div>
        <div className="check-row">
          {MEASURE_OPTIONS.map((m) => (
            <label key={m} className="check">
              <input
                type="checkbox"
                checked={(record.measures ?? []).includes(m)}
                onChange={() => toggleInList('measures', m)}
              />
              {m}
            </label>
          ))}
        </div>
      </fieldset>

      {/* ---- 経年比較 ---- */}
      {history.length > 0 && (
        <fieldset>
          <legend>経年比較（樹木番号 {record.treeNo}）</legend>
          <table className="trend-table">
            <thead>
              <tr>
                <th>調査日</th>
                <th>活力度平均</th>
                <th>総合</th>
              </tr>
            </thead>
            <tbody>
              {history.map((h) => (
                <tr key={h.id}>
                  <td>{h.surveyDate}</td>
                  <td>{h.avg != null ? h.avg.toFixed(2) : '—'}</td>
                  <td>{h.overall ?? '—'}</td>
                </tr>
              ))}
              <tr className="current">
                <td>{record.surveyDate}（今回）</td>
                <td>{avg != null ? avg.toFixed(2) : '—'}</td>
                <td>{overall?.grade ?? '—'}</td>
              </tr>
            </tbody>
          </table>
        </fieldset>
      )}

      <div className="form-actions">
        <button type="button" className="primary" onClick={handleSave} disabled={saving}>
          {saving ? '保存中…' : editingId ? '💾 上書き保存' : '💾 保存'}
        </button>
        {editingId && (
          <button type="button" onClick={resetToNew}>
            新規入力に戻る
          </button>
        )}
      </div>
    </div>
  );
}
