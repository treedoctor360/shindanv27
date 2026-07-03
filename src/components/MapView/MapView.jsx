// 地図表示（React-Leaflet）: 位置情報のある記録をマーカー表示
// マーカー色は総合判定（A=緑, B=黄緑, C=橙, D=赤）
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { useMemo } from 'react';
import { useRecordStore } from '../../store/useRecordStore.js';

const GRADE_COLORS = {
  A: '#2e7d32',
  B: '#9acd32',
  C: '#ef6c00',
  D: '#c62828'
};

// 初期表示の既定中心（大津市役所付近）。記録があれば記録の重心を使う。
const DEFAULT_CENTER = [35.0045, 135.8686];

export default function MapView({ onEdit }) {
  const { records, setEditingId } = useRecordStore();

  const points = useMemo(
    () =>
      records
        .map((r) => ({ ...r, lat: Number(r.latitude), lng: Number(r.longitude) }))
        .filter((r) => Number.isFinite(r.lat) && Number.isFinite(r.lng) && (r.lat !== 0 || r.lng !== 0)),
    [records]
  );

  const center = useMemo(() => {
    if (points.length === 0) return DEFAULT_CENTER;
    const lat = points.reduce((s, p) => s + p.lat, 0) / points.length;
    const lng = points.reduce((s, p) => s + p.lng, 0) / points.length;
    return [lat, lng];
  }, [points]);

  return (
    <div className="map-view">
      <p className="hint">位置情報あり: {points.length} / {records.length} 件（地図表示はオンライン時のみ）</p>
      <MapContainer center={center} zoom={15} className="map-container">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {points.map((p) => (
          <CircleMarker
            key={p.id}
            center={[p.lat, p.lng]}
            radius={9}
            pathOptions={{
              color: GRADE_COLORS[p.overall] ?? '#607d8b',
              fillColor: GRADE_COLORS[p.overall] ?? '#607d8b',
              fillOpacity: 0.75
            }}
          >
            <Popup>
              <strong>
                {p.treeNo} {p.species || ''}
              </strong>
              <br />
              判定: {p.overall ?? '—'}（{p.surveyDate}）
              <br />
              <button
                type="button"
                onClick={() => {
                  setEditingId(p.id);
                  onEdit?.();
                }}
              >
                この記録を開く
              </button>
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>
      <div className="map-legend">
        {Object.entries(GRADE_COLORS).map(([g, c]) => (
          <span key={g} className="legend-item">
            <span className="legend-dot" style={{ background: c }} /> {g}
          </span>
        ))}
      </div>
    </div>
  );
}
