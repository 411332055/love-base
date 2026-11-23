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

const done = await loadDone();
const birthdays = {};
for (const [id, v] of Object.entries(done)) if (id.startsWith("x~birthdays~")) birthdays[id.split("~")[2]] = v;

const tmr = tomorrowTW(),
  tk = keyOf(tmr),
  sp = specialOf(tmr, birthdays);
if (!sp) {
  console.log(`明天（${tk}）不是特別的日子。`);
  process.exit(0);
}
if (done["x~remind~" + tk]) {
  console.log(`明天（${tk}）的提醒已經發過了。`);
  process.exit(0);
}

const cfg = done["x~push~cfg"];
const subs = Object.entries(done)
  .filter(([id, v]) => id.startsWith("x~push~") && id !== "x~push~cfg" && v.ep && v.p256dh && v.auth)
  .map(([, v]) => v);
if (!cfg || !cfg.pub || !cfg.d || !subs.length) {
  console.log("還沒有裝置開啟推播，略過。");
  process.exit(0);
}

webpush.setVapidDetails("mailto:love-base@users.noreply.github.com", cfg.pub, cfg.d);
const m = tmr.getUTCMonth() + 1,
  d = tmr.getUTCDate();
const payload = JSON.stringify({
  title: `${sp.emo} 明天是${sp.text}`,
  body: `${sp.emo} 明天（${m}/${d}）是${sp.text}，記得準備一下喔`,
  url: "./#calendar",
  tag: "remind-" + tk,
});
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
console.log(`明天（${tk}）是${sp.text}，推播送出 ${sent} / ${subs.length} 台。`);

if (sent) {
  const now = new Date().toISOString();
  const body = { fields: { date: { stringValue: tk }, by: { stringValue: "自動提醒" }, at: { stringValue: now } } };
  const res = await fetch(`${BASE}/${encodeURIComponent("x~remind~" + tk)}?key=${API_KEY}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) console.log("記錄「已發過」失敗：HTTP " + res.status);
}
