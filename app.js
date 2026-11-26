const SUNDAY_TASK = { day: "日", name: "回憶收集", text: "寫下這週最開心、最難忘的瞬間。", xp: 10 };
const TITLES = [
  [50, "🐣 戀愛新手村"],
  [100, "🧸 黏踢踢小情侶"],
  [200, "🤡 專業互鬧選手"],
  [300, "💗 甜蜜製造機"],
  [500, "🍀 穩定升溫中"],
  [800, "🍜 吃貨雙人組"],
  [1200, "🧠 心電感應學徒"],
  [1800, "🎢 雙人副本老手"],
  [2500, "🌈 放閃職人"],
  [3500, "🔥 傳說級黏人精"],
  [5000, "🛡️ 永久組隊隊長"],
  [6500, "🌌 宇宙級閃光彈"],
  [8000, "👑 戀愛滿等玩家"],
];
const QUESTIONS = [
  "你覺得我最欠揍但又最可愛的地方是什麼？",
  "如果我變成一隻蟑螂，你還會愛我嗎？",
  "如果我們一起被困在荒島，你覺得誰會先崩潰？",
  "最近哪一個瞬間讓你突然很想我？",
  "第一次見到我的時候，你心裡在想什麼？",
  "我做過最讓你傻眼的一件事是什麼？",
  "用三個詞形容我們這段關係。",
  "如果明天放假一整天，你想跟我做什麼？",
  "你覺得我們誰比較會吃醋？",
  "我最常對你說的一句話是什麼？",
  "如果要幫我們拍一部電影，片名叫什麼？",
  "你偷偷覺得我哪一個習慣很好笑？",
  "我們吵架之後，你最希望我怎麼哄你？",
  "你最想跟我一起完成的一件事是什麼？",
  "如果可以交換身份一天，你最想用我的身份做什麼？",
  "你覺得我們十年後會在幹嘛？",
  "我哪一個表情你最受不了（但其實很喜歡）？",
  "你最想吃我煮的哪一道菜？",
  "我們之間最好笑的一個暗號或梗是什麼？",
  "哪一首歌會讓你想到我？",
  "如果我們養一隻寵物，要叫什麼名字？",
  "我最近做了什麼讓你覺得被照顧到？",
  "你覺得我們的戀愛像哪一種遊戲？",
  "你今天最想對我撒嬌的一句話是？",
  "如果只能用一個 emoji 代表我，你會選哪個？",
  "我們第一次約會，你最記得哪個畫面？",
  "你覺得我身上最像小孩的地方是什麼？",
  "如果我們一起去旅行，誰負責迷路？",
];

const LOVE_START = new Date(2026, 10, 4);
const DIARY_XP = 10,
  DIARY_XP_END = "2026-11-17",
  PHOTO_BONUS = 10,
  DRAW_XP = 10,
  STREAK_BONUS = 10,
  STREAK_STEP = 7;
const NOSAVE = "沒存到，請再試一次";

const $ = (id) => document.getElementById(id);
let entries = []; // diary docs
// 新功能的資料存在 done/x~集合~id，沿用現有的 Firebase 規則，不用另外開權限
const store = {
  birthdays: [],
  wishes: [],
  rounds: [],
  answers: [],
  passed: [],
  capsules: [],
  custom: [],
  fixes: [],
  hugs: [],
  replies: [],
  backups: [],
  bonus: [],
  reviews: [],
  wrote: [],
  push: [],
  remind: [],
};
// 刪除時在原本的資料上標記 trashed，30 天後才真的清掉
const trash = { diary: [], photos: [], wishes: [], capsules: [], custom: [] };
let db = null;
const LS = "love-base-v1";

function pad(n) {
  return String(n).padStart(2, "0");
}
function key(d) {
  return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
}
function today() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}
function dow(d) {
  return (d.getDay() + 6) % 7;
} // Mon=0
// 跟 esc 一樣，另外把 http(s) 網址變成可以點的連結（在新分頁打開）
function escLink(s) {
  return esc(s).replace(/https?:\/\/(?:(?!&quot;|&#39;|&lt;|&gt;)[^\s<>"'])+/g, (u) => {
    const tail = (u.match(/[.,，。、！!？?)）\]」』]+$/) || [""])[0],
      url = tail ? u.slice(0, -tail.length) : u;
    return `<a class="lnk" href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>${tail}`;
  });
}
function esc(s) {
  return String(s ?? "").replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );
}
// action：{ label, fn }，例如刪除後的「復原」按鈕
function toast(msg, ms = 2200, action) {
  const t = $("toast");
  t.textContent = msg;
  t.classList.toggle("has-act", !!action);
  if (action) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "toast-act";
    b.textContent = action.label;
    b.onclick = () => {
      t.hidden = true;
      action.fn();
    };
    t.append(b);
  }
  t.hidden = false;
  clearTimeout(toast.h);
  toast.h = setTimeout(() => (t.hidden = true), ms);
}
// 刪除後的提示：附「復原」按鈕，按錯了點一下就回來（之後也可以到設定的垃圾桶找）
const trashedToast = (c, id) => toast("移到垃圾桶了", 6000, { label: "↩︎ 復原", fn: () => restoreItem(c, id) });
const HAPTIC_KEY = "love-base-haptic",
  HAPTIC_LV_KEY = "love-base-haptic-level";
// 震動強度：網頁只能控制震多久，所以「強」就是震久一點（Android 才有效，iPhone 固定一種強度）
const HAPTIC_LV = { light: [1, 20], mid: [2, 40], strong: [3.5, 70] };
// 手機上記住的設定（localStorage）。無痕模式或關掉儲存時會出錯，統一在這裡接住。
function lsGet(k) {
  try {
    return localStorage.getItem(k) || "";
  } catch (e) {
    return "";
  }
}
function lsSet(k, v) {
  try {
    localStorage.setItem(k, v);
  } catch (e) {}
}
function lsDel(k) {
  try {
    localStorage.removeItem(k);
  } catch (e) {}
}
function lsJson(k, fallback = null) {
  try {
    const raw = localStorage.getItem(k);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) {
    return fallback;
  }
}
let hapticLv = HAPTIC_LV[lsGet(HAPTIC_LV_KEY)] ? lsGet(HAPTIC_LV_KEY) : "mid";
let hapticOn = lsGet(HAPTIC_KEY) !== "off",
  booted = false;
// 震動回饋：Android 用 navigator.vibrate；iPhone 的 Safari 不支援它，
// 改用 iOS 18 起的開關元件：點一下 <input type="checkbox" switch> 會有系統的輕觸震動
// （只有在手指點擊、滑動放開這類操作當下才會震，iOS 17 以前沒有效果）
let iosTick = null;
function iosHaptic() {
  try {
    if (!iosTick) {
      iosTick = document.createElement("label");
      iosTick.setAttribute("aria-hidden", "true");
      iosTick.style.cssText =
        "position:fixed;width:1px;height:1px;overflow:hidden;opacity:0;pointer-events:none;left:-9px;top:0";
      const sw = document.createElement("input");
      sw.type = "checkbox";
      sw.tabIndex = -1;
      sw.setAttribute("switch", "");
      iosTick.appendChild(sw);
      document.body.appendChild(iosTick);
    }
    iosTick.click();
  } catch (e) {}
}
let lastHaptic = 0;
function haptic(ms = 22) {
  if (!hapticOn) return;
  const now = Date.now();
  if (now - lastHaptic < 40) return;
  lastHaptic = now;
  try {
    const dur = Number.isFinite(ms) ? ms : 22;
    const [k, min] = HAPTIC_LV[hapticLv];
    if (navigator.vibrate) navigator.vibrate(Math.round(Math.max(dur * k, min)));
    else iosHaptic();
  } catch (e) {}
}
// 滑塊統一震動體感：導覽列（tabBar / subNav）、分段切換槽（.filter）、幸福指數（#hearts）共用
const SLIDER_TICK_MS = 20;
function sliderTick(force = false) {
  if (force) lastHaptic = 0;
  haptic(SLIDER_TICK_MS);
}
function sliderDragEndTick(changed) {
  if (changed && !navigator.vibrate) sliderTick(true);
}
function popFloat(el, ic = "💞") {
  haptic(25);
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const r = el && el.getBoundingClientRect ? el.getBoundingClientRect() : null;
  const x0 = r && r.width ? r.left + r.width / 2 : innerWidth / 2;
  const y0 = r && r.height ? r.top + r.height / 2 : innerHeight * 0.7;
  for (let i = 0; i < 6; i++) {
    const s = document.createElement("span");
    s.className = "float-pop";
    s.textContent = ic;
    s.style.left = x0 + (Math.random() * 44 - 22) + "px";
    s.style.top = y0 + (Math.random() * 16 - 8) + "px";
    s.style.setProperty("--dx", (Math.random() * 70 - 35).toFixed(1) + "px");
    s.style.setProperty("--dy", (-55 - Math.random() * 55).toFixed(1) + "px");
    document.body.append(s);
    setTimeout(() => s.remove(), 850);
  }
}

function dayOf(iso) {
  const d = new Date(iso);
  return isNaN(d) ? "" : key(d);
}
function addDays(d, n) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
function fromKey(k) {
  const [y, m, d] = String(k || "")
    .split("-")
    .map(Number);
  return y && m && d ? new Date(y, m - 1, d) : today();
}
function shortDate(k) {
  const [y, m, d] = String(k || "")
    .split("-")
    .map(Number);
  if (!y || !m || !d) return "";
  return y === today().getFullYear() ? `${m}/${d}` : `${y}/${m}/${d}`;
}
const byAt = (a, b) => String(a.at).localeCompare(String(b.at));
const nameOf = (n) => (n ? n + (n === myName() ? "（我）" : "") : "未署名");
const nowIso = () => new Date().toISOString();
const debounce = (fn, ms = 120) => {
  let t = 0;
  return () => {
    clearTimeout(t);
    t = setTimeout(fn, ms);
  };
};
let busyOps = 0,
  pendingWrites = 0;
function withBusy(fn) {
  busyOps++;
  return Promise.resolve()
    .then(fn)
    .finally(() => {
      busyOps = Math.max(0, busyOps - 1);
    });
}
window.addEventListener("beforeunload", (ev) => {
  if (
    busyOps > 0 ||
    (navigator.onLine && (pendingWrites > 0 || pendingSync.done || pendingSync.diary || pendingSync.photos))
  ) {
    ev.preventDefault();
    ev.returnValue = "";
  }
});
// 離線或學校弱網時，寫入已先進本機 IndexedDB 佇列；最多等 ms 毫秒就先放行畫面，背景繼續同步。
// 回傳 true 表示已在時限內寫上雲端，false 表示還在背景同步中；lastCommitP 保留真正的雲端寫入 Promise，供推播等待。
const QUEUED_HINT = "已先存在手機，請停留幾秒等上方出現 ✓ 再關掉喔";
let lastCommitP = Promise.resolve();
let lastCommitSynced = true;
const commit = (p, ms = 2500) => {
  pendingWrites++;
  updateSyncStatus();
  const tracked = Promise.resolve(p);
  lastCommitP = tracked;
  tracked
    .finally(() => {
      pendingWrites = Math.max(0, pendingWrites - 1);
      updateSyncStatus();
    })
    .catch(() => {});
  if (!navigator.onLine) {
    lastCommitSynced = false;
    tracked.catch(() => {});
    return Promise.resolve(false);
  }
  let settled = false;
  const done = tracked.then(
    () => {
      settled = true;
      return true;
    },
    (err) => {
      settled = true;
      throw err;
    },
  );
  return Promise.race([
    done,
    new Promise((res) =>
      setTimeout(() => {
        if (!settled) tracked.catch(() => {});
        res(false);
      }, ms),
    ),
  ]).then((ok) => {
    lastCommitSynced = !!ok;
    return !!ok;
  });
};
const saveToast = (okMsg, synced = lastCommitSynced) => (synced ? toast(okMsg) : toast(QUEUED_HINT, 4500));
const xRef = (c, id) => db.collection("done").doc(`x~${c}~${id}`);

// 先放進畫面再存：按下去馬上看到結果，存檔在背景進行；存失敗就從畫面拿掉並丟出錯誤
async function addDoc(c, data) {
  const id = db ? db.collection("done").doc().id : "l" + Date.now() + Math.random().toString(36).slice(2, 6);
  if (!store[c].find((x) => x.id === id)) store[c].push({ id, ...data });
  if (!db) saveLocal();
  renderAll();
  if (!db) return true;
  try {
    return await commit(xRef(c, id).set(data));
  } catch (e) {
    const i = store[c].findIndex((x) => x.id === id);
    if (i >= 0) store[c].splice(i, 1);
    renderAll();
    throw e;
  }
}
async function updDoc(c, id, data) {
  const w = store[c].find((x) => x.id === id);
  if (!w) return;
  const old = { ...w };
  Object.assign(w, data);
  renderAll();
  try {
    db ? await commit(xRef(c, id).update(data)) : saveLocal();
  } catch (e) {
    Object.assign(w, old);
    renderAll();
    toast(NOSAVE);
  }
}
const TRASH_DAYS = 30;
const trashMark = () => ({ at: nowIso(), by: myName() });
async function delDoc(c, id) {
  const item = store[c].find((x) => x.id === id);
  if (!item) return;
  const mark = trashMark();
  store[c] = store[c].filter((x) => x.id !== id);
  trash[c].push({ ...item, trashed: mark });
  renderAll();
  try {
    db ? await commit(xRef(c, id).update({ trashed: mark })) : saveLocal();
    trashedToast(c, id);
  } catch (e) {
    store[c].push(item);
    trash[c] = trash[c].filter((x) => x.id !== id);
    renderAll();
    toast("刪除失敗");
  }
}
function confirmTap(b, label, resetLabel = b.textContent, ms = 3000) {
  if (b.dataset.confirm) {
    delete b.dataset.confirm;
    b.textContent = typeof resetLabel === "function" ? resetLabel() : resetLabel;
    return true;
  }
  b.dataset.confirm = 1;
  b.textContent = label;
  setTimeout(() => {
    if (b.isConnected && b.dataset.confirm) {
      delete b.dataset.confirm;
      b.textContent = typeof resetLabel === "function" ? resetLabel() : resetLabel;
    }
  }, ms);
  return false;
}
function armDelete(box, c, fn = (id) => delDoc(c, id), label = "再按一次") {
  box.querySelectorAll(".del").forEach((b) => {
    b.onclick = () => {
      if (confirmTap(b, label, "刪除")) fn(b.dataset.id);
    };
  });
}

/* ===== 計分、稱號、連續天數與紀念日 ===== */
// 兩個人當天都有寫日記或傳照片才算連續，或用補簽卡補上的日子
function onTimeDays() {
  return [...dayRecords()].filter(([, r]) => r.onTime.size >= need()).map(([d]) => d);
}
function activeDays() {
  return new Set([...onTimeDays(), ...store.fixes.map((f) => f.day)]);
}
function streakBonus() {
  let bonus = 0,
    run = 0,
    prev = null;
  for (const d of [...activeDays()].map(fromKey).sort((a, b) => a - b)) {
    run = prev && key(addDays(prev, 1)) === key(d) ? run + 1 : 1;
    if (run % STREAK_STEP === 0) bonus += STREAK_BONUS;
    prev = d;
  }
  return bonus;
}
function renderStreak() {
  const a = activeDays(),
    t = today();
  let c = a.has(key(t)) ? t : addDays(t, -1),
    n = 0;
  while (a.has(key(c))) {
    n++;
    c = addDays(c, -1);
  }
  const cards = Math.floor(onTimeDays().length / STREAK_STEP) - store.fixes.length;
  // 一張卡補一天：手上的卡夠補滿整段空缺才能補
  const gap = [];
  let d = c;
  while (cards > 0 && gap.length < cards && !a.has(key(d))) {
    gap.push(d);
    d = addDays(d, -1);
  }
  const repair = gap.length > 0 && a.has(key(d)),
    md = (x) => `${x.getMonth() + 1}/${x.getDate()}`,
    tk = key(t),
    todayWho = new Set([
      ...(dayRecords().get(tk)?.onTime || []),
      ...photosOn(tk)
        .map((p) => p.by)
        .filter(Boolean),
    ]);
  $("streak").innerHTML =
    `<span>🔥 連續<span class="num">${n}</span>天</span><span class="muted">再 ${STREAK_STEP - (n % STREAK_STEP)}` +
    ` 天 +${STREAK_BONUS} XP</span><span>🎫 補簽卡 ${Math.max(0, cards)}` +
    ` 張</span><span class="muted">今日打卡：${NAMES.map((nm) => `${NAME_IC[nm]} ${nm} ${todayWho.has(nm) ? "✓" : "還沒"}`).join(" · ")}</span>` +
    `${repair ? `<button class="btn" type="button" id="fixBtn">補上 ${gap.length > 1 ? `${md(gap[gap.length - 1])}～${md(gap[0])}（用 ${gap.length} 張）` : md(c)}</button>` : ""}`;
  if (repair)
    $("fixBtn").onclick = async () => {
      try {
        for (const x of gap) await addDoc("fixes", { day: key(x), at: nowIso(), by: myName(), manual: true });
        toast("補簽成功 🎫");
      } catch (e) {
        toast(NOSAVE);
      }
    };
}

// 所有 XP 都要兩個人一起達成：日期 -> 誰寫了日記、誰傳了照片、誰當天就完成
let _dayRecs = null,
  _totalXP = null;
function dayRecords() {
  if (_dayRecs) return _dayRecs;
  const m = new Map(),
    get = (d) => {
      if (!m.has(d)) m.set(d, { diary: new Set(), photo: new Set(), onTime: new Set() });
      return m.get(d);
    };
  entries.forEach((e) => {
    if (!e.by) return;
    const r = get(e.date);
    r.diary.add(e.by);
    if (dayOf(e.at) === e.date) r.onTime.add(e.by);
  });
  store.wrote.forEach((w) => {
    if (!w.by) return;
    const r = get(w.date);
    r.diary.add(w.by);
    if (dayOf(w.at) === w.date) r.onTime.add(w.by);
  });
  store.bonus.forEach((b) => {
    if (!b.by) return;
    const r = get(b.date);
    r.photo.add(b.by);
    if (dayOf(b.at) === b.date) r.onTime.add(b.by);
  });
  _dayRecs = m;
  return m;
}
const whoDid = (r) => new Set([...r.diary, ...r.photo]);
function togetherDays() {
  return [...dayRecords()].filter(([, r]) => whoDid(r).size >= need()).map(([d]) => d);
}
function totalXP() {
  if (_totalXP !== null) return _totalXP;
  let xp = 0;
  for (const [d, r] of dayRecords()) {
    if (d < DIARY_XP_END && r.diary.size >= need()) xp += DIARY_XP;
    if (r.photo.size >= need()) xp += PHOTO_BONUS;
  }
  const reviews = new Map();
  store.reviews.forEach((r) => {
    if (!r.by) return;
    if (!reviews.has(r.date)) reviews.set(r.date, new Set());
    reviews.get(r.date).add(r.by);
  });
  for (const who of reviews.values()) if (who.size >= need()) xp += SUNDAY_TASK.xp;
  const passed = new Set(store.passed.map((p) => p.id));
  store.rounds.forEach((r) => {
    if (pairOf(r.id).length >= need()) passed.add(r.id);
  });
  xp += passed.size * DRAW_XP;
  _totalXP = xp + streakBonus();
  return _totalXP;
}

function nextAnniv() {
  const t = today(),
    m = LOVE_START.getMonth(),
    d = LOVE_START.getDate();
  let n = new Date(t.getFullYear(), m, d);
  if (n <= t) n = new Date(t.getFullYear() + 1, m, d);
  return n;
}
// 生日倒數：存在 done 的 x~birthdays~名字，只記月和日
function bdayOf(n) {
  return store.birthdays.find((b) => b.id === n);
}
function renderBdays() {
  const t = today();
  $("bdays").innerHTML = NAMES.map((n) => {
    const b = bdayOf(n);
    if (!b || !b.m || !b.d) return "";
    let nx = new Date(t.getFullYear(), b.m - 1, b.d);
    if (nx < t) nx = new Date(t.getFullYear() + 1, b.m - 1, b.d);
    const left = Math.round((nx - t) / 864e5),
      who = n === myName() ? "我" : n;
    return `<span>${left === 0 ? `🎂 今天是${who}的生日！` : `🎂 ${who}的生日還有 ${left} 天`}</span>`;
  }).join("");
  const f = $("bdayForm");
  if (f.contains(document.activeElement)) return;
  f.innerHTML = NAMES.map((n) => {
    const b = bdayOf(n) || {};
    return (
      `<div class="bday-row"><b>${esc(n)}</b><select data-bm="${esc(n)}" aria-label="${esc(n)}的生日月份">` +
      `<option value="">月</option>${[...Array(12)].map((_, i) => `<option value="${i + 1}" ${b.m === i + 1 ? "selected" : ""}>${i + 1} 月</option>`).join("")}` +
      `</select><select data-bd="${esc(n)}" aria-label="${esc(n)}的生日日期">` +
      `<option value="">日</option>${[...Array(31)].map((_, i) => `<option value="${i + 1}" ${b.d === i + 1 ? "selected" : ""}>${i + 1} 日</option>`).join("")}` +
      `</select></div>`
    );
  }).join("");
  f.querySelectorAll("select").forEach((sel) => (sel.onchange = () => saveBday(sel.dataset.bm || sel.dataset.bd)));
}
async function saveBday(n) {
  const m = Number(document.querySelector(`[data-bm="${n}"]`).value),
    d = Number(document.querySelector(`[data-bd="${n}"]`).value);
  if (!m || !d) return;
  if (new Date(2024, m - 1, d).getMonth() !== m - 1) {
    toast(`${m} 月沒有 ${d} 日`);
    return;
  }
  const doc = { m, d, by: myName(), at: nowIso() };
  store.birthdays = store.birthdays.filter((b) => b.id !== n).concat([{ id: n, ...doc }]);
  try {
    if (db) await commit(xRef("birthdays", n).set(doc));
    else saveLocal();
    toast(`${n}的生日記好了 🎂`);
  } catch (e) {
    toast(NOSAVE);
  }
  document.activeElement && document.activeElement.blur();
  renderBdays();
}
function renderAnniv() {
  const t = today(),
    left = Math.round((nextAnniv() - t) / 864e5),
    n = Math.round((t - LOVE_START) / 864e5) + 1;
  const isDay = t > LOVE_START && t.getMonth() === LOVE_START.getMonth() && t.getDate() === LOVE_START.getDate();
  const special = [30, 50, 100, 200, 300, 500, 520, 600, 700, 800, 900, 1000, 1314];
  const isMile = special.includes(n) || (n >= 100 && n % 100 === 0);
  $("anniv").innerHTML =
    (isDay
      ? `🎉 今天是我們的 ${t.getFullYear() - LOVE_START.getFullYear()} 週年！`
      : isMile
        ? `🎉 今天是在一起第<span class="num">${n}</span>天紀念日！`
        : `💝 在一起第<span class="num">${n}</span>天`) +
    `<span class="left">距離 ${LOVE_START.getMonth() + 1}/${LOVE_START.getDate()} 週年還有 ${left} 天</span>`;
}

function renderHUD() {
  renderAnniv();
  renderBdays();
  const xp = totalXP();
  $("xp").textContent = xp;
  let cur = null,
    next = TITLES[0],
    prev = 0;
  for (const t of TITLES) {
    if (xp >= t[0]) {
      cur = t;
      prev = t[0];
    } else {
      next = t;
      break;
    }
  }
  if (cur && cur === TITLES[TITLES.length - 1]) next = null;
  $("curTitle").textContent = cur ? cur[1] : "尚未解鎖";
  if (next) {
    $("nextText").textContent = `再 ${next[0] - xp} XP 解鎖「${next[1]}」`;
    $("barFill").style.width = Math.max(3, ((xp - prev) / (next[0] - prev)) * 100) + "%";
  } else {
    $("nextText").textContent = "已經滿等了，繼續累積回憶吧！";
    $("barFill").style.width = "100%";
  }
  const shownTitle = cur || TITLES[0];
  const rung = ([n, name], st) =>
    `<div class="rung ${xp >= n ? "on" : ""}"><span class="need num">${n} XP</span><span class="name">${name}</span>` +
    `<span class="st">${st || (xp >= n ? "已解鎖" : "未解鎖")}</span></div>`;
  $("ladderList").innerHTML = rung(shownTitle, cur ? "最近達成" : "下一個");
  $("ladderRest").innerHTML = TITLES.filter((t) => t !== shownTitle)
    .map((t) => rung(t))
    .join("");
  $("ladderN").textContent = `${TITLES.length - 1} 個`;
}

function renderQuests() {
  const t = today(),
    tk = key(t),
    ti = dow(t),
    task = SUNDAY_TASK,
    revs = store.reviews.filter((r) => r.date === tk).sort(byAt),
    myRev = revs.find((r) => r.by === myName()),
    both = new Set(revs.map((r) => r.by)).size >= need();
  $("todayBox").hidden = ti !== 6;
  if (ti === 6) renderWeekRecap(t);
  $("todayCard").innerHTML =
    `<div class="tag">今天 · 星期${task.day}</div><h3>${esc(task.name)}` +
    ` <span class="xpchip num" style="font-size:16px">+${task.xp} XP</span></h3><p>${esc(task.text)}` +
    `</p>
  <div class="done-line">${both ? "✓ 兩個人都寫好了" : myRev ? "你寫好了，等對方" : `兩個人都寫好 +${task.xp} XP`}</div>`;
  $("reviewList").innerHTML = revs
    .map(
      (r) =>
        `<div class="rev-row"><span><b>${esc(nameOf(r.by))}</b>${esc(r.text)}</span>` +
        `${r.by === myName() ? `<button type="button" class="btn ghost small ans-edit" id="reviewEdit">${reviewEditing ? "✕ 取消修改" : "✏️ 修改回顧"}</button>` : ""}</div>`,
    )
    .join("");
  $("reviewForm").hidden = !!myRev && !reviewEditing;
  if (!myRev && !reviewEditing && document.activeElement !== $("reviewText") && !$("reviewText").value) {
    const rd = lsJson(REV_DRAFT_KEY);
    if (rd && rd.date === tk && rd.text) {
      $("reviewText").value = rd.text;
      grow($("reviewText"));
    }
  }
  if (myRev)
    $("reviewEdit").onclick = () => {
      reviewEditing = !reviewEditing;
      renderQuests();
      if (reviewEditing) {
        $("reviewText").value = myRev.text;
        grow($("reviewText"));
        $("reviewText").focus();
      } else {
        $("reviewText").value = "";
        grow($("reviewText"));
      }
    };
  renderTodayPhotos();
}

/* ===== 生活紀錄照片 =====
   photos/{日期_名字}：縮圖 th + 說明（列表用，檔案小）
   pics/{日期_名字}：原圖 img（點開才載入） */
let photos = [],
  photoLimit = 30,
  photoUnsub = null,
  photoErr = "",
  uploading = null,
  uploadingProg = "",
  pendingDate = null;
function photosOn(d) {
  return photos.filter((p) => p.date === d && !p.entry);
}
const DAY_PH_MAX = 9;
function myPhotos(d) {
  const main = d + "_" + myName();
  return photos
    .filter((p) => p.date === d && p.by === myName() && !p.entry)
    .sort((a, b) => (b.id === main) - (a.id === main) || String(a.at).localeCompare(String(b.at)));
}
function myPhoto(d) {
  return myPhotos(d)[0];
}
function photoBtn(p, cls, editable = false, eager = false) {
  const editBadge = editable
    ? `<span class="ph-edit" role="button" tabindex="0" data-capedit="${esc(p.id)}" aria-label="${p.cap ? "修改這張照片的一句話" : "幫這張照片寫一句話"}" title="${p.cap ? "改這句話" : "寫一句話"}">${p.cap ? "💬" : "✏️"}</span>`
    : "";
  return (
    `<button type="button" class="${cls}" data-open="${esc(p.id)}" aria-label="${esc(p.by)} 的照片${p.cap ? "：" + esc(p.cap) : ""}"><img src="${p.th}` +
    `" alt="" loading="${eager ? "eager" : "lazy"}" decoding="async"><span class="nm">${esc(p.by)}${p.by === myName() ? "（我）" : ""}${!editable && p.cap ? " 💬" : ""}</span>${editBadge}</button>`
  );
}
let phWho = "other"; // 今天的照片正在看誰的：other（對方，預設）／mine
let phSegI = 0; // 切換鈕膠囊上次停的位置，重畫時從那裡滑過去
// 看過哪些對方今天的照片：停在「我」的畫面時，對方傳了新的，切換鈕上會亮小紅點
const PH_SEEN_KEY = "love-base-ph-seen";
function phSeen(k) {
  const d = lsJson(PH_SEEN_KEY);
  return d && d.date === k && Array.isArray(d.ids) ? d.ids : [];
}
function renderTodayPhotos() {
  const t = today(),
    k = key(t),
    box = $("todayPhotos"),
    mineAll = myPhotos(k),
    mine = mineAll[0];
  if (capEditing && !mineAll.some((p) => p.id === capEditing)) capEditing = "";
  $("photoCapForm").hidden = !db || !!photoErr || !capEditing;
  if (!db) {
    box.innerHTML = '<div class="ph-note">📸 要連上伺服器才能上傳照片。</div>';
    return;
  }
  if (photoErr === "rules") {
    box.innerHTML = '<div class="ph-note">📸 照片功能還沒開通：要先到 Firebase 更新一次「規則」。</div>';
    return;
  }
  const others = photosOn(k).filter((p) => p.by !== myName()),
    up = uploading === k,
    upText = uploadingProg ? `上傳中 ${uploadingProg}…` : "上傳中…";
  // 一次看一個人的照片：先看對方的，左上角切換「對方／我」；照片排成可以左右滑的大圖
  // 今天的照片不要等「看得到才載入」：兩邊都先載好，切換時照片馬上出現
  const mineBtn = (p) => photoBtn(p, "ph-slot has" + (capEditing === p.id ? " editing" : ""), true, true),
    otherBtn = (p) => photoBtn(p, "ph-slot has", false, true),
    uploadBtn = (cls, label) =>
      `<button type="button" class="${cls}" data-up="${k}" ${up ? "disabled" : ""}>${up ? upText : label}</button>`,
    partner = NAMES.find((n) => n !== myName()) || "對方";
  if (capEditing || up) phWho = "mine";
  const seen = phSeen(k),
    fresh = others.some((p) => !seen.includes(p.id)),
    tab = (who, label, n) =>
      `<button type="button" role="tab" data-who="${who}"${who === "other" && fresh ? ' class="fresh"' : ""}>` +
      `${label}<span class="n">${n}</span></button>`,
    dotsOf = (list, who) =>
      list.length > 1
        ? `<div class="ph-dots" data-pane="${who}" aria-hidden="true">${list.map((_, i) => `<i${i ? "" : ' class="on"'}></i>`).join("")}</div>`
        : "";
  // 兩個人的照片一次都畫好，切換時只換顯示哪一邊，不用重畫、照片不用重新解碼，按下去馬上換
  let h =
    `<div class="ph-stage"><div class="ph-who" role="tablist" aria-label="看誰的照片">` +
    tab("other", esc(nameOf(partner)), others.length) +
    tab("mine", "我", mineAll.length) +
    `</div>` +
    `<div class="ph-big${others.length > 1 ? " multi" : ""}" data-pane="other">` +
    (others.length
      ? others.map(otherBtn).join("")
      : `<div class="ph-slot wait">${esc(nameOf(partner))}今天還沒上傳<br><small>${mine ? "你已經傳了，等等對方吧" : "先傳你的吧 ↓"}</small></div>`) +
    `</div><div class="ph-big${mineAll.length > 1 ? " multi" : ""}" data-pane="mine">` +
    (mine
      ? mineAll.map(mineBtn).join("")
      : uploadBtn("ph-slot", "📸<br>上傳我的照片<br><small>可以一次選很多張</small>")) +
    `</div></div>` +
    dotsOf(others, "other") +
    dotsOf(mineAll, "mine");
  // 看對方的照片時，如果我今天還沒傳，下面直接給上傳按鈕，不用先切到「我」
  if (!mine) h += `<div class="row" data-pane="other">${uploadBtn("btn", "📸 上傳我的照片")}</div>`;
  else
    h +=
      mineAll.length < DAY_PH_MAX
        ? `<div class="row ph-acts" data-pane="mine">${uploadBtn("btn", "＋ 再加照片")}</div>`
        : "";
  const allCaps = [...mineAll, ...others].filter((p) => p.cap);
  if (allCaps.length)
    h += allCaps.map((p) => `<div class="ph-note">${esc(nameOf(p.by))}：「${esc(p.cap)}」</div>`).join("");
  box.innerHTML = h;
  const seg = box.querySelector(".ph-who"),
    tabs = [...seg.querySelectorAll("[data-who]")],
    segSel = (i) => tabs.forEach((b, j) => b.setAttribute("aria-selected", String(i === j)));
  // 切換看誰：只改顯示哪一邊、膠囊位置和選取狀態
  const show = (who, from) => {
    phWho = who;
    box.dataset.showing = who;
    const i = who === "mine" ? 1 : 0;
    segSel(i);
    seg.style.setProperty("--i", i);
    phSegI = i;
    // 只有真的在日記頁看到對方的照片才算看過（在別頁背景重畫不算）
    if (who === "other" && others.length && view === "quests" && !document.hidden) {
      lsSet(PH_SEEN_KEY, JSON.stringify({ date: k, ids: others.map((p) => p.id) }));
      const f = seg.querySelector(".fresh");
      if (f) f.classList.remove("fresh");
    }
    if (from) {
      const nb = box.querySelector(`.ph-big[data-pane="${who}"]`);
      if (from === "end") nb.scrollLeft = nb.scrollWidth;
      nb.classList.remove("from-r", "from-l");
      void nb.offsetWidth;
      nb.classList.add(from === "end" ? "from-l" : "from-r");
    }
  };
  // 先放在上次的位置、強制排版一次，再移到新位置，膠囊才會滑過去而不是直接跳
  const wantI = phWho === "mine" ? 1 : 0;
  seg.style.setProperty("--i", phSegI);
  if (wantI !== phSegI) void seg.offsetWidth; // 位置沒變就不用強制排版
  show(phWho);
  const go = (who, from) => {
    if (who === phWho) return;
    sliderTick();
    show(who, from);
  };
  box.querySelectorAll(".ph-big").forEach((strip) => {
    const pane = strip.dataset.pane,
      dots = box.querySelectorAll(`.ph-dots[data-pane="${pane}"] i`);
    // 在照片上左右滑：滑到這個人的最後一張再往前滑，就換看另一個人（只有一張時直接換）
    let tx = null,
      ty = 0,
      tl = 0;
    strip.addEventListener(
      "touchstart",
      (ev) => {
        tx = ev.touches.length === 1 ? ev.touches[0].clientX : null;
        ty = tx === null ? 0 : ev.touches[0].clientY;
        tl = strip.scrollLeft;
      },
      { passive: true },
    );
    strip.addEventListener(
      "touchend",
      (ev) => {
        if (tx === null) return;
        const t = ev.changedTouches[0],
          dx = t.clientX - tx,
          dy = t.clientY - ty,
          max = strip.scrollWidth - strip.clientWidth;
        tx = null;
        if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy) * 1.5 || capEditing || up) return;
        if (dx < 0 && pane === "other" && tl >= max - 4) go("mine", "start");
        else if (dx > 0 && pane === "mine" && tl <= 4) go("other", "end");
      },
      { passive: true },
    );
    if (dots.length)
      strip.onscroll = () => {
        const tile = strip.firstElementChild,
          step = tile ? tile.offsetWidth + 10 : 1,
          m = strip.scrollWidth - strip.clientWidth,
          i = strip.scrollLeft >= m - 4 ? dots.length - 1 : Math.round(strip.scrollLeft / step);
        dots.forEach((d, j) => d.classList.toggle("on", j === i));
      };
  });
  // 「對方｜我」切換鈕：點一下切換，也可以按住粉紅膠囊左右拖
  let segRect = null,
    segIdx = 0,
    segDragged = 0;
  seg.addEventListener(
    "touchstart",
    () => {
      segRect = seg.getBoundingClientRect();
      segIdx = phWho === "mine" ? 1 : 0;
    },
    { passive: true },
  );
  seg.addEventListener(
    "touchmove",
    (ev) => {
      const t = ev.touches[0];
      if (!t || !segRect) return;
      ev.preventDefault();
      const w = (segRect.width - 6) / 2,
        pos = Math.max(0, Math.min(1, (t.clientX - segRect.left - 3 - w / 2) / w)),
        idx = Math.round(pos);
      seg.classList.add("dragging");
      seg.style.setProperty("--i", pos.toFixed(3));
      // 拖過中間就直接換照片，不用等放開
      if (idx !== segIdx) {
        segIdx = idx;
        go(idx ? "mine" : "other");
        seg.style.setProperty("--i", pos.toFixed(3));
      }
    },
    { passive: false },
  );
  const segEnd = () => {
    if (!segRect) return;
    segRect = null;
    if (!seg.classList.contains("dragging")) return;
    seg.classList.remove("dragging");
    segDragged = Date.now();
    seg.style.setProperty("--i", segIdx);
  };
  seg.addEventListener("touchend", segEnd, { passive: true });
  seg.addEventListener("touchcancel", segEnd, { passive: true });
  tabs.forEach(
    (b) =>
      (b.onclick = () => {
        if (Date.now() - segDragged < 500) return;
        go(b.dataset.who);
      }),
  );
  box.querySelectorAll("[data-capedit]").forEach((b) => {
    const toggle = (ev) => {
      ev.stopPropagation();
      ev.preventDefault();
      const id = b.dataset.capedit,
        target = mineAll.find((p) => p.id === id);
      if (!target) return;
      capEditing = capEditing === id ? "" : id;
      renderTodayPhotos();
      if (capEditing) {
        const c = $("photoCap");
        c.value = target.cap || "";
        c.focus();
      }
    };
    b.onclick = toggle;
    b.onkeydown = (ev) => {
      if (ev.key === "Enter" || ev.key === " ") toggle(ev);
    };
  });
}
let wallHtml = "";
function renderWall() {
  const w = $("wall");
  if (!db) {
    w.innerHTML = '<div class="empty">要連上伺服器才看得到照片。</div>';
    $("wallMore").hidden = true;
    return;
  }
  if (photoErr === "rules") {
    w.innerHTML = '<div class="empty">照片功能還沒開通：要先到 Firebase 更新一次「規則」。</div>';
    $("wallMore").hidden = true;
    return;
  }
  if (!photos.length) {
    w.innerHTML = '<div class="empty">還沒有照片。在上面的每日任務上傳第一張吧！</div>';
    $("wallMore").hidden = true;
    return;
  }
  const byDay = new Map();
  photos.forEach((p) => {
    if (!byDay.has(p.date)) byDay.set(p.date, []);
    byDay.get(p.date).push(p);
  });
  const days = [...byDay.keys()].sort().reverse();
  const wk = "日一二三四五六";
  const html = days
    .map((d) => {
      const [y, m, dd] = d.split("-").map(Number);
      const dt = new Date(y, m - 1, dd);
      const head = shortDate(d) || `${m}/${dd}`;
      return (
        `<div class="wall-day"><h3>${head}（${wk[dt.getDay()]}）</h3>` +
        `<div class="wall-grid">${byDay
          .get(d)
          .map((p) => photoBtn(p, ""))
          .join("")}</div></div>`
      );
    })
    .join("");
  // 資料每變動一次就會整個重畫；照片沒變時不重設，避免每張照片重新解碼造成捲動卡頓
  if (wallHtml !== html || !w.firstElementChild?.classList.contains("wall-day")) {
    w.innerHTML = html;
    wallHtml = html;
  }
  $("wallMore").hidden = photos.length < photoLimit;
}

