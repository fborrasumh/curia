"""Prueba de CurIA con IA simulada: python3 tests/app_test.py"""
import asyncio, sys, pathlib, json
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from forja_test import Harness
ROOT = pathlib.Path(__file__).resolve().parent.parent

async def reply(prov, system, user, info):
    if 'Eres Vicenta' in user:  # cliente: revela un hecho real, inventa un id y menciona un año que no está en su ficha
        return ('j', {'respuesta': 'Vivimos en Xàtiva desde 1690, en el reino de Valencia.', 'hechos': ['lugar', 'inventado']})
    if 'estudiante ha emitido este dictamen' in user:
        return ('j', {'comentario': 'Fundas bien el cambio de 1707. Te pondría un 8/10. Citas «el Decreto de Nueva Planta» con acierto y también «una frase que no escribiste nunca jamás».'})
    if 'Dos abogados' in user: return ('j', {'a': 'Señoría, procede aplicar el Ordenamiento de Alcalá.', 'b': 'Procede el fuero municipal de la villa.'})
    if 'Dos diputados' in user: return ('j', {'pro': 'Sí, señores.', 'con': 'No, señores.'})
    if 'artículo constitucional inventado' in user: return ('j', {'c': '1812', 'huellas': ['sn', 'rep'], 'razon': 'Habla de la Nación soberana.'})
    if 'tutor de Historia del Derecho' in user: return ('j', {'bien': 'Ubicas bien el texto.', 'falta': 'Falta la fecha. Nota: 6.', 'pregunta': '¿Qué dice «texto inventado que no está en la fuente»?'})
    if 'defensa oral de cinco minutos' in user: return ('j', {'preguntas': ['¿Quién lo dicta?', '¿Cuándo?', '¿Por qué?', '¿Qué queda hoy?']})
    if 'Valora las respuestas' in user: return ('j', {'criterios': [{'c': 'Claridad', 't': 'Claro. Calificación: notable.'}, {'c': 'Uso del texto', 't': 'Bien.'}]})
    return ('j', {})

