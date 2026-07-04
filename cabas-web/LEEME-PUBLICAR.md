# Cómo publicar cabas.es (v2)

## Ver la web ahora mismo en tu Mac
Descomprime el zip y doble clic en `index.html`. Funciona todo sin instalar nada.
(El selector de idiomas usa Google Translate y solo funciona con la web publicada en internet, no en local.)

## Publicarla en internet (15 minutos, gratis)
1. **GitHub**: cuenta en github.com → "New repository" → nombre `cabas-web` → "uploading an existing file" → arrastra TODO el contenido del zip → Commit.
2. **Cloudflare Pages**: cuenta en cloudflare.com → Workers & Pages → Create → Pages → "Connect to Git" → repositorio `cabas-web` → Deploy. En 2 minutos: URL provisional tipo `cabas-web.pages.dev`.
3. **Revisar en el móvil** y validar.
4. **DNS**: Cloudflare Pages → Custom domains → añadir `cabas.es` y `www.cabas.es` → poner en IONOS (Dominios → cabas.es → DNS) los registros que indique Cloudflare. Desde ese momento la web nueva está en cabas.es.

## Pendiente de rellenar (buscar "PENDIENTE" en los archivos)
- **Clave de formularios**: cuenta gratis en web3forms.com con alberto@cabas.es → Access Key → sustituir `PENDIENTE_CLAVE_WEB3FORMS` en vender.html, comprar.html, valoracion.html y contacto.html.
- **Redes sociales**: sustituir `PENDIENTE_INSTAGRAM`, `PENDIENTE_LINKEDIN`, `PENDIENTE_FACEBOOK`, `PENDIENTE_YOUTUBE` en el footer de todas las páginas por las URLs reales (si alguna red no se usa, borrar su enlace).
- **Fotos** (guardar en assets/ y sustituir los huecos marcados):
  - Retrato profesional de Alberto (vertical, 4:5) → Home y Quién soy
  - Foto apaisada (reunión/firma/fachada) → Herencias
  - Foto de la oficina de Bravo Murillo → Contacto
- **Las 6 oficinas** en oficinas.html (dirección, teléfono, zona).
- **NIF** en aviso-legal.html.

## Mantenimiento anual (enero)
- js/calc-vendedor.js → coeficientes IIVTNU y tramos IRPF.
- js/calc-hipoteca.js → ITP/IVA/AJD y estimaciones de gastos.
