// 瀏覽器測試：用假的 Firebase（fake-firebase.js）在模擬手機上把網站跑一遍。
// 不會連到真的資料庫。每次推送 GitHub 會自動跑（.github/workflows/check.yml）。
// 本機執行：npm i playwright && npx playwright install chromium && node tools/test/browser-test.mjs
import { chromium } from "playwright";
import { createServer } from "node:http";
import { readFileSync, existsSync } from "node:fs";
import { join, extname, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const FAKE = readFileSync(join(ROOT, "tools/test/fake-firebase.js"), "utf8");
const ROOM = "test-only-123";
const JPG =
  "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAA0JCgsKCA0LCgsODg0PEyAVExISEyccHhcgLikxMC4pLSwzOko+MzZGNywtQFdBRkxOUlNSMj5aYVpQYEpRUk//2wBDAQ4ODhMREyYVFSZPNS01T09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT0//wAARCAAMABADASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwDTooopnvn/2Q==";
const SECTIONS = [
  "today",
  "quests",
  "photos",
  "ladder",
  "calendar",
  "wishes",
  "draw",
  "memories",
  "book",
  "tools",
  "rules",
];

// ---- 小型靜態伺服器 ----
const TYPES = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".png": "image/png",
  ".webmanifest": "application/manifest+json",
};
const server = createServer((req, res) => {
  const p = decodeURIComponent(new URL(req.url, "http://x").pathname);
  const f = join(ROOT, p === "/" ? "index.html" : p);
  if (!f.startsWith(ROOT) || !existsSync(f)) {
    res.writeHead(404).end();
    return;
  }
  res.writeHead(200, { "content-type": TYPES[extname(f)] || "application/octet-stream" }).end(readFileSync(f));
}).listen(0);
const BASE = `http://localhost:${server.address().port}/index.html`;

// ---- 假資料：最近 20 天，兩個人都有寫日記、傳照片 ----
const pad = (n) => String(n).padStart(2, "0");
const keyOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
function seed() {
  const s = {},
    R = `rooms/${ROOM}/`,
    put = (c, id, d) => ((s[R + c] = s[R + c] || {})[id] = d),
    now = new Date();
  for (let i = 1; i <= 20; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const dk = keyOf(d),
      at = d.toISOString();
    for (const by of ["寒冰", "夏夏"]) {
      put("diary", `d${i}${by}`, {
        date: dk,
        by,
        mood: "開心",
        food: "拉麵",
        funny: "",
        say: "謝謝你 💕",
        happy: (i % 10) + 1,
        s1: "",
        s2: "",
        at,
      });
      put("done", `x~wrote~${dk}_${by}`, { date: dk, by, at });
      put("photos", `${dk}_${by}`, { date: dk, by, th: JPG, cap: "", at });
      put("pics", `${dk}_${by}`, { img: JPG, date: dk, by });
      put("done", `x~bonus~${dk}_${by}`, { date: dk, xp: 5, by, at });
    }
  }
  put("done", "x~wishes~w1", {
    text: "一起去看日出",
    cat: "go",
    done: false,
    doneDate: "",
    by: "夏夏",
    at: now.toISOString(),
  });
  put("done", "x~birthdays~寒冰", { m: 3, d: 14 });
  return s;
}

let failed = 0;
const ok = (msg) => console.log("✅ " + msg);
const fail = (msg) => {
  failed++;
  console.log("❌ " + msg);
};

