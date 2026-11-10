/* ── verificación por código de lo que dice la IA, anonimización y Markdown seguro ──────────────────────────
   Principio: la IA propone, el código comprueba. Nunca muestres como hecho una cita, una cifra o un recuento
   que la IA afirme sin haberlo contrastado con el texto de origen. */

/* texto normalizado con mapa a las posiciones originales */
function normMap(s) {
  let n = ''; const map = []; let sp = true;
  for (let i = 0; i < s.length; i++) {
    const c = s[i].toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (/[\p{L}\p{N}]/u.test(c)) { for (const ch of c) { n += ch; map.push(i); } sp = false; }
    else if (!sp) { n += ' '; map.push(i); sp = true; }
  }
  return {n, map};
}
let _nm = null;
const nmat = mat => { if (!_nm || _nm.src !== mat) _nm = {src: mat, ...normMap(mat)}; return _nm; };
/* ¿aparece la cita (literal, ignorando mayúsculas, tildes y puntuación) en el material? */
function localiza(mat, cita, minLen = 12) { const q = norm(cita); if (q.length < minLen) return null; const m = nmat(mat), i = m.n.indexOf(q); return i < 0 ? null : [m.map[i], m.map[Math.min(i + q.length - 1, m.map.length - 1)]]; }
const esFiel = (mat, cita) => !!localiza(mat, cita);
/* extractos del material alrededor de las citas (para dar contexto sin enviar todo) */
function ventanas(mat, citas, rad = 700, tope = 4200) {
  const r = citas.map(c => localiza(mat, c)).filter(Boolean).map(([a, b]) => [Math.max(0, a - rad), Math.min(mat.length, b + rad)]).sort((x, y) => x[0] - y[0]), m = [];
  for (const v of r) { const l = m.at(-1); if (l && v[0] <= l[1]) l[1] = Math.max(l[1], v[1]); else m.push([...v]); }
  const t = m.map(([a, b]) => mat.slice(a, b).trim()).join('\n[…]\n'); return t.length > tope ? t.slice(0, tope) : t;
}
/* cifras que la IA menciona y no están en el material (ignora números pequeños) */
const numsDe = t => new Set((String(t).match(/\d+(?:[.,]\d+)?/g) || []).map(x => x.replace(',', '.')));
function numerosNuevos(texto, mat) { const m = numsDe(mat); return [...numsDe(texto)].filter(x => !m.has(x) && parseFloat(x) > 12); }

/* datos personales: se enmascaran antes de enviar nada a un proveedor externo */
const PII = [['CORREO', /[\w.+-]+@[\w-]+\.[\w.-]+/g], ['ID', /\b\d{8}[A-HJ-NP-TV-Z]\b|\b[XYZ]\d{7}[A-Z]\b/gi], ['TELÉFONO', /(?:\+\d{2}\s?)?\b[6-9]\d{2}[\s.-]?\d{3}[\s.-]?\d{3}\b/g]];
function scrub(txt, nombre = '') {
  let n = 0, t = String(txt ?? ''); PII.forEach(([tag, rx]) => { t = t.replace(rx, () => { n++; return `[${tag}]`; }); });
  const nm = new Set(norm(nombre).split(' ').filter(w => w.length >= 3));
  t = t.replace(/[\p{L}][\p{L}'’-]*/gu, w => nm.has(norm(w)) ? (n++, '[PERSONA]') : w);
  return {t, n};
}
const cuentaPII = txt => PII.reduce((n, [, rx]) => n + ((String(txt).match(rx) || []).length), 0);

/* Markdown mínimo y seguro (escapa antes de formatear) */
function md(s) {
  const inl = x => esc(x).replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>').replace(/(^|[\s(])\*([^*\n]+)\*/g, '$1<i>$2</i>').replace(/`([^`]+)`/g, '<code>$1</code>');
  const out = []; let lst = null; const cierra = () => { if (lst) { out.push(`</${lst}>`); lst = null; } };
  for (const raw of String(s || '').split('\n')) {
    const l = raw.trimEnd(); let m; if (!l.trim()) { cierra(); continue; }
    if (m = l.match(/^#{1,4}\s+(.*)/)) { cierra(); out.push(`<h4>${inl(m[1])}</h4>`); continue; }
    if (m = l.match(/^\s*[-*•]\s+(.*)/)) { if (lst !== 'ul') { cierra(); out.push('<ul>'); lst = 'ul'; } out.push(`<li>${inl(m[1])}</li>`); continue; }
    if (m = l.match(/^\s*\d+[.)]\s+(.*)/)) { if (lst !== 'ol') { cierra(); out.push('<ol>'); lst = 'ol'; } out.push(`<li>${inl(m[1])}</li>`); continue; }
    cierra(); out.push(`<p>${inl(l)}</p>`);
  }
  cierra(); return out.join('');
}
