# 專案交接文件

這份文件把「我們的戀愛遊戲基地」的來龍去脈、資料結構和程式位置整理給接手的 AI 助手。
規則看 `GEMINI.md`，使用方式看 `README.md`，這份補的是那兩份沒寫的背景。

**暗號不在這份文件裡，也不可以寫進這個 repo 的任何檔案。** 這個 repo 是公開的，暗號是資料唯一的門鎖。

## 一、使用者

- 使用者是「寒冰」，和女朋友「夏夏」一起用這個網站。兩個人都不是工程師。
- 用繁體中文、白話說明。一次改一件事，先說打算怎麼改，等他同意再動手。
- 寒冰用 **Android（Samsung）的 Chrome**，網站有加到主畫面當 App 用。夏夏用 **iPhone（iOS）**，iPhone Safari 和 Android Chrome 都要能用。電腦是 Windows。
- 使用者在電腦的 `C:\Users\icebo\love-base` 有一份 repo，用 Antigravity CLI（指令 `agy`）修改。
- 另一個 AI 助手（Claude）也會直接推送到 GitHub，所以**每次開始前都要先 `git pull`**，推送前也要再 pull 一次。

## 二、放在哪裡

| 項目 | 位置 |
|---|---|
| 程式碼 | GitHub `411332055/love-base`（公開），`main` 分支 |
| 網站 | GitHub Pages：https://411332055.github.io/love-base/ ，推送到 `main` 後約 1～2 分鐘上線 |
| 資料 | Firebase 專案 `love-base-eec24` 的 Firestore，免費的 Spark 方案 |
| 規則 | `firestore.rules`。改了之後使用者要自己到 Firebase 主控台貼上並發布 |

沒有登入系統，沒有後端程式。兩個人輸入同一組暗號，資料路徑就是 `rooms/{暗號}/...`，規則只檢查暗號長度至少 8、集合名稱在允許清單內、一份文件最多 12 個欄位。

## 三、資料結構

四個集合，全部在 `rooms/{暗號}/` 底下。

### `diary`：日記（文件 id 由 Firestore 自動產生）

`date`（日記是哪一天，`YYYY-MM-DD`）、`by`（寒冰或夏夏）、`at`（寫的時間，ISO 字串）、`mood`、`food`、`funny`、`say`、`s1`、`s2`（今日小結的兩格）、`happy`（1～10 或 null）、`edited`、`trashed`。
已經 12 個欄位，**不能再加欄位**；日記相關的新資料要另外存（回應就是存在 `done`）。

### `photos`：縮圖和說明；`pics`：同一個 id 的原圖

- `photos`：`date`、`by`、`th`（縮圖 data URL）、`cap`（一句話）、`at`、`entry`（屬於哪篇日記，每日照片沒有這欄）、`trashed`、`replaced`（被「換一張」換掉時，原本的 id）。
- `pics`：`img`（原圖 data URL，最長邊 1280、壓到約 300 KB，常數 `PHOTO_MAX`）、`date`、`by`。
- id 格式：每日第一張 `日期_名字`；其他每日照片和日記照片 `日期_名字_亂數`；被換掉進垃圾桶的 `原id~亂數`。
- 一天每人最多 9 張每日照片，一篇日記最多 9 張。上傳一律走 `savePhoto()`。

### `done`：其他所有資料

- 文件 id 是 `x~種類~id`，程式用 `xRef(種類, id)` 取得位置，讀進來後放在 `store[種類]`。
- 不是 `x~` 開頭的舊文件：日期格式的 id 是早期的每日任務紀錄，`draw-state` 是早期的抽題狀態，現在都不再寫入，但讀取時要能略過，不要刪。

