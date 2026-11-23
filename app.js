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
function esc(s) {
  return String(s ?? "").replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );
}
function toast(msg) {
  const t = $("toast");
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toast.h);
  toast.h = setTimeout(() => (t.hidden = true), 2200);
}
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
  const [y, m, d] = k.split("-").map(Number);
  return new Date(y, m - 1, d);
}
const byAt = (a, b) => String(a.at).localeCompare(String(b.at));
const nameOf = (n) => (n ? n + (n === myName() ? "（我）" : "") : "未署名");
const nowIso = () => new Date().toISOString();
// 離線或學校弱網時，寫入已先進本機 IndexedDB 佇列；最多等 2.5 秒就先放行畫面，背景繼續同步
const commit = (p) => {
  if (!navigator.onLine) {
    p.catch(() => {});
    return Promise.resolve();
  }
  return Promise.race([
    p,
    new Promise((res) =>
      setTimeout(() => {
        p.catch(() => {});
        res();
      }, 2500),
    ),
  ]);
};
const xRef = (c, id) => db.collection("done").doc(`x~${c}~${id}`);

async function addDoc(c, data) {
  const id = db ? db.collection("done").doc().id : "l" + Date.now() + Math.random().toString(36).slice(2, 6);
  if (db) await commit(xRef(c, id).set(data));
  if (!store[c].find((x) => x.id === id)) store[c].push({ id, ...data });
  if (!db) saveLocal();
  renderAll();
}
async function updDoc(c, id, data) {
  const w = store[c].find((x) => x.id === id);
  if (!w) return;
  const old = { ...w };
  Object.assign(w, data);
  renderAll();
  try {
    db ? await xRef(c, id).update(data) : saveLocal();
  } catch (e) {
    Object.assign(w, old);
    renderAll();
    toast(NOSAVE);
  }
}
const TRASH_DAYS = 30,
  TRASHED = "移到垃圾桶了，30 天內可以復原";
