// Reader: a dark-mode reader for PDF and Markdown files. Files, reading positions and notes stay on the device.
import * as pdfjsLib from './vendor/pdf.min.mjs';
import { marked } from './vendor/marked.esm.js';
import DOMPurify from './vendor/purify.es.mjs';

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
const DAY = 86400000;

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
function kindOf(file) {
  const n = file.name.toLowerCase();
  if (n.endsWith('.pdf') || file.type === 'application/pdf') return 'pdf';
  if (/\.(md|markdown|mdown|mkd)$/.test(n) || file.type === 'text/markdown' || file.type === 'text/x-markdown') return 'md';
  if (n.endsWith('.txt') || file.type === 'text/plain') return 'txt';
  return null;
}
const EXT = { pdf: 'pdf', md: 'md', txt: 'txt' };
const stripExt = (name) => name.replace(/\.(pdf|md|markdown|mdown|mkd|txt)$/i, '');
const safeName = (s) => s.replace(/[\\/:*?"<>|#%]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80) || 'file';
function loadPdf(data) {
  const task = pdfjsLib.getDocument({ data, ...PDF_OPTS });
  task.onPassword = (cb, reason) => {
    const p = prompt(reason === 2 ? 'Wrong password. Try again:' : 'This PDF has a password:');
    if (p === null) task.destroy(); else cb(p);
  };
  return task.promise;
}
// Opens the share sheet (Save to Files, AirDrop...) or downloads. Returns false if the person cancelled.
async function shareOrDownload(name, data, type = 'text/markdown') {
  const file = new File([data], name, { type });
  try {
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: name });
      return true;
    }
  } catch (e) {
    if (e && e.name === 'AbortError') return false;
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  return true;
}

