// 瀏覽器測試：用假的 Firebase（fake-firebase.js）在模擬手機上把網站跑一遍。
// 不會連到真的資料庫。每次推送 GitHub 會自動跑（.github/workflows/check.yml）。
// 本機執行：npm i playwright && npx playwright install chromium && node tools/test/browser-test.mjs
// 用 iPhone 的瀏覽器核心跑：npx playwright install webkit && BROWSER=webkit node tools/test/browser-test.mjs
import { chromium, webkit } from "playwright";
import { createServer } from "node:http";
import { readFileSync, existsSync } from "node:fs";
import { join, extname, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

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
  const prevD = keyOf(new Date(now - 864e5));
  put("done", "x~rounds~r0", { q: "最想一起去哪裡旅行？", day: prevD, by: "寒冰", at: now.toISOString() });
  put("done", "x~answers~a0a", { round: "r0", text: "想去北海道看雪", by: "寒冰", at: now.toISOString() });
  put("done", "x~answers~a0b", { round: "r0", text: "我想去京都旅行", by: "夏夏", at: now.toISOString() });
  return s;
}

let failed = 0;
const ok = (msg) => console.log("✅ " + msg);
const fail = (msg) => {
  failed++;
  console.log("❌ " + msg);
};

const ENGINE = process.env.BROWSER === "webkit" ? "webkit" : "chromium";
console.log(
  `（瀏覽器核心：${ENGINE === "webkit" ? "WebKit，跟 iPhone Safari 一樣" : "Chromium，跟 Android Chrome 一樣"}）`,
);
const browser = await (ENGINE === "webkit" ? webkit : chromium).launch();
async function phone({ theme = "dark", name = "寒冰", width = 390, extra = null, keepSplash = false } = {}) {
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
    ([sd, room, n, ks]) => {
      if (location.protocol === "about:") return; // 空白頁不用設定
      window.__SEED = sd;
      localStorage.setItem("love-base-room", room);
      localStorage.setItem("love-base-name", n);
      localStorage.setItem("love-base-seen", "9999");
      // 開場動畫一天只播一次：測試預設當作今天已經播過（keepSplash 時才測第一次打開）
      if (!ks && !sessionStorage.getItem("t-splash"))
        localStorage.setItem("love-base-splash", new Date().toDateString());
      if (ks && !sessionStorage.getItem("t-splash")) {
        localStorage.removeItem("love-base-splash");
        sessionStorage.setItem("t-splash", "1");
      }
    },
    [extra ? extra(seed()) : seed(), ROOM, name, keepSplash],
  );
  return { ctx, page, errors };
}
const go = async (page, sec) => {
  await page.evaluate((s) => (location.hash = s), sec);
  await page.waitForTimeout(350);
  // 等換頁動畫跑完再量（GitHub 上的機器比較慢，動畫跑到一半量會多出幾 px）
  await page
    .waitForFunction(
      () =>
        !document
          .getAnimations()
          .some((a) => a.playState === "running" && a.effect?.getTiming().iterations !== Infinity),
      null,
      { timeout: 3000 },
    )
    .catch(() => {});
};

