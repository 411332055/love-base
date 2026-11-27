// 每天台灣時間 00:00 由 GitHub Actions 執行（GitHub 排程常會晚幾分鐘到半小時）：
//   今天是紀念日、生日或七夕、今天約好的願望、到期的時光膠囊 → 推播給兩個人；
//   今天輪到誰抽題、還沒抽 → 只推播給輪到的那個人；每月 1 號再檢查一次照片空間。
// 前一天打開網站時，網站自己會先提醒「明天是…」（那則用 x~remind~日期），這裡用另外的 id，兩則都會收到。
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

// 台灣時間的「今天」（排程晚到也沒關係：只要還是同一天，算出來的日期就一樣）
function todayTWDate() {
  const now = new Date(Date.now() + 8 * 3600e3);
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
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

const td = todayTWDate(),
  tk = keyOf(td),
  md = `${td.getUTCMonth() + 1}/${td.getUTCDate()}`,
  sp = specialOf(td, birthdays);

// 願望約定日期：今天有約好、還沒完成的願望（網站前一天提醒「明天」用 plan-日期，這裡用 planday-日期）
const plans = Object.entries(done)
  .filter(([id, v]) => id.startsWith("x~wishes~") && !v.trashed && !v.done && v.plan === tk)
  .map(([, v]) => String(v.text || "").slice(0, 20));
if (plans.length && canPush && !done["x~remind~planday-" + tk]) {
  const sent = await pushAll(
    cfg,
    subs,
    JSON.stringify({
      title: "📅 今天約好了！",
      body: `今天（${md}）約好要${plans.map((t) => `「${t}」`).join("、")}，完成後記得打勾`,
      url: "./#wishes",
      tag: "planday-" + tk,
    }),
  );
  console.log(`今天（${tk}）有 ${plans.length} 個約好的願望，推播送出 ${sent} / ${subs.length} 台。`);
  if (sent) await markSent("x~remind~planday-" + tk, tk);
}

// 抽題：今天輪到的人（跟網站 turnOf() 一樣，寒冰、夏夏隔天輪）還沒抽，就只推播給他
const turn = NAMES[Math.floor(td.getTime() / 864e5) % 2];
const dayOfTW = (iso) => (iso ? new Date(new Date(iso).getTime() + 8 * 3600e3).toISOString().slice(0, 10) : "");
const drawn = Object.entries(done).some(
  ([id, v]) => id.startsWith("x~rounds~") && !v.trashed && (v.day || dayOfTW(v.at)) === tk,
);
const turnSubs = subs.filter((s) => s.by === turn);
if (drawn) console.log(`今天（${tk}）已經抽過題了。`);
else if (done["x~remind~draw-" + tk]) console.log(`今天（${tk}）的抽題提醒已經發過了。`);
else if (!cfg || !turnSubs.length) console.log(`今天輪到${turn}抽題，但他的裝置沒有開推播，略過。`);
else {
  const sent = await pushAll(
    cfg,
    turnSubs,
    JSON.stringify({
      title: "🎲 今天輪到你抽題囉",
      body: "新的一天開始了！抽一題今天的題目，兩個人都答完就會揭曉",
      url: "./#draw",
      tag: "draw-" + tk,
    }),
  );
  console.log(`今天輪到${turn}抽題，推播送出 ${sent} / ${turnSubs.length} 台。`);
  if (sent) await markSent("x~remind~draw-" + tk, tk);
}

// 紀念日、生日、七夕：今天就是那天（網站前一天的「明天是…」用 x~remind~日期，這裡用 day-日期）
if (!sp) console.log(`今天（${tk}）不是特別的日子。`);
else if (done["x~remind~day-" + tk]) console.log(`今天（${tk}）的紀念日推播已經發過了。`);
else if (!canPush) console.log("還沒有裝置開啟推播，略過。");
else {
  const sent = await pushAll(
    cfg,
    subs,
    JSON.stringify({
      title: `${sp.emo} 今天是${sp.text}！`,
      body: `${sp.emo} 今天（${md}）是${sp.text}，一起好好過這一天 💕`,
      url: "./#calendar",
      tag: "day-" + tk,
    }),
  );
  console.log(`今天（${tk}）是${sp.text}，推播送出 ${sent} / ${subs.length} 台。`);
  if (sent) await markSent("x~remind~day-" + tk, tk);
}