// ---------- ZIP (for full backups) ----------
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(u8) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < u8.length; i++) c = CRC_TABLE[(c ^ u8[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}
// Stored (uncompressed) ZIP: PDFs barely compress, and any computer can open it.
function makeZip(entries) {
  const enc = new TextEncoder();
  const parts = [], central = [];
  let offset = 0;
  const d = new Date();
  const time = ((d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1)) & 0xffff;
  const date = (((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate()) & 0xffff;
  for (const e of entries) {
    const name = enc.encode(e.name);
    const crc = crc32(e.data);
    const size = e.data.length;
    const h = new DataView(new ArrayBuffer(30));
    h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true);
    h.setUint16(8, 0, true); h.setUint16(10, time, true); h.setUint16(12, date, true);
    h.setUint32(14, crc, true); h.setUint32(18, size, true); h.setUint32(22, size, true);
    h.setUint16(26, name.length, true); h.setUint16(28, 0, true);
    parts.push(h.buffer, name, e.data);
    const c = new DataView(new ArrayBuffer(46));
    c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true);
    c.setUint16(10, 0, true); c.setUint16(12, time, true); c.setUint16(14, date, true);
    c.setUint32(16, crc, true); c.setUint32(20, size, true); c.setUint32(24, size, true);
    c.setUint16(28, name.length, true); c.setUint32(42, offset, true);
    central.push(c.buffer, name);
    offset += 30 + name.length + size;
  }
  const cdSize = central.reduce((s, p) => s + p.byteLength, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, entries.length, true); end.setUint16(10, entries.length, true);
  end.setUint32(12, cdSize, true); end.setUint32(16, offset, true);
  return new Blob([...parts, ...central, end.buffer], { type: 'application/zip' });
}
async function readZip(buf) {
  const dv = new DataView(buf);
  let eocd = -1;
  for (let i = buf.byteLength - 22; i >= Math.max(0, buf.byteLength - 65557); i--) {
    if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('Not a ZIP file');
  const count = dv.getUint16(eocd + 10, true);
  let p = dv.getUint32(eocd + 16, true);
  const dec = new TextDecoder();
  const out = {};
  for (let i = 0; i < count; i++) {
    if (dv.getUint32(p, true) !== 0x02014b50) throw new Error('Damaged ZIP file');
    const method = dv.getUint16(p + 10, true);
    const csize = dv.getUint32(p + 20, true);
    const nlen = dv.getUint16(p + 28, true), xlen = dv.getUint16(p + 30, true), clen = dv.getUint16(p + 32, true);
    const lho = dv.getUint32(p + 42, true);
    const name = dec.decode(new Uint8Array(buf, p + 46, nlen));
    const start = lho + 30 + dv.getUint16(lho + 26, true) + dv.getUint16(lho + 28, true);
    let data = buf.slice(start, start + csize);
    if (method === 8) {
      if (!('DecompressionStream' in window)) throw new Error('This ZIP is compressed; this browser cannot open it');
      data = await new Response(new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer();
    } else if (method !== 0) throw new Error('Unsupported ZIP compression');
    out[name] = data;
    p += 46 + nlen + xlen + clen;
  }
  return out;
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
for (const id of ['actionSheet', 'notesPanel', 'filesPanel']) {
  $(id).addEventListener('click', (e) => { if (e.target.id === id) $(id).hidden = true; });
}
function themeSheet() {
  sheet('Reading theme', THEMES.map(([k, name]) => ({ text: name, on: k === theme, run: () => applyTheme(k) })));
}

// ---------- Library ----------
let folder = localStorage.getItem('folder') || '';
function progressOf(d) {
  if (typeof d.progress === 'number') return d.progress;
  return d.pages ? ((d.page || 1) - 1 + (d.offset || 0)) / d.pages : 0;
}
function docCard(d, { have, counts, compact, current }) {
  const pct = Math.round(progressOf(d) * 100);
  const type = d.type || 'pdf';
  const nc = counts[d.id] || 0;
  const el = document.createElement('div');
  el.className = 'doc' + (compact ? ' compact' : '') + (current ? ' current' : '');
  el.setAttribute('role', 'button');
  const thumb = type === 'pdf'
    ? `<div class="thumb" style="${d.thumb ? `background-image:url(${d.thumb})` : ''}"></div>`
    : `<div class="thumb md-thumb" dir="auto"><b>${esc(d.snippetTitle || d.name)}</b>${esc((d.snippet || '').slice(0, 140))}</div>`;
  const where = type === 'pdf' ? `Page ${d.page || 1} of ${d.pages || '?'} · ${pct}%` : `${pct}% read`;
  el.innerHTML = `
    ${thumb}
    <div class="doc-info">
      <div class="doc-name" dir="auto"><span class="type-tag">${type === 'pdf' ? 'PDF' : type === 'md' ? 'MD' : 'TXT'}</span>${esc(d.name)}</div>
      <div class="doc-meta">${where}${nc ? ` · ${nc} note${nc > 1 ? 's' : ''}` : ''}</div>
      ${compact ? '' : `<div class="doc-meta">${d.opened ? 'Last read ' + fmtDate(d.opened) : 'Added ' + fmtDate(d.added)}${d.folder ? ' · ' + esc(d.folder) : ''}</div>`}
      ${have.has(d.id) ? '' : '<div class="doc-missing">File not on this device. Add the same file again to reconnect it.</div>'}
      <div class="progress"><i style="width:${pct}%"></i></div>
    </div>
    ${compact ? '' : '<button class="icon-btn doc-more" aria-label="More"><svg viewBox="0 0 24 24"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg></button>'}`;
  return el;
}
async function libraryData() {
  const [docs, fileKeys, notes] = await Promise.all([idb.all('docs'), idb.keys('files'), idb.all('notes')]);
  const counts = {};
  for (const n of notes) counts[n.docId] = (counts[n.docId] || 0) + 1;
  docs.sort((a, b) => (b.opened || b.added) - (a.opened || a.added));
  return { docs, have: new Set(fileKeys), counts };
}
async function renderLibrary() {
  const { docs, have, counts } = await libraryData();
  const folders = [...new Set(docs.map((d) => d.folder).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  if (folder && !folders.includes(folder)) { folder = ''; localStorage.setItem('folder', ''); }
  const chips = $('folderChips');
  chips.replaceChildren();
  chips.hidden = !folders.length;
  for (const f of ['', ...folders]) {
    const b = document.createElement('button');
    b.className = 'fchip' + (f === folder ? ' on' : '');
    b.textContent = f || `All (${docs.length})`;
    b.onclick = () => { folder = f; localStorage.setItem('folder', f); renderLibrary(); };
    chips.appendChild(b);
  }
  const q = $('libSearch').value.trim().toLowerCase();
  const shown = docs.filter((d) => (!folder || d.folder === folder) && (!q || d.name.toLowerCase().includes(q)));
  const list = $('docList');
  list.replaceChildren();
  $('empty').hidden = docs.length > 0;
  $('libSearch').parentElement.hidden = docs.length < 2 && !q;
  for (const d of shown) {
    const el = docCard(d, { have, counts });
    el.onclick = (e) => {
      if (e.target.closest('.doc-more')) { docMenu(d, folders); return; }
      if (!have.has(d.id)) { toast('Add this file again to reconnect it'); return; }
      openDoc(d.id);
    };
    list.appendChild(el);
  }
  if (docs.length && !shown.length) list.innerHTML = '<p class="muted" style="padding:8px 4px">No files match.</p>';
  showInstallHint();
  showBackupHint(docs.length);
}
$('libSearch').addEventListener('input', debounce(renderLibrary, 150));

function docMenu(d, folders) {
  sheet(d.name, [
    { text: 'Rename', run: async () => {
      const name = prompt('New name', d.name);
      if (name && name.trim()) { d.name = name.trim(); await idb.put('docs', d); renderLibrary(); }
    } },
    { text: 'Move to folder', sub: d.folder || 'none', run: () => folderMenu(d, folders) },
    { text: 'Export notes', run: () => exportNotes(d) },
    { text: 'Share the file', run: async () => {
      const f = await idb.get('files', d.id);
      if (!f) { toast('File not on this device'); return; }
      const type = d.type || 'pdf';
      await shareOrDownload(`${safeName(d.name)}.${EXT[type]}`, f.data, type === 'pdf' ? 'application/pdf' : 'text/plain');
    } },
    { text: 'Start from the beginning', run: async () => { d.page = 1; d.offset = 0; d.progress = 0; await idb.put('docs', d); renderLibrary(); } },
    { text: 'Delete file and its notes', danger: true, run: async () => {
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
function folderMenu(d, folders) {
  const move = async (f) => { d.folder = f; await idb.put('docs', d); renderLibrary(); toast(f ? `Moved to ${f}` : 'Removed from folder'); };
  sheet('Move to folder', [
    ...folders.map((f) => ({ text: f, on: d.folder === f, run: () => move(f) })),
    { text: 'New folder…', run: () => { const f = prompt('Folder name'); if (f && f.trim()) move(f.trim()); } },
    ...(d.folder ? [{ text: 'No folder', run: () => move('') }] : []),
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
function textSnippet(text) {
  const body = text.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '');
  const lines = body.split('\n').map((l) => l.trim()).filter(Boolean);
  const head = lines.find((l) => /^#{1,6}\s/.test(l));
  const clean = (l) => l.replace(/^#{1,6}\s+|^[-*>]\s+|[*_`#>[\]]/g, '').trim();
  return {
    snippetTitle: clean(head || lines[0] || '').slice(0, 60),
    snippet: lines.filter((l) => l !== head).slice(0, 6).map(clean).join(' ').slice(0, 200),
  };
}

async function addFiles(files) {
  let lastId = null;
  let added = 0;
  for (const f of files) {
    const kind = kindOf(f);
    if (!kind) { toast(`${f.name}: only PDF, Markdown and text files open here`, 3500); continue; }
    $('loading').hidden = false;
    $('loadingText').textContent = `Saving ${f.name}…`;
    try {
      const buf = await f.arrayBuffer();
      const id = await fileId(buf, f);
      const existing = await idb.get('docs', id);
      let info = {};
      if (kind === 'pdf') {
        const pdf = await loadPdf(new Uint8Array(buf.slice(0)));
        info = { thumb: await makeThumb(pdf), pages: pdf.numPages };
        await pdf.destroy();
      } else {
        info = { pages: 0, ...textSnippet(new TextDecoder().decode(buf)) };
      }
      await idb.put('files', { id, data: buf });
      if (existing) {
        await idb.put('docs', { ...existing, ...info, type: kind, thumb: existing.thumb || info.thumb });
      } else {
        await idb.put('docs', {
          id, type: kind, name: stripExt(f.name), size: f.size, folder: folder || '',
          added: Date.now(), opened: 0, page: 1, offset: 0, progress: 0, zoom: 1, ...info,
        });
      }
      lastId = id; added++;
    } catch (e) {
      console.error(e);
      toast(`Could not open ${f.name}: ${e.message || e}`, 4000);
    }
  }
  $('loading').hidden = true;
  if (added) askPersist();
  if (added === 1 && lastId) { openDoc(lastId); return; }
  await renderLibrary();
  if (added > 1) toast(`${added} files added`);
}
$('addBtn').onclick = () => $('fileInput').click();
$('fileInput').addEventListener('change', (e) => {
  const files = [...e.target.files];
  e.target.value = '';
  if (files.length) addFiles(files);
});
document.addEventListener('dragover', (e) => e.preventDefault());
document.addEventListener('drop', (e) => {
  e.preventDefault();
  const files = [...(e.dataTransfer?.files || [])];
  if (files.length) addFiles(files);
});

// ---------- Keeping data safe: persistence, backup, restore ----------
async function askPersist() {
  try { if (navigator.storage?.persist && !(await navigator.storage.persisted())) await navigator.storage.persist(); } catch {}
}
$('settingsBtn').onclick = async () => {
  let usage = '';
  try {
    const est = await navigator.storage.estimate();
    usage = `${(est.usage / 1048576).toFixed(1)} MB used on this phone`;
  } catch {}
  let persisted = false;
  try { persisted = await navigator.storage.persisted(); } catch {}
  const last = +localStorage.getItem('lastBackup') || 0;
  sheet('Settings', [
    { label: 'Reading theme' },
    ...THEMES.map(([k, name]) => ({ text: name, on: k === theme, keepOpen: true, run: () => { applyTheme(k); $('settingsBtn').onclick(); } })),
    { label: 'Backup' },
    { text: 'Full backup: files, notes and positions', sub: '.zip', run: fullBackup },
    { text: 'Notes and positions only', sub: '.json', run: notesBackup },
    { text: 'Restore from a backup', run: () => $('restoreInput').click() },
    { note: `Last full backup: ${last ? fmtDate(last) : 'never'}. Save the backup to iCloud Drive in Files, so your library survives a lost phone or a deleted app.` },
    { note: `${usage ? esc(usage) + '. ' : ''}${persisted ? 'The phone has agreed to keep this storage.' : 'Storage is not yet marked as permanent; installing to the home screen helps.'}` },
  ]);
};
async function fullBackup() {
  $('loading').hidden = false;
  $('loadingText').textContent = 'Preparing backup…';
  try {
    const docs = await idb.all('docs');
    const notes = await idb.all('notes');
    const entries = [];
    const used = new Set();
    for (const d of docs) {
      const f = await idb.get('files', d.id);
      if (!f) continue;
      let path = `files/${safeName(d.name)}.${EXT[d.type || 'pdf']}`;
      if (used.has(path)) path = `files/${safeName(d.name)} ${d.id.slice(0, 6)}.${EXT[d.type || 'pdf']}`;
      used.add(path);
      d.zipPath = path;
      entries.push({ name: path, data: new Uint8Array(f.data) });
    }
    const manifest = { app: 'dark-reader', version: 2, exported: new Date().toISOString(), docs, notes };
    entries.unshift({ name: 'reader-backup.json', data: new TextEncoder().encode(JSON.stringify(manifest)) });
    const zip = makeZip(entries);
    $('loading').hidden = true;
    const day = new Date().toISOString().slice(0, 10);
    if (await shareOrDownload(`Reader backup ${day}.zip`, zip, 'application/zip')) {
      localStorage.setItem('lastBackup', Date.now());
      renderLibrary();
    }
  } catch (e) {
    $('loading').hidden = true;
    toast('Backup failed: ' + (e.message || e), 4000);
  }
}
async function notesBackup() {
  const docs = (await idb.all('docs')).map(({ thumb, ...d }) => d);
  const notes = await idb.all('notes');
  const data = { app: 'dark-reader', version: 2, exported: new Date().toISOString(), docs, notes };
  const day = new Date().toISOString().slice(0, 10);
  await shareOrDownload(`Reader notes ${day}.json`, JSON.stringify(data, null, 1), 'application/json');
}
async function restoreData(data, files = {}) {
  if (data.app !== 'dark-reader') throw new Error('This is not a Reader backup');
  let fileCount = 0;
  for (const d of data.docs || []) {
    if (d.zipPath && files[d.zipPath]) { await idb.put('files', { id: d.id, data: files[d.zipPath] }); fileCount++; }
    const cur = await idb.get('docs', d.id);
    const { zipPath, ...rest } = d;
    await idb.put('docs', cur ? { ...cur, ...rest, thumb: cur.thumb || rest.thumb } : rest);
  }
  for (const n of data.notes || []) await idb.put('notes', n);
  return `Restored ${data.docs?.length || 0} documents${fileCount ? ` (${fileCount} files)` : ''} and ${data.notes?.length || 0} notes`;
}
$('restoreInput').addEventListener('change', async (e) => {
  const f = e.target.files[0];
  e.target.value = '';
  if (!f) return;
  $('loading').hidden = false;
  $('loadingText').textContent = 'Restoring…';
  try {
    let msg;
    if (/\.zip$/i.test(f.name) || f.type.includes('zip')) {
      const files = await readZip(await f.arrayBuffer());
      const man = files['reader-backup.json'];
      if (!man) throw new Error('This ZIP is not a Reader backup');
      msg = await restoreData(JSON.parse(new TextDecoder().decode(man)), files);
    } else {
      msg = await restoreData(JSON.parse(await f.text()));
    }
    askPersist();
    toast(msg, 3500);
  } catch (err) {
    toast('Restore failed: ' + (err.message || err), 4000);
  }
  $('loading').hidden = true;
  renderLibrary();
});

function showInstallHint() {
  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const el = $('installHint');
  if (standalone || localStorage.getItem('hideInstallHint')) { el.hidden = true; return; }
  el.innerHTML = ios
    ? 'To install: tap <b>Share</b>, then <b>Add to Home Screen</b>. Then open Reader from your home screen and add your files there, because the home-screen app keeps its own storage. <button class="text-btn" id="hideHint">OK</button>'
    : 'To install: open the browser menu and choose <b>Install app</b> or <b>Add to Home screen</b>. <button class="text-btn" id="hideHint">OK</button>';
  el.hidden = false;
  $('hideHint').onclick = () => { localStorage.setItem('hideInstallHint', '1'); el.hidden = true; };
}
function showBackupHint(docCount) {
  const el = $('backupHint');
  const last = +localStorage.getItem('lastBackup') || 0;
  const snoozed = +localStorage.getItem('backupSnooze') || 0;
  const due = docCount > 0 && Date.now() - last > 14 * DAY && Date.now() - snoozed > 3 * DAY;
  if (!due) { el.hidden = true; return; }
  el.innerHTML = `Your files and notes live only on this phone. ${last ? `Last full backup: ${fmtDate(last)}.` : 'You have no backup yet.'} Save one to iCloud Drive so nothing is lost.
    <div class="row"><button class="primary-btn" id="backupNow">Back up now</button><button class="text-btn" id="backupLater">Later</button></div>`;
  el.hidden = false;
  $('backupNow').onclick = fullBackup;
  $('backupLater').onclick = () => { localStorage.setItem('backupSnooze', Date.now()); el.hidden = true; };
}

// ---------- Reader state ----------
const scroller = $('scroller');
const pagesEl = $('pages');
const S = {
  session: 0,
  doc: null,
  type: 'pdf',
  pdf: null,
  pages: [], // PDF: { n, w, h, el, tl, hl, pins, canvas, scale, task, taskScale, textScale, top, left, cssW, cssH }
  article: null, // Markdown: the rendered <article>
  blocks: [], // Markdown: top-level elements of the article
  base: 1,
  zoom: 1,
  notes: [],
  placing: false,
  padTop: 0,
};
const scale = () => S.base * S.zoom;
const isPdf = () => S.type === 'pdf';

async function openDoc(id) {
  if (S.doc) teardown();
  const sess = ++S.session;
  const doc = await idb.get('docs', id);
  const file = await idb.get('files', id);
  if (!doc || !file) { toast('File not found on this device'); return; }
  $('library').hidden = true;
  $('reader').hidden = false;
  $('loading').hidden = false;
  $('loadingText').textContent = 'Opening…';
  $('docTitle').textContent = doc.name;
  document.title = doc.name;
  document.body.classList.remove('immersive');
  if (history.state?.reader) history.replaceState({ reader: id }, '');
  else history.pushState({ reader: id }, '');
  S.type = doc.type || 'pdf';
  S.zoom = doc.zoom || 1;
  scroller.scrollLeft = 0;
  try {
    if (isPdf()) { if (!(await openPdf(doc, file, sess))) return; }
    else openText(doc, file);
  } catch (e) {
    $('loading').hidden = true;
    toast('Could not open this file: ' + (e.message || e), 4000);
    if (sess === S.session) closeReader();
    return;
  }
  if (sess !== S.session) return;
  S.doc = doc;
  S.notes = await idb.notesOf(id);
  if (sess !== S.session) return;
  drawNotes();
  restorePos({ page: doc.page || 1, offset: doc.offset || 0 });
  $('loading').hidden = true;
  doc.opened = Date.now();
  idb.put('docs', doc);
  update();
}

async function openPdf(doc, file, sess) {
  const pdf = await loadPdf(new Uint8Array(file.data));
  if (sess !== S.session) { pdf.destroy(); return false; }
  S.pdf = pdf;
  // read every page size up front so scroll positions are exact
  const sizes = [];
  for (let i = 1; i <= pdf.numPages; i += 25) {
    const batch = [];
    for (let j = i; j < i + 25 && j <= pdf.numPages; j++) {
      batch.push(pdf.getPage(j).then((p) => { const v = p.getViewport({ scale: 1 }); return { w: v.width, h: v.height }; }));
    }
    sizes.push(...await Promise.all(batch));
    if (sess !== S.session) return false;
  }
  pagesEl.classList.remove('md-mode');
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
  doc.pages = pdf.numPages;
  layout();
  return true;
}

function renderMarkdown(text, type) {
  if (type === 'txt') {
    return text.split(/\r?\n\s*\r?\n/).map((p) => `<p>${esc(p).replace(/\r?\n/g, '<br>')}</p>`).join('');
  }
  let props = '';
  const fm = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (fm) {
    props = `<details class="props"><summary>Properties</summary><pre>${esc(fm[1])}</pre></details>`;
    text = text.slice(fm[0].length);
  }
  // Obsidian [[links]] become plain highlighted words
  text = text.replace(/!?\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, a, b) => `<span class="wikilink">${esc(b || a)}</span>`);
  const html = marked.parse(text, { gfm: true, async: false });
  return DOMPurify.sanitize(props + html);
}
function openText(doc, file) {
  const text = new TextDecoder().decode(file.data);
  const article = document.createElement('article');
  article.className = 'md';
  article.innerHTML = renderMarkdown(text, doc.type);
  article.querySelectorAll('p, li, h1, h2, h3, h4, h5, h6, blockquote, td, th, summary').forEach((el) => el.setAttribute('dir', 'auto'));
  article.querySelectorAll('a[href]').forEach((a) => {
    if (/^https?:/i.test(a.getAttribute('href'))) { a.target = '_blank'; a.rel = 'noopener'; }
  });
  pagesEl.replaceChildren(article);
  pagesEl.classList.add('md-mode');
  S.article = article;
  S.blocks = [...article.children];
  if (!S.blocks.length) { article.innerHTML = '<p class="muted">This file is empty.</p>'; S.blocks = [...article.children]; }
  applyMdSize();
}
function applyMdSize() {
  S.article.style.setProperty('--md-size', (18 * S.zoom).toFixed(1) + 'px');
  S.padTop = S.article.offsetTop;
}

function teardown() {
  savePos(true);
  S.session++;
  for (const p of S.pages) releasePage(p);
  S.pages = [];
  S.article = null;
  S.blocks = [];
  pagesEl.replaceChildren();
  pagesEl.classList.remove('md-mode');
  if (S.pdf) S.pdf.destroy();
  S.pdf = null; S.doc = null;
  S.notes = [];
  setPlacing(false);
  $('selNoteBtn').hidden = true;
}
function closeReader() {
  teardown();
  $('reader').hidden = true;
  $('library').hidden = false;
  $('loading').hidden = true;
  document.title = 'Reader';
  renderLibrary();
}
$('backBtn').onclick = () => { if (history.state?.reader) history.back(); else closeReader(); };
window.addEventListener('popstate', () => { if (!$('reader').hidden) closeReader(); });

// ---------- File switcher ----------
async function renderFilesPanel() {
  const { docs, have, counts } = await libraryData();
  const q = $('filesSearch').value.trim().toLowerCase();
  const list = $('filesList');
  list.replaceChildren();
  const shown = docs.filter((d) => !q || d.name.toLowerCase().includes(q));
  for (const d of shown) {
    if (S.doc && d.id === S.doc.id) Object.assign(d, { page: S.doc.page, progress: S.doc.progress });
    const el = docCard(d, { have, counts, compact: true, current: S.doc && d.id === S.doc.id });
    el.onclick = () => {
      if (S.doc && d.id === S.doc.id) { $('filesPanel').hidden = true; return; }
      if (!have.has(d.id)) { toast('Add this file again to reconnect it'); return; }
      $('filesPanel').hidden = true;
      openDoc(d.id);
    };
    list.appendChild(el);
  }
  if (!shown.length) list.innerHTML = '<p class="muted">No files match.</p>';
}
$('filesBtn').onclick = () => { savePos(); $('filesSearch').value = ''; renderFilesPanel(); $('filesPanel').hidden = false; };
$('filesClose').onclick = () => { $('filesPanel').hidden = true; };
$('filesSearch').addEventListener('input', debounce(renderFilesPanel, 120));
$('filesAdd').onclick = () => { $('filesPanel').hidden = true; $('fileInput').click(); };

// ---------- PDF layout and rendering ----------
const GAP = 10;
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
function blockAt(y) {
  const bs = S.blocks;
  let lo = 0, hi = bs.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (bs[mid].offsetTop <= y) lo = mid; else hi = mid - 1;
  }
  return lo;
}
const progressNow = () => clamp(scroller.scrollTop / Math.max(1, scroller.scrollHeight - scroller.clientHeight), 0, 1);

let raf = 0;
function update() {
  if (raf) return;
  raf = requestAnimationFrame(() => {
    raf = 0;
    if (!S.doc) return;
    if (!isPdf()) {
      const label = Math.round(progressNow() * 100) + '%';
      $('pageNow').textContent = label;
      $('pagePill').textContent = label;
      return;
    }
    if (!S.pages.length) return;
    const top = scroller.scrollTop;
    const bottom = top + scroller.clientHeight;
    const first = pageAt(top).n - 1;
    const last = pageAt(bottom).n - 1;
    const cur = pageAt(top + scroller.clientHeight * 0.3).n;
    const label = `${cur} / ${S.pages.length}`;
    $('pageNow').textContent = label;
    $('pagePill').textContent = label;
    for (const p of S.pages) {
      const i = p.n - 1;
      if (i >= first - 1 && i <= last + 1) renderPage(p);
      else if (i < first - 2 || i > last + 2) releasePage(p);
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
  } catch {
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
// PDF: page number + how far down that page. Markdown: block number + how far down that block.
// Both survive a change of text size or screen width.
function currentPos() {
  const y = scroller.scrollTop + S.padTop;
  if (isPdf()) {
    const p = pageAt(y);
    return { page: p.n, offset: clamp((y - p.top) / (p.cssH || 1), 0, 1) };
  }
  if (!S.blocks.length) return { page: 1, offset: 0 };
  const i = blockAt(y);
  const b = S.blocks[i];
  return { page: i + 1, offset: clamp((y - b.offsetTop) / (b.offsetHeight || 1), 0, 1) };
}
function restorePos(pos) {
  if (isPdf()) {
    const p = S.pages[clamp((pos.page || 1) - 1, 0, S.pages.length - 1)];
    scroller.scrollTop = p.top + (pos.offset || 0) * p.cssH - S.padTop;
  } else if (S.blocks.length) {
    const b = S.blocks[clamp((pos.page || 1) - 1, 0, S.blocks.length - 1)];
    scroller.scrollTop = b.offsetTop + (pos.offset || 0) * b.offsetHeight - S.padTop;
  }
}
function savePos(now) {
  if (!S.doc || (isPdf() ? !S.pages.length : !S.article)) return;
  const pos = currentPos();
  S.doc.page = pos.page;
  S.doc.offset = pos.offset;
  S.doc.progress = progressNow();
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
  if (!S.doc || scroller.clientWidth === lastWidth) return;
  lastWidth = scroller.clientWidth;
  const pos = currentPos();
  if (isPdf()) layout(); else applyMdSize();
  restorePos(pos);
  update();
}, 150));

// ---------- Zoom (buttons and pinch) ----------
function setZoom(z, anchor) {
  if (!S.doc) return;
  z = isPdf() ? clamp(z, 0.5, 5) : clamp(z, 0.6, 2.6);
  if (Math.abs(z - S.zoom) < 0.001) return;
  if (!isPdf()) {
    const pos = currentPos();
    S.zoom = z;
    applyMdSize();
    restorePos(pos);
    update();
    savePosSoon();
    return;
  }
  // keep the point under the fingers (or the middle of the screen) still
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
$('zoomIn').onclick = () => setZoom(S.zoom * (isPdf() ? 1.25 : 1.1));
$('zoomOut').onclick = () => setZoom(S.zoom / (isPdf() ? 1.25 : 1.1));
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
scroller.addEventListener('wheel', (e) => {
  if (!e.ctrlKey) return;
  e.preventDefault();
  setZoom(S.zoom * Math.exp(-e.deltaY / 200), { x: e.clientX, y: e.clientY });
}, { passive: false });

// ---------- Page jump and tapping ----------
$('pageBtn').onclick = () => {
  if (!S.doc) return;
  if (isPdf()) {
    const n = parseInt(prompt(`Go to page (1 to ${S.pages.length})`, pageAt(scroller.scrollTop + S.padTop).n), 10);
    if (n >= 1 && n <= S.pages.length) { restorePos({ page: n, offset: 0 }); update(); savePosSoon(); }
  } else {
    const v = parseFloat(prompt('Go to how far in? (0 to 100%)', Math.round(progressNow() * 100)));
    if (v >= 0 && v <= 100) { scroller.scrollTop = v / 100 * (scroller.scrollHeight - scroller.clientHeight); update(); savePosSoon(); }
  }
};
$('themeBtn').onclick = themeSheet;

let touchMoved = false, touchStartY = 0;
scroller.addEventListener('touchstart', (e) => { touchMoved = false; touchStartY = e.touches[0].clientY; }, { passive: true });
scroller.addEventListener('touchmove', (e) => { if (Math.abs(e.touches[0].clientY - touchStartY) > 8) touchMoved = true; }, { passive: true });

function blockOf(node) {
  let el = node && (node.nodeType === 1 ? node : node.parentNode);
  while (el && el.parentNode !== S.article) el = el.parentNode;
  return el || null;
}
scroller.addEventListener('click', (e) => {
  const pin = e.target.closest('.pin');
  if (pin) { editNote(S.notes.find((n) => n.id === pin.dataset.id)); return; }
  const mark = e.target.closest('mark.hl-md');
  if (mark && !S.placing) { editNote(S.notes.find((n) => n.id === mark.dataset.id)); return; }
  const link = e.target.closest('a[href]');
  if (link && S.article?.contains(link)) {
    const href = link.getAttribute('href');
    if (/^https?:/i.test(href)) return; // opens in a new tab
    e.preventDefault();
    if (href.startsWith('#')) {
      const t = S.article.querySelector(`[id="${CSS.escape(decodeURIComponent(href.slice(1)))}"]`);
      if (t) scroller.scrollTop += t.getBoundingClientRect().top - scroller.getBoundingClientRect().top - S.padTop;
    }
    return;
  }
  if (S.placing) {
    if (isPdf()) {
      const pageEl = e.target.closest('.page');
      if (!pageEl) return;
      const r = pageEl.getBoundingClientRect();
      const x = clamp((e.clientX - r.left) / r.width, 0.02, 0.98);
      const y = clamp((e.clientY - r.top) / r.height, 0.01, 0.99);
      setPlacing(false);
      newNote({ page: +pageEl.dataset.n, x, y });
    } else {
      let b = blockOf(e.target);
      const i = b ? S.blocks.indexOf(b) : blockAt(e.clientY - scroller.getBoundingClientRect().top + scroller.scrollTop);
      setPlacing(false);
      newNote(mdAnchor(i, 0, i, 0, ''));
    }
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

function headingFor(i) {
  for (let k = i; k >= 0; k--) {
    if (/^H[1-6]$/.test(S.blocks[k]?.tagName)) return S.blocks[k].textContent.trim().slice(0, 60);
  }
  return 'Start';
}
function mdAnchor(b0, o0, b1, o1, quote) {
  return { kind: 'md', b0, o0, b1, o1, quote, page: b0 + 1, x: 0, y: o0 / 1e6, label: headingFor(b0) };
}
const noteLabel = (n) => (n.kind === 'md' ? n.label || 'Start' : `Page ${n.page}`);
const byPlace = (a, b) => a.page - b.page || a.y - b.y || (a.x || 0) - (b.x || 0);

function makePin(n) {
  const pin = document.createElement('button');
  pin.className = 'pin c-' + (n.color || 'yellow');
  pin.dataset.id = n.id;
  pin.setAttribute('aria-label', 'Note');
  pin.contentEditable = 'false';
  pin.innerHTML = '<svg viewBox="0 0 24 24" style="width:13px;height:13px;stroke-width:3"><path d="M7 9h10M7 14h6"/></svg>';
  return pin;
}
function drawNotes() {
  S.notes.sort(byPlace);
  if (isPdf()) drawPdfNotes(); else drawMdNotes();
  const c = S.notes.length;
  $('noteCount').hidden = !c;
  $('noteCount').textContent = c;
}
function drawPdfNotes() {
  for (const p of S.pages) { p.hl.replaceChildren(); p.pins.replaceChildren(); }
  for (const n of S.notes) {
    const p = S.pages[n.page - 1];
    if (!p) continue;
    for (const r of n.rects || []) {
      const h = document.createElement('div');
      h.className = 'hl c-' + (n.color || 'yellow');
      Object.assign(h.style, { left: r.x * 100 + '%', top: r.y * 100 + '%', width: r.w * 100 + '%', height: r.h * 100 + '%' });
      p.hl.appendChild(h);
    }
    const pin = makePin(n);
    pin.style.left = n.x * 100 + '%';
    pin.style.top = n.y * 100 + '%';
    p.pins.appendChild(pin);
  }
}

// Markdown highlights are stored as character positions inside top-level blocks,
// so they land on the same words whatever the text size or screen width.
function pointAt(block, off) {
  const w = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
  let acc = 0, node, last = null;
  while ((node = w.nextNode())) {
    if (acc + node.length >= off) return { node, off: off - acc };
    acc += node.length;
    last = node;
  }
  return last ? { node: last, off: last.length } : null;
}
function charOffset(block, node, off) {
  const r = document.createRange();
  r.setStart(block, 0);
  r.setEnd(node, off);
  return r.toString().length;
}
function wrapRange(range, n) {
  let root = range.commonAncestorContainer;
  if (root.nodeType === 3) root = root.parentNode;
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes = [];
  let node;
  while ((node = w.nextNode())) if (range.intersectsNode(node)) nodes.push(node);
  for (const t of nodes) {
    const start = t === range.startContainer ? range.startOffset : 0;
    const end = t === range.endContainer ? range.endOffset : t.length;
    if (start >= end || !t.data.slice(start, end).trim()) continue;
    if (end < t.length) t.splitText(end);
    const target = start > 0 ? t.splitText(start) : t;
    const m = document.createElement('mark');
    m.className = 'hl-md c-' + (n.color || 'yellow');
    m.dataset.id = n.id;
    target.replaceWith(m);
    m.appendChild(target);
  }
}
function drawMdNotes() {
  const art = S.article;
  art.querySelectorAll('.pin').forEach((p) => p.remove());
  art.querySelectorAll('mark.hl-md').forEach((m) => m.replaceWith(...m.childNodes));
  art.normalize();
  const perBlock = {};
  for (const n of S.notes) {
    const b0 = S.blocks[n.b0];
    if (!b0) continue;
    if (n.quote && S.blocks[n.b1]) {
      try {
        const s = pointAt(b0, n.o0), e = pointAt(S.blocks[n.b1], n.o1);
        if (s && e) {
          const r = document.createRange();
          r.setStart(s.node, s.off);
          r.setEnd(e.node, e.off);
          if (!r.collapsed) wrapRange(r, n);
        }
      } catch (err) { console.warn('highlight skipped', err); }
    }
    const k = (perBlock[n.b0] = (perBlock[n.b0] || 0) + 1);
    const pin = makePin(n);
    pin.style.top = `calc(0.15em + ${(k - 1) * 28}px)`;
    b0.appendChild(pin);
  }
}

let editing = null;
let editColor = localStorage.getItem('noteColor') || 'yellow';
function openEditor(note, isNew) {
  editing = { note, isNew };
  $('noteSheetTitle').textContent = `${isNew ? 'New note' : 'Note'} · ${noteLabel(note)}`;
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
  getSelection()?.removeAllRanges();
  const pos = currentPos();
  drawNotes();
  restorePos(pos);
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
  if (!sel || sel.isCollapsed || !sel.rangeCount || !S.doc) return null;
  const range = sel.getRangeAt(0);
  const quote = sel.toString().replace(/\s+\n/g, '\n').trim();
  if (!quote) return null;
  if (!isPdf()) {
    if (!S.article || !S.article.contains(range.commonAncestorContainer)) return null;
    const bs = blockOf(range.startContainer), be = blockOf(range.endContainer);
    if (!bs || !be) return null;
    const b0 = S.blocks.indexOf(bs), b1 = S.blocks.indexOf(be);
    if (b0 < 0 || b1 < 0) return null;
    return mdAnchor(b0, charOffset(bs, range.startContainer, range.startOffset), b1, charOffset(be, range.endContainer, range.endOffset), quote);
  }
  const node = range.startContainer.nodeType === 1 ? range.startContainer : range.startContainer.parentElement;
  const pageEl = node?.closest?.('.page');
  if (!pageEl || !pagesEl.contains(pageEl)) return null;
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
  // the pin goes in the left margin, beside the first highlighted line
  return { page: +pageEl.dataset.n, quote, rects, x: clamp(Math.min(first.x - 0.035, 0.04), 0.025, 0.98), y: clamp(first.y + first.h / 2, 0.01, 0.99) };
}
document.addEventListener('selectionchange', debounce(() => {
  if ($('reader').hidden) return;
  const s = readSelection();
  if (s) lastSel = s;
  $('selNoteBtn').hidden = !s;
}, 120));
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
    list.innerHTML = `<p class="muted">${S.notes.length ? 'No notes match.' : 'No notes yet. Tap <b>Note</b> and then a spot in the text, or select some text and tap <b>Highlight and note</b>.'}</p>`;
    return;
  }
  for (const n of ns) {
    const b = document.createElement('button');
    b.className = 'note-item c-' + (n.color || 'yellow');
    b.innerHTML = `<span class="note-page" dir="auto">${esc(noteLabel(n))}</span>${n.quote ? `<span class="note-quote" dir="auto">“${esc(n.quote)}”</span>` : ''}${n.text ? `<span class="note-text" dir="auto">${esc(n.text)}</span>` : ''}`;
    b.onclick = () => { $('notesPanel').hidden = true; goToNote(n); };
    list.appendChild(b);
  }
}
function flash(el) { el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash'); }
function goToNote(n) {
  if (isPdf()) {
    const p = S.pages[n.page - 1];
    scroller.scrollTop = p.top + n.y * p.cssH - scroller.clientHeight * 0.35;
    const pin = p.pins.querySelector(`[data-id="${n.id}"]`);
    if (pin) flash(pin);
  } else {
    const el = S.article.querySelector(`mark[data-id="${n.id}"]`) || S.blocks[n.b0];
    if (el) scroller.scrollTop += el.getBoundingClientRect().top - scroller.getBoundingClientRect().top - scroller.clientHeight * 0.35;
    const pin = S.article.querySelector(`.pin[data-id="${n.id}"]`);
    if (pin) flash(pin);
  }
  update();
  savePosSoon();
}
$('notesBtn').onclick = () => { $('notesSearch').value = ''; renderNotesList(); $('notesPanel').hidden = false; };
$('notesClose').onclick = () => { $('notesPanel').hidden = true; };
$('notesSearch').addEventListener('input', renderNotesList);

function notesMarkdown(doc, notes) {
  const lines = [`# Notes: ${doc.name}`, '', `Exported ${new Date().toLocaleString()} · ${notes.length} note${notes.length === 1 ? '' : 's'}`, ''];
  let group = null;
  for (const n of notes) {
    const label = noteLabel(n);
    if (label !== group) { group = label; lines.push(`## ${label}`, ''); }
    if (n.quote) lines.push(...n.quote.split('\n').map((l) => '> ' + l), '');
    if (n.text) lines.push(n.text, '');
  }
  return lines.join('\n');
}
async function exportNotes(doc) {
  const notes = (doc.id === S.doc?.id ? S.notes : await idb.notesOf(doc.id)).slice().sort(byPlace);
  if (!notes.length) { toast('No notes in this file yet'); return; }
  await shareOrDownload(`${safeName(doc.name)} - notes.md`, notesMarkdown(doc, notes));
}
$('notesExport').onclick = () => S.doc && exportNotes(S.doc);
$('notesCopy').onclick = async () => {
  if (!S.notes.length) { toast('No notes yet'); return; }
  try {
    await navigator.clipboard.writeText(notesMarkdown(S.doc, S.notes.slice().sort(byPlace)));
    toast('Copied');
  } catch { toast('Copy failed'); }
};

document.addEventListener('keydown', (e) => {
  if ($('reader').hidden || e.target.matches('textarea, input')) return;
  if ((e.key === '+' || e.key === '=') && !e.metaKey) setZoom(S.zoom * 1.25);
  else if (e.key === '-' && !e.metaKey) setZoom(S.zoom / 1.25);
  else if (e.key === 'Escape') setPlacing(false);
});

// ---------- Start ----------
if ('serviceWorker' in navigator) {
  // On the first visit there is no old version to replace, so never reload then.
  const hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.register('./sw.js').catch((e) => console.warn('Service worker failed', e));
  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    // a new version was installed; reload only when nothing is open or in progress
    if (!hadController || reloaded || S.doc || !$('loading').hidden) return;
    reloaded = true;
    location.reload();
  });
}
history.replaceState({ library: true }, '');
if (matchMedia('(display-mode: standalone)').matches || navigator.standalone) askPersist();
await renderLibrary();
