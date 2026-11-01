// Builds files to send to other people: a PDF with Harun's highlights and comments inside it,
// and Markdown with comments. Loaded only when he taps "Send with comments".
import { PDFDocument, PDFName, PDFArray, PDFString, PDFHexString, StandardFonts } from './vendor/pdf-lib.esm.min.js';
import { marked } from './vendor/marked.esm.js';

const RGB = { yellow: [1, 0.77, 0], green: [0.24, 0.82, 0.43], blue: [0.27, 0.59, 1], pink: [1, 0.35, 0.67] };
const CSS_COLOR = { yellow: '#ffc400', green: '#3cd26e', blue: '#4696ff', pink: '#ff5aaa' };
const n2 = (v) => (Math.round(v * 100) / 100).toString();
const RTL = /[֐-ࣿיִ-﷿ﹰ-﻿]/;

// Turns a point measured on the screen (0..1 across, 0..1 down) into PDF page coordinates.
function mapper(page) {
  const { x, y, width: w, height: h } = page.getCropBox();
  const rot = ((page.getRotation().angle % 360) + 360) % 360;
  return (fx, fy) => {
    switch (rot) {
      case 90: return [x + fy * w, y + fx * h];
      case 180: return [x + (1 - fx) * w, y + fy * h];
      case 270: return [x + (1 - fy) * w, y + (1 - fx) * h];
      default: return [x + fx * w, y + (1 - fy) * h];
    }
  };
}
function circlePath(cx, cy, r) {
  const k = 0.5523 * r;
  return `${n2(cx + r)} ${n2(cy)} m ${n2(cx + r)} ${n2(cy + k)} ${n2(cx + k)} ${n2(cy + r)} ${n2(cx)} ${n2(cy + r)} c `
    + `${n2(cx - k)} ${n2(cy + r)} ${n2(cx - r)} ${n2(cy + k)} ${n2(cx - r)} ${n2(cy)} c `
    + `${n2(cx - r)} ${n2(cy - k)} ${n2(cx - k)} ${n2(cy - r)} ${n2(cx)} ${n2(cy - r)} c `
    + `${n2(cx + k)} ${n2(cy - r)} ${n2(cx + r)} ${n2(cy - k)} ${n2(cx + r)} ${n2(cy)} c`;
}

/**
 * Returns the bytes of a new PDF: the original pages, plus
 * - a highlight annotation for each highlighted passage,
 * - a numbered comment marker (a standard PDF "note" that opens the comment when tapped),
 * - "Comments" pages at the end listing every comment by number, for apps that hide annotations.
 */
