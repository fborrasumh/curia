/* ── idiomas: español (por defecto), inglés y portugués; opcionales: català, euskara y galego (app.json → langs) ─────────────────────────────────────────────────
   El español es el idioma de origen: está escrito en el HTML y en el JS. Las demás lenguas se traducen con diccionarios.
   Dos formas de marcar texto traducible (una sola función, t(), y un diccionario por idioma):
     · HTML estático:   <span data-i18n="clave">Texto en español</span>
                        <input data-i18n-attr="placeholder:clave;aria-label:otra" placeholder="…">
       En español se conserva el texto del HTML; en los demás idiomas se sustituye por I18N[lang][clave] (HTML de confianza: nunca metas
       datos de la persona en el diccionario). Envuelve en <span> solo el texto, no los iconos ni los botones enteros.
     · JavaScript:      t('Texto en español con {0} huecos', valor)   → la propia frase en español es la clave (estilo gettext)
                        t('msg.clave')                                → clave corta; su texto en español va en I18N.es['msg.clave']
   La app define (en src/i18n.js, se lee al ejecutar):   const I18N = {en: {…}, pt: {…}, es: {…solo claves cortas…}};
   Este módulo trae I18N_BASE con todo lo que ponen los módulos de Forja (errores de IA, ajustes, avisos); la app puede sobrescribirlo.
   build.py inyecta  const LANGS_ON = ["es","en","pt"]  desde app.json → langs  (con un solo idioma el selector no se muestra).
   Reglas que evitan fallos reales:
     · Guarda DATOS en el estado, no frases ya traducidas; traduce al pintar (si no, al cambiar de idioma quedan frases viejas).
     · Cada pantalla se repinta al cambiar de idioma (evento «langchange» → RENDER[step]).
     · A la IA se le pide el idioma con INSTR_IDIOMA(); las citas literales del material se copian en su idioma original. */
const LANGS = {es: 'Español', ca: 'Català', eu: 'Euskara', gl: 'Galego', en: 'English', pt: 'Português'};   // ca, eu y gl: opcionales (lenguas cooficiales de España)
const IA_LANG = {es: 'español', ca: 'català', eu: 'euskara (vasco)', gl: 'galego (gallego)', en: 'English', pt: 'português'};   // cómo se le nombra el idioma a la IA
const LOCALE = {es: 'es-ES', ca: 'ca-ES', eu: 'eu-ES', gl: 'gl-ES', en: 'en-GB', pt: 'pt-PT'};            // formatos de número y fecha
const langsOn = () => (typeof LANGS_ON !== 'undefined' ? LANGS_ON : ['es', 'en', 'pt']).filter(l => LANGS[l]);
let LANG = 'es', _D = null;
const locale = () => LOCALE[LANG] || 'es-ES';
const langIA = () => IA_LANG[LANG] || 'español';
/* frase para añadir a CADA prompt cuya respuesta ve la persona: la IA escribe en su idioma, pero ids, claves JSON y citas literales no se tocan */
const INSTR_IDIOMA = () => `Escribe todos los textos de tu respuesta (los valores de los campos JSON) en ${langIA()}. No traduzcas los nombres de las claves JSON, los identificadores ni las citas literales del material: cópialas en su idioma original, sin cambiar nada.`;

