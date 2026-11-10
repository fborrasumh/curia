/* ══ Voz: dictado con el reconocimiento del propio navegador (no gasta tokens de IA) y lectura en voz alta ══ */
const SRec = typeof window !== 'undefined' ? (window.SpeechRecognition || window.webkitSpeechRecognition) : null;
const VOZ_OK = !!SRec;
let _rec = null;
/* conecta un botón de micrófono con un campo de texto: el texto dictado se añade al campo; lo provisional se ve debajo */
function micro(btn, campo, interim, alTerminar) {
  if (!VOZ_OK) { btn.disabled = true; btn.title = t('Tu navegador no admite el dictado por voz: usa Chrome, Edge o Safari.'); return; }
  btn.onclick = () => {
    if (_rec) { _rec.stop(); return; }
    const r = new SRec(); r.lang = locale(); r.interimResults = true; r.continuous = true;
    r.onresult = ev => { let prov = ''; for (let i = ev.resultIndex; i < ev.results.length; i++) { const x = ev.results[i]; if (x.isFinal) campo.value = (campo.value ? campo.value.trimEnd() + ' ' : '') + x[0].transcript.trim(); else prov += x[0].transcript; } interim.textContent = prov; campo.dispatchEvent(new Event('input')); };
    r.onerror = e => { if (e.error === 'not-allowed') toast(t('El navegador no tiene permiso para usar el micrófono.'), 7000); else if (e.error !== 'aborted' && e.error !== 'no-speech') toast(t('Error de dictado: {0}', e.error)); };
    r.onend = () => { _rec = null; btn.setAttribute('aria-pressed', 'false'); btn.classList.remove('cu-on'); interim.textContent = ''; if (alTerminar) alTerminar(); };
    try { r.start(); _rec = r; btn.setAttribute('aria-pressed', 'true'); btn.classList.add('cu-on'); interim.textContent = t('Escuchando… pulsa otra vez para terminar.'); } catch (e) { toast(e.message); }
  };
}
function habla(texto) {
  if (typeof speechSynthesis === 'undefined' || !texto) return;
  speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(texto); u.lang = locale();
  const v = speechSynthesis.getVoices().find(x => x.lang && x.lang.toLowerCase().startsWith(LANG)); if (v) u.voice = v;
  speechSynthesis.speak(u);
}