export async function annotatedPdf({ data, docName, notes, author }) {
  const pdf = await PDFDocument.load(data, { ignoreEncryption: true, updateMetadata: false });
  const ctx = pdf.context;
  const font = await pdf.embedFont(StandardFonts.HelveticaBold);
  const pages = pdf.getPages();
  const when = PDFString.fromDate(new Date());
  const list = notes.filter((n) => pages[n.page - 1]).map((n, i) => ({ ...n, num: i + 1 }));

  for (const n of list) {
    const page = pages[n.page - 1];
    const map = mapper(page);
    const color = RGB[n.color] || RGB.yellow;
    const rgb = color.join(' ');
    const body = (n.quote ? `“${n.quote}”\n\n` : '') + (n.text || '');
    const common = {
      Type: 'Annot',
      T: PDFHexString.fromText(author),
      M: when,
      Contents: PDFHexString.fromText(body),
      NM: PDFHexString.fromText('reader-' + n.id),
      C: color,
    };
    const refs = [];

    if (n.rects?.length) {
      const quads = [], paths = [];
      let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
      for (const r of n.rects) {
        const ul = map(r.x, r.y), ur = map(r.x + r.w, r.y), ll = map(r.x, r.y + r.h), lr = map(r.x + r.w, r.y + r.h);
        quads.push(...ul, ...ur, ...ll, ...lr);
        for (const [px, py] of [ul, ur, ll, lr]) {
          x1 = Math.min(x1, px); y1 = Math.min(y1, py); x2 = Math.max(x2, px); y2 = Math.max(y2, py);
        }
        paths.push(`${n2(ul[0])} ${n2(ul[1])} m ${n2(ur[0])} ${n2(ur[1])} l ${n2(lr[0])} ${n2(lr[1])} l ${n2(ll[0])} ${n2(ll[1])} l h f`);
      }
      const rect = [x1, y1, x2, y2];
      const ap = ctx.register(ctx.stream(`/GS0 gs ${rgb} rg\n${paths.join('\n')}`, {
        Type: 'XObject', Subtype: 'Form', BBox: rect,
        Resources: { ExtGState: { GS0: { Type: 'ExtGState', ca: 0.4, CA: 0.4, BM: 'Multiply' } } },
      }));
      refs.push(ctx.register(ctx.obj({ ...common, Subtype: 'Highlight', F: 4, Rect: rect, QuadPoints: quads, CA: 0.4, AP: { N: ap } })));
    }

    const [cx, cy] = map(n.x, n.y);
    const R = 8;
    const rect = [cx - R, cy - R, cx + R, cy + R];
    const label = String(n.num);
    const size = label.length > 2 ? 6 : 8;
    const tw = font.widthOfTextAtSize(label, size);
    const marker = `q ${rgb} rg 0.15 0.15 0.15 RG 0.8 w ${circlePath(cx, cy, R - 0.6)} B Q `
      + `BT /F1 ${size} Tf 0.08 0.08 0.08 rg ${n2(cx - tw / 2)} ${n2(cy - size * 0.36)} Td (${label}) Tj ET`;
    const markerAp = ctx.register(ctx.stream(marker, {
      Type: 'XObject', Subtype: 'Form', BBox: rect, Resources: { Font: { F1: font.ref } },
    }));
    refs.push(ctx.register(ctx.obj({ ...common, Subtype: 'Text', F: 4, Rect: rect, Name: 'Comment', Open: false, AP: { N: markerAp } })));

    const annots = page.node.lookupMaybe(PDFName.of('Annots'), PDFArray);
    if (annots) refs.forEach((r) => annots.push(r));
    else page.node.set(PDFName.of('Annots'), ctx.obj(refs));
  }

  if (list.length) {
    const first = pages[0].getSize();
    let [W, H] = [first.width, first.height];
    if (W > H || W < 300) [W, H] = [612, 792];
    for (const png of await summaryPages(list, { W, H, docName, author })) {
      const img = await pdf.embedPng(png);
      const pg = pdf.addPage([W, H]);
      pg.drawImage(img, { x: 0, y: 0, width: W, height: H });
    }
  }
  return pdf.save();
}

// Draws the "Comments" pages on a canvas, so Arabic and Somali text is shaped by the browser.
async function summaryPages(list, { W, H, docName, author }) {
  const S = 2.5, M = 50, FONT = '-apple-system, "Helvetica Neue", Helvetica, Arial, "Geeza Pro", "Noto Naskh Arabic", sans-serif';
  const out = [];
  let canvas, c, y;
  const newPage = (firstPage) => {
    canvas = document.createElement('canvas');
    canvas.width = Math.round(W * S); canvas.height = Math.round(H * S);
    c = canvas.getContext('2d');
    c.scale(S, S);
    c.fillStyle = '#fff'; c.fillRect(0, 0, W, H);
    c.textBaseline = 'alphabetic';
    y = M;
    if (firstPage) {
      c.fillStyle = '#111'; c.font = `700 17px ${FONT}`;
      y += 6;
      for (const line of wrap(c, `Comments: ${docName}`, W - 2 * M)) { text(line, M, y + 12, W - 2 * M); y += 22; }
      c.fillStyle = '#666'; c.font = `400 10px ${FONT}`;
      const date = new Date().toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });
      text(`From ${author} · ${date} · ${list.length} comment${list.length === 1 ? '' : 's'}`, M, y + 8, W - 2 * M); y += 16;
      text('Each number matches a numbered circle on the script. Tap a circle there to read the comment in place.', M, y + 8, W - 2 * M); y += 22;
    } else {
      c.fillStyle = '#888'; c.font = `400 9px ${FONT}`;
      text(`Comments: ${docName} (continued)`, M, y + 6, W - 2 * M); y += 20;
    }
    c.strokeStyle = '#ddd'; c.lineWidth = 0.8;
    c.beginPath(); c.moveTo(M, y); c.lineTo(W - M, y); c.stroke();
    y += 16;
  };
  function text(s, x, yy, width) {
    const rtl = RTL.test(s);
    c.direction = rtl ? 'rtl' : 'ltr';
    c.textAlign = rtl ? 'right' : 'left';
    c.fillText(s, rtl ? x + width : x, yy);
  }
  const finish = async () => {
    const blob = await new Promise((r) => canvas.toBlob(r, 'image/png'));
    out.push(new Uint8Array(await blob.arrayBuffer()));
    canvas.width = canvas.height = 0;
  };

  newPage(true);
  const IND = 26, width = W - 2 * M - IND;
  for (const n of list) {
    c.font = `italic 400 10px ${FONT}`;
    const q = n.quote ? wrap(c, `“${n.quote}”`, width) : [];
    c.font = `400 11.5px ${FONT}`;
    const t = n.text ? wrap(c, n.text, width) : [];
    const need = 16 + q.length * 14 + t.length * 16 + 14;
    if (y + Math.min(need, 120) > H - M) { await finish(); newPage(false); }
    // number circle
    c.fillStyle = CSS_COLOR[n.color] || CSS_COLOR.yellow;
    c.strokeStyle = '#333'; c.lineWidth = 0.8;
    c.beginPath(); c.arc(M + 9, y + 5, 8.5, 0, Math.PI * 2); c.fill(); c.stroke();
    c.fillStyle = '#111'; c.font = `700 ${n.num > 99 ? 7 : 8.5}px ${FONT}`; c.textAlign = 'center'; c.direction = 'ltr';
    c.fillText(String(n.num), M + 9, y + 8);
    c.fillStyle = '#777'; c.font = `700 9px ${FONT}`; c.textAlign = 'left';
    c.fillText(n.label || `Page ${n.page}`, M + IND, y + 8);
    y += 18;
    c.fillStyle = '#555'; c.font = `italic 400 10px ${FONT}`;
    for (const line of q) {
      if (y > H - M) { await finish(); newPage(false); c.fillStyle = '#555'; c.font = `italic 400 10px ${FONT}`; }
      text(line, M + IND, y + 9, width); y += 14;
    }
    if (q.length && t.length) y += 3;
    c.fillStyle = '#111'; c.font = `400 11.5px ${FONT}`;
    for (const line of t) {
      if (y > H - M) { await finish(); newPage(false); c.fillStyle = '#111'; c.font = `400 11.5px ${FONT}`; }
      text(line, M + IND, y + 11, width); y += 16;
    }
    y += 14;
  }
  await finish();
  return out;
}

