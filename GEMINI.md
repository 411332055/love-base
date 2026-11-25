# 給 AI 助手的修改須知

這是寒冰和夏夏兩個人在用的網站「我們的戀愛遊戲基地」，裡面有真實的日記和照片。
修改時，**最重要的是不能讓舊資料讀不到、不見或被覆蓋**。

- 功能和使用方式：`README.md`
- 來龍去脈、每一種資料的欄位、每個功能的程式位置：`HANDOFF.md`（動手前請一起讀）

請用繁體中文回覆，說明要白話；使用者不是工程師。

## 架構

- 純靜態網站，沒有建置步驟、沒有框架，網站本身不用 npm（只有自動測試會在 GitHub 上裝 Playwright）。分成三個檔案：`index.html`（畫面結構和 `FIREBASE_CONFIG`）、`style.css`（樣式）、`app.js`（所有程式）。不要再拆更多檔案，也不要改成 module。
- 由 GitHub Pages 發布：推送到 `main` 分支後，大約一兩分鐘上線。
- Firebase 是從 gstatic 用 `<script>` 載入的 **compat 版 10.12.2**（`firebase.firestore()`、`db.collection(...).doc(...)` 這種寫法）。不要改成 ES module 或 v9 modular 寫法，除非整個檔案一起改並且測過。
- 資料路徑：`rooms/{暗號}/{集合}/{文件}`。`db` 變數已經指向 `rooms/{暗號}`，所以程式裡寫的是 `db.collection("diary")`。

## 不能動的東西（改了舊資料就會出問題）

1. **集合名稱只能用 `done`、`diary`、`photos`、`pics` 這四個。** `firestore.rules` 只允許這四個；寫進其他集合會被伺服器拒絕。
   - 新功能的資料請放在 `done`，文件 id 用 `x~種類~id` 的格式，並把新種類加進 `app.js` 裡的 `const store={...}`。願望、抽題、膠囊、回應等都是這樣存的。
   - `done` 裡不是 `x~` 開頭的文件是早期留下的舊資料（日期格式的 id 是每日任務紀錄，`draw-state` 是舊的抽題狀態），現在不再寫入，讀取時略過就好，不要刪。
2. **不要改已經存在的欄位名稱或 id 格式**，例如日記的 `date`、`by`、`at`，每日照片的 id `日期_名字`、日記照片的 id `日期_名字_亂數` 加上 `entry` 欄位。要加欄位可以，但要能處理舊資料沒有那個欄位的情況。
3. **一份文件最多 12 個欄位**（規則限制），整份文件不能超過 1 MB。日記已經 12 個欄位，不能再加。
4. **不要改 `FIREBASE_CONFIG`、暗號和暱稱的存法**（`localStorage` 的 `love-base-room`、`love-base-name`）。改了兩個人都會被登出，或進到新的空基地。
5. 名字固定是 `寒冰`、`夏夏`（`NAMES`），日記和照片用 `by` 欄位記錄是誰寫的。
6. XP 計分規則寫在 `README.md`：兩個人都完成才加分，**完成過就不扣分**。改計分時要保留這個原則，不能讓已經拿到的分數變少。
7. **暗號不能寫進 repo 的任何檔案**（repo 是公開的）。測試一律用 `test-only-123` 這類測試暗號。

## 寫程式的規則

- `app.js` 用 Prettier 排過版（`.prettierrc`，寬度 120）。一行一個敘述，不要把很多敘述擠在同一行。
- 共用的小工具請直接用，不要另外寫一套：
  - 新增資料：`addDoc(種類, 資料)`，修改：`updDoc`，刪除（進垃圾桶）：`delDoc`。這三個都會**先更新畫面再在背景存檔**，存失敗會自動還原；表單用 `bindForm()`，失敗時會把使用者打的字放回去。
  - 上傳照片：`savePhoto()`，再用 `settlePhotos()` 在背景確認有沒有存到。
  - 直接寫 Firestore 時包在 `commit()` 裡（離線時不等伺服器，資料先排隊）。
  - 手機上記住的設定：`lsGet(key)`、`lsSet(key, value)`、`lsDel(key)`（已經處理好無痕模式會出錯的情況）。
  - 讓瀏覽器下載檔案：`downloadBlob(檔名, blob)`。
- 顏色都用 `:root` 裡的 CSS 變數，深色模式也要看得清楚。
- 寒冰用 **Android Chrome**，夏夏用 **iPhone Safari**，兩種都要顧到：輸入框字體至少 16px（不然 iPhone 會自動放大畫面），按鈕不要放在 `<label>` 裡（iPhone 會點錯），多行輸入用 `<textarea>`。
- 新增可以左右捲動的區塊（`overflow-x:auto`）不用特別處理，左右滑換頁會自動避開它。

## 每次修改都要做

1. 開始前先 `git pull`（另一個 AI 助手 Claude 也會推送），推送前再 pull 一次。
2. **改了 `index.html`、`style.css`、`app.js`、`manifest.webmanifest` 或圖示時，版本號要加 1**：`sw.js` 第 2 行的 `CACHE`（例如 `love-base-v7` → `love-base-v8`），以及 `index.html`、`manifest.webmanifest` 裡所有 `?v=7` 的數字，全部保持一樣。不然手機可能一直顯示舊版。
3. 推送後 GitHub 會自動檢查（語法、題庫、版本號、排版），並用假資料庫在模擬手機上把網站跑一遍（`tools/test/browser-test.mjs`）。到 GitHub 上看那筆提交，出現紅色叉叉就要馬上修好。新功能可以順便在 `browser-test.mjs` 加一項測試。
4. 要用到新的集合或改規則時，先跟使用者說清楚：除了改 `firestore.rules`，**還要他自己到 Firebase 主控台的 Firestore「規則」頁貼上並發布**。能用 `done` + `x~種類~id` 解決就不要改規則。
5. 改完跟使用者說：改了什麼、要怎麼測、有沒有需要他到 Firebase 或 Apps Script 做什麼。

## 抽題題庫

每月題庫在 `questions.json`（`"YYYY-MM": {"theme": "...", "q": [...]}`）。新增月份時：題目數至少要等於那個月的天數；題目用繁體中文、適合情侶互相問、不要跟其他月份或 `app.js` 的 `QUESTIONS` 重複；改完確認 JSON 格式正確（少一個逗號整個題庫就讀不到）。

## 本機測試

- 直接用瀏覽器打開 `index.html` 就能看。這樣會連到真的資料庫，所以請用測試暗號（例如 `test-only-123`），不要用他們真正的暗號。
- 自動手機測試：`npm i --no-save playwright && npx playwright install chromium && node tools/test/browser-test.mjs`（用假的資料庫，不會碰到真的資料）。