/* ══ Prompts. La IA solo recibe la ficha del caso o los datos de la actividad, y responde en JSON para que el código lo compruebe. ══ */
const SYS_JSON = 'Respondes SOLO con JSON válido, sin texto antes ni después.';
function promptCliente(caso, nivel, historia, pregunta) {
  const ficha = caso.hechos.map(h => `- [${h.id}] ${h.txt}`).join('\n');
  const reglas = {1: 'Colaboras: si la pregunta es vaga, das el hecho más útil de la ficha.', 2: 'Respondes solo a lo que te preguntan, sin adelantar nada.', 3: `Ocultas el hecho [${(caso.hechos.find(h => h.clave && h.id !== 'lugar') || caso.hechos[0]).id}] hasta que te lo pregunten de forma directa y concreta; si te preguntan de forma vaga, lo eludes.`}[nivel];
  return `Eres ${caso.cliente}, en el año ${caso.y}. Hablas con un jurista en su despacho. Eres un personaje de ficción con fines docentes.
FICHA (lo único que sabes; no inventes nada más):
${ficha}
Reglas: responde en primera persona, con naturalidad y en un máximo de 60 palabras. ${reglas} Si te preguntan algo que no está en la ficha, di que no lo sabes. No digas qué ley se aplica ni qué tribunal es competente: eso lo tiene que averiguar el jurista. No uses años que no estén en la ficha.
${INSTR_IDIOMA()}
CONVERSACIÓN HASTA AHORA:
${historia.map(m => (m.r === 'u' ? 'Jurista: ' : 'Tú: ') + m.t).join('\n') || '(ninguna)'}
NUEVA PREGUNTA DEL JURISTA: ${pregunta}
Devuelve: {"respuesta":"lo que dices","hechos":["ids de la ficha que revelas en esta respuesta"]}`;
}
function promptDictamen(caso, d, ok) {
  return `Eres un profesor de Historia del Derecho. Un estudiante ha emitido este dictamen sobre un caso de ${caso.y}.
CASO: ${caso.presenta}
SOLUCIÓN (verificada): derecho aplicable: «${caso.dictamen.derecho.op[caso.dictamen.derecho.ok]}»; tribunal: «${caso.dictamen.tribunal.op[caso.dictamen.tribunal.ok]}». Fundamento: ${caso.por}
ELECCIONES DEL ESTUDIANTE: derecho ${ok.derecho ? 'correcto' : 'incorrecto'}, tribunal ${ok.tribunal ? 'correcto' : 'incorrecto'}.
RAZONAMIENTO DEL ESTUDIANTE: ${d.razon}
Comenta su razonamiento en 3-5 frases: qué está bien fundado, qué falta y qué debería repasar. No pongas nota ni puntuación. Si citas su texto, ponlo entre comillas.
${INSTR_IDIOMA()}
Devuelve: {"comentario":"..."}`;
}
function promptAbogados(ep, a, b) {
  return `Dos abogados ficticios alegan ante un juez en ${L(ep.lugar)}, año ${ep.y}. Caso: ${L(PLEITO.caso)}
El abogado A sostiene que el pleito debe resolverse por «${a}». El abogado B sostiene que debe resolverse por «${b}».
Escribe el alegato de cada uno (máximo 70 palabras cada uno), con el tono de la época, nombrando su fuente. No digas cuál tiene razón. No añadas años.
${INSTR_IDIOMA()}
Devuelve: {"a":"alegato de A","b":"alegato de B"}`;
}
function promptDiputados(dl) {
  return `Dos diputados ficticios intervienen en una sesión de Cortes en ${dl.y}. Situación: ${L(dl.rol)} Pregunta que se vota: ${L(dl.q)}
Argumentos a favor: ${L(dl.pro)} Argumentos en contra: ${L(dl.con)}
Escribe una intervención breve de cada uno (máximo 70 palabras), con el estilo parlamentario de la época, usando solo esos argumentos. No reveles qué se decidió.
${INSTR_IDIOMA()}
Devuelve: {"pro":"intervención a favor","con":"intervención en contra"}`;
}
function promptAdivina(art) {
  return `Un estudiante ha redactado un artículo constitucional inventado imitando una de estas constituciones españolas: ${CONSTS.join(', ')}.
ARTÍCULO: ${art}
Huellas posibles (usa estas claves): ${Object.entries(HUELLAS).map(([k, v]) => `${k} = ${v[0]}`).join('; ')}.
Adivina a cuál imita y qué huellas reconoces en el texto.
${INSTR_IDIOMA()}
Devuelve: {"c":"año de la constitución","huellas":["claves"],"razon":"una o dos frases"}`;
}
const PASOS_DO = [['ubicar', 'Ubicación', '¿Qué texto es, de cuándo y quién lo dicta?'], ['naturaleza', 'Naturaleza jurídica', '¿Qué tipo de norma o fuente es y qué fuerza tiene?'], ['contexto', 'Contexto', '¿Qué situación histórica lo explica?'], ['institucion', 'Instituciones y conceptos', '¿Qué instituciones o principios aparecen y qué significan?'], ['valoracion', 'Valoración', '¿Qué consecuencias tuvo y qué queda hoy?']];
function promptTutor(tx, paso, borrador) {
  return `Eres un tutor de Historia del Derecho que ayuda a un estudiante a comentar un texto. No escribes el comentario: haces preguntas que le hagan pensar.
TEXTO: ${L(tx.tit)}
${tx.txt}
PASO DEL COMENTARIO: ${paso[1]} (${paso[2]})
BORRADOR DEL ESTUDIANTE: ${borrador || '(vacío)'}
Señala en una frase lo que está bien, en una frase lo que falta y termina con UNA pregunta concreta. No pongas nota. Si citas el texto, cópialo literalmente entre comillas «».
${INSTR_IDIOMA()}
Devuelve: {"bien":"...","falta":"...","pregunta":"..."}`;
}
function promptDefensa(tx, comentario) {
  return `Eres un profesor de Historia del Derecho en una defensa oral de cinco minutos. El estudiante ha comentado este texto:
TEXTO: ${L(tx.tit)}
${tx.txt}
SU COMENTARIO: ${comentario || '(no lo ha escrito)'}
Formula 4 preguntas breves y concretas que comprueben si entiende el texto (contexto, naturaleza, instituciones, consecuencias). ${INSTR_IDIOMA()}
Devuelve: {"preguntas":["...","...","...","..."]}`;
}
function promptValoraDefensa(tx, pares) {
  return `Eres un profesor de Historia del Derecho. Valora las respuestas orales (transcritas) de un estudiante sobre «${L(tx.tit)}».
${pares.map((p, i) => `P${i + 1}: ${p.q}\nR${i + 1}: ${p.r || '(sin respuesta)'}`).join('\n')}
Para cada uno de estos criterios escribe una frase de comentario: Precisión histórica; Uso del texto; Conceptos jurídicos; Claridad. No pongas notas ni puntuaciones.
${INSTR_IDIOMA()}
Devuelve: {"criterios":[{"c":"Precisión histórica","t":"..."},{"c":"Uso del texto","t":"..."},{"c":"Conceptos jurídicos","t":"..."},{"c":"Claridad","t":"..."}]}`;
}
const RUBRICA = ['Precisión histórica', 'Uso del texto', 'Conceptos jurídicos', 'Claridad'];
