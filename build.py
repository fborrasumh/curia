#!/usr/bin/env python3
"""Monta index.html (un solo fichero) a partir de app.json + src/ + forja/.  Uso:  python3 build.py"""
import json, re, sys, pathlib
R = pathlib.Path(__file__).resolve().parent
cfg = json.loads((R/'app.json').read_text(encoding='utf-8'))
mods = list(cfg.get('modules') or ['00-utils','10-persist','20-providers','30-verify','40-extract','60-nav','65-i18n','70-report'])
if '65-i18n' not in mods: mods.append('65-i18n')   # idiomas: siempre presente (t() lo usan los demás módulos)
langs = cfg.get('langs') or ['es','en','pt']
assert langs[0] == 'es' and set(langs) <= {'es','ca','eu','gl','en','pt'}, "app.json → langs: el español va primero (idioma de origen y por defecto); admitidos: es, ca, eu, gl, en, pt"
js_parts = [f"const APP={json.dumps(cfg['slug'])};const APP_NAME={json.dumps(cfg['name'])};const LOGO_ICON={json.dumps(cfg.get('logo_icon','bulb'))};const LANGS_ON={json.dumps(langs)};\n"]
if cfg.get('capture_src'):   # copia fiel del HTML original para generar páginas derivadas (p. ej. «página para el alumnado»); debe ir antes de que se pinte nada
    js_parts.append("const SRC='<!DOCTYPE html>\\n'+document.documentElement.outerHTML;\n")
for m in mods:
    f = R/'forja'/'js'/(m if m.endswith('.js') else m+'.js')
    js_parts.append(f.read_text(encoding='utf-8')+'\n')
app_js = list(cfg.get('app_js', ['app.js']))
if (R/'src'/'i18n.js').exists() and 'i18n.js' not in app_js: app_js.insert(0, 'i18n.js')   # diccionarios de la app
for extra in app_js:
    js_parts.append((R/'src'/extra).read_text(encoding='utf-8')+'\n')
js = ''.join(js_parts)
assert '</script' not in js, 'El JS contiene «</script»: escríbelo como «<\\/script» o «</scr»+«ipt»'
css = (R/'forja'/'forja-base.css').read_text(encoding='utf-8') + (R/'src'/'app.css').read_text(encoding='utf-8')
icons = (R/'forja'/'icons.svg').read_text(encoding='utf-8')
extra_icons = R/'src'/'icons-extra.svg'
if extra_icons.exists():
    icons = icons[:icons.rfind('</svg>')] + extra_icons.read_text(encoding='utf-8') + '</svg>'
links = (R/'forja'/'head-links.html').read_text(encoding='utf-8')
body = (R/'src'/'body.html').read_text(encoding='utf-8')
# CSP: solo los orígenes que la app usa de verdad
usa = lambda s: any(m.startswith(s) for m in mods)
connect = []
if usa('20-'): connect += ['https://api.openai.com','https://generativelanguage.googleapis.com','https://api.anthropic.com']
connect += cfg.get('connect_extra', [])
# librerías externas solo para LEER ficheros (40-extract) o si la app llama a cargaLib por su cuenta; Word/ZIP (70-report) no necesitan red
app_src = ''.join((R/'src'/x).read_text(encoding='utf-8') for x in app_js if (R/'src'/x).exists())
cdn = 'https://cdnjs.cloudflare.com https://cdn.jsdelivr.net' if (usa('40-') or 'cargaLib(' in app_src) else ''
csp = "default-src 'none'; script-src 'unsafe-inline'"+(' '+cdn if cdn else '')+"; style-src 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src data: blob:; media-src blob: data:"
csp += "; connect-src "+(' '.join(connect) if connect else "'none'")
if cdn: csp += "; worker-src blob: "+cdn
csp += "; base-uri 'none'; form-action 'none'"
authors = '; '.join(a['name'] for a in cfg['authors'])
desc = cfg.get('description') or cfg.get('tagline','')
html = f'''<!DOCTYPE html>
<html lang="{cfg.get('lang','es')}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#0F2237">
<meta http-equiv="Content-Security-Policy" content="{csp}">
<meta name="author" content="{authors}">
<meta name="description" content="{desc.replace('"','&quot;')}">
<title>{cfg['name']} · {cfg.get('tagline','')}</title>{links}
<style>{css}</style></head>
<body>
{icons}
{body}
<script>{js}</script>
</body></html>'''
(R/'index.html').write_text(html, encoding='utf-8')
(R/'all.js').write_text(js, encoding='utf-8')   # para «node --check all.js»
print(f'index.html: {len(html):,} bytes · módulos: {", ".join(mods)}')
