/* ── persistencia local (IndexedDB). La app define:  let S = {...};  y opcionalmente  const KEYP = () => 'main';  ── */
const dbP = new Promise((ok, ko) => { const r = indexedDB.open(APP, 1); r.onupgradeneeded = () => r.result.createObjectStore('kv'); r.onsuccess = () => ok(r.result); r.onerror = () => ko(r.error); });
const kv = async (mode, fn) => { const d = await dbP; return new Promise((ok, ko) => { const tx = d.transaction('kv', mode), q = fn(tx.objectStore('kv')); tx.oncomplete = () => ok(q && q.result); tx.onerror = () => ko(tx.error); }); };
const _key = () => (typeof KEYP === 'function' ? KEYP() : 'main');
let _g;
function guarda() { clearTimeout(_g); _g = setTimeout(() => kv('readwrite', s => s.put(S, _key())).catch(() => toast(t('No se pudo guardar en el navegador (¿demasiado material?)'))), 500); }
/* guardado inmediato: úsalo justo después de pagar una llamada a la IA, para no perder el resultado si se cierra la pestaña */
const guardaYa = () => { clearTimeout(_g); return kv('readwrite', s => s.put(S, _key())).catch(() => toast(t('No se pudo guardar en el navegador'))); };
window.addEventListener('pagehide', () => { clearTimeout(_g); try { kv('readwrite', s => s.put(S, _key())); } catch {} });
async function cargaEstado(key = _key()) { try { const p = await kv('readonly', s => s.get(key)); return p || null; } catch { return null; } }