function wrap(c, s, max) {
  const lines = [];
  for (const para of String(s).split('\n')) {
    if (!para.trim()) { lines.push(''); continue; }
    let line = '';
    for (const word of para.split(/\s+/)) {
      const tryLine = line ? line + ' ' + word : word;
      if (c.measureText(tryLine).width <= max) { line = tryLine; continue; }
      if (line) lines.push(line);
      // a single word longer than the line is cut into pieces
      let w = word;
      while (c.measureText(w).width > max) {
        let k = w.length - 1;
        while (k > 1 && c.measureText(w.slice(0, k)).width > max) k--;
        lines.push(w.slice(0, k));
        w = w.slice(k);
      }
      line = w;
    }
    lines.push(line);
  }
  return lines;
}

/**
 * Markdown copy of the file with each comment placed under the paragraph it belongs to,
 * as an Obsidian-style callout, and highlighted words wrapped in ==…==.
 */
export function markdownWithComments({ text, type, notes, author, hasProps }) {
  let front = '';
  const fm = type === 'md' && text.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/);
  if (fm) { front = fm[0]; text = text.slice(fm[0].length); }
  const parts = type === 'md'
    ? marked.lexer(text).map((t) => ({ raw: t.raw, block: t.type !== 'space' && t.type !== 'def' }))
    : text.split(/(\r?\n\s*\r?\n)/).map((raw, i) => ({ raw, block: i % 2 === 0 }));
  const shift = hasProps ? 1 : 0; // the folded "Properties" line counts as the first block on screen
  const byBlock = new Map();
  for (const n of notes) {
    const k = (n.b0 ?? 0) - shift;
    if (!byBlock.has(k)) byBlock.set(k, []);
    byBlock.get(k).push(n);
  }
  const callout = (n) => [`> [!comment] ${author} (${n.num})`, ...(n.text || '').split('\n').map((l) => `> ${l}`)].join('\n');
  let out = front, bi = 0;
  const used = new Set();
  for (const p of parts) {
    if (!p.block) { out += p.raw; continue; }
    let raw = p.raw;
    const ns = byBlock.get(bi) || [];
    for (const n of ns) {
      const q = (n.quote || '').split('\n')[0].trim();
      const at = q ? raw.indexOf(q) : -1;
      if (at >= 0) raw = raw.slice(0, at) + '==' + q + '==' + raw.slice(at + q.length);
    }
    out += raw;
    if (ns.length) {
      out = out.replace(/\s*$/, '') + '\n\n' + ns.map((n) => { used.add(n.id); return callout(n); }).join('\n\n') + '\n';
    }
    bi++;
  }
  const rest = notes.filter((n) => !used.has(n.id));
  if (rest.length) out = out.replace(/\s*$/, '') + '\n\n## More comments\n\n' + rest.map(callout).join('\n\n') + '\n';
  return out;
}
