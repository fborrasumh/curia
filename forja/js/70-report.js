/* ── salidas: Word, ZIP y CSV SIN LIBRERÍAS EXTERNAS ─────────────────────────────────────────────────────────
   Antes se cargaban docx y JSZip desde cdnjs al pulsar «Descargar»: si la URL de cdnjs cambiaba, si había un
   bloqueador, un proxy de la universidad o no había red, salía «No se pudo cargar una librería: ¿hay conexión?».
   Ahora el .docx y el .zip se escriben aquí mismo (Office Open XML + ZIP), funcionan sin conexión, con file:// y
   con cualquier CSP. No toques esto para volver a usar window.docx: si una app necesita algo que wordDeMarkdown
   no hace, amplía este escritor (párrafos, tablas, estilos), no añadas una dependencia de red. */

/* ZIP: crc32 + cabeceras locales y directorio central. Comprime con deflate-raw si el navegador lo permite
   (CompressionStream); si no, guarda sin comprimir (método 0), que Word y cualquier descompresor leen igual. */
const _CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = b => { let c = 0xFFFFFFFF; for (let i = 0; i < b.length; i++) c = _CRC[(c ^ b[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
async function _bytes(c) {
  if (c instanceof Uint8Array) return c;
  if (c instanceof ArrayBuffer) return new Uint8Array(c);
  if (ArrayBuffer.isView(c)) return new Uint8Array(c.buffer, c.byteOffset, c.byteLength);
  if (c instanceof Blob) return new Uint8Array(await c.arrayBuffer());
  return new TextEncoder().encode(String(c ?? ''));
}
async function _deflate(b) {
  if (typeof CompressionStream !== 'function' || b.length < 200) return null;
  try { return new Uint8Array(await new Response(new Blob([b]).stream().pipeThrough(new CompressionStream('deflate-raw'))).arrayBuffer()); } catch { return null; }
}
async function zipBytes(ficheros, {comprimir = true} = {}) {
  const d = new Date(), tm = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1), dt = ((Math.max(d.getFullYear(), 1980) - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
  const loc = [], cen = []; let off = 0;
  for (const [nombre, cont] of Object.entries(ficheros)) {
    const nm = new TextEncoder().encode(nombre), raw = await _bytes(cont), crc = crc32(raw);
    const def = comprimir ? await _deflate(raw) : null, usa = def && def.length < raw.length, dat = usa ? def : raw, met = usa ? 8 : 0;
    const h = new DataView(new ArrayBuffer(30));
    h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint16(8, met, true); h.setUint16(10, tm, true); h.setUint16(12, dt, true);
    h.setUint32(14, crc, true); h.setUint32(18, dat.length, true); h.setUint32(22, raw.length, true); h.setUint16(26, nm.length, true); h.setUint16(28, 0, true);
    const c = new DataView(new ArrayBuffer(46));
    c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true); c.setUint16(10, met, true); c.setUint16(12, tm, true); c.setUint16(14, dt, true);
    c.setUint32(16, crc, true); c.setUint32(20, dat.length, true); c.setUint32(24, raw.length, true); c.setUint16(28, nm.length, true); c.setUint32(42, off, true);
    loc.push(new Uint8Array(h.buffer), nm, dat); cen.push(new Uint8Array(c.buffer), nm);
    off += 30 + nm.length + dat.length;
  }
  const tamCen = cen.reduce((s, x) => s + x.length, 0), n = Object.keys(ficheros).length, e = new DataView(new ArrayBuffer(22));
  e.setUint32(0, 0x06054b50, true); e.setUint16(8, n, true); e.setUint16(10, n, true); e.setUint32(12, tamCen, true); e.setUint32(16, off, true);
  return new Blob([...loc, ...cen, new Uint8Array(e.buffer)]);
}
/* zipDe({'nombre.ext': Blob|string|Uint8Array|ArrayBuffer, …}) → Blob .zip  (misma firma que la versión con JSZip) */
async function zipDe(ficheros) { const b = await zipBytes(ficheros); return new Blob([b], {type: 'application/zip'}); }

/* Word (.docx) escrito a mano: Office Open XML mínimo, válido para Word, LibreOffice, Pages y Google Docs. */
const _x = s => String(s ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g, '').replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));
/* un «run» de texto: {text, b, i, col, s (medios puntos; null = el del estilo), font (null = el del estilo)} */
function wRun({text = '', b, i, col, s = 22, font = 'Arial'} = {}) {
  const pr = `<w:rPr>${font ? `<w:rFonts w:ascii="${font}" w:hAnsi="${font}" w:cs="${font}"/>` : ''}${b ? '<w:b/>' : ''}${i ? '<w:i/>' : ''}${col ? `<w:color w:val="${col}"/>` : ''}${s ? `<w:sz w:val="${s}"/><w:szCs w:val="${s}"/>` : ''}</w:rPr>`;   // s/font = null → los del estilo
  return String(text).split('\n').map((l, k) => (k ? '<w:br/>' : '') + `<w:t xml:space="preserve">${_x(l)}</w:t>`).map(t => `<w:r>${pr}${t}</w:r>`).join('');
}
/* **negrita**, *cursiva* y `código` en línea → runs */
function wInline(tx, base = {}) {   // base.b pone todo en negrita (cabeceras de tabla)
  return String(tx).split(/(\*\*[^*]+\*\*|\*[^*\s][^*]*\*|`[^`]+`)/).filter(Boolean).map(p =>
    p.startsWith('**') ? wRun({...base, text: p.slice(2, -2), b: true}) :
    p.startsWith('`') ? wRun({...base, text: p.slice(1, -1), font: 'Consolas'}) :
    /^\*[^*\s]/.test(p) && p.endsWith('*') && p.length > 2 ? wRun({...base, text: p.slice(1, -1), i: true}) :
    wRun({...base, text: p})).join('');
}
/* un párrafo: o = {h (1-3 → Título 1-3), c (centrado), after (twips), ind (sangría, twips), plain, s, b, i, col} */
function wPara(tx, o = {}) {
  const ppr = (o.h ? `<w:pStyle w:val="Heading${o.h}"/>` : '') + `<w:spacing w:after="${o.after ?? 110}"/>` + (o.ind ? `<w:ind w:left="${o.ind}" w:hanging="${o.hang ?? 0}"/>` : '') + (o.c ? '<w:jc w:val="center"/>' : '');
  const s = o.h ? null : o.s;   // los títulos toman tamaño y color de su estilo (Heading1-3)
  const runs = o.plain ? wRun({text: tx, s, b: o.b, i: o.i, col: o.col}) : wInline(tx, {s, i: o.i, col: o.col});
  return `<w:p><w:pPr>${ppr}</w:pPr>${runs}</w:p>`;
}
/* tabla a partir de filas de celdas (la primera, cabecera en negrita) */
function wTabla(filas) {
  const nc = Math.max(...filas.map(f => f.length)), w = Math.floor(9000 / nc), bd = '<w:top w:val="single" w:sz="4" w:color="BFC9D4"/><w:left w:val="single" w:sz="4" w:color="BFC9D4"/><w:bottom w:val="single" w:sz="4" w:color="BFC9D4"/><w:right w:val="single" w:sz="4" w:color="BFC9D4"/><w:insideH w:val="single" w:sz="4" w:color="BFC9D4"/><w:insideV w:val="single" w:sz="4" w:color="BFC9D4"/>';
  const fila = (f, cab) => '<w:tr>' + Array.from({length: nc}, (_, j) => `<w:tc><w:tcPr><w:tcW w:w="${w}" w:type="dxa"/>${cab ? '<w:shd w:val="clear" w:color="auto" w:fill="EEF2F6"/>' : ''}</w:tcPr><w:p><w:pPr><w:spacing w:after="40"/></w:pPr>${wInline(f[j] ?? '', {s: 20, b: cab})}</w:p></w:tc>`).join('') + '</w:tr>';
  return `<w:tbl><w:tblPr><w:tblW w:w="${w * nc}" w:type="dxa"/><w:tblBorders>${bd}</w:tblBorders><w:tblCellMar><w:left w:w="80" w:type="dxa"/><w:right w:w="80" w:type="dxa"/></w:tblCellMar></w:tblPr><w:tblGrid>${'<w:gridCol w:w="' + w + '"/>'.repeat(nc)}</w:tblGrid>${filas.map((f, k) => fila(f, k === 0)).join('')}</w:tbl><w:p><w:pPr><w:spacing w:after="60"/></w:pPr></w:p>`;
}
/* wordDeXml(cuerpoXml, {creador, titulo}) → Blob .docx   (para apps que montan su propio cuerpo con wPara/wTabla) */
async function wordDeXml(cuerpo, {creador = '', titulo = ''} = {}) {
  const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';
  const hs = [[1, 32, '0F2237'], [2, 26, '0F2237'], [3, 23, '33475B']].map(([n, s, col]) => `<w:style w:type="paragraph" w:styleId="Heading${n}"><w:name w:val="heading ${n}"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:uiPriority w:val="9"/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:before="${n === 1 ? 280 : 200}" w:after="100"/><w:outlineLvl w:val="${n - 1}"/></w:pPr><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:b/><w:color w:val="${col}"/><w:sz w:val="${s}"/><w:szCs w:val="${s}"/></w:rPr></w:style>`).join('');
  const lang = typeof LANG === 'string' ? ({es: 'es-ES', ca: 'ca-ES', eu: 'eu-ES', gl: 'gl-ES', en: 'en-GB', pt: 'pt-PT'}[LANG] || 'es-ES') : 'es-ES';
  const ahora = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
  return new Blob([await zipBytes({
    '[Content_Types].xml': '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>',
    '_rels/.rels': '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>',
    'docProps/core.xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${_x(titulo)}</dc:title><dc:creator>${_x(creador)}</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">${ahora}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${ahora}</dcterms:modified></cp:coreProperties>`,
    'word/_rels/document.xml.rels': '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>',
    'word/styles.xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles ${W}><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial" w:eastAsia="Arial"/><w:sz w:val="22"/><w:szCs w:val="22"/><w:lang w:val="${lang}"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="110" w:line="276" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>${hs}</w:styles>`,
    'word/document.xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document ${W}><w:body>${cuerpo}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1418" w:right="1418" w:bottom="1418" w:left="1418" w:header="709" w:footer="709" w:gutter="0"/></w:sectPr></w:body></w:document>`
  })], {type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'});
}
/* wordDeMarkdown(md, {titulo, subtitulo, pie, kicker}) → Blob .docx
   Convierte #/##/### encabezados, listas, tablas Markdown (| a | b |), **negritas**, *cursivas* y `código`. */
async function wordDeMarkdown(md, {titulo = '', subtitulo = '', pie = '', kicker = ''} = {}) {
  const k = [];
  if (kicker) k.push(wPara(String(kicker).toUpperCase(), {c: true, b: true, col: 'E4572E', s: 20, plain: true}));
  if (titulo) k.push(wPara(titulo, {c: true, b: true, s: 32, plain: true}));
  if (subtitulo) k.push(wPara(subtitulo, {c: true, col: '5D7691', s: 20, after: 260, plain: true}));
  const lineas = String(md ?? '').replace(/\r\n?/g, '\n').split('\n'); let tabla = [];
  const cierraTabla = () => { if (tabla.length) { k.push(wTabla(tabla)); tabla = []; } };
  for (const l of lineas) {
    const t = l.trimEnd(); let m;
    if (/^\s*\|.*\|\s*$/.test(t)) { if (!/^\s*\|[\s:|-]+\|\s*$/.test(t)) tabla.push(t.trim().slice(1, -1).split('|').map(c => c.trim())); continue; }
    cierraTabla(); if (!t.trim() || /^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(t)) continue;
    if (m = t.match(/^(#{1,6})\s+(.*)/)) k.push(wPara(m[2], {h: Math.min(m[1].length, 3)}));
    else if (m = t.match(/^(\s*)[-*•]\s+(.*)/)) k.push(wPara('•\t' + m[2], {ind: 360 + Math.min(m[1].length, 8) * 90, hang: 240, after: 60}));
    else if (m = t.match(/^(\s*)(\d+[.)])\s+(.*)/)) k.push(wPara(m[2] + '\t' + m[3], {ind: 400 + Math.min(m[1].length, 8) * 90, hang: 320, after: 60}));
    else if (m = t.match(/^>\s?(.*)/)) k.push(wPara(m[1], {ind: 360, i: true, col: '5D7691'}));
    else k.push(wPara(t));
  }
  cierraTabla();
  if (pie) k.push(wPara(pie, {i: true, s: 16, col: '8899AA', plain: true}));
  const app = typeof APP_NAME === 'string' ? APP_NAME : (typeof APP === 'string' ? APP : '');
  return wordDeXml(k.join(''), {creador: app, titulo: titulo || app});
}
/* csv con BOM, separador «;» (Excel en español) y comillas escapadas */
const csvq = v => { const s = String(v ?? ''); return /[";\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
const csvDe = (cab, filas) => '\ufeff' + [cab, ...filas].map(f => f.map(csvq).join(';')).join('\r\n');
