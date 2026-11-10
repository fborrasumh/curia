/* ══ Núcleo de CurIA: lógica pura, sin interfaz. Se prueba en Node (tests/nucleo_test.js). ══ */
const LI = () => ({es: 0, en: 1, pt: 2})[typeof LANG === 'string' ? LANG : 'es'] || 0;
/* texto en el idioma activo; los contenidos de las unidades didácticas solo existen en castellano */
const L = a => Array.isArray(a) ? (a[LI()] ?? a[0]) : (a ?? '');
const DIA = 864e5;
function rngDe(seed) { let s = 0; for (const c of String(seed)) s = (s * 31 + c.charCodeAt(0)) >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; }; }
function baraja(a, r = Math.random) { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; }
const temaDe = id => TEMAS.find(x => x.id === id);
const pasaje = (tema, p) => ((temaDe(tema) || {}).pas || []).find(x => x[0] === p)?.[1] || '';

/* ── Modelo de dominio por RA: aciertos con olvido (peso 0,5 cada 14 días), estimador de Laplace ── */
function dominio(ev, ra, ahora = Date.now()) {
  let a = 0, n = 0;
  for (const e of ev) if (e.k === 'item' && e.ra === ra) { const w = Math.pow(0.5, (ahora - e.ts) / (14 * DIA)); n += w; if (e.ok) a += w; }
  return {p: (a + 1) / (n + 2), n};
}
/* ── Siguiente pregunta: repasos pendientes → tema de clase (2 de cada 3) → RA más flojo → menos vista; nunca dos seguidas del mismo tema ── */
function siguiente(items, ev, {tema = '', r = Math.random} = {}) {
  const resp = ev.filter(e => e.k === 'item'), ult = resp[resp.length - 1], idx = resp.length;
  const ultimo = {}; resp.forEach((e, i) => { ultimo[e.id] = {ok: e.ok, i}; });
  const temaU = ult ? (items.find(x => x.id === ult.id) || {}).tema : null;
  const vale = it => !ult || it.id !== ult.id;
  const repaso = items.filter(it => vale(it) && ultimo[it.id] && !ultimo[it.id].ok && idx - ultimo[it.id].i >= 3);
  if (repaso.length) return {item: repaso[0], motivo: 'repaso'};
  if (tema && r() < 2 / 3) { const c = items.filter(it => vale(it) && it.tema === tema); if (c.length) return {item: menosVista(c, ultimo, r), motivo: 'tema'}; }
  const ras = [...new Set(items.map(x => x.ra))].map(ra => ({ra, p: dominio(ev, ra).p})).sort((a, b) => a.p - b.p);
  for (const {ra} of ras) {
    let c = items.filter(it => vale(it) && it.ra === ra && !ultimo[it.id]);
    if (temaU) { const d = c.filter(it => it.tema !== temaU); if (d.length) c = d; }
    if (c.length) return {item: c[Math.floor(r() * c.length)], motivo: 'flojo', ra};
  }
  return {item: menosVista(items.filter(vale), ultimo, r), motivo: 'mantener'};
}
function menosVista(c, ultimo, r) { const s = baraja(c, r).sort((a, b) => (ultimo[a.id]?.i ?? -1) - (ultimo[b.id]?.i ?? -1)); return s[0]; }

/* ── Consulta jurídica: qué hechos de la ficha toca una pregunta (por palabras clave normalizadas) ── */
function hechosTocados(pregunta, caso) {
  const q = ' ' + norm(pregunta) + ' ';
  return caso.hechos.filter(h => h.k.some(k => q.includes(' ' + norm(k)))).map(h => h.id);
}
const hechosValidos = (ids, caso) => [...new Set((ids || []).filter(id => caso.hechos.some(h => h.id === id)))];
function corrigeDictamen(caso, d) {
  const o = {derecho: d.derecho === caso.dictamen.derecho.ok, tribunal: d.tribunal === caso.dictamen.tribunal.ok};
  if (caso.dictamen.prelacion) { const p = caso.dictamen.prelacion; o.prelacion = (d.orden || []).filter((x, i) => x === p[i]).length / p.length; }
  return o;
}
/* informe de la entrevista: hechos clave obtenidos y que faltaron */
function informeEntrevista(caso, obtenidos) {
  const claves = caso.hechos.filter(h => h.clave), ok = claves.filter(h => obtenidos.includes(h.id));
  return {claves: claves.length, obtenidos: ok.length, faltan: claves.filter(h => !obtenidos.includes(h.id)).map(h => h.id), extra: obtenidos.filter(id => !claves.some(h => h.id === id))};
}
/* años que la IA dice y que no están en la ficha del caso: posible invención */
function anyosNuevos(texto, base) { const ys = s => new Set((String(s).match(/\b(1[0-9]{3}|[5-9][0-9]{2})\b/g) || [])); const b = ys(base); return [...ys(texto)].filter(y => !b.has(y)); }

