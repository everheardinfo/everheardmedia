# 有所耳聞有限公司 官方網站

純靜態網站（HTML + CSS + 原生 JavaScript），**沒有 WordPress、沒有外掛、沒有建置流程**。
把整個資料夾丟到 Cloudflare Pages / Netlify / GitHub Pages 就能上線。

- 作品集與合作客戶 → 由 **Google Sheet** 當後台，改試算表即改網站，不用碰程式碼。
- 其他文案（標題、服務說明、聯絡資訊）→ 直接改 HTML 檔。

---

## 目錄

1. [檔案結構](#1-檔案結構)
2. [用 Google Sheet 管理作品集與客戶（最重要）](#2-用-google-sheet-管理作品集與客戶最重要)
3. [改文案要動哪個檔](#3-改文案要動哪個檔)
4. [本機預覽](#4-本機預覽)
5. [部署上線](#5-部署上線)
6. [目前待補（TODO）](#6-目前待補todo)
7. [未來可加的功能](#7-未來可加的功能)

---

## 1. 檔案結構

```
/
├── index.html                    首頁
├── works/index.html              影像作品
├── services/index.html           服務項目
├── about/index.html              關於我們
├── contact/index.html            聯繫我們
├── assets/
│   ├── css/style.css             全站樣式（改顏色看檔案最上方的變數）
│   ├── js/sheet.js               ★ Google Sheet 網址填在這裡
│   ├── js/main.js                手機版選單開合、hero 影片載入
│   ├── img/                      logo、favicon、分享圖、hero 底圖
│   └── video/                    ★ 首頁 hero 背景影片放這裡（見該資料夾 README.txt）
├── sheet-template.csv            works 工作表範本
├── sheet-template-clients.csv    clients 工作表範本
├── sitemap.xml / robots.txt      給搜尋引擎看的
├── SPEC.md                       當初的建置規格
└── README.md                     本說明
```

---

## 2. 用 Google Sheet 管理作品集與客戶（最重要）

### 2-1　建立試算表

1. 開一份新的 Google 試算表，命名例如「有所耳聞 — 網站後台」。
2. 下方分頁改成兩個，名稱分別是 **`works`** 與 **`clients`**。
3. 把本專案的 `sheet-template.csv` 內容貼進 `works` 分頁、
   `sheet-template-clients.csv` 貼進 `clients` 分頁
   （試算表選單：**檔案 → 匯入 → 上傳**，匯入位置選「取代目前工作表」）。

**`works` 分頁欄位**（第一列必須是這些欄位名稱，順序可換、大小寫不拘）

| 欄位 | 說明 | 範例 |
|---|---|---|
| `category` | 分類名稱，同名的會自動聚成一區 | `活動紀錄｜精華影片` |
| `title` | 作品標題 | `2025 品牌發表會精華` |
| `youtube` | YouTube 完整網址或純影片 ID 都可以 | `https://youtu.be/dMENKQu6ULI` |
| `order` | 排序，數字小的排前面（可留空） | `1` |
| `show` | `TRUE` 顯示、`FALSE` 隱藏（留空＝顯示） | `TRUE` |

> 分類的排列順序＝該分類在試算表中**第一次出現**的順序。
> 想把某個分類移到最前面，就把它的第一列往上搬。

**`clients` 分頁欄位**

| 欄位 | 說明 |
|---|---|
| `name` | 客戶／品牌名稱（必填） |
| `logo` | logo 圖片網址，留空就只顯示文字 |
| `show` | `TRUE` / `FALSE` |

### 2-2　把兩個分頁「發布到網路」為 CSV

**每個分頁都要做一次**，兩個分頁的網址不一樣。

1. 在試算表選單點 **檔案 → 共用 → 發布到網路**。
2. 對話框左邊的下拉選單，選 **`works`**（不要選「整份文件」）。
3. 右邊的下拉選單選 **「逗號分隔值 (.csv)」**。
4. 按 **發布**，跳出確認視窗按 **確定**。
5. 複製它給你的網址，長得像：
   ```
   https://docs.google.com/spreadsheets/d/e/2PACX-1vRxxxxxxxxxxxx/pub?gid=0&single=true&output=csv
   ```
6. **重複步驟 1–5**，這次左邊下拉選 **`clients`**，複製第二個網址
   （注意兩個網址的 `gid=` 數字會不同，別貼錯）。

### 2-3　把網址填進程式

打開 `assets/js/sheet.js`，最上面有這段，把兩個網址貼進單引號中間：

```js
const SHEET_URLS = {
  works:   'https://docs.google.com/spreadsheets/d/e/2PACX-.../pub?gid=0&single=true&output=csv',
  clients: 'https://docs.google.com/spreadsheets/d/e/2PACX-.../pub?gid=123456&single=true&output=csv',
};
```

存檔，重新上傳網站（見第 5 節）。**這個步驟只要做一次**，之後就都在試算表裡改。

### 2-4　之後怎麼更新內容

在試算表新增／修改／刪除一列 → **重新整理網頁即生效**，不用重新部署。

> ⏱️ 小提醒：Google 發布的 CSV 有時會有 **最多約 5 分鐘的快取延遲**。
> 如果改完沒馬上看到，等幾分鐘再強制重新整理（Mac：`Cmd + Shift + R`）。

### 2-5　抓不到資料會怎樣？

不會壞版。`sheet.js` 抓不到資料時（網址還沒填、斷網、Google 出問題、試算表被取消發布），
網頁會**沿用 HTML 裡面內建的預設內容**——作品頁仍有 10 支影片、客戶區會顯示一行提示文字。
要確認發生什麼事，可在瀏覽器按 F12 打開主控台，會看到類似
`[sheet.js] works 使用內建預設內容：...` 的訊息。

想更新這份「內建預設內容」，直接改 `index.html` 與 `works/index.html` 裡的影片卡即可。

---

## 3. 改文案要動哪個檔

| 想改的東西 | 檔案 |
|---|---|
| 首頁大標、副標、各區塊標題 | `index.html` |
| 六項服務的名稱與說明 | `services/index.html`（首頁卡片同步改 `index.html`） |
| 關於我們的內文 | `about/index.html` |
| 地址／電話／Email／地圖 | `contact/index.html` |
| 頁尾文字、統編、Copyright | **五個 HTML 檔都有一份**，五個都要改（搜尋 `site-footer`） |
| 導覽列項目 | **五個 HTML 檔都有一份**（搜尋 `site-nav`） |
| 顏色、字級、圓角、間距 | `assets/css/style.css` 最上方的 `:root` 變數區 |
| 作品、合作客戶 | 不要改 HTML，改 Google Sheet（見第 2 節） |

> 頁首／頁尾刻意在每頁重複寫死，換取「零建置流程、打開就能改」。
> 全站只有 5 頁，改一次頁尾＝改 5 個檔案，用編輯器的「全資料夾取代」很快。

搜尋引擎相關：每頁 `<head>` 裡的 `<title>`、`<meta name="description">`、
`og:title` / `og:description` 各自獨立，改文案時記得一起更新。

---

## 4. 本機預覽

不能直接雙擊開 HTML（那樣是 `file://`，路徑 `/assets/...` 會失效）。
在專案資料夾開終端機，執行任一行：

```bash
python3 -m http.server 8080      # macOS 內建，不用裝東西
npx serve .                      # 有 Node.js 的話
```

然後瀏覽 <http://localhost:8080/>。

---

## 5. 部署上線

### Cloudflare Pages（建議）

1. 把整個資料夾推上 GitHub（或用 Cloudflare 的「Direct Upload」直接拖曳資料夾）。
2. Cloudflare Dashboard → **Workers & Pages → Create → Pages**。
3. 選好 repo 後，建置設定**全部留空**：
   - Framework preset：`None`
   - Build command：**留空**
   - Build output directory：`/`
4. 部署完成會得到 `xxx.pages.dev` 網址，先用它確認一切正常。
5. 確認無誤後在 **Custom domains** 綁上 `everheardmedia.com`，
   並把網域 DNS 換成 Cloudflare 指定的紀錄（原主機的 WordPress 可保留幾天當備援再關閉）。

### Netlify

拖曳整個資料夾到 <https://app.netlify.com/drop> 即可，同樣不需要建置指令。

### GitHub Pages

Repo → Settings → Pages → Source 選 `main` 分支的 `/ (root)`。

> 三種平台都會自動把 `/works/index.html` 對應到網址 `/works/`，
> 與原本 WordPress 的網址完全一致，舊連結與 SEO 不會斷。

---

## 6. 目前待補（TODO）

網站可以直接上線，以下是建議後續補齊的項目（都已在頁面上標註）：

- [ ] **`assets/js/sheet.js` 填入兩個 CSV 網址**（沒填會一直用內建預設內容）
- [x] **作品標題與分類**：目前 10 支影片沿用原站的真實影片，但原站沒有標題與分類，
      現在的標題（如「活動紀錄精華 01」）是暫定的，請在 Sheet 的 `works` 分頁改成正式名稱
- [x] **合作客戶名單**：原站沒有可直接沿用的名單，請在 `clients` 分頁填入
- [ ] **關於我們**內文：原站此頁是空的，目前是暫定文案，可補團隊介紹與成立年份
- [x] **LINE 官方帳號連結**：`contact/index.html` 已預留位置
- [x] **Hero 背景影片** `assets/video/hero.mp4`：目前尚未提供，首頁自動顯示底圖
      `assets/img/home-hero-bg.jpg`，版面不會壞。把 mp4 放進資料夾即會自動循環播放，
      規格建議見 `assets/video/README.txt`（手機不會下載這支影片）
- [ ] **分享縮圖** `assets/img/og-image.jpg`：目前是自動產生的文字卡，
      可換成代表作的劇照（尺寸 1200×630）

---

## 7. 未來可加的功能

- **聯絡表單**：目前刻意不做（原站也沒有）。要加的話接 [Formspree](https://formspree.io/)，
  免費額度足夠，在 `contact/index.html` 加一個 `<form action="https://formspree.io/f/xxxx" method="POST">` 即可。
- **線上預約**：嵌 Calendly 或 SimplyBook 的 iframe。
- **更多頁面**：複製任一個現有頁面的資料夾，改內容、更新導覽列與 `sitemap.xml`。