function loadImg(file) {
  return new Promise((res, rej) => {
    if (typeof createImageBitmap === "function") {
      createImageBitmap(file)
        .then((bm) => res({ im: bm, url: "", close: () => bm.close && bm.close() }))
        .catch(() => loadImgTag(file).then(res, rej));
      return;
    }
    loadImgTag(file).then(res, rej);
  });
}
function loadImgTag(file) {
  return new Promise((res, rej) => {
    const url = URL.createObjectURL(file);
    const im = new Image();
    im.onload = () => res({ im, url, close: () => URL.revokeObjectURL(url) });
    im.onerror = () => {
      URL.revokeObjectURL(url);
      rej(new Error("decode"));
    };
    im.src = url;
  });
}
// 讓出一個畫面更新時機，避免連續處理多張照片時畫面短暫凍住（背景分頁時最多等 32ms）
function yieldFrame() {
  return new Promise((res) => {
    let done = false;
    const go = () => {
      if (done) return;
      done = true;
      res();
    };
    if (typeof requestAnimationFrame === "function") requestAnimationFrame(go);
    setTimeout(go, 32);
  });
}
// 優先用非同步 toBlob 讓瀏覽器在背景執行緒壓縮 JPEG，不支援時再退回 toDataURL
function canvasToDataUrl(c, q) {
  if (typeof c.toBlob !== "function") return Promise.resolve(c.toDataURL("image/jpeg", q));
  return new Promise((res) => {
    c.toBlob(
      (blob) => {
        if (!blob) {
          res(c.toDataURL("image/jpeg", q));
          return;
        }
        const r = new FileReader();
        r.onload = () => res(typeof r.result === "string" ? r.result : c.toDataURL("image/jpeg", q));
        r.onerror = () => res(c.toDataURL("image/jpeg", q));
        r.readAsDataURL(blob);
      },
      "image/jpeg",
      q,
    );
  });
}
async function shrink(im, side, maxLen, q) {
  const iw = im.naturalWidth || im.width,
    ih = im.naturalHeight || im.height;
  const c = document.createElement("canvas"),
    ctx = c.getContext("2d");
  let out = "";
  for (let n = 0; n < 10; n++) {
    const s = Math.min(1, side / Math.max(iw, ih));
    const w = Math.max(1, Math.round(iw * s)),
      h = Math.max(1, Math.round(ih * s));
    c.width = w;
    c.height = h;
    ctx.drawImage(im, 0, 0, w, h);
    out = await canvasToDataUrl(c, q);
    if (out.length <= maxLen) break;
    if (q > 0.55) q -= 0.1;
    else side *= 0.8;
    await yieldFrame();
  }
  c.width = c.height = 0;
  return out;
}
$("wallMore").onclick = () => {
  photoLimit += 30;
  subPhotos();
};
// 長按照片（約半秒）直接存原圖到手機，不用先點開大圖；手指移動、放開或開始滑動（pointercancel）就取消
let lpTimer = 0,
  lpXY = null,
  lpFired = 0;
