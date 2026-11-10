# CurIA

Sistema de aprendizaje de la asignatura **1193 Historia del Derecho** (Grado en Derecho, Universidad Miguel Hernández de Elche), construido sobre sus unidades didácticas. Aplicación web de un solo fichero: funciona en el navegador, sin servidor ni cuentas.

**Usar la app:** https://fborrasumh.github.io/curia/

[![DOI](https://zenodo.org/badge/DOI/10.5281/zenodo.24111387.svg)](https://doi.org/10.5281/zenodo.24111387)

**Idiomas:** español (por defecto), inglés y portugués; selector en la barra superior (o `?lang=en` / `?lang=pt`). Los contenidos de las unidades didácticas (temas, pasajes, preguntas nuevas y casos) están en castellano, la lengua de la asignatura; la IA responde en el idioma elegido.

## Qué hace

- **Práctica adaptativa** (sin clave): 120 preguntas de los 18 temas, vinculadas a los 10 resultados de aprendizaje (RA) de la guía docente. El código estima el dominio por RA (con olvido), elige la siguiente pregunta (repasos de lo fallado, tema de clase, RA más flojo, intercalado) y explica por qué toca. Cada pregunta nueva muestra el pasaje literal de la unidad didáctica que la justifica.
- **Consulta jurídica**: ocho clientes de otras épocas (Toledo 1090, un señorío castellano en 1360, Bizkaia 1465, Girona 1490, Medina 1510, Xàtiva 1715, Alcoy 1832, Alicante 1873). El estudiante pregunta, **por escrito o de viva voz** (el navegador transcribe con su reconocimiento de voz, sin gastar tokens de IA), y la respuesta se puede leer en voz alta. Después emite un dictamen: derecho aplicable, tribunal competente y, cuando procede, orden de prelación. El código corrige, muestra el fundamento con los pasajes de las unidades y el informe de la entrevista (hechos clave obtenidos y los que faltaron). Con IA, el cliente habla con naturalidad pero solo conoce su ficha; el código descarta los hechos que no están en ella y avisa si menciona un año que no figura en la ficha. Sin clave funciona en modo guiado. Tres niveles: el cliente colabora, responde solo a lo preguntado u oculta un dato.
- **Laboratorios**: *El pleito en cinco épocas* (con dos abogados que alegan fuentes distintas), *Detective de anacronismos* (el código cambia los años de una cronología y sabe cuáles), *Cortes en el aula* (votación, intervención de diputados y segunda votación) y *¿De qué constitución es?* (identificar artículos por sus huellas o redactar uno para que la IA lo adivine).
- **Dossier de fuentes**: seis textos por estudiante, repartidos por su código. Comentario en cinco pasos con un tutor que pregunta y no escribe por el estudiante; el código comprueba las citas y cuenta los conceptos clave. **Ensayo de la defensa oral**, con respuestas habladas.
- **Progreso, copia y fichero de entrega** para el campus virtual.
- **Temario y cronología** de las 18 unidades.
- **Panel del profesorado**: defensas orales con sorteo del texto entre los seis del estudiante y rúbrica de cuatro criterios (exportación CSV), seguimiento a partir de los ficheros de entrega, material para **ExamForge** (resúmenes, pasajes y cronología por unidad) y banco de preguntas en **Moodle GIFT**.

La IA nunca pone nota: las frases que la contienen se eliminan.

## Cómo se usa la IA

Con la propia clave de OpenAI, Google Gemini o Anthropic Claude, que se guarda solo en el navegador. Cada persona paga su propio uso. Los datos personales se enmascaran siempre. Antes del primer envío se muestra lo que sale, salvo en la consulta jurídica, donde la muestra desvelaría la ficha del caso.

## Voz

El dictado usa la Web Speech API del navegador (Chrome, Edge y Safari; Firefox no la admite). Según el navegador, el audio lo procesa el servicio de voz de su fabricante. La lectura en voz alta usa la síntesis del sistema.

## Privacidad

Todo el trabajo se guarda en el navegador (IndexedDB). Solo al hablar con un personaje o pedir un comentario sale hacia el proveedor de IA el mensaje y el material de la actividad. El fichero de entrega lo descarga y lo entrega el propio estudiante.

## Límites

- El dominio estimado es una orientación, no una nota.
- La detección de conceptos busca términos y sinónimos; no evalúa si se explican bien.
- Los personajes de la consulta y los laboratorios son ficticios; sus opiniones son una interpretación de la IA.
- Sin servidor no hay seguimiento automático ni inicio de sesión institucional: el panel trabaja con los ficheros que entrega el alumnado.

## Desarrollo

Contenidos en `data/` (fichas de los temas y casos) y `src/datos.js` (generado). Lógica en `src/nucleo.js`; interfaz en `src/app.js`; voz y prompts en `src/base.js`. Montaje: `python3 build.py`. Pruebas: `node tests/nucleo_test.js`, `python3 tests/app_test.py` (IA simulada) y `python3 tests/voz_test.py`.

## Autoría (CRediT)

- **Fernando Borrás Rocher** (UMH, ORCID 0000-0002-5519-4573): conceptualización, software.
- **José Antonio Pérez Juan** (UMH, ORCID 0000-0002-9973-683X): recursos (unidades didácticas), validación.
- **Sara Moreno Tejada** (UMH, ORCID 0000-0003-3154-7730): recursos (unidades didácticas), validación.

Reutiliza preguntas, textos y actividades de IusHistorIA, de los mismos autores.

## Cómo citar

Borrás Rocher, F., Pérez Juan, J. A. y Moreno Tejada, S. (2026). *CurIA: Historia del Derecho con IA* [Software]. Universidad Miguel Hernández de Elche.

## Licencia

MIT.