async def main():
    ok = True
    def check(n, c, x=''):
        nonlocal ok; ok &= bool(c); print(('✓' if c else '✕'), n, x)
    async with Harness(ROOT/'index.html', reply) as h:
        p = h.page
        check('CSP bloquea otros orígenes', await h.csp_bloquea())
        check('no faltan traducciones', await h.faltan_traducciones() == [], str(await h.faltan_traducciones()))
        # práctica sin clave
        await p.click('#btnStart'); await p.wait_for_timeout(300)
        check('la práctica muestra una pregunta y su motivo', await p.is_visible('#prBox .cu-q') and len(await p.inner_text('.cu-motivo')) > 10)
        for _ in range(6):
            await p.click('#prBox [data-op]'); await p.wait_for_timeout(80); await p.click('#btnSig'); await p.wait_for_timeout(80)
        check('se registran las respuestas', await p.evaluate("S.ev.filter(e=>e.k==='item').length") == 6)
        # consulta guiada sin clave
        await p.evaluate("go(2)"); await p.wait_for_timeout(200)
        await p.fill('#coIn', '¿Dónde vive usted y cuándo murió su marido?'); await p.click('#coEnviar'); await p.wait_for_timeout(300)
        t = await p.inner_text('#coChat'); check('modo guiado: el cliente responde con su ficha', 'Xàtiva' in t and '1714' in t)
        check('se cuentan los hechos clave', '2 de 4' in await p.inner_text('#coHechos'))
        await p.evaluate("[...document.querySelectorAll('#coDict input[name=d_derecho]')].find(i=>i.value==='0').checked=true;[...document.querySelectorAll('#coDict input[name=d_tribunal]')].find(i=>i.value==='1').checked=true")
        await p.fill('#dRazon', 'Se aplica el Decreto de Nueva Planta de 1707 porque Valencia perdió els Furs.'); await p.click('#btnDict'); await p.wait_for_timeout(200)
        d = await p.inner_text('#coDict'); check('dictamen corregido por código (derecho bien, tribunal mal)', '✓ Derecho aplicable' in d and '✗ Tribunal' in d and 'Te faltó preguntar' in d)
        # consulta con IA simulada
        await p.evaluate("localStorage.setItem(PROV.openai.k,'sk-test-clave-larga-de-prueba-123'); ENVIO_OK=true")
        await p.fill('#coIn', '¿De dónde es?'); await p.click('#coEnviar'); await h.esp("document.querySelector('#coChat').innerText.includes('1690')")
        t = await p.inner_text('#coChat'); check('IA: avisa del año que no está en la ficha', '1690' in t and '⚠' in t)
        check('IA: los ids inventados no cuentan', 'inventado' not in json.dumps(await p.evaluate("S.co.c1.obt")))
        await p.click('#btnComDict'); await h.esp("document.querySelector('#coDict .cu-ia')")
        c = await p.inner_text('#coDict .cu-ia'); check('IA: se elimina la nota del comentario', '8/10' not in c and 'pondría' not in c)
        check('IA: detecta la cita que el estudiante no escribió', '⚠' in c)
        # laboratorios
        await p.evaluate("go(3)"); await p.click('#btnAbog'); await h.esp("document.querySelector('#labBox').innerText.includes('Abogado A')")
        check('pleito: alegatos de los abogados', 'Abogado B' in await p.inner_text('#labBox'))
        await p.click('#labBox input[name=pl]'); await p.click('#btnPl'); check('pleito: sentencia corregida', await p.is_visible('#labBox .okbox, #labBox .aviso'))
        await p.click('[data-lab=detective]'); await p.click('#btnDet'); check('detective: marca los años cambiados', 'Se te escapó' in await p.inner_text('#labBox'))
        await p.click('[data-lab=cortes]'); await p.click('#btnDip'); await h.esp("document.querySelector('#labBox').innerText.includes('Diputado en contra')"); check('cortes: intervienen los diputados', True)
        await p.click('[data-lab=const]'); await p.click('#labBox [data-c]'); check('constituciones: corrige y explica', 'Huellas' in await p.inner_text('#labBox'))
        await p.click('[data-cm=inv]'); await p.fill('#cArt', 'La soberanía reside esencialmente en la Nación española y en nadie más'); await p.click('#btnAdiv'); await h.esp("document.querySelector('#labBox').innerText.includes('acertado')")
        check('constituciones inversa: la IA adivina y el código contrasta huellas', 'Soberanía nacional' in await p.inner_text('#labBox'))
        # dossier
        await p.evaluate("go(4)"); await p.fill('#doCod', 'ana23'); await p.dispatch_event('#doCod', 'change'); await p.wait_for_timeout(200)
        check('dossier: seis textos asignados', await p.evaluate("document.querySelectorAll('#selTexto option').length") == 6)
        await p.click('[data-tutor=ubicar]')
        try: await h.esp("document.querySelector('#doPasos .cu-ia')", n=20)
        except Exception: print('DEBUG', await p.inner_text('#toast'), h.errors, len(h.seen), await p.evaluate("[document.querySelectorAll('#doPasos textarea').length, S.codigo, S.txtId, document.querySelector('.screen.on').dataset.step]")); raise
        tu = await p.inner_text('#doPasos .cu-ia'); check('tutor: sin nota y con aviso de cita inventada', 'Nota' not in tu and '⚠' in tu)
        await p.click('#btnDefP'); await h.esp("document.querySelector('#dr0')"); await p.fill('#dr0', 'Lo dicta Felipe V'); await p.click('#btnDefV'); await h.esp("document.querySelector('#doDefensa .cu-ia')")
        check('defensa: valoración sin calificación', 'notable' not in (await p.inner_text('#doDefensa .cu-ia')).lower())
        # progreso, entrega y panel
        await p.evaluate("go(5)"); check('progreso por RA', await p.evaluate("document.querySelectorAll('#pgBox .cu-bar').length") == 10)
        ent = await h.descarga('#btnEntrega', '/tmp/curia_entrega.json'); data = json.loads(pathlib.Path('/tmp/curia_entrega.json').read_text())
        check('fichero de entrega', data['codigo'] == 'ana23' and len(data['textos']) == 6 and len(data['eventos']) > 6)
        await p.evaluate("go(7)"); await p.set_input_files('#fDef', '/tmp/curia_entrega.json'); await p.wait_for_timeout(300)
        check('panel: defensa con texto sorteado del estudiante', 'ana23' in await p.inner_text('#pfDef'))
        await p.set_input_files('#fSeg', '/tmp/curia_entrega.json'); await p.wait_for_timeout(300); check('panel: seguimiento', '1 ficheros' in await p.inner_text('#pfSeg'))
        await h.descarga('#btnEF', '/tmp/ef.txt'); check('material para ExamForge', 'Fuero Juzgo' in pathlib.Path('/tmp/ef.txt').read_text() or len(pathlib.Path('/tmp/ef.txt').read_text()) > 2000)
        await h.descarga('#btnGift', '/tmp/g.txt'); check('GIFT', '::' in pathlib.Path('/tmp/g.txt').read_text())
        await p.evaluate("go(6)"); check('cronología', await p.evaluate("document.querySelectorAll('#crBox li').length") > 100)
        await p.evaluate("go(8)"); check('temario', '«' in await p.inner_text('#teBox'))
        # idiomas: todas las pantallas repintan sin errores
        for l in ('en', 'pt'):
            await h.idioma(l)
            for i in range(9): await p.evaluate(f"go({i})"); await p.wait_for_timeout(60)
        check('idiomas: el botón de hablar se traduce', (await p.inner_text('#coMic')).strip() == 'Falar')
        await h.idioma('es'); await p.evaluate("go(1)")
        check('sin desborde en móvil', await h.desborde_movil() in (None, [], False, 0), str(await h.desborde_movil()))
        for i in (0, 2, 3, 4): await p.evaluate(f"go({i})"); await h.shot(f'/tmp/cu_{i}.png', full=False)
        check('sin errores de página', not h.errors, str(h.errors[:3]))
    print('\nTODO OK' if ok else '\nHAY FALLOS'); sys.exit(0 if ok else 1)
if __name__ == "__main__": asyncio.run(main())