const lpCancel = () => {
  clearTimeout(lpTimer);
  lpTimer = 0;
  lpXY = null;
};
document.addEventListener("pointerdown", (ev) => {
  // 只給手機觸控用：電腦上按住滑鼠不要下載
  const o = ev.pointerType !== "mouse" && ev.button === 0 && ev.target.closest("[data-open]");
  lpCancel();
  if (!o || ev.target.closest("[data-capedit]")) return;
  lpXY = [ev.clientX, ev.clientY];
  lpTimer = setTimeout(async () => {
    lpTimer = 0;
    lpFired = Date.now();
    if (navigator.vibrate) navigator.vibrate(15);
    o.classList.add("saving");
    toast("存照片中…", 1500);
    try {
      const f = await photoFile(o.dataset.open);
      if (!f) throw new Error("no photo");
      downloadBlob(f.name, f.blob);
      toast("存好了 ⬇️");
    } catch (e) {
      toast("存不了，點開大圖再按「下載」試試");
    } finally {
      o.classList.remove("saving");
    }
  }, 550);
});
document.addEventListener("pointermove", (ev) => {
  if (lpXY && Math.hypot(ev.clientX - lpXY[0], ev.clientY - lpXY[1]) > 10) lpCancel();
});
["pointerup", "pointercancel"].forEach((t) => document.addEventListener(t, lpCancel, true));
// 長按存完照片後放開手指，不要又順便打開大圖
document.addEventListener(
  "click",
  (ev) => {
    if (lpFired && Date.now() - lpFired < 800 && ev.target.closest("[data-open]")) {
      lpFired = 0;
      ev.stopPropagation();
      ev.preventDefault();
    }
  },
  true,
);
// 照片上不要跳出瀏覽器自己的長按選單（那個只會存到小縮圖）
document.addEventListener("contextmenu", (ev) => {
  if (ev.target.closest("[data-open]")) ev.preventDefault();
});
document.addEventListener("click", (ev) => {
  const u = ev.target.closest("[data-up]");
  if (u && !u.disabled) {
    if (!db || photoErr || uploading) return;
    pendingDate = u.dataset.up;
    $("photoFile").multiple = true;
    $("photoFile").value = "";
    $("photoFile").click();
    return;
  }
  const o = ev.target.closest("[data-open]");
  if (o) {
    const box = o.closest("#wall") || o.closest(".wall-grid,.ph-pair,.ph-big") || o.parentElement;
    openPhoto(
      o.dataset.open,
      [...box.querySelectorAll("[data-open]")].map((x) => x.dataset.open),
    );
  }
});
// 上傳一張照片（每日照片和日記照片共用）：壓縮後存原圖到 pics、縮圖和說明到 photos
// opt.id 不給就用「日期_名字_亂數」；opt.entry 是所屬日記
const newPhotoId = (date) => `${date}_${myName()}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
async function savePhoto(file, date, opt = {}) {
  const { im, url, close } = await loadImg(file);
  const img = await shrinkFull(im);
  await yieldFrame();
  const th = await shrinkThumb(im);
  if (close) close();
  else if (url) URL.revokeObjectURL(url);
  const id = opt.id || newPhotoId(date);
  const meta = { date, by: myName(), th, cap: "", at: nowIso() };
  if (opt.entry) meta.entry = opt.entry;
  // 同時寫入原圖、縮圖與每日打卡紀錄，確保弱網下 0.2 秒內全部鎖進本機離線佇列
  const pPic = db.collection("pics").doc(id).set({ img, date, by: myName() });
  const pMeta = db.collection("photos").doc(id).set(meta);
  picCache.set(id, img);
  const item = { id, ...meta };
  photos = photos.filter((p) => p.id !== id).concat([item]);
  calPhotos = calPhotos.filter((p) => p.id !== id).concat([item]);
  const writeP = Promise.all([pPic, pMeta]);
  // 照片已經在畫面上了，不等伺服器回覆；呼叫的地方用 _commit 在背景確認有沒有存到
  item._writeP = writeP;
  item._commit = commit(writeP, 5000);
  return item;
}
// 背景確認一批照片有沒有存到：沒存成功的從畫面拿掉並提示，存在手機還沒上傳的提醒一下
function settlePhotos(items, errMsg) {
  return Promise.all(
    items.map((it) =>
      it._commit.then(
        (synced) => ({ it, synced }),
        (e) => ({ it, e }),
      ),
    ),
  ).then((rs) => {
    const bad = rs.filter((r) => r.e);
    if (bad.length) {
      const ids = new Set(bad.map((r) => r.it.id));
      photos = photos.filter((p) => !ids.has(p.id));
      calPhotos = calPhotos.filter((p) => !ids.has(p.id));
      ids.forEach((id) => picCache.delete(id));
      toast(errMsg(bad[0].e));
      renderAll();
    } else if (rs.some((r) => !r.synced) && navigator.onLine) toast(QUEUED_HINT, 4500);
    updateSyncStatus();
    return rs.length - bad.length;
  });
}
function photoErrMsg(e) {
  if (e && e.code === "permission-denied") return "照片功能還沒開通，要先更新 Firebase 規則";
  if (e && e.message === "decode") return "有照片讀不到，換一張試試";
  return "有照片上傳失敗，請再試一次";
}
$("photoFile").addEventListener("change", async () => {
  const date = pendingDate;
  let files = pickFiles($("photoFile").files || [], 99);
  if (!files.length || !date) return;
  if (!myName()) {
    toast("請先登出再選你是誰");
    return;
  }
  const mainId = date + "_" + myName(),
    hasMain = myPhotos(date).some((p) => p.id === mainId);
  const room = DAY_PH_MAX - myPhotos(date).length;
  if (files.length > room) {
    files = files.slice(0, Math.max(0, room));
    toast(`一天最多 ${DAY_PH_MAX} 張，只放前 ${files.length} 張`);
  }
  if (!files.length) return;
  uploading = date;
  uploadingProg = files.length > 1 ? `1 / ${files.length}` : "";
  renderAll();
  const earned = !store.bonus.some((b) => b.id === mainId),
    partner = store.bonus.some((b) => b.date === date && b.by !== myName());
  if (earned) {
    const doc = { date, xp: PHOTO_BONUS, by: myName(), at: nowIso() };
    store.bonus.push({ id: mainId, ...doc });
    xRef("bonus", mainId)
      .set(doc)
      .catch(() => {});
  }
  let ok = 0,
    msg = "";
  const writePs = [],
    savedList = [];
  await withBusy(async () => {
    for (let i = 0; i < files.length; i++) {
      if (files.length > 1) {
        uploadingProg = `${i + 1} / ${files.length}`;
        renderTodayPhotos();
      }
      try {
        // 第一張用固定的 id（日期_名字），其他張加亂數
        const saved = await savePhoto(files[i], date, !hasMain && i === 0 ? { id: mainId } : {});
        writePs.push(saved._writeP);
        savedList.push(saved);
        ok++;
        if (i < files.length - 1) renderAll();
      } catch (e) {
        msg = photoErrMsg(e);
      }
    }
  });
  uploading = null;
  uploadingProg = "";
  updateSyncStatus();
  if (ok) {
    const n = ok > 1 ? `${ok} 張照片` : "照片";
    const okMsg =
      msg ||
      (earned && partner
        ? `兩個人都傳了！+${PHOTO_BONUS} XP 📸`
        : earned
          ? `${n}上傳好了 📸 等對方也傳就 +${PHOTO_BONUS} XP`
          : `${n}上傳好了 📸`);
    lastCommitSynced = navigator.onLine;
    saveToast(okMsg);
    settlePhotos(savedList, photoErrMsg);
    notifyPartner(
      "📷 今日照片",
      `${myName()}傳了${ok > 1 ? ` ${ok} 張` : ""}今天的照片`,
      "#quests",
      "photo-" + date,
      Promise.all(writePs),
    );
  } else if (msg) toast(msg);
  renderAll();
});
let lbId = null,
  lbList = [],
  lbFull = "",
  lbBaseCount = "",
  lbSlowTimer = 0;
const picCache = new Map();
function fetchPicImg(id) {
  if (picCache.has(id)) return Promise.resolve(picCache.get(id));
  if (!db) return Promise.resolve("");
  return db
    .collection("pics")
    .doc(id)
    .get()
    .then((s) => {
      const img = (s.exists && s.data()?.img) || "";
      if (img) {
        if (picCache.size >= 24) picCache.delete(picCache.keys().next().value);
        picCache.set(id, img);
      }
      return img;
    });
}
function preloadAdjPics(id) {
  if (!navigator.onLine || lbId !== id) return;
  const i = lbList.indexOf(id);
  const adj = [lbList[i + 1], lbList[i - 1]].filter((x) => x && !picCache.has(x));
  (async () => {
    for (const nextId of adj) {
      if (lbId !== id || !navigator.onLine) break;
      await fetchPicImg(nextId).catch(() => {});
    }
  })();
}
function loadLbFull(id) {
  clearTimeout(lbSlowTimer);
  $("lbRetry").hidden = true;
  $("lbCount").textContent = (lbBaseCount ? lbBaseCount + " · " : "") + "讀取高畫質原圖…";
  lbSlowTimer = setTimeout(() => {
    if (lbId !== id || lbFull) return;
    $("lbCount").textContent = (lbBaseCount ? lbBaseCount + " · " : "") + "網路較慢，仍在讀取原圖…";
    $("lbRetry").hidden = false;
  }, 6000);
  fetchPicImg(id)
    .then((img) => {
      clearTimeout(lbSlowTimer);
      if (lbId !== id) return;
      if (img) {
        lbFull = img;
        $("lbImg").src = img;
      }
      $("lbRetry").hidden = true;
      $("lbCount").textContent = lbBaseCount;
      preloadAdjPics(id);
    })
    .catch(() => {
      clearTimeout(lbSlowTimer);
      if (lbId !== id) return;
      $("lbCount").textContent = (lbBaseCount ? lbBaseCount + " · " : "") + "原圖沒載到，先顯示縮圖";
      $("lbRetry").hidden = false;
    });
}
// list：同一組照片的 id，可以左右切換
function openPhoto(id, list) {
  const p = calAllPhotos().find((x) => x.id === id);
  if (!p) return;
  clearTimeout(lbSlowTimer);
  lbId = id;
  const cached = picCache.get(id) || "";
  lbFull = cached;
  if (list) lbList = list.filter((i) => calAllPhotos().some((x) => x.id === i));
  if (!lbList.includes(id)) lbList = [id];
  const i = lbList.indexOf(id),
    many = lbList.length > 1;
  lbBaseCount = many ? `${i + 1} / ${lbList.length}` : "";
  $("lbCount").textContent = lbBaseCount;
  $("lbRetry").hidden = true;
  $("lbPrev").hidden = !many || i === 0;
  $("lbNext").hidden = !many || i === lbList.length - 1;
  $("lbImg").src = cached || p.th;
  $("lbImg").alt = p.by + " 的照片";
  lbResetZoom();
  const sd = shortDate(p.date),
    mine = p.by === myName();
  $("lbCap").textContent = `${sd ? sd + " · " : ""}${p.by}${mine ? "（我）" : ""}${p.cap ? "\n「" + p.cap + "」" : ""}`;
  $("lbCapForm").hidden = true;
  $("lbCapEdit").hidden = !mine;
  $("lbCapEdit").textContent = p.cap ? "✏️ 改這句話" : "✏️ 寫一句話";
  const hasDate = /^\d{4}-\d{2}-\d{2}$/.test(String(p.date || ""));
  $("lbDay").hidden = !hasDate || (view === "calendar" && calDay === p.date);
  const del = $("lbDel");
  del.hidden = !mine;
  delete del.dataset.confirm;
  del.textContent = "刪除這張";
  $("lbShare").hidden = !canShareFiles();
  if ($("lightbox").hidden) history.pushState({ lb: 1 }, "", location.hash);
  $("lightbox").hidden = false;
  document.documentElement.classList.add("lb-lock");
  if (cached) preloadAdjPics(id);
  else loadLbFull(id);
}
$("lbRetry").onclick = () => {
  if (lbId && !lbFull) loadLbFull(lbId);
};
function lbStep(n) {
  const i = lbList.indexOf(lbId) + n;
  if (i >= 0 && i < lbList.length) {
    sliderTick();
    openPhoto(lbList[i]);
    return true;
  }
  return false;
}
$("lbPrev").onclick = () => lbStep(-1);
$("lbNext").onclick = () => lbStep(1);
// 大圖手勢：雙指捏合縮放、連點兩下放大／還原、放大時單指拖曳視角、未放大時左右滑換張與下滑關閉
let lbResetZoom = () => {};
(() => {
  let mode = "",
    x0 = null,
    y0 = 0,
    dx = 0,
    dy = 0,
    axis = "",
    raf = 0,
    zScale = 1,
    zX = 0,
    zY = 0,
    pDist = 0,
    pMidX = 0,
    pMidY = 0,
    pScale = 1,
    pX = 0,
    pY = 0,
    cx0 = 0,
    cy0 = 0,
    lastTap = 0,
    tapX = 0,
    tapY = 0,
    moved = false;
  const im = $("lbImg"),
    stage = document.querySelector("#lightbox .stage");
  function clampPan(x, y, s) {
    if (s <= 1) return [0, 0];
    const mx = Math.max(0, (im.offsetWidth * (s - 1)) / 2),
      my = Math.max(0, (im.offsetHeight * (s - 1)) / 2);
    return [Math.max(-mx, Math.min(mx, x)), Math.max(-my, Math.min(my, y))];
  }
  function applyZoom(animate) {
    im.style.transition = animate ? "transform .22s cubic-bezier(.22,1,.36,1),opacity .2s ease" : "none";
    im.style.opacity = "";
    im.style.cursor = zScale > 1 ? "grab" : "";
    im.style.transform =
      zScale > 1 ? `translate3d(${zX.toFixed(1)}px,${zY.toFixed(1)}px,0) scale(${zScale.toFixed(3)})` : "";
  }
  lbResetZoom = () => {
    mode = "";
    x0 = null;
    zScale = 1;
    zX = zY = 0;
    im.style.transition = "none";
    im.style.transform = "";
    im.style.opacity = "";
    im.style.cursor = "";
  };
  function toggleZoomAt(clientX, clientY) {
    sliderTick();
    if (zScale > 1.05) {
      zScale = 1;
      zX = zY = 0;
    } else {
      const r = im.getBoundingClientRect(),
        cX = r.left + r.width / 2,
        cY = r.top + r.height / 2;
      zScale = 2.5;
      [zX, zY] = clampPan((cX - clientX) * (zScale - 1), (cY - clientY) * (zScale - 1), zScale);
    }
    applyZoom(true);
  }
  function paint() {
    raf = 0;
    if (mode === "pinch" || mode === "pan") {
      applyZoom(false);
      return;
    }
    if (x0 === null) return;
    if (axis === "y") {
      const y = Math.max(-30, dy * 0.72),
        s = Math.max(0.82, 1 - Math.max(0, dy) / 680);
      im.style.transform = `translate3d(0,${y.toFixed(1)}px,0) scale(${s.toFixed(3)})`;
      im.style.opacity = Math.max(0.35, 1 - Math.max(0, dy) / 420).toFixed(2);
    } else if (axis === "x") {
      const i = lbList.indexOf(lbId),
        atEdge = (dx > 0 && i <= 0) || (dx < 0 && i >= lbList.length - 1);
      im.style.transform = `translate3d(${(dx * (atEdge ? 0.18 : 0.45)).toFixed(1)}px,0,0)`;
    }
  }
  stage.addEventListener(
    "touchstart",
    (e) => {
      if (e.target.closest("button")) return;
      im.style.transition = "none";
      if (e.touches.length === 2) {
        const [t0, t1] = e.touches,
          r = im.getBoundingClientRect();
        mode = "pinch";
        moved = true;
        x0 = null;
        pDist = Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY);
        pMidX = (t0.clientX + t1.clientX) / 2;
        pMidY = (t0.clientY + t1.clientY) / 2;
        pScale = zScale;
        pX = zX;
        pY = zY;
        cx0 = r.left + r.width / 2 - zX;
        cy0 = r.top + r.height / 2 - zY;
        return;
      }
      if (e.touches.length !== 1) return;
      x0 = e.touches[0].clientX;
      y0 = e.touches[0].clientY;
      dx = dy = 0;
      axis = "";
      moved = false;
      if (zScale > 1.02) {
        mode = "pan";
        pX = zX;
        pY = zY;
      } else {
        mode = "swipe";
      }
    },
    { passive: true },
  );
  stage.addEventListener(
    "touchmove",
    (e) => {
      if (mode === "pinch" && e.touches.length === 2) {
        const [t0, t1] = e.touches,
          dist = Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY),
          midX = (t0.clientX + t1.clientX) / 2,
          midY = (t0.clientY + t1.clientY) / 2,
          ns = Math.max(1, Math.min(4, pScale * (dist / Math.max(12, pDist)))),
          ratio = ns / pScale;
        zScale = ns;
        [zX, zY] = clampPan(midX - cx0 - (pMidX - cx0 - pX) * ratio, midY - cy0 - (pMidY - cy0 - pY) * ratio, ns);
        if (!raf) raf = requestAnimationFrame(paint);
        return;
      }
      if (x0 === null || e.touches.length !== 1) return;
      dx = e.touches[0].clientX - x0;
      dy = e.touches[0].clientY - y0;
      if (Math.hypot(dx, dy) >= 8) moved = true;
      if (mode === "pan") {
        [zX, zY] = clampPan(pX + dx, pY + dy, zScale);
        if (!raf) raf = requestAnimationFrame(paint);
        return;
      }
      if (!axis) {
        if (!moved) return;
        axis = Math.abs(dy) > Math.abs(dx) ? "y" : "x";
      }
      if (!raf) raf = requestAnimationFrame(paint);
    },
    { passive: true },
  );
  stage.addEventListener(
    "touchend",
    (e) => {
      if (raf) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
      if (mode === "pinch") {
        if (e.touches.length === 1 && zScale > 1.02) {
          mode = "pan";
          x0 = e.touches[0].clientX;
          y0 = e.touches[0].clientY;
          pX = zX;
          pY = zY;
          return;
        }
        if (zScale < 1.05) {
          zScale = 1;
          zX = zY = 0;
        } else {
          [zX, zY] = clampPan(zX, zY, zScale);
        }
        applyZoom(true);
        mode = "";
        return;
      }
      if (e.touches.length > 0 || x0 === null) return;
      const endX = x0,
        endY = y0;
      x0 = null;
      if (!moved && e.changedTouches.length === 1) {
        const now = Date.now();
        if (now - lastTap < 280 && Math.hypot(endX - tapX, endY - tapY) < 40) {
          lastTap = 0;
          mode = "";
          toggleZoomAt(endX, endY);
          return;
        }
        lastTap = now;
        tapX = endX;
        tapY = endY;
      }
      if (mode === "pan") {
        mode = "";
        [zX, zY] = clampPan(zX, zY, zScale);
        applyZoom(true);
        return;
      }
      mode = "";
      const nextIdx = lbList.indexOf(lbId) + (dx < 0 ? 1 : -1);
      if (axis === "x" && Math.abs(dx) > 45 && nextIdx >= 0 && nextIdx < lbList.length) {
        lbResetZoom();
        lbStep(dx < 0 ? 1 : -1);
      } else if (axis === "y" && dy > 55) {
        sliderTick();
        im.style.transition = "transform .15s ease-out,opacity .15s ease-out";
        im.style.transform = "translate3d(0,160px,0) scale(.8)";
        im.style.opacity = "0";
        setTimeout(() => {
          lbResetZoom();
          closePhotoByUser();
        }, 145);
      } else {
        applyZoom(true);
      }
    },
    { passive: true },
  );
  im.addEventListener("dblclick", (e) => {
    e.preventDefault();
    toggleZoomAt(e.clientX, e.clientY);
  });
  stage.addEventListener(
    "wheel",
    (e) => {
      if ($("lightbox").hidden) return;
      e.preventDefault();
      const ns = Math.max(1, Math.min(4, zScale * (e.deltaY < 0 ? 1.18 : 0.85)));
      zScale = ns < 1.05 ? 1 : ns;
      [zX, zY] = clampPan(zX, zY, zScale);
      applyZoom(false);
    },
    { passive: false },
  );
  let mousePan = false;
  im.addEventListener("pointerdown", (e) => {
    if (e.pointerType !== "mouse" || e.button !== 0 || zScale <= 1.02) return;
    mousePan = true;
    x0 = e.clientX;
    y0 = e.clientY;
    pX = zX;
    pY = zY;
    im.style.cursor = "grabbing";
    im.setPointerCapture?.(e.pointerId);
  });
  im.addEventListener("pointermove", (e) => {
    if (!mousePan) return;
    [zX, zY] = clampPan(pX + e.clientX - x0, pY + e.clientY - y0, zScale);
    applyZoom(false);
  });
  const endMousePan = () => {
    if (!mousePan) return;
    mousePan = false;
    x0 = null;
    im.style.cursor = zScale > 1 ? "grab" : "";
  };
  im.addEventListener("pointerup", endMousePan);
  im.addEventListener("pointercancel", endMousePan);
})();
// 幫自己的照片寫一句話（每日照片和日記照片都可以）
$("lbCapEdit").onclick = () => {
  const p = calAllPhotos().find((x) => x.id === lbId);
  if (!p) return;
  $("lbCapForm").hidden = false;
  $("lbCapEdit").hidden = true;
  const t = $("lbCapText");
  t.value = p.cap || "";
  t.focus();
};
$("lbDay").onclick = () => {
  const p = calAllPhotos().find((x) => x.id === lbId);
  if (!p || !/^\d{4}-\d{2}-\d{2}$/.test(String(p.date || ""))) return;
  const d = p.date;
  closePhoto();
  openFor("calendar:" + d);
  history.replaceState(null, "", "#calendar:" + d);
};
$("lbCapClose").onclick = () => {
  $("lbCapForm").hidden = true;
  $("lbCapEdit").hidden = false;
};
$("lbCapForm").addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const id = lbId,
    cap = $("lbCapText").value.trim(),
    p = calAllPhotos().find((x) => x.id === id);
  if (!p) return;
  try {
    await commit(db.collection("photos").doc(id).update({ cap }));
    [photos, calPhotos].forEach((l) => {
      const x = l.find((y) => y.id === id);
      if (x) x.cap = cap;
    });
    openPhoto(id);
    renderAll();
    toast("寫好了 ✏️");
  } catch (e) {
    toast(NOSAVE);
  }
});
// 照片大圖：下載（直接存成檔案）和分享（叫出手機的分享選單）
function lbFile() {
  return photoFile(lbId);
}
// 拿一張照片的原圖檔（大圖已經載好就直接用，不然去伺服器抓；抓不到就用縮圖）
async function photoFile(id) {
  const p = calAllPhotos().find((x) => x.id === id);
  if (!p) return null;
  let src = lbId === id ? lbFull : "";
  if (!src && db) {
    const img = await fetchPicImg(p.id).catch(() => "");
    if (img) {
      src = img;
      if (lbId === p.id) {
        lbFull = img;
        $("lbImg").src = img;
      }
    }
  }
  const blob = await (await fetch(src || p.th)).blob(),
    name = `love-base-${p.date}-${p.by}.jpg`;
  return { p, blob, name, file: new File([blob], name, { type: "image/jpeg" }) };
}
const canShareFiles = () => {
  try {
    return !!(navigator.canShare && navigator.canShare({ files: [new File([""], "x.jpg", { type: "image/jpeg" })] }));
  } catch (e) {
    return false;
  }
};
$("lbSave").onclick = async () => {
  const b = $("lbSave");
  b.disabled = true;
  try {
    const f = await lbFile();
    if (!f) return;
    downloadBlob(f.name, f.blob);
    toast("下載好了 ⬇️");
  } catch (e) {
    toast("下載不了，可以長按照片再選「儲存」");
  } finally {
    b.disabled = false;
  }
};
$("lbShare").onclick = async () => {
  const b = $("lbShare");
  b.disabled = true;
  try {
    const f = await lbFile();
    if (!f) return;
    const sd = shortDate(f.p.date),
      text = `${sd ? sd + " " : ""}${f.p.by}${f.p.cap ? "：「" + f.p.cap + "」" : ""}`;
    const data = { files: [f.file], title: "我們的戀愛遊戲基地", text };
    await navigator.share(navigator.canShare(data) ? data : { files: [f.file] });
  } catch (e) {
    if (!e || e.name !== "AbortError") toast("分享不了，可以先下載再分享");
  } finally {
    b.disabled = false;
  }
};
function closePhoto() {
  clearTimeout(lbSlowTimer);
  lbResetZoom();
  $("lightbox").hidden = true;
  $("lbRetry").hidden = true;
  document.documentElement.classList.remove("lb-lock");
  lbId = null;
  lbList = [];
  lbFull = "";
  lbBaseCount = "";
  $("lbImg").removeAttribute("src");
}
// 使用者自己關大圖時，順便退掉打開時加的那一筆返回紀錄（Android 返回手勢會先關大圖）
function closePhotoByUser() {
  if (history.state && history.state.lb) history.back();
  else closePhoto();
}
$("lbClose").onclick = closePhotoByUser;
$("lightbox").addEventListener("click", (ev) => {
  if (ev.target.id === "lightbox") closePhotoByUser();
});
document.addEventListener("keydown", (ev) => {
  if ($("lightbox").hidden || ev.target.tagName === "INPUT") return;
  if (ev.key === "Escape") closePhotoByUser();
  else if (ev.key === "ArrowLeft") lbStep(-1);
  else if (ev.key === "ArrowRight") lbStep(1);
});
$("lbDel").onclick = async () => {
  const b = $("lbDel"),
    id = lbId;
  if (!id || !confirmTap(b, "確定刪除？再按一次", "刪除這張")) return;
  const item = calAllPhotos().find((p) => p.id === id),
    mark = trashMark();
  try {
    await commit(db.collection("photos").doc(id).update({ trashed: mark }));
    if (item && !trash.photos.some((x) => x.id === id)) trash.photos.push({ ...item, trashed: mark });
    photos = photos.filter((p) => p.id !== id);
    calPhotos = calPhotos.filter((p) => p.id !== id);
    closePhotoByUser();
    renderAll();
    trashedToast("photos", id);
  } catch (e) {
    toast("刪除失敗，請再試一次");
  }
};
function subPhotos() {
  if (!db) return;
  if (photoUnsub) photoUnsub();
  photoUnsub = db
    .collection("photos")
    .orderBy("date", "desc")
    .limit(photoLimit)
    .onSnapshot(
      { includeMetadataChanges: true },
      (s) => {
        syncBroken.photos = false;
        pendingSync.photos = !!s.metadata?.hasPendingWrites;
        updateSyncStatus();
        if (photos.length && typeof s.docChanges === "function" && !s.docChanges().length) return;
        photos = s.docs.map((d) => ({ id: d.id, ...d.data() })).filter((p) => !p.trashed);
        photoErr = "";
        renderAll();
        syncPhotoBonus();
      },
      (e) => {
        photoErr = e && e.code === "permission-denied" ? "rules" : "net";
        if (photoErr === "net") syncBroken.photos = true;
        updateSyncStatus();
        renderAll();
      },
    );
}

const NAME_KEY = "love-base-name",
  NAMES = ["寒冰", "夏夏"],
  NAME_IC = { 寒冰: "🧊", 夏夏: "🍃" };
function myName() {
  return lsGet(NAME_KEY);
}
let who = "all";
function byChip(n) {
  if (!n) return '<span class="by">未署名</span>';
  const me = n === myName(),
    ic = NAME_IC[n] || "✍️";
  return `<span class="by ${me ? "me" : "them"}">${ic} ${esc(n)}${me ? "（我）" : ""}</span>`;
}
function diaryDl(e) {
  return [
    ["⛅ 心情", e.mood],
    ["🍜 吃了", e.food],
    ["🤪 最好笑", e.funny],
    ["💞 想對你說", e.say],
  ]
    .filter((r) => r[1])
    .map((r) => `<dt>${r[0]}</dt><dd>${escLink(r[1])}</dd>`)
    .join("");
}
function diaryQuote(e) {
  return e.s1 || e.s2
    ? `<blockquote>今天雖然${esc(e.s1 || "＿＿")}，但因為有你${esc(e.s2 || "＿＿")}。</blockquote>`
    : "";
}
/* ===== 日記卡片、列表與表單 ===== */
let justIn = null; // 剛寫好的日記 { id, popped }：畫出來時彈一下
function diaryCard(e, where, n) {
  const me = myName(),
    cls =
      (e.by ? (e.by === me ? "me" : "them") : "") +
      (justIn && !justIn.popped && justIn.id === e.id && where === "today" ? " just-in" : ""),
    star = e.happy ? `⭐ ${esc(e.happy)}/10` : "";
  const head = n
    ? `<header><b>📖 我們的第 ${n} 篇日記</b><span>${esc(e.date)}${star ? " · " + star : ""}</span></header><div>${byChip(e.by)}</div>`
    : `<header><div>${byChip(e.by)}</div><span>${star}</span></header>`;
  return `<article class="entry ${cls}">${head}<dl>${diaryDl(e)}</dl>${diaryQuote(e)}${entryExtras(e, where)}</article>`;
}

let monthOpen = {}; // 月份 -> 使用者手動開合的狀態
const SEARCH_PAGE = 30;
let lastQ = "",
  searchShown = SEARCH_PAGE;
function renderEntries() {
  const box = $("entries");
  if (!entries.length) {
    box.innerHTML = '<div class="empty">還沒有日記。寫下第一篇，就是「我們的第 1 篇日記」。</div>';
    return;
  }
  const sorted = [...entries].sort((a, b) => (a.date + a.at).localeCompare(b.date + b.at));
  const num = new Map(sorted.map((e, i) => [e.id, i + 1]));
  const me = myName();
  const q = $("dSearch").value.trim().toLowerCase();
  const meta = entryMetaMap();
  const hit = (e) => {
    if (!q) return true;
    const rs = meta.repliesByEntry.get(e.id) || [],
      own = meta.photosByEntry.get(e.id) || [],
      daily = meta.firstEntryIds.has(e.id) ? meta.dailyPhotosByKey.get(e.date + "_" + e.by) || [] : [];
    return [
      e.date,
      e.mood,
      e.food,
      e.funny,
      e.say,
      e.s1,
      e.s2,
      e.by,
      ...rs.filter((r) => r.kind === "text").map((r) => r.text),
      ...own.map((p) => p.cap),
      ...daily.map((p) => p.cap),
    ].some((v) =>
      String(v || "")
        .toLowerCase()
        .includes(q),
    );
  };
  const shown = sorted
    .slice()
    .reverse()
    .filter((e) => (who === "all" || (who === "me" ? e.by === me : e.by !== me)) && hit(e));
  $("dSearchN").textContent = q ? `找到 ${shown.length} 篇` : "";
  if (!shown.length) {
    box.innerHTML = `<div class="empty">${q ? `找不到「${esc(q)}」的日記。` : who === "me" ? "你還沒寫過日記。" : "對方還沒寫過日記。"}</div>`;
    return;
  }
  const groups = new Map();
  shown.forEach((e) => {
    const m = String(e.date).slice(0, 7);
    if (!groups.has(m)) groups.set(m, []);
    groups.get(m).push(e);
  });
  const cur = key(today()).slice(0, 7),
    first = groups.has(cur) ? cur : [...groups.keys()][0];
  // 日記多了以後不能一次全部畫出來：只畫打開的月份，搜尋結果先畫前 SEARCH_PAGE 篇
  if (q !== lastQ) {
    lastQ = q;
    searchShown = SEARCH_PAGE;
  }
  let budget = q ? searchShown : Infinity;
  const isOpen = (m) => (q ? budget > 0 : (monthOpen[m] ?? m === first));
  box.innerHTML =
    [...groups]
      .map(([m, list]) => {
        const [y, mo] = m.split("-").map(Number),
          open = isOpen(m);
        let body = "";
        if (open) {
          const part = list.slice(0, budget);
          budget -= part.length;
          body = part.map((e) => diaryCard(e, "list", num.get(e.id))).join("");
        }
        return (
          `<details class="month" data-m="${esc(m)}" ${open ? "open" : ""}><summary>${y} 年 ${mo} 月<span>${list.length}` +
          ` 篇</span></summary><div class="month-body">${body}</div></details>`
        );
      })
      .join("") +
    (q && shown.length > searchShown
      ? `<button class="btn ghost" type="button" id="dSearchMore">再顯示 ${Math.min(SEARCH_PAGE, shown.length - searchShown)}` +
        ` 篇（還有 ${shown.length - searchShown} 篇）</button>`
      : "");
  if (q && shown.length > searchShown)
    $("dSearchMore").onclick = () => {
      searchShown += SEARCH_PAGE;
      renderEntries();
    };
  // 點開月份時才畫那個月的日記和載入照片
  box.querySelectorAll(".month summary").forEach(
    (s) =>
      (s.onclick = () => {
        const d = s.parentNode,
          m = d.dataset.m,
          opening = !d.open;
        monthOpen[m] = opening;
        if (opening && !q) {
          loadCalPhotos(m);
          if (!d.querySelector(".month-body").children.length) setTimeout(renderEntries, 0);
        }
      }),
  );
  box.querySelectorAll("details.month[open]").forEach((d) => loadCalPhotos(d.dataset.m));
  bindEntryActs(box, "list");
}
async function delEntry(id) {
  const item = entries.find((e) => e.id === id);
  if (!item) return;
  if (editId === id) endEdit();
  const old = entries,
    mark = trashMark();
  entries = entries.filter((e) => e.id !== id);
  trash.diary.push({ ...item, trashed: mark });
  renderAll();
  try {
    db ? await commit(db.collection("diary").doc(id).update({ trashed: mark })) : saveLocal();
    trashedToast("diary", id);
  } catch (e) {
    entries = old;
    trash.diary = trash.diary.filter((x) => x.id !== id);
    renderAll();
    toast("刪除失敗");
  }
}

let happy = 0,
  editId = null;
const FIELDS = { dMood: "mood", dFood: "food", dFunny: "funny", dSay: "say", dS1: "s1", dS2: "s2" };
function clearPromptHint() {
  if (!$("dPromptHint")) return;
  $("dPromptHint").textContent = "";
  $("dPromptHint").hidden = true;
}
function resetDiaryFields() {
  for (const el of Object.keys(FIELDS)) $(el).value = "";
  $("dFunny").closest("label").hidden = true;
  $("dS1").closest(".summary").hidden = true;
  $("dDate").value = key(today());
  happy = 0;
  clearPromptHint();
  renderHearts();
  growAll();
}
function startEdit(id) {
  const e = entries.find((x) => x.id === id);
  if (!e) return;
  editId = id;
  clearPromptHint();
  renderDiaryToday();
  $("dDate").value = e.date || key(today());
  for (const [el, f] of Object.entries(FIELDS)) $(el).value = e[f] || "";
  $("dFunny").closest("label").hidden = !e.funny;
  $("dS1").closest(".summary").hidden = !(e.s1 || e.s2);
  happy = Number(e.happy) || 0;
  renderHearts();
  growAll();
  $("editBar").hidden = false;
  $("editText").textContent = `✏️ 正在編輯 ${e.date || ""} 的日記`;
  delete $("editCancel").dataset.confirm;
  $("editCancel").textContent = "取消編輯";
  $("diaryForm").classList.add("editing");
  $("dSave").textContent = "儲存修改";
  $("dMsg").textContent = "";
  $("dDraftClear").hidden = true;
  openFor("diaryForm");
  growAll();
}
function editDirty() {
  const e = entries.find((x) => x.id === editId);
  if (!e) return false;
  if ($("dDate").value !== (e.date || "")) return true;
  if ((happy || 0) !== (Number(e.happy) || 0)) return true;
  return Object.entries(FIELDS).some(([el, f]) => $(el).value.trim() !== String(e[f] || "").trim());
}
function endEdit() {
  editId = null;
  delete $("editCancel").dataset.confirm;
  $("editCancel").textContent = "取消編輯";
  $("editBar").hidden = true;
  $("diaryForm").classList.remove("editing");
  $("dSave").textContent = "寫進日記";
  resetDiaryFields();
  restoreDraft();
  renderDiaryToday();
}
$("editCancel").onclick = () => {
  if (editId && editDirty() && !confirmTap($("editCancel"), "確定放棄修改？再按一次", "取消編輯")) return;
  endEdit();
};
let heartDragged = false,
  heartStart = null,
  heartStartVal = 0;
(function buildHearts() {
  $("hearts").innerHTML =
    [...Array(10)]
      .map((_, i) => `<button type="button" role="radio" aria-label="${i + 1} 分" data-v="${i + 1}">⭐</button>`)
      .join("") + '<span class="score" id="score"></span>';
  $("hearts").addEventListener("click", (ev) => {
    if (heartDragged) return;
    const b = ev.target.closest("button[data-v]");
    if (!b) return;
    ev.preventDefault();
    const v = +b.dataset.v;
    happy = happy === v ? 0 : v;
    sliderTick();
    renderHearts();
    saveDraft();
  });
  const pick = (x) => {
    const bs = $("hearts").querySelectorAll("button[data-v]"),
      l = bs[0].getBoundingClientRect().left,
      r = bs[9].getBoundingClientRect().right;
    return Math.max(1, Math.min(10, Math.ceil(((x - l) / (r - l)) * 10)));
  };
  $("hearts").addEventListener("pointerdown", (ev) => {
    heartStart = ev.clientX;
    heartStartVal = happy;
    heartDragged = false;
  });
  $("hearts").addEventListener("pointermove", (ev) => {
    if (heartStart === null) return;
    if (!heartDragged && Math.abs(ev.clientX - heartStart) < 8) return;
    heartDragged = true;
    const v = pick(ev.clientX);
    if (v !== happy) {
      happy = v;
      sliderTick();
      renderHearts();
    }
  });
  const endDrag = () => {
    if (heartDragged) {
      sliderDragEndTick(happy !== heartStartVal);
      saveDraft();
    }
    heartStart = null;
    setTimeout(() => (heartDragged = false), 60);
  };
  $("hearts").addEventListener("pointerup", endDrag);
  $("hearts").addEventListener("pointercancel", endDrag);
})();
function renderHearts() {
  $("hearts")
    .querySelectorAll("button[data-v]")
    .forEach((b) => {
      const v = +b.dataset.v;
      b.classList.toggle("on", v <= happy);
      b.setAttribute("aria-checked", v === happy);
    });
  $("score").textContent = happy ? happy + " / 10" : "點星星打分數";
}
// 填寫時框框自動變高
function grow(t) {
  if (!t.value) {
    if (t.style.height) t.style.height = "";
    return;
  }
  t.style.height = "auto";
  if (t.scrollHeight > 0) t.style.height = t.scrollHeight + 2 + "px";
  else t.style.height = "";
}
function growAll() {
  document.querySelectorAll("textarea").forEach(grow);
}
document.addEventListener("input", (ev) => {
  if (ev.target.tagName === "TEXTAREA") grow(ev.target);
});
// 單行欄位按 Enter 不要送出（中文選字的 Enter 也不會）
$("diaryForm").addEventListener("keydown", (ev) => {
  if (ev.key === "Enter" && ev.target.tagName === "INPUT" && !ev.isComposing && ev.keyCode !== 229) ev.preventDefault();
});
const DIARY_PROMPTS = [
  "今天哪個瞬間突然很想對方？",
  "今天最想誇獎對方的一件事是什麼？",
  "下次見面最想一起去哪裡或吃什麼？",
  "今天有沒有遇到什麼好笑或特別的小事？",
  "如果給今天一個小標題，會叫什麼？",
  "最近對方做的哪件小事讓你覺得被照顧到？",
  "今天最開心的一刻是什麼時候？",
  "現在最想對對方撒嬌說的一句話是？",
  "今天有沒有看到什麼東西突然想到對方？",
  "這週最期待跟對方一起做的事是什麼？",
];
let promptIdx = -1;
$("dPromptBtn").onclick = () => {
  promptIdx = (promptIdx + 1) % DIARY_PROMPTS.length;
  const tip = "💡 " + DIARY_PROMPTS[promptIdx];
  $("dSay").placeholder = tip;
  if ($("dPromptHint")) {
    $("dPromptHint").textContent = tip;
    $("dPromptHint").hidden = false;
  }
  $("dSay").focus();
};

$("diaryForm").addEventListener("submit", async (ev) => {
  ev.preventDefault();
  if ($("dSave").disabled) return;
  const e = {
    date: $("dDate").value,
    mood: $("dMood").value.trim(),
    food: $("dFood").value.trim(),
    funny: $("dFunny").value.trim(),
    say: $("dSay").value.trim(),
    happy: happy || null,
    s1: $("dS1").value.trim(),
    s2: $("dS2").value.trim(),
    at: nowIso(),
    by: myName(),
  };
  if (!e.mood && !e.food && !e.funny && !e.say && !e.s1 && !e.s2) {
    $("dMsg").textContent = "至少寫一格再存喔";
    // 跳到第一格、輕震一下，讓人知道要先寫
    haptic(30);
    const first = $("dMood");
    first.scrollIntoView({ block: "center", behavior: "smooth" });
    first.focus({ preventScroll: true });
    first.classList.remove("nudge");
    void first.offsetWidth;
    first.classList.add("nudge");
    return;
  }
  $("dSave").disabled = true;
  $("dMsg").textContent = "";
  if (editId) {
    const old = entries.find((x) => x.id === editId);
    if (!old) {
      $("dMsg").textContent = "這篇日記已經被刪除了";
      endEdit();
      $("dSave").disabled = false;
      return;
    }
    const upd = { ...e, at: old.at, by: old.by || myName(), edited: nowIso() };
    try {
      if (db) await commit(db.collection("diary").doc(editId).set(upd));
      else {
        Object.assign(old, upd);
        saveLocal();
      }
      Object.assign(old, upd);
      endEdit();
      renderAll();
      saveToast("修改好了 ✏️");
    } catch (err) {
      $("dMsg").textContent = "沒存到，請再試一次";
    }
    $("dSave").disabled = false;
    return;
  }
  // 先把日記放進畫面、清空表單，存檔在背景；內容另外備份一份，萬一沒存成功就整篇放回表單
  const id = db ? db.collection("diary").doc().id : "l" + Date.now();
  const backup = JSON.stringify(e);
  lsSet(SAVING_KEY, backup);
  entries.push({ id, ...e });
  if (!db) saveLocal();
  diaryFormOpen = false;
  clearDraft();
  $("dMsg").textContent = "";
  resetDiaryFields();
  renderAll();
  lastCommitSynced = navigator.onLine;
  // 寫完的回饋：新日記卡片彈一下、飄出愛心，提示對方寫了沒
  const partner = nameOf(NAMES.find((n) => n !== myName()) || "對方"),
    isToday = e.date === key(today()),
    both = entries.some((x) => x.date === e.date && x.by && x.by !== myName());
  // 新卡片畫出來時自己加 .just-in 彈一下並飄 💌（diaryCard／renderDiaryToday 處理），補寫以前的日子就從按鈕飄
  if (isToday) {
    justIn = { id, popped: false };
    setTimeout(() => {
      if (justIn && justIn.id === id) justIn = null;
    }, 1500);
  } else popFloat($("dSave"), "💌");
  saveToast(!isToday ? "補寫好了 💌" : both ? "寫好了 💌 今天你們兩個都寫了" : `寫好了 💌 等${partner}也來寫`);
  $("dSave").disabled = false;
  if (!db) {
    lsDel(SAVING_KEY);
    return;
  }
  const saving = commit(db.collection("diary").doc(id).set(e));
  const preview = (e.mood || e.say || e.food || e.funny || "").slice(0, 24);
  notifyPartner(
    "💌 新日記",
    `${myName()}寫了一篇新日記${preview ? `：「${preview}」` : ""}`,
    e.date === key(today()) ? "#quests" : "#calendar:" + e.date,
    "diary-" + e.date,
  );
  try {
    const synced = await saving;
    if (!synced && navigator.onLine) toast(QUEUED_HINT, 4500);
    if (lsGet(SAVING_KEY) === backup) lsDel(SAVING_KEY);
  } catch (err) {
    const i = entries.findIndex((x) => x.id === id);
    if (i >= 0) entries.splice(i, 1);
    if (!lsGet(DRAFT_KEY)) lsSet(DRAFT_KEY, backup);
    lsDel(SAVING_KEY);
    restoreDraft();
    renderAll();
    $("dMsg").textContent = "沒存到，請確認網路後再按一次「寫進日記」";
    toast(NOSAVE);
  }
});

// 抽題：每天輪流抽一題（寒冰、夏夏隔天輪），每個月的題庫在 questions.json
// 兩人共用同一題，每人一份答案，都答完才揭曉
let lastRound = null,
  MONTHLY = null;
const need = () => (db ? 2 : 1);
fetch("questions.json", { cache: "no-cache" })
  .then((r) => (r.ok ? r.json() : null))
  .then((j) => {
    if (j) {
      MONTHLY = j;
      renderVer++;
      renderOpen();
    }
  })
  .catch(() => {});
/* ===== 今日隨機抽題 ===== */
function monthBank() {
  const m = key(today()).slice(0, 7),
    b = MONTHLY && MONTHLY[m];
  return b && Array.isArray(b.q) && b.q.length
    ? { month: Number(m.slice(5)), theme: b.theme || "", q: b.q }
    : { month: Number(m.slice(5)), theme: "", q: QUESTIONS };
}
function allQuestions() {
  return [...monthBank().q, ...store.custom.filter((c) => c.kind === "q").map((c) => c.text)];
}
function roundDay(r) {
  return r.day || dayOf(r.at);
}
function curRound() {
  return store.rounds.reduce((a, b) => (!a || String(b.at) > String(a.at) ? b : a), null);
}
function todayRound() {
  const tk = key(today());
  return store.rounds
    .filter((r) => roundDay(r) === tk)
    .reduce((a, b) => (!a || String(b.at) > String(a.at) ? b : a), null);
}
function turnOf(k) {
  const [y, m, d] = k.split("-").map(Number);
  return NAMES[Math.floor(Date.UTC(y, m - 1, d) / 864e5) % 2];
}
function myTurn() {
  return !db || myName() === turnOf(key(today()));
}
// 畫面上顯示的題目：今天的題目；今天還沒抽的話，顯示還沒揭曉（或今天剛補答揭曉）的舊題目
function shownRound() {
  const t = todayRound();
  if (t) return t;
  const r = curRound();
  if (!r) return null;
  const ans = pairOf(r.id);
  return ans.length < need() || ans.some((a) => dayOf(a.at) === key(today())) ? r : null;
}
let _pairsMap = null;
function pairOf(id) {
  if (!_pairsMap) {
    _pairsMap = new Map();
    const byRound = new Map();
    store.answers.forEach((a) => {
      if (!byRound.has(a.round)) byRound.set(a.round, []);
      byRound.get(a.round).push(a);
    });
    const me = myName();
    for (const [rid, list] of byRound) {
      const seen = new Map();
      list.sort(byAt).forEach((a) => {
        if (!seen.has(a.by)) seen.set(a.by, a);
      });
      _pairsMap.set(
        rid,
        [...seen.values()].sort((a, b) => (b.by === me) - (a.by === me)),
      );
    }
  }
  return _pairsMap.get(id) || [];
}
function renderDraw() {
  const tk = key(today()),
    bank = monthBank(),
    extra = store.custom.filter((c) => c.kind === "q").length;
  const turn = turnOf(tk),
    tomorrow = new Date(today());
  tomorrow.setDate(tomorrow.getDate() + 1);
  const next = turnOf(key(tomorrow));
  $("drawHint").textContent =
    `${bank.month} 月${bank.theme ? "主題「" + bank.theme + "」" : "題庫"} · 共 ${bank.q.length} 題${extra ? `（另有自訂 ${extra} 題）` : ""}`;
  renderLog();
  const t = todayRound(),
    r = shownRound(),
    b = $("drawBtn"),
    c = $("qCard");
  // 抽題按鈕：今天輪到的人才看得到；已經有人答了就不能換題
  if (!t) {
    b.hidden = !myTurn();
    b.textContent = "🎲 抽今天的題目";
  } else {
    b.hidden = !myTurn() || pairOf(t.id).length > 0;
    b.textContent = "🔁 換一題";
  }
  const turnLine = db
    ? t
      ? next === myName()
        ? "明天輪到你抽"
        : `明天輪到 ${next} 抽`
      : myTurn()
        ? "今天輪到你抽題"
        : `今天輪到 ${turn} 抽題`
    : "";
  if (!r) {
    c.textContent = db && !myTurn() ? `今天輪到 ${turn} 抽題 🎲` : "按下面的按鈕抽今天的題目";
    $("ansForm").hidden = true;
    $("reveal").hidden = true;
    $("drawWho").hidden = true;
    $("ansHint").textContent = turnLine;
    lastRound = null;
    return;
  }
  c.textContent = r.q;
  if (lastRound && r.id !== lastRound) {
    ansEditing = false;
    $("ansText").value = "";
    grow($("ansText"));
    c.classList.remove("flip");
    void c.offsetWidth;
    c.classList.add("flip");
  }
  lastRound = r.id;
  const d = new Date(r.at),
    ans = pairOf(r.id),
    mine = ans.find((a) => a.by === myName()),
    over = ans.length >= need(),
    shownAns = over ? ans : mine ? [mine] : [];
  $("drawWho").hidden = false;
  $("drawWho").textContent =
    (r === t ? "" : over ? "✅ 今天剛揭曉的題目 · " : "📌 還沒揭曉的題目 · ") +
    `🎲 ${r.by ? nameOf(r.by) : "有人"} 在 ${d.getMonth() + 1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())} 抽的`;
  if (over) ansEditing = false;
  $("ansForm").hidden = !!mine && (!ansEditing || over);
  if (!mine && !ansEditing && document.activeElement !== $("ansText") && !$("ansText").value) {
    const ad = lsJson(ANS_DRAFT_KEY);
    if (ad && ad.round === r.id && ad.text) {
      $("ansText").value = ad.text;
      grow($("ansText"));
    }
  }
  $("ansSave").textContent = mine ? "儲存修改" : "送出答案";
  $("reveal").hidden = !shownAns.length;
  if (shownAns.length) {
    $("reveal").innerHTML = shownAns
      .map(
        (a) =>
          `<div class="rev-row"><span><b>${esc(nameOf(a.by))}</b>${esc(a.text)}</span>` +
          `${a.by === myName() && !over ? `<button type="button" class="btn ghost small ans-edit" id="ansEditBtn">${ansEditing ? "✕ 取消修改" : "✏️ 修改答案"}</button>` : ""}</div>`,
      )
      .join("");
    if (mine && !over)
      $("ansEditBtn").onclick = () => {
        ansEditing = !ansEditing;
        renderDraw();
        if (ansEditing) {
          $("ansText").value = mine.text;
          grow($("ansText"));
          $("ansText").focus();
        } else {
          $("ansText").value = "";
          grow($("ansText"));
        }
      };
  }
  const st = over
    ? `過關！+${DRAW_XP} XP · 答案收進過關紀錄了`
    : mine
      ? `你答好了，等對方回答就會揭曉（+${DRAW_XP} XP）`
      : ans.length
        ? `對方答好了，換你（+${DRAW_XP} XP）`
        : "";
  $("ansHint").textContent = [st, turnLine].filter(Boolean).join(" · ");
}
const LOG_PAGE = 24;
let lastLogQ = "",
  logShown = LOG_PAGE;
function renderLog() {
  const all = store.rounds
    .filter((r) => pairOf(r.id).length >= need())
    .sort(byAt)
    .reverse();
  $("logN").textContent = `${all.length} 題`;
  const q = $("lSearch").value.trim().toLowerCase();
  if (q !== lastLogQ) {
    lastLogQ = q;
    logShown = LOG_PAGE;
  }
  const hit = (r) =>
    !q ||
    [r.q, roundDay(r), ...pairOf(r.id).flatMap((a) => [a.text, a.by])].some((v) =>
      String(v || "")
        .toLowerCase()
        .includes(q),
    );
  const list = all.filter(hit);
  $("lSearch").hidden = !all.length;
  $("lSearchN").textContent = q ? `找到 ${list.length} 題` : "";
  if (q && !list.length) {
    $("logList").innerHTML = `<div class="empty">找不到「${esc(q)}」的過關紀錄。</div>`;
    return;
  }
  const part = list.slice(0, logShown);
  $("logList").innerHTML = list.length
    ? part
        .map(
          (r) =>
            `<article class="entry"><header><b>${esc(r.q)}</b><span>${esc(roundDay(r))}</span></header>` +
            `<dl>${pairOf(r.id)
              .map((a) => `<dt>${esc(nameOf(a.by))}</dt><dd>${esc(a.text)}</dd>`)
              .join("")}</dl></article>`,
        )
        .join("") +
      (list.length > logShown
        ? `<button class="btn ghost" type="button" id="logMore">看更早的紀錄（還有 ${list.length - logShown} 題）</button>`
        : "")
    : '<div class="empty">還沒有過關的題目。</div>';
  if (list.length > logShown)
    $("logMore").onclick = () => {
      logShown += LOG_PAGE;
      renderLog();
    };
}
async function drawQ() {
  if (!myTurn()) return;
  const t = todayRound(),
    b = $("drawBtn");
  if (t && pairOf(t.id).length) return;
  // 這個月的題目裡，挑抽過次數最少的
  const all = allQuestions(),
    cntMap = new Map();
  store.rounds.forEach((x) => {
    if (x.id !== t?.id) cntMap.set(x.q, (cntMap.get(x.q) || 0) + 1);
  });
  const cnt = (q) => cntMap.get(q) || 0,
    min = Math.min(...all.map(cnt));
  let pool = all.filter((q) => cnt(q) === min && q !== t?.q);
  if (!pool.length) pool = all.filter((q) => q !== t?.q);
  if (!pool.length) return;
  const q = pool[Math.floor(Math.random() * pool.length)];
  b.disabled = true;
  try {
    if (t) await updDoc("rounds", t.id, { q, at: nowIso(), by: myName() });
    else {
      await addDoc("rounds", { q, at: nowIso(), by: myName(), day: key(today()) });
      notifyPartner(
        "🎲 今日抽題",
        `${myName()}抽了今天的題目：「${q.slice(0, 28)}」`,
        "#draw",
        "draw-q-" + key(today()),
      );
    }
  } catch (e) {
    toast("沒抽成功，請再試一次");
  }
  b.disabled = false;
}
$("drawBtn").onclick = drawQ;

// 送出表單：畫面馬上更新、清空輸入框，存檔在背景；存失敗就把剛剛打的字放回去
function bindForm(form, btn, build, after) {
  $(form).addEventListener("submit", async (ev) => {
    ev.preventDefault();
    if ($(btn).disabled) return;
    const data = build();
    if (!data) return;
    const fields = [...$(form).querySelectorAll("input:not([type=hidden]),textarea,select")],
      before = fields.map((f) => f.value);
    $(btn).disabled = true;
    setTimeout(() => ($(btn).disabled = false), 400);
    const saving = addDoc(data.c, data.doc);
    lastCommitSynced = navigator.onLine;
    after();
    try {
      const synced = await saving;
      if (!synced && navigator.onLine) toast(QUEUED_HINT, 4500);
    } catch (e) {
      fields.forEach((f, i) => {
        if (!f.value) f.value = before[i];
      });
      toast(NOSAVE);
    }
  });
}
// 中文選字按 Enter 時不要送出
["wishForm", "cqForm", "hugForm", "replyForm", "photoCapForm", "lbCapForm", "gateForm"].forEach((f) =>
  $(f).addEventListener("keydown", (ev) => {
    if (ev.key === "Enter" && (ev.isComposing || ev.keyCode === 229)) ev.preventDefault();
  }),
);
const ANS_DRAFT_KEY = "love-base-ans-draft",
  REV_DRAFT_KEY = "love-base-rev-draft";
let ansEditing = false;
$("ansText").addEventListener("input", () => {
  if (ansEditing) return;
  const r = shownRound(),
    text = $("ansText").value;
  if (r && text.trim()) lsSet(ANS_DRAFT_KEY, JSON.stringify({ round: r.id, text }));
  else lsDel(ANS_DRAFT_KEY);
});
$("ansForm").addEventListener("submit", async (ev) => {
  ev.preventDefault();
  if ($("ansSave").disabled) return;
  const r = shownRound(),
    text = $("ansText").value.trim();
  if (!r || !text) return;
  const mine = pairOf(r.id).find((a) => a.by === myName());
  if (mine && pairOf(r.id).length >= need()) return;
  $("ansSave").disabled = true;
  try {
    if (mine) {
      await updDoc("answers", mine.id, { text });
      ansEditing = false;
      lsDel(ANS_DRAFT_KEY);
      $("ansText").value = "";
      grow($("ansText"));
      renderAll();
      saveToast("答案改好了 ✏️");
    } else {
      const saving = addDoc("answers", { round: r.id, text, by: myName(), at: nowIso() });
      const ansWrite = lastCommitP;
      ansEditing = false;
      $("ansText").value = "";
      grow($("ansText"));
      try {
        await saving;
      } catch (e) {
        $("ansText").value = text;
        grow($("ansText"));
        throw e;
      }
      const ansSynced = lastCommitSynced;
      lsDel(ANS_DRAFT_KEY);
      if (pairOf(r.id).length >= need()) {
        await markRoundPassed(r);
        saveToast(`過關！+${DRAW_XP} XP 🎲`, ansSynced);
        notifyPartner(
          "🎲 抽題揭曉！",
          `${myName()}也答完了，快來看你們的答案（+${DRAW_XP} XP）`,
          "#draw",
          "draw-ans-" + r.id,
          ansWrite,
        );
      } else {
        saveToast(`答案送出了 🎲 等對方回答就 +${DRAW_XP} XP`, ansSynced);
        notifyPartner(
          "🎲 等你回答",
          `${myName()}答好抽題了，換你作答就會揭曉！`,
          "#draw",
          "draw-ans-" + r.id,
          ansWrite,
        );
      }
    }
  } catch (e) {
    toast(NOSAVE);
  }
  $("ansSave").disabled = false;
});

// 願望清單
/* ===== 願望清單 ===== */
// 願望分類：存在願望的 cat 欄位，舊願望沒有這個欄位就算「其他」
const WCATS = { eat: "🍜 想吃", go: "📍 想去", do: "🎯 想做", "": "✨ 其他" };
// 願望的約定日期（plan 欄位，YYYY-MM-DD）：還沒完成、有約日期的願望
const planned = () => store.wishes.filter((w) => !w.done && /^\d{4}-\d{2}-\d{2}$/.test(String(w.plan || "")));
const plansOn = (k) => planned().filter((w) => w.plan === k);
const mdw = (k) => {
  const d = fromKey(k);
  return `${d.getMonth() + 1}/${d.getDate()}（${"日一二三四五六"[d.getDay()]}）`;
};
let wFilter = "all",
  wCat = "",
  wishDoneOpen = false;
function syncWCat() {
  $("wCatPick")
    .querySelectorAll("button")
    .forEach((b) => b.setAttribute("aria-pressed", b.dataset.wc === wCat));
}
$("wCatPick")
  .querySelectorAll("button")
  .forEach(
    (b) =>
      (b.onclick = () => {
        wCat = b.dataset.wc;
        syncWCat();
      }),
  );
syncWCat();
function renderWishes() {
  const box = $("wishList"),
    q = $("wSearch").value.trim().toLowerCase();
  $("wSearch").hidden = !store.wishes.length;
  if (!store.wishes.length) {
    $("wCatFilter").innerHTML = "";
    $("wSearchN").textContent = "";
    box.innerHTML = '<div class="empty">還沒有願望。寫下第一件想一起完成的事。</div>';
    return;
  }
  const cnt = (c) => store.wishes.filter((w) => (w.cat || "") === c && !w.done).length;
  const cats = [
    ["all", "全部", store.wishes.filter((w) => !w.done).length],
    ...Object.entries(WCATS).map(([c, l]) => [c, l, cnt(c)]),
  ];
  const wf = $("wCatFilter");
  if (wf.children.length !== cats.length) {
    wf.innerHTML = cats.map(([c]) => `<button type="button" data-wc="${c}"></button>`).join("");
    wf.querySelectorAll("button").forEach(
      (b) =>
        (b.onclick = () => {
          wFilter = b.dataset.wc;
          renderWishes();
        }),
    );
  }
  cats.forEach(([c, l, n], i) => {
    const b = wf.children[i];
    const txt = `${l} ${n}`;
    if (b.dataset.t !== txt) {
      const sp = l.indexOf(" ");
      b.dataset.t = txt;
      b.innerHTML =
        (sp > 0 ? `<span class="wc-e">${l.slice(0, sp)}</span>${l.slice(sp + 1)}` : l) +
        `<span class="wc-n">${n}</span>`;
      b.setAttribute("aria-label", `${sp > 0 ? l.slice(sp + 1) : l} ${n} 個`);
    }
    b.setAttribute("aria-pressed", String(wFilter === c));
  });
  const wishes = store.wishes.filter(
    (w) =>
      (wFilter === "all" || (w.cat || "") === wFilter) &&
      (!q ||
        [w.text, w.by, w.doneDate, dayOf(w.at), w.done ? "已完成" : "未完成", WCATS[w.cat || ""]].some((v) =>
          String(v || "")
            .toLowerCase()
            .includes(q),
        )),
  );
  $("wSearchN").textContent = q ? `找到 ${wishes.length} 個（完成 ${wishes.filter((w) => w.done).length} 個）` : "";
  if (!wishes.length) {
    box.innerHTML = `<div class="empty">${q ? `找不到「${esc(q)}」的願望。` : "這一類還沒有願望。"}</div>`;
    return;
  }
  const open = wishes
    .filter((w) => !w.done)
    .sort((a, b) => (a.plan && b.plan ? String(a.plan).localeCompare(b.plan) : a.plan ? -1 : b.plan ? 1 : byAt(b, a)));
  const tkW = key(today());
  // 約定日期：點膠囊選日期（日期選擇器蓋在膠囊上，iPhone 和 Android 都會跳出原生日曆）
  const planPill = (w) =>
    w.plan
      ? `<span class="plan-wrap"><label class="plan-pill on${w.plan < tkW ? " late" : ""}">📅 ${esc(mdw(w.plan))}` +
        `${w.plan === tkW ? " 就是今天" : w.plan < tkW ? " 過了" : ""}` +
        `<input type="date" data-plan="${esc(w.id)}" value="${esc(w.plan)}" min="${tkW}" aria-label="改約定日期"></label>` +
        `<button type="button" class="plan-x" data-planx="${esc(w.id)}" aria-label="取消約定日期">✕</button></span>`
      : `<label class="plan-pill">📅 約定日期<input type="date" data-plan="${esc(w.id)}" min="${tkW}" aria-label="選一個約定日期"></label>`;
  const closed = wishes.filter((w) => w.done).sort((a, b) => String(b.doneDate).localeCompare(String(a.doneDate)));
  const shortDone = (d) => {
    const v = String(d || "");
    return v.slice(0, 4) === String(new Date().getFullYear()) && v.length >= 10
      ? `${+v.slice(5, 7)}/${+v.slice(8, 10)}`
      : v;
  };
  const renderWishItem = (w) =>
    `<div class="wish ${w.done ? "done" : ""}"><button class="check" type="button" data-id="${esc(w.id)}` +
    `" aria-pressed="${!!w.done}" aria-label="${esc(w.text)}：${w.done ? "已完成，點一下取消" : "標記完成"}">✓</button>` +
    `<div class="t"><b>${escLink(w.text)}</b><div><button type="button" class="cat" data-cat="${esc(w.id)}` +
    `" aria-label="分類：${WCATS[w.cat || ""]}，點一下換分類">${WCATS[w.cat || ""]}</button>${esc(w.by || "")}` +
    ` 許的${w.done ? ` · <span class="nw">${esc(shortDone(w.doneDate))} 完成</span>` : ""}</div>` +
    (w.done
      ? /^\d{4}-\d{2}-\d{2}$/.test(String(w.doneDate || ""))
        ? `<div class="wish-extra"><button type="button" class="btn ghost small" data-wday="${esc(w.doneDate)}">看那天 ›</button></div>`
        : ""
      : `<div class="wish-extra">${planPill(w)}</div>`) +
    `</div>` +
    `<button class="btn ghost del" type="button" data-id="${esc(w.id)}">刪除</button></div>`;
  box.innerHTML =
    open.map(renderWishItem).join("") +
    (closed.length
      ? `<details class="month" id="wishDoneBox" ${wishDoneOpen || q || !open.length ? "open" : ""}>` +
        `<summary>✅ 已完成的願望<span>${closed.length} 個</span></summary>` +
        `<div class="month-body">${closed.map(renderWishItem).join("")}</div></details>`
      : "");
  const doneBox = $("wishDoneBox");
  if (doneBox)
    doneBox.addEventListener("toggle", () => {
      if (!q && open.length) wishDoneOpen = doneBox.open;
    });
  box.querySelectorAll(".check").forEach((b) => (b.onclick = () => toggleWish(b.dataset.id)));
  box.querySelectorAll("[data-cat]").forEach(
    (b) =>
      (b.onclick = () => {
        const w = store.wishes.find((x) => x.id === b.dataset.cat);
        if (!w) return;
        const ks = Object.keys(WCATS);
        updDoc("wishes", w.id, { cat: ks[(ks.indexOf(w.cat || "") + 1) % ks.length] });
      }),
  );
  box.querySelectorAll("[data-wday]").forEach(
    (b) =>
      (b.onclick = () => {
        openFor("calendar:" + b.dataset.wday);
        history.pushState(null, "", "#calendar:" + b.dataset.wday);
      }),
  );
  box
    .querySelectorAll("input[data-plan]")
    .forEach((inp) => inp.addEventListener("change", () => setWishPlan(inp.dataset.plan, inp.value)));
  box.querySelectorAll("[data-planx]").forEach((b) => (b.onclick = () => setWishPlan(b.dataset.planx, "")));
  armDelete(box, "wishes");
}
function setWishPlan(id, v) {
  const w = store.wishes.find((x) => x.id === id);
  if (!w || (w.plan || "") === v) return;
  if (v && !/^\d{4}-\d{2}-\d{2}$/.test(v)) return;
  updDoc("wishes", id, { plan: v || null });
  if (!v) {
    toast("取消約定日期了");
    return;
  }
  toast(`📅 約好 ${mdw(v)} 了`);
  notifyPartner(
    "📅 約好了！",
    `${myName()}把願望「${String(w.text || "").slice(0, 22)}」約在 ${mdw(v)}`,
    "#wishes",
    "wish-plan-" + id,
  );
}
function toggleWish(id) {
  const w = store.wishes.find((x) => x.id === id);
  if (!w) return;
  const on = !w.done;
  updDoc("wishes", id, { done: on, doneDate: on ? key(today()) : null });
  if (on) {
    toast("願望達成 🌠");
    notifyPartner(
      "🌠 願望達成！",
      `${myName()}完成了願望：「${String(w.text || "").slice(0, 26)}」`,
      "#wishes",
      "wish-done-" + id,
    );
  }
}
bindForm(
  "wishForm",
  "wSave",
  () => {
    const text = $("wText").value.trim();
    return text && { c: "wishes", doc: { text, cat: wCat, done: false, doneDate: null, by: myName(), at: nowIso() } };
  },
  () => {
    const text = $("wText").value.trim();
    $("wText").value = "";
    saveToast("許願成功 🌠");
    notifyPartner("🌠 新願望", `${myName()}許了一個願望：「${text.slice(0, 28)}」`, "#wishes", "wish-new");
  },
);

// 自訂題庫和任務
function renderCustom() {
  const box = $("customList"),
    items = store.custom
      .filter((c) => c.kind === "q")
      .sort(byAt)
      .reverse();
  box.innerHTML = items
    .map(
      (c) =>
        `<div class="citem"><span>💬 ${esc(c.text)}</span>` +
        `<button class="btn ghost del" type="button" data-id="${esc(c.id)}">刪除</button></div>`,
    )
    .join("");
  armDelete(box, "custom");
}
bindForm(
  "cqForm",
  "cqSave",
  () => {
    const text = $("cqText").value.trim();
    return text && { c: "custom", doc: { kind: "q", text, by: myName(), at: nowIso() } };
  },
  () => {
    $("cqText").value = "";
    toast("加進題庫了");
  },
);

// 時光膠囊
function renderCapsules() {
  const box = $("capList"),
    tk = key(today());
  if ($("capN")) $("capN").textContent = `${store.capsules.length} 顆`;
  if (!store.capsules.length) {
    box.innerHTML = '<div class="empty">還沒有膠囊。封存第一封寫給未來的信。</div>';
    return;
  }
  const acts = (c) =>
    `<div class="acts"><button class="btn ghost del" type="button" data-id="${esc(c.id)}">刪除</button></div>`;
  const opened = store.capsules.filter((c) => c.openDate <= tk).sort((a, b) => b.openDate.localeCompare(a.openDate));
  const sealed = store.capsules.filter((c) => c.openDate > tk).sort((a, b) => a.openDate.localeCompare(b.openDate));
  box.innerHTML = [
    ...opened.map(
      (c) =>
        `<article class="entry"><header><b>💌 ${esc(c.openDate)} 打開的膠囊</b><span>${esc(nameOf(c.by))}` +
        `寫於 ${esc(dayOf(c.at))}</span></header><p class="letter">${esc(c.text)}</p>${acts(c)}</article>`,
    ),
    ...sealed.map(
      (c) =>
        `<article class="entry sealed"><header><b>🔒 封存中</b><span>${esc(nameOf(c.by))}寫於 ${esc(dayOf(c.at))}</span>` +
        `</header><p class="letter">${esc(c.openDate)} 打開，還有 ${Math.round((fromKey(c.openDate) - today()) / 864e5)}` +
        ` 天</p>${acts(c)}</article>`,
    ),
  ].join("");
  armDelete(box, "capsules");
}
const CAP_DRAFT_KEY = "love-base-cap-draft";
function saveCapDraft() {
  const text = $("capText").value,
    openDate = $("capDate").value;
  if (text.trim()) lsSet(CAP_DRAFT_KEY, JSON.stringify({ text, openDate }));
  else lsDel(CAP_DRAFT_KEY);
}
function restoreCapDraft() {
  const d = lsJson(CAP_DRAFT_KEY);
  if (!d || !d.text) return;
  $("capText").value = d.text;
  if (d.openDate && d.openDate > key(today())) $("capDate").value = d.openDate;
  grow($("capText"));
}
$("capText").addEventListener("input", saveCapDraft);
$("capDate").addEventListener("change", saveCapDraft);
bindForm(
  "capForm",
  "capSave",
  () => {
    const text = $("capText").value.trim(),
      openDate = $("capDate").value;
    if (!text || !openDate) return null;
    if (openDate <= key(today())) {
      $("capMsg").textContent = "打開的日期要選明天以後";
      return null;
    }
    $("capMsg").textContent = "";
    return { c: "capsules", doc: { text, openDate, by: myName(), at: nowIso() } };
  },
  () => {
    lsDel(CAP_DRAFT_KEY);
    $("capText").value = "";
    grow($("capText"));
    saveToast("封存好了 ⏳");
    notifyPartner("⏳ 時光膠囊", `${myName()}封存了一顆寫給未來的時光膠囊`, "#capsule", "cap-new");
  },
);

