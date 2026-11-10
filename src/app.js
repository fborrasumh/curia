/* ══ CurIA · interfaz. La IA da voz a los personajes; el código corrige y comprueba contra la base (datos.js). ══ */
const STEPS = ['Inicio', 'Práctica', 'Consulta', 'Laboratorios', 'Dossier', 'Progreso'];
const HUBS = ['Cronología', 'Profesorado', 'Temario'];
const NAV = [['Empezar', 'Sin clave funcionan la práctica, la cronología, el temario y la consulta en modo guiado.'], ['Siguiente: consulta', 'Responde y el código elige la siguiente pregunta.'], ['Siguiente: laboratorios', 'Pregunta al cliente lo que necesitas y emite tu dictamen.'], ['Siguiente: dossier', 'Elige una actividad en las pestañas.'], ['Siguiente: progreso', 'Comenta paso a paso y ensaya la defensa.'], ['Volver al inicio', 'Descarga tu fichero de entrega para el campus virtual.']];
const RENDER = {0: pintaInicio, 1: pintaPractica, 2: pintaConsulta, 3: pintaLab, 4: pintaDossier, 5: pintaProgreso, 6: pintaCrono, 7: pintaProf, 8: pintaTemario};
const GLOS = [
  ['¿Qué es CurIA?', 'El sistema de aprendizaje de la asignatura 1193 Historia del Derecho (UMH), construido sobre sus unidades didácticas: práctica adaptativa, consulta jurídica, laboratorios, dossier de fuentes y panel del profesorado.'],
  ['La IA propone, el código comprueba', 'Los personajes solo conocen su ficha. El código corrige los dictámenes y los laboratorios, comprueba que las citas son literales, avisa si un personaje menciona un año que no está en su ficha y elimina cualquier nota que intente poner la IA.'],
  ['Hablar de viva voz', 'En la consulta y en el ensayo de defensa puedes pulsar «Hablar» y dictar: el navegador transcribe tu voz a texto sin gastar tokens de IA. Funciona en Chrome, Edge y Safari. Según el navegador, el audio lo procesa el servicio de voz de su fabricante (Google, Microsoft o Apple); si no quieres, escribe.'],
  ['Sin clave de IA', 'Funcionan la práctica, la cronología, el temario, el detective de anacronismos, el juego de constituciones y la consulta en modo guiado: el cliente responde con los hechos de su ficha que toca tu pregunta.'],
  ['Tu clave de IA', 'Funciona con OpenAI, Google Gemini o Anthropic Claude. La clave se guarda solo en este navegador y cada persona paga su propio uso. Basta un modelo económico.'],
  ['Privacidad', 'Tu trabajo se guarda solo en este navegador. Solo cuando hablas con un personaje o pides comentario sale hacia tu proveedor de IA tu mensaje y el material de la actividad, con los datos personales enmascarados.'],
  ['Ciencia del aprendizaje', 'Práctica de recuperación (Roediger y Karpicke, 2006, doi:10.1111/j.1467-9280.2006.01693.x), práctica espaciada (Cepeda et al., 2006, doi:10.1037/0033-2909.132.3.354), técnicas de estudio eficaces (Dunlosky et al., 2013, doi:10.1177/1529100612453266) y feedback (Hattie y Timperley, 2007, doi:10.3102/003465430298487).']
];
let S = {ev: [], tema: '', cur: null, co: {}, casoId: 'c1', nivel: 1, lab: 'pleito', labS: {}, codigo: '', dos: {}, txtId: '', def: [], esEjemplo: false};
let ENVIO_OK = false;
const ev = e => { S.ev.push({...e, ts: Date.now()}); guarda(); };
const ITEM = id => ITEMS.find(x => x.id === id);
const opciones = (sel, arr, val) => { $(sel).innerHTML = arr.map(([v, n]) => `<option value="${esc(v)}">${esc(n)}</option>`).join(''); if (val !== undefined) $(sel).value = val; };
const chip = (ok, txt) => `<span class="fa-chip ${ok ? 'ok' : 'aviso'}">${ok ? '✓' : '✗'} ${esc(txt)}</span>`;
const nombreTema = tm => `${tm.id.replace(/^T(\d)(\d+)$/, (m, a, b) => `${a}-${b.length > 1 ? b[0] + '.' + b[1] : b}`)} · ${tm.n}`;
const conIA = () => !!getKey();

/* aviso previo al envío (una vez por sesión) */
let envioRes = null;
function pideEnvio(tx, n) {
  if (ENVIO_OK) return Promise.resolve(true);
  $('envioInfo').innerHTML = `<p class="sub" style="margin-top:0">${esc(t('Se enviarán unos {0} caracteres a {1}. Se han enmascarado {2} dato(s) personales.', nf(tx.length), PROV[getProv()].n, n))}</p><p class="help">${esc(t('Muestra del envío:'))}</p>`;
  $('envioTxt').textContent = tx.slice(0, 3000) + (tx.length > 3000 ? '\n…' : '');
  $('envioOk').checked = false; $('envioSi').disabled = true; $('mEnvio').classList.add('on');
  return new Promise(r => { envioRes = r; });
}
function cierraEnvio(v) { $('mEnvio').classList.remove('on'); if (envioRes) { const r = envioRes; envioRes = null; if (v) ENVIO_OK = true; r(v); } }
_cierres.mEnvio = () => cierraEnvio(false);
$('envioOk').onchange = () => { $('envioSi').disabled = !$('envioOk').checked; };
$('envioSi').onclick = () => cierraEnvio(true); $('envioNo').onclick = () => cierraEnvio(false);
/* llamada a la IA con enmascarado y aviso; devuelve null si se cancela */
/* aviso=false: sin ventana previa (la consulta jurídica: la muestra del envío desvelaría la ficha del caso) */
async function ia(prompt, max = 1500, aviso = true) {
  if (!pideClave()) return null;
  const {t: tx, n} = scrub(prompt);
  if (aviso && !(await pideEnvio(tx, n))) return null;
  return llmJSON([{role: 'system', content: SYS_JSON}, {role: 'user', content: tx}], {max});
}
async function conEspera(btn, fn) { if (btn.disabled) return; btn.disabled = true; const h = btn.innerHTML; btn.innerHTML = '<span class="spin"></span> ' + esc(t('Pensando…')); try { await fn(); } catch (e) { toast(e.message, 8000); } finally { btn.disabled = false; btn.innerHTML = h; } }

