// 自動檢查：每次推送到 GitHub 都會跑。用 node tools/check.js 也能在自己電腦上跑。
// 任何一項沒過就結束並回傳錯誤，GitHub 上那筆提交會出現紅色叉叉。
const fs = require("fs");
const { execSync } = require("child_process");
let bad = 0;
const ok = (msg) => console.log("✅ " + msg);
const fail = (msg) => {
  console.log("❌ " + msg);
  bad++;
};

// 1. 程式語法
for (const f of ["app.js", "sw.js"]) {
  try {
    execSync(`node --check ${f}`, { stdio: "pipe" });
    ok(`${f} 語法正確`);
  } catch (e) {
    fail(`${f} 有語法錯誤：\n${String(e.stderr || e.message).slice(0, 600)}`);
  }
}

// 2. 題庫格式、每月題數不少於天數、沒有重複
try {
  const q = JSON.parse(fs.readFileSync("questions.json", "utf8"));
  const all = [];
  for (const [k, v] of Object.entries(q)) {
    const [y, m] = k.split("-").map(Number);
    const days = new Date(y, m, 0).getDate();
    if (!/^\d{4}-\d{2}$/.test(k) || !Array.isArray(v.q)) fail(`questions.json 的 ${k} 格式不對`);
    else if (v.q.length < days) fail(`questions.json 的 ${k} 只有 ${v.q.length} 題，少於 ${days} 天`);
    all.push(...(v.q || []));
  }
  const dup = all.filter((x, i) => all.indexOf(x) !== i);
  if (dup.length) fail(`questions.json 有重複的題目：${[...new Set(dup)].slice(0, 3).join("、")}`);
  const months = Object.keys(q).sort();
  ok(`questions.json 格式正確（${months[0]} 到 ${months[months.length - 1]}）`);
  // 題庫快用完時提醒（不算失敗）
  const now = new Date(),
    soon = new Date(now.getFullYear(), now.getMonth() + 2, 1),
    need = `${soon.getFullYear()}-${String(soon.getMonth() + 1).padStart(2, "0")}`;
  if (months[months.length - 1] < need) console.log(`⚠️ 題庫只寫到 ${months[months.length - 1]}，該補新的月份了`);
} catch (e) {
  fail("questions.json 不是正確的 JSON：" + e.message);
}
try {
  JSON.parse(fs.readFileSync("manifest.webmanifest", "utf8"));
  ok("manifest.webmanifest 格式正確");
} catch (e) {
  fail("manifest.webmanifest 不是正確的 JSON：" + e.message);
}

// 3. 版本號一致：sw.js 的 CACHE、index.html 和 manifest 裡的 ?v=
const sw = (fs.readFileSync("sw.js", "utf8").match(/love-base-v(\d+)/) || [])[1];
const vers = new Set(
  [...(fs.readFileSync("index.html", "utf8") + fs.readFileSync("manifest.webmanifest", "utf8")).matchAll(/\?v=(\d+)/g)].map(
    (m) => m[1],
  ),
);
if (!sw) fail("sw.js 找不到 CACHE 版本號");
else if (vers.size !== 1 || !vers.has(sw)) fail(`版本號不一致：sw.js 是 v${sw}，index.html／manifest 是 ${[...vers].map((v) => "v" + v).join("、")}`);
else ok(`版本號一致（v${sw}）`);

// 4. 改了網站檔案卻沒有加版本號（跟上一筆提交比）
try {
  const changed = execSync("git diff --name-only HEAD~1 HEAD", { stdio: "pipe" }).toString().split("\n");
  const site = ["index.html", "style.css", "app.js", "manifest.webmanifest"].filter((f) => changed.includes(f));
  if (site.length) {
    const prev = (execSync("git show HEAD~1:sw.js", { stdio: "pipe" }).toString().match(/love-base-v(\d+)/) || [])[1];
    if (prev && prev === sw) fail(`這次改了 ${site.join("、")}，但版本號還是 v${sw}，手機可能一直顯示舊版`);
    else ok("改了網站檔案，版本號也有加");
  }
} catch (e) {
  /* 第一筆提交或拿不到上一筆，就跳過 */
}

// 5. app.js 排版
try {
  execSync("npx --yes prettier@3 --check app.js", { stdio: "pipe" });
  ok("app.js 排版正確");
} catch (e) {
  fail("app.js 排版跟 .prettierrc 不一致，請執行 npx prettier --write app.js");
}

// 6. 不能把暗號寫進公開的 repo：檢查程式裡有沒有寫死 love-base-room 的值
const src = fs.readFileSync("app.js", "utf8") + fs.readFileSync("index.html", "utf8");
if (/localStorage\.setItem\(\s*["']love-base-room["']\s*,\s*["'][^"']+["']/.test(src)) fail("程式裡寫死了暗號");
else ok("沒有寫死暗號");

console.log(bad ? `\n共 ${bad} 項沒過` : "\n全部通過");
process.exit(bad ? 1 : 0);