const browser = await chromium.launch();
async function phone({ theme = "dark", name = "寒冰", width = 390 } = {}) {
  const ctx = await browser.newContext({
    viewport: { width, height: 844 },
    isMobile: true,
    hasTouch: true,
    colorScheme: theme,
    serviceWorkers: "block",
    acceptDownloads: true,
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route(/gstatic\.com/, (r) =>
    r.fulfill({ contentType: "text/javascript", body: r.request().url().includes("app-compat") ? FAKE : "" }),
  );
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.fulfill({ body: "" }));
  await page.addInitScript(
    ([sd, room, n]) => {
      window.__SEED = sd;
      localStorage.setItem("love-base-room", room);
      localStorage.setItem("love-base-name", n);
      localStorage.setItem("love-base-seen", "9999");
    },
    [seed(), ROOM, name],
  );
  return { ctx, page, errors };
}
const go = async (page, sec) => {
  await page.evaluate((s) => (location.hash = s), sec);
  await page.waitForTimeout(350);
};

// 1. 每一頁在深色、淺色、窄螢幕都能打開，沒有錯誤、沒有左右超出畫面
for (const [theme, width] of [
  ["dark", 390],
  ["light", 390],
  ["light", 360],
]) {
  const { ctx, page, errors } = await phone({ theme, width });
  await page.goto(BASE + "#today");
  await page.waitForTimeout(1200);
  const bad = [];
  for (const sec of SECTIONS) {
    await go(page, sec);
    const over = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    if (over > 1) bad.push(`${sec} 超出 ${over}px`);
  }
  if (errors.length) fail(`${theme} ${width}px 有程式錯誤：${errors.join(" | ")}`);
  else if (bad.length) fail(`${theme} ${width}px：${bad.join("、")}`);
  else ok(`${theme === "dark" ? "深色" : "淺色"} ${width}px：${SECTIONS.length} 頁都正常`);
  await ctx.close();
}

// 2. 寫日記、許願、完成願望、月曆、下載照片壓縮檔
{
  const { ctx, page, errors } = await phone();
  await page.goto(BASE + "#quests");
  await page.waitForTimeout(1200);
  const room = (c) => `rooms/${ROOM}/${c}`;

  await page.fill("#dMood", "測試心情");
  await page.fill("#dSay", "測試想說的話");
  await page.click("#dSave");
  await page.waitForTimeout(500);
  const wrote = await page.evaluate(
    (p) => Object.values(window.__store[p] || {}).some((e) => e.mood === "測試心情" && e.by === "寒冰"),
    room("diary"),
  );
  wrote ? ok("寫日記會存進資料庫") : fail("寫日記沒有存進資料庫");

  await go(page, "wishes");
  await page.fill("#wText", "測試願望");
  await page.click("#wSave");
  await page.waitForTimeout(400);
  const wish = await page.evaluate(
    (p) =>
      Object.entries(window.__store[p] || {}).find(([id, w]) => id.startsWith("x~wishes~") && w.text === "測試願望"),
    room("done"),
  );
  if (!wish) fail("許願沒有存進資料庫");
  else {
    const wid = wish[0].split("~")[2];
    await page.click(`#wishList .check[data-id="${wid}"]`);
    await page.waitForTimeout(400);
    const updated = await page.evaluate(([p, id]) => window.__store[p][id], [room("done"), wish[0]]);
    updated?.done ? ok("許願並完成願望正常") : fail("完成願望沒有存進資料庫");
    // 約定日期：選明天，月曆明天的格子要能點、有「約定」圓點，取消後清掉
    const tmrD = new Date();
    tmrD.setDate(tmrD.getDate() + 1);
    const tmrK = keyOf(tmrD);
    await page.evaluate(
      ([id, v]) => {
        const w = window.__store[`rooms/test-only-123/done`]["x~wishes~" + id];
        if (w) w.done = false;
      },
      [wid, tmrK],
    );
    await page.evaluate((id) => toggleWish(id), wid);
    await page.waitForTimeout(300);
    await page.fill(`input[data-plan="${wid}"]`, tmrK);
    await page.waitForTimeout(300);
    const planSaved = await page.evaluate(([p, id]) => window.__store[p][id].plan, [room("done"), wish[0]]);
    await go(page, "calendar");
    if (tmrK.slice(0, 7) !== keyOf(new Date()).slice(0, 7)) await page.click("#calNext");
    await page.waitForTimeout(200);
    const cellOk = await page.evaluate((k) => {
      const b = document.querySelector(`#calGrid [data-d="${k}"]`);
      return !!b && !b.disabled && !!b.querySelector(".d-plan");
    }, tmrK);
    await go(page, "wishes");
    await page.click(`[data-planx="${wid}"]`);
    await page.waitForTimeout(300);
    const planCleared = await page.evaluate(([p, id]) => !window.__store[p][id].plan, [room("done"), wish[0]]);
    planSaved === tmrK && cellOk && planCleared
      ? ok("願望約定日期：存得進去、月曆看得到、可以取消")
      : fail(`約定日期不正常（存 ${planSaved}，月曆 ${cellOk}，取消 ${planCleared}）`);
    await page.evaluate((id) => toggleWish(id), wid);
    await page.waitForTimeout(300);
    // 完成的願望收在「已完成」裡，直接按它的刪除（要按兩次確認）
    await page.evaluate((id) => {
      const b = document.querySelector(`.wish .del[data-id="${id}"]`);
      b.click();
      b.click();
    }, wid);
    await page.waitForTimeout(300);
    const trashed = await page.evaluate(([p, id]) => !!window.__store[p][id].trashed, [room("done"), wish[0]]);
    await page.click("#toast .toast-act");
    await page.waitForTimeout(400);
    const back = await page.evaluate(([p, id]) => !window.__store[p][id].trashed, [room("done"), wish[0]]);
    trashed && back
      ? ok("刪除後按提示上的「復原」能救回來")
      : fail(`刪除／復原不正常（刪除 ${trashed}，復原 ${back}）`);
  }

  await go(page, "calendar");
  const cell = await page
    .$eval("#calGrid button.today", (b) => ({ cls: b.className, h: b.clientHeight, sh: b.scrollHeight }))
    .catch(() => null);
  if (!cell) fail("月曆找不到今天的格子");
  else if (cell.sh > cell.h + 2) fail("月曆今天的格子內容超出格子");
  else ok("月曆今天的格子正常");

  await go(page, "memories");
  const svgBox = await (await page.$(".chart svg")).boundingBox();
  await page.tap(".chart svg", { position: { x: svgBox.width * 0.6, y: svgBox.height / 2 } });
  await page.waitForTimeout(200);
  const tipShown = await page.$eval(".chart .tip", (t) => !t.hidden && /⭐/.test(t.textContent));
  if (!tipShown) fail("點幸福指數曲線沒有顯示分數");
  else {
    await page.tap(".chart .tip");
    await page.waitForTimeout(400);
    (await page.evaluate(() => location.hash)).startsWith("#calendar")
      ? ok("點幸福指數會顯示分數，再點會跳到月曆那天")
      : fail("點幸福指數的提示沒有跳到月曆");
  }

  await go(page, "tools");
  await page.evaluate(() => (document.getElementById("bkBox").open = true));
  await page.waitForTimeout(300);
  const month = keyOf(new Date(Date.now() - 864e5)).slice(0, 7);
  await page.selectOption("#zipMonth", month);
  const [dl] = await Promise.all([page.waitForEvent("download"), page.click("#zipGo")]);
  const buf = readFileSync(await dl.path());
  const files = buf.toString("latin1").split("PK\x01\x02").length - 1;
  buf.readUInt32LE(0) === 0x04034b50 && files > 0 ? ok(`照片壓縮檔正常（${files} 張）`) : fail("照片壓縮檔格式不對");

  if (errors.length) fail("操作過程有程式錯誤：" + errors.join(" | "));
  await ctx.close();
}

await browser.close();
server.close();
if (failed) {
  console.log(`\n有 ${failed} 項沒通過`);
  process.exit(1);
}
console.log("\n瀏覽器測試全部通過");