/* ── 0 · inicio ── */
function pintaInicio() { const n = S.ev.filter(e => e.k === 'item').length; $('inicioProj').innerHTML = n ? esc(t('Llevas {0} respuestas de práctica en este navegador.', n)) : ''; }
$('btnStart').onclick = () => go(1);
$$('[data-hub]').forEach(b => b.onclick = () => go(+b.dataset.hub));
const EJ_CONSULTA = [['u', '¿Dónde vive usted?'], ['c', 'Vivimos en Xàtiva, en el reino de Valencia, de toda la vida.'], ['u', '¿Cuándo murió su marido?'], ['c', 'Mi marido murió en el invierno de 1714, cuando ya había acabado la guerra en el reino.'], ['u', '¿Por qué ley cree que se rige su caso?'], ['c', 'Mi padre siempre decía que en Valencia mandan els Furs, pero el escribano me dijo que desde lo de Almansa eso cambió.'], ['u', '¿Hizo testamento?'], ['c', 'Hizo testamento ante escribano en 1713 y me dejó la casa a mí.']];
$('btnEjemplo').onclick = () => { S.casoId = 'c1'; S.nivel = 1; S.co.c1 = {hist: EJ_CONSULTA.map(([r, x]) => ({r, t: x})), obt: ['lugar', 'fecha', 'furs', 'testamento'], dict: null, ej: true}; S.esEjemplo = true; guarda(); go(2); toast(t('Consulta de ejemplo, grabada sin usar la IA')); };

/* ── 1 · práctica ── */
function pintaPractica() {
  opciones('selTema', [['', t('Ninguno: elige el código')], ...TEMAS.map(tm => [tm.id, nombreTema(tm)])], S.tema);
  if (!S.cur || !ITEM(S.cur.id)) nuevaPregunta(); else muestraPregunta();
}
$('selTema').onchange = e => { S.tema = e.target.value; guarda(); nuevaPregunta(); };
function nuevaPregunta() { const {item, motivo, ra} = siguiente(ITEMS, S.ev, {tema: S.tema}); S.cur = {id: item.id, motivo, ra, orden: baraja(item.o.map((_, i) => i)), resp: null}; guarda(); muestraPregunta(); }
const MOTIVO = {repaso: 'Repaso: la fallaste hace poco y toca recuperarla.', tema: 'Del tema que estáis viendo en clase.', flojo: 'Es el resultado de aprendizaje en el que tienes menos dominio.', mantener: 'Mantenimiento: la que hace más tiempo que no ves.'};
function muestraPregunta() {
  const c = S.cur, it = ITEM(c.id), ra = RA.find(r => r.id === it.ra), tm = it.tema ? temaDe(it.tema) : null;
  let fb = '';
  if (c.resp !== null) {
    const ok = c.resp === it.ok, exp = it.f ? L(it.f) : '', ev_ = it.ev ? pasaje(it.tema, it.ev) : '';
    fb = `<div class="${ok ? 'okbox' : 'aviso'}" role="status"><b>${esc(ok ? t('Correcto.') : t('No es esa.'))}</b> ${ok ? '' : esc(t('La respuesta es: {0}', L(it.o[it.ok])))}${exp ? `<p>${esc(exp)}</p>` : ''}${ev_ ? `<p class="cu-pas"><small>${esc(t('Unidad didáctica'))} ${esc(nombreTema(tm))}:</small><br>«${esc(ev_)}»</p>` : ''}</div>
      <div class="actions"><button class="btn btn-primary" id="btnSig" type="button">${esc(t('Siguiente pregunta'))}</button></div>`;
  }
  $('prBox').innerHTML = `<p class="cu-motivo">${ico('bulb')} ${esc(t(MOTIVO[c.motivo]))}</p>
    <p class="cu-meta">${esc(ra ? L(ra.c) : it.ra)}${tm ? ' · ' + esc(nombreTema(tm)) : ''}</p>
    <h3 class="cu-q">${esc(L(it.q))}</h3>
    <div class="cu-ops">${c.orden.map(i => `<button type="button" class="cu-op${c.resp !== null ? (i === it.ok ? ' cu-bien' : i === c.resp ? ' cu-mal' : '') : ''}" data-op="${i}" ${c.resp !== null ? 'disabled' : ''}>${esc(L(it.o[i]))}</button>`).join('')}</div>${fb}`;
  $$('#prBox [data-op]').forEach(b => b.onclick = () => { c.resp = +b.dataset.op; ev({k: 'item', id: it.id, ra: it.ra, ok: c.resp === it.ok}); muestraPregunta(); });
  if ($('btnSig')) { $('btnSig').onclick = nuevaPregunta; $('btnSig').focus(); }
}