// 回憶：一週前、一個月前、歷年的今天（主頁顯示小按鈕，點了跳到「回憶 → 回顧」）
function onThisDayHits() {
  const t = today(),
    m = new Date(t.getFullYear(), t.getMonth() - 1, t.getDate());
  const slots = [];
  for (let yr = t.getFullYear() - 1; yr >= LOVE_START.getFullYear(); yr--) {
    const y = new Date(yr, t.getMonth(), t.getDate()),
      diff = t.getFullYear() - yr;
    if (y.getDate() === t.getDate() && y >= LOVE_START)
      slots.push([diff === 1 ? "一年前的今天" : `${diff} 年前的今天`, y]);
  }
  slots.push(["一個月前的今天", m.getDate() === t.getDate() && m], ["一週前的今天", addDays(t, -7)]);
  const allPh = calAllPhotos();
  return slots
    .filter((x) => x[1])
    .map(([label, d]) => {
      const k = key(d);
      loadCalPhotos(k.slice(0, 7));
      const es = entries.filter((e) => e.date === k).sort(byAt),
        ps = allPh.filter((p) => p.date === k);
      return [label, k, es, ps];
    })
    .filter(([, , es, ps]) => es.length || ps.length);
}
function renderOnThisDay() {
  const hits = onThisDayHits(),
    title = hits.length === 1 ? `🕰️ ${hits[0][0]}` : "🕰️ 那年的今天",
    n = hits.reduce((s, [, , es, ps]) => s + es.length + ps.length, 0),
    sub = !hits.length
      ? "尚無紀錄"
      : hits.length === 1
        ? `${hits[0][1]} · ${n} 則`
        : `${hits.map((h) => h[0].replace("的今天", "")).join("、")} · ${n} 則`;
  if ($("otdTitle")) $("otdTitle").innerHTML = `${title}<span id="otdN">${sub}</span>`;
  $("otdBody").innerHTML = hits.length
    ? hits
        .map(
          ([label, k, es, ps]) =>
            `<article class="entry"><header><b>🕰️ ${label}</b><span>${esc(k)}</span></header>` +
            `${es
              .map(
                (e) =>
                  `<div>${byChip(e.by)}${e.happy ? ` <span class="edited">⭐ ${esc(e.happy)}/10</span>` : ""}</div>` +
                  `<dl>${diaryDl(e)}</dl>${diaryQuote(e)}`,
              )
              .join("")}` +
            `${ps.length ? `<div class="wall-grid">${ps.map((p) => photoBtn(p, "")).join("")}</div>` : ""}</article>`,
        )
        .join("")
    : '<div class="empty">一週前、一個月前、一年前的今天寫過日記或傳過照片，就會出現在這裡。</div>';
}
function renderTodayFlashback() {
  const btn = $("otdBtn");
  if (!btn) return;
  const hits = onThisDayHits();
  btn.hidden = !hits.length;
  if (hits.length) btn.textContent = "🕰️ " + hits[0][0];
}
function renderChart() {
  const box = $("hChart"),
    t = today(),
    days = [...Array(30)].map((_, i) => addDays(t, i - 29)),
    fmt = (d) => d.getMonth() + 1 + "/" + d.getDate();
  const happyByDay = new Map();
  entries.forEach((e) => {
    if (!e.happy) return;
    if (!happyByDay.has(e.date)) happyByDay.set(e.date, []);
    happyByDay.get(e.date).push(+e.happy);
  });
  const pts = days
    .map((d, i) => {
      const v = happyByDay.get(key(d));
      return v ? { i, d, v: v.reduce((a, b) => a + b, 0) / v.length } : null;
    })
    .filter(Boolean);
  if (pts.length < 2) {
    box.innerHTML = '<div class="empty">至少兩天的日記有打幸福指數，就會畫出曲線。</div>';
    return;
  }
  const W = Math.max(280, box.clientWidth || 640),
    H = 180,
    L = 24,
    R = 10,
    T = 20,
    B = 22;
  const x = (i) => L + (i / 29) * (W - L - R),
    y = (v) => T + ((10 - v) / 9) * (H - T - B),
    polyPts = pts.map((p) => x(p.i) + "," + y(p.v)).join(" "),
    areaPts = `${x(pts[0].i)},${H - B} ${polyPts} ${x(pts[pts.length - 1].i)},${H - B}`;
  box.innerHTML =
    `<svg viewBox="0 0 ${W} ${H}` +
    `" role="img" aria-label="最近 30 天幸福指數曲線"><defs><linearGradient id="hGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="var(--pink)" stop-opacity=".34"/><stop offset="100%" stop-color="var(--pink)" stop-opacity="0"/></linearGradient></defs>${[1, 5, 10].map((v) => `<line class="grid" x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}"/><text class="axis" x="${L - 6}" y="${y(v) + 4}` + `" text-anchor="end">${v}</text>`).join("")}` +
    `<text class="axis" x="${L}" y="${H - 4}">${fmt(days[0])}</text><text class="axis" x="${W - R}" y="${H - 4}` +
    `" text-anchor="end">今天</text><polygon points="${areaPts}" fill="url(#hGrad)"/><polyline class="line" points="${polyPts}` +
    `"/>${pts.map((p, n) => `<circle class="dot" data-n="${n}" cx="${x(p.i)}" cy="${y(p.v)}" r="5"/>`).join("")}</svg>` +
    `<button type="button" class="tip hint">👆 在曲線上左右滑，看每一天</button>`;
  const svg = box.querySelector("svg"),
    tip = box.querySelector(".tip");
  // 手指在曲線上左右滑（或滑鼠移過去），經過哪一天就顯示那天的分數；點提示就跳到月曆的那一天
  let picked = null;
  const pick = (ev) => {
    const r = svg.getBoundingClientRect(),
      px = ((ev.clientX - r.left) / r.width) * W;
    const p = pts.reduce((a, b) => (Math.abs(x(b.i) - px) < Math.abs(x(a.i) - px) ? b : a));
    if (p === picked) return;
    if (picked) sliderTick();
    picked = p;
    tip.textContent = `${fmt(p.d)} · ⭐ ${Math.round(p.v * 10) / 10} · 看那天 ›`;
    tip.classList.remove("hint");
    tip.style.left = Math.min(80, Math.max(20, (x(p.i) / W) * 100)) + "%";
    svg.querySelectorAll(".dot").forEach((c) => c.classList.toggle("sel", +c.dataset.n === pts.indexOf(p)));
  };
  svg.onpointerdown = (ev) => {
    pick(ev);
    try {
      svg.setPointerCapture(ev.pointerId);
    } catch (e) {}
  };
  svg.onpointermove = pick;
  tip.onclick = () => {
    if (!picked) return;
    const d = key(picked.d);
    openFor("calendar:" + d);
    history.pushState(null, "", "#calendar:" + d);
  };
}
// 統計小卡：數字大、單位小，排在同一行
function statTile([label, v]) {
  const m = String(v).match(/^([\d.]+|—|-)\s*(.*)$/),
    num = m ? m[1] : String(v),
    unit = m ? m[2] : "";
  return `<div class="stat"><span>${label}</span><b>${esc(num)}${unit ? `<small>${esc(unit)}</small>` : ""}</b></div>`;
}
function renderMonth() {
  const pick = $("mPick"),
    keep = pick.value,
    cur = key(today()).slice(0, 7),
    months = bookMonths();
  pick.innerHTML = months.map((m) => `<option value="${m}">${m.replace("-", " 年 ")} 月</option>`).join("");
  pick.value = months.includes(keep) ? keep : cur;
  const m = pick.value,
    inR = (k) => String(k).startsWith(m),
    es = entries.filter((e) => inR(e.date)),
    ps = calAllPhotos().filter((p) => inR(p.date));
  loadCalPhotos(m);
  const { tiles, best } = bookSummaryData(es, ps, inR);
  $("mStats").innerHTML = tiles.map(statTile).join("");
  const funny = es.filter((e) => e.funny).slice(-3);
  $("mBest").innerHTML =
    (best ? `<p>⭐ 最幸福的一天：${esc(best.date)}（${esc(best.happy)}/10）${esc(bookSay(best))}</p>` : "") +
      funny.map((e) => `<p>🤪 ${esc(e.date)}：${esc(e.funny)}</p>`).join("") || '<p class="sub">這個月還沒有日記。</p>';
}
$("mPick").onchange = renderMonth;
window.addEventListener(
  "resize",
  debounce(() => {
    if ($("memories").classList.contains("open")) renderChart();
  }, 180),
);
function renderReviewsPast() {
  const days = [...new Set(store.reviews.map((r) => r.date))].sort().reverse();
  $("reviewN").textContent = `${days.length} 週`;
  $("reviewPast").innerHTML = days.length
    ? days
        .map(
          (d) =>
            `<article class="entry"><header><b>${esc(d)}</b></header>` +
            `<dl>${store.reviews
              .filter((r) => r.date === d)
              .sort(byAt)
              .map((r) => `<dt>${esc(r.by)}</dt><dd>${esc(r.text)}</dd>`)
              .join("")}` +
            `</dl></article>`,
        )
        .join("")
    : '<div class="empty">星期日寫下這週回顧，就會收在這裡。</div>';
}
function renderMemories() {
  renderOnThisDay();
  renderReviewsPast();
  renderCapsules();
  renderChart();
  renderMonth();
}
let lastGachaKey = "";
$("gachaBtn").onclick = () => {
  sliderTick();
  const pool = [],
    tk = key(today()),
    jumpBtn = (d) =>
      d
        ? `<div class="entry-acts"><div class="acts"><button type="button" class="btn ghost small" data-gachaday="${esc(d)}">📅 看這一天</button></div></div>`
        : "";
  entries.forEach((e) => {
    const text = e.say || e.mood || e.funny || e.food || e.s1 || e.s2 || "",
      phs = entryPhotos(e.id);
    if (text || phs.length)
      pool.push({
        k: "e:" + e.id,
        html:
          `<article class="entry"><header><b>💌 ${esc(e.date)} 的日記</b>` +
          `<span>${esc(e.by || "")}${e.happy ? ` · ⭐ ${esc(e.happy)}/10` : ""}</span></header>` +
          `<dl>${diaryDl(e)}</dl>${diaryQuote(e)}` +
          `${phs.length ? `<div class="wall-grid">${phs.map((p) => photoBtn(p, "")).join("")}</div>` : ""}${jumpBtn(e.date)}</article>`,
      });
  });
  calAllPhotos().forEach((p) => {
    pool.push({
      k: "p:" + p.id,
      html:
        `<article class="entry"><header><b>📷 ${esc(p.date)} 的照片</b><span>${esc(p.by || "")}</span></header>` +
        `<div class="wall-grid">${photoBtn(p, "")}</div>` +
        `${p.cap ? `<div>「${esc(p.cap)}」</div>` : ""}${jumpBtn(p.date)}</article>`,
    });
  });
  store.rounds
    .filter((r) => pairOf(r.id).length >= need())
    .forEach((r) => {
      const d = roundDay(r);
      pool.push({
        k: "r:" + r.id,
        html:
          `<article class="entry"><header><b>🎲 ${esc(d)} 的抽題問答</b></header>` +
          `<div><b>${esc(r.q)}</b></div><dl>${pairOf(r.id)
            .map((a) => `<dt>${esc(nameOf(a.by))}</dt><dd>${esc(a.text)}</dd>`)
            .join("")}</dl>${jumpBtn(d)}</article>`,
      });
    });
  store.wishes
    .filter((w) => w.done)
    .forEach((w) => {
      const d = w.doneDate || dayOf(w.at);
      pool.push({
        k: "w:" + w.id,
        html:
          `<article class="entry"><header><b>🌠 ${esc(d)} 達成的願望</b>` +
          `<span>${esc(w.by || "")} 許的</span></header><div>✅ ${esc(w.text)}</div>${jumpBtn(d)}</article>`,
      });
    });
  [...new Set(store.reviews.map((r) => r.date))].forEach((d) => {
    const revs = store.reviews.filter((r) => r.date === d).sort(byAt);
    pool.push({
      k: "v:" + d,
      html:
        `<article class="entry"><header><b>📝 ${esc(d)} 的每週回顧</b></header>` +
        `<dl>${revs.map((r) => `<dt>${esc(nameOf(r.by))}</dt><dd>${esc(r.text)}</dd>`).join("")}</dl>${jumpBtn(d)}</article>`,
    });
  });
  store.capsules
    .filter((c) => c.openDate <= tk)
    .forEach((c) => {
      pool.push({
        k: "c:" + c.id,
        html:
          `<article class="entry"><header><b>💌 ${esc(c.openDate)} 打開的時光膠囊</b>` +
          `<span>${esc(nameOf(c.by))}寫於 ${esc(dayOf(c.at))}</span></header><p class="letter">${esc(c.text)}</p>${jumpBtn(c.openDate)}</article>`,
      });
    });
  if (!pool.length) {
    $("gachaBox").innerHTML = '<div class="empty">還沒有足夠的回憶可以抽，先去傳張照片或答一題抽題吧！</div>';
    return;
  }
  const cand = pool.length > 1 ? pool.filter((x) => x.k !== lastGachaKey) : pool;
  const pick = cand[Math.floor(Math.random() * cand.length)];
  lastGachaKey = pick.k;
  const gBox = $("gachaBox");
  gBox.innerHTML = pick.html;
  gBox.querySelectorAll("[data-gachaday]").forEach(
    (b) =>
      (b.onclick = () => {
        const d = b.dataset.gachaday;
        calMonth = d.slice(0, 7);
        calDay = d;
        openFor("calendar");
        history.pushState(null, "", "#calendar");
      }),
  );
  gBox.classList.remove("gacha-pop");
  void gBox.offsetWidth;
  gBox.classList.add("gacha-pop");
  $("gachaBtn").textContent = "🎲 再抽一個";
};

// 月曆：照片牆只載入最近幾十張，所以看哪個月就另外抓那個月的照片
let calMonth = key(today()).slice(0, 7),
  calDay = key(today()),
  calPhotos = [],
  _allPh = null,
  _phRef = null,
  _calPhRef = null,
  _phLen = -1,
  _calPhLen = -1;
const calLoaded = new Set();
function calAllPhotos() {
  if (
    _allPh &&
    _phRef === photos &&
    _calPhRef === calPhotos &&
    _phLen === photos.length &&
    _calPhLen === calPhotos.length
  )
    return _allPh;
  const m = new Map();
  [...calPhotos, ...photos].forEach((p) => m.set(p.id, p));
  _phRef = photos;
  _calPhRef = calPhotos;
  _phLen = photos.length;
  _calPhLen = calPhotos.length;
  _allPh = [...m.values()];
  return _allPh;
}
const calFailed = new Set();
function loadCalPhotos(m) {
  if (!db || calLoaded.has(m)) return;
  calLoaded.add(m);
  calFailed.delete(m);
  db.collection("photos")
    .where("date", ">=", m + "-01")
    .where("date", "<=", m + "-31")
    .get()
    .then((s) => {
      const ids = new Set(s.docs.map((d) => d.id));
      calPhotos = calPhotos
        .filter((p) => !ids.has(p.id))
        .concat(s.docs.map((d) => ({ id: d.id, ...d.data() })).filter((p) => !p.trashed));
      _entryMeta = null;
      renderVer++;
      renderOpen();
    })
    .catch(() => {
      calLoaded.delete(m);
      calFailed.add(m);
      if (navigator.onLine) toast("這個月的照片沒載到，連網後會自動重試");
    });
}
function retryFailedCalPhotos() {
  if (!calFailed.size || !navigator.onLine) return;
  const list = [...calFailed];
  calFailed.clear();
  list.forEach((m) => loadCalPhotos(m));
}
// 月曆上的特別日子（到了才顯示）：週年、在一起的里程碑、生日、七夕、每月紀念日
const MILE_DAYS = [30, 50, 100, 200, 300, 500, 520, 600, 700, 800, 900, 1000, 1314];
const LUNAR = (() => {
  try {
    return new Intl.DateTimeFormat("zh-TW-u-ca-chinese", { month: "numeric", day: "numeric" });
  } catch (e) {
    return null;
  }
})();
function isQixi(dt) {
  if (!LUNAR) return false;
  const p = LUNAR.formatToParts(dt);
  return p.find((x) => x.type === "month")?.value === "7" && p.find((x) => x.type === "day")?.value === "7";
}
function calSpecial(k) {
  return k > key(today()) ? null : specialOf(k);
}
function specialOf(k) {
  const dt = fromKey(k),
    n = Math.round((dt - LOVE_START) / 864e5) + 1;
  if (n < 1) return null;
  const sameDay = dt.getDate() === LOVE_START.getDate();
  if (n > 1 && sameDay && dt.getMonth() === LOVE_START.getMonth()) {
    return { emo: "🎉", text: `${dt.getFullYear() - LOVE_START.getFullYear()} 週年` };
  }
  if (MILE_DAYS.includes(n) || (n >= 100 && n % 100 === 0)) return { emo: "🎊", text: `在一起第 ${n} 天` };
  const bd = NAMES.filter((who) => {
    const b = bdayOf(who);
    return b && b.m === dt.getMonth() + 1 && b.d === dt.getDate();
  });
  if (bd.length) return { emo: "🎂", text: bd.join("、") + "的生日" };
  if (isQixi(dt)) return { emo: "🎋", text: "七夕情人節" };
  if (n > 1 && sameDay) {
    const months = (dt.getFullYear() - LOVE_START.getFullYear()) * 12 + dt.getMonth() - LOVE_START.getMonth();
    return { emo: "💝", text: `在一起滿 ${months} 個月` };
  }
  return null;
}
/* ===== 回憶月曆與回顧 ===== */
function renderCalendar() {
  loadCalPhotos(calMonth);
  $("diaryN").textContent = `${entries.length} 篇`;
  const [y, m] = calMonth.split("-").map(Number),
    t = today(),
    tk = key(t),
    cur = tk.slice(0, 7);
  const offset = dow(new Date(y, m - 1, 1)),
    count = new Date(y, m, 0).getDate(),
    ps = calAllPhotos(),
    diaryDays = new Set(entries.map((e) => e.date)),
    photoDays = new Set(ps.map((p) => p.date)),
    together = new Set(togetherDays());
  const earliest = [key(LOVE_START).slice(0, 7), ...entries.map((e) => String(e.date).slice(0, 7))].sort()[0];
  $("calTitle").textContent = `${y} 年 ${m} 月`;
  $("calToday").hidden = calMonth === cur && calDay === tk;
  $("calPrev").disabled = calMonth <= earliest;
  const lastPlanMonth = planned().reduce((a, w) => (w.plan.slice(0, 7) > a ? w.plan.slice(0, 7) : a), cur);
  $("calNext").disabled = calMonth >= lastPlanMonth;
  let h = "<span></span>".repeat(offset);
  for (let d = 1; d <= count; d++) {
    const k = calMonth + "-" + pad(d);
    const marks = [
      [diaryDays.has(k), "diary", "日記"],
      [photoDays.has(k), "photo", "照片"],
      [together.has(k), "task", "一起完成"],
      [plansOn(k).length > 0, "plan", "約定"],
    ].filter((x) => x[0]);
    const sp = calSpecial(k),
      isToday = k === tk,
      both = isToday && together.has(k),
      doneBy = isToday && !both ? [...whoDid(dayRecords().get(k) || { diary: [], photo: [] })] : [],
      half = doneBy.length > 0,
      who = (n) => (n === myName() ? "我" : n),
      halfText = half
        ? `，${doneBy.map(who).join("、")}已完成、等${NAMES.filter((n) => !doneBy.includes(n))
            .map(who)
            .join("、")}`
        : "";
    h +=
      `<button type="button" data-d="${k}" class="${marks.length ? "has" : ""} ${isToday ? "today" : ""}` +
      `${both ? " both" : ""}${half ? " half" : ""}${sp ? " special" : ""}" aria-pressed="${k === calDay}"` +
      ` aria-label="${isToday ? "今天，" : ""}${m} 月 ${d} 日${halfText}${sp ? "，" + sp.text : ""}` +
      `${marks.length ? "，有" + marks.map((x) => x[2]).join("、") : ""}" ${sp ? `title="${sp.text}"` : ""}` +
      ` ${k > tk && !plansOn(k).length ? "disabled" : ""}>` +
      `${sp ? `<span class="cal-sp" aria-hidden="true">${sp.emo}</span>` : ""}${d}` +
      `<span class="dots">${marks.map((x) => `<i class="d-${x[1]}"></i>`).join("")}</span>` +
      `</button>`;
  }
  $("calGrid").innerHTML = h;
  $("calGrid")
    .querySelectorAll("button")
    .forEach(
      (b) =>
        (b.onclick = () => {
          const same = calDay === b.dataset.d;
          calDay = same ? null : b.dataset.d;
          renderCalendar();
          if (same) $("diaryMore").open = true;
        }),
    );
  renderCalDetail();
}
function renderCalDetail() {
  const box = $("calDetail"),
    k = calDay;
  if (!k) {
    if (replyTo && replyTo.where === "cal") closeReply();
    box.innerHTML = "";
    return;
  }
  const dt = fromKey(k),
    label = `${dt.getMonth() + 1}/${dt.getDate()}（${"日一二三四五六"[dt.getDay()]}）`,
    tk = key(today());
  const es = entries.filter((e) => e.date === k).sort(byAt),
    ps = calAllPhotos().filter((p) => p.date === k && !p.entry),
    ws = store.wishes.filter((w) => w.done && w.doneDate === k),
    rs = store.rounds.filter((r) => roundDay(r) === k && pairOf(r.id).length >= need()).sort(byAt),
    revs = store.reviews.filter((r) => r.date === k).sort(byAt),
    caps = store.capsules.filter((c) => c.openDate === k && c.openDate <= tk),
    pls = plansOn(k);
  if (!es.length && !ps.length && !ws.length && !rs.length && !revs.length && !caps.length && !pls.length) {
    box.innerHTML = `<div class="empty">${label} 還沒有紀錄。</div>`;
    return;
  }
  box.innerHTML =
    `<article class="entry"><header><b>📅 ${label}</b></header>` +
    `${pls.map((w) => `<div>📅 約好要：${escLink(w.text)}</div>`).join("")}` +
    `${ws.map((w) => `<div>🌠 達成願望：${esc(w.text)}</div>`).join("")}` +
    `${caps.map((c) => `<div>💌 打開時光膠囊（${esc(nameOf(c.by))}）：${esc(c.text)}</div>`).join("")}` +
    `${ps.length ? `<div class="wall-grid">${ps.map((p) => photoBtn(p, "")).join("")}</div>` : ""}</article>` +
    rs
      .map(
        (r) =>
          `<article class="entry"><header><b>🎲 ${esc(r.q)}</b></header>` +
          `<dl>${pairOf(r.id)
            .map((a) => `<dt>${esc(nameOf(a.by))}</dt><dd>${esc(a.text)}</dd>`)
            .join("")}</dl></article>`,
      )
      .join("") +
    (revs.length
      ? `<article class="entry"><header><b>📝 這週回顧</b></header>` +
        `<dl>${revs.map((r) => `<dt>${esc(nameOf(r.by))}</dt><dd>${esc(r.text)}</dd>`).join("")}</dl></article>`
      : "") +
    es.map((e) => diaryCard(e, "cal")).join("");
  bindEntryActs(box, "cal");
}
function shiftCal(n) {
  const [y, m] = calMonth.split("-").map(Number);
  calMonth = key(new Date(y, m - 1 + n, 1)).slice(0, 7);
  calDay = calMonth === key(today()).slice(0, 7) ? key(today()) : null;
  renderCalendar();
}
$("calPrev").onclick = () => shiftCal(-1);
$("calNext").onclick = () => shiftCal(1);
$("calToday").onclick = () => {
  const tk = key(today());
  calMonth = tk.slice(0, 7);
  calDay = tk;
  renderCalendar();
};

// 加到主畫面
let installEvt = null;
const isStandalone = () => matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
const isIOS =
  /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
function renderInstall() {
  $("installBtn").hidden = !installEvt || isStandalone();
  $("installText").textContent = isStandalone()
    ? "已經在主畫面上了 ✓"
    : installEvt
      ? "按下面的按鈕，手機桌面就會多一個基地圖示。"
      : isIOS
        ? "用 Safari 打開這個網址，按分享按鈕，選「加入主畫面」。第一次從主畫面打開時，要再輸入一次暗號和名字。"
        : "打開瀏覽器的選單，選「加到主畫面」或「安裝應用程式」。";
}
window.addEventListener("beforeinstallprompt", (ev) => {
  ev.preventDefault();
  installEvt = ev;
  renderInstall();
});
window.addEventListener("appinstalled", () => {
  installEvt = null;
  renderInstall();
  toast("加好了 📱");
});
$("installBtn").onclick = async () => {
  const e = installEvt;
  if (!e) return;
  installEvt = null;
  e.prompt();
  try {
    await e.userChoice;
  } catch (err) {}
  renderInstall();
};

// 備份：匯出整個房間；補回時只新增目前沒有的資料，不改動現有內容
const BK_COLLS = ["done", "diary", "pics", "photos"],
  BK_KEY = "love-base-last-backup";
