/* ── navegación Forja: barra superior, stepper, barra inferior, ventanas, ayuda y ajustes de IA ─────────────
   La app define (en app.js; se leen al ejecutar, no al cargar el módulo) y llama a iniciaUI() al arrancar:
     const STEPS  = ['Inicio', 'Paso 1', ...];                   // etiquetas del stepper (la actual se muestra con nombre)
     const NAV    = [['Empezar',''], ['Siguiente: …','pista'], …]; // [texto del botón «siguiente», pista de la barra inferior] por pantalla
     const RENDER = {0: pintaInicio, 1: pintaX, …};               // funciones que pintan cada pantalla al entrar
     const GLOS   = [['Título','Texto'], …];                       // ayuda
   Idiomas: STEPS, NAV, GLOS y HUBS se escriben en español y se traducen con t() (módulo 65-i18n; diccionario I18N en src/i18n.js).
   Opcionales:  const CAN_NEXT = i => true|'mensaje';  // validación antes de avanzar
                const HUBS = ['Glosario', 'Progreso'];  // secciones fuera del recorrido lineal: pantallas con data-step = STEPS.length + k.
                // Al entrar en una sección el stepper muestra solo su nombre, la barra de progreso se vacía y «Atrás»/«Siguiente» vuelven al inicio. */
let step = 0;
const esHub = i => i >= STEPS.length;
function buildStepper() {
  if (esHub(step)) {
    const nombre = (typeof HUBS !== 'undefined' && HUBS[step - STEPS.length]) || '';
    $('stepper').innerHTML = `<button class="sdot" type="button" data-go="0" data-state="done"><span class="n">${ico('left')}</span><span class="lbl">${esc(t('Inicio'))}</span></button><span class="sline on"></span><button class="sdot" type="button" data-state="now" aria-current="page"><span class="n">${ico(typeof LOGO_ICON === 'string' ? LOGO_ICON : 'bulb')}</span><span class="lbl">${esc(t(nombre))}</span></button>`;
    $$('#stepper [data-go]').forEach(b => b.onclick = () => go(+b.dataset.go)); return;
  }
  $('stepper').innerHTML = STEPS.map((s, i) => `${i ? `<span class="sline${i <= step ? ' on' : ''}"></span>` : ''}<button class="sdot" type="button" data-go="${i}" data-state="${i < step ? 'done' : i === step ? 'now' : ''}" ${i === step ? 'aria-current="step"' : ''}><span class="n">${i < step ? ico('check') : i === 0 ? ico(typeof LOGO_ICON === 'string' ? LOGO_ICON : 'bulb') : i}</span><span class="lbl">${esc(t(s))}</span></button>`).join('');
  $$('#stepper [data-go]').forEach(b => b.onclick = () => go(+b.dataset.go));
}
function updateNav() { const N = NAV[step] || ['Volver al inicio', '']; $('navBack').classList.toggle('hidden', step === 0 || esHub(step)); $('navNextTxt').textContent = t(N[0]); $('navHint').textContent = N[1] ? t(N[1]) : ''; }
function go(i) {
  step = i; $$('.screen').forEach(s => s.classList.toggle('on', +s.dataset.step === i)); $('progBar').style.width = esHub(i) ? '0%' : (i / (STEPS.length - 1) * 100) + '%';
  (RENDER[i] || (() => {}))(); buildStepper(); updateNav(); window.scrollTo({top: 0, behavior: 'instant'});
}
$('goHome').onclick = () => go(0);
$('navBack').onclick = () => { if (step > 0) go(step - 1); };
$('navNext').onclick = () => { if (esHub(step)) return go(0); const ok = typeof CAN_NEXT === 'function' ? CAN_NEXT(step) : true; if (ok !== true && ok) return toast(ok); go(step === STEPS.length - 1 ? 0 : step + 1); };

/* ventanas modales (Escape y clic fuera cierran; data-close en el botón) */
const _cierres = {};   // id de modal → función a ejecutar al cerrar
$$('.modal').forEach(m => m.addEventListener('click', ev => { if (ev.target === m || ev.target.hasAttribute('data-close')) { m.classList.remove('on'); _cierres[m.id]?.(); } }));
document.addEventListener('keydown', e => { if (e.key === 'Escape') $$('.modal.on').forEach(m => { m.classList.remove('on'); _cierres[m.id]?.(); }); });
/* Ajustes de IA. El modelo se elige en un <select> (no en <input list>: un <datalist> con el campo ya relleno solo muestra
   las opciones que coinciden con lo escrito, y la lista «no se carga» a ojos de la persona). «Otro modelo…» abre un campo libre. */
