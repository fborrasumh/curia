/* ── proveedores de IA con la clave de cada persona: OpenAI, Google Gemini, Anthropic Claude ──────────────
   Mensajes: [{role:'system'|'user'|'assistant', content: string | [{t:'text',v}, {t:'img',mime,data:'data:...'}]}]
   Uso:   const texto = await llm(msgs, {max: 2800});      const obj = await llmJSON(msgs, {max: 3500});
   Las claves viven solo en localStorage de este navegador. La clave de OpenAI es compartida por todo el catálogo ('ia_openai_key'). */
const PROV = {
  openai: {n: 'OpenAI', m: 'gpt-6-luna', k: 'ia_openai_key'},
  gemini: {n: 'Google Gemini', m: 'gemini-2.5-flash', k: APP + '_key_gemini'},
  anthropic: {n: 'Anthropic Claude', m: 'claude-haiku-4-5-20251001', k: APP + '_key_anthropic'}
};
const getProv = () => PROV[localStorage.getItem(APP + '_prov')] ? localStorage.getItem(APP + '_prov') : 'openai';
const getKey = (p = getProv()) => localStorage.getItem(PROV[p].k) || '';
const getMod = (p = getProv()) => localStorage.getItem(APP + '_model_' + p) || PROV[p].m;
const parseJ = tx => { tx = String(tx || '').trim().replace(/^```(?:json)?|```$/g, '').trim(); try { return JSON.parse(tx); } catch { const m = tx.match(/\{[\s\S]*\}/); if (m) try { return JSON.parse(m[0]); } catch {} } return null; };
const partes = c => typeof c === 'string' ? [{t: 'text', v: c}] : c;
function agrupa(msgs, rolA) { const o = []; for (const m of msgs.filter(m => m.role !== 'system')) { const r = m.role === 'assistant' ? rolA : 'user'; if (o.length && o.at(-1).role === r) o.at(-1).parts.push({t: 'text', v: '\n\n'}, ...partes(m.content)); else o.push({role: r, parts: [...partes(m.content)]}); } if (o.length && o[0].role !== 'user') o.unshift({role: 'user', parts: [{t: 'text', v: '.'}]}); return o; }
const sysDe = msgs => msgs.filter(m => m.role === 'system').map(m => typeof m.content === 'string' ? m.content : m.content.map(p => p.v || '').join('')).join('\n\n');
function httpErr(st, tx, pv, mod) {
  if (st === 401 || st === 403 || (pv === 'gemini' && st === 400 && /API key|API_KEY/i.test(tx))) return new Error(t('{0} no reconoce tu clave. Revísala en el botón «IA».', PROV[pv].n));
  if (st === 404 || /model_not_found|not found|does not exist/i.test(tx)) return new Error(t('Tu clave no tiene acceso al modelo «{0}». Elige otro en el botón «IA».', mod));
  if (st === 429 && /quota|billing|credit|RESOURCE_EXHAUSTED/i.test(tx)) return new Error(t('Tu cuenta de {0} no tiene saldo o ha alcanzado su límite.', PROV[pv].n));
  if (st === 400 && /image|vision|multimodal|modalit/i.test(tx)) return new Error(t('El modelo «{0}» no admite imágenes. Elige uno con visión.', mod));
  return new Error(`${PROV[pv].n} ${st}: ${String(tx).slice(0, 180)}`);
}
async function conReintentos(fn, pv) {
  for (let k = 0; k < 5; k++) {
    let r; try { r = await fn(); } catch { if (k >= 2) throw new Error(t('No hay conexión con {0}.', PROV[pv].n)); await sleep(1500); continue; }
    if (r.ok) return r;
    if (r.status === 429 || r.status >= 500) { const tx = await r.clone().text(); if (r.status === 429 && /quota|billing|credit/i.test(tx)) return r; await sleep(2 ** (k + 1) * 1000); continue; }
    return r;
  }
  throw new Error(t('{0} no responde ahora mismo. Inténtalo de nuevo en un momento.', PROV[pv].n));
}
async function llm(msgs, {json = false, max = 2800} = {}) {
  const pv = getProv(), key = getKey(pv), mod = getMod(pv);
  if (!key) throw new Error(t('Falta tu clave de IA. Pulsa el botón «IA», arriba.'));
  if (pv === 'openai') {
    /* los modelos nuevos rechazan max_tokens/temperature: se prueban variantes según el error */
    const razona = /^(gpt-[56]|o\d)/.test(mod), o = {json, reasoning: razona, comp: razona, temp: !razona};
    const mm = msgs.map(m => ({role: m.role, content: typeof m.content === 'string' ? m.content : m.content.map(p => p.t === 'text' ? {type: 'text', text: p.v} : {type: 'image_url', image_url: {url: p.data}})}));
    for (let k = 0; k < 6; k++) {
      const body = {model: mod, messages: mm};
      if (o.json) body.response_format = {type: 'json_object'};
      if (o.comp) body.max_completion_tokens = max * (o.reasoning ? 2 : 1); else body.max_tokens = max;
      if (o.reasoning) body.reasoning_effort = 'low';
      if (o.temp) body.temperature = 0.4;
      const r = await conReintentos(() => fetch('https://api.openai.com/v1/chat/completions', {method: 'POST', headers: {'Content-Type': 'application/json', Authorization: 'Bearer ' + key}, body: JSON.stringify(body)}), pv);
      if (r.ok) return (await r.json()).choices?.[0]?.message?.content || '';
      const tx = await r.text();
      if (r.status === 400) {
        if (/reasoning_effort/i.test(tx) && o.reasoning) { o.reasoning = false; continue; }
        if (/max_completion_tokens/i.test(tx) && o.comp) { o.comp = false; continue; }
        if (/max_tokens/i.test(tx) && !o.comp) { o.comp = true; continue; }
        if (/temperature/i.test(tx) && o.temp) { o.temp = false; continue; }
        if (/response_format|json/i.test(tx) && o.json) { o.json = false; const u = mm.at(-1); if (typeof u.content === 'string') u.content += '\nResponde SOLO con JSON válido.'; else u.content.push({type: 'text', text: 'Responde SOLO con JSON válido.'}); continue; }
      }
      throw httpErr(r.status, tx, pv, mod);
    }
    throw new Error(t('OpenAI no responde ahora mismo.'));
  }
  if (pv === 'gemini') {
    const sys = sysDe(msgs), cont = agrupa(msgs, 'model').map(m => ({role: m.role, parts: m.parts.map(p => p.t === 'text' ? {text: p.v} : {inline_data: {mime_type: p.mime, data: p.data.split(',')[1]}})}));
    const body = {contents: cont, generationConfig: {maxOutputTokens: max, temperature: 0.4}};
    if (sys) body.systemInstruction = {parts: [{text: sys}]};
    if (json) body.generationConfig.responseMimeType = 'application/json';
    const r = await conReintentos(() => fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(mod)}:generateContent`, {method: 'POST', headers: {'Content-Type': 'application/json', 'x-goog-api-key': key}, body: JSON.stringify(body)}), pv);
    const tx = await r.text(); if (!r.ok) throw httpErr(r.status, tx, pv, mod);
    const j = JSON.parse(tx), txt = (j.candidates?.[0]?.content?.parts || []).map(p => p.text || '').join('');
    if (!txt && j.promptFeedback?.blockReason) throw new Error(t('El proveedor ha bloqueado la respuesta ({0}).', j.promptFeedback.blockReason));
    return txt;
  }
  const sys = sysDe(msgs), mm = agrupa(msgs, 'assistant').map(m => ({role: m.role, content: m.parts.map(p => p.t === 'text' ? {type: 'text', text: p.v} : {type: 'image', source: {type: 'base64', media_type: p.mime, data: p.data.split(',')[1]}})}));
  if (json) mm.at(-1).content.push({type: 'text', text: '\n\nResponde SOLO con un objeto JSON válido, sin texto alrededor.'});
  const r = await conReintentos(() => fetch('https://api.anthropic.com/v1/messages', {method: 'POST', headers: {'Content-Type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true'}, body: JSON.stringify({model: mod, max_tokens: max, system: sys, messages: mm})}), pv);
  const tx = await r.text(); if (!r.ok) throw httpErr(r.status, tx, pv, mod);
  return (JSON.parse(tx).content || []).filter(b => b.type === 'text').map(b => b.text).join('');
}
async function llmJSON(msgs, o = {}) { for (let k = 0; k < 2; k++) { const j = parseJ(await llm(msgs, {...o, json: true})); if (j && typeof j === 'object') return j; } throw new Error(t('La IA no devolvió una respuesta con el formato esperado. Inténtalo de nuevo.')); }
async function listaModelos(pv = getProv()) {
  const key = getKey(pv); if (!key) throw new Error(t('Primero pega tu clave.')); let r;
  try {
    if (pv === 'openai') r = await fetch('https://api.openai.com/v1/models', {headers: {Authorization: 'Bearer ' + key}});
    else if (pv === 'gemini') r = await fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=100', {headers: {'x-goog-api-key': key}});
    else r = await fetch('https://api.anthropic.com/v1/models?limit=100', {headers: {'x-api-key': key, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true'}});
  } catch { throw new Error(t('No hay conexión con {0}.', PROV[pv].n)); }
  const tx = await r.text(); if (!r.ok) throw httpErr(r.status, tx, pv, ''); const j = JSON.parse(tx);
  if (pv === 'openai') return (j.data || []).map(m => m.id).filter(id => /^(gpt-|o\d|chatgpt-)/.test(id) && !/(audio|realtime|transcribe|tts|image|embedding|moderation|search|instruct|whisper|dall|davinci|babbage|codex|computer-use)/i.test(id)).sort();
  if (pv === 'gemini') return (j.models || []).filter(m => (m.supportedGenerationMethods || []).includes('generateContent')).map(m => m.name.replace(/^models\//, '')).sort();
  return (j.data || []).map(m => m.id).sort();
}