/* ── Citas entre comillas «…» o "…" y su verificación literal contra un material ── */
const citasDe = tx => [...String(tx).matchAll(/[«"“]([^»"”]{12,})[»"”]/g)].map(m => m[1].trim());
const verificaCitas = (tx, mat) => citasDe(tx).map(c => ({c, ok: esFiel(mat, c)}));
/* la IA nunca pone nota: se eliminan las frases que la contienen */
const RX_NOTA = /[^.!?\n]*\b(\d+(?:[.,]\d+)?\s*(?:\/|sobre|de|out of|em)\s*10|nota|calificaci[oó]n|grade|score|puntuaci[oó]n)\b[^.!?\n]*[.!?]?/gi;
const sinNotas = tx => String(tx || '').replace(RX_NOTA, '').replace(/\s{2,}/g, ' ').trim();

/* ── Dossier: seis textos por estudiante, repartidos por su código (determinista) ── */
function asignaTextos(codigo, textos, n = 6) { return baraja(textos.map(x => x.id), rngDe('curia:' + norm(codigo))).slice(0, Math.min(n, textos.length)); }
function conceptos(tx, cl) { const q = ' ' + norm(tx) + ' '; return cl.map(g => g.some(w => q.includes(' ' + norm(w)))); }

/* ── Detective de anacronismos: frases construidas desde la cronología; el código cambia los años de algunas, así que sabe cuáles fallan ── */
function detective(tema, r = Math.random, n = 6, malas = 2) {
  const f = baraja(tema.fechas.filter(x => x[0] > 0), r).slice(0, n).sort((a, b) => a[0] - b[0]);
  const idx = baraja(f.map((_, i) => i), r).slice(0, Math.min(malas, f.length - 1));
  return f.map(([y, h], i) => { const mala = idx.includes(i); const d = [-50, -30, -20, 20, 30, 50][Math.floor(r() * 6)]; return {y: mala ? y + d : y, real: y, h, mala}; });
}
/* ── ¿De qué constitución?: huellas de cada constitución, sacadas de sus artículos ── */
function huellasDe(c) { return [...new Set(ARTS.filter(a => a.c === c).flatMap(a => a.h))]; }
function aciertoHuellas(c, dadas) { const h = huellasDe(c); const ok = (dadas || []).filter(x => h.includes(x)); return {ok, mal: (dadas || []).filter(x => !h.includes(x) && HUELLAS[x]), h}; }

/* ── Panel: análisis de los ficheros anónimos ── */
function analiza(ficheros, items) {
  const porItem = {}, porRA = {};
  for (const f of ficheros) for (const e of (f.eventos || [])) if (e.k === 'item') {
    (porItem[e.id] = porItem[e.id] || {n: 0, ok: 0}); porItem[e.id].n++; if (e.ok) porItem[e.id].ok++;
    (porRA[e.ra] = porRA[e.ra] || {n: 0, ok: 0}); porRA[e.ra].n++; if (e.ok) porRA[e.ra].ok++;
  }
  const filas = Object.entries(porItem).map(([id, v]) => ({id, n: v.n, p: v.ok / v.n, item: items.find(x => x.id === id)})).sort((a, b) => a.p - b.p);
  return {estudiantes: ficheros.length, filas, porRA};
}
/* GIFT de Moodle (escapa los caracteres reservados) */
const gesc = s => String(s).replace(/([~=#{}:\\])/g, '\\$1');
const gift = items => items.map(it => `::${it.id}:: ${gesc(L(it.q))} {\n${it.o.map((o, i) => `${i === it.ok ? '=' : '~'}${gesc(L(o))}`).join('\n')}\n}`).join('\n\n');

if (typeof module !== 'undefined') module.exports = {dominio, siguiente, hechosTocados, hechosValidos, corrigeDictamen, informeEntrevista, anyosNuevos, citasDe, verificaCitas, sinNotas, asignaTextos, conceptos, detective, huellasDe, aciertoHuellas, analiza, gift, rngDe, baraja, L};