| 種類 | 內容 | 主要欄位 |
|---|---|---|
| `wishes` | 願望 | `text`、`cat`（eat/go/do/空字串）、`done`、`doneDate`、`by`、`at` |
| `rounds` | 抽到的題目 | `q`、`day`、`by`、`at` |
| `answers` | 抽題的回答 | `round`、`text`、`by`、`at` |
| `custom` | 自訂題目 | `kind:"q"`、`text`、`by`、`at` |
| `capsules` | 時光膠囊 | `text`、`openDate`、`by`、`at` |
| `replies` | 日記的回應（文字留言與表情貼圖） | `entry`、`kind`（`"text"` 或 `"emo"`）、`text`、`by`、`at` |
| `hugs` | 討抱抱 | `text`、`by`、`at` |
| `reviews` | 星期日的這週回顧 | id 是 `日期_名字` |
| `wrote` | 「這天這個人寫過日記」的永久紀錄 | id `日期_名字`，`date`、`by`、`at` |
| `bonus` | 「這天這個人傳過照片」的永久紀錄 | id `日期_名字`，`date`、`xp`、`by`、`at` |
| `passed` | 「這題抽題過關」的永久紀錄 | id 是題目 id，`day`、`xp`、`by`、`at` |
| `fixes` | 補簽卡用掉的紀錄 | `day`、`by`、`at` |
| `birthdays` | 生日 | id 是名字，`m`、`d` |
| `backups` | 做過備份的紀錄 | `full`、`by`、`at` |
| `remind` | 紀念日前一天提醒已發過推播的紀錄（不重複發） | id 是隔天的日期，`date`、`by`、`at` |
| `push` | 手機推播設定與裝置訂閱 | `cfg` 存 VAPID 金鑰與 Google Apps Script 轉發網址（`url`、`pub`、`x`、`y`、`d`、`at`）；`s_亂數` 存各台裝置的 Web Push 訂閱（`by`、`ep`、`p256dh`、`auth`、`dev`、`pub`、`at`） |

`wrote`、`bonus` 和 `passed` 是 XP 不倒扣的關鍵：日記、照片或抽題刪掉後，這些紀錄還在，分數就不會少。不要刪它們，也不要改成只從 `diary`、`photos`、`answers` 即時計算。

### 刪除

刪除是在文件上加 `trashed: {at, by}`，30 天後 `purgeExpired()` 才真的刪。讀資料時都要濾掉 `trashed`。

### 存在手機裡的設定（localStorage）

`love-base-room`（暗號）、`love-base-name`（名字）、`love-base-theme`、`love-base-font`、`love-base-haptic`（震動開關 on/off）、`love-base-haptic-level`（震動強度 light/mid/strong）、`love-base-layout`、`love-base-draft`（日記草稿）、`love-base-seen`、`love-base-cap-seen`（已看過到期提醒的膠囊）、`love-base-last-backup`、`love-base-backup-snooze`、`love-base-last-pic-scan`、`love-base-pic-snooze`、`love-base-side`、`love-base-remind-seen`（看過的「明天是…」提醒）、`love-base-ios-snooze`（iPhone 加到主畫面提醒的延後時間），以及沒連伺服器時的整份資料 `love-base-v1`。

## 四、程式在哪裡（`app.js`，用函式名稱搜尋）

