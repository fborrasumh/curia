"""Dictado por voz con un SpeechRecognition simulado: python3 tests/voz_test.py"""
import asyncio, sys, pathlib
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent)); from forja_test import Harness
FAKE = """window.SpeechRecognition = class { start(){ window._rec = this; setTimeout(()=>{ const r=[{0:{transcript:'dónde vive usted'},isFinal:true,length:1}]; this.onresult({resultIndex:0,results:r}); },50); } stop(){ this.onend && this.onend(); } };"""
async def main():
    async with Harness(pathlib.Path(__file__).resolve().parent.parent/'index.html', init_scripts=[FAKE]) as h:
        p = h.page; await p.evaluate("go(2)"); await p.click('#coMic'); await p.wait_for_timeout(200)
        v = await p.input_value('#coIn'); pressed = await p.get_attribute('#coMic', 'aria-pressed')
        await p.click('#coMic'); await p.click('#coEnviar'); await p.wait_for_timeout(300)
        ok = 'dónde vive' in v and pressed == 'true' and 'Xàtiva' in await p.inner_text('#coChat') and not h.errors
        print(('✓' if ok else '✕'), 'el dictado llena la pregunta y el cliente responde', v, pressed, h.errors); sys.exit(0 if ok else 1)
asyncio.run(main())