let bkPending = [];
const bkMsg = (t) => ($("bkMsg").textContent = t);
// 備份檔是一個 HTML：打開是排好版的日記，裡面同時藏著還原用的完整資料
const BK_TAG = '<script type="application/json" id="love-base-backup">';
function backupPayload(t) {
  const i = t.indexOf(BK_TAG);
  if (i < 0) return t;
  const a = i + BK_TAG.length;
  return t.slice(a, t.indexOf("<" + "/script>", a));
}
function backupHtml(b) {
  const live = (o) =>
    Object.entries(o || {})
      .map(([id, v]) => ({ id, ...v }))
      .filter((x) => !x.trashed);
  const xs = (c) =>
    Object.entries(b.data.done || {})
      .filter(([k]) => k.startsWith(`x~${c}~`))
      .map(([k, v]) => ({ id: k.split("~")[2], ...v }))
      .filter((x) => !x.trashed)
      .sort(byAt);
  const diary = live(b.data.diary).sort((x, y) => (String(x.date) + x.at).localeCompare(String(y.date) + y.at)),
    photos = live(b.data.photos).sort(byAt),
    pics = b.data.pics || {},
    imgSrc = (p) => pics[p.id]?.img || p.th,
    replies = xs("replies"),
    repliesByEntry = new Map(),
    photosByEntry = new Map(),
    dailyPhotosByKey = new Map(),
    firstIds = new Set(),
    seenFirst = new Set();
  replies.forEach((r) => {
    if (!repliesByEntry.has(r.entry)) repliesByEntry.set(r.entry, []);
    repliesByEntry.get(r.entry).push(r);
  });
  photos.forEach((p) => {
    if (p.entry) {
      if (!photosByEntry.has(p.entry)) photosByEntry.set(p.entry, []);
      photosByEntry.get(p.entry).push(p);
    } else if (p.date && p.by) {
      const k = p.date + "_" + p.by;
      if (!dailyPhotosByKey.has(k)) dailyPhotosByKey.set(k, []);
      dailyPhotosByKey.get(k).push(p);
    }
  });
  for (const [k, list] of dailyPhotosByKey) list.sort((x, y) => (y.id === k) - (x.id === k) || byAt(x, y));
  diary.forEach((e) => {
    const k = e.date + "_" + e.by;
    if (!seenFirst.has(k)) {
      seenFirst.add(k);
      firstIds.add(e.id);
    }
  });
  const wk = "日一二三四五六",
    tk = key(today());
  const months = [...new Set(diary.map((e) => String(e.date).slice(0, 7)))];
  const mName = (m) => {
    const [y, mo] = m.split("-").map(Number);
    return `${y} 年 ${mo} 月`;
  };
  const article = (e) => {
    const dt = fromKey(e.date),
      rs = repliesByEntry.get(e.id) || [],
      texts = rs.filter((r) => r.kind === "text"),
      first = firstIds.has(e.id);
    const phs = [...(first ? dailyPhotosByKey.get(e.date + "_" + e.by) || [] : []), ...(photosByEntry.get(e.id) || [])];
    return (
      `<article><h3>${esc(e.date)}（${wk[dt.getDay()]}）<span>${esc(e.by || "未署名")}` +
      `${e.happy ? ` · ⭐ ${esc(e.happy)}/10` : ""}</span></h3>` +
      `<dl>${[
        ["心情", e.mood],
        ["吃了", e.food],
        ["最好笑", e.funny],
        ["想對你說", e.say],
      ]
        .filter((r) => r[1])
        .map((r) => `<dt>${r[0]}</dt><dd>${esc(r[1])}</dd>`)
        .join("")}` +
      `</dl>${diaryQuote(e)}` +
      `${phs.map((p) => `<img src="${esc(imgSrc(p))}" alt="當天的照片" loading="lazy" decoding="async">`).join("")}` +
      `${texts.map((r) => `<p class="re"><b>${esc(r.by)}</b> ${esc(r.text)}</p>`).join("")}</article>`
    );
  };
  const wishes = xs("wishes"),
    caps = xs("capsules"),
    rounds = xs("rounds"),
    answers = xs("answers"),
    ansByRound = new Map(),
    wall = photos.filter((p) => !p.entry),
    reviews = xs("reviews");
  answers.forEach((a) => {
    if (!ansByRound.has(a.round)) ansByRound.set(a.round, []);
    ansByRound.get(a.round).push(a);
  });
  const passed = rounds.filter((r) => new Set((ansByRound.get(r.id) || []).map((a) => a.by)).size >= 2);
  const part = (id, title, body) => (body ? `<section id="${id}"><h2>${title}</h2>${body}</section>` : "");
  const json = JSON.stringify(b).replace(/</g, "\\u003c");
  return (
    `<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8">` +
    `<meta name="viewport" content="width=device-width,initial-scale=1"><title>戀愛基地備份 ${esc(dayOf(b.exportedAt))}` +
    `</title><style>
:root{color-scheme:light}body{margin:0;background:#fbf6f8;color:#2a1b25;font:16px/1.75 "Noto Sans TC","PingFang TC","Microsoft JhengHei",system-ui,sans-serif}
main{max-width:680px;margin:0 auto;padding:32px 16px 64px}h1{font-size:28px;margin:0}header p{margin:4px 0;color:#7c6672}
nav{display:flex;flex-wrap:wrap;gap:6px;margin:16px 0 0}nav a{background:#fff;border:1px solid #ead9e1;border-radius:99px;padding:2px 12px;color:#2a1b25;text-decoration:none;font-size:14px}
h2{font-size:20px;margin:36px 0 12px;padding-bottom:6px;border-bottom:2px solid #e2457a}h3{font-size:16px;margin:0 0 6px;display:flex;justify-content:space-between;flex-wrap:wrap;gap:4px 12px}h3 span{font-weight:400;font-size:14px;color:#7c6672}
article{background:#fff;border:1px solid #ead9e1;border-radius:12px;padding:14px 16px;margin:0 0 12px;break-inside:avoid;overflow-wrap:anywhere}dl{display:grid;grid-template-columns:auto 1fr;gap:2px 12px;margin:0}dt{color:#7c6672}dd{margin:0;white-space:pre-wrap}
blockquote{margin:8px 0 0;padding:8px 12px;background:#fde3ec;border-radius:8px}article img{display:inline-block;margin-right:8px;width:140px;height:140px;object-fit:cover;border-radius:8px;margin-top:8px}.re{margin:6px 0 0;padding:4px 10px;background:#f4ebef;border-radius:8px;font-size:14px}
ul{margin:0;padding-left:1.3em}.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:8px}figure{margin:0;font-size:13px;color:#7c6672}figure img{width:100%;aspect-ratio:1;object-fit:cover;border-radius:8px;display:block}
</style>` +
    `</head><body><main><header><h1>我們的戀愛遊戲基地</h1><p>備份於 ${esc(dayOf(b.exportedAt))} · ${diary.length}` +
    ` 篇日記 · ${photos.length} 張照片${b.full ? " · 含原圖" : ""}</p><p>要救回資料時，到網站的「資料備份」選「從備份檔補回資料」，選這個檔案就可以。</p>` +
    `<nav>${months.map((m) => `<a href="#m${m}">${mName(m)}</a>`).join("")}` +
    `${reviews.length ? '<a href="#reviews">回顧</a>' : ""}${wishes.length ? '<a href="#wishes">願望</a>' : ""}` +
    `${passed.length ? '<a href="#draw">抽題</a>' : ""}${caps.length ? '<a href="#caps">膠囊</a>' : ""}` +
    `${wall.length ? '<a href="#wall">照片</a>' : ""}</nav>` +
    `</header>
${months
  .map((m) => {
    const list = diary.filter((e) => String(e.date).startsWith(m));
    return part("m" + m, `${mName(m)}（${list.length} 篇）`, list.map(article).join(""));
  })
  .join("")}` +
    `
${part(
  "reviews",
  "每週回顧",
  [...new Set(reviews.map((r) => r.date))]
    .sort()
    .map(
      (d) =>
        `<article><h3>${esc(d)}</h3>` +
        `<dl>${reviews
          .filter((r) => r.date === d)
          .map((r) => `<dt>${esc(r.by)}</dt><dd>${esc(r.text)}</dd>`)
          .join("")}</dl>` +
        `</article>`,
    )
    .join(""),
)}` +
    `
${part("wishes", "願望清單", wishes.length ? `<ul>${wishes.map((w) => `<li>${w.done ? "✅" : "⬜"} ${esc(w.text)}${w.done ? `（${esc(w.doneDate)} 完成）` : ""}</li>`).join("")}</ul>` : "")}` +
    `
${part(
  "draw",
  "抽題紀錄",
  passed
    .map(
      (r) =>
        `<article><h3>${esc(r.q)}<span>${esc(roundDay(r))}</span></h3>` +
        `<dl>${[...new Map((ansByRound.get(r.id) || []).sort(byAt).map((a) => [a.by, a])).values()]
          .map((a) => `<dt>${esc(a.by)}</dt><dd>${esc(a.text)}</dd>`)
          .join("")}` +
        `</dl></article>`,
    )
    .join(""),
)}` +
    `
${part("caps", "時光膠囊", caps.map((c) => `<article><h3>${c.openDate > tk ? "🔒 封存中" : "💌 已打開"}<span>${esc(c.by)} · ${esc(c.openDate)} 打開</span>` + `</h3>${c.openDate > tk ? "" : `<p style="margin:0;white-space:pre-wrap">${esc(c.text)}</p>`}</article>`).join(""))}` +
    `
${part("wall", "照片", wall.length ? `<div class="grid">${wall.map((p) => `<figure><img src="${esc(imgSrc(p))}" alt="${esc(p.by)} 的照片" loading="lazy" decoding="async">${esc(p.date)} · ${esc(p.by)}` + `${p.cap ? `<br>${esc(p.cap)}` : ""}</figure>`).join("")}` + `</div>` : "")}` +
    `
</main>${BK_TAG}${json}<${"/"}script></body></html>`
  );
}
// 讓瀏覽器下載一個檔案（備份、照片、照片壓縮檔都用這個）
function downloadBlob(name, blob) {
  const a = document.createElement("a"),
    url = URL.createObjectURL(blob);
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
function saveFile(name, text) {
  downloadBlob(name, new Blob([text], { type: "text/html;charset=utf-8" }));
}
function showLastBackup() {
  let v = lsGet(BK_KEY);
  bkMsg(v ? `這台裝置上次備份：${v}` : "這台裝置還沒備份過。");
}
/* ===== 資料備份、還原與空間管理 ===== */
async function exportBackup(full) {
  if (!db || !navigator.onLine) {
    toast("要連上網路才能備份");
    return;
  }
  $("bkText").disabled = $("bkFull").disabled = true;
  bkMsg("整理資料中…");
  await withBusy(async () => {
    try {
      const data = {};
      for (const c of BK_COLLS) {
        if (c === "pics" && !full) continue;
        const s = await db.collection(c).get();
        data[c] = {};
        s.docs.forEach((d) => (data[c][d.id] = d.data()));
      }
      saveFile(
        `戀愛基地備份_${key(today())}${full ? "_完整" : ""}.html`,
        backupHtml({ app: "love-base", version: 2, exportedAt: nowIso(), full, data }),
      );
      lsSet(BK_KEY, key(today()));
      try {
        await addDoc("backups", { full, by: myName(), at: nowIso() });
      } catch (e) {}
      showLastBackup();
      toast("備份下載好了 💾");
    } catch (e) {
      bkMsg("備份失敗，請確認網路後再試一次。");
    }
  });
  $("bkText").disabled = $("bkFull").disabled = false;
}
async function prepRestore(text) {
  $("bkConfirm").hidden = true;
  bkPending = [];
  let b;
  try {
    b = JSON.parse(backupPayload(text));
  } catch (e) {
    bkMsg("這個檔案讀不出來，請選下載的備份檔。");
    return;
  }
  if (b?.app !== "love-base" || !b.data) {
    bkMsg("這不是基地的備份檔。");
    return;
  }
  if (!db || !navigator.onLine) {
    bkMsg("要連上網路才能補回資料。");
    return;
  }
  bkMsg("比對中…");
  try {
    let trashedPhotos = new Set();
    for (const c of BK_COLLS) {
      if (!b.data[c]) continue;
      const s = await db.collection(c).get();
      if (c === "photos") trashedPhotos = new Set(s.docs.filter((d) => d.data()?.trashed).map((d) => d.id));
      const have = new Set(
        s.docs.filter((d) => !d.data()?.trashed && !(c === "pics" && trashedPhotos.has(d.id))).map((d) => d.id),
      );
      for (const [id, v] of Object.entries(b.data[c])) {
        if (v?.trashed || (c === "pics" && b.data.photos?.[id]?.trashed)) continue;
        if (!have.has(id)) bkPending.push([c, id, v]);
      }
    }
  } catch (e) {
    bkMsg("比對失敗，請確認網路後再試一次。");
    return;
  }
  if (!bkPending.length) {
    bkMsg("備份裡的資料目前都還在，不用補回。");
    return;
  }
  $("bkConfirm").textContent = `補回 ${bkPending.length} 筆資料`;
  $("bkConfirm").hidden = false;
  bkMsg(`備份日期 ${dayOf(b.exportedAt)}。只會補回目前沒有的資料，現有內容不會被改動；已經刪掉的東西也會一起回來。`);
}
async function applyRestore() {
  const list = bkPending;
  let ok = 0;
  $("bkConfirm").disabled = true;
  await withBusy(async () => {
    try {
      for (const [c, id, v] of list) {
        await db.collection(c).doc(id).set(v);
        ok++;
        bkMsg(`補回中… ${ok} / ${list.length}`);
      }
      bkMsg(`補回完成，共 ${ok} 筆。`);
      toast("資料補回來了 💾");
    } catch (e) {
      bkMsg(`補到第 ${ok} 筆時失敗了，請確認網路後再選一次備份檔。`);
    }
  });
  bkPending = [];
  $("bkConfirm").hidden = true;
  $("bkConfirm").disabled = false;
}
$("bkText").onclick = () => exportBackup(false);
$("bkFull").onclick = () => exportBackup(true);

// 一個月的照片原圖打包成 zip（不壓縮，照片本來就是 JPG），檔名例如 2026-11-03_寒冰_1.jpg
const zipMsg = (t) => ($("zipMsg").textContent = t);
function fillZipMonths() {
  const sel = $("zipMonth"),
    now = today(),
    list = [];
  for (let d = new Date(LOVE_START.getFullYear(), LOVE_START.getMonth(), 1); d <= now; d.setMonth(d.getMonth() + 1)) {
    list.push(key(d).slice(0, 7));
  }
  const keep = sel.value;
  sel.innerHTML = list
    .reverse()
    .map((m) => `<option value="${m}">${+m.slice(0, 4)} 年 ${+m.slice(5)} 月</option>`)
    .join("");
  if (keep && list.includes(keep)) sel.value = keep;
}
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(b) {
  let c = 0xffffffff;
  for (let i = 0; i < b.length; i++) c = CRC_TABLE[(c ^ b[i]) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function makeZip(files) {
  const enc = new TextEncoder(),
    parts = [],
    central = [];
  let off = 0;
  for (const f of files) {
    const name = enc.encode(f.name),
      crc = crc32(f.data),
      [y, mo, d] = f.date.split("-").map(Number),
      dosDate = ((y - 1980) << 9) | (mo << 5) | d,
      dosTime = 12 << 11;
    const head = new DataView(new ArrayBuffer(30));
    head.setUint32(0, 0x04034b50, true);
    head.setUint16(4, 20, true);
    head.setUint16(6, 0x0800, true);
    head.setUint16(10, dosTime, true);
    head.setUint16(12, dosDate, true);
    head.setUint32(14, crc, true);
    head.setUint32(18, f.data.length, true);
    head.setUint32(22, f.data.length, true);
    head.setUint16(26, name.length, true);
    parts.push(head, name, f.data);
    const cen = new DataView(new ArrayBuffer(46));
    cen.setUint32(0, 0x02014b50, true);
    cen.setUint16(4, 20, true);
    cen.setUint16(6, 20, true);
    cen.setUint16(8, 0x0800, true);
    cen.setUint16(12, dosTime, true);
    cen.setUint16(14, dosDate, true);
    cen.setUint32(16, crc, true);
    cen.setUint32(20, f.data.length, true);
    cen.setUint32(24, f.data.length, true);
    cen.setUint16(28, name.length, true);
    cen.setUint32(42, off, true);
    central.push(cen, name);
    off += 30 + name.length + f.data.length;
  }
  const size = central.reduce((a, p) => a + p.byteLength, 0),
    end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, files.length, true);
  end.setUint16(10, files.length, true);
  end.setUint32(12, size, true);
  end.setUint32(16, off, true);
  return new Blob([...parts, ...central, end], { type: "application/zip" });
}
function dataUrlBytes(url) {
  const bin = atob(url.slice(url.indexOf(",") + 1)),
    out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
$("bkBox").addEventListener("toggle", () => {
  if ($("bkBox").open) fillZipMonths();
});
$("zipGo").onclick = async () => {
  const m = $("zipMonth").value;
  if (!m) return;
  if (!db || !navigator.onLine) {
    zipMsg("要連上網路才能下載照片。");
    return;
  }
  $("zipGo").disabled = true;
  zipMsg("找照片中…");
  await withBusy(async () => {
    try {
      const s = await db
        .collection("photos")
        .where("date", ">=", m + "-01")
        .where("date", "<=", m + "-31")
        .get();
      const list = s.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((p) => !p.trashed)
        .sort((a, b) => (a.date + (a.at || "")).localeCompare(b.date + (b.at || "")));
      if (!list.length) {
        zipMsg("這個月還沒有照片。");
      } else {
        const files = [],
          seq = {};
        let miss = 0;
        for (const p of list) {
          let img = picCache.get(p.id);
          if (!img) {
            const doc = await db.collection("pics").doc(p.id).get();
            img = doc.exists ? doc.data()?.img : "";
          }
          img = img || p.th;
          if (!img) {
            miss++;
            continue;
          }
          const k = p.date + "_" + (p.by || "照片");
          seq[k] = (seq[k] || 0) + 1;
          const ext = /^data:image\/png/.test(img) ? "png" : "jpg";
          files.push({ name: `${k}_${seq[k]}.${ext}`, date: p.date, data: dataUrlBytes(img) });
          zipMsg(`打包中… ${files.length} / ${list.length}`);
        }
        const blob = makeZip(files);
        downloadBlob(`戀愛基地照片_${m}.zip`, blob);
        zipMsg(
          `下載好了：${files.length} 張，約 ${(blob.size / 1048576).toFixed(1)} MB。` +
            (miss ? `有 ${miss} 張讀不到原圖。` : "") +
            "解壓縮後就是一張張的照片，可以直接傳到 Google 相簿或雲端。",
        );
        toast("照片打包好了 📦");
      }
    } catch (e) {
      zipMsg("下載失敗，請確認網路後再試一次。");
    }
  });
  $("zipGo").disabled = false;
};
$("bkPick").onclick = () => {
  $("bkFile").value = "";
  $("bkFile").click();
};
$("bkFile").addEventListener("change", async () => {
  const f = $("bkFile").files[0];
  if (f) prepRestore(await f.text());
});
$("bkConfirm").onclick = applyRestore;

// 垃圾桶
const trashExpired = (x) => Date.now() - new Date(x.trashed.at).getTime() >= TRASH_DAYS * 864e5;
const trashDaysLeft = (x) =>
  Math.max(1, Math.ceil((new Date(x.trashed.at).getTime() + TRASH_DAYS * 864e5 - Date.now()) / 864e5));
function trashLabel(c, x) {
  if (c === "diary")
    return `💌 ${esc(x.date)} 的日記：${esc(String(x.mood || x.say || x.funny || x.food || x.s1 || x.s2 || "").slice(0, 40))}`;
  if (c === "photos")
    return `<img src="${esc(x.th)}" alt="" loading="lazy" decoding="async">📷 ${esc(x.date)} ${esc(x.by)} 的照片${x.replaced ? "（被換掉的）" : ""}`;
  if (c === "wishes") return `🌠 ${esc(x.text)}`;
  if (c === "capsules")
    return x.openDate > key(today()) ? `🔒 封存中的膠囊（${esc(x.openDate)} 打開）` : `⏳ ${esc(x.text)}`;
  return x.kind === "q" ? `💬 ${esc(x.text)}` : `📌 ${esc(x.name)}：${esc(x.text)}`;
}
function renderTrash() {
  const box = $("trashList"),
    items = Object.entries(trash)
      .flatMap(([c, l]) => l.map((x) => [c, x]))
      .sort((a, b) => String(b[1].trashed.at).localeCompare(String(a[1].trashed.at)));
  $("trashN").textContent = `${items.length} 項`;
  box.innerHTML = items.length
    ? items
        .map(
          ([c, x]) =>
            `<div class="citem"><span>${trashLabel(c, x)}<small>${esc(x.trashed.by || "有人")} 刪的 · 還剩 ${trashDaysLeft(x)}` +
            ` 天</small></span><div class="trash-acts"><button class="btn ghost" type="button" data-restore="${c}` +
            `" data-id="${esc(x.id)}">復原</button><button class="btn ghost" type="button" data-purge="${c}` +
            `" data-id="${esc(x.id)}">永久刪除</button></div></div>`,
        )
        .join("")
    : '<div class="empty">垃圾桶是空的。</div>';
  box
    .querySelectorAll("[data-restore]")
    .forEach((b) => (b.onclick = () => restoreItem(b.dataset.restore, b.dataset.id)));
  box.querySelectorAll("[data-purge]").forEach((b) => {
    b.onclick = () => {
      if (confirmTap(b, "無法復原，再按一次", "永久刪除")) purgeItem(b.dataset.purge, b.dataset.id);
    };
  });
}
// 把某張照片（含原圖）複製到垃圾桶裡的新位置，原本的位置就可以放新照片
async function archivePhoto(id) {
  if (!db) return;
  const ps = await db.collection("photos").doc(id).get();
  if (!ps.exists) return;
  const meta = ps.data() || {},
    pc = await db.collection("pics").doc(id).get();
  const nid = id + "~" + Date.now().toString(36);
  if (pc.exists) await db.collection("pics").doc(nid).set(pc.data());
  const { trashed, replaced, ...rest } = meta;
  const doc = { ...rest, trashed: trashed || trashMark(), replaced: id };
  await db.collection("photos").doc(nid).set(doc);
  trash.photos = trash.photos.filter((x) => x.id !== id).concat([{ id: nid, ...doc }]);
}
// 復原被換掉的照片：跟現在那張交換，現在那張進垃圾桶
async function restoreReplaced(item) {
  const orig = item.replaced,
    { id, trashed, replaced, ...data } = item;
  const pc = await db.collection("pics").doc(id).get();
  await archivePhoto(orig);
  if (pc.exists) {
    await db.collection("pics").doc(orig).set(pc.data());
    if (pc.data()?.img) picCache.set(orig, pc.data().img);
  }
  picCache.delete(id);
  await db.collection("photos").doc(orig).set(data);
  await db.collection("photos").doc(id).delete();
  await db
    .collection("pics")
    .doc(id)
    .delete()
    .catch(() => {});
  trash.photos = trash.photos.filter((x) => x.id !== id);
  photos = photos.filter((p) => p.id !== orig).concat([{ id: orig, ...data }]);
  calPhotos = calPhotos.filter((p) => p.id !== orig).concat([{ id: orig, ...data }]);
}
function trashRef(c, id) {
  return c === "diary" || c === "photos" ? db.collection(c).doc(id) : xRef(c, id);
}
async function restoreItem(c, id) {
  const item = trash[c].find((x) => x.id === id);
  if (!item) return;
  if (c === "photos" && item.replaced && db) {
    try {
      await restoreReplaced(item);
      renderAll();
      toast("換回這張了 ♻️ 原本那張放進垃圾桶");
    } catch (e) {
      toast("復原失敗，請再試一次");
    }
    return;
  }
  const { id: _id, trashed, replaced: _r, ...data } = item;
  const list = c === "diary" ? entries : c === "photos" ? photos : store[c];
  trash[c] = trash[c].filter((x) => x.id !== id);
  list.push({ id, ...data });
  renderAll();
  try {
    db ? await commit(trashRef(c, id).set(data)) : saveLocal();
    if (c === "photos") calLoaded.delete(String(data.date).slice(0, 7));
    renderAll();
    toast("復原了 ♻️");
  } catch (e) {
    const i = list.findIndex((x) => x.id === id);
    if (i >= 0) list.splice(i, 1);
    trash[c].push(item);
    renderAll();
    toast("復原失敗，請再試一次");
  }
}
async function hardDelete(c, id) {
  if (!db) return;
  await trashRef(c, id).delete();
  if (c === "photos") await db.collection("pics").doc(id).delete();
  if (c === "diary") {
    store.replies
      .filter((r) => r.entry === id)
      .forEach((r) =>
        xRef("replies", r.id)
          .delete()
          .catch(() => {}),
      );
    db.collection("photos")
      .doc("d_" + id)
      .delete()
      .catch(() => {});
    db.collection("pics")
      .doc("d_" + id)
      .delete()
      .catch(() => {});
    db.collection("photos")
      .where("entry", "==", id)
      .get()
      .then((s) =>
        s.docs.forEach((d) => {
          d.ref.delete().catch(() => {});
          db.collection("pics")
            .doc(d.id)
            .delete()
            .catch(() => {});
        }),
      )
      .catch(() => {});
  }
}
async function purgeItem(c, id) {
  const old = trash[c];
  trash[c] = old.filter((x) => x.id !== id);
  renderTrash();
  try {
    await hardDelete(c, id);
    if (!db) saveLocal();
    toast("永久刪除了");
  } catch (e) {
    trash[c] = old;
    renderTrash();
    toast("刪除失敗");
  }
}
const purging = new Set();
function purgeExpired() {
  for (const c of Object.keys(trash))
    for (const x of trash[c]) {
      if (!trashExpired(x) || purging.has(c + x.id)) continue;
      purging.add(c + x.id);
      hardDelete(c, x.id).catch(() => purging.delete(c + x.id));
      if (!db) {
        trash[c] = trash[c].filter((y) => y.id !== x.id);
        saveLocal();
      }
    }
}
let photoTrashUnsub = null;
function subPhotoTrash() {
  if (!db) return;
  if (photoTrashUnsub) photoTrashUnsub();
  photoTrashUnsub = db
    .collection("photos")
    .where("trashed.at", ">", "")
    .onSnapshot(
      (s) => {
        trash.photos = s.docs.map((d) => ({ id: d.id, ...d.data() })).filter((p) => p.trashed);
        renderAll();
        purgeExpired();
      },
      () => {},
    );
}

// 側邊選單（電腦版），手機用底部分頁
const SIDE_KEY = "love-base-side";
function setSide(v, save) {
  document.documentElement.dataset.side = v;
  const open = v === "open",
    b = $("sideToggle");
  b.textContent = open ? "«" : "»";
  b.setAttribute("aria-expanded", open);
  b.setAttribute("aria-label", open ? "縮小選單" : "展開選單");
  if (save) lsSet(SIDE_KEY, v);
}
setSide(document.documentElement.dataset.side === "mini" ? "mini" : "open");
$("sideToggle").onclick = () => setSide(document.documentElement.dataset.side === "open" ? "mini" : "open", true);

// 日記草稿：只存在這台裝置，寫進日記後清掉；編輯舊日記時不動草稿
const DRAFT_KEY = "love-base-draft",
  SAVING_KEY = "love-base-diary-saving";
function saveDraft() {
  if (editId) return;
  const d = { date: $("dDate").value, happy };
  for (const [el, f] of Object.entries(FIELDS)) d[f] = $(el).value;
  const has = d.happy || Object.values(FIELDS).some((f) => d[f].trim());
  if (has) lsSet(DRAFT_KEY, JSON.stringify(d));
  else lsDel(DRAFT_KEY);
}
function clearDraft() {
  lsDel(DRAFT_KEY);
  $("dDraftClear").hidden = true;
}
function restoreDraft() {
  const d = lsJson(DRAFT_KEY);
  if (!d) return;
  $("dDate").value = d.date || key(today());
  for (const [el, f] of Object.entries(FIELDS)) $(el).value = d[f] || "";
  $("dFunny").closest("label").hidden = !d.funny;
  $("dS1").closest(".summary").hidden = !(d.s1 || d.s2);
  happy = Number(d.happy) || 0;
  renderHearts();
  growAll();
  const dt = fromKey($("dDate").value);
  $("dMsg").textContent = `已恢復 ${dt.getMonth() + 1}/${dt.getDate()} 沒寫完的草稿`;
  $("dDraftClear").hidden = false;
}
$("diaryForm").addEventListener("input", saveDraft);
$("dDraftClear").onclick = () => {
  if (!confirmTap($("dDraftClear"), "再按一次", "清除草稿")) return;
  clearDraft();
  resetDiaryFields();
  $("dMsg").textContent = "";
};

// 你不在時：比對這台裝置上次按「知道了」的時間
const SEEN_KEY = "love-base-seen";
let seenMs = 0;
function initSeen() {
  let v = lsGet(SEEN_KEY);
  if (!v) {
    v = nowIso();
    lsSet(SEEN_KEY, v);
  }
  seenMs = new Date(v).getTime();
}
// 主畫面 App 圖示的數字紅點（Android Chrome、加到主畫面的 iPhone 都支援）
function setBadge(n) {
  try {
    if (!("setAppBadge" in navigator)) return;
    (n > 0 ? navigator.setAppBadge(n) : navigator.clearAppBadge()).catch(() => {});
  } catch (e) {}
}
function renderAway() {
  const card = $("awayCard");
  if (!db || !seenMs) {
    card.hidden = true;
    setBadge(0);
    syncNotices();
    return;
  }
  const me = myName(),
    tk = key(today()),
    fresh = (x) => x.by && x.by !== me && x.at && new Date(x.at).getTime() > seenMs,
    freshEntries = entries.filter(fresh),
    entryDate = freshEntries
      .map((e) => e.date)
      .filter(Boolean)
      .sort()
      .pop(),
    entryTarget = !entryDate || entryDate === tk ? "diary" : "calendar",
    freshReplies = store.replies.filter(fresh).filter((r) => entries.find((e) => e.id === r.entry)?.by === me),
    replyDate = freshReplies
      .map((r) => entries.find((e) => e.id === r.entry)?.date)
      .filter(Boolean)
      .sort()
      .pop(),
    replyTarget = !replyDate || replyDate === tk ? "diary" : "calendar";
  const groups = [
    [freshEntries, (n) => `💌 寫了 ${n} 篇日記`, entryTarget, entryTarget === "calendar" ? entryDate : ""],
    [photos.filter(fresh), (n) => `📷 傳了 ${n} 張照片`, "photos"],
    [store.answers.filter(fresh), (n) => `🎲 回答了 ${n} 題抽題`, "draw"],
    [store.wishes.filter(fresh), (n) => `🌠 許了 ${n} 個願望`, "wishes"],
    [store.capsules.filter(fresh), (n) => `⏳ 封存了 ${n} 顆膠囊`, "capsule"],
    [freshReplies, (n) => `💬 回應了你的日記（${n}）`, replyTarget, replyTarget === "calendar" ? replyDate : ""],
    [store.reviews.filter(fresh), () => "📝 寫了這週回顧", dow(today()) === 6 ? "todayBox" : "reviewBox"],
    [store.hugs.filter(fresh), () => "🤗 來討抱抱", "hugCard"],
    [
      store.hugs.filter((h) => h.by === me && h.backBy && new Date(h.backAt).getTime() > seenMs),
      () => "💞 抱了你",
      "hugCard",
    ],
  ].filter(
    (g) =>
      g[0].length &&
      !layout.hidden.includes(
        ["diary", "todayBox"].includes(g[2])
          ? "quests"
          : ["capsule", "reviewBox"].includes(g[2])
            ? "memories"
            : g[2] === "diaryMore"
              ? "calendar"
              : g[2],
      ),
  );
  setBadge(groups.reduce((n, g) => n + g[0].length, 0));
  if (!groups.length) {
    card.hidden = true;
    syncNotices();
    return;
  }
  const name = groups[0][0][0].by === me ? groups[0][0][0].backBy : groups[0][0][0].by;
  card.innerHTML =
    `<div class="row between"><h3>你不在時，${esc(name)}…</h3>` +
    `<button class="btn ghost" type="button" id="awayOk">知道了</button></div>` +
    `<div class="away-list">${groups.map((g) => `<a href="#${g[2]}"${g[3] ? ` data-awayday="${esc(g[3])}"` : ""}>${g[1](g[0].length)}</a>`).join("")}</div>`;
  card.hidden = false;
  syncNotices();
  card.querySelectorAll("[data-awayday]").forEach(
    (a) =>
      (a.onclick = () => {
        const d = a.dataset.awayday;
        calMonth = d.slice(0, 7);
        calDay = d;
      }),
  );
  $("awayOk").onclick = () => {
    const v = nowIso();
    seenMs = new Date(v).getTime();
    lsSet(SEEN_KEY, v);
    renderAway();
  };
}

// 討抱抱
function renderHug() {
  const me = myName(),
    t = (x) => {
      const d = new Date(x);
      return `${d.getMonth() + 1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
    };
  $("hugCard").hidden = !db;
  const incoming = store.hugs.filter((h) => h.by && h.by !== me && !h.backAt).sort(byAt);
  const mine = store.hugs.find((h) => h.by === me && !h.backAt);
  const back = store.hugs.filter((h) => h.by === me && h.backAt && !h.ack).sort(byAt);
  $("hugState").innerHTML = [
    ...incoming.map(
      (h) =>
        `<div class="hug-msg"><div><b>🤗 ${esc(h.by)} 想要抱抱</b>${h.text ? `<p>${esc(h.text)}</p>` : ""}<small>${t(h.at)}` +
        `</small></div><button class="btn" type="button" data-hugback="${esc(h.id)}">抱回去 💞</button></div>`,
    ),
    ...back.map(
      (h) =>
        `<div class="hug-msg"><div><b>💞 ${esc(h.backBy)} 抱你了！</b><small>${t(h.backAt)}</small></div>` +
        `<button class="btn ghost" type="button" data-hugack="${esc(h.id)}">收到</button></div>`,
    ),
    ...(mine
      ? [
          `<div class="hug-msg"><div><b>🫂 你討抱抱了，等對方回應…</b>${mine.text ? `<p>${esc(mine.text)}</p>` : ""}</div>` +
            `<button class="btn ghost" type="button" data-hugcancel="${esc(mine.id)}">收回</button></div>`,
        ]
      : []),
  ].join("");
  const busy = incoming.length || back.length || !!mine,
    showForm = hugOpen && !mine;
  $("hugState").hidden = !busy;
  $("hugForm").hidden = !showForm;
  $("hugOpen").hidden = showForm || !!mine;
  $("hugCard").classList.toggle("mini", !busy && !showForm);
  const n = store.hugs.filter((h) => h.backAt).length;
  $("hugN").textContent = n ? `已經抱了 ${n} 次` : "";
  $("hugState")
    .querySelectorAll("[data-hugback]")
    .forEach(
      (b) =>
        (b.onclick = () => {
          popFloat(b, "💞");
          updDoc("hugs", b.dataset.hugback, { backBy: me, backAt: nowIso() });
          toast("抱回去了 💞");
          notifyPartner("💞 收到抱抱", `${me}抱了你一下！`, "#hugCard", "hug-back");
        }),
    );
  $("hugState")
    .querySelectorAll("[data-hugack]")
    .forEach((b) => (b.onclick = () => updDoc("hugs", b.dataset.hugack, { ack: true })));
  $("hugState")
    .querySelectorAll("[data-hugcancel]")
    .forEach(
      (b) =>
        (b.onclick = async () => {
          const id = b.dataset.hugcancel,
            old = store.hugs;
          store.hugs = old.filter((h) => h.id !== id);
          renderAll();
          try {
            await commit(xRef("hugs", id).delete());
          } catch (e) {
            store.hugs = old;
            renderAll();
            toast(NOSAVE);
          }
        }),
    );
}
bindForm(
  "hugForm",
  "hugSave",
  () => ({ c: "hugs", doc: { text: $("hugText").value.trim(), by: myName(), at: nowIso() } }),
  () => {
    const txt = $("hugText").value.trim();
    $("hugText").value = "";
    hugOpen = false;
    popFloat($("hugCard"), "🤗");
    renderHug();
    saveToast("討抱抱送出去了 🤗");
    notifyPartner("🤗 討抱抱", `${myName()}想要你的抱抱${txt ? `：「${txt}」` : ""}`, "#hugCard", "hug-ask");
  },
);

// 今天還差什麼
function renderTodo() {
  const t = today(),
    tk = key(t),
    me = myName(),
    items = [];
  if (store.hugs.some((h) => h.by && h.by !== me && !h.backAt)) items.push([false, "🤗 抱抱對方", "hugCard"]);
  if (dow(t) === 6) items.push([store.reviews.some((r) => r.date === tk && r.by === me), "📝 寫這週回顧", "todayBox"]);
  if (db) items.push([!!myPhoto(tk), "📷 上傳我的照片", "diary"]);
  const r = shownRound(),
    ans = r ? pairOf(r.id) : [],
    answered = ans.some((a) => a.by === me),
    over = !!r && ans.length >= need();
  if (r && !over) items.push(answered ? [true, "🎲 已回答抽題，等對方揭曉", "draw"] : [false, "🎲 回答抽題", "draw"]);
  else if (over && roundDay(r) === tk) items.push([true, "🎲 今天的抽題過關了", "draw"]);
  else if (myTurn()) items.push([false, "🎲 今天輪到你抽題", "draw"]);
  for (let i = items.length - 1; i >= 0; i--)
    if (layout.hidden.includes(["diary", "todayBox"].includes(items[i][2]) ? "quests" : items[i][2]))
      items.splice(i, 1);
  const n = items.filter((x) => x[0]).length,
    all = n === items.length;
  $("todoCard").innerHTML =
    `<div class="row between"><h3>${all ? "今天都完成了 🎉" : "今天還差什麼"}</h3><span class="num">${n} / ${items.length}</span>` +
    `</div>${items.map(([ok, label, id]) => `<a class="todo-i ${ok ? "ok" : ""}" href="#${id}"><span class="tick" aria-hidden="true">✓</span>${label}${ok ? '<span class="sr-only">（已完成）</span>' : ""}</a>`).join("")}`;
}
const NOTICE_IDS = ["newNudge", "remindNudge", "planNudge", "iosNudge", "capNudge", "bkNudge", "picNudge", "awayCard"];
let noticesExpanded = false;
function syncNotices() {
  const vis = [];
  for (const id of NOTICE_IDS) {
    const el = $(id);
    el.classList.remove("folded");
    if (!el.hidden) vis.push(el);
  }
  $("notices").hidden = !vis.length;
  const more = $("noticesMore");
  if (vis.length <= 2) {
    noticesExpanded = false;
    more.hidden = true;
    return;
  }
  if (!noticesExpanded) vis.slice(2).forEach((el) => el.classList.add("folded"));
  more.hidden = false;
  more.setAttribute("aria-expanded", String(noticesExpanded));
  more.textContent = noticesExpanded ? "收起提醒 ▴" : `還有 ${vis.length - 2} 則提醒 ▾`;
}
$("noticesMore").onclick = () => {
  noticesExpanded = !noticesExpanded;
  syncNotices();
};
// 對方今天有新東西（日記、照片）而我還沒看過：今天頁最上面提醒，點了直接去看
const NEW_SEEN_KEY = "love-base-new-seen";
function partnerNew() {
  const k = key(today()),
    me = myName(),
    d = lsJson(NEW_SEEN_KEY),
    seenD = d && d.date === k && Array.isArray(d.ids) ? d.ids : [],
    seenP = phSeen(k),
    diary = entries.filter((x) => x.date === k && x.by && x.by !== me && !seenD.includes(x.id)),
    pics = photosOn(k).filter((p) => p.by !== me && !seenP.includes(p.id));
  return { k, diary, pics };
}
function markPartnerSeen(what = "all") {
  const { k, diary, pics } = partnerNew();
  if (what !== "pics" && diary.length) {
    const d = lsJson(NEW_SEEN_KEY),
      old = d && d.date === k && Array.isArray(d.ids) ? d.ids : [];
    lsSet(NEW_SEEN_KEY, JSON.stringify({ date: k, ids: [...old, ...diary.map((x) => x.id)] }));
  }
  if (what !== "diary" && pics.length)
    lsSet(PH_SEEN_KEY, JSON.stringify({ date: k, ids: [...phSeen(k), ...pics.map((p) => p.id)] }));
}
function renderNewNudge() {
  const { diary, pics } = partnerNew(),
    who = nameOf(NAMES.find((n) => n !== myName()) || "對方"),
    parts = [diary.length ? "寫了日記" : "", pics.length ? `傳了 ${pics.length} 張照片` : ""].filter(Boolean),
    show = !!(db && dataReady && parts.length);
  setNudge(
    "newNudge",
    show,
    `💕 ${esc(who)}今天${parts.join("、")}`,
    "quests",
    "去看看",
    "等等再看",
    () => {
      markPartnerSeen();
      renderNewNudge();
    },
    () => {
      // 去看照片時先切到對方那邊
      if (pics.length) phWho = "other";
    },
  );
}
function renderToday() {
  renderNewNudge();
  renderRemind();
  renderPlanNudge();
  renderIosNudge();
  renderCapNudge();
  renderBackupNudge();
  renderPicNudge();
  renderAway();
  renderHug();
  renderTodo();
  renderTodayFlashback();
  syncNotices();
}

/* ===== 外觀、選單、版面與手勢 ===== */
// 外觀與版面：都存在這台裝置，兩個人可以各自設定
const LAYOUT_KEY = "love-base-layout";
const CATS = [
  { id: "today", secs: ["today"] },
  { id: "diary", secs: ["quests"] },
  { id: "play", secs: ["draw", "wishes"] },
  { id: "memory", secs: ["calendar", "photos", "memories", "book"] },
  { id: "more", secs: ["ladder", "rules", "tools"] },
];
const SEC_META = {
  draw: ["抽題", "🎲"],
  wishes: ["願望", "🌠"],
  calendar: ["月曆", "📅"],
  photos: ["照片", "📷"],
  memories: ["回顧", "🕰️"],
  book: ["回憶書", "📖"],
  ladder: ["成就", "🏆"],
  rules: ["規則", "🧸"],
  tools: ["設定", "⚙️"],
};
const SEC_DEFAULT = Object.keys(SEC_META).filter((id) => id !== "tools");
let view = "today";
const lastSub = {};
function loadLayout() {
  const v = lsJson(LAYOUT_KEY);
  const order = (v?.order || []).filter((id) => SEC_DEFAULT.includes(id));
  return {
    order: [...order, ...SEC_DEFAULT.filter((id) => !order.includes(id))],
    hidden: (v?.hidden || []).filter((id) => SEC_DEFAULT.includes(id)),
  };
}
let layout = loadLayout();
function catSecs(c) {
  const rank = (id) => {
    const i = layout.order.indexOf(id);
    return i < 0 ? 99 : i;
  };
  return c.secs.filter((id) => !layout.hidden.includes(id)).sort((a, b) => rank(a) - rank(b));
}
function renderNav() {
  const cur = CATS.find((c) => c.secs.includes(view)),
    secs = catSecs(cur),
    sub = $("subNav"),
    keyStr = secs.length < 2 ? "" : secs.join(",");
  sub.hidden = secs.length < 2;
  if (sub.dataset.secs !== keyStr) {
    sub.dataset.secs = keyStr;
    sub.innerHTML =
      secs.length < 2 ? "" : secs.map((id) => `<a href="#${id}" data-sub="${id}">${SEC_META[id][0]}</a>`).join("");
  }
  sub.querySelectorAll("a[data-sub]").forEach((a) => {
    a.setAttribute("aria-current", a.dataset.sub === view);
  });
  sub.style.setProperty("--sub-n", secs.length || 1);
  if (!sub.classList.contains("dragging")) sub.style.setProperty("--sub-i", Math.max(0, secs.indexOf(view)));
  const visCats = CATS.filter((x) => catSecs(x).length),
    tb = $("tabBar"),
    draggingTb = tb.classList.contains("dragging");
  document.querySelectorAll("[data-c]").forEach((a) => {
    const c = CATS.find((x) => x.id === a.dataset.c);
    a.hidden = !catSecs(c).length;
    if (!draggingTb || !a.closest("#tabBar")) a.setAttribute("aria-current", c === cur);
  });
  tb.style.setProperty("--tab-n", visCats.length || 1);
  if (!draggingTb) tb.style.setProperty("--tab-i", Math.max(0, visCats.indexOf(cur)));
}
function applyLayout() {
  layout.order.forEach((id) => {
    $(id).hidden = layout.hidden.includes(id);
  });
  if ($(view).hidden) setView("today");
  else renderNav();
}
function renderLayoutList() {
  const box = $("layoutList"),
    last = layout.order.length - 1;
  box.innerHTML = layout.order
    .map((id, i) => {
      const [label, ic] = SEC_META[id],
        off = layout.hidden.includes(id);
      return (
        `<div class="citem ${off ? "off" : ""}"><span>${ic} ${label}</span><div class="layout-acts">` +
        `<button class="btn ghost" type="button" data-move="-1" data-id="${id}" aria-label="${label}` +
        ` 往前" ${i ? "" : "disabled"}>↑</button><button class="btn ghost" type="button" data-move="1" data-id="${id}` +
        `" aria-label="${label} 往後" ${i < last ? "" : "disabled"}>↓</button>` +
        `<button class="btn ghost" type="button" data-toggle="${id}" aria-pressed="${off}" aria-label="${off ? "顯示" : "隱藏"}` +
        ` ${label}">${off ? "顯示" : "隱藏"}</button></div></div>`
      );
    })
    .join("");
  box.querySelectorAll("[data-move]").forEach(
    (b) =>
      (b.onclick = () => {
        const id = b.dataset.id,
          d = +b.dataset.move,
          i = layout.order.indexOf(id);
        layout.order.splice(i, 1);
        layout.order.splice(i + d, 0, id);
        commitLayout();
        box.querySelector(`[data-id="${id}"][data-move="${d}"]`)?.focus();
      }),
  );
  box.querySelectorAll("[data-toggle]").forEach(
    (b) =>
      (b.onclick = () => {
        const id = b.dataset.toggle;
        layout.hidden = layout.hidden.includes(id) ? layout.hidden.filter((x) => x !== id) : [...layout.hidden, id];
        commitLayout();
        box.querySelector(`[data-toggle="${id}"]`)?.focus();
      }),
  );
}
function commitLayout() {
  lsSet(LAYOUT_KEY, JSON.stringify(layout));
  applyLayout();
  renderLayoutList();
  renderAll();
}
$("layoutReset").onclick = () => {
  lsDel(LAYOUT_KEY);
  layout = loadLayout();
  applyLayout();
  renderLayoutList();
  renderAll();
  toast("版面恢復預設了");
};
function bindSeg(id, store_, get, apply) {
  const seg = $(id),
    paint = () => seg.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", b.dataset.v === get()));
  seg.querySelectorAll("button").forEach(
    (b) =>
      (b.onclick = () => {
        apply(b.dataset.v);
        lsSet(store_, b.dataset.v);
        paint();
        renderChart();
      }),
  );
  paint();
}
const R = document.documentElement;
function syncThemeMeta() {
  const t = R.dataset.theme,
    dark = t === "dark" || (t !== "light" && matchMedia("(prefers-color-scheme: dark)").matches),
    c = dark ? "#0d0811" : "#fff5f8";
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => {
    m.removeAttribute("media");
    m.content = c;
  });
}
bindSeg(
  "segTheme",
  "love-base-theme",
  () => R.dataset.theme || "system",
  (v) => {
    if (v === "system") delete R.dataset.theme;
    else R.dataset.theme = v;
    syncThemeMeta();
  },
);
syncThemeMeta();
matchMedia("(prefers-color-scheme: dark)").addEventListener("change", syncThemeMeta);
bindSeg(
  "segFont",
  "love-base-font",
  () => R.dataset.font || "m",
  (v) => {
    R.dataset.font = v;
  },
);
// 測試震動：按下去直接震，並顯示是卡在瀏覽器還是手機設定
$("hapticTest").onclick = () => {
  let res = "這個瀏覽器不支援震動";
  try {
    if (navigator.vibrate) res = navigator.vibrate([200, 100, 200]) ? "已經叫手機震了" : "被瀏覽器擋下來";
    else iosHaptic();
  } catch (e) {
    res = "發生錯誤";
  }
  $("hapticInfo").textContent =
    `${res} · 震動開關：${hapticOn ? "開" : "關"} · 強度：${{ light: "輕", mid: "中", strong: "強" }[hapticLv]}`;
};
bindSeg(
  "segHapticLv",
  HAPTIC_LV_KEY,
  () => hapticLv,
  (v) => {
    hapticLv = HAPTIC_LV[v] ? v : "mid";
  },
);
bindSeg(
  "segHaptic",
  HAPTIC_KEY,
  () => (hapticOn ? "on" : "off"),
  (v) => {
    hapticOn = v !== "off";
  },
);
applyLayout();
renderLayoutList();

