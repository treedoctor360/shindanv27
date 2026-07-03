/**
 * 樹木診断・点検システム v27 — GAS(Google Apps Script) 同期スクリプト
 *
 * ■ 役割
 *   スプレッドシート（診断record）と Drive（写真）を「共有マスタ」として、
 *   v27 Webアプリと双方向にデータをやり取りする。
 *   - 案件ごとにシート1枚（シート名 = 案件名。案件未設定は「未分類」）
 *   - 写真は Drive のフォルダ「樹木診断写真/<案件名>/」に保存
 *
 * ■ 導入手順（1回だけ）
 *   1. Google スプレッドシートを新規作成（名前は自由。例: 樹木診断データ）
 *   2. メニュー「拡張機能」→「Apps Script」を開き、このファイルの内容を貼り付けて保存
 *   3. 「デプロイ」→「新しいデプロイ」→ 種類「ウェブアプリ」
 *      - 次のユーザーとして実行: 自分
 *      - アクセスできるユーザー: 全員（匿名を含む）
 *   4. 表示された「ウェブアプリのURL（…/exec）」を v27 の設定タブに貼り付ける
 *   ※ 再デプロイ時は「デプロイを管理」から既存デプロイを「編集」→ バージョンを
 *     「新バージョン」にして更新すると URL が変わらない。
 *
 * ■ API 仕様（v27 側 src/features/gas/gasSync.js と対応）
 *   POST { action:'push', projectName, records:[...], photos:[{recordId, images:[dataURL]}] }
 *     → 該当案件シートへ id で upsert（既存行は更新・なければ追加）、写真を Drive へ保存
 *   GET  ?action=records[&project=案件名]
 *     → 案件シート（省略時は全シート）の record 一覧と案件名一覧
 *   GET  ?action=photos&ids=id1,id2,...
 *     → 指定 record の写真（dataURL の配列）
 *   GET  ?action=projects
 *     → 案件名（シート名）一覧
 */

var PHOTO_ROOT_NAME = '樹木診断写真';   // Drive の写真ルートフォルダ名
var DEFAULT_SHEET = '未分類';           // 案件未設定の record を入れるシート名

// 行の列構成（1行 = record 1件）。人が読みやすい列＋復元用のJSON列。
var HEADERS = [
  'id', '樹木番号', '調査日', '樹種', '場所', '調査者',
  '活力度平均', '健全度最悪', '総合判定', '所見', '更新日時', '_json'
];

// ---------------------------------------------------------------- 入口

function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);
    if (body.action === 'push') return jsonOut_(handlePush_(body));
    return jsonOut_({ ok: false, error: 'unknown action: ' + body.action });
  } catch (err) {
    return jsonOut_({ ok: false, error: String(err) });
  }
}

function doGet(e) {
  try {
    var p = e.parameter || {};
    if (p.action === 'records') return jsonOut_(handleRecords_(p.project || ''));
    if (p.action === 'photos') return jsonOut_(handlePhotos_((p.ids || '').split(',').filter(String)));
    if (p.action === 'projects') return jsonOut_({ ok: true, projects: listProjects_() });
    // 動作確認用（ブラウザでURLを開いたとき）
    return jsonOut_({ ok: true, app: 'tree-shindan-gas', version: 1 });
  } catch (err) {
    return jsonOut_({ ok: false, error: String(err) });
  }
}

// ---------------------------------------------------------------- push（保存）

function handlePush_(body) {
  var projectName = (body.projectName || DEFAULT_SHEET).toString();
  var records = body.records || [];
  var photos = body.photos || [];

  var sheet = getOrCreateSheet_(projectName);
  var idToRow = buildIdIndex_(sheet); // id → 行番号

  records.forEach(function (rec) {
    var row = recordToRow_(rec);
    var rowNo = idToRow[rec.id];
    if (rowNo) {
      sheet.getRange(rowNo, 1, 1, HEADERS.length).setValues([row]);
    } else {
      sheet.appendRow(row);
      idToRow[rec.id] = sheet.getLastRow();
    }
  });

  // 写真: 案件フォルダに <recordId>__<連番>.jpg で保存（既存は入れ替え）
  var photoCount = 0;
  if (photos.length > 0) {
    var folder = getOrCreatePhotoFolder_(projectName);
    photos.forEach(function (p) {
      if (!p || !p.recordId || !p.images) return;
      removePhotosOf_(folder, p.recordId);
      p.images.forEach(function (dataUrl, i) {
        var blob = dataUrlToBlob_(dataUrl, p.recordId + '__' + i + '.jpg');
        if (blob) {
          folder.createFile(blob);
          photoCount++;
        }
      });
    });
  }

  return { ok: true, saved: records.length, photos: photoCount, project: projectName };
}