/* ── 2 · consulta jurídica ── */
const CASO = () => CASOS.find(c => c.id === S.casoId) || CASOS[0];
const coS = () => (S.co[S.casoId] = S.co[S.casoId] || {hist: [], obt: [], dict: null});
function pintaConsulta() {
  opciones('selCaso', CASOS.map(c => [c.id, `${c.t} (${c.y})`]), S.casoId); $('selNivel').value = String(S.nivel);
  $('coModo').textContent = conIA() ? t('Con IA: el cliente responde con naturalidad, pero solo sabe lo que dice su ficha.') : t('Modo guiado (sin clave): el cliente responde con los hechos de su ficha que toca tu pregunta. Pregunta por el lugar, la fecha, el derecho, las personas…');
  const caso = CASO(), s = coS(); $('coTit').textContent = `${caso.cliente} · ${caso.y}`;
  $('coChat').innerHTML = `<div class="cu-msg cu-c"><b>${esc(t('Cliente'))}</b>${esc(caso.presenta)}</div>` + s.hist.map(m => `<div class="cu-msg ${m.r === 'u' ? 'cu-u' : 'cu-c'}"><b>${esc(m.r === 'u' ? t('Tú') : t('Cliente'))}</b>${esc(m.t)}${m.av ? `<small class="cu-av">⚠ ${esc(m.av)}</small>` : ''}</div>`).join('');
  $('coChat').scrollTop = 1e6;
  const inf = informeEntrevista(caso, s.obt);
  $('coHechos').innerHTML = `<p class="help">${esc(t('Hechos clave obtenidos: {0} de {1}.', inf.obtenidos, inf.claves))}</p>`;
  pintaDictamen();
}
$('selCaso').onchange = e => { S.casoId = e.target.value; guarda(); pintaConsulta(); };
$('selNivel').onchange = e => { S.nivel = +e.target.value; guarda(); };
$('coVoz').onchange = e => { S.voz = e.target.checked; guarda(); if (!e.target.checked && typeof speechSynthesis !== 'undefined') speechSynthesis.cancel(); };
micro($('coMic'), $('coIn'), $('coInterim'));
$('coIn').addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); $('coEnviar').click(); } });
$('coEnviar').onclick = () => conEspera($('coEnviar'), async () => {
  const q = $('coIn').value.trim(); if (!q) return toast(t('Escribe o dicta tu pregunta'));
  const caso = CASO(), s = coS(); let resp, ids, av = '';
  if (conIA()) {
    const raw = await ia(promptCliente(caso, S.nivel, s.hist, q), 600, false); if (!raw) return;
    resp = String(raw.respuesta || '').trim(); ids = hechosValidos(raw.hechos, caso);
    const ficha = caso.hechos.map(h => h.txt).join(' ') + ' ' + caso.y; const ny = anyosNuevos(resp, ficha);
    if (ny.length) av = t('El personaje menciona un año que no está en su ficha: {0}. No lo tomes como dato.', ny.join(', '));
  } else {
    ids = hechosTocados(q, caso);
    if (S.nivel === 3) { const oculto = (caso.hechos.find(h => h.clave && h.id !== 'lugar') || {}).id; if (ids.includes(oculto) && norm(q).split(' ').length < 4) ids = ids.filter(x => x !== oculto); }
    if (!ids.length && S.nivel === 1) { const sig = caso.hechos.find(h => h.clave && !s.obt.includes(h.id)); if (sig) ids = [sig.id]; }
    resp = ids.length ? ids.map(id => caso.hechos.find(h => h.id === id).txt).join(' ') : t('No sé bien qué me pregunta. ¿Puede concretar?');
  }
  s.hist.push({r: 'u', t: q}, {r: 'c', t: resp, av}); s.obt = [...new Set([...s.obt, ...ids])]; s.ej = false; S.esEjemplo = false;
  $('coIn').value = ''; await guardaYa(); pintaConsulta(); if (S.voz) habla(resp);
});
function pintaDictamen() {
  const caso = CASO(), s = coS(), r = rngDe(caso.id), d = s.dict || {};
  const lista = (nombre, campo) => `<fieldset class="cu-fs"><legend>${esc(t(nombre))}</legend>${baraja(caso.dictamen[campo].op.map((o, i) => [o, i]), r).map(([o, i]) => `<label class="cu-rad"><input type="radio" name="d_${campo}" value="${i}" ${d[campo] === i ? 'checked' : ''}> ${esc(o)}</label>`).join('')}</fieldset>`;
  const pre = caso.dictamen.prelacion; const orden = pre ? (d.orden || baraja(pre, rngDe(caso.id + 'p'))) : [];
  let res = '';
  if (d.ok) {
    const inf = informeEntrevista(caso, s.obt), nom = id => caso.hechos.find(h => h.id === id).txt;
    res = `<h3>${esc(t('Corrección'))}</h3><p>${chip(d.ok.derecho, t('Derecho aplicable'))} ${chip(d.ok.tribunal, t('Tribunal'))}${pre ? ' ' + chip(d.ok.prelacion === 1, t('Orden de prelación: {0} %', Math.round(d.ok.prelacion * 100))) : ''}</p>
      <div class="okbox"><b>${esc(t('Fundamento'))}.</b> ${esc(caso.por)}${caso.ref.map(([tm, p]) => `<p class="cu-pas"><small>${esc(nombreTema(temaDe(tm)))}:</small><br>«${esc(pasaje(tm, p))}»</p>`).join('')}</div>
      <p class="help">${esc(t('Entrevista: obtuviste {0} de {1} hechos clave.', inf.obtenidos, inf.claves))}${inf.faltan.length ? ' ' + esc(t('Te faltó preguntar:')) + '</p><ul class="fa-ul">' + inf.faltan.map(id => `<li>${esc(nom(id))}</li>`).join('') + '</ul>' : '</p>'}
      ${d.com ? `<div class="card cu-ia"><b>${esc(t('Comentario de la IA'))}</b><p>${esc(d.com)}</p>${(d.citas || []).map(c => `<small>${c.ok ? '✓' : '⚠'} «${esc(c.c)}» ${esc(c.ok ? '' : t('no aparece en tu razonamiento'))}</small>`).join('<br>')}</div>` : `<div class="actions"><button class="btn btn-ghost" id="btnComDict" type="button">${ico('sparkles')} ${esc(t('Pedir comentario a la IA'))}</button></div>`}`;
  }
  $('coDict').innerHTML = `<h3>${esc(t('Tu dictamen'))}</h3>${lista('Derecho aplicable', 'derecho')}${lista('Tribunal competente', 'tribunal')}
    ${pre ? `<fieldset class="cu-fs"><legend>${esc(t('Ordena las fuentes según su prelación'))}</legend><ol class="cu-ord">${orden.map((x, i) => `<li>${esc(x)} <button type="button" class="btn btn-sm btn-ghost" data-up="${i}" aria-label="${esc(t('Subir'))}" ${i ? '' : 'disabled'}>▲</button></li>`).join('')}</ol></fieldset>` : ''}
    <div class="field"><label for="dRazon">${esc(t('Razona tu dictamen'))}</label><textarea id="dRazon" rows="3">${esc(d.razon || '')}</textarea></div>
    <div class="actions"><button class="btn btn-primary" id="btnDict" type="button">${esc(t('Emitir dictamen'))}</button></div>${res}`;
  $('dRazon').oninput = e => { s.dict = {...(s.dict || {}), razon: e.target.value}; guarda(); };
  $$('#coDict [data-up]').forEach(b => b.onclick = () => { const i = +b.dataset.up; const o = orden.slice(); [o[i - 1], o[i]] = [o[i], o[i - 1]]; s.dict = {...leeDict(), orden: o}; guarda(); pintaDictamen(); });
  $('btnDict').onclick = () => { const v = leeDict(); if (v.derecho === undefined || v.tribunal === undefined) return toast(t('Elige el derecho aplicable y el tribunal')); v.orden = v.orden || orden; v.ok = corrigeDictamen(caso, v); s.dict = v; ev({k: 'consulta', id: caso.id, ra: caso.ra, ok: v.ok.derecho && v.ok.tribunal, hechos: informeEntrevista(caso, s.obt).obtenidos}); pintaDictamen(); };
  if ($('btnComDict')) $('btnComDict').onclick = () => conEspera($('btnComDict'), async () => { const v = s.dict; if (wc(v.razon) < 8) return toast(t('Escribe primero tu razonamiento')); const raw = await ia(promptDictamen(caso, v, v.ok), 700); if (!raw) return; v.com = sinNotas(raw.comentario); v.citas = verificaCitas(v.com, v.razon); await guardaYa(); pintaDictamen(); });
  function leeDict() { const g = n => { const x = $$(`#coDict input[name="d_${n}"]`).find(i => i.checked); return x ? +x.value : undefined; }; return {...(s.dict || {}), derecho: g('derecho'), tribunal: g('tribunal'), razon: $('dRazon') ? $('dRazon').value : '', orden: (s.dict || {}).orden}; }
}

