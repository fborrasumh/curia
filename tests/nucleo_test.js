// Pruebas de la lógica pura de CurIA: node tests/nucleo_test.js
const fs = require('fs'), vm = require('vm'), assert = require('assert');
const ctx = {LANG: 'es', console}; vm.createContext(ctx);
for (const f of ['forja/js/00-utils.js', 'forja/js/30-verify.js', 'src/datos.js', 'src/nucleo.js']) {
  let src = fs.readFileSync(f, 'utf8'); if (f.includes('00-utils')) src = src.replace(/^const \$ =.*$/m, '').replace(/^const \$\$ =.*$/m, '');
  vm.runInContext(src.replace(/^const /gm, 'var ').replace(/^let /gm, 'var '), ctx, {filename: f});
}
const c = ctx; let n = 0; const ok = (v, m) => { assert.ok(v, m); n++; };
// datos
ok(c.TEMAS.length === 18, '18 temas'); ok(c.ITEMS.length >= 100, 'banco'); ok(c.CASOS.length === 8, '8 casos');
for (const it of c.ITEMS) { ok(it.ok >= 0 && it.ok < it.o.length, 'ok en rango ' + it.id); if (it.ev) ok(c.pasaje(it.tema, it.ev), 'pasaje existe ' + it.id); }
for (const k of c.CASOS) { ok(k.hechos.filter(h => h.clave).length >= 3, 'claves ' + k.id); for (const [tm, p] of k.ref) ok(c.pasaje(tm, p), 'ref ' + k.id + ' ' + tm + p); ok(k.dictamen.derecho.op.length === 4, 'ops'); }
// cada respuesta correcta del banco nuevo aparece en su pasaje o es razonable: al menos una palabra significativa
// selección: mismos eventos -> misma ruta (determinismo con semilla)
const r1 = c.rngDe('x'), r2 = c.rngDe('x'); const ev = [];
ok(c.siguiente(c.ITEMS, ev, {r: r1}).item.id === c.siguiente(c.ITEMS, ev, {r: r2}).item.id, 'determinista');
// repaso: fallo y tres respuestas después vuelve
const it0 = c.ITEMS[0]; const e2 = [{k: 'item', id: it0.id, ra: it0.ra, ok: false, ts: Date.now()}, ...c.ITEMS.slice(1, 4).map(i => ({k: 'item', id: i.id, ra: i.ra, ok: true, ts: Date.now()}))];
const s = c.siguiente(c.ITEMS, e2); ok(s.item.id === it0.id && s.motivo === 'repaso', 'repaso');
// dominio sube con aciertos
ok(c.dominio([{k: 'item', ra: 'RA02', ok: true, ts: Date.now()}], 'RA02').p > 0.5, 'dominio');
// consulta: palabras clave
const k1 = c.CASOS[0]; ok(c.hechosTocados('¿Dónde vive usted?', k1).includes('lugar'), 'lugar'); ok(c.hechosTocados('¿Cuándo murió su marido?', k1).includes('fecha'), 'fecha');
ok(c.hechosValidos(['lugar', 'inventado'], k1).join() === 'lugar', 'ids inventados fuera');
ok(c.corrigeDictamen(k1, {derecho: 0, tribunal: 0}).derecho, 'dictamen');
ok(c.corrigeDictamen(c.CASOS[1], {derecho: 0, tribunal: 0, orden: c.CASOS[1].dictamen.prelacion}).prelacion === 1, 'prelación');
ok(c.anyosNuevos('murió en 1716', 'murió en 1714').join() === '1716', 'año inventado');
// citas y notas
ok(c.verificaCitas('dice «la Nación española es la reunión de todos los españoles»', c.TEXTOS[0].txt)[0].ok, 'cita fiel');
ok(!c.verificaCitas('dice «la Nación es la reunión de todos los franceses del mundo»', c.TEXTOS[0].txt)[0].ok, 'cita inventada');
ok(!/nota|7/.test(c.sinNotas('Buen trabajo. Te pondría un 7/10. Repasa el contexto.')), 'sin nota');
// dossier determinista y detective
ok(c.asignaTextos('ana23', c.TEXTOS).join() === c.asignaTextos('ana23', c.TEXTOS).join() && c.asignaTextos('ana23', c.TEXTOS).length === 6, 'asignación');
const d = c.detective(c.TEMAS[7], c.rngDe('d')); ok(d.filter(x => x.mala).length === 2 && d.every(x => x.mala ? x.y !== x.real : x.y === x.real), 'detective');
ok(c.huellasDe('1812').includes('sn'), 'huellas');
ok(c.gift([c.ITEMS[0]]).includes('='), 'gift');
console.log('✓', n, 'comprobaciones');