| 功能 | 函式 |
|---|---|
| XP、稱號、連續天數、補簽卡 | `dayRecords`、`totalXP`、`streakBonus`、`renderStreak`、`renderHUD`，常數 `TITLES`、`DIARY_XP`、`DIARY_XP_END`、`PHOTO_BONUS`、`DRAW_XP`、`STREAK_STEP` |
| 紀念日、生日倒數 | `renderAnniv`、`renderBdays`、`saveBday`，交往日 `LOVE_START` |
| 每日照片、照片牆 | `renderTodayPhotos`、`renderWall`、`myPhotos`、`subPhotos` |
| 照片上傳、壓縮 | `savePhoto`、`shrink`、`loadImg`、`uploadQueue`（日記照片排隊上傳） |
| 照片大圖（左右滑、存到手機、寫一句話） | `openPhoto`、`lbStep`、`closePhoto` |
| 寫日記、編輯、草稿 | `renderDiaryToday`、`diaryCard`、`diaryDl`、`diaryQuote`、`startEdit`、`endEdit`、`resetDiaryFields`、`saveDraft`、`restoreDraft` |
| 全部日記、搜尋 | `renderEntries`（只畫打開的月份，搜尋一次顯示 30 篇） |
| 日記回應與表情貼圖 | `entryExtras`、`bindEntryActs`、`attachReply`、`REACTS`、`popFloat` |
| 抽題 | `monthBank`、`turnOf`、`todayRound`、`shownRound`、`drawQ`、`renderDraw`、`renderLog` |
| 願望 | `renderWishes`、`toggleWish`，分類 `WCATS` |
| 月曆、回顧、那年今天、時光膠囊、回憶書 | `renderCalendar`、`renderCalDetail`、`onThisDayHits`、`renderOnThisDay`、`renderTodayFlashback`、`renderMemories`、`renderCapsules`、`renderCapNudge`、`setNudge`、`renderBook`、`renderBookShell` |
| 星期日這週回顧 | `renderWeekRecap` |
| 垃圾桶、二次確認 | `confirmTap`、`armDelete`、`renderTrash`、`restoreItem`、`archivePhoto`、`restoreReplaced`、`hardDelete`、`purgeExpired` |
| 備份、補回、更換暗號 | `exportBackup`、`backupHtml`、`prepRestore`、`applyRestore`、`moveRoomBtn` |
| 選單、區塊順序、外觀 | `CATS`、`SEC_META`、`renderNav`、`applyLayout`、`setView` |
| 震動回饋 | `haptic`（Android 用 `navigator.vibrate`，iPhone 用 `iosHaptic` 點隱藏的 iOS 18 開關元件）、`HAPTIC_LV`、`dragEndTick`、設定頁的「測試震動」 |
| 手機推播通知 | `renderPush`、`notifyPartner`、`sendPush`、`ensurePushCfg`、`vapidAuth`、`encryptPushBody`（瀏覽器端用 Web Crypto API 簽署 VAPID 與 `aes128gcm` 加密，透過 Google Apps Script 轉發） |
| 登入畫面、連線、資料同步 | `showGate`，以及檔案最後面的啟動程式（`onSnapshot` 都在那裡） |
| 月曆特別日子、明天提醒 | `specialOf`（不論是否到了）、`calSpecial`（月曆用，未來的日子不顯示）、`isQixi`、`renderRemind`、`renderIosNudge` |
| 長按日記表情、下拉重新整理 | 搜尋「長按日記卡片」「下拉重新整理」，常數 `MORE_REACTS` |
| 重畫畫面 | `renderAll`，資料一變動就整個重畫 |

寫入一律包在 `commit()` 裡：離線時不等伺服器回應，資料先排隊，連上後自動送出。

## 五、做過的決定和原因

- **只用四個集合、其他塞進 `done`**：每開一個新集合，使用者就要自己去 Firebase 改規則，他不熟，所以盡量不改規則。
- **XP 要兩個人都完成才加，而且不倒扣**：使用者要的是「一起做」，不是比賽。
- **抽題每天輪流、每月換主題**：隔天輪流是用日期算的（`turnOf`），不存資料。題庫在 `questions.json`，寫到 2028 年 10 月，每月題數不少於當月天數。
- **照片存成 Firestore 文件裡的 data URL**：這樣不用另外開通和設定 Firebase Storage。代價是一份文件最多 1 MB，所以上傳前一定壓縮。
- **換照片不直接蓋掉**：舊的複製到垃圾桶（`archivePhoto`），復原時跟現在那張對調。
- **程式拆成 `index.html`、`style.css`、`app.js` 三個檔**，`app.js` 用 Prettier（寬度 120）排版。不要再拆，也不要引入建置工具。
- **Gemini CLI 已經不能用個人帳號登入**，所以改用 Antigravity CLI。
- **震動**：網頁只能控制震多久，不能控制力道，所以「強度」是震動長短。Samsung 在**靜音模式**下會擋掉所有震動，網站沒辦法繞過；使用者說沒震動時，先請他按設定裡的「測試震動」看診斷文字。iPhone 的 Safari 不支援 `navigator.vibrate`，只能用 iOS 18 的開關元件，而且只在點擊或手指放開的當下有效。
- **寫日記的表單不放照片欄位**（使用者要求精簡），照片是寫完後在那篇日記按「📷 加照片」。