// 整頁比螢幕寬時，找出是哪個東西撐寬的（一層一層把子元素藏起來，看寬度有沒有變回來）
const widest = (page) =>
  page.evaluate(() => {
    const W = () => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth);
    // 找的時候先把動畫關掉，不然藏起來再放回去會讓動畫重播，量到的位置不準
    const st = document.createElement("style");
    st.textContent = "*,*::before,*::after{animation:none!important;transition:none!important}";
    document.head.append(st);
    const base = W();
    if (base <= innerWidth + 1) {
      st.remove();
      const run = document
        .getAnimations()
        .filter((a) => a.playState === "running")
        .slice(0, 4)
        .map((a) => {
          const t = a.effect?.target;
          const n = t
            ? t.tagName.toLowerCase() + (t.id ? "#" + t.id : "") + (t.classList[0] ? "." + t.classList[0] : "")
            : "?";
          return `${n} ${a.animationName || a.transitionProperty || a.constructor.name}`;
        });
      return `（關掉動畫後就沒有超出，是這些動畫造成的：${run.join("、") || "找不到"}）`;
    }
    let cur = document.body,
      path = [];
    for (let k = 0; k < 16; k++) {
      let hit = null;
      for (const c of cur.children) {
        const d = c.style.display;
        c.style.display = "none";
        const w = W();
        c.style.display = d;
        if (w < base) {
          hit = c;
          break;
        }
      }
      if (!hit) break;
      cur = hit;
      path.push(
        cur.tagName.toLowerCase() + (cur.id ? "#" + cur.id : "") + (cur.classList[0] ? "." + cur.classList[0] : ""),
      );
    }
    const r = cur.getBoundingClientRect();
    st.remove();
    return `（撐寬的是 ${path.slice(-3).join(" > ")}，左 ${Math.round(r.left)} 寬 ${Math.round(r.width)}）`;
  });

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
    // body 也要量：html 有 overflow-x:clip，被撐寬的內容會被切掉而不是出現捲軸
    const over = await page.evaluate(
      () => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - innerWidth,
    );
    if (over > 1) bad.push(`${sec} 超出 ${over}px${await widest(page)}`);
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

  // 編輯日記、表情貼圖與留言
  await page.click("#diaryToday article .edit");
  await page.waitForTimeout(200);
  await page.fill("#dMood", "修改後心情");
  await page.click("#dSave");
  await page.waitForTimeout(400);
  const edited = await page.evaluate(
    ([p, dk]) => {
      const mine = Object.values(window.__store[p] || {}).filter((e) => e.date === dk && e.by === "寒冰");
      return mine.length === 1 && mine[0].mood === "修改後心情";
    },
    [room("diary"), keyOf(new Date())],
  );
  edited ? ok("編輯日記正常且不會重複新增") : fail("編輯日記不正常");

  await page.click("#diaryToday article [data-react]");
  await page.waitForTimeout(300);
  await page.click("#diaryToday article [data-reply]");
  await page.waitForTimeout(200);
  await page.fill("#replyText", "測試留言");
  await page.click("#replySend");
  await page.waitForTimeout(400);
  const replyOk = await page.evaluate((p) => {
    const rs = Object.entries(window.__store[p] || {})
      .filter(([id]) => id.startsWith("x~replies~"))
      .map(([, v]) => v);
    return rs.some((r) => r.kind === "emo") && rs.some((r) => r.kind === "text" && r.text === "測試留言");
  }, room("done"));
  replyOk ? ok("日記表情貼圖與留言正常") : fail("日記表情貼圖或留言沒有存進資料庫");

  // 搜尋日記標亮關鍵字＋一鍵清除
  await go(page, "calendar");
  await page.evaluate(() => (document.getElementById("diaryMore").open = true));
  await page.fill("#dSearch", "拉麵");
  await page.waitForTimeout(350);
  const dHl1 = await page.evaluate(() => ({
    marks: [...document.querySelectorAll("#entries mark.hl")].map((m) => m.textContent),
    clrShown: !document.querySelector("#dSearch + .search-x").hidden,
  }));
  await page.click("#dSearch + .search-x");
  await page.waitForTimeout(250);
  const dHl2 = await page.evaluate(() => ({
    val: document.getElementById("dSearch").value,
    marks: document.querySelectorAll("#entries mark.hl").length,
    clrHidden: document.querySelector("#dSearch + .search-x").hidden,
  }));
  dHl1.marks.includes("拉麵") && dHl1.clrShown && !dHl2.val && !dHl2.marks && dHl2.clrHidden
    ? ok("搜尋日記會標亮關鍵字，點 ✕ 可一鍵清除")
    : fail(`日記搜尋標亮或清除不正常（搜 ${JSON.stringify(dHl1)}，清 ${JSON.stringify(dHl2)}）`);

  // 抽題與作答
  await go(page, "draw");
  const canDraw = await page.evaluate(() => {
    const b = document.getElementById("drawBtn");
    return !b.hidden && !b.disabled;
  });
  if (canDraw) {
    await page.click("#drawBtn");
    await page.waitForTimeout(400);
  } else {
    await page.evaluate(() => addDoc("rounds", { q: "測試題目", day: key(today()), by: "夏夏", at: nowIso() }));
    await page.waitForTimeout(300);
  }
  await page.fill("#ansText", "我的測試答案");
  await page.click("#ansSave");
  await page.waitForTimeout(400);
  const drawOk = await page.evaluate((p) => {
    const entries = Object.entries(window.__store[p] || {});
    return (
      entries.some(([id]) => id.startsWith("x~rounds~")) &&
      entries.some(([id, v]) => id.startsWith("x~answers~") && v.text === "我的測試答案")
    );
  }, room("done"));
  drawOk ? ok("抽題與回答正常") : fail("抽題或回答沒有存進資料庫");

  // 過關紀錄搜尋標亮關鍵字＋一鍵清除
  await page.evaluate(() => (document.getElementById("lSearch").closest("details").open = true));
  await page.fill("#lSearch", "旅行");
  await page.waitForTimeout(350);
  const lHl1 = await page.evaluate(() => ({
    marks: [...document.querySelectorAll("#logList mark.hl")].map((m) => m.textContent),
    clrShown: !document.querySelector("#lSearch + .search-x").hidden,
  }));
  await page.click("#lSearch + .search-x");
  await page.waitForTimeout(250);
  const lHl2 = await page.evaluate(() => ({
    val: document.getElementById("lSearch").value,
    marks: document.querySelectorAll("#logList mark.hl").length,
    clrHidden: document.querySelector("#lSearch + .search-x").hidden,
  }));
  lHl1.marks.includes("旅行") && lHl1.clrShown && !lHl2.val && !lHl2.marks && lHl2.clrHidden
    ? ok("過關紀錄搜尋會標亮關鍵字，點 ✕ 可一鍵清除")
    : fail(`過關紀錄搜尋標亮或清除不正常（搜 ${JSON.stringify(lHl1)}，清 ${JSON.stringify(lHl2)}）`);

  // 討抱抱
  await go(page, "today");
  await page.click("#hugOpen");
  await page.waitForTimeout(200);
  await page.fill("#hugText", "今天好累想抱抱");
  await page.click("#hugSave");
  await page.waitForTimeout(400);
  const hugOk = await page.evaluate(
    (p) =>
      Object.entries(window.__store[p] || {}).some(
        ([id, v]) => id.startsWith("x~hugs~") && v.text === "今天好累想抱抱",
      ),
    room("done"),
  );
  hugOk ? ok("討抱抱正常") : fail("討抱抱沒有存進資料庫");

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
    await page.locator(`input[data-plan="${wid}"]`).blur();
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
  // 時光膠囊
  const capD = new Date();
  capD.setDate(capD.getDate() + 30);
  const capK = keyOf(capD);
  await page.evaluate(() => (document.getElementById("capsule").open = true));
  await page.waitForTimeout(200);
  await page.fill("#capText", "給未來的信");
  await page.fill("#capDate", capK);
  await page.click("#capSave");
  await page.waitForTimeout(400);
  const capOk = await page.evaluate(
    ([p, d]) =>
      Object.entries(window.__store[p] || {}).some(
        ([id, v]) => id.startsWith("x~capsules~") && v.text === "給未來的信" && v.openDate === d,
      ),
    [room("done"), capK],
  );
  capOk ? ok("時光膠囊封存正常") : fail("時光膠囊沒有存進資料庫");

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

