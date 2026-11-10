"""Prueba de humo del esqueleto Forja. Cópiala, amplíala con las funciones reales de tu app y ejecútala:
       python3 tests/smoke_test.py
   Comprueba lo mínimo exigible a cualquier app: CSP, ejemplo sin clave, flujo con IA simulada, verificación de citas,
   exportaciones, persistencia, IDIOMAS (es/en/pt), ausencia de errores de página y de desborde en móvil."""
import asyncio, sys, pathlib, re
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from forja_test import Harness
ROOT = pathlib.Path(__file__).resolve().parent.parent

async def reply(prov, system, user, info):
    # Responde como lo haría la IA, incluyendo UNA cita inventada para comprobar que el código la detecta.
    cita = 'After the load, performance drops temporarily' if 'English' in user else 'el rendimiento baja de forma temporal'
    return ('j', {'resumen': 'Resumen de prueba.', 'puntos': [
        {'texto': 'Punto verificable', 'cita': cita},
        {'texto': 'Punto con cita inventada', 'cita': 'esta frase no existe en el texto del usuario para nada de nada'}]})

async def main():
    ok = True
    def check(nombre, cond, extra=''):
        nonlocal ok; ok &= bool(cond); print(('✓' if cond else '✕'), nombre, extra)
    async with Harness(ROOT/'index.html', reply) as h:
        p = h.page
        check('CSP bloquea otros orígenes', await h.csp_bloquea())
        # ── desplegable de modelos de la clave, en los tres proveedores ──
        for prov, esperado in (('openai', 'gpt-5-mini'), ('gemini', 'gemini-2.5-pro'), ('anthropic', 'claude-sonnet-4-5')):
            ops = await h.modelos(prov)
            check(f'el desplegable carga los modelos de la clave ({prov})', esperado in ops and '__otro' in ops and 'whisper-1' not in ops, str(ops))
        await p.select_option('#selModelo', 'claude-sonnet-4-5'); check('elegir un modelo lo guarda', await p.evaluate('getMod()') == 'claude-sonnet-4-5')
        await p.select_option('#selModelo', '__otro'); check('«Otro modelo» abre el campo libre', await p.is_visible('#modelo'))
        await p.fill('#modelo', 'claude-opus-x'); check('el modelo escrito a mano se guarda', await p.evaluate('getMod()') == 'claude-opus-x')
        await p.keyboard.press('Escape'); await p.evaluate("localStorage.setItem(APP+'_prov','openai'); localStorage.removeItem(APP+'_model_anthropic')")
        # ── idiomas ──
        check('idioma por defecto: español', await p.evaluate("LANG") == 'es' and await p.evaluate("document.documentElement.lang") == 'es')
        check('selector con es, en y pt', await p.evaluate("[...document.querySelectorAll('#selLang option')].map(o=>o.value).join()") == 'es,en,pt')
        check('no faltan traducciones (HTML, pasos, botones, glosario)', await h.faltan_traducciones() == [], str(await h.faltan_traducciones()))
        es_btn = await p.inner_text('#btnStart')
        await h.idioma('en'); check('en inglés: la portada y la barra cambian', await p.inner_text('#btnStart') != es_btn and (await p.inner_text('#btnHelp')).strip().lower() == 'help' and await p.evaluate("document.documentElement.lang") == 'en')
        await h.idioma('pt'); check('en portugués: la portada y la barra cambian', (await p.inner_text('#btnHelp')).strip().lower() == 'ajuda' and await p.evaluate("document.title.length") > 5)
        await h.idioma('es'); check('al volver al español se restaura el texto original', await p.inner_text('#btnStart') == es_btn)
        await h.idioma('en'); await p.reload(); await p.wait_for_timeout(600)
        check('el idioma elegido persiste al recargar', await p.evaluate("LANG") == 'en' and await p.input_value('#selLang') == 'en')
        await h.idioma('es')
        # ── ejemplo sin clave, en cada idioma ──
        for l, palabra in (('es', 'supercompensación'), ('en', 'Supercompensation'), ('pt', 'supercompensação')):
            await h.idioma(l); await p.click('#btnEjemplo'); await p.wait_for_timeout(400)
            check(f'ejemplo sin clave en {l}: texto en ese idioma y todas las citas verificadas', palabra.lower() in (await p.evaluate("S.texto")).lower() and await p.evaluate("S.res.puntos.every(x=>x.ok)") and await p.locator('#resultado li').count() >= 3)
            await p.evaluate("go(0)")
        await h.idioma('pt'); await p.click('#btnEjemplo'); await p.wait_for_timeout(300)
        await h.idioma('en'); await p.wait_for_timeout(300)
        check('viendo el ejemplo, cambiar de idioma recarga el ejemplo en el nuevo idioma', (await p.evaluate("S.texto")).startswith('Supercompensation') and 'verified quote' in await p.inner_text('#resultado'))
        await p.goto(p.url.split('?')[0] + '?lang=pt'); await p.wait_for_timeout(500)
        check('?lang=pt en la URL fuerza el portugués', await p.evaluate("LANG") == 'pt')
        await h.idioma('es')
        # ── flujo con IA simulada ──
        await p.evaluate("S={texto:'',res:null,esEjemplo:false};ENVIO_OK=false;guarda();go(1)")
        await p.evaluate("localStorage.setItem('ia_openai_key','sk-test')")
        texto = 'Tras la carga, el rendimiento baja de forma temporal. ' + 'Este texto de prueba tiene suficientes palabras para superar el mínimo exigido por la aplicación. ' * 3
        await p.fill('#entrada', texto); await p.click('#btnAnaliza'); await p.wait_for_selector('#mEnvio.on', timeout=5000)
        check('aviso previo al envío con muestra', len(await p.inner_text('#envioTxt')) > 20)
        await p.check('#envioOk'); await p.click('#envioSi'); await h.esp("step===2 && S.res")
        check('la cita inventada se marca como no verificada', await p.evaluate("S.res.puntos.map(x=>x.ok).join()") == 'true,false')
        check('la petición llevó JSON, el modelo y el idioma de respuesta (español)', h.seen[-1]['json'] and h.seen[-1]['model'] and 'español' in h.seen[-1]['user'])
        await h.descarga('#btnCsv', '/tmp/smoke.csv'); await h.descarga('#btnWord', '/tmp/smoke.docx')
        check('descargas CSV y Word', pathlib.Path('/tmp/smoke.csv').stat().st_size > 20 and pathlib.Path('/tmp/smoke.docx').stat().st_size > 1000)
        try:   # el Word se abre de verdad (python-docx) y lleva el contenido
            import docx as _pd; _w = _pd.Document('/tmp/smoke.docx'); _tx = '\n'.join(q.text for q in _w.paragraphs)
            check('el Word se abre con python-docx y lleva el título', 'APP_NAME' not in _tx and len(_tx) > 40)
        except ImportError: print('  (sin python-docx: pip install python-docx para abrir el Word)')
        # Word y ZIP no dependen de ningún CDN: con cdnjs y jsDelivr bloqueados la descarga sigue funcionando
        h.sin_cdn = True; await h.descarga('#btnWord', '/tmp/smoke_offline.docx'); h.sin_cdn = False
        check('Word sin CDN (bloqueador, proxy o sin red)', pathlib.Path('/tmp/smoke_offline.docx').stat().st_size > 1000)
        check('ZIP nativo', await p.evaluate("zipDe({'a.txt':'hola','b/ñ.txt':'x'.repeat(500)}).then(b=>b.size)") > 100)
        # misma app en inglés: la IA recibe el idioma, el resultado se repinta y las citas se siguen verificando en el idioma original
        await h.idioma('en'); await p.evaluate("S={texto:'',res:null,esEjemplo:false};go(1)")
        await p.fill('#entrada', ejemplo_en := 'Supercompensation is the basis of training planning. After the load, performance drops temporarily. If rest is sufficient, the body not only recovers but exceeds its initial level for a limited time. That window is the ideal moment to apply the next load; if it comes late, the improvement is lost. ' + 'This test text has enough words to pass the minimum required by the application. ' * 2)
        await p.click('#btnAnaliza'); await h.esp("step===2 && S.res")
        check('en inglés: la IA recibe el idioma y el resultado se verifica', 'English' in h.seen[-1]['user'] and await p.evaluate("S.res.puntos.map(x=>x.ok).join()") == 'true,false' and 'verified quote' in await p.inner_text('#resultado'))
        await h.idioma('pt'); check('al cambiar a portugués el resultado ya guardado se repinta', 'citação verificada' in await p.inner_text('#resultado'))
        # errores de la IA en el idioma elegido
        await h.idioma('pt'); await p.evaluate("go(1)")
        h.reply = lambda *a: asyncio.sleep(0, ('err', 429, '{"error":{"message":"You exceeded your current quota, billing"}}'))
        await p.click('#btnAnaliza'); await p.wait_for_timeout(2500)
        check('error de saldo traducido al portugués', 'não tem saldo' in await p.inner_text('#estado'), await p.inner_text('#estado'))
        await h.idioma('es')
        await p.reload(); await p.wait_for_timeout(700)
        check('persistencia tras recargar', await p.evaluate("S.res&&S.res.puntos.length") == 2)
        check('sin errores de página', not h.errors, str(h.errors))
        for l in ('es', 'en', 'pt'):
            check(f'sin desborde horizontal en móvil ({l})', not await h.desborde_movil(f"localStorage.setItem(APP+'_lang','{l}');initI18n();S.res=procesa(ejemplo().res,ejemplo().texto);go(2)"))
    sys.exit(0 if ok else 1)
asyncio.run(main())