/* ── 3 · laboratorios ── */
$$('#labTabs [data-lab]').forEach(b => b.onclick = () => { S.lab = b.dataset.lab; guarda(); pintaLab(); });
const LS = k => (S.labS[k] = S.labS[k] || {});
function pintaLab() { $$('#labTabs [data-lab]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.lab === S.lab))); ({pleito: labPleito, detective: labDetective, cortes: labCortes, const: labConst})[S.lab](); }
function labPleito() {
  const st = LS('pleito'); st.i = st.i || 0; const ep = PLEITO.epocas[st.i], r = rngDe(ep.id), sel = (st.sel || {})[ep.id], ok = sel !== undefined && sel === ep.ok, al = (st.al || {})[ep.id];
  $('labBox').innerHTML = `<p>${esc(L(PLEITO.caso))}</p><div class="tabs">${PLEITO.epocas.map((e, i) => `<button type="button" data-ep="${i}" aria-pressed="${i === st.i}">${e.y}</button>`).join('')}</div>
    <h3>${esc(L(ep.lugar))} · ${ep.y}</h3>
    ${al ? `<div class="cu-msg cu-c"><b>${esc(t('Abogado A'))}</b>${esc(al.a)}</div><div class="cu-msg cu-c"><b>${esc(t('Abogado B'))}</b>${esc(al.b)}</div>${al.av ? `<p class="aviso">${esc(al.av)}</p>` : ''}` : `<div class="actions"><button class="btn btn-ghost" id="btnAbog" type="button">${ico('chat')} ${esc(t('Oír a los abogados'))}</button></div>`}
    <fieldset class="cu-fs"><legend>${esc(t('¿Con qué derecho juzgas?'))}</legend>${baraja(ep.op.map((o, i) => [o, i]), r).map(([o, i]) => `<label class="cu-rad"><input type="radio" name="pl" value="${i}" ${sel === i ? 'checked' : ''}> ${esc(L(o))}</label>`).join('')}</fieldset>
    <div class="actions"><button class="btn btn-primary" id="btnPl" type="button">${esc(t('Dictar sentencia'))}</button></div>
    ${sel !== undefined ? `<div class="${ok ? 'okbox' : 'aviso'}"><b>${esc(ok ? t('Sentencia bien fundada.') : t('El tribunal superior revoca tu sentencia.'))}</b> ${esc(L(ep.f))}<p>${esc(t('Orden de prelación:'))} ${ep.cad.map(x => esc(L(x))).join(' → ')}</p></div>` : ''}`;
  $$('#labBox [data-ep]').forEach(b => b.onclick = () => { st.i = +b.dataset.ep; guarda(); labPleito(); });
  $('btnPl').onclick = () => { const x = $$('#labBox input[name="pl"]').find(i => i.checked); if (!x) return toast(t('Elige una fuente')); st.sel = {...(st.sel || {}), [ep.id]: +x.value}; ev({k: 'lab', lab: 'pleito', id: ep.id, ok: +x.value === ep.ok}); labPleito(); };
  if ($('btnAbog')) $('btnAbog').onclick = () => conEspera($('btnAbog'), async () => {
    const mala = baraja(ep.op.map((_, i) => i).filter(i => i !== ep.ok), r)[0]; const [ia_, ib] = r() < 0.5 ? [ep.ok, mala] : [mala, ep.ok];
    const fa = L(ep.op[ia_]), fb = L(ep.op[ib]); let a, b, av = '';
    if (conIA()) { const raw = await ia(promptAbogados(ep, fa, fb), 700); if (!raw) return; a = raw.a; b = raw.b; const clave = f => norm(f).split(' ').filter(w => w.length > 4)[0] || norm(f); if (!norm(a).includes(clave(fa)) || !norm(b).includes(clave(fb))) av = t('Algún abogado no nombra la fuente que defiende: escucha con cuidado.'); }
    else { a = t('Señoría: este pleito debe resolverse por {0}. Así se ha hecho siempre en esta tierra.', fa); b = t('Con la venia: lo que procede es aplicar {0}, que es el derecho que hoy obliga a los jueces.', fb); }
    st.al = {...(st.al || {}), [ep.id]: {a, b, av}}; await guardaYa(); labPleito();
  });
}
function labDetective() {
  const st = LS('det'), cand = TEMAS.filter(x => x.fechas.filter(f => f[0] > 0).length >= 4);
  if (!st.tema || !temaDe(st.tema)) st.tema = cand[0].id;
  if (!st.frases || st.de !== st.tema) { st.frases = detective(temaDe(st.tema), Math.random); st.de = st.tema; st.marc = []; st.hecho = false; }
  $('labBox').innerHTML = `<p>${esc(t('Un compañero ha resumido la cronología de un tema. Algunos años están cambiados: márcalos. Los errores los ha puesto el código, así que sabe cuáles son.'))}</p>
    <div class="field"><label for="detT">${esc(t('Tema'))}</label><select id="detT">${cand.map(x => `<option value="${x.id}" ${x.id === st.tema ? 'selected' : ''}>${esc(nombreTema(x))}</option>`).join('')}</select></div>
    <ul class="cu-det">${st.frases.map((f, i) => `<li><label class="fa-chk"><input type="checkbox" data-m="${i}" ${st.marc.includes(i) ? 'checked' : ''} ${st.hecho ? 'disabled' : ''}> <span><b>${f.y}</b>: ${esc(f.h)}</span></label>${st.hecho ? (f.mala ? (st.marc.includes(i) ? ' ' + chip(true, t('Cazado: era {0}', f.real)) : ' ' + chip(false, t('Se te escapó: era {0}', f.real))) : (st.marc.includes(i) ? ' ' + chip(false, t('Era correcto')) : '')) : ''}</li>`).join('')}</ul>
    <div class="actions"><button class="btn btn-primary" id="btnDet" type="button" ${st.hecho ? 'hidden' : ''}>${esc(t('Comprobar'))}</button><button class="btn btn-ghost" id="btnDetN" type="button">${esc(t('Otra respuesta'))}</button></div>`;
  $('detT').onchange = e => { st.tema = e.target.value; guarda(); labDetective(); };
  $$('#labBox [data-m]').forEach(c => c.onchange = () => { const i = +c.dataset.m; st.marc = c.checked ? [...st.marc, i] : st.marc.filter(x => x !== i); guarda(); });
  $('btnDet').onclick = () => { st.hecho = true; const ok = st.frases.every((f, i) => f.mala === st.marc.includes(i)); ev({k: 'lab', lab: 'detective', id: st.tema, ok}); labDetective(); };
  $('btnDetN').onclick = () => { st.frases = null; labDetective(); };
}
function labCortes() {
  const st = LS('cortes'); st.i = st.i || 0; const dl = DILEMAS[st.i], v = (st.v || {})[dl.id] || {}, iv = (st.iv || {})[dl.id];
  $('labBox').innerHTML = `<p>${esc(t('Para proyectar en clase. El grupo vota, escucha a los diputados, discute por parejas y vuelve a votar; después se ve qué se decidió.'))}</p>
    <div class="tabs">${DILEMAS.map((d, i) => `<button type="button" data-dl="${i}" aria-pressed="${i === st.i}">${d.y}</button>`).join('')}</div>
    <p>${esc(L(dl.rol))}</p><h3>${esc(L(dl.q))}</h3>
    <div class="cu-row2"><div class="field"><label for="v1s">${esc(t('Primera votación: a favor'))}</label><input id="v1s" type="number" min="0" value="${v.s1 ?? ''}"></div><div class="field"><label for="v1n">${esc(t('Primera votación: en contra'))}</label><input id="v1n" type="number" min="0" value="${v.n1 ?? ''}"></div></div>
    ${iv ? `<div class="cu-msg cu-c"><b>${esc(t('Diputado a favor'))}</b>${esc(iv.pro)}</div><div class="cu-msg cu-c"><b>${esc(t('Diputado en contra'))}</b>${esc(iv.con)}</div>` : `<div class="actions"><button class="btn btn-ghost" id="btnDip" type="button">${ico('chat')} ${esc(t('Dar la palabra a los diputados'))}</button></div>`}
    <div class="cu-row2"><div class="field"><label for="v2s">${esc(t('Segunda votación: a favor'))}</label><input id="v2s" type="number" min="0" value="${v.s2 ?? ''}"></div><div class="field"><label for="v2n">${esc(t('Segunda votación: en contra'))}</label><input id="v2n" type="number" min="0" value="${v.n2 ?? ''}"></div></div>
    <div class="actions"><button class="btn btn-primary" id="btnReal" type="button">${esc(t('Ver qué se decidió'))}</button></div>${v.real ? `<div class="okbox">${esc(L(dl.real))}</div>` : ''}`;
  $$('#labBox [data-dl]').forEach(b => b.onclick = () => { st.i = +b.dataset.dl; guarda(); labCortes(); });
  const lee = () => ({s1: $('v1s').value, n1: $('v1n').value, s2: $('v2s').value, n2: $('v2n').value});
  ['v1s', 'v1n', 'v2s', 'v2n'].forEach(id => $(id).onchange = () => { st.v = {...(st.v || {}), [dl.id]: {...v, ...lee()}}; guarda(); });
  $('btnReal').onclick = () => { st.v = {...(st.v || {}), [dl.id]: {...v, ...lee(), real: true}}; guarda(); labCortes(); };
  if ($('btnDip')) $('btnDip').onclick = () => conEspera($('btnDip'), async () => { let pro = L(dl.pro), con = L(dl.con); if (conIA()) { const raw = await ia(promptDiputados(dl), 700); if (!raw) return; pro = raw.pro; con = raw.con; } st.iv = {...(st.iv || {}), [dl.id]: {pro, con}}; await guardaYa(); labCortes(); });
}
function labConst() {
  const st = LS('const'); st.m = st.m || 'quiz';
  const tabs = `<div class="tabs"><button type="button" data-cm="quiz" aria-pressed="${st.m === 'quiz'}">${esc(t('Identifica el artículo'))}</button><button type="button" data-cm="inv" aria-pressed="${st.m === 'inv'}">${esc(t('Engaña a la IA'))}</button></div>`;
  if (st.m === 'quiz') {
    if (st.a === undefined) st.a = Math.floor(Math.random() * ARTS.length);
    const a = ARTS[st.a];
    $('labBox').innerHTML = tabs + `<p>${esc(t('Un artículo sin fecha. Busca las huellas (quién es soberano, la religión, la forma de gobierno, el sufragio) y decide de qué constitución es.'))}</p><blockquote class="cu-txt">${esc(a.txt)}</blockquote>
      <div class="cu-ops">${CONSTS.map(c => `<button type="button" class="cu-op${st.r ? (c === a.c ? ' cu-bien' : c === st.r ? ' cu-mal' : '') : ''}" data-c="${c}" ${st.r ? 'disabled' : ''}>${c}</button>`).join('')}</div>
      ${st.r ? `<div class="${st.r === a.c ? 'okbox' : 'aviso'}">${esc(L(a.f))}<p>${esc(t('Huellas:'))} ${a.h.map(h => esc(L(HUELLAS[h]))).join(' · ')}</p></div><div class="actions"><button class="btn btn-primary" id="btnCN" type="button">${esc(t('Otro artículo'))}</button></div>` : ''}`;
    $$('#labBox [data-c]').forEach(b => b.onclick = () => { st.r = b.dataset.c; ev({k: 'lab', lab: 'const', id: a.id, ok: st.r === a.c}); guarda(); labConst(); });
    if ($('btnCN')) $('btnCN').onclick = () => { st.a = Math.floor(Math.random() * ARTS.length); st.r = null; labConst(); };
  } else {
    st.obj = st.obj || '1812'; const res = st.res;
    $('labBox').innerHTML = tabs + `<p>${esc(t('Redacta un artículo inventado al estilo de una constitución. La IA intentará adivinar cuál es: si acierta, pusiste bien las huellas.'))}</p>
      <div class="field"><label for="cObj">${esc(t('Constitución que imitas'))}</label><select id="cObj">${CONSTS.map(c => `<option ${c === st.obj ? 'selected' : ''}>${c}</option>`).join('')}</select></div>
      <div class="field"><label for="cArt">${esc(t('Tu artículo'))}</label><textarea id="cArt" rows="3">${esc(st.art || '')}</textarea></div>
      <div class="actions"><button class="btn btn-primary" id="btnAdiv" type="button">${ico('sparkles')} ${esc(t('Que la IA lo adivine'))}</button></div>
      ${res ? `<div class="${res.c === st.obj ? 'okbox' : 'aviso'}"><b>${esc(res.c === st.obj ? t('La IA ha acertado: {0}.', res.c) : t('La IA cree que es de {0}.', res.c))}</b> ${esc(res.razon || '')}<p>${esc(t('Huellas que reconoce y que tiene la constitución que imitas:'))} ${res.h.ok.map(h => esc(L(HUELLAS[h]))).join(' · ') || '—'}</p>${res.h.mal.length ? `<p>${esc(t('Huellas que reconoce pero que no son de esa constitución:'))} ${res.h.mal.map(h => esc(L(HUELLAS[h]))).join(' · ')}</p>` : ''}</div>` : ''}`;
    $('cObj').onchange = e => { st.obj = e.target.value; st.res = null; guarda(); };
    $('cArt').oninput = e => { st.art = e.target.value; guarda(); };
    $('btnAdiv').onclick = () => conEspera($('btnAdiv'), async () => { if (wc(st.art) < 8) return toast(t('Escribe un artículo de al menos 8 palabras')); const raw = await ia(promptAdivina(st.art), 400); if (!raw) return; st.res = {c: String(raw.c || '').match(/\d{4}/)?.[0] || '?', razon: raw.razon, h: aciertoHuellas(st.obj, raw.huellas)}; ev({k: 'lab', lab: 'constinv', id: st.obj, ok: st.res.c === st.obj}); await guardaYa(); labConst(); });
  }
  $$('#labBox [data-cm]').forEach(b => b.onclick = () => { st.m = b.dataset.cm; guarda(); labConst(); });
}

/* ── 4 · dossier ── */
const TX = id => TEXTOS.find(x => x.id === id);
const doS = id => (S.dos[id] = S.dos[id] || {pasos: {}, tutor: {}, def: null});
function pintaDossier() {
  $('doCod').value = S.codigo;
  if (!S.codigo) { $('selTexto').innerHTML = ''; $('doTexto').innerHTML = `<p class="empty">${esc(t('Escribe tu código de estudiante para recibir tus seis textos.'))}</p>`; $('doPasos').innerHTML = $('doDefensa').innerHTML = ''; return; }
  const asig = asignaTextos(S.codigo, TEXTOS); if (!asig.includes(S.txtId)) S.txtId = asig[0];
  opciones('selTexto', asig.map(id => [id, L(TX(id).tit)]), S.txtId);
  const tx = TX(S.txtId), d = doS(tx.id);
  $('doTexto').innerHTML = `<h3>${esc(L(tx.tit))}</h3><blockquote class="cu-txt">${esc(tx.txt).replace(/\n/g, '<br>')}</blockquote>`;
  $('doPasos').innerHTML = `<h3>${esc(t('Tu comentario, paso a paso'))}</h3><div id="doCheck" aria-live="polite">${checkDossier(tx, d)}</div>
    ${PASOS_DO.map(p => { const tu = d.tutor[p[0]]; return `<div class="cu-paso"><div class="field"><label for="p_${p[0]}"><b>${esc(t(p[1]))}</b> · ${esc(t(p[2]))}</label><textarea id="p_${p[0]}" data-paso="${p[0]}" rows="3">${esc(d.pasos[p[0]] || '')}</textarea></div>
      <div class="actions"><button class="btn btn-ghost btn-sm" data-tutor="${p[0]}" type="button">${ico('sparkles')} ${esc(t('Preguntar al tutor'))}</button></div>
      ${tu ? `<div class="cu-ia"><p>✓ ${esc(tu.bien)}</p><p>… ${esc(tu.falta)}</p><p><b>${esc(tu.pregunta)}</b></p>${tu.citas.filter(c => !c.ok).map(c => `<small>⚠ ${esc(t('El tutor cita algo que no está en el texto:'))} «${esc(c.c)}»</small>`).join('')}</div>` : ''}</div>`; }).join('')}`;
  $$('#doPasos [data-paso]').forEach(a => a.oninput = () => { d.pasos[a.dataset.paso] = a.value; guarda(); $('doCheck').innerHTML = checkDossier(tx, d); });
  $$('#doPasos [data-tutor]').forEach(b => b.onclick = () => conEspera(b, async () => { const p = PASOS_DO.find(x => x[0] === b.dataset.tutor); const bor = $('p_' + p[0]).value; d.pasos[p[0]] = bor; const raw = await ia(promptTutor(tx, p, bor), 600); if (!raw) return; d.tutor[p[0]] = {bien: sinNotas(raw.bien), falta: sinNotas(raw.falta), pregunta: sinNotas(raw.pregunta), citas: verificaCitas([raw.bien, raw.falta, raw.pregunta].join(' '), tx.txt)}; await guardaYa(); pintaDossier(); }));
  pintaDefensa(tx, d);
}
$('doCod').onchange = e => { const v = e.target.value.trim(); if (v === S.codigo) return; S.codigo = v; guarda(); pintaDossier(); };
$('selTexto').onchange = e => { S.txtId = e.target.value; guarda(); pintaDossier(); };
function checkDossier(tx, d) {
  const todo = PASOS_DO.map(p => d.pasos[p[0]] || '').join(' '), cs = conceptos(todo, tx.cl), cit = verificaCitas(todo, tx.txt);
  return `<p class="help">${esc(t('Conceptos clave tratados: {0} de {1}. Si citas el texto, ponlo entre «comillas»: el código comprueba que la cita es literal.', cs.filter(Boolean).length, cs.length))}</p>${cit.length ? `<p class="help">${cit.map(c => `${c.ok ? '✓' : '⚠'} «${esc(c.c.slice(0, 60))}»`).join(' · ')}</p>` : ''}`;
}
function pintaDefensa(tx, d) {
  const df = d.def;
  $('doDefensa').innerHTML = `<h3>${esc(t('Ensayo de la defensa oral'))}</h3><p class="help">${esc(t('Cinco minutos ante el profesor. Responde de viva voz con «Hablar» o escribiendo.'))}</p>
    ${!df ? `<div class="actions"><button class="btn btn-primary" id="btnDefP" type="button">${esc(t('Preparar preguntas'))}</button></div>` : df.qs.map((q, i) => `<div class="cu-paso"><p><b>${i + 1}. ${esc(q)}</b></p><textarea id="dr${i}" rows="2">${esc(df.rs[i] || '')}</textarea><p class="help cu-interim" id="di${i}"></p><button class="btn btn-ghost btn-sm cu-mic" id="dm${i}" type="button" aria-pressed="false">${ico('mic')} ${esc(t('Hablar'))}</button></div>`).join('') + `<div class="actions"><button class="btn btn-primary" id="btnDefV" type="button">${esc(t('Valorar mis respuestas'))}</button><button class="btn btn-ghost" id="btnDefN" type="button">${esc(t('Otras preguntas'))}</button></div>
    ${df.val ? `<div class="cu-ia">${df.val.map(c => `<p><b>${esc(t(c.c))}.</b> ${esc(c.t)}</p>`).join('')}</div>` : ''}`}`;
  if ($('btnDefP')) $('btnDefP').onclick = () => conEspera($('btnDefP'), async () => {
    let qs; if (conIA()) { const raw = await ia(promptDefensa(tx, PASOS_DO.map(p => d.pasos[p[0]] || '').join('\n')), 500); if (!raw) return; qs = (raw.preguntas || []).slice(0, 4).map(String); }
    else qs = [t('¿Qué tipo de texto es y quién lo dicta?'), ...tx.cl.slice(0, 3).map(g => t('¿Qué significa «{0}» en este texto y por qué es importante?', L(g)))];
    d.def = {qs, rs: [], val: null}; await guardaYa(); pintaDossier();
  });
  if (df) {
    df.qs.forEach((_, i) => { $('dr' + i).onchange = e => { df.rs[i] = e.target.value; guarda(); }; micro($('dm' + i), $('dr' + i), $('di' + i), () => { df.rs[i] = $('dr' + i).value; guarda(); }); });
    $('btnDefN').onclick = () => { d.def = null; guarda(); pintaDossier(); };
    $('btnDefV').onclick = () => conEspera($('btnDefV'), async () => {
      df.rs = df.qs.map((_, i) => $('dr' + i).value);
      if (conIA()) { const raw = await ia(promptValoraDefensa(tx, df.qs.map((q, i) => ({q, r: df.rs[i]}))), 800); if (!raw) return; df.val = (raw.criterios || []).map(c => ({c: String(c.c), t: sinNotas(c.t)})); }
      else { const cs = conceptos(df.rs.join(' '), tx.cl); df.val = [{c: 'Conceptos jurídicos', t: t('Sin clave de IA solo se cuentan los conceptos clave: has usado {0} de {1}.', cs.filter(Boolean).length, cs.length)}]; }
      ev({k: 'defensa', id: tx.id}); await guardaYa(); pintaDossier();
    });
  }
}

/* ── 5 · progreso, copia y entrega ── */
function pintaProgreso() {
  const n = S.ev.filter(e => e.k === 'item').length, cons = S.ev.filter(e => e.k === 'consulta');
  $('pgBox').innerHTML = `<p>${esc(t('{0} respuestas de práctica · {1} dictámenes ({2} correctos) · {3} actividades de laboratorio.', n, cons.length, cons.filter(e => e.ok).length, S.ev.filter(e => e.k === 'lab').length))}</p>
    ${RA.map(r => { const {p, n: k} = dominio(S.ev, r.id); const pc = Math.round(p * 100); return `<div class="cu-bar"><span>${esc(L(r.c))}</span><div class="cu-bar-b" role="meter" aria-valuenow="${pc}" aria-valuemin="0" aria-valuemax="100" aria-label="${esc(L(r.c))}"><i style="width:${pc}%"></i></div><b>${k < 1 ? '—' : pc + ' %'}</b></div>`; }).join('')}
    <p class="help">${esc(t('«—»: aún no has respondido preguntas de este resultado de aprendizaje.'))}</p>`;
}
const entrega = () => ({app: 'curia', version: '1.0', codigo: S.codigo, fecha: new Date().toISOString(), eventos: S.ev.map(({k, id, ra, ok, ts, lab, hechos}) => ({k, id, ra, ok, ts, lab, hechos})), textos: S.codigo ? asignaTextos(S.codigo, TEXTOS) : [], dossier: Object.fromEntries(Object.entries(S.dos).map(([id, d]) => [id, d.pasos]))});
$('btnEntrega').onclick = () => { if (!S.codigo) { go(4); return toast(t('Escribe primero tu código de estudiante en el dossier')); } dl(`curia_entrega_${slug(S.codigo)}.json`, JSON.stringify(entrega(), null, 1), 'application/json'); };
$('btnCopia').onclick = () => dl('curia_copia.json', JSON.stringify(S), 'application/json');
$('fCopia').onchange = async e => { const f = e.target.files[0]; if (!f) return; try { const p = JSON.parse(await f.text()); if (!Array.isArray(p.ev)) throw new Error(); S = {...S, ...p}; await guardaYa(); toast(t('Copia restaurada')); go(5); } catch { toast(t('El fichero no es una copia de CurIA')); } e.target.value = ''; };
$('btnBorra').onclick = async () => { if (!confirm(t('¿Borrar todo tu trabajo de este navegador?'))) return; S = {ev: [], tema: '', cur: null, co: {}, casoId: 'c1', nivel: 1, lab: 'pleito', labS: {}, codigo: '', dos: {}, txtId: '', def: [], esEjemplo: false}; await guardaYa(); go(0); };
$('btnDossierW').onclick = async () => {
  if (!S.codigo) return toast(t('Escribe primero tu código de estudiante en el dossier'));
  const md = asignaTextos(S.codigo, TEXTOS).map(id => { const d = S.dos[id] || {pasos: {}}; return `## ${L(TX(id).tit)}\n\n` + PASOS_DO.map(p => `**${t(p[1])}.** ${d.pasos[p[0]] || '—'}`).join('\n\n'); }).join('\n\n');
  try { dl('curia_dossier.docx', await wordDeMarkdown(md, {titulo: t('Dossier de fuentes'), subtitulo: S.codigo, pie: t('Generado con {0}.', APP_NAME)})); } catch (e) { toast(e.message, 7000); }
};

/* ── secciones: cronología, profesorado, temario ── */
const UOPS = () => UNIDADES.map(u => [u.id, `${u.id} · ${L(u.n)}`]);
function pintaCrono() {
  if (!$('crU').options.length) opciones('crU', [['', t('Todas')], ...UOPS()]);
  const u = $('crU').value, oc = $('crOc').checked, f = TEMAS.filter(x => !u || x.u === u).flatMap(x => x.fechas.map(([y, h]) => ({y, h, tm: x}))).sort((a, b) => a.y - b.y);
  $('crBox').innerHTML = `<ul class="cu-crono">${f.map((x, i) => `<li><button type="button" class="cu-y" data-y="${i}" aria-label="${esc(t('Ver el año'))}">${oc ? '?' : x.y < 0 ? -x.y + ' a. C.' : x.y}</button> ${esc(x.h)} <small class="muted">${esc(x.tm.id)}</small></li>`).join('')}</ul>`;
  $$('#crBox [data-y]').forEach(b => b.onclick = () => { const y = f[+b.dataset.y].y; b.textContent = y < 0 ? -y + ' a. C.' : y; });
}
$('crU').onchange = pintaCrono; $('crOc').onchange = pintaCrono;
function pintaTemario() {
  if (!$('teSel').options.length) opciones('teSel', TEMAS.map(x => [x.id, nombreTema(x)]));
  const x = temaDe($('teSel').value) || TEMAS[0];
  $('teBox').innerHTML = `<p>${esc(x.res)}</p><h3>${esc(t('Ideas clave'))}</h3><ul class="fa-ul">${x.ideas.map(i => `<li>${esc(i)}</li>`).join('')}</ul>
    <h3>${esc(t('Glosario'))}</h3><dl class="cu-dl">${x.glos.map(([a, b]) => `<dt>${esc(a)}</dt><dd>${esc(b)}</dd>`).join('')}</dl>
    <h3>${esc(t('Pasajes de la unidad didáctica'))}</h3>${x.pas.map(p => `<p class="cu-pas">«${esc(p[1])}»</p>`).join('')}`;
}
$('teSel').onchange = pintaTemario;
function pintaProf() {
  if (!$('pfU').options.length) opciones('pfU', UOPS());
  $('pfDef').innerHTML = S.def.length ? `<table class="cu-tab"><thead><tr><th>${esc(t('Código'))}</th><th>${esc(t('Texto'))}</th>${RUBRICA.map(c => `<th>${esc(t(c))}</th>`).join('')}<th>${esc(t('Nota'))}</th></tr></thead><tbody>${S.def.map((d, i) => `<tr><td>${esc(d.codigo)}</td><td>${esc(L(TX(d.texto).tit).slice(0, 40))}…</td>${RUBRICA.map((c, j) => `<td><select data-dr="${i}" data-dc="${j}" aria-label="${esc(t(c))}">${['', 1, 2, 3, 4].map(v => `<option ${d.p[j] == v && v !== '' ? 'selected' : ''}>${v}</option>`).join('')}</select></td>`).join('')}<td><b>${notaDef(d)}</b></td></tr>`).join('')}</tbody></table><p class="help">${esc(t('Cada criterio de 1 a 4; la nota sobre 10 es la media escalada. La pone el profesorado.'))}</p>` : '';
  $$('#pfDef [data-dr]').forEach(s => s.onchange = () => { S.def[+s.dataset.dr].p[+s.dataset.dc] = s.value ? +s.value : null; guarda(); pintaProf(); });
}
const notaDef = d => d.p.every(v => v) ? (d.p.reduce((a, b) => a + b, 0) / (4 * d.p.length) * 10).toFixed(1) : '—';
$('fDef').onchange = async e => { const f = e.target.files[0]; if (!f) return; try { const x = JSON.parse(await f.text()); if (x.app !== 'curia' || !x.codigo) throw new Error(); const asig = asignaTextos(x.codigo, TEXTOS); const texto = asig[Math.floor(Math.random() * asig.length)]; S.def.push({codigo: x.codigo, texto, p: [null, null, null, null]}); await guardaYa(); toast(t('Texto sorteado: {0}', L(TX(texto).tit))); pintaProf(); } catch { toast(t('El fichero no es una entrega de CurIA')); } e.target.value = ''; };
$('btnDefCsv').onclick = () => dl('curia_defensas.csv', csvDe([t('Código'), t('Texto'), ...RUBRICA.map(c => t(c)), t('Nota')], S.def.map(d => [d.codigo, L(TX(d.texto).tit), ...d.p, notaDef(d)])), 'text/csv;charset=utf-8');
$('fSeg').onchange = async e => {
  const fs = []; for (const f of e.target.files) { try { const x = JSON.parse(await f.text()); if (x.app === 'curia') fs.push(x); } catch {} }
  const a = analiza(fs, ITEMS);
  $('pfSeg').innerHTML = `<p>${esc(t('{0} ficheros válidos.', a.estudiantes))}</p><h4>${esc(t('Dominio por resultado de aprendizaje'))}</h4>${RA.map(r => { const v = a.porRA[r.id]; return v ? `<div class="cu-bar"><span>${esc(L(r.c))}</span><div class="cu-bar-b"><i style="width:${Math.round(v.ok / v.n * 100)}%"></i></div><b>${Math.round(v.ok / v.n * 100)} %</b></div>` : ''; }).join('')}
    <h4>${esc(t('Preguntas más falladas'))}</h4><ul class="fa-ul">${a.filas.slice(0, 10).map(f => `<li>${Math.round(f.p * 100)} % (${f.n}) · ${esc(f.item ? L(f.item.q) : f.id)}</li>`).join('')}</ul>`;
  e.target.value = '';
};
$('btnEF').onclick = () => { const u = $('pfU').value, ts = TEMAS.filter(x => x.u === u); dl(`curia_examforge_${u}.txt`, ts.map(x => `# ${nombreTema(x)}\n\n${x.res}\n\n${x.pas.map(p => p[1].replace(/\s*\n+\s*/g, ' ')).join('\n')}\n\n${x.fechas.map(([y, h]) => `${y}: ${h}`).join('\n')}`).join('\n\n'), 'text/plain;charset=utf-8'); };
$('btnGift').onclick = () => { const u = $('pfU').value; dl(`curia_${u}.gift.txt`, gift(ITEMS.filter(x => x.u === u)), 'text/plain;charset=utf-8'); };

/* ── arranque ── */
window.addEventListener('langchange', () => { if (typeof step !== 'undefined') (RENDER[step] || (() => {}))(); });
(async () => { const p = await cargaEstado(); if (p) S = {...S, ...p}; iniciaUI(); $('coVoz').checked = !!S.voz; if (!VOZ_OK) $('coMic').title = t('Tu navegador no admite el dictado por voz: usa Chrome, Edge o Safari.'); go(0); })();