const I18N_BASE = {
  en: {
    'Inicio': 'Home', 'Ayuda': 'Help', 'IA': 'AI', 'Pasos': 'Steps', 'Atrás': 'Back', 'Siguiente': 'Next', 'Cerrar': 'Close', 'Cancelar': 'Cancel', 'Idioma': 'Language',
    'Volver al inicio': 'Back to the start', 'Inteligencia artificial': 'Artificial intelligence', 'Proveedor': 'Provider', 'Tu clave de API': 'Your API key', 'Ver': 'Show', 'Modelo': 'Model',
    'Ver los modelos de mi clave': 'Show the models available for my key',
    'f.ia.ayuda': 'The key is stored only in this browser and sent only to your provider. Each person uses their own key and pays for their own use. Choose an inexpensive model: this use does not need the most powerful one.',
    'Esto es lo que saldría hacia tu proveedor de IA': 'This is what would be sent to your AI provider',
    'f.envio.chk': 'I have reviewed the sample and confirm that it may leave my computer.',
    'Muestra del envío:': 'Sample of what is sent:', 'Realizada entre': 'Created by', 'Realizada por': 'Created by',
    'Cómo funciona': 'How it works', 'Dónde va cada cosa': 'Where everything goes',
    'Siempre en tu ordenador': 'Always on your computer', 'Sale hacia tu proveedor de IA': 'Sent to your AI provider',
    'No se pudo cargar la librería {0}. Puede que un bloqueador o la red de tu institución la impida; prueba otra red o desactiva el bloqueador en esta página.': "Could not load the {0} library. A content blocker or your institution's network may be preventing it; try another network or disable the blocker on this page.",
    'Sin conexión: hace falta internet para abrir este tipo de fichero la primera vez.': "Offline: an internet connection is needed to open this type of file the first time.",
    'No se pudo guardar en el navegador (¿demasiado material?)': 'Could not save in the browser (too much material?)', 'No se pudo guardar en el navegador': 'Could not save in the browser',
    '{0} no reconoce tu clave. Revísala en el botón «IA».': '{0} does not recognise your key. Check it with the “AI” button.',
    'Tu clave no tiene acceso al modelo «{0}». Elige otro en el botón «IA».': 'Your key has no access to the model “{0}”. Choose another one with the “AI” button.',
    'Tu cuenta de {0} no tiene saldo o ha alcanzado su límite.': 'Your {0} account has no balance or has reached its limit.',
    'El modelo «{0}» no admite imágenes. Elige uno con visión.': 'The model “{0}” does not accept images. Choose one with vision.',
    'No hay conexión con {0}.': 'No connection to {0}.', '{0} no responde ahora mismo. Inténtalo de nuevo en un momento.': '{0} is not responding right now. Please try again in a moment.',
    'Falta tu clave de IA. Pulsa el botón «IA», arriba.': 'Your AI key is missing. Press the “AI” button at the top.', 'OpenAI no responde ahora mismo.': 'OpenAI is not responding right now.',
    'El proveedor ha bloqueado la respuesta ({0}).': 'The provider blocked the response ({0}).',
    'La IA no devolvió una respuesta con el formato esperado. Inténtalo de nuevo.': 'The AI did not return a response in the expected format. Please try again.',
    'Primero pega tu clave.': 'Paste your key first.', '{0} modelos disponibles en tu clave; escribe o elige uno.': '{0} models available for your key; type or choose one.',
    'Pega tu clave de IA para continuar': 'Paste your AI key to continue',
    'El PowerPoint no tiene diapositivas': 'The PowerPoint has no slides', 'Formato no admitido (usa Word, PDF, PowerPoint, texto, imágenes, audio o vídeo)': 'Unsupported format (use Word, PDF, PowerPoint, text, images, audio or video)',
    '«{0}» pesa más de 600 MB: exporta solo el audio (MP3 o WAV) y súbelo en su lugar.': '“{0}” is larger than 600 MB: export only the audio (MP3 or WAV) and upload that instead.',
    'No se pudo leer el audio de «{0}». Prueba a exportarlo como MP3 o WAV.': 'Could not read the audio of “{0}”. Try exporting it as MP3 or WAV.',
    'Para transcribir necesitas una clave de OpenAI o de Gemini (Claude no transcribe audio). Añádela en el botón «IA».': 'To transcribe you need an OpenAI or Gemini key (Claude does not transcribe audio). Add it with the “AI” button.',
    'actual': "current",
    'no aparece en tu clave': "not available for your key",
    'Otro modelo (escribirlo)…': "Another model (type it)…",
    'Escribe el nombre exacto del modelo': "Type the exact model name",
    'Cargando los modelos de tu clave…': "Loading the models for your key…",
    '{0} modelos disponibles en tu clave: elígelo en el desplegable.': "{0} models available for your key: choose one from the drop-down list.",
    'Tu clave no devolvió ningún modelo de texto. Escribe el nombre con «Otro modelo».': "Your key returned no text models. Type the name with “Another model”."
  },
  pt: {
    'Inicio': 'Início', 'Ayuda': 'Ajuda', 'IA': 'IA', 'Pasos': 'Passos', 'Atrás': 'Voltar', 'Siguiente': 'Seguinte', 'Cerrar': 'Fechar', 'Cancelar': 'Cancelar', 'Idioma': 'Idioma',
    'Volver al inicio': 'Voltar ao início', 'Inteligencia artificial': 'Inteligência artificial', 'Proveedor': 'Fornecedor', 'Tu clave de API': 'A sua chave de API', 'Ver': 'Mostrar', 'Modelo': 'Modelo',
    'Ver los modelos de mi clave': 'Ver os modelos disponíveis na minha chave',
    'f.ia.ayuda': 'A chave é guardada apenas neste navegador e enviada apenas ao seu fornecedor. Cada pessoa usa a sua própria chave e paga a sua utilização. Escolha um modelo económico: esta utilização não precisa do mais potente.',
    'Esto es lo que saldría hacia tu proveedor de IA': 'Isto é o que seria enviado ao seu fornecedor de IA',
    'f.envio.chk': 'Revi a amostra e confirmo que pode sair do meu computador.',
    'Muestra del envío:': 'Amostra do que é enviado:', 'Realizada entre': 'Realizada por', 'Realizada por': 'Realizada por',
    'Cómo funciona': 'Como funciona', 'Dónde va cada cosa': 'Para onde vai cada coisa',
    'Siempre en tu ordenador': 'Sempre no seu computador', 'Sale hacia tu proveedor de IA': 'Enviado ao seu fornecedor de IA',
    'No se pudo cargar la librería {0}. Puede que un bloqueador o la red de tu institución la impida; prueba otra red o desactiva el bloqueador en esta página.': "Não foi possível carregar a biblioteca {0}. Um bloqueador ou a rede da sua instituição pode estar a impedi-la; experimente outra rede ou desative o bloqueador nesta página.",
    'Sin conexión: hace falta internet para abrir este tipo de fichero la primera vez.': "Sem ligação: é preciso internet para abrir este tipo de ficheiro pela primeira vez.",
    'No se pudo guardar en el navegador (¿demasiado material?)': 'Não foi possível guardar no navegador (demasiado material?)', 'No se pudo guardar en el navegador': 'Não foi possível guardar no navegador',
    '{0} no reconoce tu clave. Revísala en el botón «IA».': '{0} não reconhece a sua chave. Verifique-a no botão «IA».',
    'Tu clave no tiene acceso al modelo «{0}». Elige otro en el botón «IA».': 'A sua chave não tem acesso ao modelo «{0}». Escolha outro no botão «IA».',
    'Tu cuenta de {0} no tiene saldo o ha alcanzado su límite.': 'A sua conta {0} não tem saldo ou atingiu o limite.',
    'El modelo «{0}» no admite imágenes. Elige uno con visión.': 'O modelo «{0}» não aceita imagens. Escolha um com visão.',
    'No hay conexión con {0}.': 'Sem ligação a {0}.', '{0} no responde ahora mismo. Inténtalo de nuevo en un momento.': '{0} não está a responder neste momento. Tente novamente daqui a pouco.',
    'Falta tu clave de IA. Pulsa el botón «IA», arriba.': 'Falta a sua chave de IA. Prima o botão «IA», em cima.', 'OpenAI no responde ahora mismo.': 'A OpenAI não está a responder neste momento.',
    'El proveedor ha bloqueado la respuesta ({0}).': 'O fornecedor bloqueou a resposta ({0}).',
    'La IA no devolvió una respuesta con el formato esperado. Inténtalo de nuevo.': 'A IA não devolveu uma resposta no formato esperado. Tente novamente.',
    'Primero pega tu clave.': 'Cole primeiro a sua chave.', '{0} modelos disponibles en tu clave; escribe o elige uno.': '{0} modelos disponíveis na sua chave; escreva ou escolha um.',
    'Pega tu clave de IA para continuar': 'Cole a sua chave de IA para continuar',
    'El PowerPoint no tiene diapositivas': 'O PowerPoint não tem diapositivos', 'Formato no admitido (usa Word, PDF, PowerPoint, texto, imágenes, audio o vídeo)': 'Formato não suportado (use Word, PDF, PowerPoint, texto, imagens, áudio ou vídeo)',
    '«{0}» pesa más de 600 MB: exporta solo el audio (MP3 o WAV) y súbelo en su lugar.': '«{0}» tem mais de 600 MB: exporte apenas o áudio (MP3 ou WAV) e carregue-o em vez disso.',
    'No se pudo leer el audio de «{0}». Prueba a exportarlo como MP3 o WAV.': 'Não foi possível ler o áudio de «{0}». Tente exportá-lo como MP3 ou WAV.',
    'Para transcribir necesitas una clave de OpenAI o de Gemini (Claude no transcribe audio). Añádela en el botón «IA».': 'Para transcrever precisa de uma chave da OpenAI ou do Gemini (o Claude não transcreve áudio). Adicione-a no botão «IA».',
    'actual': "atual",
    'no aparece en tu clave': "não aparece na sua chave",
    'Otro modelo (escribirlo)…': "Outro modelo (escrevê-lo)…",
    'Escribe el nombre exacto del modelo': "Escreva o nome exato do modelo",
    'Cargando los modelos de tu clave…': "A carregar os modelos da sua chave…",
    '{0} modelos disponibles en tu clave: elígelo en el desplegable.': "{0} modelos disponíveis na sua chave: escolha-o na lista pendente.",
    'Tu clave no devolvió ningún modelo de texto. Escribe el nombre con «Otro modelo».': "A sua chave não devolveu nenhum modelo de texto. Escreva o nome com «Outro modelo»."
  },
  ca: {
    'Inicio': "Inici",
    'Ayuda': "Ajuda",
    'IA': "IA",
    'Pasos': "Passos",
    'Atrás': "Enrere",
    'Siguiente': "Següent",
    'Cerrar': "Tancar",
    'Cancelar': "Cancel·lar",
    'Idioma': "Idioma",
    'Volver al inicio': "Tornar a l’inici",
    'Inteligencia artificial': "Intel·ligència artificial",
    'Proveedor': "Proveïdor",
    'Tu clave de API': "La teva clau d’API",
    'Ver': "Veure",
    'Modelo': "Model",
    'Ver los modelos de mi clave': "Veure els models de la meva clau",
    'f.ia.ayuda': "La clau es desa només en aquest navegador i s’envia únicament al teu proveïdor. Cada persona fa servir la seva i paga el seu ús. Tria un model econòmic: aquest ús no necessita el més potent.",
    'Esto es lo que saldría hacia tu proveedor de IA': "Això és el que sortiria cap al teu proveïdor d’IA",
    'f.envio.chk': "He revisat la mostra i confirmo que pot sortir del meu ordinador.",
    'Muestra del envío:': "Mostra de l’enviament:",
    'Realizada entre': "Realitzada per",
    'Realizada por': "Realitzada per",
    'Cómo funciona': "Com funciona",
    'Dónde va cada cosa': "On va cada cosa",
    'Siempre en tu ordenador': "Sempre al teu ordinador",
    'Sale hacia tu proveedor de IA': "Surt cap al teu proveïdor d’IA",
    'No se pudo cargar la librería {0}. Puede que un bloqueador o la red de tu institución la impida; prueba otra red o desactiva el bloqueador en esta página.': "No s’ha pogut carregar la biblioteca {0}. Potser un bloquejador o la xarxa de la teua institució ho impedeix; prova una altra xarxa o desactiva el bloquejador en aquesta pàgina.",
    'Sin conexión: hace falta internet para abrir este tipo de fichero la primera vez.': "Sense connexió: cal internet per a obrir aquest tipus de fitxer la primera vegada.",
    'No se pudo guardar en el navegador (¿demasiado material?)': "No s’ha pogut desar al navegador (massa material?)",
    'No se pudo guardar en el navegador': "No s’ha pogut desar al navegador",
    '{0} no reconoce tu clave. Revísala en el botón «IA».': "{0} no reconeix la teva clau. Revisa-la al botó «IA».",
    'Tu clave no tiene acceso al modelo «{0}». Elige otro en el botón «IA».': "La teva clau no té accés al model «{0}». Tria’n un altre al botó «IA».",
    'Tu cuenta de {0} no tiene saldo o ha alcanzado su límite.': "El teu compte de {0} no té saldo o ha arribat al límit.",
    'El modelo «{0}» no admite imágenes. Elige uno con visión.': "El model «{0}» no admet imatges. Tria’n un amb visió.",
    'No hay conexión con {0}.': "No hi ha connexió amb {0}.",
    '{0} no responde ahora mismo. Inténtalo de nuevo en un momento.': "{0} no respon ara mateix. Torna-ho a provar d’aquí a un moment.",
    'Falta tu clave de IA. Pulsa el botón «IA», arriba.': "Falta la teva clau d’IA. Prem el botó «IA», a dalt.",
    'OpenAI no responde ahora mismo.': "OpenAI no respon ara mateix.",
    'El proveedor ha bloqueado la respuesta ({0}).': "El proveïdor ha bloquejat la resposta ({0}).",
    'La IA no devolvió una respuesta con el formato esperado. Inténtalo de nuevo.': "La IA no ha retornat una resposta amb el format esperat. Torna-ho a provar.",
    'Primero pega tu clave.': "Primer enganxa la teva clau.",
    '{0} modelos disponibles en tu clave; escribe o elige uno.': "{0} models disponibles amb la teva clau; escriu-ne o tria’n un.",
    'Pega tu clave de IA para continuar': "Enganxa la teva clau d’IA per continuar",
    'El PowerPoint no tiene diapositivas': "El PowerPoint no té diapositives",
    'Formato no admitido (usa Word, PDF, PowerPoint, texto, imágenes, audio o vídeo)': "Format no admès (fes servir Word, PDF, PowerPoint, text, imatges, àudio o vídeo)",
    '«{0}» pesa más de 600 MB: exporta solo el audio (MP3 o WAV) y súbelo en su lugar.': "«{0}» pesa més de 600 MB: exporta només l’àudio (MP3 o WAV) i puja’l en lloc seu.",
    'No se pudo leer el audio de «{0}». Prueba a exportarlo como MP3 o WAV.': "No s’ha pogut llegir l’àudio de «{0}». Prova d’exportar-lo com a MP3 o WAV.",
    'Para transcribir necesitas una clave de OpenAI o de Gemini (Claude no transcribe audio). Añádela en el botón «IA».': "Per transcriure necessites una clau d’OpenAI o de Gemini (Claude no transcriu àudio). Afegeix-la al botó «IA».",
    'actual': "actual",
    'no aparece en tu clave': "no apareix a la teva clau",
    'Otro modelo (escribirlo)…': "Un altre model (escriure’l)…",
    'Escribe el nombre exacto del modelo': "Escriu el nom exacte del model",
    'Cargando los modelos de tu clave…': "Carregant els models de la teva clau…",
    '{0} modelos disponibles en tu clave: elígelo en el desplegable.': "{0} models disponibles amb la teva clau: tria’l al desplegable.",
    'Tu clave no devolvió ningún modelo de texto. Escribe el nombre con «Otro modelo».': "La teva clau no ha retornat cap model de text. Escriu el nom amb «Un altre model»."
  },
  eu: {
    'Inicio': "Hasiera",
    'Ayuda': "Laguntza",
    'IA': "AA",
    'Pasos': "Urratsak",
    'Atrás': "Atzera",
    'Siguiente': "Hurrengoa",
    'Cerrar': "Itxi",
    'Cancelar': "Utzi",
    'Idioma': "Hizkuntza",
    'Volver al inicio': "Hasierara itzuli",
    'Inteligencia artificial': "Adimen artifiziala",
    'Proveedor': "Hornitzailea",
    'Tu clave de API': "Zure API gakoa",
    'Ver': "Ikusi",
    'Modelo': "Eredua",
    'Ver los modelos de mi clave': "Nire gakoaren ereduak ikusi",
    'f.ia.ayuda': "Gakoa nabigatzaile honetan bakarrik gordetzen da eta zure hornitzaileari bakarrik bidaltzen zaio. Pertsona bakoitzak berea erabiltzen du eta bere erabilera ordaintzen du. Aukeratu eredu merke bat: erabilera honek ez du ahaltsuena behar.",
    'Esto es lo que saldría hacia tu proveedor de IA': "Hau bidaliko litzateke zure AA hornitzailera",
    'f.envio.chk': "Lagina berrikusi dut eta baieztatzen dut nire ordenagailutik atera daitekeela.",
    'Muestra del envío:': "Bidalketaren lagina:",
    'Realizada entre': "Egileak",
    'Realizada por': "Egilea",
    'Cómo funciona': "Nola dabilen",
    'Dónde va cada cosa': "Non dagoen bakoitza",
    'Siempre en tu ordenador': "Beti zure ordenagailuan",
    'Sale hacia tu proveedor de IA': "Zure AA hornitzailera bidaltzen da",
    'No se pudo cargar la librería {0}. Puede que un bloqueador o la red de tu institución la impida; prueba otra red o desactiva el bloqueador en esta página.': "Ezin izan da {0} liburutegia kargatu. Agian blokeatzaile batek edo zure erakundearen sareak eragozten du; probatu beste sare bat edo desaktibatu blokeatzailea orri honetan.",
    'Sin conexión: hace falta internet para abrir este tipo de fichero la primera vez.': "Konexiorik gabe: internet behar da fitxategi mota hau lehen aldiz irekitzeko.",
    'No se pudo guardar en el navegador (¿demasiado material?)': "Ezin izan da nabigatzailean gorde (material gehiegi?)",
    'No se pudo guardar en el navegador': "Ezin izan da nabigatzailean gorde",
    '{0} no reconoce tu clave. Revísala en el botón «IA».': "{0}k ez du zure gakoa ezagutzen. Egiaztatu «AA» botoian.",
    'Tu clave no tiene acceso al modelo «{0}». Elige otro en el botón «IA».': "Zure gakoak ez du «{0}» eredurako sarbiderik. Aukeratu beste bat «AA» botoian.",
    'Tu cuenta de {0} no tiene saldo o ha alcanzado su límite.': "Zure {0} kontuak ez du saldorik edo mugara iritsi da.",
    'El modelo «{0}» no admite imágenes. Elige uno con visión.': "«{0}» ereduak ez du irudirik onartzen. Aukeratu ikusmena duen bat.",
    'No hay conexión con {0}.': "Ez dago konexiorik {0}-rekin.",
    '{0} no responde ahora mismo. Inténtalo de nuevo en un momento.': "{0}k ez du erantzuten oraintxe. Saiatu berriro geroxeago.",
    'Falta tu clave de IA. Pulsa el botón «IA», arriba.': "Zure AA gakoa falta da. Sakatu goiko «AA» botoia.",
    'OpenAI no responde ahora mismo.': "OpenAIk ez du erantzuten oraintxe.",
    'El proveedor ha bloqueado la respuesta ({0}).': "Hornitzaileak erantzuna blokeatu du ({0}).",
    'La IA no devolvió una respuesta con el formato esperado. Inténtalo de nuevo.': "AAk ez du espero zen formatuko erantzunik itzuli. Saiatu berriro.",
    'Primero pega tu clave.': "Lehenik itsatsi zure gakoa.",
    '{0} modelos disponibles en tu clave; escribe o elige uno.': "{0} eredu daude erabilgarri zure gakoarekin; idatzi edo aukeratu bat.",
    'Pega tu clave de IA para continuar': "Itsatsi zure AA gakoa jarraitzeko",
    'El PowerPoint no tiene diapositivas': "PowerPointak ez du diapositibarik",
    'Formato no admitido (usa Word, PDF, PowerPoint, texto, imágenes, audio o vídeo)': "Formatu onartezina (erabili Word, PDF, PowerPoint, testua, irudiak, audioa edo bideoa)",
    '«{0}» pesa más de 600 MB: exporta solo el audio (MP3 o WAV) y súbelo en su lugar.': "«{0}»k 600 MB baino gehiago ditu: esportatu audioa bakarrik (MP3 edo WAV) eta igo hori.",
    'No se pudo leer el audio de «{0}». Prueba a exportarlo como MP3 o WAV.': "Ezin izan da «{0}»ren audioa irakurri. Saiatu MP3 edo WAV gisa esportatzen.",
    'Para transcribir necesitas una clave de OpenAI o de Gemini (Claude no transcribe audio). Añádela en el botón «IA».': "Transkribatzeko OpenAI edo Gemini gako bat behar duzu (Claudek ez du audiorik transkribatzen). Gehitu «AA» botoian.",
    'actual': "oraingoa",
    'no aparece en tu clave': "ez dago zure gakoan",
    'Otro modelo (escribirlo)…': "Beste eredu bat (idatzi)…",
    'Escribe el nombre exacto del modelo': "Idatzi ereduaren izen zehatza",
    'Cargando los modelos de tu clave…': "Zure gakoaren ereduak kargatzen…",
    '{0} modelos disponibles en tu clave: elígelo en el desplegable.': "{0} eredu daude zure gakoarekin: aukeratu zabaltzen den zerrendan.",
    'Tu clave no devolvió ningún modelo de texto. Escribe el nombre con «Otro modelo».': "Zure gakoak ez du testu-eredurik itzuli. Idatzi izena «Beste eredu bat» aukerarekin."
  },
  gl: {
    'Inicio': "Inicio",
    'Ayuda': "Axuda",
    'IA': "IA",
    'Pasos': "Pasos",
    'Atrás': "Atrás",
    'Siguiente': "Seguinte",
    'Cerrar': "Pechar",
    'Cancelar': "Cancelar",
    'Idioma': "Idioma",
    'Volver al inicio': "Volver ao inicio",
    'Inteligencia artificial': "Intelixencia artificial",
    'Proveedor': "Provedor",
    'Tu clave de API': "A túa clave de API",
    'Ver': "Ver",
    'Modelo': "Modelo",
    'Ver los modelos de mi clave': "Ver os modelos da miña clave",
    'f.ia.ayuda': "A clave gárdase só neste navegador e envíase unicamente ao teu provedor. Cada persoa usa a súa e paga o seu uso. Escolle un modelo económico: este uso non precisa o máis potente.",
    'Esto es lo que saldría hacia tu proveedor de IA': "Isto é o que sairía cara ao teu provedor de IA",
    'f.envio.chk': "Revisei a mostra e confirmo que pode saír do meu ordenador.",
    'Muestra del envío:': "Mostra do envío:",
    'Realizada entre': "Realizada por",
    'Realizada por': "Realizada por",
    'Cómo funciona': "Como funciona",
    'Dónde va cada cosa': "Onde vai cada cousa",
    'Siempre en tu ordenador': "Sempre no teu ordenador",
    'Sale hacia tu proveedor de IA': "Sae cara ao teu provedor de IA",
    'No se pudo cargar la librería {0}. Puede que un bloqueador o la red de tu institución la impida; prueba otra red o desactiva el bloqueador en esta página.': "Non se puido cargar a biblioteca {0}. Quizais un bloqueador ou a rede da túa institución o impida; proba outra rede ou desactiva o bloqueador nesta páxina.",
    'Sin conexión: hace falta internet para abrir este tipo de fichero la primera vez.': "Sen conexión: cómpre internet para abrir este tipo de ficheiro a primeira vez.",
    'No se pudo guardar en el navegador (¿demasiado material?)': "Non se puido gardar no navegador (demasiado material?)",
    'No se pudo guardar en el navegador': "Non se puido gardar no navegador",
    '{0} no reconoce tu clave. Revísala en el botón «IA».': "{0} non recoñece a túa clave. Revísaa no botón «IA».",
    'Tu clave no tiene acceso al modelo «{0}». Elige otro en el botón «IA».': "A túa clave non ten acceso ao modelo «{0}». Escolle outro no botón «IA».",
    'Tu cuenta de {0} no tiene saldo o ha alcanzado su límite.': "A túa conta de {0} non ten saldo ou alcanzou o seu límite.",
    'El modelo «{0}» no admite imágenes. Elige uno con visión.': "O modelo «{0}» non admite imaxes. Escolle un con visión.",
    'No hay conexión con {0}.': "Non hai conexión con {0}.",
    '{0} no responde ahora mismo. Inténtalo de nuevo en un momento.': "{0} non responde agora mesmo. Ténteo de novo nun momento.",
    'Falta tu clave de IA. Pulsa el botón «IA», arriba.': "Falta a túa clave de IA. Preme o botón «IA», arriba.",
    'OpenAI no responde ahora mismo.': "OpenAI non responde agora mesmo.",
    'El proveedor ha bloqueado la respuesta ({0}).': "O provedor bloqueou a resposta ({0}).",
    'La IA no devolvió una respuesta con el formato esperado. Inténtalo de nuevo.': "A IA non devolveu unha resposta co formato esperado. Ténteo de novo.",
    'Primero pega tu clave.': "Primeiro pega a túa clave.",
    '{0} modelos disponibles en tu clave; escribe o elige uno.': "{0} modelos dispoñibles na túa clave; escribe ou escolle un.",
    'Pega tu clave de IA para continuar': "Pega a túa clave de IA para continuar",
    'El PowerPoint no tiene diapositivas': "O PowerPoint non ten diapositivas",
    'Formato no admitido (usa Word, PDF, PowerPoint, texto, imágenes, audio o vídeo)': "Formato non admitido (usa Word, PDF, PowerPoint, texto, imaxes, audio ou vídeo)",
    '«{0}» pesa más de 600 MB: exporta solo el audio (MP3 o WAV) y súbelo en su lugar.': "«{0}» pesa máis de 600 MB: exporta só o audio (MP3 ou WAV) e súbeo no seu lugar.",
    'No se pudo leer el audio de «{0}». Prueba a exportarlo como MP3 o WAV.': "Non se puido ler o audio de «{0}». Proba a exportalo como MP3 ou WAV.",
    'Para transcribir necesitas una clave de OpenAI o de Gemini (Claude no transcribe audio). Añádela en el botón «IA».': "Para transcribir precisas unha clave de OpenAI ou de Gemini (Claude non transcribe audio). Engádea no botón «IA».",
    'actual': "actual",
    'no aparece en tu clave': "non aparece na túa clave",
    'Otro modelo (escribirlo)…': "Outro modelo (escribilo)…",
    'Escribe el nombre exacto del modelo': "Escribe o nome exacto do modelo",
    'Cargando los modelos de tu clave…': "Cargando os modelos da túa clave…",
    '{0} modelos disponibles en tu clave: elígelo en el desplegable.': "{0} modelos dispoñibles na túa clave: escólleo no despregable.",
    'Tu clave no devolvió ningún modelo de texto. Escribe el nombre con «Otro modelo».': "A túa clave non devolveu ningún modelo de texto. Escribe o nome con «Outro modelo»."
  }
};

