/* ── (opcional) audio y vídeo → texto. Se extrae el audio en el navegador y se transcribe con OpenAI o Gemini ──
   Claude no transcribe audio. Los vídeos se decodifican con el navegador: dependen de sus códecs (Chrome lee MP4/AAC;
   el Chromium de pruebas, no). Por encima de ~600 MB conviene pedir solo el audio. */
const wavDe = (f32, sr) => { const n = f32.length, b = new ArrayBuffer(44 + n * 2), v = new DataView(b), w = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); }; w(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); w(8, 'WAVEfmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, sr, true); v.setUint32(28, sr * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, n * 2, true); for (let i = 0; i < n; i++) { const s = Math.max(-1, Math.min(1, f32[i])); v.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7FFF, true); } return new Blob([b], {type: 'audio/wav'}); };
async function audioEnTrozos(file, seg) {
  if (file.size > 600 * 1048576) throw new Error(t('«{0}» pesa más de 600 MB: exporta solo el audio (MP3 o WAV) y súbelo en su lugar.', file.name));
  const ac = new (window.AudioContext || window.webkitAudioContext)(); let dec;
  try { dec = await ac.decodeAudioData(await file.arrayBuffer()); } catch { throw new Error(t('No se pudo leer el audio de «{0}». Prueba a exportarlo como MP3 o WAV.', file.name)); }
  const sr = 16000, off = new OfflineAudioContext(1, Math.max(1, Math.ceil(dec.duration * sr)), sr), src = off.createBufferSource(); src.buffer = dec; src.connect(off.destination); src.start();
  const d = (await off.startRendering()).getChannelData(0), per = seg * sr, out = [];
  for (let i = 0; i < d.length; i += per) out.push(wavDe(d.subarray(i, Math.min(d.length, i + per)), sr));
  ac.close(); return {trozos: out, dur: dec.duration};
}
const trProv = () => { const p = getProv(); if (p !== 'anthropic' && getKey(p)) return p; return getKey('openai') ? 'openai' : getKey('gemini') ? 'gemini' : null; };
const b64Blob = blob => new Promise(ok => { const r = new FileReader(); r.onload = () => ok(r.result); r.readAsDataURL(blob); });
async function transcribeTrozo(blob, pv, nombre, idioma) {
  const key = getKey(pv);
  if (pv === 'openai') {
    for (const modelo of [localStorage.getItem(APP + '_trmodel') || 'gpt-4o-mini-transcribe', 'whisper-1']) {
      const fd = new FormData(); fd.append('file', blob, nombre); fd.append('model', modelo); fd.append('response_format', 'json'); if (idioma) fd.append('language', idioma);
      const r = await conReintentos(() => fetch('https://api.openai.com/v1/audio/transcriptions', {method: 'POST', headers: {Authorization: 'Bearer ' + key}, body: fd}), pv);
      if (r.ok) return String((await r.json()).text || '').trim();
      const tx = await r.text(); if ((r.status === 404 || /model/i.test(tx)) && modelo !== 'whisper-1') continue; throw httpErr(r.status, tx, pv, modelo);
    }
  }
  const data = await b64Blob(blob), mod = getMod('gemini');
  const r = await conReintentos(() => fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(mod)}:generateContent`, {method: 'POST', headers: {'Content-Type': 'application/json', 'x-goog-api-key': key}, body: JSON.stringify({contents: [{role: 'user', parts: [{text: 'Transcribe literalmente este audio. Devuelve solo la transcripción, sin comentarios.'}, {inline_data: {mime_type: blob.type || 'audio/wav', data: data.split(',')[1]}}]}], generationConfig: {temperature: 0}})}), pv);
  const tx = await r.text(); if (!r.ok) throw httpErr(r.status, tx, pv, mod); return ((JSON.parse(tx).candidates?.[0]?.content?.parts || []).map(p => p.text || '').join('')).trim();
}
const EXT_DIRECTO = /\.(mp3|wav|m4a|ogg|oga|flac|webm|mp4|mpga|mpeg)$/i;
const duracionMedia = f => new Promise(ok => { const m = document.createElement('audio'), u = URL.createObjectURL(f); m.preload = 'metadata'; m.onloadedmetadata = () => { ok(isFinite(m.duration) ? m.duration : 0); URL.revokeObjectURL(u); }; m.onerror = () => { ok(0); URL.revokeObjectURL(u); }; m.src = u; });
/* transcribe(file, onProg(i,n), idioma='es') → {texto, dur} */
async function transcribe(file, onProg, idioma = 'es') {
  const pv = trProv(); if (!pv) throw new Error(t('Para transcribir necesitas una clave de OpenAI o de Gemini (Claude no transcribe audio). Añádela en el botón «IA».'));
  if (pv === 'openai' && file.size < 24 * 1048576 && /^audio\//.test(file.type || '') && EXT_DIRECTO.test(file.name)) { onProg?.(0, 1); const t = await transcribeTrozo(file, pv, file.name, idioma); onProg?.(1, 1); return {texto: t, dur: await duracionMedia(file)}; }
  const {trozos, dur} = await audioEnTrozos(file, pv === 'openai' ? 600 : 300), out = [];
  for (const [i, b] of trozos.entries()) { onProg?.(i, trozos.length); out.push(await transcribeTrozo(b, pv, `trozo${i + 1}.wav`, idioma)); }
  onProg?.(trozos.length, trozos.length); return {texto: out.join('\n\n'), dur};
}
