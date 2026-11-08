# 戀愛遊戲基地：架設教學

總共約 15 分鐘，全部免費。資料會存在 Google 的 Firebase 伺服器上，兩個人用手機或電腦打開同一個網址、輸入同一組暗號，進度就會即時同步。

資料夾裡有三個檔案：

| 檔案 | 用途 |
|---|---|
| `index.html` | 網站本體 |
| `firestore.rules` | 資料庫的安全規則（第 3 步要貼上） |
| `設定教學.md` | 就是這份 |

---

## 第 1 步：建立 Firebase 專案

1. 用 Google 帳號登入 https://console.firebase.google.com
2. 按「建立專案」（或「新增專案」），名稱隨便取，例如 `love-base`
3. Google Analytics 可以關掉，按「建立專案」

## 第 2 步：建立資料庫

1. 左邊選單 →「建構」→「Firestore Database」
2. 按「建立資料庫」
3. 位置選 **asia-east1（台灣）**，速度最快
4. 選「以正式版模式啟動」→「建立」

## 第 3 步：貼上安全規則

1. 在 Firestore 頁面上方點「規則」分頁
2. 把裡面原本的內容全部刪掉
3. 用記事本打開 `firestore.rules`，全部複製貼上
4. 按「發布」

這組規則的意思是：只有知道暗號的人，才能讀寫你們那間「房間」的資料，別人沒辦法列出或偷看。

## 第 4 步：拿到網站設定，貼進 index.html

1. 左上角齒輪 ⚙️ →「專案設定」
2. 往下滑到「你的應用程式」，按網頁圖示 `</>`
3. 應用程式暱稱隨便取，**不用**勾 Firebase Hosting，按「註冊應用程式」
4. 畫面會出現一段 `const firebaseConfig = { apiKey: "...", ... }`
5. 用記事本（或 VS Code）打開 `index.html`，搜尋 `FIREBASE_CONFIG`，把 `{ }` 裡面的六行換成 Firebase 給你的內容，例如：

```js
const FIREBASE_CONFIG = {
  apiKey: "AIzaSy......",
  authDomain: "love-base-xxxx.firebaseapp.com",
  projectId: "love-base-xxxx",
  storageBucket: "love-base-xxxx.appspot.com",
  messagingSenderId: "1234567890",
  appId: "1:1234567890:web:abcdef"
};
```

6. 存檔。

> apiKey 放在網頁裡是正常的，Firebase 本來就是這樣設計的，真正保護資料的是第 3 步的規則和你們的暗號。

## 第 5 步：放上網路（拿到網址）

最簡單的是 **Netlify**：

1. 到 https://app.netlify.com/drop ，先免費註冊並登入。如果沒登入，網站過一段時間就會被刪掉。
2. 把整個資料夾直接拖進網頁
3. 幾秒後會得到一個網址，像 `https://xxxx.netlify.app`
4. 想換好記的名字：Site configuration → Change site name

之後如果改了 `index.html`，到該網站的「Deploys」頁面把資料夾再拖一次就會更新。

## 第 6 步：開始玩

1. 打開網址，會跳出「輸入你們的暗號」
2. 兩個人約好一組**別人猜不到**的暗號，8 個字以上，只能用英文、數字、`-`、`_`，例如 `bear-bunny-0214-xyz`
3. 兩個人都輸入同一組暗號，最上面顯示「● 兩人同步中」就成功了
4. 手機可以用瀏覽器的「加入主畫面」，用起來就像一個 App

---

## 常見問題

**畫面顯示「尚未設定伺服器」**：第 4 步的設定沒有貼好，或沒有存檔。

**顯示「同步中斷」**：通常是第 3 步的規則沒有發布，或暗號太短。

**輸錯暗號怎麼辦？** 按最上面狀態旁的「換暗號」重新輸入。輸錯的話會進到另一間空房間，原本的資料不會不見。

**會不會要錢？** 兩個人使用遠低於 Firebase 的免費額度（每天 5 萬次讀取、2 萬次寫入），不會收費，也不需要綁信用卡。