// 3. 今天的照片切換、對方新東西提醒、寫完日記的回饋、開場動畫一天一次、打開網站不亂跳
{
  const today = keyOf(new Date()),
    tmr = keyOf(new Date(Date.now() + 864e5)),
    now = new Date().toISOString();
  const extra = (s) => {
    const R = `rooms/${ROOM}/`;
    s[R + "photos"][`${today}_夏夏`] = { date: today, by: "夏夏", th: JPG, cap: "", at: now };
    s[R + "photos"][`${today}_寒冰`] = { date: today, by: "寒冰", th: JPG, cap: "", at: now };
    s[R + "photos"][`${today}_寒冰_b`] = { date: today, by: "寒冰", th: JPG, cap: "", at: now };
    s[R + "diary"][`dT夏夏`] = { date: today, by: "夏夏", mood: "想你", say: "", at: now };
    // 多放兩則提醒（到期膠囊＋明天約定），測超過 2 則自動收合
    s[R + "done"]["x~capsules~cDue"] = { text: "到期囉", openDate: today, by: "夏夏", at: now };
    s[R + "done"]["x~wishes~wPlan"] = {
      text: "明天去約會",
      cat: "go",
      done: false,
      doneDate: "",
      plan: tmr,
      by: "寒冰",
      at: now,
    };
    return s;
  };
  const { ctx, page, errors } = await phone({ extra, keepSplash: true });
  // 第一次打開有開場動畫，同一天再打開就直接進去
  await page.goto(BASE + "#today");
  await page.waitForTimeout(300);
  const splash1 = await page.evaluate(() => !document.getElementById("splash").hidden);
  await page.waitForTimeout(1500);
  const jumps = [];
  await page.exposeFunction("__jump", (y) => jumps.push(y));
  await page.addInitScript(() => addEventListener("scroll", () => window.__jump && window.__jump(Math.round(scrollY))));
  // 像平常一樣重新打開（不是重新整理：重新整理時瀏覽器會沿用原本的捲動位置，測不出來）
  await page.goto("about:blank");
  await page.goto(BASE + "#today");
  await page.waitForTimeout(1500);
  const splash2 = await page.evaluate(() => !document.getElementById("splash").hidden);
  splash1 && !splash2 ? ok("開場動畫一天只播一次") : fail(`開場動畫不對（第一次 ${splash1}，再打開 ${splash2}）`);
  jumps.filter((y) => y > 5).length
    ? fail("用 #today 打開時畫面會自己往下跳：" + jumps.join(","))
    : ok("用 #today 打開時畫面不會亂跳");

  // 超過 2 則提醒自動收合，點一下全部展開、再點收起
  const noticeState = () =>
    page.evaluate(() => ({
      shown: document.querySelectorAll("#notices > .away:not([hidden]):not(.folded)").length,
      folded: document.querySelectorAll("#notices > .away.folded").length,
      btnHidden: document.getElementById("noticesMore").hidden,
      btnText: document.getElementById("noticesMore").textContent,
    }));
  const ns1 = await noticeState();
  await page.click("#noticesMore");
  await page.waitForTimeout(150);
  const ns2 = await noticeState();
  await page.click("#noticesMore");
  await page.waitForTimeout(150);
  const ns3 = await noticeState();
  ns1.shown === 2 &&
  ns1.folded >= 1 &&
  !ns1.btnHidden &&
  ns2.folded === 0 &&
  ns2.shown >= 3 &&
  ns3.shown === 2 &&
  ns3.folded >= 1
    ? ok("今天頁提醒超過 2 則自動收合，點一下可展開與收起")
    : fail(`提醒收合不正常（初始 ${JSON.stringify(ns1)}，展開 ${JSON.stringify(ns2)}，收起 ${JSON.stringify(ns3)}）`);

  // 今天頁提醒夏夏的新日記和照片，按「去看看」到日記頁、看過就不再提醒
  const nudge = () =>
    page.evaluate(() =>
      document.getElementById("newNudge").hidden ? "" : document.getElementById("newNudge").textContent,
    );
  const n1 = await nudge();
  await page.click("#newNudge a");
  await page.waitForTimeout(500);
  const there = await page.evaluate(() => document.querySelector(".wrap>section.current").id);
  await go(page, "today");
  const n2 = await nudge();
  /寫了日記/.test(n1) && /照片/.test(n1) && there === "quests" && !n2
    ? ok("今天頁會提醒對方的新日記和照片，看過就消失")
    : fail(`對方新東西提醒不對（提醒「${n1}」，去了 ${there}，回來還有「${n2}」）`);

  // 今天的照片：預設看對方，點「我」馬上換、照片不用重畫，小圓點數量對
  await go(page, "quests");
  await page.waitForTimeout(400);
  await page.evaluate(() => {
    window.__r = 0;
    const f = window.renderTodayPhotos;
    window.renderTodayPhotos = function () {
      window.__r++;
      return f.apply(this, arguments);
    };
  });
  const showing = () => page.$eval("#todayPhotos", (b) => b.dataset.showing);
  const s0 = await showing();
  const imgBefore = await page.$('#todayPhotos .ph-big[data-pane="mine"] img');
  await page.tap('#todayPhotos [data-who="mine"]');
  await page.waitForTimeout(100);
  const s1 = await showing();
  const same = await page.evaluate(
    (old) => document.querySelector('#todayPhotos .ph-big[data-pane="mine"] img') === old,
    imgBefore,
  );
  const dots = await page.$$eval('#todayPhotos .ph-dots[data-pane="mine"] i', (a) => a.length);
  const pill = await page.$eval("#todayPhotos .ph-who", (e) => e.style.getPropertyValue("--i"));
  const redraws = await page.evaluate(() => window.__r);
  s0 === "other" && s1 === "mine" && same && !redraws && dots === 2 && pill === "1"
    ? ok("今天的照片：預設看對方，點「我」馬上換（不重畫），小圓點和膠囊位置正確")
    : fail(`今天的照片切換不對（一開始 ${s0}，點了 ${s1}，沒重畫 ${same && !redraws}，圓點 ${dots}，膠囊 ${pill}）`);
  await page.tap('#todayPhotos [data-who="other"]');
  await page.waitForTimeout(100);

  // 寫完日記：卡片彈一下、提示看對方寫了沒
  await page.fill("#dMood", "測試回饋");
  await page.click("#dSave");
  await page
    .waitForFunction(() => document.querySelector("#diaryToday article.just-in"), null, { timeout: 1000 })
    .catch(() => {});
  const fb = await page.evaluate(() => ({
    toast: document.getElementById("toast")?.textContent || "",
    card: !!document.querySelector("#diaryToday article.just-in"),
  }));
  /你們兩個都寫了/.test(fb.toast) && fb.card
    ? ok("寫完日記有彈一下的動畫和提示")
    : fail(`寫完日記的回饋不對（提示「${fb.toast}」，動畫 ${fb.card}）`);

  // 左右滑換頁：頁面跟著手指走，放開換到下一頁（不支援模擬觸控的瀏覽器就略過）
  await go(page, "today");
  const swiped = await page.evaluate(async () => {
    try {
      const el = document.querySelector("#today .hud") || document.querySelector("#today");
      const mk = (type, x) =>
        new TouchEvent(type, {
          bubbles: true,
          cancelable: true,
          touches: type === "touchend" ? [] : [new Touch({ identifier: 1, target: el, clientX: x, clientY: 300 })],
          changedTouches: [new Touch({ identifier: 1, target: el, clientX: x, clientY: 300 })],
        });
      el.dispatchEvent(mk("touchstart", 320));
      let mid = "";
      for (let i = 1; i <= 10; i++) {
        el.dispatchEvent(mk("touchmove", 320 - i * 22));
        if (i === 6) mid = document.querySelector("#today").style.transform;
      }
      el.dispatchEvent(mk("touchend", 100));
      await new Promise((r) => setTimeout(r, 600));
      return { mid, now: document.querySelector(".wrap>section.current").id };
    } catch (e) {
      return { skip: String(e) };
    }
  });
  if (swiped.skip) ok("（這個瀏覽器不能模擬觸控，略過左右滑測試）");
  else {
    /translate3d\(-/.test(swiped.mid) && swiped.now === "quests"
      ? ok("左右滑換頁：頁面跟著手指走，放開換到下一頁")
      : fail(`左右滑換頁不對（滑到一半 ${swiped.mid}，放開後在 ${swiped.now}）`);
    // 從螢幕最左邊緣（< 24px）往右滑要讓給系統手勢，不觸發換頁
    const edgeStayed = await page.evaluate(async () => {
      const el = document.querySelector("#quests");
      const mk = (type, x) =>
        new TouchEvent(type, {
          bubbles: true,
          cancelable: true,
          touches: type === "touchend" ? [] : [new Touch({ identifier: 2, target: el, clientX: x, clientY: 300 })],
          changedTouches: [new Touch({ identifier: 2, target: el, clientX: x, clientY: 300 })],
        });
      el.dispatchEvent(mk("touchstart", 10));
      for (let i = 1; i <= 8; i++) el.dispatchEvent(mk("touchmove", 10 + i * 25));
      el.dispatchEvent(mk("touchend", 210));
      await new Promise((r) => setTimeout(r, 400));
      return document.querySelector(".wrap>section.current").id;
    });
    edgeStayed === "quests"
      ? ok("螢幕最邊緣滑動不搶系統手勢（不誤換頁）")
      : fail(`螢幕最邊緣滑動誤換頁到了 ${edgeStayed}`);
  }

  if (errors.length) fail("操作過程有程式錯誤：" + errors.join(" | "));
  await ctx.close();
}

// 4. 照片原圖存到 Google 雲端（用假的 Google Apps Script，不會碰到真的雲端硬碟）
{
  const GAS = "https://script.google.com/macros/s/AKfyTEST/exec",
    HASH = createHash("sha256").update(ROOM).digest("hex"),
    drive = {};
  let down = false;
  const { ctx, page, errors } = await phone();
  const warns = [];
  page.on("console", (m) => m.type() === "warning" && warns.push(m.text()));
  await ctx.route(/script\.google\.com/, (r) => {
    const d = JSON.parse(r.request().postData() || "{}");
    if (down) return r.fulfill({ status: 500, body: "busy" });
    let out = { ok: false, error: "key" };
    if (d.k === HASH) {
      if (d.a === "ping") out = { ok: true };
      else if (d.a === "put") {
        const fid = "F" + Object.keys(drive).length;
        drive[fid] = d;
        out = { ok: true, fid };
      } else if (d.a === "get")
        out = drive[d.fid]
          ? { ok: true, mime: drive[d.fid].mime, name: drive[d.fid].name, data: drive[d.fid].data }
          : { ok: false };
    }
    r.fulfill({ contentType: "application/json", body: JSON.stringify(out) });
  });
  await page.goto(BASE + "#tools");
  await page.waitForTimeout(1200);
  await page.evaluate(() => (document.getElementById("origBox").open = true));
  await page.fill("#origUrlIn", GAS);
  await page.click("#origSave");
  await page.waitForTimeout(600);
  const saved = /連上了/.test(await page.textContent("#origMsg"));
  // 做一張 2400×1800 的照片當原圖上傳
  const big = Buffer.from(
    await page.evaluate(() => {
      const c = document.createElement("canvas");
      c.width = 2400;
      c.height = 1800;
      const x = c.getContext("2d");
      for (let i = 0; i < 3000; i++) {
        x.fillStyle = `hsl(${i % 360},80%,50%)`;
        x.fillRect((i * 37) % 2400, (i * 91) % 1800, 40, 40);
      }
      return c.toDataURL("image/jpeg", 0.97).split(",")[1];
    }),
    "base64",
  );
  await go(page, "quests");
  const [fc] = await Promise.all([page.waitForEvent("filechooser"), page.click("#todayPhotos [data-up]:visible")]);
  await fc.setFiles({ name: "IMG_1.jpg", mimeType: "image/jpeg", buffer: big });
  for (let t = 0; t < 80 && !Object.keys(drive).length; t++) await page.waitForTimeout(100); // 等原圖在背景傳完
  const same = Object.values(drive).some((d) => Buffer.from(d.data, "base64").equals(big));
  await page.click('.ph-big[data-pane="mine"] [data-open]');
  await page.waitForTimeout(500);
  const [dl] = await Promise.all([
    page.waitForEvent("download", { timeout: 8000 }).catch(() => null),
    page.click("#lbSave"),
  ]);
  const gotOrig = !!dl && readFileSync(await dl.path()).equals(big);
  // Google 那邊掛掉時，下載改用網站上壓小的版本
  down = true;
  const [dl2] = await Promise.all([
    page.waitForEvent("download", { timeout: 8000 }).catch(() => null),
    page.click("#lbSave"),
  ]);
  const fallback = !!dl2 && readFileSync(await dl2.path()).length < big.length;
  saved && same && gotOrig && fallback
    ? ok("照片原圖：設定、原圖上傳到雲端、下載拿到原圖，雲端掛掉時改用壓小的版本")
    : fail(
        `照片原圖不對（設定 ${saved}，上傳一樣 ${same}，下載原圖 ${gotOrig}，備援 ${fallback}）${warns.join(" | ")}`,
      );
  if (errors.length) fail("操作過程有程式錯誤：" + errors.join(" | "));
  await ctx.close();
}

// 5. 用真實大小的照片和很長的字把每一頁看一遍：照片不能糊、字不能跑出框、整頁不能被撐寬
//    （之前的假照片縮圖和大圖都是同一張小圖，所以「今天的照片」大格用了縮圖變糊卻沒被抓到）
{
  const b64 = (f) => "data:image/jpeg;base64," + readFileSync(join(ROOT, "tools/test/fixtures", f)).toString("base64");
  const TH = b64("th.jpg"), // 420 寬，跟網站存的縮圖一樣
    PIC = b64("pic.jpg"); // 1280 寬，跟網站存的大圖一樣
  const URL_LONG = "https://www.instagram.com/p/C0abcdefghijklmnopqrstuvwxyz1234567890/?igsh=abcdefghijklmnop";
  const real = (s) => {
    const R = `rooms/${ROOM}/`,
      now = new Date();
    for (const [id, v] of Object.entries(s[R + "photos"])) v.th = TH;
    for (const [id, v] of Object.entries(s[R + "pics"])) v.img = PIC;
    const today = keyOf(now);
    for (const by of ["寒冰", "夏夏"]) {
      s[R + "photos"][`${today}_${by}`] = { date: today, by, th: TH, cap: URL_LONG, at: now.toISOString() };
      s[R + "pics"][`${today}_${by}`] = { img: PIC, date: today, by };
    }
    const d1 = Object.values(s[R + "diary"]);
    d1[0].say = "這個給你看 " + URL_LONG;
    d1[1].funny = "哈".repeat(80);
    d1[2].mood = "😂".repeat(40);
    s[R + "done"]["x~wishes~w2"] = {
      text: "一起去這間店" + URL_LONG,
      cat: "eat",
      done: false,
      doneDate: "",
      by: "寒冰",
      at: now.toISOString(),
    };
    return s;
  };
  for (const [theme, width] of [
    ["dark", 412],
    ["light", 360],
  ]) {
    const ctx = await browser.newContext({
      viewport: { width, height: 844 },
      deviceScaleFactor: 3, // 跟現在的手機一樣是 3 倍密度螢幕，才看得出照片糊不糊
      isMobile: true,
      hasTouch: true,
      colorScheme: theme,
      serviceWorkers: "block",
    });
    const page = await ctx.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.route(/gstatic\.com/, (r) =>
      r.fulfill({ contentType: "text/javascript", body: r.request().url().includes("app-compat") ? FAKE : "" }),
    );
    await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.fulfill({ body: "" }));
    await page.addInitScript(
      ([sd, room]) => {
        if (location.protocol === "about:") return;
        window.__SEED = sd;
        localStorage.setItem("love-base-room", room);
        localStorage.setItem("love-base-name", "寒冰");
        localStorage.setItem("love-base-seen", "9999");
        localStorage.setItem("love-base-splash", new Date().toDateString());
      },
      [real(seed()), ROOM],
    );
    await page.goto(BASE + "#today");
    await page.waitForTimeout(1500);
    const bad = [];
    for (const sec of SECTIONS) {
      await go(page, sec);
      await page.evaluate(() => {
        const s = document.querySelector(".wrap>section.current");
        s.querySelectorAll("details").forEach((d) => (d.open = true));
        document.querySelectorAll("img[loading=lazy]").forEach((i) => (i.loading = "eager"));
      });
      await page.waitForTimeout(1200);
      const found = await page.evaluate(() => {
        const out = [],
          DPR = devicePixelRatio,
          sec = document.querySelector(".wrap>section.current"),
          vis = (e) => e.getClientRects().length && getComputedStyle(e).visibility !== "hidden",
          name = (e) => {
            const c = e.closest("[id]");
            return (c ? "#" + c.id + " " : "") + e.tagName.toLowerCase();
          };
        // 照片清楚度：圖的像素至少要有「顯示大小 × 螢幕密度」的 60%
        for (const im of sec.querySelectorAll("img")) {
          if (!vis(im) || !im.naturalWidth) continue;
          const r = im.getBoundingClientRect();
          if (r.width < 40) continue;
          const fit = getComputedStyle(im).objectFit,
            sc =
              fit === "contain"
                ? Math.min(r.width / im.naturalWidth, r.height / im.naturalHeight)
                : fit === "cover"
                  ? Math.max(r.width / im.naturalWidth, r.height / im.naturalHeight)
                  : r.width / im.naturalWidth,
            q = 1 / (sc * DPR);
          if (q < 0.6) out.push(`${name(im)} 照片糊（${Math.round(r.width)}px 寬只給 ${im.naturalWidth}px 的圖）`);
        }
        // 整頁被撐寬
        const bw = Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - innerWidth;
        if (bw > 1) out.push(`整頁被撐寬 ${bw}px`);
        // 字跑出自己的框
        for (const e of sec.querySelectorAll("*")) {
          if (!vis(e) || /hidden|clip|auto|scroll/.test(getComputedStyle(e).overflowX)) continue;
          if (![...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim().length > 3)) continue;
          const rg = document.createRange();
          rg.selectNodeContents(e);
          const tr = rg.getBoundingClientRect(),
            er = e.getBoundingClientRect();
          if (er.width > 0 && tr.right > er.right + 3)
            out.push(`${name(e)} 字跑出框「${e.textContent.trim().slice(0, 12)}」`);
        }
        return [...new Set(out)].slice(0, 4);
      });
      if (found.length) bad.push(`${sec}：${found.join("、")}${await widest(page)}`);
    }
    // 點開大圖也要清楚
    await go(page, "today");
    await page.evaluate(() => document.querySelector("#todayPhotos [data-open]")?.click());
    await page.waitForTimeout(1500);
    const lb = await page.evaluate(() => {
      const im = document.getElementById("lbImg");
      if (!im || document.getElementById("lightbox").hidden || !im.naturalWidth) return "大圖沒打開";
      const r = im.getBoundingClientRect(),
        q = 1 / (Math.min(r.width / im.naturalWidth, r.height / im.naturalHeight) * devicePixelRatio);
      return q < 0.6 ? `大圖糊（${Math.round(r.width)}px 寬只給 ${im.naturalWidth}px 的圖）` : "";
    });
    if (lb) bad.push(lb);
    const tag = `${theme === "dark" ? "深色" : "淺色"} ${width}px`;
    if (errors.length) fail(`真實資料 ${tag} 有程式錯誤：${errors.join(" | ")}`);
    else if (bad.length) fail(`真實資料 ${tag}：${bad.join("；")}`);
    else ok(`真實資料 ${tag}：照片都清楚、長網址和長字都有換行、每一頁都沒有被撐寬`);
    await ctx.close();
  }
}

await browser.close();
server.close();
if (failed) {
  console.log(`\n有 ${failed} 項沒通過`);
  process.exit(1);
}
console.log("\n瀏覽器測試全部通過");
