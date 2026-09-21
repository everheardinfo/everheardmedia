/* ==========================================================================
   sheet.js — 用 Google Sheet 當網站後台
   --------------------------------------------------------------------------
   運作方式：
     1. 到 Google Sheet 的「檔案 → 共用 → 發布到網路」，
        分別把 works 與 clients 兩個工作表發布為「逗號分隔值 (.csv)」。
     2. 把 Google 給的兩個網址貼到下面 SHEET_URLS 裡。
     3. 網頁載入時會抓這兩份 CSV，蓋掉 HTML 內建的預設內容。
        抓不到（沒設定、斷網、Google 掛掉）就沿用 HTML 內建內容，畫面不會壞。
   （詳細圖文步驟見 README.md）
   ========================================================================== */

/* ===== 只需要改這裡 ======================================================== */
const SHEET_URLS = {
  // works 工作表的 CSV 發布網址
  works: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQmC7NS61sgE2cjafVEh3-rMfiA570Zt5_QELoG6selEa5-FMlOFrOmZxRqjcvzcwmCrwW1e1BOYNzP/pub?gid=0&single=true&output=csv',

  // clients 工作表的 CSV 發布網址（gid 與 works 不同）
  clients: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQmC7NS61sgE2cjafVEh3-rMfiA570Zt5_QELoG6selEa5-FMlOFrOmZxRqjcvzcwmCrwW1e1BOYNzP/pub?gid=1933858924&single=true&output=csv',

  // content 工作表（全站單一文案 key/text）的 CSV 發布網址
  content: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQmC7NS61sgE2cjafVEh3-rMfiA570Zt5_QELoG6selEa5-FMlOFrOmZxRqjcvzcwmCrwW1e1BOYNzP/pub?gid=831834139&single=true&output=csv',

  // services 工作表（服務清單：一列一個服務）的 CSV 發布網址
  services: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQmC7NS61sgE2cjafVEh3-rMfiA570Zt5_QELoG6selEa5-FMlOFrOmZxRqjcvzcwmCrwW1e1BOYNzP/pub?gid=998310676&single=true&output=csv',

  // values 工作表（理念卡清單：一列一張卡）的 CSV 發布網址
  values: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQmC7NS61sgE2cjafVEh3-rMfiA570Zt5_QELoG6selEa5-FMlOFrOmZxRqjcvzcwmCrwW1e1BOYNzP/pub?gid=582755197&single=true&output=csv',
  
  //photo_albums 工作表的 CSV 發布網址
  photo_albums: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQmC7NS61sgE2cjafVEh3-rMfiA570Zt5_QELoG6selEa5-FMlOFrOmZxRqjcvzcwmCrwW1e1BOYNzP/pub?gid=811348005&single=true&output=csv'
};
/* ========================================================================== */