// 一次只顯示一個區塊：底部分頁或側邊欄選分類，分類裡用上方的小標籤切換
// 每一頁記住滑到哪裡，切回來時停在原本的位置
const scrollPos = {};
function setView(id) {
  const sec = $(id);
  if (!sec || sec.hidden || !CATS.some((c) => c.secs.includes(id))) id = "today";
  if (booted && id !== view) sliderTick();
  const changed = id !== view;
  if (booted && changed && view) scrollPos[view] = scrollY;
  // 換頁方向：往右邊的分頁走，內容從右邊滑進來；往左就從左邊
  if (booted && changed && view) {
    const order = CATS.flatMap((x) => x.secs);
    const root = document.documentElement;
    root.dataset.dir = order.indexOf(id) > order.indexOf(view) ? "f" : "b";
  }
  view = id;
  const c = CATS.find((x) => x.secs.includes(id));
  lastSub[c.id] = id;
  document.documentElement.dataset.view = c.id;
  document.querySelectorAll(".wrap>section").forEach((x) => {
    const on = x.id === id;
    if (on && !x.classList.contains("current")) x.classList.remove("settled");
    x.classList.toggle("current", on);
    x.classList.toggle("open", on);
  });
  renderNav();
  renderOpen();
  // 進到日記頁就算看過對方今天的日記（照片要停在對方那邊才算），今天頁的提醒跟著消失
  if (id === "quests" && db && dataReady) {
    const had = partnerNew();
    markPartnerSeen(phWho === "other" ? "all" : "diary");
    if (had.pics.length && phWho === "other") renderTodayPhotos();
    renderNewNudge();
  }
  if (booted && changed) restoreScroll(id);
}
function restoreScroll(id) {
  const y = scrollPos[id] || 0;
  scrollTo(0, y);
  // 內容還在畫時頁面可能不夠長，等畫好再捲一次
  if (y) requestAnimationFrame(() => requestAnimationFrame(() => view === id && scrollTo(0, y)));
}
function openFor(id, noScroll) {
  let calTarget = "";
  if (typeof id === "string" && id.startsWith("calendar:")) {
    const d = id.slice(9);
    if (/^\d{4}-\d{2}-\d{2}$/.test(d)) {
      calTarget = d;
      calMonth = d.slice(0, 7);
      calDay = d;
    }
    id = "calendar";
  }
  const el = $(id),
    sec = el && el.closest("section");
  if (!sec) {
    setView("today");
    if (!noScroll) scrollTo(0, 0);
    return;
  }
  setView(sec.id);
  if (calTarget && view === "calendar") renderCalendar();
  for (let d = el.closest("details"); d; d = d.parentElement?.closest("details")) d.open = true;
  if (noScroll) return;
  // 要捲到頁面中間某個位置（例如「看那天」）時，開站時擋住瀏覽器自己跳的 no-anchor 先拿掉
  const letScroll = () => document.documentElement.classList.remove("no-anchor");
  if (calTarget) {
    letScroll();
    // 指定某一天：捲到那天的日記和照片，並閃一下讓人知道在哪
    scrollTo(0, 0);
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        const box = $("calDetail");
        box.scrollIntoView({ block: "start", behavior: "smooth" });
        box.classList.remove("flash");
        void box.offsetWidth;
        box.classList.add("flash");
      }),
    );
    return;
  }
  if (el === sec) restoreScroll(sec.id);
  else {
    letScroll();
    el.scrollIntoView({ block: "start" });
  }
}
document.addEventListener("click", (ev) => {
  const a = ev.target.closest('a[href^="#"]');
  if (!a) return;
  ev.preventDefault();
  const c = a.dataset.c && CATS.find((x) => x.id === a.dataset.c),
    secs = c && catSecs(c),
    id = c ? (secs.includes(lastSub[c.id]) ? lastSub[c.id] : secs[0]) : a.getAttribute("href").slice(1);
  if (id === view && scrollY > 10) {
    haptic(14);
    scrollTo({ top: 0, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    return;
  }
  openFor(id);
  history.pushState(null, "", "#" + id);
});
window.addEventListener("popstate", () => {
  if (!$("lightbox").hidden) {
    closePhoto();
    return;
  }
  openFor(location.hash.slice(1) || "today");
});
// 手機打字跳出鍵盤時自動藏起底部導覽列，避免被鍵盤頂起擋住畫面或誤觸
(() => {
  const isTextField = (el) => {
    if (!el) return false;
    if (el.tagName === "TEXTAREA") return true;
    if (el.tagName !== "INPUT") return false;
    return !/^(checkbox|radio|file|hidden|button|submit|reset|date|time|color|range)$/i.test(el.type || "text");
  };
  const isActiveTextField = () => {
    const el = document.activeElement;
    return isTextField(el) && el.isConnected && el.offsetParent !== null;
  };
  let kbTimer = 0;
  const syncKb = () => {
    clearTimeout(kbTimer);
    kbTimer = setTimeout(() => {
      if (!isActiveTextField()) document.documentElement.classList.remove("kb-open");
    }, 80);
  };
  document.addEventListener("focusin", (ev) => {
    if (!isTextField(ev.target)) return;
    clearTimeout(kbTimer);
    document.documentElement.classList.add("kb-open");
  });
  document.addEventListener("focusout", syncKb);
  document.addEventListener("submit", syncKb, true);
  window.addEventListener("blur", syncKb);
  window.addEventListener("hashchange", syncKb);
  window.addEventListener("popstate", syncKb);
  document.addEventListener("visibilitychange", syncKb);
  if (window.visualViewport) window.visualViewport.addEventListener("resize", syncKb);
})();
function activateCat(cid, noScroll) {
  const c = CATS.find((x) => x.id === cid);
  if (!c) return;
  const secs = catSecs(c);
  if (!secs.length) return;
  if (CATS.find((x) => x.secs.includes(view)) === c) return;
  const id = secs.includes(lastSub[c.id]) ? lastSub[c.id] : secs[0];
  openFor(id, noScroll);
  history.replaceState(null, "", "#" + id);
}
// 拖曳選單時頁面是在手指移動中切換的，iPhone 只在手指放開時才允許震動，所以放開時補震一下
let dragFrom = null;
function dragEndTick() {
  sliderDragEndTick(dragFrom !== null && dragFrom !== view);
  dragFrom = null;
}
function bindNavDrag(navId, padPx, itemSel, itemAttr, propI, getItems, onHover, onEndExtra) {
  const nav = $(navId);
  let timer = 0,
    pending = null,
    rect = null,
    items = null,
    lastIdx = -1,
    raf = 0,
    curX = 0;
  nav.addEventListener(
    "touchstart",
    () => {
      dragFrom = view;
      rect = nav.getBoundingClientRect();
      items = getItems();
      lastIdx = -1;
    },
    { passive: true },
  );
  nav.addEventListener(
    "touchmove",
    (ev) => {
      const t = ev.touches[0];
      if (!t) return;
      ev.preventDefault();
      curX = t.clientX;
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const r = rect || (rect = nav.getBoundingClientRect()),
          list = items || (items = getItems()),
          n = list.length || 1,
          w = (r.width - padPx * 2) / n,
          pos = Math.max(0, Math.min(n - 1, (curX - r.left - padPx - w / 2) / w)),
          idx = Math.max(0, Math.min(n - 1, Math.floor((curX - r.left - padPx) / w)));
        nav.classList.add("dragging");
        nav.style.setProperty(propI, pos.toFixed(3));
        if (idx !== lastIdx) {
          lastIdx = idx;
          const id = list[idx];
          if (id) {
            nav.querySelectorAll(itemSel).forEach((a) => a.setAttribute("aria-current", a.dataset[itemAttr] === id));
            if (pending !== id) {
              pending = id;
              clearTimeout(timer);
              timer = setTimeout(() => {
                timer = 0;
                if (pending) onHover(pending);
              }, 45);
            }
          }
        }
      });
    },
    { passive: false },
  );
  ["touchend", "touchcancel"].forEach((evName) =>
    nav.addEventListener(
      evName,
      () => {
        const moved = dragFrom !== null;
        if (raf) {
          cancelAnimationFrame(raf);
          raf = 0;
        }
        rect = null;
        items = null;
        lastIdx = -1;
        if (timer) {
          clearTimeout(timer);
          timer = 0;
        }
        if (pending) onHover(pending);
        pending = null;
        const changed = moved && dragFrom !== view;
        dragEndTick();
        if (nav.classList.contains("dragging")) {
          nav.classList.remove("dragging");
          renderNav();
        }
        if (onEndExtra) onEndExtra(changed);
      },
      { passive: true },
    ),
  );
}
bindNavDrag(
  "tabBar",
  5,
  "a[data-c]",
  "c",
  "--tab-i",
  () => CATS.filter((x) => catSecs(x).length).map((x) => x.id),
  (cid) => activateCat(cid, true),
);
bindNavDrag(
  "subNav",
  4,
  "a[data-sub]",
  "sub",
  "--sub-i",
  () => {
    const cur = CATS.find((c) => c.secs.includes(view));
    return cur ? catSecs(cur) : [];
  },
  (sid) => {
    if (sid !== view) {
      setView(sid);
      history.replaceState(null, "", "#" + sid);
    }
  },
);

// 所有 .filter 分段切換槽都支援滑塊動畫、手指／滑鼠左右拖曳切換與統一震動回饋
function syncFilterBar(el) {
  if (!el || el.classList.contains("dragging")) return;
  const btns = [...el.querySelectorAll("button")];
  const n = btns.length || 1;
  const idx = Math.max(
    0,
    btns.findIndex((b) => b.getAttribute("aria-pressed") === "true"),
  );
  el.style.setProperty("--fil-n", n);
  el.style.setProperty("--fil-i", idx);
}
(() => {
  const obs = new MutationObserver((list) => {
    const seen = new Set();
    for (const m of list) {
      const el = m.target.nodeType === 1 ? m.target.closest(".filter") : null;
      if (el && !seen.has(el)) {
        seen.add(el);
        syncFilterBar(el);
      }
    }
  });
  document.querySelectorAll(".filter").forEach((el) => {
    syncFilterBar(el);
    obs.observe(el, { attributes: true, childList: true, subtree: true, attributeFilter: ["aria-pressed"] });
    const isHapticSeg = el.id === "segHaptic" || el.id === "segHapticLv";
    let active = false,
      startIdx = -1,
      lastIdx = -1,
      dragChanged = false,
      fromDrag = false,
      clickWasPressed = false,
      dragTimer = 0,
      pendingBtn = null,
      filRect = null,
      filBtns = null,
      filRaf = 0,
      filX = 0;
    const fireDragClick = (b) => {
      fromDrag = true;
      try {
        b.click();
      } finally {
        fromDrag = false;
      }
    };
    const beginDrag = () => {
      active = true;
      filRect = el.getBoundingClientRect();
      filBtns = [...el.querySelectorAll("button")];
      startIdx = filBtns.findIndex((b) => b.getAttribute("aria-pressed") === "true");
      lastIdx = startIdx;
      dragChanged = false;
    };
    el.addEventListener(
      "click",
      (ev) => {
        const b = ev.target.closest("button");
        clickWasPressed = !!b && b.getAttribute("aria-pressed") === "true";
      },
      true,
    );
    el.addEventListener("click", (ev) => {
      if (!ev.target.closest("button")) return;
      if (fromDrag) {
        if (isHapticSeg) sliderTick(true);
        return;
      }
      if (!clickWasPressed) sliderTick(isHapticSeg);
    });
    const onMove = (clientX) => {
      filX = clientX;
      if (filRaf) return;
      filRaf = requestAnimationFrame(() => {
        filRaf = 0;
        const btns = filBtns || (filBtns = [...el.querySelectorAll("button")]);
        const n = btns.length;
        if (n < 2) return;
        const r = filRect || (filRect = el.getBoundingClientRect());
        const w = (r.width - 8) / n;
        const pos = Math.max(0, Math.min(n - 1, (filX - r.left - 4 - w / 2) / w));
        const idx = Math.max(0, Math.min(n - 1, Math.floor((filX - r.left - 4) / w)));
        el.classList.add("dragging");
        el.style.setProperty("--fil-n", n);
        el.style.setProperty("--fil-i", pos.toFixed(3));
        if (idx !== lastIdx) {
          lastIdx = idx;
          dragChanged = idx !== startIdx;
          if (!isHapticSeg) sliderTick();
          btns.forEach((b, i) => b.setAttribute("aria-pressed", String(i === idx)));
          pendingBtn = btns[idx];
          clearTimeout(dragTimer);
          dragTimer = setTimeout(() => {
            dragTimer = 0;
            if (pendingBtn) {
              const b = pendingBtn;
              pendingBtn = null;
              fireDragClick(b);
            }
          }, 40);
        }
      });
    };
    const onEnd = () => {
      if (!active && !el.classList.contains("dragging")) return;
      const changed = dragChanged;
      active = false;
      startIdx = -1;
      lastIdx = -1;
      dragChanged = false;
      if (filRaf) {
        cancelAnimationFrame(filRaf);
        filRaf = 0;
      }
      filRect = null;
      filBtns = null;
      if (dragTimer) {
        clearTimeout(dragTimer);
        dragTimer = 0;
      }
      if (pendingBtn) {
        const b = pendingBtn;
        pendingBtn = null;
        fireDragClick(b);
      }
      sliderDragEndTick(changed);
      if (el.classList.contains("dragging")) {
        el.classList.remove("dragging");
        syncFilterBar(el);
      }
    };
    el.addEventListener("touchstart", beginDrag, { passive: true });
    el.addEventListener(
      "touchmove",
      (ev) => {
        const t = ev.touches[0];
        if (!t) return;
        ev.preventDefault();
        onMove(t.clientX);
      },
      { passive: false },
    );
    el.addEventListener("touchend", onEnd, { passive: true });
    el.addEventListener("touchcancel", onEnd, { passive: true });
    el.addEventListener("pointerdown", (ev) => {
      if (ev.pointerType === "mouse" && ev.button === 0) {
        beginDrag();
        el.setPointerCapture?.(ev.pointerId);
      }
    });
    el.addEventListener("pointermove", (ev) => {
      if (ev.pointerType === "mouse" && active) onMove(ev.clientX);
    });
    el.addEventListener("pointerup", (ev) => {
      if (ev.pointerType === "mouse") onEnd();
    });
    el.addEventListener("pointercancel", (ev) => {
      if (ev.pointerType === "mouse") onEnd();
    });
  });
})();
// 在頁面中間左右滑動切換頁面：滑得夠遠，或是短而快的一撥都算
// 手指放在可以左右捲動的區塊（例如一排照片）上時，只捲那一排，不換頁
// 正在打字（鍵盤打開）時不換頁；沒在打字的輸入框上照常可以左右滑
function typing() {
  const a = document.activeElement;
  return (
    !!a &&
    (a.tagName === "TEXTAREA" ||
      (a.tagName === "INPUT" && !/^(button|checkbox|radio|range|file|submit)$/.test(a.type)) ||
      a.isContentEditable)
  );
}
function inHScroll(el) {
  for (; el && el !== document.body; el = el.parentElement) {
    if (el.scrollWidth > el.clientWidth + 2 && /auto|scroll/.test(getComputedStyle(el).overflowX)) return true;
  }
  return false;
}
// 左右滑換分類頁：頁面跟著手指走，放開時滑得夠遠（或夠快）就換頁，不然彈回原位
(() => {
  let sx = null,
    sy = 0,
    st = 0,
    onPhoto = false,
    mode = "", // ""：還沒判斷方向；"h"：左右滑（跟手）；"v"：上下捲（不管）
    sec = null,
    target = null,
    dx = 0;
  const neighbor = (d) => {
    const vis = CATS.filter((c) => catSecs(c).length),
      cur = CATS.find((c) => c.secs.includes(view));
    return vis[vis.indexOf(cur) + (d < 0 ? 1 : -1)] || null;
  };
  const clear = (el) => {
    if (!el) return;
    el.style.transition = el.style.transform = el.style.opacity = el.style.animation = "";
    // 拿掉 animation:none 時不要讓進場動畫重播一次
    el.classList.add("settled");
  };
  const snapBack = (el) => {
    el.style.transition = "transform .26s cubic-bezier(.22,1.22,.36,1),opacity .2s ease";
    el.style.transform = "translate3d(0,0,0)";
    el.style.opacity = "1";
    setTimeout(() => clear(el), 280);
  };
  document.addEventListener(
    "touchstart",
    (ev) => {
      sx = null;
      mode = "";
      if (
        ev.touches.length > 1 ||
        !$("lightbox").hidden ||
        !$("gate").hidden ||
        ev.target.closest("select,input[type=range],#hearts,#subNav,#tabBar,.filter,.chart,.ph-stage") ||
        typing() ||
        inHScroll(ev.target)
      )
        return;
      const tx = ev.touches[0].clientX;
      // 螢幕左右最邊緣留給手機系統手勢（例如 iPhone 返回上一頁），不要搶著換頁
      if (tx < 24 || tx > innerWidth - 24) return;
      sx = tx;
      sy = ev.touches[0].clientY;
      st = Date.now();
      dx = 0;
      onPhoto = !!ev.target.closest("img,[data-open],.ph-slot,.ph-big,.wall-grid,#wall,#todayPhotos");
      sec = document.querySelector(".wrap>section.current");
    },
    { passive: true },
  );
  document.addEventListener(
    "touchmove",
    (ev) => {
      if (sx === null || mode === "v") return;
      const t = ev.touches[0],
        mx = t.clientX - sx,
        my = t.clientY - sy;
      if (!mode) {
        if (Math.abs(mx) < 10 && Math.abs(my) < 10) return;
        // 照片上要更水平才算左右滑，避免看照片時不小心換頁
        mode = Math.abs(mx) > Math.abs(my) * (onPhoto ? 2.5 : 1.2) ? "h" : "v";
        if (mode === "v") return;
        if (sec) {
          sec.style.animation = "none";
          sec.style.transition = "none";
        }
      }
      ev.preventDefault();
      dx = mx;
      target = neighbor(dx);
      if (!sec) return;
      // 這邊沒有下一頁：只讓它拉一點點，像橡皮筋
      const x = target ? dx : dx * 0.22;
      sec.style.transform = `translate3d(${x.toFixed(1)}px,0,0)`;
      sec.style.opacity = target ? String(Math.max(0.55, 1 - Math.abs(dx) / innerWidth / 1.5)) : "1";
    },
    { passive: false },
  );
  const end = () => {
    if (sx === null) return;
    sx = null;
    if (mode !== "h") return;
    mode = "";
    const el = sec,
      ax = Math.abs(dx),
      fast = ax >= 40 && ax / Math.max(1, Date.now() - st) > 0.45,
      go = target && (ax > innerWidth * (onPhoto ? 0.3 : 0.22) || fast);
    if (!el) return;
    if (!go) return snapBack(el);
    // 舊頁往手指的方向滑出去一小段，新頁從另一邊接著滑進來
    el.style.transition = "transform .12s ease-out,opacity .12s ease-out";
    el.style.transform = `translate3d(${(dx + (dx < 0 ? -1 : 1) * innerWidth * 0.12).toFixed(1)}px,0,0)`;
    // 不要淡到全透明：深色模式下會像整個畫面閃一下空白
    el.style.opacity = "0.4";
    const next = target;
    setTimeout(() => {
      clear(el);
      activateCat(next.id);
    }, 120);
  };
  document.addEventListener("touchend", end, { passive: true });
  document.addEventListener(
    "touchcancel",
    () => {
      if (mode === "h" && sec) snapBack(sec);
      sx = null;
      mode = "";
    },
    { passive: true },
  );
})();

// 今天的日記放在最前面；自己今天寫過就先收起表單，有草稿或正在編輯時一定打開
let diaryFormOpen = false;
function renderDiaryToday() {
  const tk = key(today()),
    me = myName(),
    list = entries.filter((e) => e.date === tk).sort(byAt),
    mine = list.some((e) => e.by === me);
  const draft = !!lsGet(DRAFT_KEY);
  $("diaryForm").hidden = !(!mine || diaryFormOpen || editId || draft);
  $("dNew").hidden = !mine || !!editId || draft;
  $("dNew").textContent = diaryFormOpen ? "收起" : "✏️ 再寫一篇";
  $("diaryN").textContent = `${entries.length} 篇`;
  const box = $("diaryToday");
  box.innerHTML = list.map((e) => diaryCard(e, "today")).join("");
  const fresh = justIn && !justIn.popped && box.querySelector(".just-in");
  if (fresh) {
    justIn.popped = true;
    popFloat(fresh, "💌");
  }
  // 正在看日記頁時對方寫了新的：直接算看過，回到今天頁不會再提醒
  if (view === "quests" && !document.hidden && db && dataReady && partnerNew().diary.length) {
    markPartnerSeen("diary");
    renderNewNudge();
  }
  bindEntryActs(box, "today");
}
$("diaryMore").addEventListener("toggle", () => {
  if ($("diaryMore").open) renderEntries();
});
$("dNew").onclick = () => {
  diaryFormOpen = !diaryFormOpen;
  if (!diaryFormOpen) $("dDate").value = key(today());
  renderDiaryToday();
  if (diaryFormOpen) growAll();
};

// 照片壓縮尺寸：原圖最多約 300KB，放得下原本兩倍以上的張數
const PHOTO_MAX = 420000;
const shrinkFull = (im) => shrink(im, 1280, PHOTO_MAX, 0.76),
  shrinkThumb = (im) => shrink(im, 420, 60000, 0.72);

// 日記照片：一篇最多 9 張，每張存成 photos/pics 各一筆，用 entry 欄位指回日記
const DIARY_PH_MAX = 9;
let diaryUp = null,
  diaryUpProg = "",
  addTarget = null,
  _entryMeta = null;
function entryMetaMap() {
  if (_entryMeta) return _entryMeta;
  const repliesByEntry = new Map(),
    photosByEntry = new Map(),
    dailyPhotosByKey = new Map(),
    firstEntryIds = new Set(),
    seenFirst = new Set();
  [...store.replies].sort(byAt).forEach((r) => {
    if (!repliesByEntry.has(r.entry)) repliesByEntry.set(r.entry, []);
    repliesByEntry.get(r.entry).push(r);
  });
  calAllPhotos().forEach((p) => {
    if (p.trashed) return;
    if (p.entry) {
      if (!photosByEntry.has(p.entry)) photosByEntry.set(p.entry, []);
      photosByEntry.get(p.entry).push(p);
    } else if (p.date && p.by) {
      const k = p.date + "_" + p.by;
      if (!dailyPhotosByKey.has(k)) dailyPhotosByKey.set(k, []);
      dailyPhotosByKey.get(k).push(p);
    }
  });
  for (const list of photosByEntry.values()) list.sort(byAt);
  for (const [k, list] of dailyPhotosByKey) list.sort((a, b) => (b.id === k) - (a.id === k) || byAt(a, b));
  [...entries]
    .sort((a, b) => (String(a.date) + a.at).localeCompare(String(b.date) + b.at))
    .forEach((e) => {
      const k = e.date + "_" + e.by;
      if (!seenFirst.has(k)) {
        seenFirst.add(k);
        firstEntryIds.add(e.id);
      }
    });
  _entryMeta = { repliesByEntry, photosByEntry, dailyPhotosByKey, firstEntryIds };
  return _entryMeta;
}
const entryPhotos = (id) => entryMetaMap().photosByEntry.get(id) || [];
function pickFiles(files, max) {
  return [...files]
    .filter((f) => /^image\//.test(f.type) || /\.(heic|heif|jpe?g|png|webp|gif)$/i.test(f.name))
    .slice(0, Math.max(0, max));
}
$("dPhotoFile").addEventListener("change", async () => {
  const files = $("dPhotoFile").files,
    target = addTarget;
  addTarget = null;
  if (!files || !files.length || !target) return;
  const e = entries.find((x) => x.id === target);
  if (!e) return;
  const list = pickFiles(files, DIARY_PH_MAX - entryPhotos(e.id).length);
  if (list.length < files.length) toast(`一篇最多 ${DIARY_PH_MAX} 張，只放前 ${list.length} 張`);
  const n = await uploadQueue(
    e.id,
    e.date,
    list.map((f) => ({ file: f })),
  );
  if (n) {
    saveToast(`加了 ${n} 張照片 📷`, navigator.onLine);
    const targetHash = e.date === key(today()) ? "#quests" : "#calendar:" + e.date;
    notifyPartner("📷 日記新照片", `${myName()}在日記加了 ${n} 張照片`, targetHash, "dphoto-" + e.id, lastUploadWriteP);
  }
});
document.addEventListener("click", (ev) => {
  const a = ev.target.closest("[data-addph]");
  if (a && !a.disabled) {
    if (!navigator.onLine) {
      toast("沒有網路，連上後再加照片");
      return;
    }
    if (diaryUp) return;
    addTarget = a.dataset.addph;
    $("dPhotoFile").value = "";
    $("dPhotoFile").click();
  }
});
let lastUploadWriteP = Promise.resolve();
async function uploadQueue(entryId, date, list) {
  if (!db || !list.length) return 0;
  diaryUp = entryId;
  diaryUpProg = list.length > 1 ? `1 / ${list.length}` : "";
  renderAll();
  let ok = 0;
  const writePs = [],
    savedList = [];
  await withBusy(async () => {
    for (let i = 0; i < list.length; i++) {
      diaryUpProg = list.length > 1 ? `${i + 1} / ${list.length}` : "";
      const label = diaryUpProg ? `上傳中 ${diaryUpProg}…` : "上傳中…";
      document.querySelectorAll(`[data-addph="${entryId}"]`).forEach((b) => (b.textContent = label));
      try {
        const saved = await savePhoto(list[i].file, date, { entry: entryId });
        writePs.push(saved._writeP);
        savedList.push(saved);
        ok++;
        if (i < list.length - 1) renderAll();
      } catch (e) {
        toast(e && e.message === "decode" ? "有一張照片讀不到，先跳過" : "有一張照片沒傳成功，可以之後再加");
      }
    }
  });
  (list || []).forEach((q) => q.url && URL.revokeObjectURL(q.url));
  lastUploadWriteP = Promise.all(writePs);
  settlePhotos(savedList, () => "有照片沒傳成功，可以之後再加");
  diaryUp = null;
  diaryUpProg = "";
  updateSyncStatus();
  renderAll();
  return ok;
}

// 回應日記：留言和表情貼圖都存成獨立資料，不佔日記本身的欄位
const REACTS = ["❤️", "😂", "🥺"];
// 按「＋」才跳出的更多表情（有人用過才會出現在那篇日記的表情列；🥰👏 是舊版常駐的，舊貼圖照樣顯示）
const MORE_REACTS = ["🥰", "👏", "😘", "🤗", "🥹", "😭", "😍", "🔥", "🫶", "💯"];
let replyTo = null;
const replyFormEl = $("replyForm"),
  replyTextEl = $("replyText");
function entryExtras(e, where) {
  const me = myName(),
    meta = entryMetaMap(),
    rs = meta.repliesByEntry.get(e.id) || [],
    texts = rs.filter((r) => r.kind === "text"),
    emos = rs.filter((r) => r.kind === "emo"),
    first = meta.firstEntryIds.has(e.id);
  const own = meta.photosByEntry.get(e.id) || [],
    phs = [...(where === "list" && first ? meta.dailyPhotosByKey.get(e.date + "_" + e.by) || [] : []), ...own];
  const canAdd = db && !photoErr && e.by === me && own.length < DIARY_PH_MAX;
  const upLabel = diaryUpProg ? `上傳中 ${diaryUpProg}…` : "上傳中…";
  const addBtn = canAdd
    ? `<button type="button" class="btn ghost" data-addph="${esc(e.id)}" ${diaryUp === e.id ? "disabled" : ""}` +
      `>${diaryUp === e.id ? upLabel : "📷 加照片"}</button>`
    : "";
  const acts =
    `<div class="acts">${!e.by || e.by === me ? `<button class="btn ghost edit" type="button" data-id="${esc(e.id)}">✏️ 編輯</button>` : ""}` +
    `<button class="btn ghost del" type="button" data-id="${esc(e.id)}">刪除</button></div>`;
  const reactBtns = [...new Set([...REACTS, ...emos.map((r) => r.text).filter((t) => MORE_REACTS.includes(t))])]
    .map((em) => {
      const who = [
          ...new Set(
            emos
              .filter((r) => r.text === em)
              .map((r) => r.by)
              .filter(Boolean),
          ),
        ],
        mine = who.includes(me);
      return (
        `<button type="button" class="react-btn ${mine ? "on" : ""}" data-react="${esc(e.id)}" data-em="${em}" ` +
        `aria-pressed="${mine}" title="${who.length ? esc(who.join("、")) : "按表情"}">${em}` +
        `${who.length ? `<small>${who.map((n) => NAME_IC[n] || esc(n)).join("")}</small>` : ""}</button>`
      );
    })
    .join("");
  return (
    `${phs.length ? `<div class="wall-grid">${phs.map((p) => photoBtn(p, "")).join("")}</div>` : ""}` +
    `${texts.length ? `<div class="replies">${texts.map((r) => `<div class="reply ${r.by === me ? "me" : ""}"><b>${esc(r.by)}</b> ${escLink(r.text)}` + `${r.by === me ? ` <button type="button" class="reply-del" data-replydel="${esc(r.id)}" aria-label="刪除這則回應">✕</button>` : ""}` + `</div>`).join("")}` + `</div>` : ""}` +
    `<div class="reply-bar"><div class="react-bar">${reactBtns}<button type="button" class="react-btn react-more" ` +
    `data-reactmore="${esc(e.id)}" aria-label="更多表情" aria-haspopup="menu">＋</button></div><button type="button" class="btn ghost" data-reply="${esc(e.id)}" data-where="${where}` +
    `">💬 回應</button></div><div class="entry-acts">${addBtn}${acts}</div><div data-replyslot="${where}:${esc(e.id)}"></div>`
  );
}
function closeReply() {
  replyTo = null;
  replyFormEl.hidden = true;
  document.body.append(replyFormEl);
}
$("replyClose").onclick = closeReply;
function attachReply(where) {
  if (!replyTo || replyTo.where !== where) return;
  const slot = document.querySelector(`[data-replyslot="${where}:${replyTo.entry}"]`);
  if (!slot) {
    closeReply();
    return;
  }
  replyFormEl.hidden = false;
  slot.append(replyFormEl);
  replyTextEl.focus({ preventScroll: true });
}
function bindEntryActs(box, where) {
  attachReply(where);
  box.querySelectorAll(".edit").forEach((b) => (b.onclick = () => startEdit(b.dataset.id)));
  armDelete(box, "diary", delEntry, "確定刪除？再按一次");
}
async function dropReply(id) {
  const old = store.replies;
  store.replies = old.filter((r) => r.id !== id);
  renderAll();
  try {
    db ? await commit(xRef("replies", id).delete()) : saveLocal();
  } catch (e) {
    store.replies = old;
    renderAll();
    toast("刪除失敗");
  }
}
document.addEventListener("click", (ev) => {
  const rc = ev.target.closest("[data-react]");
  if (rc) {
    const entry = rc.dataset.react,
      text = rc.dataset.em,
      me = myName(),
      hit = store.replies.find((r) => r.entry === entry && r.kind === "emo" && r.text === text && r.by === me);
    if (hit) {
      dropReply(hit.id);
    } else {
      popFloat(rc, text);
      const eDate = entries.find((e) => e.id === entry)?.date;
      const target = !eDate || eDate === key(today()) ? "#quests" : "#calendar:" + eDate;
      addDoc("replies", { entry, kind: "emo", text, by: me, at: nowIso() })
        .then(() => notifyPartner("💗 日記貼圖", `${me}對日記按了 ${text}`, target, "react-" + entry))
        .catch(() => toast(NOSAVE));
    }
    return;
  }
  const r = ev.target.closest("[data-reply]");
  if (r) {
    if (replyTo && replyTo.entry === r.dataset.reply && replyTo.where === r.dataset.where) {
      closeReply();
      return;
    }
    replyTo = { entry: r.dataset.reply, where: r.dataset.where };
    attachReply(replyTo.where);
    return;
  }
  const d = ev.target.closest("[data-replydel]");
  if (d && confirmTap(d, "確定刪除？", "✕")) dropReply(d.dataset.replydel);
});
// 表情列最後的「＋」：跳出更多表情，點一下就送出
(() => {
  const pick = document.createElement("div");
  pick.className = "react-pick";
  pick.hidden = true;
  pick.setAttribute("role", "menu");
  pick.setAttribute("aria-label", "選一個表情");
  document.body.append(pick);
  let from = null;
  const close = () => {
    pick.hidden = true;
    from = null;
  };
  document.addEventListener("click", (ev) => {
    const more = ev.target.closest("[data-reactmore]");
    if (more) {
      if (from === more) {
        close();
        return;
      }
      const id = more.dataset.reactmore;
      pick.innerHTML = [...REACTS, ...MORE_REACTS]
        .map((em) => `<button type="button" class="react-btn" data-react="${esc(id)}" data-em="${em}">${em}</button>`)
        .join("");
      pick.hidden = false;
      from = more;
      const r = more.getBoundingClientRect(),
        w = pick.offsetWidth,
        h = pick.offsetHeight;
      pick.style.left = Math.max(8, Math.min(innerWidth - w - 8, r.left + r.width / 2 - w / 2)) + "px";
      pick.style.top = (r.top - h - 8 < 8 ? r.bottom + 8 : r.top - h - 8) + "px";
      return;
    }
    if (!pick.hidden && (ev.target.closest(".react-pick [data-react]") || !ev.target.closest(".react-pick"))) {
      setTimeout(close, 0);
    }
  });
  window.addEventListener("scroll", () => !pick.hidden && close(), { passive: true });
})();
bindForm(
  "replyForm",
  "replySend",
  () => {
    const text = replyTextEl.value.trim();
    return (
      text && replyTo && { c: "replies", doc: { entry: replyTo.entry, kind: "text", text, by: myName(), at: nowIso() } }
    );
  },
  () => {
    const txt = replyTextEl.value.trim(),
      eid = replyTo ? replyTo.entry : "",
      eDate = entries.find((e) => e.id === eid)?.date,
      target = !eDate || eDate === key(today()) ? "#quests" : "#calendar:" + eDate;
    replyTextEl.value = "";
    closeReply();
    saveToast("回應送出了 💬");
    notifyPartner("💬 日記新回應", `${myName()}回應了日記：「${txt.slice(0, 30)}」`, target, "reply-" + eid);
  },
);

// 首頁提醒列共用產生器（時光膠囊到期、備份提醒、照片空間提醒）
function setNudge(id, show, text, href, goLabel, laterLabel, onLater, onGo) {
  const box = $(id);
  if (!box) return;
  if (!show) {
    box.hidden = true;
    syncNotices();
    return;
  }
  box.innerHTML =
    `<div class="row between"><span>${text}</span><div class="row">` +
    `<a class="btn" href="#${href}">${goLabel}</a>` +
    `<button class="btn ghost" type="button">${laterLabel}</button></div></div>`;
  box.hidden = false;
  syncNotices();
  if (onGo) box.querySelector("a").onclick = onGo;
  box.querySelector("button").onclick = onLater;
}
const CAP_SEEN_KEY = "love-base-cap-seen";
function seenCaps() {
  return lsJson(CAP_SEEN_KEY, []);
}
function markCapsSeen(ids) {
  if (!ids.length) return;
  lsSet(CAP_SEEN_KEY, JSON.stringify([...new Set([...seenCaps(), ...ids])]));
}
function renderCapNudge() {
  const tk = key(today()),
    seen = new Set(seenCaps()),
    ready = store.capsules.filter((c) => c.openDate <= tk && !seen.has(c.id)),
    show = !!(db && dataReady && ready.length && !layout.hidden.includes("memories")),
    ack = () => {
      markCapsSeen(ready.map((c) => c.id));
      renderCapNudge();
    };
  setNudge(
    "capNudge",
    show,
    `💌 有 ${ready.length} 顆時光膠囊到時間打開了！`,
    "capsule",
    "去看膠囊",
    "知道了",
    ack,
    ack,
  );
  if (!db || !dataReady) return;
  renderCapNudge.sent = renderCapNudge.sent || new Set();
  const unsent = store.capsules.filter(
    (c) => c.openDate <= tk && !renderCapNudge.sent.has(c.id) && !store.remind.some((r) => r.id === "cap-" + c.id),
  );
  if (!unsent.length) return;
  unsent.forEach((c) => renderCapNudge.sent.add(c.id));
  Promise.all(
    unsent.map((c) => commit(xRef("remind", "cap-" + c.id).set({ date: c.openDate, by: myName(), at: nowIso() }))),
  )
    .then(() =>
      sendPush(
        {
          title: "💌 時光膠囊到時間打開了！",
          body: `有 ${unsent.length} 顆時光膠囊已經可以打開囉，快來看看當時寫了什麼`,
          url: "./#capsule",
          tag: "cap-" + tk,
        },
        "all",
      ),
    )
    .catch(() => {});
}
$("capsule").addEventListener("toggle", () => {
  if ($("capsule").open) {
    const tk = key(today()),
      ids = store.capsules.filter((c) => c.openDate <= tk).map((c) => c.id);
    if (ids.length) {
      markCapsSeen(ids);
      renderCapNudge();
    }
  }
});

// 下拉重新整理：從主畫面打開時（iPhone、Android 都）沒有瀏覽器的下拉更新，自己做一個
(() => {
  const ind = document.createElement("div");
  ind.className = "ptr";
  ind.setAttribute("aria-hidden", "true");
  document.body.append(ind);
  let sy = null,
    sx = 0,
    pull = 0;
  const reset = () => {
    sy = null;
    pull = 0;
    ind.classList.remove("on", "go");
    ind.style.transform = "";
  };
  document.addEventListener(
    "touchstart",
    (ev) => {
      reset();
      if (!isStandalone() || ev.touches.length > 1 || scrollY > 0) return;
      if (!$("lightbox").hidden || !$("gate").hidden) return;
      if (ev.target.closest("input,textarea,select,.react-pick,#hearts,.chart")) return;
      sy = ev.touches[0].clientY;
      sx = ev.touches[0].clientX;
    },
    { passive: true },
  );
  document.addEventListener(
    "touchmove",
    (ev) => {
      if (sy === null) return;
      const t = ev.touches[0],
        dy = t.clientY - sy,
        dx = Math.abs(t.clientX - sx);
      if (dy <= 0 || dx > dy || scrollY > 0) {
        if (dy < 0 || dx > 30) reset();
        return;
      }
      pull = Math.min(dy, 140);
      ind.classList.add("on");
      ind.classList.toggle("go", pull >= 80);
      ind.textContent = pull >= 80 ? "放開更新 🔄" : "下拉更新 ↓";
      ind.style.transform = `translate3d(-50%,${pull * 0.6}px,0)`;
    },
    { passive: true },
  );
  document.addEventListener(
    "touchend",
    () => {
      if (sy !== null && pull >= 80) {
        ind.textContent = "更新中…";
        haptic();
        setTimeout(() => location.reload(), 120);
        return;
      }
      reset();
    },
    { passive: true },
  );
  document.addEventListener("touchcancel", reset, { passive: true });
})();
// 紀念日前一天提醒：首頁顯示「明天是…」；當天第一個打開基地的人會順便推播給兩個人（done 裡記一筆 remind，不重複發）
const REMIND_SEEN = "love-base-remind-seen";
function renderRemind() {
  const t = today(),
    tmr = key(new Date(t.getFullYear(), t.getMonth(), t.getDate() + 1)),
    sp = specialOf(tmr);
  let seen = lsGet(REMIND_SEEN);
  const [, m, d] = tmr.split("-").map(Number),
    text = sp ? `${sp.emo} 明天（${m}/${d}）是${sp.text}，記得準備一下喔` : "";
  setNudge("remindNudge", !!(sp && dataReady && seen !== tmr), text, "calendar", "看月曆", "知道了", () => {
    lsSet(REMIND_SEEN, tmr);
    renderRemind();
  });
  if (!sp || !db || !dataReady || renderRemind.sent === tmr || store.remind.some((r) => r.id === tmr)) return;
  renderRemind.sent = tmr;
  commit(xRef("remind", tmr).set({ date: tmr, by: myName(), at: nowIso() }))
    .then(() =>
      sendPush({ title: `${sp.emo} 明天是${sp.text}`, body: text, url: "./#calendar", tag: "remind-" + tmr }, "all"),
    )
    .catch(() => {});
}
// 願望約定日期提醒：今天或明天有約好的願望就提醒（明天的那則也推播，跟每晚的自動提醒共用同一筆紀錄，不會重複）
const PLAN_SEEN = "love-base-plan-seen";
function renderPlanNudge() {
  const t = today(),
    tk = key(t),
    tmr = key(addDays(t, 1)),
    td = plansOn(tk),
    tm = plansOn(tmr),
    list = (ws) => ws.map((w) => `「${esc(String(w.text).slice(0, 24))}」`).join("、"),
    text = td.length
      ? `📅 今天約好要${list(td)}，完成後記得在願望清單打勾`
      : tm.length
        ? `📅 明天 ${mdw(tmr)} 約好要${list(tm)}`
        : "",
    tag = (td.length ? tk : tmr) + ":" + [...td, ...tm].map((w) => w.id).join(",");
  setNudge("planNudge", !!(text && dataReady && lsGet(PLAN_SEEN) !== tag), text, "wishes", "看願望", "知道了", () => {
    lsSet(PLAN_SEEN, tag);
    renderPlanNudge();
  });
  const rid = "plan-" + tmr;
  if (!tm.length || !db || !dataReady || renderPlanNudge.sent === rid || store.remind.some((r) => r.id === rid)) return;
  renderPlanNudge.sent = rid;
  commit(xRef("remind", rid).set({ date: tmr, by: myName(), at: nowIso() }))
    .then(() =>
      sendPush(
        {
          title: "📅 明天約好了！",
          body: `明天 ${mdw(tmr)} 約好要${tm.map((w) => `「${String(w.text).slice(0, 20)}」`).join("、")}`,
          url: "./#wishes",
          tag: rid,
        },
        "all",
      ),
    )
    .catch(() => {});
}
// iPhone 用 Safari 直接開時收不到推播和紅點，教她加到主畫面（按「之後再說」隔 7 天）
const IOS_SNOOZE = "love-base-ios-snooze";
function renderIosNudge() {
  let snooze = +lsGet(IOS_SNOOZE) || 0;
  setNudge(
    "iosNudge",
    !!(isIOS && !isStandalone() && Date.now() >= snooze),
    "📱 用 Safari 開收不到通知和紅點：按下方 分享 ⬆️ →「加入主畫面」，之後從桌面的基地圖示打開（第一次要再輸入一次暗號）",
    "installText",
    "看說明",
    "之後再說",
    () => {
      lsSet(IOS_SNOOZE, Date.now() + 7 * 864e5);
      renderIosNudge();
    },
  );
}
// 備份提醒：任何一人備份過都算，超過 30 天才提醒，按「之後再說」隔 7 天
const BK_SNOOZE = "love-base-backup-snooze";
let dataReady = false;
function renderBackupNudge() {
  let snooze = +lsGet(BK_SNOOZE) || 0;
  const last = store.backups.reduce((a, b) => (String(b.at) > a ? String(b.at) : a), ""),
    days = last ? Math.floor((Date.now() - new Date(last).getTime()) / 864e5) : null,
    started = entries.reduce((a, e) => Math.min(a, new Date(e.at).getTime() || a), Date.now()),
    show = !!(
      db &&
      dataReady &&
      entries.length &&
      (days === null ? Date.now() - started >= 7 * 864e5 : days >= 30) &&
      Date.now() >= snooze
    );
  setNudge(
    "bkNudge",
    show,
    `💾 ${days === null ? "你們的日記還沒備份過" : `已經 ${days} 天沒備份了`}`,
    "bkBox",
    "去備份",
    "之後再說",
    () => {
      lsSet(BK_SNOOZE, Date.now() + 7 * 864e5);
      renderBackupNudge();
    },
  );
}

// 照片空間提醒：每半年（180 天）提醒一次，按「之後再說」隔 14 天
const PIC_SCAN_KEY = "love-base-last-pic-scan",
  PIC_SNOOZE = "love-base-pic-snooze";
function renderPicNudge() {
  const last = +lsGet(PIC_SCAN_KEY) || 0,
    snooze = +lsGet(PIC_SNOOZE) || 0;
  const started = [...store.bonus, ...photos].reduce(
      (a, p) => Math.min(a, new Date(p.at || p.date).getTime() || a),
      Date.now(),
    ),
    show = !!(
      db &&
      dataReady &&
      (photos.length || store.bonus.length) &&
      Date.now() - (last || started) >= 180 * 864e5 &&
      Date.now() >= snooze
    );
  setNudge("picNudge", show, "🗜️ 已經半年沒檢查照片空間囉", "picBox", "去檢查", "之後再說", () => {
    lsSet(PIC_SNOOZE, Date.now() + 14 * 864e5);
    renderPicNudge();
  });
}

// Google 雲端每月自動備份程式碼（貼到個人 Google Apps Script 使用）
const GAS_BACKUP_CODE = `// 我們的戀愛遊戲基地 — Google 雲端每月自動備份小幫手
// 1. 確認下方 ROOM_CODE 是你們的基地暗號（請勿分享此專案給別人）
// 2. 在上方函式選單選擇「setupMonthlyTrigger」並按「執行」授權即可完成
const ROOM_CODE = "__ROOM_CODE__";
const FOLDER_NAME = "戀愛基地備份";
const WARN_MB = 700;
const PROJECT_ID = "love-base-eec24";

function setupMonthlyTrigger() {
  ScriptApp.getProjectTriggers().forEach((t) => {
    if (t.getHandlerFunction() === "runMonthlyBackup") ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger("runMonthlyBackup").timeBased().onMonthDay(1).atHour(3).create();
  runMonthlyBackup();
}

function fromFsVal(v) {
  if (!v || typeof v !== "object") return null;
  if ("stringValue" in v) return v.stringValue;
  if ("integerValue" in v) return Number(v.integerValue);
  if ("doubleValue" in v) return Number(v.doubleValue);
  if ("booleanValue" in v) return Boolean(v.booleanValue);
  if ("nullValue" in v) return null;
  if ("timestampValue" in v) return v.timestampValue;
  if ("arrayValue" in v) return (v.arrayValue.values || []).map(fromFsVal);
  if ("mapValue" in v) return fromFsFields(v.mapValue.fields || {});
  return null;
}

function fromFsFields(f) {
  const o = {};
  Object.keys(f || {}).forEach((k) => (o[k] = fromFsVal(f[k])));
  return o;
}

function fetchColl(base, coll) {
  const out = {};
  const size = coll === "pics" ? 40 : 200;
  let token = "";
  do {
    const url = base + "/" + coll + "?pageSize=" + size + (token ? "&pageToken=" + encodeURIComponent(token) : "");
    const res = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    if (res.getResponseCode() !== 200) throw new Error("讀取 " + coll + " 失敗：" + res.getContentText());
    const body = JSON.parse(res.getContentText());
    (body.documents || []).forEach((d) => {
      const id = d.name.split("/").pop();
      out[id] = fromFsFields(d.fields || {});
    });
    token = body.nextPageToken || "";
  } while (token);
  return out;
}

function escHtml(s) {
  return String(s || "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

function runMonthlyBackup() {
  if (!ROOM_CODE || ROOM_CODE.indexOf("把這裡換成") >= 0 || ROOM_CODE.length < 8) {
    throw new Error("請先把 ROOM_CODE 改成你們的基地暗號（至少 8 個字）");
  }
  const base =
    "https://firestore.googleapis.com/v1/projects/" +
    PROJECT_ID +
    "/databases/(default)/documents/rooms/" +
    encodeURIComponent(ROOM_CODE);
  const data = {};
  ["done", "diary", "photos", "pics"].forEach((c) => (data[c] = fetchColl(base, c)));

  const nowIso = new Date().toISOString();
  const todayStr = Utilities.formatDate(new Date(), "Asia/Taipei", "yyyy-MM-dd");
  const diary = Object.entries(data.diary)
    .map(([id, v]) => Object.assign({ id }, v))
    .filter((x) => !x.trashed);
  const photos = Object.entries(data.photos)
    .map(([id, v]) => Object.assign({ id }, v))
    .filter((x) => !x.trashed);
  const totalBytes = Object.values(data.pics).reduce((s, d) => s + String(d.img || "").length, 0);
  const mb = Number((totalBytes / 1048576).toFixed(1));

  diary.sort((a, b) => String(a.date || "").localeCompare(String(b.date || "")));
  photos.sort((a, b) => String(a.at || a.date || "").localeCompare(String(b.at || b.date || "")));
  const xs = (c) =>
    Object.entries(data.done || {})
      .filter(([k]) => k.indexOf("x~" + c + "~") === 0)
      .map(([k, v]) => Object.assign({ id: k.split("~")[2] }, v))
      .filter((x) => !x.trashed)
      .sort((a, b) => String(a.at || "").localeCompare(String(b.at || "")));
  const replies = xs("replies");
  const reviews = xs("reviews");
  const wishes = xs("wishes");
  const rounds = xs("rounds");
  const answers = xs("answers");
  const caps = xs("capsules");
  const passed = rounds.filter(
    (r) => new Set(answers.filter((a) => a.round === r.id).map((a) => a.by)).size >= 2,
  );
  const payload = { app: "love-base", version: 2, exportedAt: nowIso, full: true, data };
  const json = JSON.stringify(payload).replace(/</g, "\\\\u003c");
  const pics = data.pics || {};
  const imgSrc = (p) => (pics[p.id] && pics[p.id].img) || p.th;
  const seenFirst = {};
  const firstIds = {};
  diary.forEach((e) => {
    const k = e.date + "_" + e.by;
    if (!seenFirst[k]) {
      seenFirst[k] = true;
      firstIds[e.id] = true;
    }
  });
  const articles = diary
    .map((e) => {
      const daily = firstIds[e.id] ? photos.filter((p) => !p.entry && p.date === e.date && p.by === e.by) : [];
      const phs = daily.concat(photos.filter((p) => p.entry === e.id));
      const texts = replies.filter((r) => r.entry === e.id && r.kind === "text");
      return (
        "<article><h3>" +
        escHtml(e.date) +
        " · " +
        escHtml(e.by) +
        (e.happy ? " · ⭐ " + escHtml(e.happy) + "/10" : "") +
        "</h3>" +
        (e.mood ? "<p><b>心情：</b>" + escHtml(e.mood) + "</p>" : "") +
        (e.food ? "<p><b>吃了：</b>" + escHtml(e.food) + "</p>" : "") +
        (e.funny ? "<p><b>最好笑：</b>" + escHtml(e.funny) + "</p>" : "") +
        (e.say ? "<p>" + escHtml(e.say) + "</p>" : "") +
        (e.s1 || e.s2
          ? "<blockquote>今天雖然" + escHtml(e.s1 || "＿＿") + "，但因為有你" + escHtml(e.s2 || "＿＿") + "。</blockquote>"
          : "") +
        (phs.length
          ? '<div class="dph">' +
            phs.map((p) => '<img src="' + escHtml(imgSrc(p)) + '" alt="日記照片" loading="lazy">').join("") +
            "</div>"
          : "") +
        texts.map((r) => '<p class="re"><b>' + escHtml(r.by) + "</b> " + escHtml(r.text) + "</p>").join("") +
        "</article>"
      );
    })
    .join("");
  const revDates = [...new Set(reviews.map((r) => r.date))].sort();
  const revHtml = revDates.length
    ? "<h2>📝 每週回顧</h2>" +
      revDates
        .map(
          (d) =>
            "<article><h3>" +
            escHtml(d) +
            "</h3>" +
            reviews
              .filter((r) => r.date === d)
              .map((r) => "<p><b>" + escHtml(r.by) + "：</b>" + escHtml(r.text) + "</p>")
              .join("") +
            "</article>",
        )
        .join("")
    : "";
  const wishHtml = wishes.length
    ? "<h2>🌠 願望清單</h2><ul>" +
      wishes
        .map(
          (w) =>
            "<li>" +
            (w.done ? "✅ " : "⬜ ") +
            escHtml(w.text) +
            (w.done && w.doneDate ? "（" + escHtml(w.doneDate) + " 完成）" : "") +
            "</li>",
        )
        .join("") +
      "</ul>"
    : "";
  const drawHtml = passed.length
    ? "<h2>🎲 抽題紀錄</h2>" +
      passed
        .map((r) => {
          const byMap = {};
          answers
            .filter((a) => a.round === r.id)
            .forEach((a) => (byMap[a.by] = a.text));
          return (
            "<article><h3>" +
            escHtml(r.q) +
            "</h3>" +
            Object.keys(byMap)
              .map((who) => "<p><b>" + escHtml(who) + "：</b>" + escHtml(byMap[who]) + "</p>")
              .join("") +
            "</article>"
          );
        })
        .join("")
    : "";
  const capHtml = caps.length
    ? "<h2>⏳ 時光膠囊</h2>" +
      caps
        .map(
          (c) =>
            "<article><h3>" +
            (c.openDate > todayStr ? "🔒 封存中" : "💌 已打開") +
            " · " +
            escHtml(c.by) +
            "（" +
            escHtml(c.openDate) +
            " 打開）</h3>" +
            (c.openDate > todayStr ? "" : "<p>" + escHtml(c.text) + "</p>") +
            "</article>",
        )
        .join("")
    : "";
  const wall = photos.filter((p) => !p.entry);
  const wallHtml = wall.length
    ? "<h2>📷 照片牆（" +
      wall.length +
      ' 張）</h2><div class="grid">' +
      wall
        .map(
          (p) =>
            '<figure><img src="' +
            escHtml(imgSrc(p)) +
            '" alt="照片" loading="lazy">' +
            escHtml(p.date) +
            " · " +
            escHtml(p.by) +
            (p.cap ? "<br>" + escHtml(p.cap) : "") +
            "</figure>",
        )
        .join("") +
      "</div>"
    : "";
  const html =
    '<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
    "<title>戀愛基地自動備份 " +
    todayStr +
    "</title><style>body{margin:0;background:#fbf6f8;color:#2a1b25;font:16px/1.7 system-ui,sans-serif}main{max-width:680px;margin:0 auto;padding:24px 16px}h2{font-size:20px;margin:32px 0 12px;padding-bottom:6px;border-bottom:2px solid #e2457a}article{background:#fff;border:1px solid #ead9e1;border-radius:12px;padding:12px 16px;margin:0 0 12px;white-space:pre-wrap}blockquote{margin:8px 0 0;padding:8px 12px;background:#fde3ec;border-radius:8px}.re{margin:6px 0 0;padding:4px 10px;background:#f4ebef;border-radius:8px;font-size:14px}.dph{display:flex;flex-wrap:wrap;gap:8px;margin-top:8px}.dph img{width:130px;height:130px;object-fit:cover;border-radius:8px}.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:10px}figure{margin:0;font-size:13px;color:#7c6672}figure img{width:100%;aspect-ratio:1;object-fit:cover;border-radius:8px;display:block;margin-bottom:4px}</style></head><body><main>" +
    "<h1>我們的戀愛遊戲基地（自動備份）</h1><p>備份日期：" +
    todayStr +
    " · " +
    diary.length +
    " 篇日記 · " +
    photos.length +
    " 張照片（含原圖，約 " +
    mb +
    " MB）</p><p>要還原時，到網站「更多 → 設定 → 資料備份 → 從備份檔補回資料」選這個檔案即可。</p>" +
    articles +
    revHtml +
    wishHtml +
    drawHtml +
    capHtml +
    wallHtml +
    '</main><script type="application/json" id="love-base-backup">' +
    json +
    "</" +
    "script></body></html>";

  const folders = DriveApp.getFoldersByName(FOLDER_NAME);
  const folder = folders.hasNext() ? folders.next() : DriveApp.createFolder(FOLDER_NAME);
  const fileName = "戀愛基地備份_" + todayStr + "_完整.html";
  const file = folder.createFile(fileName, html, MimeType.HTML);

  try {
    UrlFetchApp.fetch(base + "/done/x~backups~auto_" + Date.now(), {
      method: "patch",
      contentType: "application/json",
      payload: JSON.stringify({
        fields: {
          full: { booleanValue: true },
          by: { stringValue: "自動備份" },
          at: { stringValue: nowIso },
        },
      }),
      muteHttpExceptions: true,
    });
  } catch (e) {}

  const me = Session.getActiveUser().getEmail();
  if (me) {
    const warn = mb >= WARN_MB;
    const subject = warn
      ? "⚠️ 戀愛基地照片空間已達 " + mb + " MB（已完成本月備份）"
      : "💾 戀愛基地每月自動備份完成（" + todayStr + "）";
    const body =
      "本月完整備份（含原圖）已存進你的 Google 雲端硬碟「" +
      FOLDER_NAME +
      "」資料夾！\\n\\n" +
      "• 檔案名稱：" +
      fileName +
      "\\n" +
      "• 雲端連結：" +
      file.getUrl() +
      "\\n" +
      "• 日記篇數：" +
      diary.length +
      " 篇\\n" +
      "• 照片張數：" +
      photos.length +
      " 張\\n" +
      "• 照片空間：" +
      mb +
      " MB / 1024 MB" +
      (warn ? "\\n\\n⚠️ 提醒：照片空間已超過 " + WARN_MB + " MB，可以準備考慮升級空間或搬移照片囉！" : "");
    MailApp.sendEmail(me, subject, body);
  }
}`;

if ($("appVer")) {
  const s = document.querySelector('script[src*="app.js?v="]');
  const m = s && s.getAttribute("src").match(/\?v=(\d+)/);
  if (m) $("appVer").textContent = "目前版本 v" + m[1];
}
async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
  } catch (e) {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.cssText = "position:fixed;left:-9999px;top:0;font-size:16px";
    document.body.append(ta);
    ta.focus();
    ta.select();
    ta.setSelectionRange(0, text.length);
    document.execCommand("copy");
    ta.remove();
  }
}
if ($("bkAutoCopy")) {
  $("bkAutoCopy").onclick = async () => {
    let code = lsGet(ROOM_KEY);
    const text = GAS_BACKUP_CODE.replace("__ROOM_CODE__", code || "把這裡換成你們的基地暗號");
    await copyText(text);
    toast(code ? "已複製（已自動帶入暗號，請勿外傳）📋" : "已複製自動備份程式碼 📋");
  };
}

