/* ── lectura de ficheros del usuario, todo en el navegador ───────────────────────────────────────────────
   extrae(file) → {tipo:'texto'|'img'|'av', nombre, texto, imgs:[{nombre,data}], incr, aviso?, file?}
   Admite TXT/MD/CSV/SRT, DOCX (texto + imágenes incrustadas), PPTX (texto + notas del ponente + imágenes),
   PDF (texto; si no tiene texto, las primeras páginas como imágenes) e imágenes. Audio/vídeo se devuelven con tipo 'av'
   para transcribirlos aparte (ver 50-transcribe.js). */
const xmlDec = s => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
const pptxPars = xml => xml.split('</a:p>').map(p => [...p.matchAll(/<a:t[^>]*>([^<]*)<\/a:t>/g)].map(m => xmlDec(m[1])).join('')).map(s => s.trim()).filter(Boolean);
const MAXIMG = 8;
const MIMEIMG = {png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp'};
function reduceImg(src, max = 1280) { return new Promise((ok, ko) => { const im = new Image(); im.onload = () => { const k = Math.min(1, max / Math.max(im.width, im.height)), c = document.createElement('canvas'); c.width = Math.max(1, Math.round(im.width * k)); c.height = Math.max(1, Math.round(im.height * k)); const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(im, 0, 0, c.width, c.height); ok(c.toDataURL('image/jpeg', .82)); }; im.onerror = () => ko(new Error('No se pudo leer una imagen')); im.src = src; }); }
const dataUrl = blob => new Promise(ok => { const r = new FileReader(); r.onload = () => ok(r.result); r.readAsDataURL(blob); });
async function extrae(file) {
  const ext = file.name.split('.').pop().toLowerCase(), n = file.name;
  if (['txt', 'md', 'markdown', 'csv', 'srt', 'vtt'].includes(ext)) return {tipo: 'texto', nombre: n, texto: await file.text(), imgs: [], incr: 0};
  if (MIMEIMG[ext] || /^image\//.test(file.type)) return {tipo: 'img', nombre: n, texto: '', imgs: [{nombre: n, data: await reduceImg(await dataUrl(file))}], incr: 0};
  if (/^(audio|video)\//.test(file.type) || /\.(mp3|wav|m4a|ogg|oga|flac|mp4|mov|webm|mkv|aac|mpga)$/i.test(n)) return {tipo: 'av', nombre: n, texto: '', imgs: [], incr: 0, file};
  if (ext === 'docx') {
    await cargaLib([LIB.mammoth]); const ab = await file.arrayBuffer(), imgs = []; let incr = 0;
    await mammoth.convertToHtml({arrayBuffer: ab}, {convertImage: mammoth.images.imgElement(async im => { incr++; if (imgs.length < MAXIMG) { try { imgs.push({nombre: `${n} · imagen ${incr}`, data: await reduceImg(`data:${im.contentType};base64,${await im.read('base64')}`)}); } catch {} } return {src: ''}; })});
    return {tipo: 'texto', nombre: n, texto: (await mammoth.extractRawText({arrayBuffer: ab})).value, imgs, incr};
  }
  if (ext === 'pptx') {
    await cargaLib([LIB.jszip]); const z = await JSZip.loadAsync(await file.arrayBuffer()), num = f => +f.match(/(\d+)\.xml$/)[1];
    const sl = Object.keys(z.files).filter(f => /^ppt\/slides\/slide\d+\.xml$/.test(f)).sort((a, b) => num(a) - num(b)); if (!sl.length) throw new Error(t('El PowerPoint no tiene diapositivas'));
    const out = [];
    for (const f of sl) {
      const txt = pptxPars(await z.file(f).async('string')); let notas = [];
      const rel = z.file(f.replace('slides/', 'slides/_rels/') + '.rels');
      if (rel) { const m = (await rel.async('string')).match(/Target="\.\.\/notesSlides\/(notesSlide\d+\.xml)"/); if (m && z.file('ppt/notesSlides/' + m[1])) notas = pptxPars(await z.file('ppt/notesSlides/' + m[1]).async('string')).filter(x => !/^\d+$/.test(x)); }
      out.push(`## Diapositiva ${num(f)}\n${txt.join('\n')}${notas.length ? '\n[Notas del ponente] ' + notas.join(' ') : ''}`);
    }
    const med = Object.keys(z.files).filter(f => /^ppt\/media\/.+\.(png|jpe?g|gif|webp)$/i.test(f)), imgs = [];
    for (const f of med.slice(0, MAXIMG)) { try { const b = await z.file(f).async('blob'); imgs.push({nombre: `${n} · ${f.split('/').pop()}`, data: await reduceImg(await dataUrl(new Blob([b], {type: MIMEIMG[f.split('.').pop().toLowerCase()] || 'image/png'})))}); } catch {} }
    return {tipo: 'texto', nombre: n, texto: out.join('\n\n'), imgs, incr: med.length};
  }
  if (ext === 'pdf') {
    await cargaLib([LIB.pdf]); pdfjsLib.GlobalWorkerOptions.workerSrc = _libCargadas[LIB.pdf] && _libCargadas[LIB.pdf] !== LIB.pdf ? LIB_ESPEJO[LIB.pdfw] : LIB.pdfw;   // el worker, del mismo CDN que pdf.js
    const doc = await pdfjsLib.getDocument({data: new Uint8Array(await file.arrayBuffer())}).promise, pags = [];
    for (let i = 1; i <= doc.numPages; i++) { const c = await (await doc.getPage(i)).getTextContent(); let t = ''; c.items.forEach(it => { t += it.str + (it.hasEOL ? '\n' : ' '); }); pags.push(t.replace(/[ \t]+\n/g, '\n').trim()); }
    const t = pags.join('\n\n');
    if (t.replace(/\s/g, '').length < 80) { const imgs = []; for (let i = 1; i <= Math.min(doc.numPages, 6); i++) { const pg = await doc.getPage(i), vp = pg.getViewport({scale: 1.4}), c = document.createElement('canvas'); c.width = vp.width; c.height = vp.height; await pg.render({canvasContext: c.getContext('2d'), viewport: vp}).promise; imgs.push({nombre: `${n} · página ${i}`, data: await reduceImg(c.toDataURL('image/jpeg', .85))}); } return {tipo: 'texto', nombre: n, texto: '', imgs, incr: 0, aviso: 'PDF sin texto: se envían las primeras páginas como imágenes.'}; }
    return {tipo: 'texto', nombre: n, texto: t, imgs: [], incr: 0, aviso: 'En los PDF no se detectan las imágenes incrustadas.'};
  }
  throw new Error(t('Formato no admitido (usa Word, PDF, PowerPoint, texto, imágenes, audio o vídeo)'));
}
