/* =========================================================
   Photography｜平面攝影作品列表
========================================================= */

(function () {
  'use strict';

  /* 1. photo_albums 的 Google Sheet CSV 網址
     請把下面替換成你自己的 CSV 網址 */
  const PHOTO_ALBUMS_CSV_URL =
    'https://docs.google.com/spreadsheets/d/e/2PACX-1vQmC7NS61sgE2cjafVEh3-rMfiA570Zt5_QELoG6selEa5-FMlOFrOmZxRqjcvzcwmCrwW1e1BOYNzP/pub?gid=811348005&single=true&output=csv';


  /* 2. Google Drive Apps Script API */
  const DRIVE_API_URL =
    'https://script.google.com/macros/s/AKfycbzotwmQP9U2Vzqg9nsy3MzpuNPLzP3IUSY1uG_qY0InLyjNZRhbgNKyGyyOfQ9e4wQ2/exec';


  /* ---------------------------------------------------------
     CSV 解析
  --------------------------------------------------------- */
  function parseCSV(text) {
    const rows = [];
    let row = [];
    let field = '';
    let inQuotes = false;

    const src = text.replace(/^\uFEFF/, '');

    for (let i = 0; i < src.length; i++) {
      const ch = src[i];

      if (inQuotes) {
        if (ch === '"') {
          if (src[i + 1] === '"') {
            field += '"';
            i++;
          } else {
            inQuotes = false;
          }
        } else {
          field += ch;
        }
      } else {
        if (ch === '"') {
          inQuotes = true;
        } else if (ch === ',') {
          row.push(field);
          field = '';
        } else if (ch === '\n' || ch === '\r') {
          if (ch === '\r' && src[i + 1] === '\n') i++;

          row.push(field);
          rows.push(row);

          row = [];
          field = '';
        } else {
          field += ch;
        }
      }
    }

    if (field !== '' || row.length) {
      row.push(field);
      rows.push(row);
    }

    return rows;
  }


  function rowsToObjects(rows) {
    if (!rows.length) return [];

    const headers = rows[0].map(function (h) {
      return h.trim().toLowerCase();
    });

    return rows.slice(1).map(function (cols) {
      const item = {};

      headers.forEach(function (key, i) {
        item[key] = (cols[i] || '').trim();
      });

      return item;
    });
  }


  /* ---------------------------------------------------------
     show 欄位判斷
  --------------------------------------------------------- */
  function isVisible(value) {
    const v = String(value || '').trim().toLowerCase();

    return (
      v === 'true' ||
      v === '1' ||
      v === 'yes' ||
      v === 'y'
    );
  }


  /* ---------------------------------------------------------
     取得某個 Google Drive 活動資料夾內的照片
  --------------------------------------------------------- */
  async function getDriveImages(folderId) {
    const url =
      DRIVE_API_URL +
      '?folder=' +
      encodeURIComponent(folderId);

    const response = await fetch(url, {
      cache: 'no-store'
    });

    if (!response.ok) {
      throw new Error('Drive API HTTP ' + response.status);
    }

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error || '無法讀取 Google Drive');
    }

    return data.images || [];
  }


  /* ---------------------------------------------------------
     找活動封面

     cover 空白：
     → 自動用 001.webp

     cover 填入例如 018.webp：
     → 使用指定圖片
  --------------------------------------------------------- */
  async function getAlbumCover(album) {
    if (!album.folder_id) return '';

    const images = await getDriveImages(album.folder_id);

    if (!images.length) return '';

    if (album.cover) {
      const wanted = album.cover.trim().toLowerCase();

      const matched = images.find(function (image) {
        return image.name.toLowerCase() === wanted;
      });

      if (matched) return matched.imageUrl;
    }

    return images[0].imageUrl;
  }


  /* ---------------------------------------------------------
     建立一張活動卡片
  --------------------------------------------------------- */
  async function createAlbumCard(album) {
    const link = document.createElement('a');

    link.className = 'photo-project';
    link.href =
      'gallery.html?album=' +
      encodeURIComponent(album.id);

    const imageWrap = document.createElement('div');
    imageWrap.className = 'photo-project__image';

    const img = document.createElement('img');

    img.alt = album.title || '平面攝影作品';
    img.loading = 'lazy';
    img.decoding = 'async';

    try {
      const coverUrl = await getAlbumCover(album);

      if (coverUrl) {
        img.src = coverUrl;
      }
    } catch (error) {
      console.error(
        '[Photography] 封面讀取失敗：',
        album.title,
        error
      );
    }

    imageWrap.appendChild(img);


    const info = document.createElement('div');
    info.className = 'photo-project__info';


    const title = document.createElement('h2');
    title.className = 'photo-project__title';
    title.textContent =
      album.title || '未命名活動';


    const meta = document.createElement('p');
    meta.className = 'photo-project__meta';
    meta.textContent = album.date || '';


    info.appendChild(title);

    if (album.date) {
      info.appendChild(meta);
    }

    link.appendChild(imageWrap);
    link.appendChild(info);

    return link;
  }


  /* ---------------------------------------------------------
     載入活動列表
  --------------------------------------------------------- */
  async function loadPhotographyProjects() {
    const container =
      document.getElementById('photo-projects');

    if (!container) return;


    if (
      !PHOTO_ALBUMS_CSV_URL ||
      PHOTO_ALBUMS_CSV_URL.includes('請貼上')
    ) {
      container.innerHTML =
        '<p>尚未設定 photo_albums CSV 網址。</p>';

      return;
    }


    try {
      const response = await fetch(
        PHOTO_ALBUMS_CSV_URL,
        {
          cache: 'no-store'
        }
      );

      if (!response.ok) {
        throw new Error(
          'Google Sheet HTTP ' +
          response.status
        );
      }


      const text = await response.text();

      const albums =
        rowsToObjects(parseCSV(text))
          .filter(function (album) {
            return (
              isVisible(album.show) &&
              album.id &&
              album.folder_id
            );
          })
          .sort(function (a, b) {
            return (
              Number(a.order || 9999) -
              Number(b.order || 9999)
            );
          });


      if (!albums.length) {
        container.innerHTML =
          '<p>目前沒有攝影作品。</p>';

        return;
      }


      container.innerHTML = '';


      for (const album of albums) {
        const card =
          await createAlbumCard(album);

        container.appendChild(card);
      }


    } catch (error) {
      console.error(
        '[Photography] 載入失敗：',
        error
      );

      container.innerHTML =
        '<p>作品載入失敗，請稍後再試。</p>';
    }
  }


  /* ---------------------------------------------------------
     啟動
  --------------------------------------------------------- */
  if (document.readyState === 'loading') {
    document.addEventListener(
      'DOMContentLoaded',
      loadPhotographyProjects
    );
  } else {
    loadPhotographyProjects();
  }

})();