// 照片空間
let packList = [];
const picMsg = (t) => ($("picMsg").textContent = t);
function loadSrc(src) {
  return new Promise((res, rej) => {
    const im = new Image();
    im.onload = () => res(im);
    im.onerror = rej;
    im.src = src;
  });
}
$("picScan").onclick = async () => {
  if (!db || !navigator.onLine) {
    picMsg("要連上網路才能檢查。");
    return;
  }
  $("picPack").hidden = true;
  $("picScan").disabled = true;
  picMsg("檢查中…");
  try {
    const s = await db.collection("pics").get();
    let total = 0;
    packList = [];
    s.docs.forEach((d) => {
      const n = (d.data().img || "").length;
      total += n;
      if (n > PHOTO_MAX * 1.15) packList.push(d.id);
    });
    picMsg(
      `目前有 ${s.docs.length} 張照片，約 ${(total / 1048576).toFixed(1)}` +
        ` MB，免費空間是 1024 MB。${packList.length ? "壓縮後畫質會略降，而且無法還原，建議先做完整備份。" : "都已經夠小，不用壓縮。"}`,
    );
    lsSet(PIC_SCAN_KEY, String(Date.now()));
    renderPicNudge();
    if (packList.length) {
      $("picPack").textContent = `壓縮 ${packList.length} 張舊照片`;
      $("picPack").hidden = false;
    }
  } catch (e) {
    picMsg("檢查失敗，請確認網路後再試一次。");
  }
  $("picScan").disabled = false;
};
$("picPack").onclick = async () => {
  const b = $("picPack");
  if (!confirmTap(b, "無法還原，再按一次開始", () => `壓縮 ${packList.length} 張舊照片`)) return;
  b.disabled = true;
  let ok = 0,
    saved = 0;
  await withBusy(async () => {
    try {
      for (const id of packList) {
        const snap = await db.collection("pics").doc(id).get(),
          img = snap.data()?.img;
        if (img) {
          const out = await shrinkFull(await loadSrc(img));
          if (out.length < img.length) {
            await db.collection("pics").doc(id).update({ img: out });
            saved += img.length - out.length;
          }
        }
        ok++;
        picMsg(`壓縮中… ${ok} / ${packList.length}`);
      }
      picMsg(`完成，省下約 ${(saved / 1048576).toFixed(1)} MB。`);
      toast("照片壓縮好了 🗜️");
    } catch (e) {
      picMsg(`壓到第 ${ok} 張時失敗了，已完成的不受影響，可以重新檢查後再壓一次。`);
    }
  });
  b.disabled = false;
  b.hidden = true;
  packList = [];
};

// 更換基地暗號：將四個集合完整複製到新暗號（保留舊暗號資料以防萬一）
const moveMsg = (t) => ($("moveRoomMsg").textContent = t);
$("newRoomCode").addEventListener("input", () => {
  const b = $("moveRoomBtn");
  delete b.dataset.confirm;
  b.textContent = "搬家到新暗號";
  moveMsg("");
});
$("moveRoomBtn").onclick = async () => {
  const b = $("moveRoomBtn"),
    code = $("newRoomCode").value.trim();
  if (!db || !navigator.onLine) {
    moveMsg("要連上網路才能更換暗號。");
    return;
  }
  if (!/^[A-Za-z0-9_-]{8,64}$/.test(code)) {
    moveMsg("新暗號要 8～64 個字，只能用英文、數字、- 或 _。");
    return;
  }
  if (code === getRoom()) {
    moveMsg("這已經是目前正在使用的暗號了。");
    return;
  }
  if (b.dataset.confirm !== code) {
    b.dataset.confirm = code;
    b.textContent = "確定換成這個暗號？再按一次";
    moveMsg(`即將把所有資料複製到新暗號「${code}」，舊暗號的資料也會保留。`);
    return;
  }
  delete b.dataset.confirm;
  b.disabled = $("newRoomCode").disabled = true;
  moveMsg("讀取目前基地資料中…");
  let copied = 0,
    moved = false;
  await withBusy(async () => {
    try {
      const targetDb = firebase.firestore().collection("rooms").doc(code);
      const docs = [];
      for (const c of BK_COLLS) {
        const s = await db.collection(c).get();
        s.docs.forEach((d) => docs.push([c, d.id, d.data()]));
      }
      for (const [c, id, data] of docs) {
        await targetDb.collection(c).doc(id).set(data);
        copied++;
        moveMsg(`正在搬移資料… ${copied} / ${docs.length}`);
      }
      lsSet(ROOM_KEY, code);
      moved = true;
      moveMsg(`搬家完成！共複製 ${copied} 筆資料，正在切換到新暗號…（記得請對方也換成新暗號）`);
      toast("換好新暗號了 🔐 記得告訴對方！");
    } catch (e) {
      moveMsg(`搬到第 ${copied} 筆時網路中斷，原本的資料都安全無損，請確認網路後再試一次。`);
      b.textContent = "搬家到新暗號";
      b.disabled = $("newRoomCode").disabled = false;
    }
  });
  if (moved) setTimeout(() => location.reload(), 1200);
};

// 回憶書：每月總結與年度總結（年度從 11/4 起算，每滿一年是一冊）
let bookMode = "month";
function bookCount() {
  let n = 1;
  while (new Date(LOVE_START.getFullYear() + n, LOVE_START.getMonth(), LOVE_START.getDate()) <= today()) n++;
  return n;
}
function bookMonths() {
  const list = [];
  const earliest = [
    key(LOVE_START).slice(0, 7),
    ...entries.map((e) => String(e.date).slice(0, 7)),
    ...calAllPhotos().map((p) => String(p.date).slice(0, 7)),
  ]
    .filter((m) => /^\d{4}-\d{2}$/.test(m))
    .sort()[0];
  const [y0, m0] = earliest.split("-").map(Number);
  const start = new Date(y0, m0 - 1, 1);
  const nowM = key(today()).slice(0, 7);
  for (let d = start; key(d).slice(0, 7) <= nowM; d = new Date(d.getFullYear(), d.getMonth() + 1, 1)) {
    list.push(key(d).slice(0, 7));
  }
  if (!list.length) list.push(nowM);
  return list.reverse();
}
function bookSay(e) {
  return (
    e.say || (e.s1 || e.s2 ? `今天雖然${e.s1 || "＿＿"}，但因為有你${e.s2 || "＿＿"}。` : "") || e.mood || e.funny || ""
  );
}
function bookSummaryData(es, ps, inR) {
  const rated = es.filter((e) => e.happy);
  const avg = rated.length ? (rated.reduce((s, e) => s + +e.happy, 0) / rated.length).toFixed(1) : "—";
  const doneWishes = store.wishes.filter((w) => w.done && inR(w.doneDate));
  const esIds = new Set(es.map((e) => e.id));
  const tiles = [
    ["日記", es.length + " 篇"],
    ["照片", ps.length + " 張"],
    ["一起完成", togetherDays().filter(inR).length + " 天"],
    ["抽題過關", store.rounds.filter((r) => inR(roundDay(r)) && pairOf(r.id).length >= need()).length + " 題"],
    ["達成願望", doneWishes.length + " 個"],
    ["抱抱", store.hugs.filter((h) => h.backAt && inR(dayOf(h.backAt))).length + " 次"],
    ["回應貼圖", store.replies.filter((r) => esIds.has(r.entry)).length + " 則"],
    ["平均幸福", avg],
  ];
  const best = [...rated].sort((x, y) => y.happy - x.happy || String(y.date).localeCompare(String(x.date)))[0];
  const hasActivity =
    es.length || ps.length || doneWishes.length || tiles.some(([k, v]) => k !== "平均幸福" && parseInt(v, 10) > 0);
  return { tiles, best, doneWishes, hasActivity };
}
function renderBookShell(title, sub, range, summary, bodyHtml) {
  const { tiles, best, doneWishes } = summary;
  const wishesHtml = doneWishes.length
    ? `<article class="entry book-m"><header><b>🌠 達成的願望</b><span>${doneWishes.length} 個</span></header>` +
      doneWishes.map((w) => `<div>✅ ${esc(w.text)} <small>(${esc(w.doneDate || "")})</small></div>`).join("") +
      `</article>`
    : "";
  $("bookBody").innerHTML =
    `<div class="book-cover"><b>${title}</b><span>${sub}</span><span>${range}</span></div>` +
    `<div class="stats">${tiles.map(statTile).join("")}</div>` +
    `${best ? `<div class="note">⭐ 最幸福的一天：${esc(best.date)}（${esc(best.happy)}/10）${esc(bookSay(best))}</div>` : ""}` +
    `${bodyHtml}${wishesHtml}`;
}
function renderMonthBook() {
  const pick = $("bookMonth");
  const months = bookMonths();
  const keep = months.includes(pick.value) ? pick.value : months[0];
  pick.innerHTML = months
    .map((m) => {
      const [yy, mm] = m.split("-").map(Number);
      return `<option value="${m}">${yy} 年 ${mm} 月</option>`;
    })
    .join("");
  pick.value = keep;
  const [yy, mm] = keep.split("-").map(Number);
  const a = key(new Date(yy, mm - 1, 1));
  const b = key(new Date(yy, mm, 0));
  const inR = (k) => String(k).startsWith(keep);
  loadCalPhotos(keep);
  const es = entries.filter((e) => inR(e.date)).sort((x, y) => String(x.date).localeCompare(String(y.date)));
  const ps = calAllPhotos()
    .filter((p) => inR(p.date))
    .sort(byAt);
  const summary = bookSummaryData(es, ps, inR);
  if (!summary.hasActivity) {
    $("bookBody").innerHTML = '<div class="empty">這個月還沒有回憶，寫下第一篇日記吧。</div>';
    return;
  }
  const photosHtml = ps.length
    ? `<article class="entry book-m"><header><b>📸 這個月的照片</b><span>共 ${ps.length} 張</span></header>` +
      `<div class="wall-grid">${ps
        .slice(0, 6)
        .map((p) => photoBtn(p, ""))
        .join("")}</div></article>`
    : "";
  const quotes = [];
  for (const n of NAMES) {
    const mine = es.filter((e) => e.by === n && bookSay(e)).sort((x, y) => (y.happy || 0) - (x.happy || 0));
    quotes.push(...mine.slice(0, 2));
  }
  const extraQuotes = es.filter((e) => bookSay(e) && !quotes.includes(e)).slice(-2);
  const shownQuotes = [...quotes, ...extraQuotes].slice(0, 4);
  const quotesHtml = shownQuotes.length
    ? `<article class="entry book-m"><header><b>💬 這個月寫給彼此的話</b></header>` +
      shownQuotes
        .map((e) => `<blockquote>${esc(bookSay(e))}<br><small>${esc(e.by || "")} · ${esc(e.date)}</small></blockquote>`)
        .join("") +
      `</article>`
    : "";
  const funs = es.filter((e) => e.funny).slice(-3);
  const funsHtml = funs.length
    ? `<article class="entry book-m"><header><b>🤪 這個月好笑的事</b></header>` +
      funs.map((e) => `<div>🤪 ${esc(e.funny)} <small>(${esc(e.by || "")} · ${esc(e.date)})</small></div>`).join("") +
      `</article>`
    : "";
  renderBookShell(`${yy} 年 ${mm} 月`, "月底總結", `${a} ～ ${b}`, summary, `${photosHtml}${quotesHtml}${funsHtml}`);
}
function renderYearBook() {
  const pick = $("bookYear");
  const years = bookCount();
  const keep = +pick.value || years;
  pick.innerHTML = [...Array(years)].map((_, i) => `<option value="${i + 1}">第 ${i + 1} 年</option>`).join("");
  pick.value = keep;
  const y0 = LOVE_START.getFullYear() + keep - 1;
  const m0 = LOVE_START.getMonth();
  const d0 = LOVE_START.getDate();
  const from = new Date(y0, m0, d0);
  const to = addDays(new Date(y0 + 1, m0, d0), -1);
  const a = key(from);
  const b = key(to);
  const inR = (k) => String(k) >= a && String(k) <= b;
  const months = [];
  for (
    let d = new Date(y0, m0, 1);
    key(d).slice(0, 7) <= b.slice(0, 7);
    d = new Date(d.getFullYear(), d.getMonth() + 1, 1)
  )
    months.push(key(d).slice(0, 7));
  const nowM = key(today()).slice(0, 7);
  months.filter((m) => m <= nowM).forEach((m) => loadCalPhotos(m));
  const es = entries.filter((e) => inR(e.date)).sort((x, y) => String(x.date).localeCompare(String(y.date)));
  const ps = calAllPhotos()
    .filter((p) => inR(p.date))
    .sort(byAt);
  const summary = bookSummaryData(es, ps, inR);
  if (!summary.hasActivity) {
    $("bookBody").innerHTML = '<div class="empty">這一年還沒有回憶，寫下第一篇日記吧。</div>';
    return;
  }
  const dayN = Math.round((Math.min(to, today()) - from) / 864e5) + 1;
  const pages = months
    .map((m) => {
      const me = es.filter((e) => e.date.startsWith(m));
      const mp = ps.filter((p) => p.date.startsWith(m));
      if (!me.length && !mp.length) return "";
      const top = [...me].filter(bookSay).sort((x, y) => (y.happy || 0) - (x.happy || 0))[0];
      const fun = me.filter((e) => e.funny).slice(-1)[0];
      const [yy, mm] = m.split("-").map(Number);
      return (
        `<article class="entry book-m"><header><b>${yy} 年 ${mm} 月</b><span>${me.length} 篇日記 · ${mp.length} 張照片</span>` +
        `</header>${
          mp.length
            ? `<div class="wall-grid">${mp
                .slice(0, 3)
                .map((p) => photoBtn(p, ""))
                .join("")}</div>`
            : ""
        }` +
        `${top ? `<blockquote>${esc(bookSay(top))}<br><small>${esc(top.by || "")} · ${esc(top.date)}</small></blockquote>` : ""}` +
        `${fun ? `<div>🤪 ${esc(fun.funny)}</div>` : ""}</article>`
      );
    })
    .join("");
  renderBookShell(`第 ${keep} 年`, `一起走過 ${dayN} 天`, `${a} ～ ${b}`, summary, pages);
}
function renderBook() {
  if (!$("book").classList.contains("open")) return;
  $("bookMonth").hidden = bookMode !== "month";
  $("bookYear").hidden = bookMode !== "year";
  document.querySelectorAll("#bookMode button").forEach((b) => {
    b.setAttribute("aria-pressed", String(b.dataset.m === bookMode));
  });
  if (bookMode === "month") renderMonthBook();
  else renderYearBook();
}
document.querySelectorAll("#bookMode button").forEach((b) => {
  b.onclick = () => {
    bookMode = b.dataset.m;
    renderBook();
  };
});
$("bookMonth").onchange = renderBook;
$("bookYear").onchange = renderBook;
$("bookPrint").onclick = () => window.print();

// 離線與雲端同步狀態指示
const OFFLINE_TEXT = "離線中 · 連網後會自動同步";
const pendingSync = { done: false, diary: false, photos: false };
const syncBroken = { done: false, diary: false, photos: false };
let resubscribeBroken = null;
let wasOffline = !navigator.onLine;
function syncOfflineBar() {
  const bar = $("offlineBar");
  if (bar) bar.hidden = navigator.onLine;
}
syncOfflineBar();
function hasActiveUpload() {
  return !!(uploading || diaryUp || pendingWrites > 0 || pendingSync.done || pendingSync.diary || pendingSync.photos);
}
function hasBrokenSync() {
  return !!(syncBroken.done || syncBroken.diary || syncBroken.photos);
}
function updateSyncStatus() {
  syncOfflineBar();
  if (!db) return;
  if (!navigator.onLine) {
    $("status").textContent = OFFLINE_TEXT;
    return;
  }
  if (hasBrokenSync()) {
    $("status").textContent = "同步中斷 · 點這裡重新連線";
    return;
  }
  if (hasActiveUpload()) {
    $("status").textContent = pendingWrites > 1 ? `⏳ 正在傳上雲端（${pendingWrites} 筆）…` : "⏳ 正在傳上雲端…";
    return;
  }
  if (dataReady) $("status").textContent = "● 兩人同步中 ✓";
}
window.addEventListener("offline", () => {
  wasOffline = true;
  updateSyncStatus();
});
// 手機把網站放到背景一段時間後，Android 會讓即時連線睡著，切回來時可能一直停在舊資料。
// 回到前景、網路恢復、或點最上面的同步狀態時，重新接一次線（只會重抓有變動的資料）。
// 如果正在上傳照片或還有資料在排隊傳上雲端，非手動觸發時先不強制斷線重連，避免打斷上傳。
let hiddenAt = 0,
  reconnecting = false;
function reconnect(force) {
  if (!db || !navigator.onLine) return;
  if (hasBrokenSync() && resubscribeBroken) resubscribeBroken();
  if (reconnecting) return;
  if (!force && hasActiveUpload()) {
    updateSyncStatus();
    return;
  }
  const fs = firebase.firestore();
  if (typeof fs.disableNetwork !== "function") return;
  reconnecting = true;
  $("status").textContent = "🔄 正在更新…";
  fs.disableNetwork()
    .then(() => fs.enableNetwork())
    .catch(() => {})
    .finally(() => {
      reconnecting = false;
      setTimeout(updateSyncStatus, 1200);
      if (force) {
        retryFailedCalPhotos();
        toast("重新同步好了 🔄");
      }
    });
}
window.addEventListener("online", () => {
  updateSyncStatus();
  if (wasOffline) {
    wasOffline = false;
    toast("已重新連線，正在同步 🔄");
  }
  reconnect();
  retryFailedCalPhotos();
  flushPendingPushes();
  if (!$("lightbox").hidden && lbId && !lbFull) loadLbFull(lbId);
});
$("status").addEventListener("click", () => reconnect(true));
$("status").addEventListener("keydown", (ev) => {
  if (ev.key === "Enter" || ev.key === " ") {
    ev.preventDefault();
    reconnect(true);
  }
});

// 跨午夜 00:00 或從手機背景切回時自動換日
let lastDayKey = key(today());
function checkRollover() {
  const nk = key(today());
  if (nk === lastDayKey) return;
  const oldKey = lastDayKey;
  lastDayKey = nk;
  if (!editId && $("dDate").value === oldKey) $("dDate").value = nk;
  const minCap = key(addDays(today(), 1));
  $("capDate").min = minCap;
  if ($("capDate").value && $("capDate").value < minCap) $("capDate").value = minCap;
  if (calDay === oldKey) {
    calDay = nk;
    calMonth = nk.slice(0, 7);
  }
  renderAll();
}
let swReg = null;
document.addEventListener("visibilitychange", () => {
  if (document.hidden) hiddenAt = Date.now();
  else {
    checkRollover();
    // 回到 App 時正停在日記頁：剛剛背景收到的對方日記／照片算看過
    if (view === "quests" && db && dataReady && (partnerNew().diary.length || partnerNew().pics.length)) {
      markPartnerSeen(phWho === "other" ? "all" : "diary");
      renderAll();
    }
    if (hiddenAt && Date.now() - hiddenAt > 15000) {
      reconnect();
      if (swReg && navigator.onLine) swReg.update().catch(() => {});
    }
  }
});
window.addEventListener("focus", checkRollover);
setInterval(checkRollover, 30000);
if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
  const hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker
    .register("sw.js")
    .then((reg) => {
      swReg = reg;
    })
    .catch(() => {});
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!hadController) return;
    const bar = $("updateBar");
    if (bar) bar.hidden = false;
  });
}
if ($("updateNow")) {
  $("updateNow").onclick = () => {
    if (busyOps > 0 || (navigator.onLine && hasActiveUpload())) {
      toast("正在上傳資料，等上方出現 ✓ 再更新喔");
      return;
    }
    location.reload();
  };
}

let hugOpen = false,
  capEditing = "";
$("hugOpen").onclick = () => {
  hugOpen = true;
  renderHug();
  $("hugText").focus();
};
$("hugClose").onclick = () => {
  hugOpen = false;
  renderHug();
};
$("photoCapClose").onclick = () => {
  capEditing = "";
  renderTodayPhotos();
};
$("photoCapForm").addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const targetId = capEditing,
    m = myPhotos(key(today())).find((p) => p.id === targetId) || myPhoto(key(today())),
    v = $("photoCap").value.trim();
  capEditing = "";
  if (m && v !== (m.cap || "")) {
    const old = m.cap;
    m.cap = v;
    [photos, calPhotos].forEach((l) => {
      const x = l.find((y) => y.id === m.id);
      if (x) x.cap = v;
    });
    try {
      await commit(db.collection("photos").doc(m.id).update({ cap: v }));
      toast("寫好了 ✏️");
    } catch (e) {
      [photos, calPhotos].forEach((l) => {
        const x = l.find((y) => y.id === m.id);
        if (x) x.cap = old;
      });
      toast(NOSAVE);
    }
  }
  renderAll();
});

