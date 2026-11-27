// 檢查使用者打的字（日記、照片說明、願望、留言、名字…）放進網頁前有沒有先用 esc() 處理。
// 沒處理的話，字裡有 < & 之類的符號畫面會亂掉，有心人還能塞進會執行的程式。
//
// 怎麼判斷：找出 app.js 裡所有「會變成 HTML 的樣板字串」（`<div>${…}</div>` 這種），
// 看每個 ${…} 裡有沒有直接用到使用者欄位（x.cap、x.say、x.text、x.by…）。
// 下面這些不算問題：
//   - 包在 esc()、escLink()、byChip() 裡（byChip 自己會 esc）
//   - 只拿來判斷、不會顯示出來：x.cap ? … : …、x.by === me、!x.cap、x.cap &&、x.cap.length
// 真的確認安全、但檢查誤判時：在那一行加註解「// esc-ok: 原因」就會跳過。
// 抓不到的情況：先把欄位存進別的變數再放進去（const t = p.cap; `${t}`），所以寫的時候還是要注意。

const SAFE_FN = ["esc", "escLink", "byChip", "Number", "encodeURIComponent"];
const FIELDS =
  "cap|say|mood|food|funny|text|title|note|body|reply|msg|q|ans|answer|comment|reason|place|by|name|emoji|label|val|value|t";
const FIELD = new RegExp(`\\b[A-Za-z_$][\\w$]*(?:\\?\\.|\\.)(?:${FIELDS})\\b(?!\\s*\\()`);
const F = "[A-Za-z_$][\\w$]*(?:\\?\\.|\\.)[A-Za-z_$][\\w$]*";