## 六、已知的限制和還沒做的事

- **推播通知**：已在「更多 → 設定 → 🔔 手機推播通知」支援 Web Push（透過免費的 Google Apps Script 轉發，iPhone 需先加到主畫面）。
- **推播郵差只能轉發到推播服務**：`GAS_PUSH_CODE` 裡的 `PUSH_HOSTS` 白名單只允許 Google（FCM）、Apple、Mozilla、Microsoft 的推播網址。郵差網址公開在 GitHub 上，沒有白名單的話別人可以拿它當免費轉發站。改了 `GAS_PUSH_CODE` 之後，使用者要自己到 Apps Script 重新部署「新版本」才會生效。
- `diary` 和 `done` 每次都整包載入。靠 Firestore 的離線快取所以不慢，幾年後資料很多時可能要分批。
- 月底總結已整合進「回憶書」，和年度總結放在一起切換。
- 名字 `寒冰`、`夏夏` 是寫死的（`NAMES`），不支援第三個人。

## 自動提醒（GitHub Actions）

- `.github/workflows/remind.yml` 每天台灣時間晚上約 8 點跑 `tools/remind.mjs`：明天是週年、里程碑、生日、七夕或每月紀念日，就直接推播給 `done` 裡所有 `x~push~s_*` 裝置（用 `x~push~cfg` 的 VAPID 金鑰，不經過 Apps Script），並寫一筆 `x~remind~日期`，網站和下一次執行都不會重複發。
- 暗號放在 GitHub 的 **Secret `ROOM_CODE`**（Settings → Secrets and variables → Actions），沒設定時會直接略過。不能寫進程式或印到紀錄。
- 判斷規則要和 `app.js` 的 `specialOf()` 一致；`LOVE_START`、`MILE_DAYS`、`NAMES` 是直接從 `app.js` 讀的。改了 `specialOf()` 的規則，`remind.mjs` 也要一起改。
- 要手動測試：GitHub 的 Actions 頁籤 → 「紀念日前一天提醒」→ Run workflow。

## 七、怎麼測試

- 直接用瀏覽器打開 `index.html`，**用測試暗號**（例如 `test-only-123`），不要用真的暗號。
- 每次推送到 GitHub，`.github/workflows/check.yml` 會自動檢查：`app.js` 語法、`questions.json` 格式和題數、三個版本號一致、`app.js` 排版、檔案裡沒有暗號。GitHub 上那筆提交出現紅色叉叉就是沒過，點進去看是哪一項。
- 功能測試沒有自動化。之前的做法是用 Playwright 模擬手機，把 Firebase 的兩個 `<script>` 換成假的記憶體版本（實作 `collection`、`doc`、`set`、`update`、`get`、`delete`、`where`、`orderBy`、`limit`、`onSnapshot`），再用程式操作畫面並檢查結果。有改到資料讀寫時，建議照這個方法測過再推。
- 改完檢查：`node --check app.js`、`questions.json` 是合法的 JSON、兩個版本號都加了（見 `GEMINI.md`）。

## 八、改動紀錄

`git log` 有完整紀錄，每一筆的訊息都用中文寫了改了什麼。目前的版本號看 `sw.js` 第 2 行。
