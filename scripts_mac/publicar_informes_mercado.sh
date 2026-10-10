#!/usr/bin/env bash
# ============================================================
# Disparador EXTERNO de /informes-mercado/ (y /noticias/).
# ------------------------------------------------------------
# Reconstruye la web de informes con los CSV del mes que haya en Drive y la
# publica (git push → Cloudflare Pages). Pensado para llamarse DESDE FUERA del
# lunes: el circuito del día 8 de Machine (scripts_mac/informes_mercado_dia8.sh)
# lo invoca justo después de dejar los PDF/CSV del mes en Drive, para que la
# página no se quede un mes atrás cuando se reparte su enlace el día 10.
# El build de los lunes (skill cartera-consolidada-generacion) queda como red
# de seguridad.
#
# Corre en el Mac con el git local de ~/cabas-web: NO necesita ningún secreto.
# Como se ejecuta en una shell normal (no en Claude Code), no le afecta la
# puerta de "horario de oficinas" del plugin reglas-cabas.
#
# Uso:  bash ~/cabas-web/scripts_mac/publicar_informes_mercado.sh
# ============================================================
set -euo pipefail
REPO="$HOME/cabas-web"
cd "$REPO"

echo "[informes] $(date '+%Y-%m-%d %H:%M') · build"
node informes-mercado/build.mjs

# ¿Hay algo que publicar? (datos nuevos, HTML regenerado, titulares, sitemap)
if [ -z "$(git status --porcelain informes-mercado noticias/index.html sitemap.xml)" ]; then
  echo "[informes] sin cambios; nada que publicar."
  exit 0
fi

MES="$(node -e "const fs=require('fs');const m=fs.readFileSync('informes-mercado/index.html','utf8').match(/Última actualización:\s*<b>([^<]+)<\/b>/);process.stdout.write(m?m[1]:'actualización')")"

git add informes-mercado noticias/index.html sitemap.xml
git commit -m "Informes de mercado: ${MES}"
git push origin main
echo "[informes] publicado: ${MES}"
