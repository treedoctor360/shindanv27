// 座標入力。現在地(GPS)・手入力・貼り付け（Googleマップのリンク／度分秒）の3経路を用意する。
// 現地では GPS、後日デスクで登録する時は手入力・貼り付け、という運用を想定。
import { useEffect, useState } from 'react';
import {
  parseLatLng,
  isValidLat,
  isValidLng,
  formatCoord,
  formatLatLng,
  mapUrl
} from '../../logic/geo.js';

// 座標をどの経路で入れたか（record.geoSource）の表示名
const SOURCE_LABEL = { gps: '現在地', manual: '手入力', paste: '貼り付け', map: '地図' };

export default function GeoField({ latitude, longitude, geoSource, onChange }) {
  const [latText, setLatText] = useState('');
  const [lngText, setLngText] = useState('');
  const [pasteText, setPasteText] = useState('');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  // 外部（GPS取得・地図のピン操作・記録の読み込み）で値が変わったら入力欄に反映する。
  // 手入力中は latitude が変化しないため、途中の "35." のような文字列が消えることはない。
  useEffect(() => {
    setLatText(latitude == null || latitude === '' ? '' : String(latitude));
  }, [latitude]);
  useEffect(() => {
    setLngText(longitude == null || longitude === '' ? '' : String(longitude));
  }, [longitude]);

  const hasCoord =
    latitude != null && latitude !== '' && longitude != null && longitude !== '';
  const latBad = latText.trim() !== '' && !isValidLat(Number(latText));
  const lngBad = lngText.trim() !== '' && !isValidLng(Number(lngText));

  // 手入力。数値として妥当になった時点だけ record に反映する（入力途中は欄の値のみ更新）。
  const setOne = (key, text, valid) => {
    setErr('');
    setMsg('');
    if (key === 'latitude') setLatText(text);
    else setLngText(text);
    const t = text.trim();
    if (t === '') {
      onChange({ [key]: '' });
      return;
    }
    const n = Number(t);
    if (valid(n)) onChange({ [key]: t, geoSource: 'manual' });
  };

  const clear = () => {
    setLatText('');
    setLngText('');
    setErr('');
    setMsg('');
    onChange({ latitude: '', longitude: '', geoSource: '' });
  };

  const getGeo = () => {
    setErr('');
    setMsg('');
    if (!navigator.geolocation) {
      setErr('この端末では位置情報を取得できません。緯度・経度の手入力や貼り付けで登録してください。');
      return;
    }
    setBusy(true);
    setMsg('取得中…');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        onChange({
          latitude: formatCoord(pos.coords.latitude),
          longitude: formatCoord(pos.coords.longitude),
          geoSource: 'gps'
        });
        setMsg(
          pos.coords.accuracy
            ? `現在地を取得しました（誤差 約${Math.round(pos.coords.accuracy)}m）。`
            : '現在地を取得しました。'
        );
        setBusy(false);
      },
      (e) => {
        setErr(`取得できませんでした（${e.message}）。手入力・貼り付けでも登録できます。`);
        setMsg('');
        setBusy(false);
      },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  };

  // Googleマップのリンクなどを読み取って座標に変換する
  const applyPaste = () => {
    const r = parseLatLng(pasteText);
    if (!r.ok) {
      setErr(r.reason);
      setMsg('');
      return;
    }
    onChange({
      latitude: formatCoord(r.lat),
      longitude: formatCoord(r.lng),
      geoSource: 'paste'
    });
    setPasteText('');
    setErr('');
    setMsg(`読み取りました：${formatLatLng(r.lat, r.lng)}`);
  };

  return (
    <div className="geo-field">
      <div className="gps-row">
        <input
          type="text"
          inputMode="decimal"
          placeholder="緯度 例: 35.011600"
          value={latText}
          aria-label="緯度"
          aria-invalid={latBad || undefined}
          onChange={(e) => setOne('latitude', e.target.value, isValidLat)}
        />
        <input
          type="text"
          inputMode="decimal"
          placeholder="経度 例: 135.768100"
          value={lngText}
          aria-label="経度"
          aria-invalid={lngBad || undefined}
          onChange={(e) => setOne('longitude', e.target.value, isValidLng)}
        />
      </div>

      <div className="geo-row">
        <button type="button" onClick={getGeo} disabled={busy}>
          📍 現在地を入れる
        </button>
        {hasCoord && (
          <button type="button" onClick={clear}>
            クリア
          </button>
        )}
        {hasCoord && !latBad && !lngBad && (
          <a href={mapUrl(latitude, longitude)} target="_blank" rel="noopener noreferrer">
            地図で確認
          </a>
        )}
        <span className="geo-status">
          {hasCoord
            ? `${formatLatLng(latitude, longitude)}${
                geoSource && SOURCE_LABEL[geoSource] ? `（${SOURCE_LABEL[geoSource]}）` : ''
              }`
            : '座標なし'}
        </span>
      </div>

      <div className="geo-row">
        <input
          type="text"
          className="geo-paste"
          value={pasteText}
          placeholder={'Googleマップのリンク / 35.0116, 135.7681 / 35°00\'41.8"N 135°46\'05.2"E'}
          onChange={(e) => {
            setPasteText(e.target.value);
            setErr('');
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              applyPaste();
            }
          }}
        />
        <button type="button" onClick={applyPaste} disabled={!pasteText.trim()}>
          読み取り
        </button>
      </div>

      {(latBad || lngBad) && (
        <p className="geo-err">
          緯度は -90〜90、経度は -180〜180 の範囲で入力してください（緯度と経度が逆になっていませんか）。
        </p>
      )}
      {err && <p className="geo-err">{err}</p>}
      {!err && msg && <p className="hint">{msg}</p>}
      <p className="hint">
        後日の登録でも、現地のGoogleマップのリンクや緯度経度を貼り付ければ座標を残せます。
      </p>
    </div>
  );
}