// ---------------------------------------------------------------- 読み出し

function handleRecords_(projectName) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheets = projectName
    ? [ss.getSheetByName(projectName)].filter(Boolean)
    : ss.getSheets().filter(isDataSheet_);

  var records = [];
  sheets.forEach(function (sheet) {
    var values = sheet.getDataRange().getValues();
    var jsonCol = HEADERS.indexOf('_json');
    for (var r = 1; r < values.length; r++) {
      var raw = values[r][jsonCol];
      if (!raw) continue;
      try {
        var rec = JSON.parse(raw);
        rec._projectName = sheet.getName(); // クライアント側で案件を対応付けるための名前
        records.push(rec);
      } catch (e) { /* 壊れた行は飛ばす */ }
    }
  });
  return { ok: true, records: records, projects: listProjects_() };
}

function handlePhotos_(ids) {
  var root = getOrCreateFolder_(DriveApp.getRootFolder(), PHOTO_ROOT_NAME);
  var photos = [];
  ids.forEach(function (id) {
    var images = [];
    var folders = root.getFolders();
    while (folders.hasNext()) {
      var folder = folders.next();
      // <recordId>__0.jpg, __1.jpg ... を連番順に集める
      var found = [];
      var files = folder.searchFiles("title contains '" + id + "__'");
      while (files.hasNext()) {
        var f = files.next();
        var m = f.getName().match(/__(\d+)\./);
        found.push({ n: m ? Number(m[1]) : 0, file: f });
      }
      found.sort(function (a, b) { return a.n - b.n; });
      found.forEach(function (x) {
        var blob = x.file.getBlob();
        images.push('data:' + blob.getContentType() + ';base64,' +
          Utilities.base64Encode(blob.getBytes()));
      });
      if (images.length > 0) break; // 見つかった案件フォルダで確定
    }
    if (images.length > 0) photos.push({ recordId: id, images: images });
  });
  return { ok: true, photos: photos };
}

function listProjects_() {
  return SpreadsheetApp.getActiveSpreadsheet()
    .getSheets()
    .filter(isDataSheet_)
    .map(function (s) { return s.getName(); });
}

// ---------------------------------------------------------------- 内部ユーティリティ

function isDataSheet_(sheet) {
  // 1行目が本スクリプトのヘッダーであるシートだけをデータ対象にする
  if (sheet.getLastRow() < 1) return false;
  return sheet.getRange(1, 1).getValue() === 'id';
}

function getOrCreateSheet_(name) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);
  if (sheet.getRange(1, 1).getValue() !== 'id') {
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function buildIdIndex_(sheet) {
  var index = {};
  var last = sheet.getLastRow();
  if (last < 2) return index;
  var ids = sheet.getRange(2, 1, last - 1, 1).getValues();
  for (var i = 0; i < ids.length; i++) {
    if (ids[i][0]) index[ids[i][0]] = i + 2;
  }
  return index;
}

function recordToRow_(rec) {
  return [
    rec.id || '',
    rec.treeNo || '',
    rec.surveyDate || '',
    rec.species || '',
    rec.location || '',
    rec.inspector || '',
    rec.avg == null ? '' : rec.avg,
    rec.worstHealth || '',
    rec.overall || '',
    rec.comment || '',
    rec.updatedAt || '',
    JSON.stringify(rec)
  ];
}

function getOrCreateFolder_(parent, name) {
  var it = parent.getFoldersByName(name);
  return it.hasNext() ? it.next() : parent.createFolder(name);
}

function getOrCreatePhotoFolder_(projectName) {
  var root = getOrCreateFolder_(DriveApp.getRootFolder(), PHOTO_ROOT_NAME);
  return getOrCreateFolder_(root, projectName);
}

function removePhotosOf_(folder, recordId) {
  var files = folder.searchFiles("title contains '" + recordId + "__'");
  while (files.hasNext()) files.next().setTrashed(true);
}

function dataUrlToBlob_(dataUrl, name) {
  if (typeof dataUrl !== 'string') return null;
  var m = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!m) return null;
  return Utilities.newBlob(Utilities.base64Decode(m[2]), m[1], name);
}

function jsonOut_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