const _dict = l => ({...(I18N_BASE[l] || {}), ...((typeof I18N !== 'undefined' && I18N && I18N[l]) || {})});
const D = () => _D || (_D = _dict(LANG));
/* t(clave, ...args): traduce y rellena {0}, {1}…  Si falta la traducción devuelve el español (la clave o I18N.es[clave]): nunca texto vacío. */
function t(k, ...a) {
  let s = D()[k];
  if (s === undefined && typeof I18N !== 'undefined' && I18N && I18N.es) s = I18N.es[k];
  if (s === undefined) s = k;
  return a.length ? String(s).replace(/\{(\d+)\}/g, (m, i) => a[+i] ?? m) : String(s);
}
function applyI18n(root = document) {
  document.documentElement.lang = LANG;
  root.querySelectorAll('[data-i18n]').forEach(el => {
    if (el._es === undefined) el._es = el.innerHTML;                       // el español original, tal como está en el HTML
    const v = LANG === 'es' ? undefined : D()[el.dataset.i18n];
    el.innerHTML = v !== undefined ? v : el._es;
  });
  root.querySelectorAll('[data-i18n-attr]').forEach(el => {
    el._esA = el._esA || {};
    el.dataset.i18nAttr.split(';').forEach(par => {
      const [at, k] = par.split(':').map(x => x.trim()); if (!at || !k) return;
      if (!(at in el._esA)) el._esA[at] = el.getAttribute(at) ?? '';
      const v = LANG === 'es' ? undefined : D()[k]; el.setAttribute(at, v !== undefined ? v : el._esA[at]);
    });
  });
  if (applyI18n._tit === undefined) applyI18n._tit = document.title;
  const tit = LANG === 'es' ? undefined : D()['title']; document.title = tit !== undefined ? tit : applyI18n._tit;
}
function setLang(l) {
  if (!langsOn().includes(l)) l = langsOn()[0];
  LANG = l; _D = null; try { localStorage.setItem(APP + '_lang', l); } catch {}
  applyI18n(); const s = $('selLang'); if (s) s.value = l;
  window.dispatchEvent(new CustomEvent('langchange', {detail: l}));
}
/* llamada UNA vez desde iniciaUI(). Orden de preferencia: ?lang=xx en la URL (para compartir enlaces) → elección guardada → español. */
function initI18n() {
  let l = 'es'; try { l = localStorage.getItem(APP + '_lang') || 'es'; } catch {}
  const q = new URLSearchParams(location.search).get('lang'); if (q) l = q;
  LANG = langsOn().includes(l) ? l : 'es'; _D = null;
  const sel = $('selLang');
  if (sel) { sel.innerHTML = langsOn().map(x => `<option value="${x}">${LANGS[x]}</option>`).join(''); sel.value = LANG; sel.onchange = () => setLang(sel.value); }
  if (langsOn().length < 2 && $('langBox')) $('langBox').remove();
  applyI18n();
}
/* Para las pruebas: claves del HTML, pasos, botones y glosario que no tienen traducción en algún idioma activo ([] = completo). */
function i18nFaltan() {
  const keys = new Set(), lit = [];
  document.querySelectorAll('[data-i18n]').forEach(el => keys.add(el.dataset.i18n));
  document.querySelectorAll('[data-i18n-attr]').forEach(el => el.dataset.i18nAttr.split(';').forEach(p => { const k = (p.split(':')[1] || '').trim(); if (k) keys.add(k); }));
  if (typeof STEPS !== 'undefined') lit.push(...STEPS);
  if (typeof NAV !== 'undefined') NAV.forEach(n => lit.push(n[0], n[1]));
  if (typeof GLOS !== 'undefined') GLOS.forEach(g => lit.push(g[0], g[1]));
  if (typeof HUBS !== 'undefined') lit.push(...HUBS);
  const out = [];
  langsOn().filter(l => l !== 'es').forEach(l => { const d = _dict(l); [...keys, ...lit.filter(Boolean)].forEach(k => { if (d[k] === undefined) out.push(l + ': ' + String(k).slice(0, 60)); }); });
  return out;
}
