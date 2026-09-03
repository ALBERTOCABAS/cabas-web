# CLAUDE.md — cabas-web

Contexto de arranque para cualquier sesión futura. Léelo antes de tocar nada.

## Qué es este repo

**Web estática de cabas.es** (Alberto Cabas, agente inmobiliario en Madrid). HTML + CSS + JS sin framework ni build. Se sirve por **Cloudflare Pages**. Incluye el widget conversacional **Kitty** (captación de leads + calculadoras).

**El código de Kitty es público y auditable**: todo el "cerebro" viaja en `js/` y se sirve tal cual al navegador. No metas nada sensible aquí (ver Secretos).

## Relación con `cabas-bot` (importante)

Son **dos repos hermanos bajo `~/`**:
- `~/cabas-web` — esta web (Pages).
- `~/cabas-bot` — el Worker: bot de Telegram/WhatsApp, base D1 y agenda de Google Calendar.

El bot **importa el cerebro de Kitty directamente desde aquí** (`~/cabas-bot/src/*.js` hace `require('../../cabas-web/js/...')`). Por eso **ambos repos deben estar clonados como hermanos** bajo `~/` o el bot no empaqueta. Editar el guión/los textos aquí afecta a los tres canales a la vez.

## Arquitectura "un cerebro, tres bocas"

Un único cerebro alimenta el **widget web**, **Telegram** y **WhatsApp**:

- `js/kitty-guion.js` — el **guión**: flujos, pasos, preguntas, opciones (`GUION`, `SUBFLUJOS`).
- `js/kitty-textos.js` + `js/kitty-textos-en.js` + `js/kitty-textos-fr.js` — **i18n**. La web muestra ES y traduce con Google Translate; los bots usan `tx()` con estos ficheros. Regla: ningún hueco sin traducir; términos de glosario mantienen la palabra española entre paréntesis; en FR siempre "vous".
- `js/kitty-runner.js` — el **motor** (cerebro único de los 3 canales). Conceptos clave:
  - bucle **`veces`** (repite un paso N veces, con `n` en el contexto),
  - **`sembrar`** (precarga datos al saltar a un flujo, p. ej. desde un deep-link),
  - **deep-link `#kitty=<flujo>`** (abrir la web en un flujo concreto; hay un handler delegado que reabre el widget aunque el hash ya sea ese).
- `js/cabas-chatbot.js` — la **UI del widget** (burbuja, render, envío de lead).
- `js/calc-*.js` + `js/datos-cabas.js` — motor de cálculo y datos fiscales (fuente única; ver skill `actualizar-fiscalidad`).

## Tubería de leads

Formularios estáticos y el widget Kitty **postean al Worker** `POST https://cabas-bot.alberto-f06.workers.dev/lead-web`:
- `js/form-lead.js` — intercepta los **4 formularios estáticos** (`class="form-lead-js"`, `data-flujo`): contacto, vender, inversion, comprar. Reintenta 3 veces; ante fallo ofrece WhatsApp/email.
- `js/turnstile-cabas.js` — helper compartido de **Cloudflare Turnstile invisible**. `window.CabasTurnstile.getToken()` → token. La **SITEKEY (pública)** vive aquí; el secreto vive en el Worker. Si SITEKEY está vacío, es no-op.
- **Honeypot**: campo oculto `k_extra` en los formularios; si viene relleno, el Worker finge éxito y no guarda.
- El Worker: **D1 primero**, luego aviso a Telegram + email. Valida Turnstile + honeypot + tamaño por campo (ver CLAUDE.md del bot).

## Cabeceras de seguridad

`_headers` (raíz) aplica a `/*`: `X-Frame-Options: SAMEORIGIN`, `Content-Security-Policy: frame-ancestors 'self'`, `Strict-Transport-Security` (1 año, subdominios, sin `preload`), `Permissions-Policy`. `nosniff` y `referrer-policy` ya se sirven por otra vía — no los dupliques aquí.

## Despliegue

**Cloudflare Pages via `git push`** (el push construye y publica):
```bash
cd ~/cabas-web && git add -A && git commit -m "..." && git push
```
Nota: las URLs limpias hacen `308` de `/pagina.html` → `/pagina` (usa `curl -L` al verificar). El selector de idioma es Google Translate (no hay páginas EN/FR separadas).

## Secretos

**Aquí NO vive ningún secreto.** Lo único "de Cloudflare" en el cliente es la **SITEKEY pública** de Turnstile en `js/turnstile-cabas.js`. Todos los secretos reales están en el Worker (ver CLAUDE.md de `cabas-bot`).

## Reglas de trabajo con Alberto

- **No es programador.** Dale **comandos completos con `cd`**, en bloque `bash`, uno por bloque.
- **Los despliegues los lanza él**, y **por separado** (web y Worker en dos pasos distintos).
- **Él prueba en navegador real antes de dar por bueno** un cambio de cara al público (regla tras un panel muerto: verificar con clics reales, no solo HTML).
- Credenciales de la web (si las hubiera en algún panel): no se tocan las reales; probar con efímeras que se borran.

## Recuperación de desastre

En un **Mac nuevo**:
1. Clonar **los dos repos como hermanos** bajo `~/`:
   `git clone …/cabas-web.git ~/cabas-web` y `git clone …/cabas-bot.git ~/cabas-bot`.
2. Para el bot: `cd ~/cabas-bot && npm install` y `npx wrangler login`.
3. La web no necesita build; el deploy es `git push`.

**Vive fuera del Mac** (no en el repo): el dominio y la config de **Cloudflare Pages/Workers**, la base **D1**, los **secretos del Worker** (`wrangler secret`), el widget de **Turnstile**, la app de **Meta/WhatsApp**, el proyecto **OAuth de Google**, y la cuenta de **Web3Forms**. Sin eso, el código arranca pero no queda cableado a los servicios.
