---
name: actualizar-fiscalidad
description: Actualiza los tipos e impuestos de la web de Cabas (ITP, AJD, plusvalía municipal, coeficientes IIVTNU y tramos de IRPF) editando UN solo archivo (js/datos-cabas.js) y publicando. Úsala cuando cambie la fiscalidad inmobiliaria en España o cada año al actualizarse los coeficientes. La web y el chatbot Kitty se actualizan a la vez.
---

# Actualizar la fiscalidad de cabas.es

Toda la fiscalidad de la web **y del chatbot Kitty** vive en un ÚNICO archivo:
**`js/datos-cabas.js`**. Las calculadoras de `vender.html` / `comprar.html`,
el informe (`informe-compra.html`) y el chatbot (`js/cabas-chatbot.js`, a través
de `js/calc-core.js`) leen todos de ahí. Por eso **solo hay que tocar ese archivo**
y todo queda sincronizado.

⚠️ **Nunca** edites la lógica de cálculo (`js/calc-core.js`, `js/calc-vendedor.js`,
`js/calc-hipoteca.js`). Esta skill solo cambia DATOS (números), no fórmulas.

## Las 4 tablas que se mantienen (todas en `js/datos-cabas.js`)

1. **`DATOS_CCAA`** — por comunidad autónoma: `itp` (% ITP en vivienda usada) y
   `ajd` (% AJD en obra nueva). Algunas CCAA usan escala progresiva (una función
   `itp: (precio) => tramosProgresivos(...)`) — respeta ese formato si ya lo tienen.
2. **`PLUSVALIA_CCAA`** — tipo de gravamen del IIVTNU (%) estimado por la capital
   de cada comunidad (0–30).
3. **`COEF_IIVTNU`** — coeficientes máximos estatales de la plusvalía municipal por
   años de tenencia (0 a 20). Se actualizan casi cada año (Ley de Presupuestos u
   orden ministerial).
4. **`TRAMOS_IRPF`** — tramos de la base del ahorro para la ganancia patrimonial
   (hoy 19 / 21 / 23 / 27 / 30 %).

## Pasos

1. **Averigua el cambio.** Pregunta a Alberto qué ha cambiado, o si es la
   actualización anual, busca la fuente oficial (BOE / Ley de Presupuestos para
   coeficientes IIVTNU e IRPF; boletines autonómicos para ITP/AJD; ordenanzas
   municipales para el tipo de plusvalía). Anota la fuente y el año.
2. **Edita SOLO `js/datos-cabas.js`.** Cambia únicamente los valores de la tabla
   afectada. Mantén los comentarios y el formato. Actualiza el comentario de fecha
   si procede.
3. **Comprueba la coherencia** (rápido, sin romper nada):
   - Que el archivo sigue siendo JS válido (sin comas colgando, llaves cerradas).
   - Que los porcentajes son razonables (ITP ~4–13 %, AJD ~0–2 %, plusvalía 0–30 %,
     coeficientes 0–0,45).
   - Si puedes, abre `preview-chatbot.html` o `vender.html`/`comprar.html` en un
     servidor local y confirma que no hay errores de consola y que un cálculo de
     prueba da un número razonable. La web y Kitty deben coincidir (usan el mismo dato).
4. **Enseña el cambio a Alberto** (un diff claro: valor antiguo → nuevo, con la
   fuente) y **pide confirmación antes de publicar**.
5. **Publica** (solo con el OK de Alberto):
   ```bash
   git add js/datos-cabas.js
   git commit -m "Fiscalidad: <qué cambió> (fuente: <...>, <año>)"
   git push
   ```
   Cloudflare detecta el push y redespliega cabas.es automáticamente en 1–2 minutos.
   La web y el chatbot Kitty quedan actualizados a la vez.
6. **Confirma** a Alberto que se ha publicado y qué cambió.

## Notas
- Si un cambio requiere tocar una FÓRMULA (no un número) —por ejemplo un nuevo
  método de cálculo de la plusvalía— eso NO es esta skill: avisa a Alberto de que
  hay que revisar `js/calc-core.js` (y su reflejo en las páginas) con cuidado.
- Recuerda: cambiar `datos-cabas.js` actualiza AUTOMÁTICAMENTE las calculadoras de
  la web y el chatbot. No hay que tocar nada más.
