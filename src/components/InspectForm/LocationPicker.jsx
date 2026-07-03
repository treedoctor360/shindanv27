// 位置の微修正: GPS取得後、地図上のピンをドラッグして緯度経度を調整する。
// クリック（タップ）した地点にもピンを移動できる。
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useEffect, useMemo, useRef } from 'react';

// Leaflet の既定マーカー画像はバンドラ経由だとパスがずれるため、
// data URL の簡易ピン（緑の雫）を使う。
const PIN_SVG =
  'data:image/svg+xml;charset=UTF-8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="30" height="42" viewBox="0 0 30 42">' +
      '<path d="M15 0C6.7 0 0 6.7 0 15c0 10.5 15 27 15 27s15-16.5 15-27C30 6.7 23.3 0 15 0z" fill="#2e7d32"/>' +
      '<circle cx="15" cy="15" r="6" fill="#fff"/></svg>'
  );
const pinIcon = L.icon({ iconUrl: PIN_SVG, iconSize: [30, 42], iconAnchor: [15, 42] });

// 地図クリックでピンを移動
function ClickCapture({ onPick }) {
  useMapEvents({
    click(e) {
      onPick(e.latlng.lat, e.latlng.lng);
    }
  });
  return null;
}

// 外から緯度経度が変わったら地図の中心を追従させる（GPS取得時など）
function Recenter({ lat, lng }) {
  const map = useMap();
  useEffect(() => {
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      map.setView([lat, lng], map.getZoom(), { animate: true });
    }
  }, [lat, lng, map]);
  return null;
}

export default function LocationPicker({ lat, lng, onChange }) {
  const hasPoint = Number.isFinite(lat) && Number.isFinite(lng);
  // 既定中心（大津市付近）。座標があればそこを中心に。
  const center = useMemo(() => (hasPoint ? [lat, lng] : [35.0045, 135.8686]), [hasPoint, lat, lng]);
  const markerRef = useRef(null);

  const dragHandlers = useMemo(
    () => ({
      dragend() {
        const m = markerRef.current;
        if (m) {
          const p = m.getLatLng();
          onChange(p.lat, p.lng);
        }
      }
    }),
    [onChange]
  );

  return (
    <div className="location-picker">
      <MapContainer center={center} zoom={hasPoint ? 18 : 15} className="picker-map">
        <TileLayer
          attribution='&copy; OpenStreetMap contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={19}
        />
        <ClickCapture onPick={onChange} />
        {hasPoint && <Recenter lat={lat} lng={lng} />}
        {hasPoint && (
          <Marker
            draggable
            position={[lat, lng]}
            icon={pinIcon}
            ref={markerRef}
            eventHandlers={dragHandlers}
          />
        )}
      </MapContainer>
      <p className="hint">
        {hasPoint
          ? 'ピンをドラッグ、または地図をタップして位置を微修正できます。'
          : '「GPS」で現在地を取得するか、地図をタップして位置を指定してください。'}
      </p>
    </div>
  );
}
