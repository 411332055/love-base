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
| `wishes` | 願望 | `text`、`cat`（eat/go/do/空字串）、`done`、`doneDate`、`by`、`at`、`plan`（約定日期 YYYY-MM-DD，可沒有） |
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
| `remind` | 自動提醒已發過推播的紀錄（不重複發） | id 是隔天的日期、`cap-膠囊id` 或 `space-YYYY-MM`，`date`、`by`、`at` |
| `push` | 手機推播設定與裝置訂閱 | `cfg` 存 VAPID 金鑰與 Google Apps Script 轉發網址（`url`、`pub`、`x`、`y`、`d`、`at`）；`s_亂數` 存各台裝置的 Web Push 訂閱（`by`、`ep`、`p256dh`、`auth`、`dev`、`pub`、`at`） |

`wrote`、`bonus` 和 `passed` 是 XP 不倒扣的關鍵：日記、照片或抽題刪掉後，這些紀錄還在，分數就不會少。不要刪它們，也不要改成只從 `diary`、`photos`、`answers` 即時計算。

### 刪除

刪除是在文件上加 `trashed: {at, by}`，30 天後 `purgeExpired()` 才真的刪。讀資料時都要濾掉 `trashed`。

### 存在手機裡的設定（localStorage）

`love-base-room`（暗號）、`love-base-name`（名字）、`love-base-theme`、`love-base-font`、`love-base-haptic`（震動開關 on/off）、`love-base-haptic-level`（震動強度 light/mid/strong）、`love-base-layout`、`love-base-draft`（日記草稿）、`love-base-diary-saving`（正在背景存檔的日記，存失敗時用來放回表單）、`love-base-ans-draft`（抽題草稿）、`love-base-rev-draft`（每週回顧草稿）、`love-base-cap-draft`（時光膠囊草稿）、`love-base-seen`、`love-base-cap-seen`（已看過到期提醒的膠囊）、`love-base-last-backup`、`love-base-backup-snooze`、`love-base-last-pic-scan`、`love-base-pic-snooze`、`love-base-side`、`love-base-remind-seen`（看過的「明天是…」提醒）、`love-base-ios-snooze`（iPhone 加到主畫面提醒的延後時間），以及沒連伺服器時的整份資料 `love-base-v1`。

## 四、程式在哪裡（`app.js`，用函式名稱搜尋）

