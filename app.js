/* app.js — client-side single-page app using IndexedDB for storage.
   - Login with DOB (session)
   - Upload image/video with caption
   - Store media as blob + metadata in IndexedDB
   - Create share code mapping to a set of file IDs
   - View shared gallery by entering code
*/

(() => {
  // ----- Helpers -----
  const el = id => document.getElementById(id);
  const qs = sel => document.querySelector(sel);
  const show = (el) => el.hidden = false;
  const hide = (el) => el.hidden = true;
  const rand = (n=6) => {
    const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
    let s = '';
    for(let i=0;i<n;i++) s += chars[Math.floor(Math.random()*chars.length)];
    return s;
  };

  // ----- IndexedDB wrapper -----
  const DB_NAME = 'mediashare-db-v1';
  const DB_VERSION = 1;
  let db = null;

  function openDB() {
    return new Promise((resolve, reject) => {
      if (db) return resolve(db);
      const rq = indexedDB.open(DB_NAME, DB_VERSION);
      rq.onupgradeneeded = (e) => {
        const d = e.target.result;
        if (!d.objectStoreNames.contains('files')) {
          const store = d.createObjectStore('files', { keyPath: 'id' });
          store.createIndex('owner', 'owner');
          store.createIndex('createdAt', 'createdAt');
        }
        if (!d.objectStoreNames.contains('shares')) {
          d.createObjectStore('shares', { keyPath: 'code' });
        }
      };
      rq.onsuccess = (e) => { db = e.target.result; resolve(db); };
      rq.onerror = (e) => reject(e.target.error);
    });
  }

  function idbPut(storeName, value) {
    return openDB().then(d => new Promise((res, rej) => {
      const tx = d.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const rq = store.put(value);
      rq.onsuccess = () => res(rq.result);
      rq.onerror = () => rej(rq.error);
    }));
  }

  function idbGet(storeName, key) {
    return openDB().then(d => new Promise((res, rej) => {
      const tx = d.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const rq = store.get(key);
      rq.onsuccess = () => res(rq.result);
      rq.onerror = () => rej(rq.error);
    }));
  }

  function idbDelete(storeName, key) {
    return openDB().then(d => new Promise((res, rej) => {
      const tx = d.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const rq = store.delete(key);
      rq.onsuccess = () => res(true);
      rq.onerror = () => rej(rq.error);
    }));
  }

  function idbGetAllByIndex(storeName, indexName, key) {
    return openDB().then(d => new Promise((res, rej) => {
      const tx = d.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const idx = store.index(indexName);
      const rq = idx.getAll(key);
      rq.onsuccess = () => res(rq.result || []);
      rq.onerror = () => rej(rq.error);
    }));
  }

  function idbGetAll(storeName) {
    return openDB().then(d => new Promise((res, rej) => {
      const tx = d.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const rq = store.getAll();
      rq.onsuccess = () => res(rq.result || []);
      rq.onerror = () => rej(rq.error);
    }));
  }

  // ----- App state -----
  let session = {
    ownerId: null, // unique identifier for the logged-in user stored in localStorage
    dob: null
  };

  function loadSession() {
    const owner = sessionStorage.getItem('ms_ownerId');
    const dob = sessionStorage.getItem('ms_dob');
    if (owner && dob) {
      session.ownerId = owner; session.dob = dob; return true;
    }
    return false;
  }

  function saveSession(ownerId, dob) {
    sessionStorage.setItem('ms_ownerId', ownerId);
    sessionStorage.setItem('ms_dob', dob);
    session.ownerId = ownerId; session.dob = dob;
  }

  function clearSession() {
    sessionStorage.removeItem('ms_ownerId');
    sessionStorage.removeItem('ms_dob');
    session.ownerId = null; session.dob = null;
  }

  // ----- UI elements -----
  const loginView = el('login-view');
  const loginForm = el('login-form');
  const dobInput = el('dob');

  const dashboardView = el('dashboard-view');
  const navDashboard = el('nav-dashboard');
  const navView = el('nav-view');
  const navLogout = el('nav-logout');

  const uploadForm = el('upload-form');
  const fileInput = el('file-input');
  const captionInput = el('caption-input');
  const preview = el('preview');
  const previewMedia = el('preview-media');
  const previewCaption = el('preview-caption');

  const createShareBtn = el('create-share');
  const shareResult = el('share-result');
  const shareCodeEl = el('share-code');

  const galleryEl = el('gallery');

  const viewShareSection = el('view-share');
  const viewForm = el('view-form');
  const shareInput = el('share-input');
  const sharedGallerySection = el('shared-gallery-section');
  const sharedGalleryEl = el('shared-gallery');

  // ----- Initialization -----
  function init() {
    openDB().catch(console.error);
    if (loadSession()) {
      showLoggedInUI();
      showView('dashboard');
      refreshGallery();
    } else {
      showView('login');
    }
    attachHandlers();
  }

  // ----- Routing / Views -----
  function showView(name) {
    // name: 'login' | 'dashboard' | 'view'
    if (name === 'login') {
      show(loginView); hide(dashboardView); hide(viewShareSection);
      hide(navDashboard); show(navView); hide(navLogout);
    } else if (name === 'dashboard') {
      hide(loginView); show(dashboardView); hide(viewShareSection);
      show(navDashboard); show(navView); show(navLogout);
    } else if (name === 'view') {
      hide(loginView); hide(dashboardView); show(viewShareSection);
      hide(navDashboard); show(navView); hide(navLogout);
    }
  }

  function showLoggedInUI() {
    navDashboard.hidden = false;
    navLogout.hidden = false;
  }

  function attachHandlers() {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const dob = dobInput.value;
      if (!dob) return alert('Please enter your date of birth.');

      // create or reuse a stored ownerId for this DOB+local context
      // We'll store owner record in localStorage (client-only).
      const key = 'ms_owner_record_' + dob;
      let ownerId = localStorage.getItem(key);
      if (!ownerId) {
        ownerId = 'owner_' + Date.now() + '_' + Math.floor(Math.random()*9999);
        localStorage.setItem(key, ownerId);
      }
      saveSession(ownerId, dob);
      showLoggedInUI();
      showView('dashboard');
      await refreshGallery();
    });

    navDashboard.addEventListener('click', () => showView('dashboard'));
    navView.addEventListener('click', () => showView('view'));
    navLogout.addEventListener('click', () => {
      if (confirm('Logout and clear session? You will remain the owner on this browser, just the session ends.')) {
        clearSession();
        showView('login');
      }
    });

    // preview file when chosen
    fileInput.addEventListener('change', () => {
      const f = fileInput.files[0];
      if (!f) { hide(preview); return; }
      previewMedia.innerHTML = '';
      previewCaption.textContent = captionInput.value || '';
      const url = URL.createObjectURL(f);
      if (f.type.startsWith('image/')) {
        const img = document.createElement('img'); img.src = url; img.alt = f.name;
        previewMedia.appendChild(img);
      } else if (f.type.startsWith('video/')) {
        const v = document.createElement('video'); v.src = url; v.controls = true;
        v.style.maxHeight = '300px';
        previewMedia.appendChild(v);
      } else {
        previewMedia.textContent = 'Preview not available for this type.';
      }
      show(preview);
    });

    captionInput.addEventListener('input', () => {
      previewCaption.textContent = captionInput.value;
      if (captionInput.value.trim()) show(preview);
    });

    uploadForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = fileInput.files[0];
      if (!f) return alert('Choose a file first.');
      if (!session.ownerId) return alert('Please login with your date of birth first.');

      // read file blob and store in IndexedDB
      const id = 'file_' + Date.now() + '_' + Math.floor(Math.random()*9999);
      const owner = session.ownerId;
      const createdAt = new Date().toISOString();
      const caption = captionInput.value || '';
      const blob = f.slice(0, f.size, f.type);

      const record = { id, owner, createdAt, caption, filename: f.name, mime: f.type, blob };
      try {
        await idbPut('files', record);
        fileInput.value = '';
        captionInput.value = '';
        hide(preview);
        await refreshGallery();
      } catch (err) {
        console.error(err);
        alert('Failed to save file: ' + err.message);
      }
    });

    createShareBtn.addEventListener('click', async () => {
      if (!session.ownerId) return alert('Please login first.');
      // gather all file ids for this owner
      const files = await idbGetAllByIndex('files', 'owner', session.ownerId);
      if (!files.length) return alert('You have no uploads to share yet.');
      const ids = files.map(f => f.id);
      // generate a code (avoid collision)
      let code;
      for (let i=0;i<6;i++){
        code = rand(6);
        const existing = await idbGet('shares', code);
        if (!existing) break;
        code = null;
      }
      if (!code) return alert('Could not generate share code. Try again.');
      const entry = { code, owner: session.ownerId, fileIds: ids, createdAt: new Date().toISOString() };
      await idbPut('shares', entry);
      shareCodeEl.textContent = code;
      show(shareResult);
    });

    // gallery actions by owner
    galleryEl.addEventListener('click', async (ev) => {
      const btn = ev.target.closest('button');
      if (!btn) return;
      const id = btn.dataset.id;
      if (btn.classList.contains('delete')) {
        if (!confirm('Delete this item? This cannot be undone.')) return;
        await idbDelete('files', id);
        refreshGallery();
      } else if (btn.classList.contains('edit')) {
        const newCap = prompt('Edit caption:');
        if (newCap === null) return;
        const rec = await idbGet('files', id);
        rec.caption = newCap;
        await idbPut('files', rec);
        refreshGallery();
      }
    });

    // view shared
    viewForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const code = shareInput.value.trim();
      if (!code) return;
      const entry = await idbGet('shares', code);
      sharedGalleryEl.innerHTML = '';
      if (!entry) {
        alert('Share code not found.');
        hide(sharedGallerySection);
        return;
      }
      const filePromises = entry.fileIds.map(id => idbGet('files', id));
      const files = (await Promise.all(filePromises)).filter(Boolean);
      if (!files.length) {
        alert('No items available for this share code.');
        hide(sharedGallerySection);
        return;
      }
      files.sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));
      for (const f of files) {
        const card = await createMediaCard(f, { readOnly: true });
        sharedGalleryEl.appendChild(card);
      }
      show(sharedGallerySection);
    });

    // make navigating simple: allow pressing Enter in share code to submit
  }

  // ----- UI rendering -----
  async function refreshGallery() {
    if (!session.ownerId) return;
    galleryEl.innerHTML = '';
    const files = await idbGetAllByIndex('files', 'owner', session.ownerId);
    files.sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));
    if (!files.length) {
      galleryEl.innerHTML = '<div class="helper">No uploads yet — use the upload form to add images/videos.</div>';
      return;
    }
    for (const f of files) {
      const card = await createMediaCard(f, { readOnly: false });
      galleryEl.appendChild(card);
    }
  }

  async function createMediaCard(fileRecord, opts = { readOnly: false }) {
    const wrapper = document.createElement('div'); wrapper.className = 'card-item';
    const mediaWrap = document.createElement('div');
    const blobURL = URL.createObjectURL(fileRecord.blob);

    if (fileRecord.mime.startsWith('image/')) {
      const img = document.createElement('img'); img.src = blobURL; img.alt = fileRecord.filename;
      mediaWrap.appendChild(img);
    } else if (fileRecord.mime.startsWith('video/')) {
      const v = document.createElement('video'); v.src = blobURL; v.controls = true;
      mediaWrap.appendChild(v);
    } else {
      const span = document.createElement('div'); span.textContent = 'Unsupported media type';
      mediaWrap.appendChild(span);
    }
    wrapper.appendChild(mediaWrap);

    const meta = document.createElement('div'); meta.className = 'meta';
    const caption = document.createElement('div'); caption.className = 'caption'; caption.textContent = fileRecord.caption || '';
    const right = document.createElement('div');

    const small = document.createElement('small'); small.textContent = new Date(fileRecord.createdAt).toLocaleString();

    if (!opts.readOnly) {
      const editBtn = document.createElement('button'); editBtn.textContent = 'Edit'; editBtn.className = 'edit'; editBtn.dataset.id = fileRecord.id;
      const delBtn = document.createElement('button'); delBtn.textContent = 'Delete'; delBtn.className = 'delete'; delBtn.dataset.id = fileRecord.id;
      right.appendChild(editBtn); right.appendChild(delBtn);
    }

    meta.appendChild(caption);
    meta.appendChild(right);
    wrapper.appendChild(meta);
    wrapper.appendChild(small);
    return wrapper;
  }

  // ----- Start the app -----
  init();

})();