const OTRO_MODELO = '__otro';
function pintaModelos(pv = getProv()) {
  const sel = $('selModelo'); if (!sel) return;
  let ml = []; try { ml = JSON.parse(localStorage.getItem(APP + '_models_' + pv) || '[]'); } catch {}
  const act = getMod(pv), lista = [...new Set([act, ...ml, PROV[pv].m])].filter(Boolean);
  sel.innerHTML = lista.map(m => `<option value="${esc(m)}">${esc(m)}${m === act ? ' · ' + esc(t('actual')) : ''}${ml.length && !ml.includes(m) ? ' · ' + esc(t('no aparece en tu clave')) : ''}</option>`).join('')
    + `<option value="${OTRO_MODELO}">${esc(t('Otro modelo (escribirlo)…'))}</option>`;
  sel.value = act; $('modelo').value = act; $('modelo').hidden = true;
}
function cargaIA() { const pv = getProv(); $('selProv').value = pv; $('apiKey').value = getKey(pv); $('apiKey').placeholder = KPH[pv]; pintaModelos(pv); }
/* pide a la API del proveedor los modelos de ESA clave y los pone en el desplegable (silencio: sin mensaje si falta la clave) */
async function cargaModelos(silencio = false) {
  const st = $('iaEstado'), pv = getProv();
  if (!getKey(pv)) { if (!silencio) st.textContent = t('Primero pega tu clave.'); return []; }
  st.textContent = t('Cargando los modelos de tu clave…');
  try {
    const l = await listaModelos(pv); if (pv !== getProv()) return l;
    localStorage.setItem(APP + '_models_' + pv, JSON.stringify(l)); pintaModelos(pv);
    st.textContent = l.length ? t('{0} modelos disponibles en tu clave: elígelo en el desplegable.', l.length) : t('Tu clave no devolvió ningún modelo de texto. Escribe el nombre con «Otro modelo».');
    return l;
  } catch (e) { st.textContent = e.message; return []; }
}
const KPH = {openai: 'sk-proj-…', gemini: 'AIza…', anthropic: 'sk-ant-…'};
/* iniciaUI(): llámala UNA vez desde app.js, al final, justo antes de go(0). Enlaza la ayuda y los ajustes de IA.
   (No se hace al cargar el módulo porque GLOS y el resto de constantes de la app aún no existen en ese momento.) */
function iniciaUI() {
  if (typeof initI18n === 'function') initI18n();
  window.addEventListener('langchange', () => { if ($('btnHelp')) $('glos').innerHTML = (typeof GLOS !== 'undefined' ? GLOS : []).map(g => `<div><b>${esc(t(g[0]))}</b><span>${esc(t(g[1]))}</span></div>`).join(''); (RENDER[step] || (() => {}))(); buildStepper(); updateNav(); if ($('mIA') && $('mIA').classList.contains('on')) cargaIA(); });
  if ($('btnHelp')) { $('glos').innerHTML = (typeof GLOS !== 'undefined' ? GLOS : []).map(g => `<div><b>${esc(t(g[0]))}</b><span>${esc(t(g[1]))}</span></div>`).join(''); $('btnHelp').onclick = () => $('mHelp').classList.add('on'); }
  if ($('btnIA')) {
    const sinLista = () => { try { return !JSON.parse(localStorage.getItem(APP + '_models_' + getProv()) || '[]').length; } catch { return true; } };
    $('selProv').onchange = () => { localStorage.setItem(APP + '_prov', $('selProv').value); cargaIA(); if (getKey() && sinLista()) cargaModelos(true); };
    let _kt; $('apiKey').oninput = () => { const pv = getProv(); localStorage.setItem(PROV[pv].k, $('apiKey').value.trim()); localStorage.removeItem(APP + '_models_' + pv); clearTimeout(_kt); _kt = setTimeout(() => { if ($('apiKey').value.trim().length >= 20) cargaModelos(true); }, 900); };
    $('selModelo').onchange = () => { const v = $('selModelo').value; if (v === OTRO_MODELO) { $('modelo').hidden = false; $('modelo').value = ''; $('modelo').focus(); return; } $('modelo').hidden = true; localStorage.setItem(APP + '_model_' + getProv(), v); };
    $('modelo').oninput = () => localStorage.setItem(APP + '_model_' + getProv(), $('modelo').value.trim() || PROV[getProv()].m);
    $('modelo').onchange = () => pintaModelos();
    $('btnEye').onclick = () => { const k = $('apiKey'); k.type = k.type === 'password' ? 'text' : 'password'; };
    $('btnModelos').onclick = () => cargaModelos(false);
    $('btnIA').onclick = () => { cargaIA(); $('mIA').classList.add('on'); if (getKey() && sinLista()) cargaModelos(true); };
  }
}
/* ¿hay clave? si no, abre los ajustes de IA y avisa */
function pideClave() { if (getKey()) return true; if ($('mIA')) { cargaIA(); $('mIA').classList.add('on'); } toast(t('Pega tu clave de IA para continuar')); return false; }