| 功能 | 函式 |
|---|---|
| XP、稱號、連續天數、補簽卡 | `dayRecords`、`totalXP`、`streakBonus`、`renderStreak`、`renderHUD`，常數 `TITLES`、`DIARY_XP`、`DIARY_XP_END`、`PHOTO_BONUS`、`DRAW_XP`、`STREAK_STEP` |
| 紀念日、生日倒數 | `renderAnniv`、`renderBdays`、`saveBday`，交往日 `LOVE_START` |
| 每日照片、照片牆 | `renderTodayPhotos`、`renderWall`、`myPhotos`、`subPhotos` |
| 今天的照片 | `renderTodayPhotos`：兩個人的照片都先畫好（`data-pane`），切換只改 `#todayPhotos[data-showing]` 不重畫；一次看一個人（`phWho`，預設對方），左上角浮著「對方／我」切換鈕（粉紅膠囊可以用手指拖，`phSegI` 記上次位置）；照片在 `.ph-big` 裡左右滑，「＋ 再加照片」放在照片下面（沒有換照片按鈕，要換就點開大圖刪掉再傳）；編輯說明或上傳中會自動切到「我」；看對方時我還沒傳，下面有上傳按鈕；多張時下面有小圓點（`.ph-dots`）；停在「我」時對方傳新照片，切換鈕亮紅點（`PH_SEEN_KEY`）；在照片上左右滑到盡頭再滑會換人（`.ph-stage` 不觸發換頁） |
| 長按存照片 | 任何 `[data-open]` 照片長按 550ms 用 `photoFile(id)` 抓原圖下載，之後那次 click 不會打開大圖；照片上的瀏覽器長按選單關掉 |
| 照片上傳、壓縮 | `savePhoto`、`settlePhotos`（背景確認有沒有存到）、`shrinkFull`、`shrinkThumb`、`loadImg`、`uploadQueue`（日記照片排隊上傳） |
| 照片大圖（雙指與雙擊縮放、左右滑、存到手機、寫一句話） | `openPhoto`、`lbStep`、`closePhoto`、`lbResetZoom` |
| 寫日記、編輯、草稿 | `renderDiaryToday`、`diaryCard`、`diaryDl`、`diaryQuote`、`startEdit`、`endEdit`、`resetDiaryFields`、`saveDraft`、`restoreDraft` |
| 全部日記、搜尋（含留言與照片說明） | `renderEntries`（只畫打開的月份，搜尋一次顯示 30 篇） |
| 日記回應與表情貼圖 | `entryExtras`、`bindEntryActs`、`attachReply`、`REACTS`、`popFloat` |
| 抽題 | `monthBank`、`turnOf`、`todayRound`、`shownRound`、`drawQ`、`renderDraw`、`renderLog` |
| 願望（含分類、約定日期） | `renderWishes`、`toggleWish`、`setWishPlan`，分類 `WCATS`；約定日期 `planned`、`plansOn`，首頁提醒 `renderPlanNudge`（月曆有約定的未來日子可以點、可以往後翻到最後一個約定的月份） |
| 月曆、回顧、那年今天、時光膠囊、回憶書 | `renderChart`（幸福指數曲線，手指左右滑看每一天）、`renderCalendar`、`renderCalDetail`、`onThisDayHits`、`renderOnThisDay`、`renderTodayFlashback`、`renderMemories`、`renderCapsules`、`renderCapNudge`、`setNudge`、`renderBook`、`renderBookShell` |
| 星期日這週回顧 | `renderWeekRecap` |
| 垃圾桶、二次確認 | `confirmTap`、`armDelete`、`renderTrash`、`restoreItem`、`archivePhoto`、`restoreReplaced`、`hardDelete`、`purgeExpired` |
| 備份、補回、更換暗號 | `exportBackup`、`backupHtml`、`prepRestore`、`applyRestore`、`moveRoomBtn`；整月照片壓縮檔 `fillZipMonths`、`makeZip`（瀏覽器裡打包不壓縮的 zip，檔名 UTF-8） |
| 選單、區塊順序、外觀 | `CATS`、`SEC_META`、`renderNav`、`applyLayout`、`setView` |
| 換頁與捲動位置 | `setView` 換頁時依前後順序設 `data-dir`（f／b），新頁從右或左滑進來；把舊頁的捲動位置存進 `scrollPos`，`restoreScroll` 切回來時捲回去；`openFor("calendar:日期")` 會捲到那天的日記並閃一下（`#calDetail.flash`） |
| 開場與打開網站 | `index.html` 開頭的小程式：開場動畫（`#splash`＋`boot-in`）一天只播一次（`love-base-splash` 記日期）；網址有 `#區塊` 時加 `no-anchor`（CSS 把 scroll-margin 拉很大），擋住瀏覽器打開時自己跳到那個區塊，`load` 後或 `openFor` 要捲到中間區塊時拿掉 |
| 對方新東西提醒 | 今天頁 `#newNudge`（`renderNewNudge`）：對方今天的日記（`NEW_SEEN_KEY`）或照片（`PH_SEEN_KEY`）我還沒看過就提醒；進日記頁（`setView`）或停在日記頁時對方寫新的（`renderDiaryToday`）算看過 |
| 照片原圖 | 網站上存壓小的版本（`pics`，最長邊 1280）；設定「照片原圖」後（`x~orig~cfg` 存 Apps Script 網址），`savePhoto` 會 `origEnqueue` 把原圖放進 IndexedDB（`love-base-orig`），`origFlush` 在背景 POST 到 Apps Script（`GAS_BACKUP_CODE` 的 `doPost`，用暗號 SHA-256 驗證）存進雲端硬碟「戀愛基地原圖」，成功後照片紀錄加 `orig`（檔案 id）；下載／長按／打包用 `origFetch` 拿原圖，失敗就用壓小的版本；Apps Script 沒填暗號時，第一次 ping 會記住暗號的 SHA-256（Script Properties `ROOM_HASH`），之後只認它 |
| 寫完日記的回饋 | 送出時記下 `justIn`，新卡片畫出來時（`diaryCard`／`renderDiaryToday`）加 `.just-in` 彈一下、`popFloat` 飄 💌，只播一次；提示訊息看對方今天寫了沒 |
| 左右滑換頁 | 搜尋「左右滑換分類頁」：頁面跟著手指走（touchmove 非 passive，判斷是左右滑才 preventDefault），放開時超過 22% 寬或滑得快就換頁，不然彈回；兩端沒有下一頁時像橡皮筋；`inHScroll`、`typing`、`.ph-stage` 不換頁，從照片上開始滑要更水平、更長；拿掉拖曳樣式後加 `.settled` 避免進場動畫重播 |
| 震動回饋 | `haptic`（Android 用 `navigator.vibrate`，iPhone 用 `iosHaptic` 點隱藏的 iOS 18 開關元件）、`HAPTIC_LV`、`dragEndTick`、設定頁的「測試震動」 |
| 手機推播通知 | `renderPush`、`notifyPartner`、`sendPush`、`ensurePushCfg`、`vapidAuth`、`encryptPushBody`（瀏覽器端用 Web Crypto API 簽署 VAPID 與 `aes128gcm` 加密，透過 Google Apps Script 轉發） |
| 登入畫面、連線、資料同步 | `showGate`，以及檔案最後面的啟動程式（`onSnapshot` 都在那裡） |
| 月曆特別日子、明天提醒 | `specialOf`（不論是否到了）、`calSpecial`（月曆用，未來的日子不顯示）、`isQixi`、`renderRemind`、`renderIosNudge` |
| 長按日記表情、下拉重新整理 | 搜尋「長按日記卡片」「下拉重新整理」，常數 `MORE_REACTS` |
| 重畫畫面 | `renderAll`（下一個畫面格才重畫，只畫打開的區塊） |
| 存資料 | `addDoc`、`updDoc`、`delDoc`、`bindForm`、`commit`、`saveToast`；刪除後的「復原」提示 `trashedToast`（呼叫 `restoreItem`） |
| 共用小工具 | `lsGet`、`lsSet`、`lsDel`（localStorage）、`downloadBlob`（下載檔案）、`esc`（轉義）、`escLink`（轉義並把網址變成連結）、`toast(文字, 毫秒, {label, fn})`（可帶一個按鈕） |