const trashMark = () => ({ at: nowIso(), by: myName() });
async function delDoc(c, id) {
  const item = store[c].find((x) => x.id === id);
  if (!item) return;
  const mark = trashMark();
  store[c] = store[c].filter((x) => x.id !== id);
  trash[c].push({ ...item, trashed: mark });
  renderAll();
  try {
    db ? await xRef(c, id).update({ trashed: mark }) : saveLocal();
    toast(TRASHED);
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
  pendingDate = null,
  pendingSwap = false;
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
function photoBtn(p, cls) {
  return (
    `<button type="button" class="${cls}" data-open="${esc(p.id)}" aria-label="${esc(p.by)} 的照片${p.cap ? "：" + esc(p.cap) : ""}"><img src="${p.th}` +
    `" alt="" loading="lazy" decoding="async"><span class="nm">${esc(p.by)}${p.by === myName() ? "（我）" : ""}${p.cap ? " 💬" : ""}</span></button>`
  );
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
    up = uploading === k;
  let h = '<div class="ph-pair">';
  h += mine
    ? mineAll.map((p) => photoBtn(p, "ph-slot has")).join("") +
      (mineAll.length < DAY_PH_MAX
        ? `<button type="button" class="ph-slot" data-up="${k}" ${up ? "disabled" : ""}>${up ? "上傳中…" : "＋<br>再加照片"}</button>`
        : "")
    : `<button type="button" class="ph-slot" data-up="${k}" ${up ? "disabled" : ""}` +
      `>${up ? "上傳中…" : "📸<br>上傳我的照片<br><small>可以一次選很多張</small>"}</button>`;
  h += others.length
    ? others.map((p) => photoBtn(p, "ph-slot has")).join("")
    : '<div class="ph-slot wait">等對方上傳…</div>';
  h += "</div>";
  if (mine) {
    const capBtns =
      mineAll.length === 1
        ? `<button class="btn ghost small" type="button" data-capedit="${esc(mine.id)}">${capEditing === mine.id ? "✕ 取消" : `✏️ ${mine.cap ? "改這句話" : "寫一句話"}`}</button>` +
          (mine.cap ? `<span class="ph-note">「${esc(mine.cap)}」</span>` : "")
        : mineAll
            .map(
              (p, i) =>
                `<button class="btn ghost small" type="button" data-capedit="${esc(p.id)}">${capEditing === p.id ? "✕ 取消" : `✏️ 第 ${i + 1} 張${p.cap ? "（改）" : ""}`}</button>`,
            )
            .join("");
    h +=
      `<div class="row"><button class="btn ghost" type="button" data-up="${k}" data-swap="1" ${up ? "disabled" : ""}` +
      `>${up ? "上傳中…" : mineAll.length > 1 ? "換第一張" : "換一張"}</button>${capBtns}</div>`;
  }
  const otherCaps = [...(mineAll.length > 1 ? mineAll : []), ...others].filter((p) => p.cap);
  if (otherCaps.length)
    h += otherCaps.map((p) => `<div class="ph-note">${esc(nameOf(p.by))}：「${esc(p.cap)}」</div>`).join("");
  box.innerHTML = h;
  box.querySelectorAll("[data-capedit]").forEach(
    (b) =>
      (b.onclick = () => {
        const id = b.dataset.capedit,
          idx = mineAll.findIndex((p) => p.id === id),
          target = mineAll[idx];
        if (!target) return;
        capEditing = capEditing === id ? "" : id;
        renderTodayPhotos();
        if (capEditing) {
          const c = $("photoCap");
          c.placeholder = mineAll.length > 1 ? `幫第 ${idx + 1} 張照片寫一句話（可不填）` : "幫照片寫一句話（可不填）";
          c.value = target.cap || "";
          c.focus();
        }
      }),
  );
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
      return (
        `<div class="wall-day"><h3>${m}/${dd}（${wk[dt.getDay()]}）</h3>` +
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
function shrink(im, side, maxLen, q) {
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
    out = c.toDataURL("image/jpeg", q);
    if (out.length <= maxLen) break;
    if (q > 0.55) q -= 0.1;
    else side *= 0.8;
  }
  c.width = c.height = 0;
  return out;
}
$("wallMore").onclick = () => {
  photoLimit += 30;
  subPhotos();
};
document.addEventListener("click", (ev) => {
  const u = ev.target.closest("[data-up]");
  if (u && !u.disabled) {
    if (!db || photoErr || uploading) return;
    pendingDate = u.dataset.up;
    pendingSwap = !!u.dataset.swap;
    $("photoFile").multiple = !pendingSwap;
    $("photoFile").value = "";
    $("photoFile").click();
    return;
  }
  const o = ev.target.closest("[data-open]");
  if (o) {
    const box = o.closest("#wall") || o.closest(".wall-grid,.ph-pair") || o.parentElement;
    openPhoto(
      o.dataset.open,
      [...box.querySelectorAll("[data-open]")].map((x) => x.dataset.open),
    );
  }
});
// 上傳一張照片（每日照片和日記照片共用）：壓縮後存原圖到 pics、縮圖和說明到 photos
// opt.id 不給就用「日期_名字_亂數」；opt.entry 是所屬日記；opt.replace 表示蓋掉同 id 的舊照片（舊的先進垃圾桶）
const newPhotoId = (date) => `${date}_${myName()}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
async function savePhoto(file, date, opt = {}) {
  const { im, url, close } = await loadImg(file);
  const img = shrinkFull(im),
    th = shrinkThumb(im);
  if (close) close();
  else if (url) URL.revokeObjectURL(url);
  const id = opt.id || newPhotoId(date);
  const meta = { date, by: myName(), th, cap: "", at: new Date().toISOString() };
  if (opt.entry) meta.entry = opt.entry;
  if (opt.replace) {
    await Promise.race([archivePhoto(id).catch(() => {}), new Promise((r) => setTimeout(r, 1800))]);
  }
  // 同時寫入原圖、縮圖與每日打卡紀錄，確保弱網下 0.2 秒內全部鎖進本機離線佇列
  const pPic = db.collection("pics").doc(id).set({ img, date, by: myName() });
  const pMeta = db.collection("photos").doc(id).set(meta);
  picCache.set(id, img);
  const item = { id, ...meta };
  photos = photos.filter((p) => p.id !== id).concat([item]);
  calPhotos = calPhotos.filter((p) => p.id !== id).concat([item]);
  await commit(Promise.all([pPic, pMeta]));
  return item;
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
  if (pendingSwap) files = files.slice(0, 1);
  else {
    const room = DAY_PH_MAX - myPhotos(date).length;
    if (files.length > room) {
      files = files.slice(0, Math.max(0, room));
      toast(`一天最多 ${DAY_PH_MAX} 張，只放前 ${files.length} 張`);
    }
  }
  if (!files.length) return;
  uploading = date;
  renderAll();
  const earned = !store.bonus.some((b) => b.id === mainId),
    partner = store.bonus.some((b) => b.date === date && b.by !== myName());
  if (earned) {
    const doc = { date, xp: PHOTO_BONUS, by: myName(), at: new Date().toISOString() };
    store.bonus.push({ id: mainId, ...doc });
    xRef("bonus", mainId)
      .set(doc)
      .catch(() => {});
  }
  let ok = 0,
    msg = "";
  for (let i = 0; i < files.length; i++) {
    try {
      // 第一張用固定的 id（日期_名字），其他張加亂數；只有真的要換掉舊照片時才搬進垃圾桶
      const asMain = pendingSwap || (!hasMain && i === 0);
      await savePhoto(files[i], date, asMain ? { id: mainId, replace: pendingSwap && hasMain } : {});
      ok++;
      if (files.length > 1) renderAll();
    } catch (e) {
      msg = photoErrMsg(e);
    }
  }
  uploading = null;
  updateSyncStatus();
  if (ok) {
    const n = ok > 1 ? `${ok} 張照片` : "照片";
    toast(
      msg ||
        (earned && partner
          ? `兩個人都傳了！+${PHOTO_BONUS} XP 📸`
          : earned
            ? `${n}上傳好了 📸 等對方也傳就 +${PHOTO_BONUS} XP`
            : `${n}上傳好了 📸`),
    );
    notifyPartner("📷 今日照片", `${myName()}傳了${ok > 1 ? ` ${ok} 張` : ""}今天的照片`, "#quests", "photo-" + date);
  } else if (msg) toast(msg);
  renderAll();
});
let lbId = null,
  lbList = [],
  lbFull = "";
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
// list：同一組照片的 id，可以左右切換
function openPhoto(id, list) {
  const p = calAllPhotos().find((x) => x.id === id);
  if (!p) return;
  lbId = id;
  const cached = picCache.get(id) || "";
  lbFull = cached;
  if (list) lbList = list.filter((i) => calAllPhotos().some((x) => x.id === i));
  if (!lbList.includes(id)) lbList = [id];
  const i = lbList.indexOf(id),
    many = lbList.length > 1;
  $("lbCount").textContent = many ? `${i + 1} / ${lbList.length}` : "";
  $("lbPrev").hidden = !many || i === 0;
  $("lbNext").hidden = !many || i === lbList.length - 1;
  $("lbImg").src = cached || p.th;
  $("lbImg").alt = p.by + " 的照片";
  const [, m, d] = p.date.split("-").map(Number),
    mine = p.by === myName();
  $("lbCap").textContent = `${m}/${d} · ${p.by}${mine ? "（我）" : ""}${p.cap ? "\n「" + p.cap + "」" : ""}`;
  $("lbCapForm").hidden = true;
  $("lbCapEdit").hidden = !mine;
  $("lbCapEdit").textContent = p.cap ? "✏️ 改這句話" : "✏️ 寫一句話";
  const del = $("lbDel");
  del.hidden = !mine;
  delete del.dataset.confirm;
  del.textContent = "刪除這張";
  $("lbShare").hidden = !canShareFiles();
  if ($("lightbox").hidden) history.pushState({ lb: 1 }, "", location.hash);
  $("lightbox").hidden = false;
  if (!cached) {
    fetchPicImg(id)
      .then((img) => {
        if (lbId === id && img) {
          lbFull = img;
          $("lbImg").src = img;
        }
      })
      .catch(() => {
        if (lbId === id)
          $("lbCount").textContent =
            ($("lbCount").textContent ? $("lbCount").textContent + " · " : "") + "原圖沒載到，先顯示縮圖";
      });
  }
  [lbList[i - 1], lbList[i + 1]].filter(Boolean).forEach((adj) => fetchPicImg(adj).catch(() => {}));
}
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
// 手指左右滑切換、往下滑關閉大圖（純 GPU 跟手，鎖定單一軸向不卡頓）
(() => {
  let x0 = null,
    y0 = 0,
    dx = 0,
    dy = 0,
    axis = "",
    raf = 0;
  const im = $("lbImg"),
    stage = document.querySelector("#lightbox .stage");
  function paint() {
    raf = 0;
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
      if (e.touches.length !== 1 || e.target.closest("button")) return;
      x0 = e.touches[0].clientX;
      y0 = e.touches[0].clientY;
      dx = dy = 0;
      axis = "";
      im.style.transition = "none";
    },
    { passive: true },
  );
  stage.addEventListener(
    "touchmove",
    (e) => {
      if (x0 === null) return;
      dx = e.touches[0].clientX - x0;
      dy = e.touches[0].clientY - y0;
      if (!axis) {
        if (Math.hypot(dx, dy) < 8) return;
        axis = Math.abs(dy) > Math.abs(dx) ? "y" : "x";
      }
      if (!raf) raf = requestAnimationFrame(paint);
    },
    { passive: true },
  );
  stage.addEventListener(
    "touchend",
    () => {
      if (x0 === null) return;
      x0 = null;
      if (raf) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
      const nextIdx = lbList.indexOf(lbId) + (dx < 0 ? 1 : -1);
      if (axis === "x" && Math.abs(dx) > 45 && nextIdx >= 0 && nextIdx < lbList.length) {
        im.style.transition = "none";
        im.style.transform = "";
        im.style.opacity = "";
        lbStep(dx < 0 ? 1 : -1);
      } else if (axis === "y" && dy > 55) {
        sliderTick();
        im.style.transition = "transform .15s ease-out,opacity .15s ease-out";
        im.style.transform = "translate3d(0,160px,0) scale(.8)";
        im.style.opacity = "0";
        setTimeout(() => {
          im.style.transition = "none";
          im.style.transform = "";
          im.style.opacity = "";
          closePhotoByUser();
        }, 145);
      } else {
        im.style.transition = "transform .2s cubic-bezier(.22,1,.36,1),opacity .2s ease";
        im.style.transform = "";
        im.style.opacity = "";
      }
    },
    { passive: true },
  );
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
async function lbFile() {
  const p = calAllPhotos().find((x) => x.id === lbId);
  if (!p) return null;
  const blob = await (await fetch(lbFull || p.th)).blob(),
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
  try {
    const f = await lbFile();
    if (!f) return;
    downloadBlob(f.name, f.blob);
    toast("下載好了 ⬇️");
  } catch (e) {
    toast("下載不了，可以長按照片再選「儲存」");
  }
};
$("lbShare").onclick = async () => {
  try {
    const f = await lbFile();
    if (!f) return;
    const [, m, d] = f.p.date.split("-").map(Number),
      text = `${m}/${d} ${f.p.by}${f.p.cap ? "：「" + f.p.cap + "」" : ""}`;
    const data = { files: [f.file], title: "我們的戀愛遊戲基地", text };
    await navigator.share(navigator.canShare(data) ? data : { files: [f.file] });
  } catch (e) {
    if (!e || e.name !== "AbortError") toast("分享不了，可以先下載再分享");
  }
};
function closePhoto() {
  $("lightbox").hidden = true;
  lbId = null;
  lbList = [];
  lbFull = "";
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
  try {
    await commit(db.collection("photos").doc(id).update({ trashed: trashMark() }));
    picCache.delete(id);
    photos = photos.filter((p) => p.id !== id);
    calPhotos = calPhotos.filter((p) => p.id !== id);
    closePhotoByUser();
    renderAll();
    toast(TRASHED);
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
    .map((r) => `<dt>${r[0]}</dt><dd>${esc(r[1])}</dd>`)
    .join("");
}
function diaryQuote(e) {
  return e.s1 || e.s2
    ? `<blockquote>今天雖然${esc(e.s1 || "＿＿")}，但因為有你${esc(e.s2 || "＿＿")}。</blockquote>`
    : "";
}
function diaryCard(e, where, n) {
  const me = myName(),
    cls = e.by ? (e.by === me ? "me" : "them") : "",
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
  const hit = (e) =>
    !q ||
    [e.date, e.mood, e.food, e.funny, e.say, e.s1, e.s2, e.by].some((v) =>
      String(v || "")
        .toLowerCase()
        .includes(q),
    );
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
    db ? await db.collection("diary").doc(id).update({ trashed: mark }) : saveLocal();
    toast(TRASHED);
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
function resetDiaryFields() {
  for (const el of Object.keys(FIELDS)) $(el).value = "";
  $("dDate").value = key(today());
  happy = 0;
  renderHearts();
  growAll();
}
function startEdit(id) {
  const e = entries.find((x) => x.id === id);
  if (!e) return;
  editId = id;
  renderDiaryToday();
  $("dDate").value = e.date || key(today());
  for (const [el, f] of Object.entries(FIELDS)) $(el).value = e[f] || "";
  happy = Number(e.happy) || 0;
  renderHearts();
  growAll();
  $("editBar").hidden = false;
  $("editText").textContent = `✏️ 正在編輯 ${e.date || ""} 的日記`;
  $("diaryForm").classList.add("editing");
  $("dSave").textContent = "儲存修改";
  $("dMsg").textContent = "";
  $("dDraftClear").hidden = true;
  openFor("diaryForm");
  growAll();
}
function endEdit() {
  editId = null;
  $("editBar").hidden = true;
  $("diaryForm").classList.remove("editing");
  $("dSave").textContent = "寫進日記";
  resetDiaryFields();
  restoreDraft();
  renderDiaryToday();
}
$("editCancel").onclick = endEdit;
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
  $("dSay").placeholder = "💡 " + DIARY_PROMPTS[promptIdx];
  $("dSay").focus();
};

$("diaryForm").addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const e = {
    date: $("dDate").value,
    mood: $("dMood").value.trim(),
    food: $("dFood").value.trim(),
    funny: $("dFunny").value.trim(),
    say: $("dSay").value.trim(),
    happy: happy || null,
    s1: $("dS1").value.trim(),
    s2: $("dS2").value.trim(),
    at: new Date().toISOString(),
    by: myName(),
  };
  if (!e.mood && !e.food && !e.funny && !e.say && !e.s1 && !e.s2) {
    $("dMsg").textContent = "至少寫一格再存喔";
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
    const upd = { ...e, at: old.at, by: old.by || myName(), edited: new Date().toISOString() };
    try {
      if (db) await commit(db.collection("diary").doc(editId).set(upd));
      else {
        Object.assign(old, upd);
        saveLocal();
      }
      Object.assign(old, upd);
      endEdit();
      renderAll();
      toast("修改好了 ✏️");
    } catch (err) {
      $("dMsg").textContent = "沒存到，請再試一次";
    }
    $("dSave").disabled = false;
    return;
  }
  try {
    if (db) {
      const ref = db.collection("diary").doc();
      await commit(ref.set(e));
      if (!entries.find((x) => x.id === ref.id)) entries.push({ id: ref.id, ...e });
    } else {
      e.id = "l" + Date.now();
      entries.push(e);
      saveLocal();
    }
    diaryFormOpen = false;
    clearDraft();
    $("dMsg").textContent = "";
    resetDiaryFields();
    renderAll();
    toast("寫好了 💌");
    const preview = (e.mood || e.say || e.food || e.funny || "").slice(0, 24);
    notifyPartner(
      "💌 新日記",
      `${myName()}寫了一篇新日記${preview ? `：「${preview}」` : ""}`,
      "#quests",
      "diary-" + e.date,
    );
  } catch (err) {
    $("dMsg").textContent = "沒存到，請確認你有這個頁面的編輯權限";
  }
  $("dSave").disabled = false;
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
// 畫面上顯示的題目：今天的題目；今天還沒抽的話，顯示還沒揭曉的舊題目讓大家補答
function shownRound() {
  const t = todayRound();
  if (t) return t;
  const r = curRound();
  return r && pairOf(r.id).length < need() ? r : null;
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
  const d = new Date(r.at);
  $("drawWho").hidden = false;
  $("drawWho").textContent =
    (r === t ? "" : "📌 還沒揭曉的題目 · ") +
    `🎲 ${r.by ? nameOf(r.by) : "有人"} 在 ${d.getMonth() + 1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())} 抽的`;
  const ans = pairOf(r.id),
    mine = ans.find((a) => a.by === myName()),
    over = ans.length >= need(),
    shownAns = over ? ans : mine ? [mine] : [];
  if (over) ansEditing = false;
  $("ansForm").hidden = !!mine && (!ansEditing || over);
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
function renderLog() {
  const all = store.rounds
    .filter((r) => pairOf(r.id).length >= need())
    .sort(byAt)
    .reverse();
  $("logN").textContent = `${all.length} 題`;
  const q = $("lSearch").value.trim().toLowerCase();
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
  $("logList").innerHTML = list.length
    ? list
        .map(
          (r) =>
            `<article class="entry"><header><b>${esc(r.q)}</b><span>${esc(roundDay(r))}</span></header>` +
            `<dl>${pairOf(r.id)
              .map((a) => `<dt>${esc(nameOf(a.by))}</dt><dd>${esc(a.text)}</dd>`)
              .join("")}</dl></article>`,
        )
        .join("")
    : '<div class="empty">還沒有過關的題目。</div>';
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

function bindForm(form, btn, build, after) {
  $(form).addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const data = build();
    if (!data) return;
    $(btn).disabled = true;
    try {
      await addDoc(data.c, data.doc);
      after();
    } catch (e) {
      toast(NOSAVE);
    }
    $(btn).disabled = false;
  });
}
// 中文選字按 Enter 時不要送出
["wishForm", "cqForm", "hugForm", "replyForm", "photoCapForm", "lbCapForm", "gateForm"].forEach((f) =>
  $(f).addEventListener("keydown", (ev) => {
    if (ev.key === "Enter" && (ev.isComposing || ev.keyCode === 229)) ev.preventDefault();
  }),
);
let ansEditing = false;
$("ansForm").addEventListener("submit", async (ev) => {
  ev.preventDefault();
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
      $("ansText").value = "";
      grow($("ansText"));
      renderAll();
      toast("答案改好了 ✏️");
    } else {
      await addDoc("answers", { round: r.id, text, by: myName(), at: nowIso() });
      ansEditing = false;
      $("ansText").value = "";
      grow($("ansText"));
      if (pairOf(r.id).length >= need()) {
        await markRoundPassed(r);
        toast(`過關！+${DRAW_XP} XP 🎲`);
        notifyPartner(
          "🎲 抽題揭曉！",
          `${myName()}也答完了，快來看你們的答案（+${DRAW_XP} XP）`,
          "#draw",
          "draw-ans-" + r.id,
        );
      } else {
        toast(`答案送出了 🎲 等對方回答就 +${DRAW_XP} XP`);
        notifyPartner("🎲 等你回答", `${myName()}答好抽題了，換你作答就會揭曉！`, "#draw", "draw-ans-" + r.id);
      }
    }
  } catch (e) {
    toast(NOSAVE);
  }
  $("ansSave").disabled = false;
});

// 願望清單
// 願望分類：存在願望的 cat 欄位，舊願望沒有這個欄位就算「其他」
const WCATS = { eat: "🍜 想吃", go: "📍 想去", do: "🎯 想做", "": "✨ 其他" };
let wFilter = "all",
  wCat = "",
  wishDoneOpen = false,
  wishEditId = null;
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
  const open = wishes.filter((w) => !w.done).sort((a, b) => byAt(b, a));
  const closed = wishes.filter((w) => w.done).sort((a, b) => String(b.doneDate).localeCompare(String(a.doneDate)));
  const shortDone = (d) => {
    const v = String(d || "");
    return v.slice(0, 4) === String(new Date().getFullYear()) && v.length >= 10
      ? `${+v.slice(5, 7)}/${+v.slice(8, 10)}`
      : v;
  };
  const renderWishItem = (w) => {
    const editing = wishEditId === w.id;
    return (
      `<div class="wish ${w.done ? "done" : ""}${editing ? " editing" : ""}"><button class="check" type="button" data-id="${esc(w.id)}` +
      `" aria-pressed="${!!w.done}" aria-label="${esc(w.text)}：${w.done ? "已完成，點一下取消" : "標記完成"}">✓</button>` +
      (editing
        ? `<form class="wishform" data-wform="${esc(w.id)}" autocomplete="off">` +
          `<input maxlength="120" required value="${esc(w.text)}" aria-label="修改願望">` +
          `<button class="btn small" type="submit">存</button>` +
          `<button class="btn ghost small" type="button" data-wcancel="1" aria-label="取消修改">✕</button></form>`
        : `<div class="t"><b>${esc(w.text)}</b><div><button type="button" class="cat" data-cat="${esc(w.id)}` +
          `" aria-label="分類：${WCATS[w.cat || ""]}，點一下換分類">${WCATS[w.cat || ""]}</button>` +
          `<button type="button" class="cat" data-wedit="${esc(w.id)}" aria-label="修改願望：${esc(w.text)}">✏️ 修改</button>${esc(w.by || "")}` +
          ` 許的${w.done ? ` · <span class="nw">${esc(shortDone(w.doneDate))} 完成</span>` : ""}</div></div>` +
          `<button class="btn ghost del" type="button" data-id="${esc(w.id)}">刪除</button>`) +
      `</div>`
    );
  };
  box.innerHTML =
    open.map(renderWishItem).join("") +
    (closed.length
      ? `<details class="month" id="wishDoneBox" ${wishDoneOpen || q || !open.length || closed.some((w) => w.id === wishEditId) ? "open" : ""}>` +
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
  box.querySelectorAll("[data-wedit]").forEach(
    (b) =>
      (b.onclick = () => {
        wishEditId = b.dataset.wedit;
        renderWishes();
        const inp = box.querySelector(`[data-wform="${wishEditId}"] input`);
        if (inp) {
          inp.focus();
          inp.setSelectionRange(inp.value.length, inp.value.length);
        }
      }),
  );
  box.querySelectorAll("[data-wcancel]").forEach(
    (b) =>
      (b.onclick = () => {
        wishEditId = null;
        renderWishes();
      }),
  );
  box.querySelectorAll("[data-wform]").forEach((f) => {
    f.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter" && (ev.isComposing || ev.keyCode === 229)) ev.preventDefault();
      else if (ev.key === "Escape") {
        wishEditId = null;
        renderWishes();
      }
    });
    f.addEventListener("submit", async (ev) => {
      ev.preventDefault();
      const id = f.dataset.wform,
        text = f.querySelector("input").value.trim(),
        w = store.wishes.find((x) => x.id === id);
      wishEditId = null;
      if (w && text && text !== w.text) {
        await updDoc("wishes", id, { text });
        toast("願望改好了 ✏️");
      } else {
        renderWishes();
      }
    });
  });
  armDelete(box, "wishes");
}
function toggleWish(id) {
  const w = store.wishes.find((x) => x.id === id);
  if (!w) return;
  const on = !w.done;
  updDoc("wishes", id, { done: on, doneDate: on ? key(today()) : null });
  if (on) {
    toast("願望達成 🌠");
    notifyPartner("🌠 願望達成！", `${myName()}完成了願望：「${w.text.slice(0, 26)}」`, "#wishes", "wish-done-" + id);
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
    toast("許願成功 🌠");
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
    $("capText").value = "";
    grow($("capText"));
    toast("封存好了 ⏳");
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
    `"/>${pts.map((p) => `<circle class="dot" cx="${x(p.i)}" cy="${y(p.v)}" r="5"/>`).join("")}</svg>` +
    `<div class="tip" hidden></div>`;
  const svg = box.querySelector("svg"),
    tip = box.querySelector(".tip");
  svg.onpointermove = (ev) => {
    const r = svg.getBoundingClientRect(),
      px = ((ev.clientX - r.left) / r.width) * W;
    const p = pts.reduce((a, b) => (Math.abs(x(b.i) - px) < Math.abs(x(a.i) - px) ? b : a));
    tip.textContent = `${fmt(p.d)} · ⭐ ${Math.round(p.v * 10) / 10}`;
    tip.hidden = false;
    tip.style.left = Math.min(88, Math.max(12, (x(p.i) / W) * 100)) + "%";
  };
  svg.onpointerleave = () => (tip.hidden = true);
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
window.addEventListener("resize", () => {
  if ($("memories").classList.contains("open")) renderChart();
});
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
    tk = key(today());
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
          `${phs.length ? `<div class="wall-grid">${phs.map((p) => photoBtn(p, "")).join("")}</div>` : ""}</article>`,
      });
  });
  calAllPhotos().forEach((p) => {
    pool.push({
      k: "p:" + p.id,
      html:
        `<article class="entry"><header><b>📷 ${esc(p.date)} 的照片</b><span>${esc(p.by || "")}</span></header>` +
        `<div class="wall-grid">${photoBtn(p, "")}</div>` +
        `${p.cap ? `<div>「${esc(p.cap)}」</div>` : ""}</article>`,
    });
  });
  store.rounds
    .filter((r) => pairOf(r.id).length >= need())
    .forEach((r) => {
      pool.push({
        k: "r:" + r.id,
        html:
          `<article class="entry"><header><b>🎲 ${esc(roundDay(r))} 的抽題問答</b></header>` +
          `<div><b>${esc(r.q)}</b></div><dl>${pairOf(r.id)
            .map((a) => `<dt>${esc(nameOf(a.by))}</dt><dd>${esc(a.text)}</dd>`)
            .join("")}</dl></article>`,
      });
    });
  store.wishes
    .filter((w) => w.done)
    .forEach((w) => {
      pool.push({
        k: "w:" + w.id,
        html:
          `<article class="entry"><header><b>🌠 ${esc(w.doneDate || dayOf(w.at))} 達成的願望</b>` +
          `<span>${esc(w.by || "")} 許的</span></header><div>✅ ${esc(w.text)}</div></article>`,
      });
    });
  [...new Set(store.reviews.map((r) => r.date))].forEach((d) => {
    const revs = store.reviews.filter((r) => r.date === d).sort(byAt);
    pool.push({
      k: "v:" + d,
      html:
        `<article class="entry"><header><b>📝 ${esc(d)} 的每週回顧</b></header>` +
        `<dl>${revs.map((r) => `<dt>${esc(nameOf(r.by))}</dt><dd>${esc(r.text)}</dd>`).join("")}</dl></article>`,
    });
  });
  store.capsules
    .filter((c) => c.openDate <= tk)
    .forEach((c) => {
      pool.push({
        k: "c:" + c.id,
        html:
          `<article class="entry"><header><b>💌 ${esc(c.openDate)} 打開的時光膠囊</b>` +
          `<span>${esc(nameOf(c.by))}寫於 ${esc(dayOf(c.at))}</span></header><p class="letter">${esc(c.text)}</p></article>`,
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
function loadCalPhotos(m) {
  if (!db || calLoaded.has(m)) return;
  calLoaded.add(m);
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
      if (navigator.onLine) toast("這個月的照片沒載到，稍後會再試");
    });
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
  $("calNext").disabled = calMonth >= cur;
  let h = "<span></span>".repeat(offset);
  for (let d = 1; d <= count; d++) {
    const k = calMonth + "-" + pad(d);
    const marks = [
      [diaryDays.has(k), "diary", "日記"],
      [photoDays.has(k), "photo", "照片"],
      [together.has(k), "task", "一起完成"],
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
      ` ${k > tk ? "disabled" : ""}>` +
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
    caps = store.capsules.filter((c) => c.openDate === k && c.openDate <= tk);
  if (!es.length && !ps.length && !ws.length && !rs.length && !revs.length && !caps.length) {
    box.innerHTML = `<div class="empty">${label} 還沒有紀錄。</div>`;
    return;
  }
  box.innerHTML =
    `<article class="entry"><header><b>📅 ${label}</b></header>` +
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
async function exportBackup(full) {
  if (!db || !navigator.onLine) {
    toast("要連上網路才能備份");
    return;
  }
  $("bkText").disabled = $("bkFull").disabled = true;
  bkMsg("整理資料中…");
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
    db ? await trashRef(c, id).set(data) : saveLocal();
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
function subPhotoTrash() {
  db.collection("photos")
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
const DRAFT_KEY = "love-base-draft";
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
  let d = null;
  try {
    d = JSON.parse(localStorage.getItem(DRAFT_KEY) || "null");
  } catch (e) {}
  if (!d) return;
  $("dDate").value = d.date || key(today());
  for (const [el, f] of Object.entries(FIELDS)) $(el).value = d[f] || "";
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
    freshReplies = store.replies.filter(fresh).filter((r) => entries.find((e) => e.id === r.entry)?.by === me),
    replyTarget = freshReplies.some((r) => entries.find((e) => e.id === r.entry)?.date === tk) ? "diary" : "diaryMore";
  const groups = [
    [entries.filter(fresh), (n) => `💌 寫了 ${n} 篇日記`, "diary"],
    [photos.filter(fresh), (n) => `📷 傳了 ${n} 張照片`, "photos"],
    [store.answers.filter(fresh), (n) => `🎲 回答了 ${n} 題抽題`, "draw"],
    [store.wishes.filter(fresh), (n) => `🌠 許了 ${n} 個願望`, "wishes"],
    [store.capsules.filter(fresh), (n) => `⏳ 封存了 ${n} 顆膠囊`, "capsule"],
    [freshReplies, (n) => `💬 回應了你的日記（${n}）`, replyTarget],
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
    `<div class="away-list">${groups.map((g) => `<a href="#${g[2]}">${g[1](g[0].length)}</a>`).join("")}</div>`;
  card.hidden = false;
  syncNotices();
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
            await xRef("hugs", id).delete();
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
    toast("討抱抱送出去了 🤗");
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
function syncNotices() {
  $("notices").hidden = ["remindNudge", "iosNudge", "capNudge", "bkNudge", "picNudge", "awayCard"].every(
    (id) => $(id).hidden,
  );
}
function renderToday() {
  renderRemind();
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
  let v = null;
  try {
    v = JSON.parse(localStorage.getItem(LAYOUT_KEY) || "null");
  } catch (e) {}
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
function setView(id) {
  const sec = $(id);
  if (!sec || sec.hidden || !CATS.some((c) => c.secs.includes(id))) id = "today";
  if (booted && id !== view) sliderTick();
  view = id;
  const c = CATS.find((x) => x.secs.includes(id));
  lastSub[c.id] = id;
  document.documentElement.dataset.view = c.id;
  document.querySelectorAll(".wrap>section").forEach((x) => {
    const on = x.id === id;
    x.classList.toggle("current", on);
    x.classList.toggle("open", on);
  });
  renderNav();
  renderOpen();
}
function openFor(id, noScroll) {
  const el = $(id),
    sec = el && el.closest("section");
  if (!sec) {
    setView("today");
    if (!noScroll) scrollTo(0, 0);
    return;
  }
  setView(sec.id);
  for (let d = el.closest("details"); d; d = d.parentElement?.closest("details")) d.open = true;
  if (noScroll) return;
  if (el === sec) scrollTo(0, 0);
  else el.scrollIntoView({ block: "start" });
}
document.addEventListener("click", (ev) => {
  const a = ev.target.closest('a[href^="#"]');
  if (!a) return;
  ev.preventDefault();
  const c = a.dataset.c && CATS.find((x) => x.id === a.dataset.c),
    secs = c && catSecs(c),
    id = c ? (secs.includes(lastSub[c.id]) ? lastSub[c.id] : secs[0]) : a.getAttribute("href").slice(1);
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
  (changed) => {
    if (changed) scrollTo(0, 0);
  },
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
(() => {
  let sx = null,
    sy = 0,
    st = 0;
  document.addEventListener(
    "touchstart",
    (ev) => {
      if (
        !$("lightbox").hidden ||
        !$("gate").hidden ||
        ev.target.closest("input,textarea,select,#hearts,#subNav,#tabBar,.filter,.chart")
      ) {
        sx = null;
        return;
      }
      sx = ev.touches[0].clientX;
      sy = ev.touches[0].clientY;
      st = Date.now();
    },
    { passive: true },
  );
  document.addEventListener(
    "touchend",
    (ev) => {
      if (sx === null) return;
      const dx = ev.changedTouches[0].clientX - sx,
        dy = ev.changedTouches[0].clientY - sy;
      sx = null;
      const ax = Math.abs(dx),
        fast = ax >= 30 && ax / Math.max(1, Date.now() - st) > 0.3;
      if ((ax < 50 && !fast) || ax < Math.abs(dy) * 1.2) return;
      const vis = CATS.filter((c) => catSecs(c).length),
        cur = CATS.find((c) => c.secs.includes(view)),
        next = vis[vis.indexOf(cur) + (dx < 0 ? 1 : -1)];
      if (next) activateCat(next.id);
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
    toast(`加了 ${n} 張照片 📷`);
    notifyPartner("📷 日記新照片", `${myName()}在日記加了 ${n} 張照片`, "#quests", "dphoto-" + e.id);
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
async function uploadQueue(entryId, date, list) {
  if (!db || !list.length) return 0;
  diaryUp = entryId;
  renderAll();
  let ok = 0;
  for (let i = 0; i < list.length; i++) {
    $("dMsg").textContent = `上傳照片 ${i + 1} / ${list.length}…`;
    try {
      await savePhoto(list[i].file, date, { entry: entryId });
      ok++;
    } catch (e) {
      toast(e && e.message === "decode" ? "有一張照片讀不到，先跳過" : "有一張照片沒傳成功，可以之後再加");
    }
  }
  (list || []).forEach((q) => q.url && URL.revokeObjectURL(q.url));
  $("dMsg").textContent = "";
  diaryUp = null;
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
  const addBtn = canAdd
    ? `<button type="button" class="btn ghost" data-addph="${esc(e.id)}" ${diaryUp === e.id ? "disabled" : ""}` +
      `>${diaryUp === e.id ? "上傳中…" : "📷 加照片"}</button>`
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
    `${texts.length ? `<div class="replies">${texts.map((r) => `<div class="reply ${r.by === me ? "me" : ""}"><b>${esc(r.by)}</b> ${esc(r.text)}` + `${r.by === me ? ` <button type="button" class="reply-del" data-replydel="${esc(r.id)}" aria-label="刪除這則回應">✕</button>` : ""}` + `</div>`).join("")}` + `</div>` : ""}` +
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
    db ? await xRef("replies", id).delete() : saveLocal();
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
      const target = entries.find((e) => e.id === entry)?.date === key(today()) ? "#quests" : "#diaryMore";
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
      target = entries.find((e) => e.id === eid)?.date === key(today()) ? "#quests" : "#diaryMore";
    replyTextEl.value = "";
    closeReply();
    toast("回應送出了 💬");
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
  try {
    return JSON.parse(localStorage.getItem(CAP_SEEN_KEY) || "[]");
  } catch (e) {
    return [];
  }
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
  try {
    for (const id of packList) {
      const snap = await db.collection("pics").doc(id).get(),
        img = snap.data()?.img;
      if (img) {
        const out = shrinkFull(await loadSrc(img));
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
  let copied = 0;
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
    moveMsg(`搬家完成！共複製 ${copied} 筆資料，正在切換到新暗號…（記得請對方也換成新暗號）`);
    toast("換好新暗號了 🔐 記得告訴對方！");
    setTimeout(() => location.reload(), 1200);
  } catch (e) {
    moveMsg(`搬到第 ${copied} 筆時網路中斷，原本的資料都安全無損，請確認網路後再試一次。`);
    b.textContent = "搬家到新暗號";
    b.disabled = $("newRoomCode").disabled = false;
  }
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
function updateSyncStatus() {
  if (!db) return;
  if (!navigator.onLine) {
    $("status").textContent = OFFLINE_TEXT;
    return;
  }
  if (pendingSync.done || pendingSync.diary || pendingSync.photos || uploading || diaryUp) {
    $("status").textContent = "⏳ 正在傳上雲端…";
    return;
  }
  if (dataReady) $("status").textContent = "● 兩人同步中 ✓";
}
window.addEventListener("offline", updateSyncStatus);
// 手機把網站放到背景一段時間後，Android 會讓即時連線睡著，切回來時可能一直停在舊資料。
// 回到前景、網路恢復、或點最上面的同步狀態時，重新接一次線（只會重抓有變動的資料）。
let hiddenAt = 0,
  reconnecting = false;
function reconnect(force) {
  if (!db || reconnecting || !navigator.onLine) return;
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
      if (force) toast("重新同步好了 🔄");
    });
}
window.addEventListener("online", () => {
  updateSyncStatus();
  reconnect();
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
document.addEventListener("visibilitychange", () => {
  if (document.hidden) hiddenAt = Date.now();
  else {
    checkRollover();
    if (hiddenAt && Date.now() - hiddenAt > 15000) reconnect();
  }
});
window.addEventListener("focus", checkRollover);
setInterval(checkRollover, 30000);
if ("serviceWorker" in navigator && location.protocol.startsWith("http"))
  navigator.serviceWorker.register("sw.js").catch(() => {});

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
$("reviewForm").addEventListener("submit", async (ev) => {
  ev.preventDefault();
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
    $("reviewText").value = "";
    grow($("reviewText"));
    renderAll();
    toast(
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
      try {
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
        } else if (!j || j.ok) {
          sent++;
        }
      } catch (e) {}
    }),
  );
  return { sent };
}
function notifyPartner(title, body, hash = "#today", tag = "love-base") {
  if (!db) return;
  sendPush({ title, body, url: "./" + hash, tag }, "partner").catch(() => {});
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
    }
  });
}

// 收合中的區塊不重畫，展開時且資料有變動才更新；同一幀內的多次重畫自動合併成一次
let renderVer = 1;
const renderedVer = {};
function renderOpen() {
  const open = (id) => $(id).classList.contains("open");
  const needRender = (id) => {
    if (!open(id) || renderedVer[id] === renderVer) return false;
    renderedVer[id] = renderVer;
    return true;
  };
  if ((open("today") || open("ladder") || open("tools")) && renderedVer._hud !== renderVer) {
    renderedVer._hud = renderVer;
    renderHUD();
  }
  if (needRender("today")) {
    renderStreak();
    renderToday();
  }
  if (needRender("quests")) {
    renderQuests();
    renderDiaryToday();
    growAll();
  }
  if (needRender("photos")) renderWall();
  if (needRender("calendar")) {
    renderCalendar();
    if ($("diaryMore").open) renderEntries();
  }
  if (needRender("wishes")) renderWishes();
  if (needRender("draw")) {
    renderDraw();
    renderCustom();
  }
  if (needRender("memories")) renderMemories();
  if (needRender("tools")) {
    renderTrash();
    renderPush();
  }
  if (needRender("book")) renderBook();
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
  try {
    const s = JSON.parse(localStorage.getItem(LS) || "null");
    if (s) {
      entries = s.entries || [];
      Object.keys(store).forEach((c) => (store[c] = s[c] || []));
      if (s.trash) Object.assign(trash, s.trash);
    }
  } catch (e) {}
}

const debounce = (fn, ms = 120) => {
  let t = 0;
  return () => {
    clearTimeout(t);
    t = setTimeout(fn, ms);
  };
};
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
openFor(location.hash.slice(1) || "today");
booted = true;
setTimeout(() => {
  document.documentElement.classList.remove("boot-in");
  if ($("splash")) $("splash").hidden = true;
}, 1750);

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
  let hasSnap = { done: false, diary: false };
  db.collection("done").onSnapshot(
    { includeMetadataChanges: true },
    (s) => {
      pendingSync.done = !!s.metadata?.hasPendingWrites;
      updateSyncStatus();
      if (hasSnap.done && typeof s.docChanges === "function" && !s.docChanges().length) {
        if (!s.metadata?.fromCache) {
          got.done = true;
          ready();
        }
        return;
      }
      hasSnap.done = true;
      Object.keys(store).forEach((c) => (store[c] = []));
      ["wishes", "capsules", "custom"].forEach((c) => (trash[c] = []));
      s.docs.forEach((d) => {
        if (!d.id.startsWith("x~")) return;
        const [, c, id] = d.id.split("~");
        const v = d.data();
        if (store[c]) (v.trashed ? trash[c] : store[c]).push({ id, ...v });
      });
      if (!s.metadata?.fromCache) got.done = true;
      ready();
      renderAll();
    },
    () => {
      clearTimeout(timer);
      $("status").textContent = "同步中斷，重新整理試試";
    },
  );
  subPhotos();
  subPhotoTrash();
  db.collection("diary").onSnapshot(
    { includeMetadataChanges: true },
    (s) => {
      pendingSync.diary = !!s.metadata?.hasPendingWrites;
      updateSyncStatus();
      if (hasSnap.diary && typeof s.docChanges === "function" && !s.docChanges().length) {
        if (!s.metadata?.fromCache) {
          got.diary = true;
          ready();
        }
        return;
      }
      hasSnap.diary = true;
      const all = s.docs.map((d) => ({ id: d.id, ...d.data() }));
      entries = all.filter((e) => !e.trashed);
      trash.diary = all.filter((e) => e.trashed);
      if (!s.metadata?.fromCache) got.diary = true;
      ready();
      renderAll();
    },
    () => {
      clearTimeout(timer);
      $("status").textContent = "同步中斷，重新整理試試";
    },
  );
})();
