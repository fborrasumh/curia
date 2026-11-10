"use strict";
/* ── utilidades comunes (todas las apps Forja) ──────────────────────────────
   Requiere que la app defina antes:  const APP = 'miapp';  (prefijo de almacenamiento)  */
const $ = id => document.getElementById(id), $$ = s => [...document.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const ico = n => `<svg class="i"><use href="#i-${n}"/></svg>`;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const uid = (p = '') => p + Math.random().toString(36).slice(2, 8);
const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
const wc = s => (String(s || '').trim().match(/[\p{L}\p{N}]+/gu) || []).length;
const chunk = (a, n) => { const o = []; for (let i = 0; i < a.length; i += n) o.push(a.slice(i, i + n)); return o; };
const nf = n => Math.round(n).toLocaleString(typeof locale === 'function' ? locale() : 'es-ES');
const mmss = s => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;
const slug = s => norm(s).replace(/ /g, '_').slice(0, 40) || 'x';
function toast(m, ms = 4200) { const t = $('toast'); t.textContent = m; t.classList.add('on'); clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('on'), ms); }
function dl(nombre, contenido, tipo) { const b = contenido instanceof Blob ? contenido : new Blob([contenido], {type: tipo}); const u = URL.createObjectURL(b); const a = document.createElement('a'); a.href = u; a.download = nombre; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 2500); }

/* librerías externas (solo para LEER ficheros: Word, PDF, PowerPoint). Escribir Word/ZIP no necesita ninguna (70-report).
   Cada librería tiene un espejo: si cdnjs falla (URL retirada, bloqueador, proxy), se prueba jsDelivr con la misma versión.
   La CSP de build.py admite los dos orígenes. Las URLs están comprobadas contra el paquete npm de esa versión. */
const LIB = {
  mammoth: 'https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js',
  jszip: 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js',
  pdf: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
  pdfw: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js',
  docx: 'https://cdn.jsdelivr.net/npm/docx@8.5.0/build/index.umd.js'   // obsoleto: usa wordDeMarkdown / wordDeXml (sin red)
};
const LIB_ESPEJO = {
  [LIB.mammoth]: 'https://cdn.jsdelivr.net/npm/mammoth@1.6.0/mammoth.browser.min.js',
  [LIB.jszip]: 'https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js',
  [LIB.pdf]: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js',
  [LIB.pdfw]: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js'
};
const LIB_GLOBAL = {[LIB.mammoth]: 'mammoth', [LIB.jszip]: 'JSZip', [LIB.pdf]: 'pdfjsLib', [LIB.docx]: 'docx'};
const _libNombre = u => (u.match(/\/(?:libs|npm)\/([^/@]+)/) || [, 'externa'])[1];
const _cargaScript = u => new Promise((ok, ko) => { const s = document.createElement('script'); s.src = u; const tm = setTimeout(() => { s.remove(); ko(); }, 20000); s.onload = () => { clearTimeout(tm); ok(); }; s.onerror = () => { clearTimeout(tm); s.remove(); ko(); }; document.head.appendChild(s); });
const _libCargadas = {};
/* cargaLib([LIB.x, …]) carga en orden; cada una prueba cdnjs y luego su espejo; no recarga lo ya cargado */
async function cargaLib(urls) {
  for (const u of urls) {
    const g = LIB_GLOBAL[u]; if ((g && window[g]) || _libCargadas[u]) continue;
    let hecho = false, v_ok = u;
    for (const v of [u, LIB_ESPEJO[u]].filter(Boolean)) { try { await _cargaScript(v); hecho = true; v_ok = v; break; } catch {} }
    if (!hecho) throw new Error(navigator.onLine === false ? t('Sin conexión: hace falta internet para abrir este tipo de fichero la primera vez.') : t('No se pudo cargar la librería {0}. Puede que un bloqueador o la red de tu institución la impida; prueba otra red o desactiva el bloqueador en esta página.', _libNombre(u)));
    _libCargadas[u] = v_ok;
  }
}

/* huella SHA-256 (con alternativa para file:// sin contexto seguro) y canonización estable */
const canon = v => v === null || typeof v !== 'object' ? JSON.stringify(v) : Array.isArray(v) ? '[' + v.map(canon).join(',') + ']' : '{' + Object.keys(v).filter(k => v[k] !== undefined).sort().map(k => JSON.stringify(k) + ':' + canon(v[k])).join(',') + '}';
function sha256js(bytes) {
  const pr = []; for (let n = 2; pr.length < 64; n++) if (pr.every(p => n % p)) pr.push(n);
  const fr = x => Math.floor((x - Math.floor(x)) * 4294967296), K = pr.map(p => fr(Math.cbrt(p))), H = pr.slice(0, 8).map(p => fr(Math.sqrt(p)));
  const l = bytes.length, pad = new Uint8Array(((l + 9 + 63) >> 6) << 6); pad.set(bytes); pad[l] = 0x80;
  const dv = new DataView(pad.buffer); dv.setUint32(pad.length - 8, Math.floor(l * 8 / 4294967296)); dv.setUint32(pad.length - 4, (l * 8) >>> 0);
  const rr = (x, n) => (x >>> n) | (x << (32 - n)), W = new Uint32Array(64);
  for (let i = 0; i < pad.length; i += 64) {
    for (let t = 0; t < 16; t++) W[t] = dv.getUint32(i + t * 4);
    for (let t = 16; t < 64; t++) { const s0 = rr(W[t - 15], 7) ^ rr(W[t - 15], 18) ^ (W[t - 15] >>> 3), s1 = rr(W[t - 2], 17) ^ rr(W[t - 2], 19) ^ (W[t - 2] >>> 10); W[t] = (W[t - 16] + s0 + W[t - 7] + s1) >>> 0; }
    let [a, b, c, d, e, f, g, hh] = H;
    for (let t = 0; t < 64; t++) { const S1 = rr(e, 6) ^ rr(e, 11) ^ rr(e, 25), ch = (e & f) ^ (~e & g), t1 = (hh + S1 + ch + K[t] + W[t]) >>> 0, S0 = rr(a, 2) ^ rr(a, 13) ^ rr(a, 22), mj = (a & b) ^ (a & c) ^ (b & c), t2 = (S0 + mj) >>> 0; hh = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0; }
    [a, b, c, d, e, f, g, hh].forEach((v, j) => H[j] = (H[j] + v) >>> 0);
  }
  return H.map(v => v.toString(16).padStart(8, '0')).join('');
}
async function sha256(str) {
  const b = new TextEncoder().encode(str);
  if (window.crypto?.subtle) { try { return [...new Uint8Array(await crypto.subtle.digest('SHA-256', b))].map(x => x.toString(16).padStart(2, '0')).join(''); } catch {} }
  return sha256js(b);
}