**存資料的方式：先更新畫面，再在背景存檔。** `addDoc`、`updDoc`、`delDoc`、寫日記、上傳照片都是先把資料放進畫面（使用者按下去馬上看到結果），再用 `commit()` 寫進 Firestore。`commit()` 最多等 2.5 秒（照片 5 秒），沒等到就先放行，資料留在本機佇列繼續同步，並提示「已先存在手機」。真的被伺服器拒絕時，會把剛加的東西從畫面拿掉、把使用者打的字放回表單，並提示沒存到。

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

- **推播郵差只能轉發到推播服務**：手機推播透過免費的 Google Apps Script（專案「戀愛基地 通知」）轉發，iPhone 要先加到主畫面才收得到。`GAS_PUSH_CODE` 裡的 `PUSH_HOSTS` 白名單只允許 Google（FCM）、Apple、Mozilla、Microsoft 的推播網址，因為郵差網址公開在 GitHub 上，沒有白名單別人可以拿它當免費轉發站。改了 `GAS_PUSH_CODE` 之後，使用者要自己到 Apps Script 重新部署「新版本」才會生效。
- `diary` 和 `done` 每次都整包載入。靠 Firestore 的離線快取所以不慢（用兩年份的假資料測過，切換頁面仍很順），更多年之後可能要分批。
- 照片存在 Firestore 文件裡，免費方案總共 1 GB，估計 2029 年左右用滿；每月 1 號會自動檢查並在超過 700 MB 時推播。
- 名字 `寒冰`、`夏夏` 是寫死的（`NAMES`），不支援第三個人。

## 七、自動化（GitHub Actions）

### 每次推送：`.github/workflows/check.yml`

- `tools/check.js`：`app.js` 語法、`questions.json` 格式和題數、版本號一致、排版、`index.html` 的 id 沒有重複，還有下面三項把關：
  - **暗號不能進 repo**：掃 repo 裡每個檔案，像真暗號（8～64 個英數、- 或 _）又不是 `test-` 開頭的寫法就擋（`love-base-room`、`ROOM`、`rooms/…/`、Apps Script 的 `ROOM_CODE`、工作流程裡寫死、印到紀錄裡）。在 GitHub 上跑時還會拿 Secret `ROOM_CODE` 的真暗號逐檔比對，只列檔名。測試請用 `test-` 開頭的假暗號。
  - **使用者的字要先 `esc()`**（`tools/esc-check.js`）：會變成 HTML 的樣板字串裡，`x.cap`、`x.say`、`x.text`、`x.by`… 沒包在 `esc()`／`escLink()`／`byChip()` 裡就擋；只拿來判斷的（`x.cap ? …`、`x.by === me`）不算。確定安全但被誤判：那一行加 `// esc-ok: 原因`。`nameOf()` 不會 esc，要自己包。
  - **沒在用的樣式和函式**：`style.css` 的 class 在 `app.js`／`index.html` 找不到、`app.js` 最外層的函式／變數只出現一次就擋。程式組出來的 class（`"d-" + x`、`` `d-${x}` ``）會自動認前綴。被擋時通常是真的該刪；如果是新寫法組 class，用上面那種「前綴-」寫法就認得到。