(function () {
  'use strict';

  /* ---------------------------------------------------------------------
     CSV 解析（支援引號包裹的欄位、欄位內逗號、跳脫的雙引號、CRLF）
     --------------------------------------------------------------------- */
  function parseCSV(text) {
    const rows = [];
    let row = [], field = '', inQuotes = false;
    const src = text.replace(/^﻿/, ''); // 去掉 BOM

    for (let i = 0; i < src.length; i++) {
      const ch = src[i];
      if (inQuotes) {
        if (ch === '"') {
          if (src[i + 1] === '"') { field += '"'; i++; } // "" → 一個雙引號
          else inQuotes = false;
        } else field += ch;
      } else if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        row.push(field); field = '';
      } else if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && src[i + 1] === '\n') i++;
        row.push(field); rows.push(row); row = []; field = '';
      } else field += ch;
    }
    if (field !== '' || row.length) { row.push(field); rows.push(row); }
    return rows.filter(r => r.some(c => c.trim() !== ''));
  }

  /** 把 CSV 轉成物件陣列，第一列當欄位名（小寫、去空白）。 */
  function toObjects(rows) {
    if (!rows.length) return [];
    const head = rows[0].map(h => h.trim().toLowerCase());
    return rows.slice(1).map(cols => {
      const o = {};
      head.forEach((key, i) => { o[key] = (cols[i] || '').trim(); });
      return o;
    });
  }

  /** show 欄位：留空或 TRUE / 1 / yes 都算顯示，只有明確的 FALSE 才隱藏。 */
  function isVisible(row) {
    const v = String(row.show || '').trim().toLowerCase();
    return v === '' || v === 'true' || v === '1' || v === 'yes' || v === 'y';
  }

  /** 從 YouTube 網址或純 ID 取出影片 ID。 */
  function youtubeId(input) {
    const raw = String(input || '').trim();
    if (!raw) return '';
    if (/^[\w-]{11}$/.test(raw)) return raw;               // 已經是純 ID
    const m = raw.match(
      /(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/|v\/))([\w-]{11})/
    );
    return m ? m[1] : '';
  }

  const PLAY_ICON =
    '<span class="lite-yt__play" aria-hidden="true">' +
    '<svg viewBox="0 0 68 48" focusable="false">' +
    '<path class="yt-bg" d="M66.5 7.7a8.6 8.6 0 0 0-6-6C55.2 0 34 0 34 0S12.8 0 7.5 1.6a8.6 8.6 0 0 0-6 6A90 90 0 0 0 0 24a90 90 0 0 0 1.5 16.3 8.6 8.6 0 0 0 6 6C12.8 48 34 48 34 48s21.2 0 26.5-1.7a8.6 8.6 0 0 0 6-6A90 90 0 0 0 68 24a90 90 0 0 0-1.5-16.3z"/>' +
    '<path class="yt-tri" d="M27 34V14l18 10z"/>' +
    '</svg></span>';

  /* ---------------------------------------------------------------------
     渲染小工具
     --------------------------------------------------------------------- */
  function el(tag, className, html) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (html != null) node.innerHTML = html;
    return node;
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, c => (
      { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    ));
  }

  /** 建立一張「點擊才載入」的影片卡。 */
  function videoCard(item, showCategory) {
    const card = el('article', 'video-card');
    const title = item.title || '影像作品';
    const safeTitle = escapeHtml(title);

    const btn = el('button', 'lite-yt');
    btn.type = 'button';
    btn.setAttribute('data-yt-id', item.id);
    btn.setAttribute('aria-label', '播放影片：' + title);
    btn.innerHTML =
      '<img src="https://i.ytimg.com/vi/' + item.id + '/hqdefault.jpg" ' +
      'alt="' + safeTitle + ' — 影片縮圖" loading="lazy" width="480" height="360">' +
      PLAY_ICON;

    card.appendChild(btn);
    card.appendChild(el('h3', 'video-card__title', safeTitle));
    if (showCategory && item.category) {
      card.appendChild(el('p', 'video-card__cat', escapeHtml(item.category)));
    }
    return card;
  }

  /* ---------------------------------------------------------------------
     lite embed：點擊縮圖才換成 iframe（全站委派，fallback 內容也適用）
     --------------------------------------------------------------------- */
  document.addEventListener('click', function (e) {
    const btn = e.target.closest ? e.target.closest('.lite-yt') : null;
    if (!btn || btn.dataset.loaded === '1') return;
    const id = btn.getAttribute('data-yt-id');
    if (!id) return;

    btn.dataset.loaded = '1';
    const iframe = document.createElement('iframe');
    iframe.src = 'https://www.youtube-nocookie.com/embed/' + id +
                 '?autoplay=1&rel=0&modestbranding=1';
    iframe.title = btn.getAttribute('aria-label') || 'YouTube 影片';
    iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; ' +
                   'gyroscope; picture-in-picture; web-share';
    iframe.allowFullscreen = true;
    btn.innerHTML = '';
    btn.appendChild(iframe);
  });

  /* ---------------------------------------------------------------------
     資料整理
     --------------------------------------------------------------------- */
  function normalizeWorks(rows) {
    return rows
      .filter(isVisible)
      .map(r => ({
        category: (r.category || '精選作品').trim(),
        title: (r.title || '').trim(),
        id: youtubeId(r.youtube),
        order: r.order === '' || r.order == null ? Infinity : Number(r.order),
      }))
      .filter(w => w.id)
      .map(w => ({ ...w, order: isNaN(w.order) ? Infinity : w.order }));
  }

  /** 依分類分組；分類順序 = Sheet 中首次出現的順序，組內依 order 排序。 */
  function groupWorks(items) {
    const groups = [];
    const index = new Map();
    items.forEach(item => {
      if (!index.has(item.category)) {
        index.set(item.category, groups.length);
        groups.push({ category: item.category, items: [] });
      }
      groups[index.get(item.category)].items.push(item);
    });
    groups.forEach(g => g.items.sort((a, b) => a.order - b.order));
    return groups;
  }

  /** 依 order 排序的扁平清單（首頁預覽用）。 */
  function flatSorted(items) {
    return items.slice().sort((a, b) => a.order - b.order);
  }

  /* ---------------------------------------------------------------------
     各區塊渲染
     --------------------------------------------------------------------- */
  function renderWorksList(container, groups) {
    container.innerHTML = '';
    groups.forEach(group => {
      const section = el('section', 'works-group');
      section.setAttribute('data-category', group.category);

      const h2 = el('h2', 'works-group__title', escapeHtml(group.category));
      h2.appendChild(el('span', 'works-group__count', group.items.length + ' 部作品'));
      section.appendChild(h2);

      const grid = el('div', 'grid grid--works');
      group.items.forEach(item => grid.appendChild(videoCard(item, false)));
      section.appendChild(grid);
      container.appendChild(section);
    });
  }

  function renderFilters(container, groups) {
    if (!container) return;
    container.innerHTML = '';
    const make = (label, value, pressed) => {
      const b = el('button', 'filter-btn', escapeHtml(label));
      b.type = 'button';
      b.setAttribute('data-filter', value);
      b.setAttribute('aria-pressed', pressed ? 'true' : 'false');
      return b;
    };
    container.appendChild(make('全部作品', '*', true));
    groups.forEach(g => container.appendChild(make(g.category, g.category, false))
   );

     /* 平面攝影：獨立作品頁 */
const photoLink = document.createElement('a');

photoLink.className = 'filter-btn photo-link';
photoLink.href = './photography/';
photoLink.textContent = '平面攝影';

container.appendChild(photoLink);     
  }

  function renderWorksPreview(container, items) {
    const limit = Number(container.getAttribute('data-limit')) || 6;
    container.innerHTML = '';
    flatSorted(items).slice(0, limit)
      .forEach(item => container.appendChild(videoCard(item, true)));
  }

  function renderClients(containers, rows) {
    const list = rows.filter(isVisible)
      .map(r => ({ name: (r.name || '').trim(), logo: (r.logo || '').trim() }))
      .filter(c => c.name);
    if (!list.length) return; // 沒資料就讓整個區塊維持隱藏

    // 有資料才顯示合作客戶區塊
    document.querySelectorAll('[data-clients-section]')
      .forEach(s => s.removeAttribute('hidden'));

    containers.forEach(container => {
      container.className = 'clients';
      container.innerHTML = '';
      list.forEach(c => {
        const item = el('div', 'client');
        item.innerHTML = c.logo
          ? '<img src="' + escapeHtml(c.logo) + '" alt="' + escapeHtml(c.name) +
            ' logo" loading="lazy">'
          : escapeHtml(c.name);
        item.title = c.name;
        container.appendChild(item);
      });
    });
  }

  /* ---------------------------------------------------------------------
     分類篩選（事件委派，重繪按鈕後仍有效；fallback 靜態內容也適用）
     --------------------------------------------------------------------- */
  function initFilters() {
    const bar = document.querySelector('[data-works-filters]');
    const list = document.querySelector('[data-works-list]');
    if (!bar || !list) return;

    bar.addEventListener('click', function (e) {
      const btn = e.target.closest('.filter-btn');
      if (!btn) return;
      const value = btn.getAttribute('data-filter');

      bar.querySelectorAll('.filter-btn').forEach(b => {
        b.setAttribute('aria-pressed', b === btn ? 'true' : 'false');
      });
      list.querySelectorAll('.works-group').forEach(g => {
        const match = value === '*' || g.getAttribute('data-category') === value;
        g.hidden = !match;
      });
    });
  }

  /* ---------------------------------------------------------------------
     抓資料
     --------------------------------------------------------------------- */
  function fetchCSV(url) {
    if (!url) return Promise.reject(new Error('尚未設定 CSV 網址'));
    return fetch(url, { cache: 'no-store' })
      .then(res => {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.text();
      })
      .then(text => toObjects(parseCSV(text)));
  }

  function loadWorks() {
    const listEl = document.querySelector('[data-works-list]');
    const previewEl = document.querySelector('[data-works-preview]');
    const filtersEl = document.querySelector('[data-works-filters]');
    if (!listEl && !previewEl) return;

    fetchCSV(SHEET_URLS.works)
      .then(rows => {
        const items = normalizeWorks(rows);
        if (!items.length) throw new Error('works 工作表沒有可顯示的資料');
        if (listEl) {
          const groups = groupWorks(items);
          renderWorksList(listEl, groups);
          renderFilters(filtersEl, groups);
        }
        if (previewEl) renderWorksPreview(previewEl, items);
      })
      .catch(err => {
        // 保留 HTML 內建的 fallback 內容
        console.info('[sheet.js] works 使用內建預設內容：' + err.message);
      });
  }

  function loadClients() {
    const containers = Array.prototype.slice.call(
      document.querySelectorAll('[data-clients-list]')
    );
    if (!containers.length) return;

    fetchCSV(SHEET_URLS.clients)
      .then(rows => renderClients(containers, rows))
      .catch(err => {
        console.info('[sheet.js] clients 使用內建預設內容：' + err.message);
      });
  }

  /* ---------------------------------------------------------------------
     全站文案（content 工作表：key / text）
     HTML 內建文字為備援；Sheet 有值就覆蓋。text 內的換行會轉成 <br>。
     --------------------------------------------------------------------- */

  /** 以純文字設定元素內容，\n 轉為換行。 */
  function setText(el, value) {
    el.textContent = '';
    String(value).split('\n').forEach((line, i) => {
      if (i) el.appendChild(document.createElement('br'));
      el.appendChild(document.createTextNode(line));
    });
  }

  // key → 選擇器（單一元素、跨頁通用）。頁面上不存在就自動略過。
  var CONTENT_TARGETS = {
    hero_eyebrow:  '.hero__eyebrow',
    hero_sub:      '.hero__sub',
    works_title:   '#works .block-head__title',
    works_meta:    '#works .block-head__meta',
    services_title:'.svc-split__title',
    services_sub:  '.svc-split__sub',
    cta_text_main: null, // 由 applyCta 特別處理
    cta_badge:     '.cta__badge',
    cta_button:    '.cta .btn',
  };

  function applyContent(rows) {
    var map = {};
    rows.forEach(function (r) {
      // 欄位名稱同時支援中文（說明/文字/代號）與英文（key/text）
      var k = (r['代號'] || r.key || '').trim();
      var v = String(r['文字'] || r.text || '').trim();
      // Sheets 的公式錯誤值（#ERROR!、#REF!…）一律當成沒填
      if (/^#(ERROR|REF|N\/A|VALUE|NAME|DIV)/i.test(v)) v = '';
      if (k && v) map[k] = v;
    });
    if (!Object.keys(map).length) return;

    // 1. data-t 屬性（最優先）
    document.querySelectorAll('[data-t]').forEach(function (el) {
      var v = map[el.getAttribute('data-t')];
      if (v) setText(el, v);
    });

    // 2. 選擇器對照表
    Object.keys(CONTENT_TARGETS).forEach(function (k) {
      var sel = CONTENT_TARGETS[k];
      if (!sel || !map[k]) return;
      document.querySelectorAll(sel).forEach(function (el) { setText(el, map[k]); });
    });

    // 3. 首頁 hero 大標（主文 + 亮藍字）
    var heroTitle = document.querySelector('.hero__title');
    if (heroTitle && (map.hero_title_main || map.hero_title_accent)) {
      heroTitle.textContent = '';
      setText(heroTitle, map.hero_title_main || '用影像，\n讓品牌');
      var hAccent = el('span', 'accent', '');
      setText(hAccent, map.hero_title_accent || '被看見');
      heroTitle.appendChild(hAccent);
    }

    // 4. CTA 大標（前段 + 亮藍字 + 後段），出現在每一頁
    if (map.cta_title_pre || map.cta_title_accent || map.cta_title_post) {
      document.querySelectorAll('.cta__title').forEach(function (t) {
        t.textContent = '';
        setText(t, map.cta_title_pre || '準備開始你的');
        t.appendChild(document.createElement('br'));
        var cAccent = el('span', 'accent', '');
        setText(cAccent, map.cta_title_accent || '影像專案');
        t.appendChild(cAccent);
        t.appendChild(document.createTextNode(map.cta_title_post || '了嗎？'));
      });
    }

    // 5. CTA 說明文字（內含 badge span，需保留）
    if (map.cta_text) {
      document.querySelectorAll('.cta__text').forEach(function (p) {
        var badge = p.querySelector('.cta__badge');
        p.textContent = '';
        setText(p, map.cta_text);
        if (badge) {
          if (map.cta_badge) setText(badge, map.cta_badge);
          p.appendChild(badge);
        }
      });
    }

    // 6. 聯絡頁三張資訊卡（依序：地址、Email、電話；只換顯示文字，連結不動）
    var contactKeys = ['contact_address', 'contact_email', 'contact_phone'];
    document.querySelectorAll('.contact-item__value').forEach(function (elv, i) {
      if (map[contactKeys[i]]) setText(elv, map[contactKeys[i]]);
    });

    // 9. Footer 資訊列（依序：公司名｜統編、地址、電話、Email）
    var footerKeys = ['footer_company', 'footer_address', 'footer_phone', 'footer_email'];
    document.querySelectorAll('.footer__row > *').forEach(function (elv, i) {
      if (map[footerKeys[i]]) setText(elv, map[footerKeys[i]]);
    });
  }

  function loadContent() {
    fetchCSV(SHEET_URLS.content)
      .then(applyContent)
      .catch(function (err) {
        console.info('[sheet.js] content 使用內建預設文案：' + err.message);
      });
  }

  /* ---------------------------------------------------------------------
     服務清單（services 工作表：一列一個服務；欄位可用中文或英文）
     --------------------------------------------------------------------- */
  function rowShown(r) {
    var s = String(r['顯示'] != null ? r['顯示'] : (r.show != null ? r.show : '')).trim().toUpperCase();
    return s !== 'FALSE' && s !== '0' && s !== '否';
  }
  function rowOrder(r) {
    var n = parseFloat(r['排序'] != null ? r['排序'] : r.order);
    return isNaN(n) ? 9999 : n;
  }
  function pad2(n) { return (n < 10 ? '0' : '') + n; }

  function renderServices(rows) {
    var lists = document.querySelectorAll('.svc-list');
    if (!lists.length) return;
    var items = rows.filter(rowShown)
      .map(function (r) {
        return {
          name: String(r['服務名稱'] || r['名稱'] || r.name || '').trim(),
          desc: String(r['服務說明'] || r['說明'] || r.desc || '').trim(),
          order: rowOrder(r),
        };
      })
      .filter(function (i) { return i.name; })
      .sort(function (a, b) { return a.order - b.order; });
    if (!items.length) return;

    lists.forEach(function (list) {
      var first = list.querySelector('.svc-row');
      var href = first && first.getAttribute('href');
      list.innerHTML = '';
      items.forEach(function (it, i) {
        var row = document.createElement(href ? 'a' : 'div');
        row.className = 'svc-row';
        if (href) row.setAttribute('href', href);
        var num = el('span', 'svc-row__num', pad2(i + 1));
        var name = document.createElement('h3');
        name.className = 'svc-row__name';
        setText(name, it.name);
        var desc = el('span', 'svc-row__desc', '');
        setText(desc, it.desc);
        row.appendChild(num); row.appendChild(name); row.appendChild(desc);
        list.appendChild(row);
      });
    });
  }

  function loadServices() {
    if (!document.querySelector('.svc-list')) return;
    fetchCSV(SHEET_URLS.services)
      .then(renderServices)
      .catch(function (err) {
        console.info('[sheet.js] services 使用內建預設內容：' + err.message);
      });
  }

  /* ---------------------------------------------------------------------
     理念卡清單（values 工作表：一列一張卡）
     --------------------------------------------------------------------- */
  function renderValues(rows) {
    var lists = document.querySelectorAll('.value-list');
    if (!lists.length) return;
    var items = rows.filter(rowShown)
      .map(function (r) {
        return {
          title: String(r['標題'] || r.title || '').trim(),
          text: String(r['內容'] || r.text || '').trim(),
          order: rowOrder(r),
        };
      })
      .filter(function (i) { return i.title; })
      .sort(function (a, b) { return a.order - b.order; });
    if (!items.length) return;

    lists.forEach(function (list) {
      list.innerHTML = '';
      items.forEach(function (it) {
        var card = document.createElement('article');
        card.className = 'card';
        var t = document.createElement('h3');
        t.className = 'card__title';
        setText(t, it.title);
        var x = document.createElement('p');
        x.className = 'card__text';
        setText(x, it.text);
        card.appendChild(t); card.appendChild(x);
        list.appendChild(card);
      });
    });
  }

  function loadValues() {
    if (!document.querySelector('.value-list')) return;
    fetchCSV(SHEET_URLS.values)
      .then(renderValues)
      .catch(function (err) {
        console.info('[sheet.js] values 使用內建預設內容：' + err.message);
      });
  }

  function init() {
    initFilters();
    loadContent();
    loadServices();
    loadValues();
    loadWorks();
    loadClients();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
