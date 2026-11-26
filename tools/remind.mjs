// 每天晚上由 GitHub Actions 執行：明天是紀念日、生日或七夕的話，推播給兩個人的所有裝置。
// 暗號從 GitHub Secret「ROOM_CODE」讀取，絕對不能寫進這個檔案或印到紀錄裡。
// 規則要跟 app.js 的 specialOf() 一樣；LOVE_START、MILE_DAYS 直接從 app.js 讀，避免兩邊不同步。
import fs from "node:fs";
import * as wp from "web-push";
const webpush = wp.default || wp;

const ROOM = process.env.ROOM_CODE || "";
if (ROOM.length < 8) {
  console.log("沒有設定 ROOM_CODE（或長度不到 8），略過。");
  process.exit(0);
}

const app = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const API_KEY = html.match(/apiKey:\s*"([^"]+)"/)[1];
const PROJECT = html.match(/projectId:\s*"([^"]+)"/)[1];
const ls = app.match(/const LOVE_START = new Date\((\d+),\s*(\d+),\s*(\d+)\)/);
const LOVE_START = new Date(Date.UTC(+ls[1], +ls[2], +ls[3]));
const MILE_DAYS = JSON.parse(app.match(/const MILE_DAYS = (\[[^\]]+\])/)[1]);
const NAMES = JSON.parse(app.match(/\bNAMES = (\[[^\]]+\])/)[1]);

const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents/rooms/${encodeURIComponent(ROOM)}/done`;

// Firestore REST 的欄位格式轉成一般物件
function plain(v) {
  if (!v) return undefined;
  if ("stringValue" in v) return v.stringValue;
  if ("integerValue" in v) return Number(v.integerValue);
  if ("doubleValue" in v) return v.doubleValue;
  if ("booleanValue" in v) return v.booleanValue;
  if ("nullValue" in v) return null;
  if ("mapValue" in v) return fields(v.mapValue.fields || {});
  if ("arrayValue" in v) return (v.arrayValue.values || []).map(plain);
  return undefined;
}
function fields(f) {
  return Object.fromEntries(Object.entries(f || {}).map(([k, v]) => [k, plain(v)]));
}

async function loadDone() {
  const out = {};
  let token = "";
  do {
    const res = await fetch(`${BASE}?pageSize=300&key=${API_KEY}${token ? "&pageToken=" + token : ""}`);
    if (!res.ok) throw new Error("讀取資料失敗：HTTP " + res.status);
    const j = await res.json();
    for (const d of j.documents || []) out[decodeURIComponent(d.name.split("/").pop())] = fields(d.fields);
    token = j.nextPageToken || "";
  } while (token);
  return out;
}

// 台灣時間的「明天」
function tomorrowTW() {
  const now = new Date(Date.now() + 8 * 3600e3);
  const t = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  return t;
}
const keyOf = (d) => d.toISOString().slice(0, 10);

const LUNAR = new Intl.DateTimeFormat("zh-TW-u-ca-chinese", { month: "numeric", day: "numeric", timeZone: "UTC" });
function isQixi(dt) {
  const p = LUNAR.formatToParts(dt);
  return p.find((x) => x.type === "month")?.value === "7" && p.find((x) => x.type === "day")?.value === "7";
}

function specialOf(dt, birthdays) {
  const n = Math.round((dt - LOVE_START) / 864e5) + 1;
  if (n < 1) return null;
  const sameDay = dt.getUTCDate() === LOVE_START.getUTCDate();
  if (n > 1 && sameDay && dt.getUTCMonth() === LOVE_START.getUTCMonth()) {
    return { emo: "🎉", text: `${dt.getUTCFullYear() - LOVE_START.getUTCFullYear()} 週年` };
  }
  if (MILE_DAYS.includes(n) || (n >= 100 && n % 100 === 0)) return { emo: "🎊", text: `在一起第 ${n} 天` };
  const bd = NAMES.filter((who) => {
    const b = birthdays[who];
    return b && b.m === dt.getUTCMonth() + 1 && b.d === dt.getUTCDate();
  });
  if (bd.length) return { emo: "🎂", text: bd.join("、") + "的生日" };
  if (isQixi(dt)) return { emo: "🎋", text: "七夕情人節" };
  if (n > 1 && sameDay) {
    const months =
      (dt.getUTCFullYear() - LOVE_START.getUTCFullYear()) * 12 + dt.getUTCMonth() - LOVE_START.getUTCMonth();
    return { emo: "💝", text: `在一起滿 ${months} 個月` };
  }
  return null;
}

// 照片空間：每月 1 號（台灣時間）算一次原圖用了多少，超過 WARN_MB 就推播。
// 要讀完所有原圖（最多約 1 GB），所以一個月只做一次，免費額度（每月 10 GB 流量）用不完。
const WARN_MB = Number(app.match(/const WARN_MB = (\d+)/)[1]);
async function picsMB() {
  const base = BASE.replace(/\/done$/, "/pics");
  let total = 0,
    count = 0,
    token = "";
  do {
    const res = await fetch(
      `${base}?pageSize=30&mask.fieldPaths=img&key=${API_KEY}${token ? "&pageToken=" + token : ""}`,
    );
    if (!res.ok) throw new Error("讀取照片失敗：HTTP " + res.status);
    const j = await res.json();
    for (const d of j.documents || []) {
      total += (d.fields?.img?.stringValue || "").length;
      count++;
    }
    token = j.nextPageToken || "";
  } while (token);
  return { mb: Math.round(total / 1048576), count };
}

async function pushAll(cfg, subs, payload) {
  webpush.setVapidDetails("mailto:love-base@users.noreply.github.com", cfg.pub, cfg.d);
  let sent = 0;
  for (const s of subs) {
    try {
      await webpush.sendNotification({ endpoint: s.ep, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, {
        TTL: 12 * 3600,
      });
      sent++;
    } catch (e) {
      console.log(
        `有一台裝置沒送到（${s.by || "?"} 的 ${s.dev || "裝置"}，HTTP ${e.statusCode || "?"}）`,
        process.env.DEBUG ? e.message : "",
      );
    }
  }
  return sent;
}

async function markSent(id, date) {
  const now = new Date().toISOString();
  const body = { fields: { date: { stringValue: date }, by: { stringValue: "自動提醒" }, at: { stringValue: now } } };
  const res = await fetch(`${BASE}/${encodeURIComponent(id)}?key=${API_KEY}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) console.log("記錄「已發過」失敗：HTTP " + res.status);
}