- `tools/test/browser-test.mjs`：用 `tools/test/fake-firebase.js`（假的 Firestore，資料只在記憶體）在模擬手機上跑網站：11 頁在深色 390px、淺色 390px、淺色 360px 都不能有程式錯誤或左右超出；寫日記、許願並完成、約定日期、刪除復原、月曆今天的格子、幸福指數曲線、下載一個月的照片壓縮檔；開場動畫一天一次、用 #today 打開不亂跳、對方新東西提醒、今天的照片切換不重畫、寫完日記的回饋、左右滑換頁跟手。暗號用 `test-only-123`，不會碰到真的資料。
- 同一套測試跑兩次：Chromium（`browser-test`，跟 Android Chrome 一樣）和 WebKit（`browser-test-iphone`，跟 iPhone Safari 一樣，`BROWSER=webkit`）。WebKit 不能模擬觸控，左右滑那項會自動略過。
- GitHub 上那筆提交出現紅色叉叉就是沒過，點進去看是哪一項。

### 每天 00:00：`.github/workflows/remind.yml`

- 台灣時間 00:00（cron `0 16 * * *` UTC，GitHub 常會晚幾分鐘到半小時）跑 `tools/remind.mjs`，用執行當下的台灣日期當「今天」，直接推播給 `done` 裡的 `x~push~s_*` 裝置（用 `x~push~cfg` 的 VAPID 金鑰，不經過 Apps Script）：
  - 今天是週年、里程碑、生日、七夕或每月紀念日 → 兩個人，記錄 `x~remind~day-日期`。（前一天打開網站時，網站自己會推「明天是…」，那則記錄是 `x~remind~日期`，兩則不衝突。）
  - 今天有約好、還沒完成的願望 → 兩個人，記錄 `x~remind~planday-日期`（網站前一天的「明天約好了」是 `plan-日期`）。
  - 今天輪到誰抽題（跟 `app.js` 的 `turnOf()` 一樣隔天輪）而且還沒抽（`x~rounds~` 裡沒有今天的）→ **只推給輪到的那個人**的裝置（看 `x~push~` 的 `by`），記錄 `x~remind~draw-日期`。
  - 到期的時光膠囊 → 兩個人，記錄 `x~remind~cap-膠囊id`。
- 每月 1 號同一支程式會讀完 `pics` 的原圖算空間（REST 加 `mask.fieldPaths=img`），超過 `WARN_MB`（從 `app.js` 的備份程式碼讀，現在是 700）就推播，並寫一筆 `x~remind~space-YYYY-MM`。讀原圖一次最多約 1 GB 流量，所以一個月只做一次；本機測試可設 `FORCE_SPACE=1`。
- 暗號放在 GitHub 的 **Secret `ROOM_CODE`**（Settings → Secrets and variables → Actions），沒設定時會直接略過。不能寫進程式或印到紀錄。
- 判斷規則要和 `app.js` 的 `specialOf()` 一致；`LOVE_START`、`MILE_DAYS`、`NAMES` 是直接從 `app.js` 讀的。改了 `specialOf()` 的規則，`remind.mjs` 也要一起改。
- GitHub 會暫停 60 天沒有提交的 repo 的排程。`remind.yml` 最後一步用 `gh api -X PUT .../workflows/remind.yml/enable` 重新啟用（需要 `actions: write`），讓計時重算；這步失敗不影響提醒本身。
- 要手動測試：GitHub 的 Actions 頁籤 → 「紀念日前一天提醒」→ Run workflow。

## 八、怎麼測試

- 直接用瀏覽器打開 `index.html`，**用測試暗號**（例如 `test-only-123`），不要用真的暗號。
- 自動手機測試在本機跑：`npm i --no-save playwright && npx playwright install chromium && node tools/test/browser-test.mjs`。
- 改到資料讀寫時，可以在 `fake-firebase.js` 的 `set` 裡加延遲或丟出錯誤，模擬網路慢和伺服器拒絕，確認畫面先更新、失敗時會還原。
- 推送前至少確認：`node --check app.js`、`node tools/check.js` 全部通過。

## 九、改動紀錄

`git log` 有完整紀錄，每一筆的訊息都用中文寫了改了什麼。目前的版本號看 `sw.js` 第 2 行。
