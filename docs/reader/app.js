// Reader: a dark-mode PDF reader that keeps files, reading position and notes on the device.
import * as pdfjsLib from './vendor/pdf.min.mjs';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('./vendor/pdf.worker.min.mjs', import.meta.url).href;
const PDF_OPTS = {
  cMapUrl: new URL('./vendor/cmaps/', import.meta.url).href,
  cMapPacked: true,
  standardFontDataUrl: new URL('./vendor/standard_fonts/', import.meta.url).href,
  isEvalSupported: false,
};

const $ = (id) => document.getElementById(id);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const THEMES = [
  ['dark', 'Dark'],
  ['black', 'Black (OLED)'],
  ['sepia', 'Sepia'],
  ['light', 'Original (light)'],
];
const COLORS = ['yellow', 'green', 'blue', 'pink'];

// ---------- Storage (IndexedDB) ----------
function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('dark-reader', 1);
    req.onupgradeneeded = () => {
      const d = req.result;
      d.createObjectStore('files', { keyPath: 'id' });
      d.createObjectStore('docs', { keyPath: 'id' });
      d.createObjectStore('notes', { keyPath: 'id' }).createIndex('docId', 'docId');
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
const db = await openDB();
function run(store, mode, fn) {
  return new Promise((resolve, reject) => {
    const t = db.transaction(store, mode);
    let out;
    const r = fn(t.objectStore(store));
    if (r) r.onsuccess = () => { out = r.result; };
    t.oncomplete = () => resolve(out);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
}
const idb = {
  get: (s, k) => run(s, 'readonly', (st) => st.get(k)),
  all: (s) => run(s, 'readonly', (st) => st.getAll()),
  put: (s, v) => run(s, 'readwrite', (st) => st.put(v)),
  del: (s, k) => run(s, 'readwrite', (st) => st.delete(k)),
  keys: (s) => run(s, 'readonly', (st) => st.getAllKeys()),
  notesOf: (docId) => run('notes', 'readonly', (st) => st.index('docId').getAll(docId)),
};

// ---------- Small helpers ----------
let toastTimer;
function toast(msg, ms = 2200) {
  const t = $('toast');
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, ms);
}
function uid() {
  return (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));
}
async function fileId(buf, file) {
  try {
    const h = await crypto.subtle.digest('SHA-256', buf);
    return [...new Uint8Array(h)].slice(0, 16).map((b) => b.toString(16).padStart(2, '0')).join('');
  } catch {
    return `f-${file.size}-${file.lastModified}-${file.name}`;
  }
}
function fmtDate(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  const now = new Date();
  const opts = d.getFullYear() === now.getFullYear() ? { day: 'numeric', month: 'short' } : { day: 'numeric', month: 'short', year: 'numeric' };
  return d.toLocaleDateString(undefined, opts);
}
function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function debounce(fn, ms) {
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}
function loadPdf(data) {
  const task = pdfjsLib.getDocument({ data, ...PDF_OPTS });
  task.onPassword = (cb, reason) => {
    const p = prompt(reason === 2 ? 'Wrong password. Try again:' : 'This PDF has a password:');
    if (p === null) task.destroy(); else cb(p);
  };
  return task.promise;
}
async function shareOrDownload(name, text, type = 'text/markdown') {
  const file = new File([text], name, { type });
  try {
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: name });
      return;
    }
  } catch (e) {
    if (e && e.name === 'AbortError') return;
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

// ---------- Theme ----------
let theme = localStorage.getItem('theme') || 'dark';
function applyTheme(t) {
  theme = t;
  localStorage.setItem('theme', t);
  document.body.classList.remove(...THEMES.map(([k]) => 'theme-' + k));
  document.body.classList.add('theme-' + t);
  const meta = document.querySelector('meta[name=theme-color]');
  meta.content = { dark: '#121212', black: '#000000', sepia: '#2b2620', light: '#e9e9ec' }[t];
}
applyTheme(theme);

// ---------- Action sheet ----------
function sheet(title, items) {
  $('actionTitle').textContent = title;
  const body = $('actionBody');
  body.replaceChildren();
  for (const it of items) {
    if (it.label) {
      const p = document.createElement('div');
      p.className = 'section-label';
      p.textContent = it.label;
      body.appendChild(p);
      continue;
    }
    if (it.note) {
      const p = document.createElement('p');
      p.className = 'small';
      p.innerHTML = it.note;
      body.appendChild(p);
      continue;
    }
    const b = document.createElement('button');
    b.className = 'action' + (it.danger ? ' danger' : '') + (it.on ? ' on' : '');
    b.innerHTML = `<span>${esc(it.text)}</span>${it.sub ? `<span class="sub">${esc(it.sub)}</span>` : ''}`;
    b.onclick = () => { if (!it.keepOpen) closeSheet(); it.run(); };
    body.appendChild(b);
  }
  $('actionSheet').hidden = false;
}
function closeSheet() { $('actionSheet').hidden = true; }
$('actionClose').onclick = closeSheet;
for (const id of ['actionSheet', 'notesPanel']) {
  $(id).addEventListener('click', (e) => { if (e.target.id === id) $(id).hidden = true; });
}

function themeSheet() {
  sheet('Reading theme', THEMES.map(([k, name]) => ({
    text: name, on: k === theme, run: () => applyTheme(k),
  })));
}

// ---------- Library ----------
async function renderLibrary() {
  const [docs, fileKeys, notes] = await Promise.all([idb.all('docs'), idb.keys('files'), idb.all('notes')]);
  const have = new Set(fileKeys);
  const counts = {};
  for (const n of notes) counts[n.docId] = (counts[n.docId] || 0) + 1;
  docs.sort((a, b) => (b.opened || b.added) - (a.opened || a.added));
  const list = $('docList');
  list.replaceChildren();
  $('empty').hidden = docs.length > 0;
  for (const d of docs) {
    const pct = d.pages ? Math.round(((d.page || 1) - 1 + (d.offset || 0)) / d.pages * 100) : 0;
    const el = document.createElement('div');
    el.className = 'doc';
    el.setAttribute('role', 'button');
    const nc = counts[d.id] || 0;
    el.innerHTML = `
      <div class="thumb" style="${d.thumb ? `background-image:url(${d.thumb})` : ''}"></div>
      <div class="doc-info">
        <div class="doc-name">${esc(d.name)}</div>
        <div class="doc-meta">Page ${d.page || 1} of ${d.pages || '?'} · ${pct}%${nc ? ` · ${nc} note${nc > 1 ? 's' : ''}` : ''}</div>
        <div class="doc-meta">${d.opened ? 'Last read ' + fmtDate(d.opened) : 'Added ' + fmtDate(d.added)}</div>
        ${have.has(d.id) ? '' : '<div class="doc-missing">PDF not on this device. Add the same file again to reconnect it.</div>'}
        <div class="progress"><i style="width:${pct}%"></i></div>
      </div>
      <button class="icon-btn doc-more" aria-label="More"><svg viewBox="0 0 24 24"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg></button>`;
    el.onclick = (e) => {
      if (e.target.closest('.doc-more')) { docMenu(d); return; }
      if (!have.has(d.id)) { toast('Add this PDF again to reconnect it'); return; }
      openDoc(d.id);
    };
    list.appendChild(el);
  }
  showInstallHint();
}

function docMenu(d) {
  sheet(d.name, [
    { text: 'Rename', run: async () => {
      const name = prompt('New name', d.name);
      if (name && name.trim()) { d.name = name.trim(); await idb.put('docs', d); renderLibrary(); }
    } },
    { text: 'Export notes', run: () => exportNotes(d) },
    { text: 'Start from the beginning', run: async () => { d.page = 1; d.offset = 0; await idb.put('docs', d); renderLibrary(); } },
    { text: 'Delete PDF and its notes', danger: true, run: async () => {
      if (!confirm(`Delete "${d.name}" and all its notes from this device?`)) return;
      const ns = await idb.notesOf(d.id);
      for (const n of ns) await idb.del('notes', n.id);
      await idb.del('files', d.id);
      await idb.del('docs', d.id);
      renderLibrary();
      toast('Deleted');
    } },
  ]);
}

async function makeThumb(pdf) {
  try {
    const page = await pdf.getPage(1);
    const vp1 = page.getViewport({ scale: 1 });
    const vp = page.getViewport({ scale: 180 / vp1.width });
    const c = document.createElement('canvas');
    c.width = Math.round(vp.width); c.height = Math.round(vp.height);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
    await page.render({ canvasContext: ctx, viewport: vp }).promise;
    const url = c.toDataURL('image/jpeg', 0.72);
    c.width = c.height = 0;
    return url;
  } catch { return ''; }
}

async function addFiles(files) {
  let lastId = null;
  let added = 0;
  for (const f of files) {
    if (!/\.pdf$/i.test(f.name) && f.type !== 'application/pdf') { toast(`${f.name} is not a PDF`); continue; }
    $('loading').hidden = false;
    $('loadingText').textContent = `Saving ${f.name}…`;
    try {
      const buf = await f.arrayBuffer();
      const id = await fileId(buf, f);
      const existing = await idb.get('docs', id);
      const pdf = await loadPdf(new Uint8Array(buf.slice(0)));
      const thumb = await makeThumb(pdf);
      const pages = pdf.numPages;
      await pdf.destroy();
      await idb.put('files', { id, data: buf });
      if (existing) {
        existing.thumb = existing.thumb || thumb;
        existing.pages = pages;
        await idb.put('docs', existing);
      } else {
        await idb.put('docs', {
          id, name: f.name.replace(/\.pdf$/i, ''), size: f.size, pages,
          added: Date.now(), opened: 0, page: 1, offset: 0, zoom: 1, thumb,
        });
      }
      lastId = id; added++;
    } catch (e) {
      console.error(e);
      toast(`Could not open ${f.name}: ${e.message || e}`, 4000);
    }
  }
  $('loading').hidden = true;
  if (added && navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
  await renderLibrary();
  if (added === 1 && lastId) openDoc(lastId);
  else if (added > 1) toast(`${added} PDFs added`);
}
$('fileInput').addEventListener('change', (e) => {
  const files = [...e.target.files];
  e.target.value = '';
  if (files.length) addFiles(files);
});
// drag and drop on desktop
document.addEventListener('dragover', (e) => e.preventDefault());
document.addEventListener('drop', (e) => {
  e.preventDefault();
  const files = [...(e.dataTransfer?.files || [])];
  if (files.length) addFiles(files);
});

// ---------- Settings, backup and restore ----------
$('settingsBtn').onclick = async () => {
  let usage = '';
  try {
    const est = await navigator.storage.estimate();
    usage = `${(est.usage / 1048576).toFixed(1)} MB used`;
  } catch {}
  let persisted = false;
  try { persisted = await navigator.storage.persisted(); } catch {}
  sheet('Settings', [
    { label: 'Reading theme' },
    ...THEMES.map(([k, name]) => ({ text: name, on: k === theme, keepOpen: true, run: () => { applyTheme(k); $('settingsBtn').onclick(); } })),
    { label: 'Backup' },
    { text: 'Back up notes and reading positions', sub: '.json', run: backup },
    { text: 'Restore from a backup', run: () => $('restoreInput').click() },
    { note: `PDFs stay on this device and are not in the backup. After a restore, add the same PDFs again and their notes come back.${usage ? `<br>${esc(usage)}${persisted ? ', kept permanently' : ''}.` : ''}` },
  ]);
};

async function backup() {
  const docs = (await idb.all('docs')).map(({ thumb, ...d }) => d);
  const notes = await idb.all('notes');
  const data = { app: 'dark-reader', version: 1, exported: new Date().toISOString(), docs, notes };
  const day = new Date().toISOString().slice(0, 10);
  await shareOrDownload(`reader-backup-${day}.json`, JSON.stringify(data, null, 1), 'application/json');
}
$('restoreInput').addEventListener('change', async (e) => {
  const f = e.target.files[0];
  e.target.value = '';
  if (!f) return;
  try {
    const data = JSON.parse(await f.text());
    if (data.app !== 'dark-reader') throw new Error('This is not a Reader backup');
    for (const d of data.docs || []) {
      const cur = await idb.get('docs', d.id);
      await idb.put('docs', cur ? { ...cur, ...d, thumb: cur.thumb } : d);
    }
    for (const n of data.notes || []) await idb.put('notes', n);
    toast(`Restored ${data.docs?.length || 0} documents and ${data.notes?.length || 0} notes`, 3500);
    renderLibrary();
  } catch (err) {
    toast('Restore failed: ' + (err.message || err), 4000);
  }
});

function showInstallHint() {
  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const el = $('installHint');
  if (standalone || localStorage.getItem('hideInstallHint')) { el.hidden = true; return; }
  el.innerHTML = ios
    ? 'To install: tap <b>Share</b>, then <b>Add to Home Screen</b>. Then open Reader from your home screen and add your PDFs there, because the home-screen app keeps its own storage. <button class="text-btn" id="hideHint">OK</button>'
    : 'To install: open the browser menu and choose <b>Install app</b> or <b>Add to Home screen</b>. <button class="text-btn" id="hideHint">OK</button>';
  el.hidden = false;
  $('hideHint').onclick = () => { localStorage.setItem('hideInstallHint', '1'); el.hidden = true; };
}

// ---------- Reader state ----------
const scroller = $('scroller');
const pagesEl = $('pages');
const S = {
  session: 0,
  doc: null,
  pdf: null,
  pages: [], // { n, w, h, rot, el, tl, hl, pins, canvas, scale, task, taskScale }
  base: 1,
  zoom: 1,
  notes: [],
  placing: false,
  padTop: 0,
};
const GAP = 10;
const scale = () => S.base * S.zoom;

async function openDoc(id) {
  const sess = ++S.session;
  const doc = await idb.get('docs', id);
  const file = await idb.get('files', id);
  if (!doc || !file) { toast('PDF not found on this device'); return; }
  $('library').hidden = true;
  $('reader').hidden = false;
  $('loading').hidden = false;
  $('loadingText').textContent = 'Opening…';
  $('docTitle').textContent = doc.name;
  document.title = doc.name;
  document.body.classList.remove('immersive');
  if (history.state?.reader !== id) history.pushState({ reader: id }, '');
  let pdf;
  try {
    pdf = await loadPdf(new Uint8Array(file.data));
  } catch (e) {
    $('loading').hidden = true;
    toast('Could not open this PDF: ' + (e.message || e), 4000);
    closeReader();
    return;
  }
  if (sess !== S.session) { pdf.destroy(); return; }
  S.doc = doc; S.pdf = pdf; S.zoom = doc.zoom || 1;
  // read every page size up front so the scroll positions are exact
  const sizes = [];
  for (let i = 1; i <= pdf.numPages; i += 25) {
    const batch = [];
    for (let j = i; j < i + 25 && j <= pdf.numPages; j++) {
      batch.push(pdf.getPage(j).then((p) => { const v = p.getViewport({ scale: 1 }); return { w: v.width, h: v.height }; }));
    }
    sizes.push(...await Promise.all(batch));
    if (sess !== S.session) return;
  }
  pagesEl.replaceChildren();
  S.pages = sizes.map((sz, i) => {
    const el = document.createElement('div');
    el.className = 'page';
    el.dataset.n = i + 1;
    const num = document.createElement('div'); num.className = 'num'; num.textContent = i + 1;
    const hl = document.createElement('div'); hl.className = 'hl-layer';
    const tl = document.createElement('div'); tl.className = 'textLayer';
    const pins = document.createElement('div'); pins.className = 'pin-layer';
    el.append(num, hl, tl, pins);
    pagesEl.appendChild(el);
    return { n: i + 1, w: sz.w, h: sz.h, el, tl, hl, pins, canvas: null, scale: 0, task: null, taskScale: 0, textScale: 0 };
  });
  $('pageTotal').textContent = pdf.numPages;
  doc.pages = pdf.numPages;
  layout();
  S.notes = await idb.notesOf(id);
  drawNotes();
  restorePos({ page: doc.page || 1, offset: doc.offset || 0 });
  $('loading').hidden = true;
  doc.opened = Date.now();
  idb.put('docs', doc);
  update();
}

function closeReader() {
  if (S.doc) savePos(true);
  S.session++;
  for (const p of S.pages) releasePage(p);
  S.pages = [];
  pagesEl.replaceChildren();
  if (S.pdf) S.pdf.destroy();
  S.pdf = null; S.doc = null;
  setPlacing(false);
  $('selNoteBtn').hidden = true;
  $('reader').hidden = true;
  $('library').hidden = false;
  document.title = 'Reader';
  renderLibrary();
}
$('backBtn').onclick = () => { if (history.state?.reader) history.back(); else closeReader(); };
window.addEventListener('popstate', () => { if (!$('reader').hidden && S.doc) closeReader(); });

// ---------- Layout and rendering ----------
function layout() {
  if (!S.pages.length) return;
  const avail = Math.min(scroller.clientWidth, 1000) - 16;
  const maxW = Math.max(...S.pages.map((p) => p.w));
  S.base = avail / maxW;
  const sc = scale();
  for (const p of S.pages) {
    p.cssW = Math.floor(p.w * sc);
    p.cssH = Math.floor(p.h * sc);
    p.el.style.width = p.cssW + 'px';
    p.el.style.height = p.cssH + 'px';
    p.el.style.setProperty('--scale-factor', sc);
  }
  for (const p of S.pages) { p.top = p.el.offsetTop; p.left = p.el.offsetLeft; }
  S.padTop = S.pages[0].top;
}

function pageAt(y) {
  const ps = S.pages;
  let lo = 0, hi = ps.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (ps[mid].top <= y) lo = mid; else hi = mid - 1;
  }
  return ps[lo];
}

let raf = 0;
function update() {
  if (raf) return;
  raf = requestAnimationFrame(() => {
    raf = 0;
    if (!S.pages.length) return;
    const top = scroller.scrollTop;
    const bottom = top + scroller.clientHeight;
    const first = pageAt(top).n - 1;
    const last = pageAt(bottom).n - 1;
    const cur = pageAt(top + scroller.clientHeight * 0.3).n;
    $('pageNow').textContent = cur;
    $('pagePill').textContent = `${cur} / ${S.pages.length}`;
    const keepFrom = first - 2, keepTo = last + 2;
    for (const p of S.pages) {
      const i = p.n - 1;
      if (i >= first - 1 && i <= last + 1) renderPage(p);
      else if (i < keepFrom || i > keepTo) releasePage(p);
    }
  });
}

async function renderPage(p) {
  const sc = scale();
  const sess = S.session;
  if (p.scale === sc) return;
  if (p.task) { if (p.taskScale === sc) return; p.task.cancel(); p.task = null; }
  const page = await S.pdf.getPage(p.n);
  if (sess !== S.session || p.scale === sc || (p.task && p.taskScale === sc)) return;
  const vp = page.getViewport({ scale: sc });
  let dpr = Math.min(window.devicePixelRatio || 1, 3);
  const maxPx = 10e6; // stay under iOS canvas memory limits
  if (vp.width * vp.height * dpr * dpr > maxPx) dpr = Math.sqrt(maxPx / (vp.width * vp.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.floor(vp.width * dpr);
  canvas.height = Math.floor(vp.height * dpr);
  const ctx = canvas.getContext('2d', { alpha: false });
  const task = page.render({ canvasContext: ctx, viewport: vp, transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : null });
  p.task = task; p.taskScale = sc;
  try {
    await task.promise;
  } catch {
    canvas.width = canvas.height = 0;
    if (p.task === task) p.task = null;
    return;
  }
  if (p.task !== task || sess !== S.session) { canvas.width = canvas.height = 0; return; }
  p.task = null;
  if (p.canvas) { p.canvas.width = p.canvas.height = 0; p.canvas.remove(); }
  p.el.insertBefore(canvas, p.hl);
  p.canvas = canvas;
  p.scale = sc;
  renderText(p, page, vp, sess);
}

async function renderText(p, page, vp, sess) {
  if (p.textScale === vp.scale) return;
  p.textScale = vp.scale;
  p.tl.replaceChildren();
  try {
    const layer = new pdfjsLib.TextLayer({ textContentSource: page.streamTextContent(), container: p.tl, viewport: vp });
    await layer.render();
    if (sess !== S.session) return;
    const end = document.createElement('div');
    end.className = 'endOfContent';
    p.tl.appendChild(end);
  } catch (e) {
    p.textScale = 0;
  }
}

function releasePage(p) {
  if (p.task) { p.task.cancel(); p.task = null; }
  if (p.canvas) { p.canvas.width = p.canvas.height = 0; p.canvas.remove(); p.canvas = null; }
  if (p.textScale) { p.tl.replaceChildren(); p.textScale = 0; }
  p.scale = 0;
}

// ---------- Reading position ----------
function currentPos() {
  const y = scroller.scrollTop + S.padTop;
  const p = pageAt(y);
  return { page: p.n, offset: clamp((y - p.top) / (p.cssH || 1), 0, 1) };
}
function restorePos(pos) {
  const p = S.pages[clamp((pos.page || 1) - 1, 0, S.pages.length - 1)];
  scroller.scrollTop = p.top + (pos.offset || 0) * p.cssH - S.padTop;
}
function savePos(now) {
  if (!S.doc || !S.pages.length) return;
  const pos = currentPos();
  S.doc.page = pos.page;
  S.doc.offset = pos.offset;
  S.doc.zoom = S.zoom;
  const p = idb.put('docs', S.doc);
  return now ? p : undefined;
}
const savePosSoon = debounce(savePos, 500);
scroller.addEventListener('scroll', () => { update(); savePosSoon(); }, { passive: true });
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') savePos(true); });
window.addEventListener('pagehide', () => savePos(true));

let lastWidth = 0;
window.addEventListener('resize', debounce(() => {
  if (!S.pages.length || scroller.clientWidth === lastWidth) return;
  lastWidth = scroller.clientWidth;
  const pos = currentPos();
  layout();
  restorePos(pos);
  update();
}, 150));

// ---------- Zoom (buttons and pinch) ----------
function setZoom(z, anchor) {
  z = clamp(z, 0.5, 5);
  if (Math.abs(z - S.zoom) < 0.001) return;
  // anchor: a point on screen that should stay still
  const r = scroller.getBoundingClientRect();
  const ax = anchor ? anchor.x - r.left : scroller.clientWidth / 2;
  const ay = anchor ? anchor.y - r.top : scroller.clientHeight / 2;
  const cy = scroller.scrollTop + ay;
  const cx = scroller.scrollLeft + ax;
  const p = pageAt(cy);
  const fy = (cy - p.top) / p.cssH;
  const fx = (cx - p.left) / p.cssW;
  S.zoom = z;
  layout();
  scroller.scrollTop = p.top + fy * p.cssH - ay;
  scroller.scrollLeft = p.left + fx * p.cssW - ax;
  update();
  savePosSoon();
}
$('zoomIn').onclick = () => setZoom(S.zoom * 1.25);
$('zoomOut').onclick = () => setZoom(S.zoom / 1.25);
$('zoomFit').onclick = () => setZoom(1);

let pinch = null;
const dist = (a, b) => Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
scroller.addEventListener('touchstart', (e) => {
  if (e.touches.length !== 2) return;
  const [a, b] = e.touches;
  const r = scroller.getBoundingClientRect();
  const mx = (a.clientX + b.clientX) / 2, my = (a.clientY + b.clientY) / 2;
  pinch = { d0: dist(a, b), mx, my, s: 1 };
  pagesEl.style.transformOrigin = `${mx - r.left + scroller.scrollLeft}px ${my - r.top + scroller.scrollTop}px`;
}, { passive: true });
scroller.addEventListener('touchmove', (e) => {
  if (!pinch || e.touches.length !== 2) return;
  e.preventDefault();
  const [a, b] = e.touches;
  const target = clamp(S.zoom * dist(a, b) / pinch.d0, 0.5, 5);
  pinch.s = target / S.zoom;
  pagesEl.style.transform = `scale(${pinch.s})`;
}, { passive: false });
function endPinch() {
  if (!pinch) return;
  const { s, mx, my } = pinch;
  pinch = null;
  pagesEl.style.transform = '';
  if (Math.abs(s - 1) > 0.02) setZoom(S.zoom * s, { x: mx, y: my });
}
scroller.addEventListener('touchend', (e) => { if (e.touches.length < 2) endPinch(); });
scroller.addEventListener('touchcancel', endPinch);
document.addEventListener('gesturestart', (e) => e.preventDefault());
// ctrl + wheel / trackpad pinch on desktop
scroller.addEventListener('wheel', (e) => {
  if (!e.ctrlKey) return;
  e.preventDefault();
  setZoom(S.zoom * Math.exp(-e.deltaY / 200), { x: e.clientX, y: e.clientY });
}, { passive: false });

// ---------- Page jump and chrome ----------
$('pageBtn').onclick = () => {
  const v = prompt(`Go to page (1 to ${S.pages.length})`, $('pageNow').textContent);
  const n = parseInt(v, 10);
  if (n >= 1 && n <= S.pages.length) { restorePos({ page: n, offset: 0 }); update(); savePosSoon(); }
};
$('themeBtn').onclick = themeSheet;

let touchMoved = false, touchStartY = 0;
scroller.addEventListener('touchstart', (e) => { touchMoved = false; touchStartY = e.touches[0].clientY; }, { passive: true });
scroller.addEventListener('touchmove', (e) => { if (Math.abs(e.touches[0].clientY - touchStartY) > 8) touchMoved = true; }, { passive: true });

scroller.addEventListener('click', (e) => {
  const pin = e.target.closest('.pin');
  if (pin) { editNote(S.notes.find((n) => n.id === pin.dataset.id)); return; }
  const pageEl = e.target.closest('.page');
  if (S.placing) {
    if (!pageEl) return;
    const r = pageEl.getBoundingClientRect();
    const x = clamp((e.clientX - r.left) / r.width, 0.02, 0.98);
    const y = clamp((e.clientY - r.top) / r.height, 0.01, 0.99);
    setPlacing(false);
    newNote({ page: +pageEl.dataset.n, x, y });
    return;
  }
  if (touchMoved) return;
  const sel = getSelection();
  if (sel && !sel.isCollapsed) return;
  document.body.classList.toggle('immersive');
});

// ---------- Notes ----------
function setPlacing(on) {
  S.placing = on;
  document.body.classList.toggle('placing', on);
  $('placeBanner').hidden = !on;
  if (on) document.body.classList.remove('immersive');
}
$('addNoteBtn').onclick = () => setPlacing(!S.placing);
$('placeCancel').onclick = () => setPlacing(false);

function sortNotes() {
  S.notes.sort((a, b) => a.page - b.page || a.y - b.y || a.x - b.x);
}
function drawNotes() {
  sortNotes();
  for (const p of S.pages) { p.hl.replaceChildren(); p.pins.replaceChildren(); }
  S.notes.forEach((n) => {
    const p = S.pages[n.page - 1];
    if (!p) return;
    for (const r of n.rects || []) {
      const h = document.createElement('div');
      h.className = 'hl c-' + (n.color || 'yellow');
      Object.assign(h.style, { left: r.x * 100 + '%', top: r.y * 100 + '%', width: r.w * 100 + '%', height: r.h * 100 + '%' });
      p.hl.appendChild(h);
    }
    const pin = document.createElement('button');
    pin.className = 'pin c-' + (n.color || 'yellow');
    pin.dataset.id = n.id;
    pin.setAttribute('aria-label', 'Note');
    pin.style.left = n.x * 100 + '%';
    pin.style.top = n.y * 100 + '%';
    pin.innerHTML = '<svg viewBox="0 0 24 24" style="width:13px;height:13px;stroke-width:3"><path d="M7 9h10M7 14h6"/></svg>';
    p.pins.appendChild(pin);
  });
  const c = S.notes.length;
  $('noteCount').hidden = !c;
  $('noteCount').textContent = c;
}

let editing = null;
let editColor = localStorage.getItem('noteColor') || 'yellow';
function openEditor(note, isNew) {
  editing = { note, isNew };
  $('noteSheetTitle').textContent = isNew ? `New note · page ${note.page}` : `Note · page ${note.page}`;
  $('noteQuote').hidden = !note.quote;
  $('noteQuote').textContent = note.quote || '';
  $('noteText').value = note.text || '';
  $('noteDelete').hidden = isNew;
  editColor = note.color || editColor;
  paintColors();
  $('noteSheet').hidden = false;
  setTimeout(() => $('noteText').focus(), 60);
}
function paintColors() {
  for (const b of $('noteColors').children) b.classList.toggle('on', b.dataset.c === editColor);
}
$('noteColors').onclick = (e) => {
  const c = e.target.dataset?.c;
  if (c) { editColor = c; paintColors(); }
};
function newNote(fields) {
  openEditor({ id: uid(), docId: S.doc.id, text: '', quote: '', rects: [], color: editColor, ...fields }, true);
}
function editNote(n) { if (n) openEditor(n, false); }
function closeEditor() { $('noteSheet').hidden = true; $('noteText').blur(); editing = null; }
$('noteClose').onclick = closeEditor;
$('noteSheet').addEventListener('click', (e) => { if (e.target.id === 'noteSheet') closeEditor(); });
$('noteSave').onclick = async () => {
  if (!editing) return;
  const { note, isNew } = editing;
  note.text = $('noteText').value.trim();
  note.color = editColor;
  localStorage.setItem('noteColor', editColor);
  if (!note.text && !note.quote) { closeEditor(); return; }
  note.updated = Date.now();
  if (isNew) { note.created = note.updated; S.notes.push(note); }
  await idb.put('notes', note);
  closeEditor();
  drawNotes();
  getSelection()?.removeAllRanges();
  toast(isNew ? 'Note saved' : 'Note updated', 1200);
};
$('noteDelete').onclick = async () => {
  if (!editing) return;
  const { note } = editing;
  if (!confirm('Delete this note?')) return;
  await idb.del('notes', note.id);
  S.notes = S.notes.filter((n) => n.id !== note.id);
  closeEditor();
  drawNotes();
  renderNotesList();
};

// Highlight a text selection and attach a note
let lastSel = null;
function readSelection() {
  const sel = getSelection();
  if (!sel || sel.isCollapsed || !sel.rangeCount) return null;
  const range = sel.getRangeAt(0);
  const node = range.startContainer.nodeType === 1 ? range.startContainer : range.startContainer.parentElement;
  const pageEl = node?.closest?.('.page');
  if (!pageEl || !pagesEl.contains(pageEl)) return null;
  const quote = sel.toString().replace(/\s+\n/g, '\n').trim();
  if (!quote) return null;
  const pr = pageEl.getBoundingClientRect();
  const raw = [...range.getClientRects()]
    .filter((r) => r.width > 1 && r.height > 1 && r.top < pr.bottom && r.bottom > pr.top && r.left < pr.right && r.right > pr.left)
    .map((r) => ({ l: Math.max(r.left, pr.left), t: r.top, r: Math.min(r.right, pr.right), b: r.bottom }));
  if (!raw.length) return null;
  // merge pieces that sit on the same line
  raw.sort((a, b) => a.t - b.t || a.l - b.l);
  const lines = [];
  for (const r of raw) {
    const last = lines[lines.length - 1];
    const sameLine = last && Math.abs((r.t + r.b) / 2 - (last.t + last.b) / 2) < (last.b - last.t) * 0.6;
    if (sameLine && r.l <= last.r + 12) {
      last.l = Math.min(last.l, r.l); last.r = Math.max(last.r, r.r);
      last.t = Math.min(last.t, r.t); last.b = Math.max(last.b, r.b);
    } else lines.push({ ...r });
  }
  const rects = lines.map((r) => ({
    x: (r.l - pr.left) / pr.width, y: (r.t - pr.top) / pr.height,
    w: (r.r - r.l) / pr.width, h: (r.b - r.t) / pr.height,
  }));
  const first = rects[0];
  // pin goes in the left margin, beside the first highlighted line
  return { page: +pageEl.dataset.n, quote, rects, x: clamp(Math.min(first.x - 0.035, 0.04), 0.025, 0.98), y: clamp(first.y + first.h / 2, 0.01, 0.99) };
}
document.addEventListener('selectionchange', debounce(() => {
  if ($('reader').hidden) return;
  const s = readSelection();
  if (s) lastSel = s;
  $('selNoteBtn').hidden = !s;
}, 120));
// keep the selection when the button is pressed
$('selNoteBtn').addEventListener('pointerdown', (e) => e.preventDefault());
$('selNoteBtn').addEventListener('mousedown', (e) => e.preventDefault());
$('selNoteBtn').onclick = () => {
  const s = readSelection() || lastSel;
  if (!s) return;
  $('selNoteBtn').hidden = true;
  newNote(s);
};

// Notes list
function renderNotesList() {
  const q = $('notesSearch').value.trim().toLowerCase();
  const list = $('notesList');
  list.replaceChildren();
  const ns = S.notes.filter((n) => !q || (n.text + ' ' + (n.quote || '')).toLowerCase().includes(q));
  if (!ns.length) {
    list.innerHTML = `<p class="muted">${S.notes.length ? 'No notes match.' : 'No notes yet. Tap <b>Note</b> and then a spot on the page, or select text and tap <b>Highlight and note</b>.'}</p>`;
    return;
  }
  for (const n of ns) {
    const b = document.createElement('button');
    b.className = 'note-item c-' + (n.color || 'yellow');
    b.innerHTML = `<span class="note-page">Page ${n.page}</span>${n.quote ? `<span class="note-quote">“${esc(n.quote)}”</span>` : ''}${n.text ? `<span class="note-text">${esc(n.text)}</span>` : ''}`;
    b.onclick = () => { $('notesPanel').hidden = true; goToNote(n); };
    list.appendChild(b);
  }
}
function goToNote(n) {
  const p = S.pages[n.page - 1];
  scroller.scrollTop = p.top + n.y * p.cssH - scroller.clientHeight * 0.35;
  update();
  savePosSoon();
  const pin = p.pins.querySelector(`[data-id="${n.id}"]`);
  if (pin) { pin.classList.remove('flash'); void pin.offsetWidth; pin.classList.add('flash'); }
}
$('notesBtn').onclick = () => { $('notesSearch').value = ''; renderNotesList(); $('notesPanel').hidden = false; };
$('notesClose').onclick = () => { $('notesPanel').hidden = true; };
$('notesSearch').addEventListener('input', renderNotesList);

function notesMarkdown(doc, notes) {
  const lines = [`# Notes: ${doc.name}`, '', `Exported ${new Date().toLocaleString()} · ${notes.length} note${notes.length === 1 ? '' : 's'}`, ''];
  let page = 0;
  for (const n of notes) {
    if (n.page !== page) { page = n.page; lines.push(`## Page ${page}`, ''); }
    if (n.quote) lines.push(...n.quote.split('\n').map((l) => '> ' + l), '');
    if (n.text) lines.push(n.text, '');
  }
  return lines.join('\n');
}
async function exportNotes(doc) {
  const notes = (doc.id === S.doc?.id ? S.notes : await idb.notesOf(doc.id))
    .slice().sort((a, b) => a.page - b.page || a.y - b.y);
  if (!notes.length) { toast('No notes in this PDF yet'); return; }
  const safe = doc.name.replace(/[\\/:*?"<>|]+/g, ' ').trim() || 'notes';
  await shareOrDownload(`${safe} - notes.md`, notesMarkdown(doc, notes));
}
$('notesExport').onclick = () => S.doc && exportNotes(S.doc);
$('notesCopy').onclick = async () => {
  if (!S.notes.length) { toast('No notes yet'); return; }
  try {
    await navigator.clipboard.writeText(notesMarkdown(S.doc, S.notes));
    toast('Copied');
  } catch { toast('Copy failed'); }
};

// keyboard on desktop
document.addEventListener('keydown', (e) => {
  if ($('reader').hidden || e.target.matches('textarea, input')) return;
  if ((e.key === '+' || e.key === '=') && !e.metaKey) setZoom(S.zoom * 1.25);
  else if (e.key === '-' && !e.metaKey) setZoom(S.zoom / 1.25);
  else if (e.key === 'Escape') { setPlacing(false); }
});

// ---------- Start ----------
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch((e) => console.warn('SW failed', e));
  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    // a new version was installed; reload only when nothing is open
    if (reloaded || S.doc) return;
    reloaded = true;
    location.reload();
  });
}
history.replaceState({ library: true }, '');
await renderLibrary();