const done = await loadDone();
const birthdays = {};
for (const [id, v] of Object.entries(done)) if (id.startsWith("x~birthdays~")) birthdays[id.split("~")[2]] = v;

const cfg = done["x~push~cfg"];
const subs = Object.entries(done)
  .filter(([id, v]) => id.startsWith("x~push~") && id !== "x~push~cfg" && v.ep && v.p256dh && v.auth)
  .map(([, v]) => v);
const canPush = !!(cfg && cfg.pub && cfg.d && subs.length);

const todayTW = new Date(Date.now() + 8 * 3600e3);
const todayKey = todayTW.toISOString().slice(0, 10);
const monthKey = todayTW.toISOString().slice(0, 7);
if (todayTW.getUTCDate() === 1 || process.env.FORCE_SPACE) {
  try {
    const { mb, count } = await picsMB();
    console.log(`照片空間：${count} 張，約 ${mb} MB / 1024 MB（提醒門檻 ${WARN_MB} MB）。`);
    const sid = "x~remind~space-" + monthKey;
    if (mb >= WARN_MB && canPush && !done[sid]) {
      const left = Math.max(0, 1024 - mb);
      const sent = await pushAll(
        cfg,
        subs,
        JSON.stringify({
          title: `📦 照片空間用了 ${mb} MB`,
          body: `免費空間 1024 MB 只剩約 ${left} MB，記得先做完整備份，再決定要不要升級或搬照片`,
          url: "./#picBox",
          tag: "space-" + monthKey,
        }),
      );
      console.log(`照片空間提醒送出 ${sent} / ${subs.length} 台。`);
      if (sent) await markSent(sid, monthKey);
    }
  } catch (e) {
    console.log("照片空間檢查失敗：" + e.message);
  }
}

// 時光膠囊到期提醒：已到打開日期、未刪除且還沒發過推播的膠囊
const dueCaps = Object.entries(done)
  .filter(([id, v]) => id.startsWith("x~capsules~") && !v.trashed && v.openDate && v.openDate <= todayKey)
  .map(([id, v]) => ({ id: id.split("~")[2], ...v }))
  .filter((c) => !done["x~remind~cap-" + c.id]);
if (dueCaps.length && canPush) {
  const sent = await pushAll(
    cfg,
    subs,
    JSON.stringify({
      title: "💌 時光膠囊到時間打開了！",
      body: `有 ${dueCaps.length} 顆時光膠囊已經可以打開囉，快來看看當時寫了什麼`,
      url: "./#capsule",
      tag: "cap-" + todayKey,
    }),
  );
  console.log(`時光膠囊到期提醒（${dueCaps.length} 顆），推播送出 ${sent} / ${subs.length} 台。`);
  if (sent) {
    for (const c of dueCaps) await markSent("x~remind~cap-" + c.id, c.openDate);
  }
}

const tmr = tomorrowTW(),
  tk = keyOf(tmr),
  sp = specialOf(tmr, birthdays);

// 願望約定日期：明天有約好、還沒完成的願望就推播（id 跟網站共用 x~remind~plan-日期，不會重複發）
const plans = Object.entries(done)
  .filter(([id, v]) => id.startsWith("x~wishes~") && !v.trashed && !v.done && v.plan === tk)
  .map(([, v]) => String(v.text || "").slice(0, 20));
if (plans.length && canPush && !done["x~remind~plan-" + tk]) {
  const sent = await pushAll(
    cfg,
    subs,
    JSON.stringify({
      title: "📅 明天約好了！",
      body: `明天（${tmr.getUTCMonth() + 1}/${tmr.getUTCDate()}）約好要${plans.map((t) => `「${t}」`).join("、")}`,
      url: "./#wishes",
      tag: "plan-" + tk,
    }),
  );
  console.log(`明天（${tk}）有 ${plans.length} 個約好的願望，推播送出 ${sent} / ${subs.length} 台。`);
  if (sent) await markSent("x~remind~plan-" + tk, tk);
}

if (!sp) {
  console.log(`明天（${tk}）不是特別的日子。`);
  process.exit(0);
}
if (done["x~remind~" + tk]) {
  console.log(`明天（${tk}）的提醒已經發過了。`);
  process.exit(0);
}
if (!canPush) {
  console.log("還沒有裝置開啟推播，略過。");
  process.exit(0);
}

const m = tmr.getUTCMonth() + 1,
  d = tmr.getUTCDate();
const sent = await pushAll(
  cfg,
  subs,
  JSON.stringify({
    title: `${sp.emo} 明天是${sp.text}`,
    body: `${sp.emo} 明天（${m}/${d}）是${sp.text}，記得準備一下喔`,
    url: "./#calendar",
    tag: "remind-" + tk,
  }),
);
console.log(`明天（${tk}）是${sp.text}，推播送出 ${sent} / ${subs.length} 台。`);
if (sent) await markSent("x~remind~" + tk, tk);