// 把程式拆出所有樣板字串：{ start, quasis（文字部分）, exprs（${} 裡的程式碼和位置）}
function templates(src) {
  const out = [],
    n = src.length;
  let i = 0,
    prev = "";
  // 「/」是除號還是正規表達式的開頭：看前一個有意義的符號
  const regexOk = () =>
    prev === "" ||
    /[(,=:[!&|?{};+\-*%<>~^]$/.test(prev) ||
    /^(return|typeof|case|in|of|delete|void|throw|new|else|do)$/.test(prev);
  const skipStr = (q) => {
    i++;
    while (i < n && src[i] !== q) {
      if (src[i] === "\\") i++;
      i++;
    }
    i++;
  };
  const skipComment = () => {
    if (src[i + 1] === "/") {
      while (i < n && src[i] !== "\n") i++;
      return true;
    }
    if (src[i + 1] === "*") {
      const e = src.indexOf("*/", i + 2);
      i = e < 0 ? n : e + 2;
      return true;
    }
    return false;
  };
  function readTpl() {
    const start = i;
    i++;
    const quasis = [],
      exprs = [];
    let cur = "";
    while (i < n) {
      const c = src[i];
      if (c === "\\") {
        cur += c + (src[i + 1] || "");
        i += 2;
        continue;
      }
      if (c === "`") {
        i++;
        break;
      }
      if (c === "$" && src[i + 1] === "{") {
        quasis.push(cur);
        cur = "";
        i += 2;
        const es = i;
        let depth = 1;
        while (i < n && depth) {
          const d = src[i];
          if (d === "`") {
            readTpl();
            continue;
          }
          if (d === '"' || d === "'") {
            skipStr(d);
            continue;
          }
          if (d === "/" && skipComment()) continue;
          if (d === "{") depth++;
          else if (d === "}") depth--;
          i++;
        }
        exprs.push({ code: src.slice(es, i - 1), at: es });
        continue;
      }
      cur += c;
      i++;
    }
    quasis.push(cur);
    out.push({ start, end: i, quasis, exprs });
  }
  while (i < n) {
    const c = src[i];
    if (c === "/" && skipComment()) continue;
    if (c === '"' || c === "'") {
      skipStr(c);
      prev = "x";
      continue;
    }
    if (c === "`") {
      readTpl();
      prev = "x";
      continue;
    }
    if (c === "/" && regexOk()) {
      i++;
      let cls = false;
      while (i < n) {
        const d = src[i];
        if (d === "\\") {
          i += 2;
          continue;
        }
        if (d === "[") cls = true;
        else if (d === "]") cls = false;
        else if ((d === "/" && !cls) || d === "\n") break;
        i++;
      }
      i++;
      while (/[a-z]/i.test(src[i] || "")) i++;
      prev = "x";
      continue;
    }
    if (/[\w$]/.test(c)) {
      let j = i;
      while (j < n && /[\w$]/.test(src[j])) j++;
      prev = src.slice(i, j);
      i = j;
      continue;
    }
    if (!/\s/.test(c)) prev = c;
    i++;
  }
  return out;
}

// esc(…) 這類安全函式整段拿掉
function stripSafe(code) {
  let s = code;
  for (let changed = true; changed;) {
    changed = false;
    for (const f of SAFE_FN) {
      const re = new RegExp(`\\b${f}\\s*\\(`, "g");
      let m;
      while ((m = re.exec(s))) {
        let j = m.index + m[0].length,
          d = 1;
        while (j < s.length && d) {
          if (s[j] === "(") d++;
          else if (s[j] === ")") d--;
          j++;
        }
        s = s.slice(0, m.index) + "0" + s.slice(j);
        changed = true;
        re.lastIndex = m.index + 1;
      }
    }
  }
  return s;
}
// 只拿來判斷、不會顯示的用法拿掉
function stripCond(code) {
  return code
    .replace(new RegExp(F + "\\.length\\b", "g"), "0")
    .replace(new RegExp(F + "\\s*(===|!==|==|!=|>=|<=|>|<)", "g"), "0 $1")
    .replace(new RegExp("(===|!==|==|!=|>=|<=|>|<)\\s*" + F, "g"), "$1 0")
    .replace(new RegExp("!" + F, "g"), "0")
    .replace(new RegExp(F + "\\s*(&&|\\?(?![.?]))", "g"), "0 $1");
}

function escCheck(src) {
  const lines = src.split("\n");
  const lineOf = (at) => src.slice(0, at).split("\n").length;
  const okLine = (ln) => /esc-ok/.test(lines[ln - 1] || "");
  const isHtml = (t) => t.quasis.some((q) => /<\/?[a-z][\w-]*[\s>/]|&[a-z]+;|(^|\s)[a-z-]+="/i.test(q));
  const hits = [];
  const tpls = templates(src);
  for (const t of tpls) {
    if (!isHtml(t)) continue;
    for (const e of t.exprs) {
      if (e.code.includes("`")) continue; // 裡面還有樣板字串：那一層自己會被檢查
      const ln = lineOf(e.at);
      if (!okLine(ln) && FIELD.test(stripCond(stripSafe(e.code))))
        hits.push(`第 ${ln} 行：\${${e.code.trim().replace(/\s+/g, " ").slice(0, 60)}}`);
    }
  }
  // 不用樣板字串、直接把欄位塞進網頁：el.innerHTML = p.cap、"<p>" + p.cap
  const direct = [
    new RegExp(`(?:innerHTML\\s*\\+?=|insertAdjacentHTML\\([^,]+,)\\s*(${F})\\s*[;)\\n]`, "g"),
    new RegExp(`["'][^"'\\n]*<[a-z/][^"'\\n]*["']\\s*\\+\\s*(${F})`, "g"),
    new RegExp(`(${F})\\s*\\+\\s*["'][^"'\\n]*<[a-z/]`, "g"),
  ];
  for (const re of direct)
    for (const m of src.matchAll(re)) {
      const ln = lineOf(m.index);
      if (FIELD.test(m[1]) && !okLine(ln)) hits.push(`第 ${ln} 行：${m[0].trim().slice(0, 60)}`);
    }
  return { hits, count: tpls.filter(isHtml).length };
}

module.exports = { escCheck, templates };