const bonusSyncing = new Set();
function syncDiaryMarks() {
  if (!db || !dataReady) return;
  [...entries, ...trash.diary]
    .filter((e) => e.by && e.date)
    .sort(byAt)
    .forEach((e) => {
      const id = e.date + "_" + e.by,
        tag = "w" + id;
      if (store.wrote.some((w) => w.id === id) || bonusSyncing.has(tag)) return;
      bonusSyncing.add(tag);
      xRef("wrote", id)
        .set({ date: e.date, by: e.by, at: e.at })
        .catch(() => bonusSyncing.delete(tag));
    });
}
function syncPhotoBonus() {
  if (!db || !dataReady) return;
  photos
    .filter((p) => !p.entry && p.by)
    .forEach((p) => {
      const id = p.date + "_" + p.by;
      if (store.bonus.some((b) => b.id === id) || bonusSyncing.has(id)) return;
      bonusSyncing.add(id);
      xRef("bonus", id)
        .set({ date: p.date, xp: PHOTO_BONUS, by: p.by, at: p.at || nowIso() })
        .catch(() => bonusSyncing.delete(id));
    });
  // 將先前因學校網路不穩而誤用的補簽卡自動轉為當日雙人打卡並退還補簽卡
  store.fixes
    .filter((f) => f.day && !f.manual)
    .forEach((f) => {
      const tag = "fx" + f.id;
      if (bonusSyncing.has(tag)) return;
      bonusSyncing.add(tag);
      const atIso = f.day + "T04:00:00.000Z";
      Promise.all(
        NAMES.map((nm) => {
          const bid = f.day + "_" + nm;
          if (store.bonus.some((b) => b.id === bid)) return Promise.resolve();
          const doc = { date: f.day, xp: PHOTO_BONUS, by: nm, at: atIso };
          store.bonus.push({ id: bid, ...doc });
          return xRef("bonus", bid).set(doc);
        }),
      )
        .then(() => xRef("fixes", f.id).delete())
        .then(() => {
          store.fixes = store.fixes.filter((x) => x.id !== f.id);
          renderAll();
          toast(`已補登 ${f.day} 打卡並退還 1 張補簽卡 🎫`);
        })
        .catch(() => bonusSyncing.delete(tag));
    });
}
async function markRoundPassed(r) {
  const tag = "d" + r.id;
  if (store.passed.some((p) => p.id === r.id) || bonusSyncing.has(tag)) return;
  const doc = { day: roundDay(r), xp: DRAW_XP, by: myName() || r.by || "", at: nowIso() };
  store.passed.push({ id: r.id, ...doc });
  _totalXP = null;
  renderHUD();
  if (!db) {
    saveLocal();
    return;
  }
  bonusSyncing.add(tag);
  try {
    await commit(xRef("passed", r.id).set(doc));
  } catch (e) {
    bonusSyncing.delete(tag);
  }
}
function syncDrawMarks() {
  if (!db || !dataReady) return;
  store.rounds
    .filter((r) => pairOf(r.id).length >= need())
    .forEach((r) => {
      const tag = "d" + r.id;
      if (store.passed.some((p) => p.id === r.id) || bonusSyncing.has(tag)) return;
      bonusSyncing.add(tag);
      xRef("passed", r.id)
        .set({ day: roundDay(r), xp: DRAW_XP, by: r.by || myName() || "", at: r.at || nowIso() })
        .catch(() => bonusSyncing.delete(tag));
    });
}

let reviewEditing = false;
// 週日寫回顧時的參考：這七天的日記和照片
function renderWeekRecap(t) {
  const from = key(addDays(t, -6)),
    to = key(t),
    inW = (d) => String(d) >= from && String(d) <= to,
    wk = "日一二三四五六";
  loadCalPhotos(from.slice(0, 7));
  loadCalPhotos(to.slice(0, 7));
  const es = entries.filter((e) => inW(e.date)).sort((a, b) => (a.date + a.at).localeCompare(b.date + b.at)),
    ps = calAllPhotos()
      .filter((p) => inW(p.date))
      .sort(byAt);
  $("weekRecapN").textContent = `${es.length} 篇日記 · ${ps.length} 張照片`;
  if (!es.length && !ps.length) {
    $("weekRecapBody").innerHTML = '<div class="empty">這週還沒有日記或照片。</div>';
    return;
  }
  const label = (d) => {
    const x = fromKey(d);
    return `${x.getMonth() + 1}/${x.getDate()}（${wk[x.getDay()]}）`;
  };
  const say = (e) => e.say || e.funny || e.mood || e.food || e.s1 || e.s2 || "";
  const best = es.filter((e) => e.happy).sort((a, b) => b.happy - a.happy)[0];
  $("weekRecapBody").innerHTML =
    `${
      ps.length
        ? `<div class="wall-grid">${ps
            .slice(0, 6)
            .map((p) => photoBtn(p, ""))
            .join("")}` +
          `</div>${ps.length > 6 ? `<div class="hint left-hint">還有 ${ps.length - 6} 張在照片牆</div>` : ""}`
        : ""
    }` +
    `${best ? `<div class="recap-i">⭐ 最幸福的一天：${label(best.date)} ${esc(best.by || "")} ${esc(best.happy)}/10</div>` : ""}` +
    `${es.map((e) => `<div class="recap-i"><b>${label(e.date)}</b>${esc(e.by || "")}：${esc(String(say(e)).slice(0, 60))}</div>`).join("")}`;
}
$("reviewText").addEventListener("input", () => {
  if (reviewEditing) return;
  const text = $("reviewText").value;
  if (text.trim()) lsSet(REV_DRAFT_KEY, JSON.stringify({ date: key(today()), text }));
  else lsDel(REV_DRAFT_KEY);
});
$("reviewForm").addEventListener("submit", async (ev) => {
  ev.preventDefault();
  if ($("reviewSave").disabled) return;
  const text = $("reviewText").value.trim();
  if (!text) return;
  const date = key(today()),
    me = myName(),
    id = date + "_" + me,
    doc = { date, by: me, text, at: nowIso() };
  const first = !store.reviews.some((r) => r.id === id),
    partner = store.reviews.some((r) => r.date === date && r.by !== me);
  $("reviewSave").disabled = true;
  try {
    if (db) await commit(xRef("reviews", id).set(doc));
    store.reviews = store.reviews.filter((r) => r.id !== id).concat([{ id, ...doc }]);
    if (!db) saveLocal();
    reviewEditing = false;
    lsDel(REV_DRAFT_KEY);
    $("reviewText").value = "";
    grow($("reviewText"));
    renderAll();
    saveToast(
      !first
        ? "回顧改好了"
        : partner
          ? `兩個人都寫好了！+${SUNDAY_TASK.xp} XP 📝`
          : `寫好了 📝 等對方也寫就 +${SUNDAY_TASK.xp} XP`,
    );
    if (first) notifyPartner("📝 這週回顧", `${me}寫好了這週回顧`, "#quests", "review-" + date);
  } catch (e) {
    toast(NOSAVE);
  }
  $("reviewSave").disabled = false;
});

/* ===== 手機推播通知（Web Push + Google Apps Script 免綁卡轉發） ===== */
const GAS_PUSH_CODE = `// 只轉發到手機推播服務（Google、Apple、Mozilla、Microsoft），其他網址一律拒絕，
// 避免這個公開的網址被別人拿去當免費轉發站。
var PUSH_HOSTS = /^https:\\/\\/([a-z0-9-]+\\.)*(fcm\\.googleapis\\.com|android\\.googleapis\\.com|push\\.apple\\.com|push\\.services\\.mozilla\\.com|notify\\.windows\\.com)\\//i;
function doPost(e) {
  try {
    var d = JSON.parse(e.postData.contents);
    if (!d || typeof d.endpoint !== "string" || !PUSH_HOSTS.test(d.endpoint) ||
        typeof d.body !== "string" || d.body.length > 8000 || typeof d.auth !== "string" || d.auth.indexOf("vapid ") !== 0) {
      return ContentService.createTextOutput(JSON.stringify({ ok: false, code: 400, error: "not a push endpoint" }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    var res = UrlFetchApp.fetch(d.endpoint, {
      method: "post",
      contentType: "application/octet-stream",
      headers: {
        Authorization: d.auth,
        TTL: "86400",
        Urgency: "high",
        "Content-Encoding": "aes128gcm"
      },
      payload: Utilities.base64Decode(d.body),
      muteHttpExceptions: true
    });
    var code = res.getResponseCode();
    return ContentService.createTextOutput(
      JSON.stringify({ ok: code >= 200 && code < 300, code: code })
    ).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(
      JSON.stringify({ ok: false, error: String(err) })
    ).setMimeType(ContentService.MimeType.JSON);
  }
}`;

const pushEnc = new TextEncoder();
function b64Std(bytes) {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}
function b64u(buf) {
  return b64Std(buf instanceof Uint8Array ? buf : new Uint8Array(buf))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}
function unb64u(str) {
  const pad = (str + "===".slice((str.length + 3) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(pad),
    out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
function concatBytes(...arrs) {
  const out = new Uint8Array(arrs.reduce((n, a) => n + a.length, 0));
  let o = 0;
  for (const a of arrs) {
    out.set(a, o);
    o += a.length;
  }
  return out;
}
async function hmacSha256(keyBytes, dataBytes) {
  const k = await crypto.subtle.importKey("raw", keyBytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", k, dataBytes));
}
function pushDevId(ep) {
  let h1 = 0x811c9dc5,
    h2 = 0x01000193;
  for (let i = 0; i < ep.length; i++) {
    const c = ep.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0;
    h2 = Math.imul(h2 ^ (c + i), 0x85ebca6b) >>> 0;
  }
  return "s_" + h1.toString(36) + h2.toString(36);
}
const DEFAULT_PUSH_URL =
  "https://script.google.com/macros/s/AKfycbyPCIzLMIvBQhkVTLGxBsjhdOy4QSxTsVPneXfXC3zhIkIZ5sL71C3ZdJiZB-wQVBXROQ/exec";
const BADGE_ICON =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGAAAABgCAYAAADimHc4AAAC90lEQVR42u2d4W30IAyGOwIjZISMkBEyQkbICNmgIzBCRsgIGSEjMILbU/lxul5ajrMNJq8lS590Uj/yPgQMBPuDiD7g5RwiAAAAaHhHROP3vxciWoloe+K33yYi6gXb0cf/Yzlpwxp/G2ObTQNwRDQT0U6v20FEnogGhnYM8W8dGe3Y4zM4SwBc7EWBeOyIvfbVdkyZoj+zEJ/J1Q5gZBQ+FwSn8M9AjLUC8KRj20lPdPE3DfM1AdB88Pue2D9MrkG5DRvHkMQBQFv8RwglxL+HUBSAp7K2Z0ZZ1QxH7064sB8btQG4gq99jRZy5wOrQ0+N5rUAdND61DoNAOj9jG9BDgCM/X/PBaIAEPkwR0QYfgoPQ68COKBv0qahCAAHbZPNSQAYoGuyDRIAJuiabJMEgAW6JtsCAAAAAAAAAAAAAA0BmKFrss1YiDW4EMNBTLp1UptxsDQT2w3doO2/tkkCQCTEGAHlAMBEzDgB40yY34LGofwKnU9t1QCAc4Fzm7S+jMMwxDD84NNEXvOaALAqfmP1y/V5OhZlmYsvLgBYE2TG/pw3ZPAWvHlNieMSNHp/4Ut6V46IfA23JLuLrgsCRz4JrkvaV9wlXaiym/L7hcTfa0xV0F8IQF8jgKt8OTFzaiaRrqbl7eqVWy+pfEEt3qQ5LOQLKpm9RDrkFEmlJpmyrKUblaOUTtJJ6Vo4PZskNdLImGg5Mpql9dFKW2lxv8hraKOZpNRD/PKZcy3sGS2ampRI1ztddcKtKXf0VNk6IZQQv3Ty7loWa0E4X3XV2dNd4W3sXTIvtKX09b7lSMdK/QCteaHYeG+hgEMnPCTtWnUBrFfQWKzH9y2UMBmYzhUOpkIQl6whc4tQPt8Q/7N0lNNKEZ9X34aqe73VKkouMVz1tfd662WszsqkBMmTKwD4vY2xP4SXvcVnsVwEzd0VcHBWn8N6Jbreas9HKUMAgAMAAMAhAgAAABwAAAAOAAAABwAAgAMAAMABAADgAAAAcAX/AvfzHzAnP3JsAAAAAElFTkSuQmCC";
function pushCfg() {
  return store.push.find((x) => x.id === "cfg");
}
function pushUrl() {
  return pushCfg()?.url || DEFAULT_PUSH_URL;
}
function pushSubs() {
  return store.push.filter((x) => x.id !== "cfg" && x.ep && x.p256dh && x.auth);
}
async function ensurePushCfg(newUrl) {
  let cfg = pushCfg();
  if (cfg && cfg.pub && cfg.x && cfg.y && cfg.d) {
    if (typeof newUrl === "string" && newUrl !== (cfg.url || "")) {
      cfg.url = newUrl;
      if (db) await commit(xRef("push", "cfg").update({ url: newUrl, at: nowIso() }));
      else saveLocal();
    }
    return cfg;
  }
  const kp = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
  const jwk = await crypto.subtle.exportKey("jwk", kp.privateKey);
  const pub = b64u(concatBytes(new Uint8Array([4]), unb64u(jwk.x), unb64u(jwk.y)));
  const doc = {
    url: typeof newUrl === "string" ? newUrl : cfg?.url || DEFAULT_PUSH_URL,
    pub,
    x: jwk.x,
    y: jwk.y,
    d: jwk.d,
    at: nowIso(),
  };
  if (db) await commit(xRef("push", "cfg").set(doc));
  store.push = store.push.filter((x) => x.id !== "cfg").concat([{ id: "cfg", ...doc }]);
  if (!db) saveLocal();
  return store.push.find((x) => x.id === "cfg");
}
async function vapidAuth(cfg, endpoint) {
  const privKey = await crypto.subtle.importKey(
    "jwk",
    { kty: "EC", crv: "P-256", x: cfg.x, y: cfg.y, d: cfg.d, ext: true },
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );
  const head = b64u(pushEnc.encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const body = b64u(
    pushEnc.encode(
      JSON.stringify({
        aud: new URL(endpoint).origin,
        exp: Math.floor(Date.now() / 1000) + 43200,
        sub: "mailto:lovebase@example.com",
      }),
    ),
  );
  const sig = b64u(
    await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, privKey, pushEnc.encode(head + "." + body)),
  );
  return `vapid t=${head}.${body}.${sig}, k=${cfg.pub}`;
}
async function encryptPushBody(subDoc, payloadObj) {
  const uaPub = unb64u(subDoc.p256dh),
    auth = unb64u(subDoc.auth);
  const uaKey = await crypto.subtle.importKey("raw", uaPub, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const asKP = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const asPub = new Uint8Array(await crypto.subtle.exportKey("raw", asKP.publicKey));
  const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: uaKey }, asKP.privateKey, 256));
  const prkKey = await hmacSha256(auth, shared);
  const ikm = await hmacSha256(
    prkKey,
    concatBytes(pushEnc.encode("WebPush: info\0"), uaPub, asPub, new Uint8Array([1])),
  );
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const prk = await hmacSha256(salt, ikm);
  const cek = (
    await hmacSha256(prk, concatBytes(pushEnc.encode("Content-Encoding: aes128gcm\0"), new Uint8Array([1])))
  ).slice(0, 16);
  const nonce = (
    await hmacSha256(prk, concatBytes(pushEnc.encode("Content-Encoding: nonce\0"), new Uint8Array([1])))
  ).slice(0, 12);
  const plain = concatBytes(pushEnc.encode(JSON.stringify(payloadObj)), new Uint8Array([2]));
  const cekKey = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["encrypt"]);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, cekKey, plain));
  return b64Std(concatBytes(salt, new Uint8Array([0, 0, 16, 0, 65]), asPub, ct));
}
async function sendPush(payloadObj, target = "partner") {
  const cfg = pushCfg(),
    url = pushUrl();
  if (!cfg || !url || !cfg.pub || !cfg.d) return { sent: 0, reason: "no-url" };
  const me = myName();
  const targets = pushSubs().filter((s) => (target === "all" ? true : s.by && s.by !== me));
  if (!targets.length) return { sent: 0, reason: "no-sub" };
  let sent = 0;
  await Promise.all(
    targets.map(async (s) => {
      const sendOnce = async () => {
        const auth = await vapidAuth(cfg, s.ep);
        const body = await encryptPushBody(s, payloadObj);
        const res = await fetch(url, {
          method: "POST",
          body: JSON.stringify({ endpoint: s.ep, auth, body }),
        });
        const j = await res.json().catch(() => null);
        if (j && (j.code === 404 || j.code === 410)) {
          store.push = store.push.filter((x) => x.id !== s.id);
          if (db)
            xRef("push", s.id)
              .delete()
              .catch(() => {});
          return "gone";
        }
        if (res.ok && (!j || j.ok)) {
          sent++;
          return "ok";
        }
        return "retry";
      };
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const st = await sendOnce();
          if (st === "ok" || st === "gone") break;
        } catch (e) {}
        if (attempt === 0 && navigator.onLine) await new Promise((r) => setTimeout(r, 2500));
        else break;
      }
    }),
  );
  return { sent };
}
const pendingPushes = [];
function flushPendingPushes() {
  if (!navigator.onLine || !pendingPushes.length) return;
  const list = pendingPushes.splice(0, pendingPushes.length);
  list.forEach((p) => sendPush(p, "partner").catch(() => {}));
}
function notifyPartner(title, body, hash = "#today", tag = "love-base", waitP = lastCommitP) {
  if (!db) return;
  const payload = { title, body, url: "./" + hash, tag };
  const fire = () => {
    if (!navigator.onLine) {
      const i = pendingPushes.findIndex((x) => x.tag === tag);
      if (i >= 0) pendingPushes[i] = payload;
      else pendingPushes.push(payload);
      if (pendingPushes.length > 5) pendingPushes.shift();
      return;
    }
    sendPush(payload, "partner").catch(() => {});
  };
  if (waitP && typeof waitP.then === "function") {
    waitP.then(fire, () => {});
  } else {
    fire();
  }
}
let curSubEp = "";
async function checkLocalSub() {
  try {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return "";
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = reg ? await reg.pushManager.getSubscription() : null;
    curSubEp = sub ? sub.endpoint : "";
  } catch (e) {
    curSubEp = "";
  }
  return curSubEp;
}
const pushMsg = (t) => ($("pushMsg").textContent = t);
async function renderPush() {
  const url = pushUrl(),
    hasUrl = !!url,
    subs = pushSubs(),
    ep = await checkLocalSub(),
    mySub = ep ? subs.find((s) => s.ep === ep && s.by === myName()) : null;
  $("pushState").textContent = mySub ? "已開啟" : "未開啟";
  $("pushToggle").textContent = mySub ? "🔕 關閉這台裝置的通知" : "🔔 在這台裝置開啟通知";
  $("pushToggle").className = mySub ? "btn ghost" : "btn";
  $("pushTest").hidden = !subs.length || !hasUrl;
  $("pushUrlSt").textContent = hasUrl ? "✓ 已設定" : "尚未設定";
  if (document.activeElement !== $("pushUrl")) $("pushUrl").value = url;
  if (!renderPush.inited) {
    renderPush.inited = true;
    $("pushSetup").open = !hasUrl;
  }
  $("pushDevices").textContent = subs.length
    ? "已開啟通知的裝置：" + subs.map((s) => `${s.by}（${s.dev || "裝置"}）`).join("、")
    : "目前還沒有裝置開啟通知。";
}
$("pushCopyCode").onclick = async () => {
  await copyText(GAS_PUSH_CODE);
  toast("郵差程式碼複製好了 📋");
};
$("pushUrlSave").onclick = async () => {
  if (!db) {
    pushMsg("要連上伺服器才能儲存網址。");
    return;
  }
  const u = $("pushUrl").value.trim();
  if (u && !/^https:\/\/script\.google\.com\/macros\/s\/[^/]+\/exec$/i.test(u)) {
    pushMsg("網址格式看起來不對，請貼上結尾是 /exec 的 Google 網頁應用程式網址。");
    return;
  }
  $("pushUrlSave").disabled = true;
  try {
    await ensurePushCfg(u);
    $("pushSetup").open = !u;
    pushMsg(u ? "推播郵差網址存好了！兩個人會自動共用這個設定。" : "已清除網址。");
    toast(u ? "郵差網址存好了 🔔" : "已清除網址");
    renderPush();
  } catch (e) {
    pushMsg(NOSAVE);
  }
  $("pushUrlSave").disabled = false;
};
$("pushToggle").onclick = async () => {
  if (!db) {
    pushMsg("要連上伺服器才能開啟通知。");
    return;
  }
  if (isIOS && !isStandalone()) {
    pushMsg("iPhone 請先按 Safari 下方的分享按鈕 →「加入主畫面」，再從桌面上的基地圖示點進來開啟通知喔！");
    return;
  }
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
    pushMsg("這個瀏覽器不支援推播通知，Android 請用 Chrome，iPhone 請加到主畫面後打開。");
    return;
  }
  const b = $("pushToggle");
  b.disabled = true;
  pushMsg("處理中…");
  try {
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    const existing = sub ? pushSubs().find((s) => s.ep === sub.endpoint && s.by === myName()) : null;
    if (existing) {
      await sub.unsubscribe().catch(() => {});
      store.push = store.push.filter((x) => x.id !== existing.id);
      await commit(xRef("push", existing.id).delete());
      curSubEp = "";
      pushMsg("已關閉這台裝置的通知。");
      toast("通知已關閉 🔕");
      renderPush();
      b.disabled = false;
      return;
    }
    const perm = await Notification.requestPermission();
    if (perm !== "granted") {
      pushMsg("通知權限被拒絕了，請到瀏覽器或手機設定裡把這個網站的「通知」打開。");
      b.disabled = false;
      return;
    }
    const cfg = await ensurePushCfg();
    if (sub) {
      const oldDoc = pushSubs().find((s) => s.ep === sub.endpoint);
      if (!oldDoc || oldDoc.pub !== cfg.pub) {
        await sub.unsubscribe().catch(() => {});
        sub = null;
      }
    }
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: unb64u(cfg.pub),
      });
    }
    const j = sub.toJSON(),
      id = pushDevId(j.endpoint),
      dev = isIOS ? "iPhone" : /Android/i.test(navigator.userAgent) ? "Android" : "電腦",
      doc = {
        by: myName(),
        ep: j.endpoint,
        p256dh: j.keys.p256dh,
        auth: j.keys.auth,
        dev,
        pub: cfg.pub,
        at: nowIso(),
      };
    const stale = pushSubs().filter((x) => x.id !== id && x.by === myName() && x.dev === dev);
    stale.forEach((x) =>
      xRef("push", x.id)
        .delete()
        .catch(() => {}),
    );
    await commit(xRef("push", id).set(doc));
    const staleIds = new Set(stale.map((x) => x.id));
    store.push = store.push.filter((x) => x.id !== id && !staleIds.has(x.id)).concat([{ id, ...doc }]);
    curSubEp = j.endpoint;
    reg
      .showNotification("🔔 戀愛基地通知已開啟", {
        body: `${myName()}的${dev}已經準備好接收對方的新動態囉 💞`,
        icon: "./icon-192.png",
        badge: BADGE_ICON,
        tag: "love-base-welcome",
      })
      .catch(() => {});
    pushMsg(
      cfg.url
        ? "這台裝置的通知開啟了！可以按「📨 發測試通知」試試看。"
        : "這台裝置已開啟通知！接著展開下方「⚙️ 設定推播小郵差」貼上網址就能跨手機推播。",
    );
    toast("這台裝置的通知開啟了 🔔");
    renderPush();
  } catch (e) {
    pushMsg("開啟失敗，請確認已連上網路且網址是用 https 打開。");
  }
  b.disabled = false;
};
$("pushTest").onclick = async () => {
  const b = $("pushTest");
  b.disabled = true;
  pushMsg("正在發送測試通知…");
  try {
    const r = await sendPush(
      {
        title: "🔔 戀愛基地測試通知",
        body: `${myName()}按了測試通知，推播設定成功囉 💞`,
        url: "./#today",
        tag: "love-base-test-" + Date.now(),
      },
      "all",
    );
    pushMsg(
      r.sent
        ? `已發送給 ${r.sent} 台裝置！幾秒內手機就會跳出通知。`
        : "沒有送出成功，請確認推播郵差網址有沒有部署為「所有人皆可存取」。",
    );
    if (r.sent) toast("測試通知送出了 📨");
  } catch (e) {
    pushMsg("發送失敗，請確認網路與推播郵差網址。");
  }
  b.disabled = false;
  renderPush();
};
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.addEventListener("message", (ev) => {
    if (ev.data && ev.data.type === "nav" && ev.data.url) {
      const h = ev.data.url.split("#")[1] || "today";
      openFor(h);
      history.replaceState(null, "", "#" + h);
      reconnect();
    }
  });
}

/* ===== 畫面重繪與啟動初始化 ===== */
// 收合中的區塊不重畫，展開時且資料有變動才更新；同一幀內的多次重畫自動合併成一次
let renderVer = 1;
const renderedVer = {};
// 單一區塊出錯時不影響其他頁面與功能繼續正常運作
function safeRun(fn) {
  try {
    fn();
  } catch (e) {}
}
function renderOpen() {
  const open = (id) => $(id).classList.contains("open");
  const needRender = (id) => {
    if (!open(id) || renderedVer[id] === renderVer) return false;
    renderedVer[id] = renderVer;
    return true;
  };
  if ((open("today") || open("ladder") || open("tools")) && renderedVer._hud !== renderVer) {
    renderedVer._hud = renderVer;
    safeRun(renderHUD);
  }
  if (needRender("today")) {
    safeRun(renderStreak);
    safeRun(renderToday);
  }
  if (needRender("quests")) {
    safeRun(renderQuests);
    safeRun(renderDiaryToday);
    safeRun(growAll);
  }
  if (needRender("photos")) safeRun(renderWall);
  if (needRender("calendar")) {
    safeRun(renderCalendar);
    if ($("diaryMore").open) safeRun(renderEntries);
  }
  if (needRender("wishes")) safeRun(renderWishes);
  if (needRender("draw")) {
    safeRun(renderDraw);
    safeRun(renderCustom);
  }
  if (needRender("memories")) safeRun(renderMemories);
  if (needRender("tools")) {
    safeRun(renderTrash);
    safeRun(renderPush);
  }
  if (needRender("book")) safeRun(renderBook);
}
let renderRaf = 0;
function renderAll() {
  _dayRecs = null;
  _totalXP = null;
  _pairsMap = null;
  _entryMeta = null;
  renderVer++;
  if (!booted) {
    renderOpen();
    return;
  }
  if (renderRaf) return;
  renderRaf = requestAnimationFrame(() => {
    renderRaf = 0;
    renderOpen();
  });
}
function saveLocal() {
  try {
    localStorage.setItem(LS, JSON.stringify({ entries, ...store, trash }));
  } catch (e) {
    toast("這台裝置的儲存空間滿了，剛剛的內容沒有存到");
  }
}
function loadLocal() {
  const s = lsJson(LS);
  if (s) {
    entries = s.entries || [];
    Object.keys(store).forEach((c) => (store[c] = s[c] || []));
    if (s.trash) Object.assign(trash, s.trash);
  }
}

$("dSearch").addEventListener("input", debounce(renderEntries));
$("wSearch").addEventListener("input", debounce(renderWishes));
$("lSearch").addEventListener("input", debounce(renderLog));
$("filter")
  .querySelectorAll("button")
  .forEach(
    (b) =>
      (b.onclick = () => {
        who = b.dataset.w;
        $("filter")
          .querySelectorAll("button")
          .forEach((x) => x.setAttribute("aria-pressed", x === b));
        renderEntries();
      }),
  );
$("dDate").value = key(today());
$("capDate").min = key(addDays(today(), 1));
$("capDate").value = key(nextAnniv());
renderHearts();
renderInstall();
showLastBackup();
restoreDraft();
restoreCapDraft();
// 用 #頁面 的網址打開（例如點推播通知）時，瀏覽器會自己跳到那個區塊，把上面的標題擠出畫面；改成從頁面最上面開始
if ("scrollRestoration" in history) history.scrollRestoration = "manual";
openFor(location.hash.slice(1) || "today");
addEventListener(
  "load",
  () => {
    // 網址指到頁面中間的區塊（例如 #trash、#calendar:日期）時，不要再拉回最上面
    const h = location.hash.slice(1),
      target = h && !h.startsWith("calendar:") && document.getElementById(h);
    if (!h.startsWith("calendar:") && (!target || target.tagName === "SECTION")) restoreScroll(view);
    // 瀏覽器不會再自己跳到 #區塊 了，拿掉 no-anchor（之後點「看那天」等等的捲動照常）
    requestAnimationFrame(() => document.documentElement.classList.remove("no-anchor"));
  },
  { once: true },
);
booted = true;
// 網路很慢、遲遲等不到 load 時，最多 3 秒就拿掉 no-anchor，不擋住之後的捲動
setTimeout(() => document.documentElement.classList.remove("no-anchor"), 3000);
setTimeout(() => {
  document.documentElement.classList.remove("boot-in");
  if ($("splash")) $("splash").hidden = true;
}, 1150);

/* ===== 伺服器連線（Firebase） ===== */
const ROOM_KEY = "love-base-room";
function getRoom() {
  return lsGet(ROOM_KEY);
}
function showGate(msg) {
  if ($("splash")) $("splash").hidden = true;
  document.documentElement.classList.remove("boot-in");
  $("gate").hidden = false;
  $("gateMsg").textContent = msg || "";
  $("gateCode").value = getRoom();
  $("gateName").value = NAMES.includes(myName()) ? myName() : "";
  syncPick();
  setTimeout(() => ($("gateCode").value ? $("gateName") : $("gateCode")).focus(), 50);
}
function syncPick() {
  const v = $("gateName").value.trim();
  $("namePick")
    .querySelectorAll("button")
    .forEach((b) => b.setAttribute("aria-pressed", b.dataset.n === v));
}
$("namePick")
  .querySelectorAll("button")
  .forEach(
    (b) =>
      (b.onclick = () => {
        $("gateName").value = b.dataset.n;
        syncPick();
      }),
  );
$("gateName").addEventListener("input", syncPick);
$("gateForm").addEventListener("submit", (ev) => {
  ev.preventDefault();
  const code = $("gateCode").value.trim();
  if (!/^[A-Za-z0-9_-]{8,64}$/.test(code)) {
    $("gateMsg").textContent = "暗號要 8～64 個字，只能用英文、數字、- 或 _";
    return;
  }
  const name = $("gateName").value.trim();
  if (!NAMES.includes(name)) {
    $("gateMsg").textContent = "請選「寒冰」或「夏夏」，對方才知道是誰寫的";
    return;
  }
  try {
    localStorage.setItem(ROOM_KEY, code);
    localStorage.setItem(NAME_KEY, name);
  } catch (e) {
    $("gateMsg").textContent = "這個瀏覽器不能記住登入資料，可能是無痕模式，請改用一般視窗";
    return;
  }
  location.reload();
});
$("logout").onclick = () => {
  if (!confirmTap($("logout"), "記得暗號嗎？再按一次登出", "登出", 4000)) return;
  lsDel(ROOM_KEY);
  lsDel(NAME_KEY);
  location.reload();
};

(async () => {
  const configured = FIREBASE_CONFIG.apiKey && !FIREBASE_CONFIG.apiKey.startsWith("請貼上");
  if (!configured || !window.firebase) {
    loadLocal();
    renderAll();
    $("status").textContent = configured ? "連不上伺服器 · 先存在這台裝置" : "尚未設定伺服器 · 只存在這台裝置";
    return;
  }
  const room = getRoom();
  if (!room || !NAMES.includes(myName())) {
    $("status").textContent = room ? "請選你是誰" : "請輸入你們的暗號";
    showGate();
    return;
  }
  $("meLabel").hidden = false;
  $("meLabel").textContent = "你是 " + myName() + " ·";
  firebase.initializeApp(FIREBASE_CONFIG);
  const fs = firebase.firestore();
  if (typeof fs.settings === "function") {
    try {
      fs.settings({ experimentalAutoDetectLongPolling: true });
    } catch (e) {}
  }
  fs.enablePersistence({ synchronizeTabs: true }).catch(() => {});
  db = fs.collection("rooms").doc(room);
  updateSyncStatus();
  $("logout").hidden = false;
  initSeen();
  let got = { done: false, diary: false };
  const timer = setTimeout(() => {
    $("status").textContent = navigator.onLine ? "暫時連不上，資料可能不是最新" : OFFLINE_TEXT;
  }, 10000);
  const ready = () => {
    if (got.done && got.diary) {
      clearTimeout(timer);
      dataReady = true;
      updateSyncStatus();
      renderToday();
      purgeExpired();
      syncPhotoBonus();
      syncDiaryMarks();
      syncDrawMarks();
    }
  };
  const upsertById = (arr, item) => {
    const i = arr.findIndex((x) => x.id === item.id);
    if (i >= 0) arr[i] = item;
    else arr.push(item);
  };
  const removeById = (arr, id) => {
    const i = arr.findIndex((x) => x.id === id);
    if (i >= 0) arr.splice(i, 1);
  };
  const parseXId = (docId) => {
    if (!docId || !docId.startsWith("x~")) return null;
    const p = docId.indexOf("~", 2);
    if (p < 0) return null;
    const c = docId.slice(2, p),
      id = docId.slice(p + 1);
    return c && id && store[c] ? [c, id] : null;
  };
  const isIncremental = (hadSnap, s, changes) =>
    hadSnap && Array.isArray(changes) && (changes.length < s.docs.length || changes.some((ch) => ch.type !== "added"));
  let hasSnap = { done: false, diary: false },
    doneUnsub = null,
    diaryUnsub = null;
  const subDone = () => {
    if (doneUnsub) doneUnsub();
    hasSnap.done = false;
    doneUnsub = db.collection("done").onSnapshot(
      { includeMetadataChanges: true },
      (s) => {
        syncBroken.done = false;
        pendingSync.done = !!s.metadata?.hasPendingWrites;
        updateSyncStatus();
        const changes = typeof s.docChanges === "function" ? s.docChanges() : null;
        if (hasSnap.done && changes && !changes.length) {
          if (!s.metadata?.fromCache) {
            got.done = true;
            ready();
          }
          return;
        }
        if (isIncremental(hasSnap.done, s, changes)) {
          changes.forEach((ch) => {
            const d = ch.doc,
              parsed = parseXId(d.id);
            if (!parsed) return;
            const [c, id] = parsed;
            if (ch.type === "removed") {
              removeById(store[c], id);
              if (trash[c]) removeById(trash[c], id);
              return;
            }
            const item = { id, ...d.data() };
            if (item.trashed) {
              removeById(store[c], id);
              if (trash[c]) upsertById(trash[c], item);
            } else {
              if (trash[c]) removeById(trash[c], id);
              upsertById(store[c], item);
            }
          });
        } else {
          Object.keys(store).forEach((c) => (store[c] = []));
          ["wishes", "capsules", "custom"].forEach((c) => (trash[c] = []));
          s.docs.forEach((d) => {
            const parsed = parseXId(d.id);
            if (!parsed) return;
            const [c, id] = parsed,
              v = d.data();
            if (v.trashed) {
              if (trash[c]) trash[c].push({ id, ...v });
            } else store[c].push({ id, ...v });
          });
        }
        hasSnap.done = true;
        if (!s.metadata?.fromCache) got.done = true;
        ready();
        renderAll();
      },
      () => {
        clearTimeout(timer);
        syncBroken.done = true;
        updateSyncStatus();
      },
    );
  };
  const subDiary = () => {
    if (diaryUnsub) diaryUnsub();
    hasSnap.diary = false;
    diaryUnsub = db.collection("diary").onSnapshot(
      { includeMetadataChanges: true },
      (s) => {
        syncBroken.diary = false;
        pendingSync.diary = !!s.metadata?.hasPendingWrites;
        updateSyncStatus();
        const changes = typeof s.docChanges === "function" ? s.docChanges() : null;
        if (hasSnap.diary && changes && !changes.length) {
          if (!s.metadata?.fromCache) {
            got.diary = true;
            ready();
          }
          return;
        }
        if (isIncremental(hasSnap.diary, s, changes)) {
          changes.forEach((ch) => {
            const d = ch.doc;
            if (ch.type === "removed") {
              removeById(entries, d.id);
              removeById(trash.diary, d.id);
              return;
            }
            const item = { id: d.id, ...d.data() };
            if (item.trashed) {
              removeById(entries, d.id);
              upsertById(trash.diary, item);
            } else {
              removeById(trash.diary, d.id);
              upsertById(entries, item);
            }
          });
        } else {
          const all = s.docs.map((d) => ({ id: d.id, ...d.data() }));
          entries = all.filter((e) => !e.trashed);
          trash.diary = all.filter((e) => e.trashed);
        }
        hasSnap.diary = true;
        if (!s.metadata?.fromCache) got.diary = true;
        ready();
        renderAll();
      },
      () => {
        clearTimeout(timer);
        syncBroken.diary = true;
        updateSyncStatus();
      },
    );
  };
  resubscribeBroken = () => {
    if (syncBroken.done) {
      syncBroken.done = false;
      subDone();
    }
    if (syncBroken.diary) {
      syncBroken.diary = false;
      subDiary();
    }
    if (syncBroken.photos) {
      syncBroken.photos = false;
      subPhotos();
      subPhotoTrash();
    }
  };
  subDone();
  subPhotos();
  subPhotoTrash();
  subDiary();
})();
