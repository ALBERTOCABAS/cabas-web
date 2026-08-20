// ============================================================
// kitty-textos.js — MAPA ÚNICO DE TEXTOS de Kitty (web + Telegram)
// ------------------------------------------------------------
// Cada texto tiene un identificador y, de momento, SOLO versión
// española ("es"). Añadir un idioma el día de mañana = añadir su clave
// al lado de "es" (p. ej.  en: '...'), SIN tocar el guión ni la lógica.
//
//   TEXTOS.hipoteca.intro   →   { es: 'Te calculo la cuota mensual…' }
//
// HUECOS: un texto puede llevar huecos entre llaves, p. ej. {neto}. El
// runner los rellena con VALORES (números ya formateados). El texto
// completo —frase entera— vive aquí; en la lógica NO se pega ningún
// trozo de frase. Así se puede editar y, el día de mañana, traducir
// (el orden de las palabras puede cambiar sin romper nada).
//
// Notas:
//  · <b>...</b> = negrita (en Telegram se convierte a su equivalente).
//  · El formato de los importes (p. ej. "180.000 €") lo hacen las
//    funciones eur()/eur2() —formato local—, no el mapa.
//  · Textos LITERALES de la web actual (tono sin retocar; el repaso de
//    tono para Telegram se hará antes de "congelar").
// ============================================================
(function (raiz) {
  'use strict';

  var TEXTOS = {

    // ---------- Menú y saludo (entrada / /start) ----------
    menu: {
      saludo1: { es: 'Hola 👋 Soy <b>Kitty</b>, la <b>asistente virtual</b> (un bot) de <b>Alberto Cabas</b>.' },
      saludo2: { es: 'Puedo hacerte <b>cálculos al instante</b> —lo que te queda al vender, gastos de compra, cuota de hipoteca o hasta qué precio puedes comprar— o ponerte en contacto con Cabas para <b>valorar un inmueble</b> o <b>asesorarte sobre una herencia</b>.' },
      elige:    { es: '¿Qué necesitas? 👇' },
      m_valorar:   { es: '🏡 Valorar un inmueble' },
      m_herencia:  { es: '⚖️ Tengo una herencia' },
      m_vender:    { es: '💶 Lo que me queda si vendo' },
      m_comprar:   { es: '🔑 Cuánto me cuesta comprar' },
      m_buscar:    { es: '🔎 Busco vivienda' },
      m_hipoteca:  { es: '🏦 Simular mi hipoteca' },
      m_capacidad: { es: '📈 Hasta qué precio puedo comprar' },
      m_grupo_hip:     { es: '🏦 Hipoteca y capacidad de compra' },
      grupo_hip_intro: { es: '¿Qué quieres calcular? 👇' },
      grupo_volver:    { es: '↩️ Volver al menú' },
      m_inversion: { es: '📊 Rentabilidad de inversión' },
      m_alqmax:    { es: '🏠 Hasta qué alquiler llego' },
      m_agenda:    { es: '📞 Agendar una llamada' },
      m_contacto:  { es: '✍️ Que me contacte Cabas' },
      m_hablar:    { es: '📞 Hablar con Cabas' },
      hablar_intro:{ es: '¿Cómo prefieres <b>hablar con Cabas</b>?' }
    },

    // ---------- "Hablar con Cabas" directo (desde el menú) ----------
    contacto_directo: {
      lead_resumen:  { es: 'CONTACTO DIRECTO' },
      lead_contexto: { es: 'me gustaría que me llamaras para comentar mi caso.' }
    },

    // ---------- Agendar una llamada (página de reservas de Google) ----------
    agenda: {
      mensaje: { es: '📞 ¡Genial! Reserva tu <b>llamada gratuita de 30 min</b> con Cabas cuando mejor te venga:\n\n👉 <a href="{url}">Agendar mi llamada</a>\n\nElige el hueco libre que quieras, deja tu nombre y teléfono, y <b>Cabas te llama</b> a esa hora. 🙂' }
    },

    // ---------- Flujo: Busco vivienda (cualificación + derivación) ----------
    buscar: {
      op_preg:      { es: '¿Buscas para <b>comprar</b> o para <b>alquilar</b>?' },
      op_comprar:   { es: '🔑 Comprar' },
      op_alquilar:  { es: '🏠 Alquilar' },
      zona_preg:    { es: '¿En qué <b>zona</b> buscas?' },
      zona_chamberi:  { es: 'Chamberí' },
      zona_chamartin: { es: 'Chamartín' },
      zona_malasana:  { es: 'Malasaña / Centro' },
      zona_otra:      { es: 'Otra zona' },
      zona_otra_ph:   { es: 'Zona: provincia, ciudad/población y barrio' },
      vende_preg:        { es: '¿Necesitas <b>vender una vivienda para comprar</b>?' },
      vende_estado_preg: { es: '¿Ya la tienes <b>a la venta</b> o todavía no?' },
      vende_ya:          { es: 'Ya está a la venta' },
      vende_noaun:       { es: 'Todavía no' },
      vende_donde_preg:  { es: '¿Dónde está la vivienda que vendes? Dime <b>provincia, ciudad y dirección</b>.' },
      vende_donde_ph:    { es: 'Ej. Madrid, Madrid, C/ Bravo Murillo 23' },
      vende_enlace_preg: { es: '¿Tienes el <b>enlace del anuncio</b> (tuyo o de una agencia)?' },
      vende_enlace_si:   { es: '🔗 Sí, lo pego' },
      vende_enlace_no:   { es: 'No tengo' },
      vende_enlace_ph:   { es: 'Pega aquí el enlace del anuncio' },
      tipo_preg:      { es: '¿Qué <b>tipo de inmueble</b> buscas?' },
      tipo_obranueva: { es: 'Obra nueva' },
      tipo_piso:      { es: 'Piso' },
      tipo_casa:      { es: 'Casa / Chalet' },
      tipo_edificio:  { es: 'Edificio' },
      tipo_local:     { es: 'Local / Oficina' },
      tipo_garaje:    { es: 'Garaje' },
      presu_compra: { es: '¿Cuál es tu <b>presupuesto máximo</b> de compra?' },
      presu_alq:    { es: '¿Cuál es tu <b>renta máxima</b> al mes?{sug}' },
      presu_ph:     { es: 'Escribe la cantidad (solo números)' },
      hab_preg:   { es: '¿Cuántas <b>habitaciones</b> como mínimo?' },
      banos_preg: { es: '¿Cuántos <b>baños</b> como mínimo?' },
      n1:    { es: '1' },
      n2:    { es: '2' },
      n3:    { es: '3' },
      n3mas: { es: '3 o más' },
      n4mas: { es: '4 o más' },
      igual: { es: 'Me da igual' },
      planta_preg:     { es: '¿Alguna preferencia de <b>planta</b>?' },
      planta_igual:    { es: 'Me da igual' },
      planta_bajo:     { es: 'Planta baja' },
      planta_nobajo:   { es: 'Evitar bajo y sótano' },
      planta_nobajo1:  { es: 'Evitar bajo, sótano y 1º' },
      planta_atico:    { es: 'Ático o última planta' },
      planta_desde:    { es: 'Desde una planta concreta' },
      planta_desde_ph: { es: '¿Desde qué planta? (ej. 2)' },
      asc_preg: { es: '¿El <b>ascensor</b> es indispensable?' },
      asc_si:   { es: 'Sí, indispensable' },
      asc_no:   { es: 'No hace falta' },
      ext_preg: { es: '¿Lo prefieres <b>exterior</b>, <b>interior</b> o depende?' },
      ext_ext:  { es: 'Exterior' },
      ext_int:  { es: 'Interior' },
      ext_dep:  { es: 'Depende' },
      consent_preg: { es: 'Genial 🙂 Para que te llame nuestro compañero del <b>departamento financiero (DCREDIT)</b> —el filtro económico, tanto para compra como para alquiler— y nuestro <b>colaborador experto en tu zona</b>, y poder ofrecerte opciones, necesito tu OK para <b>tratar tus datos y compartirlos con nuestra red de agencias colaboradoras (Redpiso y FAI) y entidades de financiación (DCREDIT)</b>. Aquí ves {enlace}. ¿Aceptas?' },
      consent_link: { es: '<a href="https://www.cabas.es/privacidad.html">cómo tratamos tus datos</a>' },
      consent_si:   { es: '✅ Sí, acepto' },
      consent_no:   { es: 'No' },
      consent_solo_preg: { es: 'Sin problema 🙂 ¿Prefieres que te contacte <b>solo nuestro equipo (Cabas)</b>, sin compartir tus datos con terceros?' },
      consent_solo_si:   { es: '✅ Sí, solo Cabas' },
      consent_solo_no:   { es: 'No, gracias' },
      lead_resumen:  { es: '{resumen}' },
      lead_contexto: { es: 'quiero que me contactéis para ayudarme en mi búsqueda de vivienda.' }
    },

    // ---------- Comunes (reutilizados por varios flujos) ----------
    comun: {
      ccaa_madrid: { es: 'Madrid' },
      ccaa_otra:   { es: 'Otra comunidad' },
      ccaa_elegir: { es: 'Elegir' },
      ccaa_elige_lista: { es: 'Elígela en la lista 👇' },
      // Valores con PALABRA (unidad) → plantilla con hueco:
      v_anios:     { es: '{n} años' },
      v_pct:       { es: '{n} %' },
      v_mes:       { es: '{v} /mes' },
      viv_usada:   { es: 'Usada (2ª mano)' },
      viv_nueva:   { es: 'Obra nueva' },
      con_hipoteca:{ es: 'Con hipoteca' },
      al_contado:  { es: 'Al contado' },
      si:          { es: 'Sí' },
      no:          { es: 'No' },
      n_20:        { es: '20' },
      n_25:        { es: '25' },
      n_30:        { es: '30' },
      // Opciones de plazo (con la palabra "años"):
      plazo_20a:   { es: '20 años' },
      plazo_25a:   { es: '25 años' },
      plazo_30a:   { es: '30 años' },
      otro:        { es: 'Otro' },
      anios_ph:    { es: 'Años' },
      // Deudas vigentes (reducen la capacidad ante el banco) — usado en hipoteca/capacidad/comprar
      deudas_preg:       { es: '¿Tienes <b>otras hipotecas o préstamos</b> en curso (o que vayas a tener)?' },
      deudas_monto_preg: { es: '¿<b>Cuánto pagas al mes</b> en total por esos préstamos o hipotecas?' }
    },

    // ---------- Flujo: Valorar un inmueble ----------
    valorar: {
      intro:        { es: 'Perfecto. Cabas te prepara una <b>valoración realista</b> de tu inmueble, sin compromiso y con datos de la zona.' },
      cuantos_preg: { es: '¿Es un <b>solo inmueble</b> o <b>varios</b>?' },
      opt_uno:      { es: 'Un solo inmueble' },
      opt_varios:   { es: 'Varios inmuebles' },
      ccaa_preg:    { es: '¿En qué <b>comunidad autónoma</b> está?' },
      dir_preg:     { es: '¿Cuál es la <b>dirección</b>? (calle y número, o la zona)' },
      dir_ph:       { es: 'Ej. C/ Bravo Murillo 23, Madrid' },
      varios_preg:  { es: '¿<b>Dónde están</b> y cuántos son? Dime las direcciones o zonas.' },
      varios_ph:    { es: 'Ej. 2 pisos: Bravo Murillo 23 (Madrid) y Toledo centro' },
      // Textos internos del lead (van a Cabas). AHORA como plantillas:
      lead_resumen_uno:     { es: 'VALORACIÓN · 1 inmueble · {ccaa} · {dir}' },
      lead_resumen_varios:  { es: 'VALORACIÓN · Varios inmuebles · {dir}' },
      lead_contexto_uno:    { es: 'quiero valorar un inmueble situado en {ccaa} ({dir}).' },
      lead_contexto_varios: { es: 'quiero valorar varios inmuebles: {dir}.' }
    },

    // ---------- Flujo: Simular hipoteca ----------
    hipoteca: {
      intro:       { es: 'Te calculo la <b>cuota mensual</b> al momento.' },
      capital_preg:{ es: '¿Qué <b>importe</b> de hipoteca necesitas? (o el que estés valorando)' },
      capital_ph:  { es: 'Ej. 180000' },
      plazo_preg:  { es: '¿A cuántos <b>años</b>?' },
      tin_preg:    { es: '¿Qué <b>tipo de interés (TIN)</b> aplicamos? Si no lo sabes, un 3% es una referencia razonable hoy.' },
      tin_ph:      { es: 'Ej. 3 (o 3,2)' },

      // Tarjeta de resultado
      card_titulo: { es: '🏦 Tu hipoteca, estimada' },
      l_importe:   { es: 'Importe' },
      l_plazo:     { es: 'Plazo' },
      l_interes:   { es: 'Interés (TIN)' },
      l_titular:   { es: 'Titular de más edad' },
      l_intereses: { es: 'Intereses totales' },
      l_total_dev: { es: 'Total a devolver' },
      l_cuota:     { es: 'Cuota mensual' },
      disc:        { es: 'Sistema francés, cuota constante. No incluye comisiones, seguros ni productos vinculados. Las condiciones y la edad máxima dependen de cada banco.' },

      // Avisos: FRASES COMPLETAS con huecos (nunca trozos pegados)
      aviso_edad_ok:          { es: 'Con {edad} años, el plazo de {plazo} años entra dentro del criterio de edad habitual de las entidades.' },
      aviso_edad_supera:      { es: 'Con {edad} años, el criterio habitual "edad + plazo ≤ 75" deja un plazo máximo orientativo de {plazoMax} años, por debajo de los {plazo} indicados.' },
      aviso_edad_supera_cuota:{ es: 'A {plazoMax} años la cuota sería {cuotaMax}/mes.' },
      aviso_edad_cierre:      { es: 'Varía según la entidad.' },

      // Ingresos + tasa de esfuerzo (incluye otras deudas) — punto 7
      ingresos_preg:   { es: '¿Cuáles son los <b>ingresos netos mensuales</b> del hogar?' },
      ingresos_ph:     { es: 'Ej. 3000' },
      aviso_esf_ok:    { es: 'Tasa de esfuerzo {esf}% — cómoda (por debajo del 30%).' },
      aviso_esf_justa: { es: 'Tasa de esfuerzo {esf}% — justa (30-35%). Poco margen.' },
      aviso_esf_alta:  { es: 'Tasa de esfuerzo {esf}% — excesiva (>35%). La mayoría de bancos no la aprueban.' },
      aviso_esf_detalle: { es: 'Incluye tu cuota ({cuota}) + tus otras deudas ({deuda}) = {total}/mes sobre tus ingresos.' },

      // Textos internos del lead (a Cabas)
      lead_resumen:  { es: 'HIPOTECA · Importe {capital} · {plazo} años · TIN {tin}% · Titular {edad} años · Cuota {cuota}/mes' },
      lead_contexto: { es: 'quiero simular una hipoteca.' }
    },

    // ---------- Subflujo compartido: titulares y edad ----------
    titulares: {
      una_o_dos: { es: '¿La compra <b>una persona o dos</b>?' },
      opt_una:   { es: 'Una persona' },
      opt_dos:   { es: 'Dos personas' },
      edad_dos:  { es: '¿Qué <b>edad</b> tiene el titular de <b>más edad</b>?' },
      edad_una:  { es: '¿Qué <b>edad</b> tienes?' },
      edad_ph:   { es: 'Ej. 42' }
    },

    // ---------- Subflujo compartido: ofrecer contacto ----------
    contacto: {
      // En Telegram, los botones cuelgan de un mensaje: por eso aquí SÍ hay
      // una frase corta (en la web no hacía falta). Es texto NUEVO para Telegram.
      pregunta:  { es: '¿Quieres que <b>Cabas y su equipo</b> lo vean contigo?' },
      chip_lead: { es: '📲 Que me contacte Cabas' },
      chip_menu: { es: 'Calcular otra cosa' },
      chip_nada: { es: 'No necesito nada más' }
    },

    // ---------- Subflujo compartido: captación de lead (con RGPD) ----------
    lead: {
      // ===== PUERTA DE CONSENTIMIENTO — BORRADOR (revisar el gestor) =====
      // Elementos RGPD incluidos: responsable (Cabas), finalidad (llamarte
      // por tu consulta), datos (nombre + teléfono), sin otros usos (ni listas
      // ni publicidad), derecho de supresión (borrar cuando quieras) y enlace a
      // la política. El botón "Sí" es el consentimiento explícito.
      consent_texto: { es: 'Una cosa antes de seguir 🙂 Para que <b>Cabas o alguien de su equipo</b> te llame solo necesito <b>tu nombre y un teléfono</b>. Los usa <b>únicamente para contactarte por tu consulta</b> — nada de listas ni publicidad, y puedes pedirle que los borre cuando quieras. (Esta conversación es a través de <b>Telegram</b>.) Aquí puedes ver <a href="https://www.cabas.es/privacidad.html">cómo trata tus datos</a>. ¿Seguimos?' },
      consent_link:  { es: 'cómo trata tus datos' },
      consent_si:    { es: '✅ Sí, que me llame' },
      consent_no:    { es: 'Ahora no, gracias' },

      nombre_preg:   { es: 'Genial 🙂 ¿Cómo te llamas? Así sabemos cómo dirigirnos a ti.' },
      nombre_ph:     { es: 'Tu nombre' },
      tel_preg:      { es: 'Encantada, {nombre}. ¿A qué <b>teléfono</b> te viene bien que te contacte?' },
      tel_ph:        { es: 'Tu teléfono' },
      email_preg:    { es: '¿Quieres dejar también un <b>email</b>? (opcional)' },
      email_dar:     { es: '✉️ Dejar email' },
      email_sin:     { es: 'Sin email' },
      email_ph:      { es: 'tucorreo@ejemplo.com' },

      confirmacion:  { es: 'Perfecto, {nombre}. Le paso tu consulta y <b>Cabas o alguien de su equipo te contactarán en menos de 24 h laborables</b>. Si quieres hablar <b>antes</b>, escríbele por WhatsApp o llámale al <b>604 854 690</b>.' },
      btn_whatsapp:  { es: 'Enviar por WhatsApp' },
      btn_llamar:    { es: 'Llamar ahora' },
      privacidad_nota: { es: 'Tus datos solo se usan para que Cabas te contacte. <a href="https://www.cabas.es/privacidad.html">Política de privacidad</a>.' },
      privacidad_link: { es: 'Política de privacidad' },

      // ===== Salida cuando el cliente NO acepta — no se le echa =====
      no_consent:    { es: 'Sin problema 🙂 Puedes seguir usando las <b>calculadoras</b> todo lo que quieras, sin dejar ningún dato. Y si quieres hablar con Cabas, puedes <b>escribirle por WhatsApp</b> o <b>llamarle al 604 854 690</b> tú directamente cuando te venga bien.' },

      algo_mas:      { es: '¿Quieres calcular o consultar algo más?' },
      algo_si:       { es: 'Sí, otra cosa' },
      algo_no:       { es: 'No, gracias' },
      // Despedida: cierra la conversación (no reaparece el menú) + web + compartir.
      despedida:     { es: 'Espero haberte sido de ayuda 🙂 Si necesitas algo más, escribe <b>Hola</b> y te enseño el menú otra vez.\n\nMientras, en <b>www.cabas.es</b> tienes las <b>calculadoras</b> (vender, comprar, hipoteca e inversión) y los <b>informes de mercado</b> con la evolución de precios por zonas.\n\nY si Kitty te ha resultado útil, <b>compártela</b> con quien pueda necesitarla 🙌' }
    },

    // ---------- Flujo: Herencia ----------
    herencia: {
      intro:           { es: 'Gestionar una <b>herencia</b> con una vivienda de por medio es la especialidad de Cabas: valoración, acuerdo entre herederos y venta con seguridad jurídica. ¿En qué punto estás?' },
      opt_nuevo:       { es: 'Acabo de heredar' },
      opt_acuerdo:     { es: 'Todos los herederos estamos de acuerdo' },
      opt_dificil:     { es: 'Varios herederos con difícil acuerdo' },
      opt_vender:      { es: 'Tengo claro que quiero vender (con o sin acuerdo)' },
      opt_info:        { es: 'Solo quiero informarme' },
      // Reconocimiento empático según el punto (antes de las preguntas).
      ack_nuevo:       { es: 'Siento tu pérdida. Vamos con calma; te hago un par de preguntas para entender bien tu caso y ayudarte de verdad.' },
      ack_acuerdo:     { es: 'Qué bien que estéis alineados — eso lo hace todo mucho más fácil. Dame un par de datos y te digo cómo lo haría.' },
      ack_dificil:     { es: 'Tranquilo, es la situación más habitual y tiene solución. Cuéntame un poco más y te explico cómo desatascarla.' },
      ack_vender:      { es: 'Perfecto, vamos al grano. Un par de preguntas para darte la mejor salida.' },
      // Q2 · estado legal de la herencia.
      aceptada_preg:   { es: '¿La <b>herencia ya está aceptada</b> y a nombre de los herederos?' },
      acept_si:        { es: 'Sí, ya adjudicada' },
      acept_tramite:   { es: 'En trámite' },
      acept_no:        { es: 'Todavía no' },
      acept_nose:      { es: 'No lo sé' },
      // Q3 · quiénes forman la herencia.
      quienes_preg:    { es: '¿<b>Quiénes sois</b> en la herencia?' },
      qui_solo:        { es: 'Yo solo/a' },
      qui_hermanos:    { es: 'Varios hermanos o sobrinos' },
      qui_lejana:      { es: 'Familia lejana' },
      qui_dispares:    { es: 'Propietarios sin lazos familiares' },
      // Q4 · grado de acuerdo (solo si son varios).
      acuerdo_preg:    { es: '¿Os habéis puesto de <b>acuerdo sobre el/los inmueble/s</b>?' },
      ac_todos:        { es: 'Sí, todos queremos vender' },
      ac_falta:        { es: 'Falta convencer a alguno' },
      ac_bloquea:      { es: 'Hay quien bloquea o no responde' },
      ac_nohablado:    { es: 'Aún no lo hemos hablado' },
      ac_nohablamos:   { es: 'No hablamos entre nosotros (algunos o todos)' },
      // Q5 · ocupación de la vivienda.
      vive_preg:       { es: '¿Vive <b>alguien ahora</b> en la vivienda?' },
      vive_heredero:   { es: 'Sí, un heredero' },
      vive_alq:        { es: 'Está alquilada' },
      vive_nopaga:     { es: 'Sí, alguien que no paga' },
      vive_vacia:      { es: 'Está vacía' },
      // Bifurcación final: que le llame Cabas, o calcular el neto de la venta.
      via_preg:        { es: 'Con esto ya me hago una idea de tu caso. ¿Cómo prefieres que sigamos?' },
      via_llamar:      { es: '📞 Que me llame Cabas' },
      via_calc:        { es: '🧮 Calcular lo que me quedaría al vender' },
      // Cierre cálido → contacto (tras elegir "que me llame").
      cierre:          { es: 'Perfecto. Déjame tu teléfono y te llamo yo personalmente, sin compromiso, y te explico cómo lo haría contigo.' },
      resp_info:       { es: 'Perfecto. Cabas puede resolverte las dudas de herencia sin compromiso: plazos, impuestos (sucesiones y plusvalía) y qué conviene hacer con la vivienda. Déjame tu teléfono y te lo cuento.' },
      lead_resumen:    { es: 'HERENCIA · {detalle}' },
      lead_contexto:   { es: 'tengo una consulta sobre una herencia con una vivienda.' }
    },

    // ---------- Flujo: Hasta qué precio puedo comprar (capacidad) ----------
    capacidad: {
      intro:        { es: 'Te digo <b>hasta qué precio</b> podrías comprar según tus ingresos y ahorro. Es una estimación orientativa, <b>no vinculante</b>.' },
      ccaa_preg:    { es: '¿En qué <b>comunidad</b> quieres comprar?' },
      ahorro_preg:  { es: '¿Cuánto <b>ahorro</b> tienes disponible (para entrada + gastos)?' },
      ahorro_ph:    { es: 'Ej. 60000' },
      ingresos_preg:{ es: '¿Cuáles son los <b>ingresos netos mensuales</b> del hogar?' },
      ingresos_ph:  { es: 'Ej. 3000' },
      tin_preg:     { es: '¿Qué <b>tipo de interés (TIN)</b> estimamos para la hipoteca? Si no lo sabes, un 3% es una referencia razonable hoy.' },
      card_titulo:  { es: '📈 Hasta dónde puedes llegar' },
      l_ingresos:   { es: 'Ingresos del hogar' },
      l_ahorro:     { es: 'Ahorro disponible' },
      l_plazo_max:  { es: 'Plazo máximo (por edad)' },
      l_hip_max:    { es: 'Hipoteca máxima estimada' },
      l_cuota:      { es: 'Cuota a ese nivel' },
      l_precio_max: { es: 'Precio máximo de compra' },
      disc:         { es: 'Estimación orientativa y NO vinculante. Supone cuota ≤ 35% de ingresos, financiación hasta el 80% y el criterio habitual de edad. La concesión y las condiciones reales dependen de cada banco.' },
      aviso_max:    { es: 'Con estos datos podrías comprar una vivienda de hasta ~{maxPrecio} en {ccaa}.' },
      aviso_limita_ahorro:   { es: 'El límite aquí es el ahorro (hay que cubrir la entrada del 20% + gastos). Con más ahorro subiría el precio máximo.' },
      aviso_limita_ingresos: { es: 'El límite aquí son los ingresos (cuota ≤ 35%). Con más ingresos o más plazo subiría el importe.' },
      aviso_plazo:  { es: 'Plazo máximo estimado por edad (edad + plazo ≤ 75): {plazoMax} años.' },
      lead_resumen: { es: 'CAPACIDAD · {ccaa} · Ingresos {ingresos}/mes · Ahorro {ahorro} · Titular {edad} años · Hipoteca máx {hipMax} · Precio máx {precioMax}' },
      lead_contexto:{ es: 'quiero saber hasta qué precio de vivienda puedo llegar en {ccaa}.' }
    },

    // ---------- Etiquetas de RUTA (origen del lead al saltar entre flujos) ----------
    // ---------- Flujo: Hasta qué alquiler llego (alqmax) ----------
    alqmax: {
      intro:        { es: 'Te digo en un minuto a qué <b>alquiler</b> puedes optar con tu situación. Todo de memoria, sin buscar papeles.' },
      npag_preg:    { es: '¿Entre <b>cuántas personas</b> pagaréis el alquiler?' },
      npag_1:       { es: 'Solo yo' },
      npag_2:       { es: '2' },
      npag_3:       { es: '3' },
      npag_4:       { es: '4' },
      persona_hdr:  { es: '👤 <b>Persona {i} de {n}</b>' },
      ing_preg:     { es: '¿<b>Ingresos netos</b> al mes?' },
      ing_ph:       { es: 'Ej. 1800' },
      pagas_preg:   { es: '¿En <b>cuántas pagas</b> al año?' },
      pagas_12:     { es: '12' },
      pagas_14:     { es: '14' },
      pagas_otro:   { es: '✏️ Otro' },
      pagas_ph:     { es: 'Ej. 13' },
      sit_preg:     { es: '¿<b>Situación laboral</b>?' },
      sit_asal:     { es: 'Asalariado/a' },
      sit_func:     { es: 'Funcionario/a' },
      sit_auto:     { es: 'Autónomo/a' },
      sit_pens:     { es: 'Pensionista' },
      contrato_preg:{ es: '¿Qué tipo de <b>contrato</b>?' },
      contrato_ind: { es: 'Indefinido' },
      contrato_tmp: { es: 'Temporal' },
      antig_preg:   { es: '¿Cuánta <b>antigüedad</b> en el empleo?' },
      antig_1:      { es: 'Menos de 6 meses' },
      antig_2:      { es: '6 meses – 1 año' },
      antig_3:      { es: '1 – 2 años' },
      antig_4:      { es: 'Más de 2 años' },
      tipoaut_preg: { es: '¿Qué tipo de <b>autónomo</b>?' },
      tipoaut_ind:  { es: 'Individual' },
      tipoaut_soc:  { es: 'Societario' },
      tipoaut_cb:   { es: 'Com. de bienes / otra' },
      antigaut_preg:{ es: '¿Cuánta <b>antigüedad</b> como autónomo?' },
      antaut_1:     { es: 'Menos de 1 año' },
      antaut_2:     { es: '1 – 2 años' },
      antaut_3:     { es: 'Más de 2 años' },
      avalista_preg:{ es: 'Si el propietario lo pidiera, ¿{tendrias} un <b>avalista</b> (familiar con nómina o propiedad)?' },
      avalista_si:  { es: 'Sí' },
      avalista_no:  { es: 'No' },
      avalista_nose:{ es: 'No lo sé' },
      card_titulo:  { es: '🏠 Hasta qué alquiler podéis llegar' },
      l_horquilla:  { es: 'Alquiler razonable' },
      l_ingresos:   { es: 'Ingresos conjuntos (pagas prorrateadas)' },
      l_techo:      { es: 'Techo máximo (40%)' },
      l_pagadores:  { es: 'Nº de pagadores' },
      l_avalista:   { es: 'Avalista' },
      sem_verde:    { es: 'Vuestro perfil encaja bien con los criterios habituales de las compañías de garantía de alquiler.' },
      sem_verde_1:  { es: 'Tu perfil encaja bien con los criterios habituales de las compañías de garantía de alquiler.' },
      sem_ambar:    { es: 'Con perfiles más recientes (contrato temporal, poca antigüedad o autónomo de menos de 1 año), las compañías suelen pedir avalista o más recorrido; con avalista, resuelto.' },
      aviso_asnef:  { es: 'Las compañías consultan ficheros de morosidad (ASNEF, RAI, FIM); figurar en uno suele suponer la denegación.' },
      disc:         { es: 'Estimación orientativa según los criterios habituales de las compañías de garantía de alquiler (renta ≤ 30-40% de ingresos netos). No vinculante: la aprobación depende del estudio de cada compañía.' },
      garantia_txt: { es: '🛡️ ¿Quieres alquilar con ventaja? Te tramitamos <b>gratis</b> la pre-aprobación de una garantía de alquiler: una compañía especializada estudia tu solvencia y, si te aprueba, el propietario que te elija tiene el <b>cobro garantizado</b>. Vale para cualquier piso — con nosotros, con un particular o con otra agencia. En un piso con varios candidatos, el pre-aprobado suele llevárselo. Trabajamos con Finaer, Garantía Ya y Plus Services, y comparamos para conseguirte las mejores condiciones. El estudio no te cuesta nada; si luego la garantía se usa, quién la paga (propietario, inquilino o a medias) se pacta en cada operación.' },
      garantia_si:  { es: '🛡️ Me interesa' },
      garantia_no:  { es: 'Ahora no' },
      buscar_txt:   { es: '¿Quieres que además <b>busquemos contigo</b>? Tenemos pisos en Chamberí, Malasaña y Chamartín.' },
      buscar_si:    { es: '🔎 Sí, busquemos' },
      buscar_no:    { es: 'Ahora no' },
      contacto_preg:{ es: '¿Quieres que <b>Cabas te contacte</b> para ayudarte con el alquiler?' },
      contacto_si:  { es: '✍️ Sí, que me contacte' },
      contacto_no:  { es: 'No, gracias' },
      lead_resumen: { es: 'ALQUILER-CAPACIDAD · {bloque}' },
      lead_contexto:{ es: 'he calculado a qué alquiler puedo optar y quiero que me ayudéis.' }
    },

    rutas: {
      valorar:   { es: 'VALORACIÓN' },
      herencia:  { es: 'HERENCIA' },
      vender:    { es: 'VENTA' },
      comprar:   { es: 'COMPRA' },
      hipoteca:  { es: 'HIPOTECA' },
      capacidad: { es: 'CAPACIDAD' },
      inversion: { es: 'INVERSIÓN' },
      alqmax:    { es: 'ALQUILER-CAPACIDAD' }
    },

    // ---------- Subflujo compartido: honorarios de intermediación ----------
    honorarios: {
      no:        { es: 'No hay' },
      fijo:      { es: 'Sí, importe fijo' },
      pct:       { es: 'Sí, un % del precio' },
      fijo_preg: { es: '¿Qué <b>importe</b> de honorarios?' },
      fijo_ph:   { es: 'Ej. 6000' },
      pct_preg:  { es: '¿Qué <b>porcentaje</b> sobre el precio? (ej. 3)' },
      pct_ph:    { es: 'Ej. 3' },
      iva_preg:  { es: '¿Ese porcentaje <b>lleva el IVA (21%) incluido</b>?' },
      iva_si:    { es: 'Sí, IVA incluido' },
      iva_no:    { es: 'No, súmalo' }
    },

    // ---------- Flujo: Cuánto cuesta comprar ----------
    comprar: {
      intro:        { es: 'Te calculo <b>todo el coste real</b> de comprar: honorarios, impuestos, notaría, registro, gestoría… y la hipoteca si la necesitas.' },
      precio_preg:  { es: '¿Cuál es el <b>precio</b> de la vivienda?' },
      precio_ph:    { es: 'Ej. 250000' },
      hon_preg:     { es: '¿Hay <b>honorarios de intermediación a tu cargo</b> como comprador? (no siempre los hay)' },
      ccaa_preg:    { es: '¿En qué <b>comunidad</b> está? Los impuestos cambian según la zona.' },
      viv_preg:     { es: '¿Es vivienda <b>usada</b> o de <b>obra nueva</b>?' },
      hip_preg:     { es: '¿Vas a pedir <b>hipoteca</b> o comprar al contado?' },
      ahorro_preg:  { es: '¿Cuánto <b>ahorro</b> vas a aportar (entrada + gastos)?' },
      ahorro_ph:    { es: 'Ej. 70000' },
      plazo_preg:   { es: '¿A cuántos <b>años</b> la hipoteca?' },
      tin_preg:     { es: '¿Qué <b>TIN</b>? (un 3% es referencia razonable si no lo sabes)' },
      tin_ph:       { es: 'Ej. 3' },
      ingresos_preg:{ es: '¿Cuáles son los <b>ingresos netos mensuales</b> del hogar?' },
      ingresos_ph:  { es: 'Ej. 3000' },
      card_titulo:  { es: '🔑 Coste de tu compra' },
      l_precio:     { es: 'Precio' },
      l_notaria:    { es: 'Notaría (est.)' },
      l_registro:   { es: 'Registro (est.)' },
      l_gestoria:   { es: 'Gestoría (est.)' },
      l_tasacion:   { es: 'Tasación (est.)' },
      l_honorarios_hip: { es: 'Honorarios (no los financia el banco)' },
      l_honorarios: { es: 'Honorarios de intermediación' },
      l_hipoteca:   { es: 'Hipoteca necesaria' },
      l_cuota:      { es: 'Cuota mensual' },
      l_ltv:        { es: 'Financiación (LTV)' },
      l_total:      { es: 'Coste total de la operación' },
      disc:         { es: 'Notaría, registro y gestoría son estimaciones habituales según el precio. Cuando hay honorarios de intermediación a cargo del comprador, el banco no los financia. No es asesoramiento fiscal.' },
      lead_resumen_hip:     { es: 'COMPRA · {precio} · {ccaa} · {tipoViv} · Honorarios {hon} · Coste total {coste} · Hipoteca {hipoteca} · Cuota {cuota}/mes · LTV {ltv}% · titular {edad} años' },
      lead_resumen_contado: { es: 'COMPRA · {precio} · {ccaa} · {tipoViv} · Honorarios {hon} · Coste total {coste} · al contado' },
      lead_contexto:{ es: 'estoy mirando comprar una vivienda de {precio} en {ccaa}.' }
    },

    // ---------- Flujo: Lo que me queda si vendo ----------
    vender: {
      intro:        { es: 'Te calculo <b>lo que te queda limpio</b> tras vender, después de impuestos.' },
      venta_preg:   { es: '¿En cuánto vas a <b>vender</b> (o esperas vender)?' },
      venta_ph:     { es: 'Ej. 320000' },
      fventa_preg:  { es: '¿Para <b>cuándo</b> prevés vender? Si es una simulación, pon una fecha estimada. Escríbela como <b>día/mes/año</b> (o escribe <i>hoy</i>).' },
      fventa_ph:    { es: 'Ej. 30/06/2026 · o "hoy"' },
      adq_intro:    { es: 'Ahora, cómo <b>adquiriste</b> la vivienda (hace falta para calcular la ganancia). Si fue de una sola vez, son tres datos y listo.' },
      modo_preg:    { es: '¿La adquiriste <b>de una vez</b>, o en <b>varias veces</b>? (por ejemplo una herencia, o comprando partes en distintos momentos)' },
      modo_una:     { es: 'De una vez' },
      modo_varias:  { es: 'En varias veces' },
      una_valor_preg:{ es: '¿Por cuánto la <b>compraste o adquiriste</b>? (si fue heredada, el valor que se declaró)' },
      una_valor_ph: { es: 'Ej. 210000' },
      fecha_adq_preg:{ es: '¿<b>Cuándo</b> la compraste o adquiriste? La fecha exacta cuenta para la plusvalía: ponla como <b>día/mes/año</b>.' },
      fecha_ph:     { es: 'Ej. 30/09/2011' },
      una_gastos_preg:{ es: '¿Qué <b>gastos deducibles</b> tuviste al adquirirla (impuestos, notaría, registro)? Pon 0 si no lo sabes.' },
      una_gastos_ph:{ es: 'Ej. 8000' },
      varias_intro: { es: 'Vale, vamos una a una (hasta 3). De cada una necesito valor, año, gastos y qué % adquiriste. <b>Puedes calcular en cualquier momento</b> con las que lleves metidas.' },
      adq_valor_preg:{ es: '<b>Adquisición {i}</b> · ¿por cuánto valor?' },
      adq_valor_ph: { es: 'Ej. 105000' },
      adq_fecha_preg:{ es: 'Adquisición {i} · ¿en qué <b>fecha</b>? (día/mes/año)' },
      adq_gastos_preg:{ es: 'Adquisición {i} · ¿gastos deducibles (impuestos, notaría, registro)? Pon 0 si no.' },
      adq_gastos_ph:{ es: 'Ej. 4000' },
      adq_pct_preg: { es: 'Adquisición {i} · ¿qué <b>% de la vivienda</b> adquiriste aquí? (ej. 50)' },
      adq_pct_ph:   { es: 'Ej. 50' },
      mas_preg:     { es: '¿Añades otra adquisición o calculamos ya?' },
      mas_si:       { es: 'Añadir otra' },
      mas_no:       { es: 'Calcular ya con estas' },
      gventa_preg:  { es: '¿Qué <b>gastos tienes en la venta</b> (honorarios de agencia, derramas, certificados, cancelación de hipoteca…)? Pon 0 si ninguno.' },
      gventa_ph:    { es: 'Ej. 9000' },
      habitual_preg:{ es: '¿Es (o era) tu <b>vivienda habitual</b>?' },
      m65_preg:     { es: '¿Tienes <b>más de 65 años</b>? En ese caso la ganancia está exenta de IRPF.' },
      m65_si:       { es: 'Sí, más de 65' },
      reinv_preg:   { es: '¿Vas a <b>reinvertir</b> todo lo obtenido en otra vivienda habitual?' },
      reinv_si:     { es: 'Sí, reinvierto' },
      afinar_preg:  { es: '¿Quieres <b>afinar con la plusvalía municipal</b>? Necesito 2 datos que salen en el recibo del IBI.' },
      afinar_si:    { es: 'Sí, afinar' },
      afinar_no:    { es: 'Solo la estimación' },
      vc_total_preg:{ es: '¿<b>Valor catastral total</b> del recibo del IBI?' },
      vc_total_ph:  { es: 'Ej. 90000' },
      vc_suelo_preg:{ es: '¿Y el <b>valor catastral del suelo</b>? (viene desglosado en el mismo recibo)' },
      vc_suelo_ph:  { es: 'Ej. 45000' },
      ccaa_preg:    { es: '¿En qué <b>comunidad</b> está la vivienda?' },
      card_titulo:  { es: '💶 Lo que te queda tras vender' },
      l_venta:      { es: 'Precio de venta' },
      l_gastos_venta:{ es: 'Gastos de la venta' },
      l_adquisicion:{ es: 'Valor de adquisición' },
      l_plusvalia:  { es: 'Plusvalía municipal' },
      l_plusvalia_no:{ es: 'Plusvalía municipal (no incluida)' },
      l_ganancia:   { es: 'Ganancia (IRPF)' },
      l_irpf:       { es: 'IRPF sobre la ganancia' },
      l_neto:       { es: 'Neto estimado para ti' },
      val_exenta:   { es: 'Exenta' },
      val_exento:   { es: 'Exento' },
      disc:         { es: 'Plusvalía con coeficientes máximos estatales (RDL 8/2023) y tipo estimado del municipio. IRPF sobre la base del ahorro (19-30%). Estimación orientativa, no asesoramiento fiscal. Cálculo para personas físicas; no contempla ventas a través de sociedad.' },
      lead_resumen: { es: 'VENTA · Venta {venta} · Adquisición {adq} · Gastos venta {gventa} · Plusvalía {plusvalia} · IRPF {irpf} · Neto {neto}' },
      lead_contexto:{ es: 'quiero saber lo que me quedaría al vender mi vivienda.' }
    },

    // ---------- Flujo: Rentabilidad de inversión (alquiler / flipping) ----------
    inversion: {
      intro:         { es: 'Te calculo la <b>rentabilidad</b> de la inversión. ¿Qué estrategia?' },
      modo_alquiler: { es: '🏠 Comprar y alquilar' },
      modo_flipping: { es: '🔨 Reformar y vender' },
      precio_preg:   { es: '¿<b>Precio de compra</b>?' },
      precio_ph:     { es: 'Ej. 200000' },
      viv_preg:      { es: '¿Tipo de vivienda?' },
      ccaa_preg:     { es: '¿En qué <b>comunidad</b> está?' },
      hon_compra_preg:{ es: '¿Hay <b>honorarios de intermediación</b> por la compra? (no siempre los hay)' },
      reforma_preg:  { es: '¿Cuánto tendrías que <b>gastar en reforma o puesta a punto</b>? (si no hace falta, pon 0)' },
      reforma_ph:    { es: 'Ej. 15000' },
      renta_preg:    { es: '¿<b>Renta mensual</b> que esperas cobrar?' },
      renta_ph:      { es: 'Ej. 950' },
      gastos_preg:   { es: '¿<b>Gastos anuales</b> aproximados? Suma IBI, comunidad, seguros y mantenimiento.' },
      gastos_ph:     { es: 'Ej. 2000' },
      hip_preg:      { es: '¿Vas a <b>financiar con hipoteca</b>?' },
      entrada_preg:  { es: '¿Cuánto pones de <b>entrada</b>?' },
      entrada_ph:    { es: 'Ej. 40000' },
      entrada_ph_fl: { es: 'Ej. 60000' },
      plazo_preg:    { es: '¿A cuántos <b>años</b>?' },
      tin_preg:      { es: '¿<b>TIN</b>? Si no lo sabes, un 3% es referencia.' },
      tin_ph:        { es: 'Ej. 3' },
      meses_preg:    { es: '¿En cuántos <b>meses</b> harías toda la operación (compra, obra y venta)?' },
      meses_ph:      { es: 'Ej. 8' },
      tenencia_preg: { es: '¿<b>Gastos de tenencia</b> al mes durante la obra? (IBI, comunidad, suministros, seguro). Si no, 0.' },
      tenencia_ph:   { es: 'Ej. 150' },
      venta_preg:    { es: '¿A qué <b>precio</b> esperas venderla?' },
      venta_ph:      { es: 'Ej. 290000' },
      hon_venta_preg:{ es: '¿<b>Comisión / honorarios de venta</b>? (intermediación al vender; si no, ninguno)' },
      tin_preg_fl:   { es: '¿<b>TIN</b>? Si no lo sabes, un 4% es referencia.' },
      tin_ph_fl:     { es: 'Ej. 4' },
      gfin_preg:     { es: '¿<b>Gastos financieros</b> (apertura, tasación, cancelación)? Si no, 0.' },
      gfin_ph:       { es: 'Ej. 3000' },
      card_titulo_alq:{ es: '📊 Rentabilidad del alquiler' },
      l_inversion:   { es: 'Inversión total' },
      l_noi:         { es: 'Ingreso neto al año' },
      l_rentbruta:   { es: 'Rentabilidad bruta' },
      l_cuota_hip:   { es: 'Cuota hipoteca' },
      l_flujo:       { es: 'Flujo de caja' },
      l_coc:         { es: 'Rentab. sobre tu capital' },
      l_rentneta:    { es: 'Rentabilidad neta' },
      disc_alq:      { es: 'Estimación orientativa. La rentabilidad neta no descuenta el IRPF del alquiler, que depende de tu declaración. Cálculo para personas físicas; no contempla operaciones a través de sociedad.' },
      card_titulo_fl:{ es: '🔨 Comprar, reformar y vender' },
      l_venta_fl:    { es: 'Precio de venta' },
      l_roi:         { es: 'ROI sobre tu capital' },
      l_margen:      { es: 'Margen sobre la venta' },
      l_roi_anual:   { es: 'ROI anualizado' },
      l_beneficio:   { es: 'Beneficio (antes de impuestos)' },
      disc_fl:       { es: 'Estimación orientativa. El beneficio es antes de impuestos: la tributación depende de si la operación es puntual o habitual. Cálculo para personas físicas; no contempla operaciones a través de sociedad.' },
      lead_resumen_alq_hip:     { es: 'INVERSIÓN·ALQUILER · Compra {precio} {ccaa} · Renta {renta}/mes · Rent. neta {rentneta} · Cash-on-cash {coc} · Flujo {flujo}/mes' },
      lead_resumen_alq_contado: { es: 'INVERSIÓN·ALQUILER · Compra {precio} {ccaa} · Renta {renta}/mes · Rent. neta {rentneta}' },
      lead_resumen_fl:          { es: 'INVERSIÓN·FLIPPING · Compra {precio} + reforma {reforma} {ccaa} · Venta {venta} · Beneficio {beneficio} · ROI {roi} · Margen {margen}' },
      lead_contexto_alq: { es: 'estoy analizando comprar para alquilar una vivienda de {precio} en {ccaa}.' },
      lead_contexto_fl:  { es: 'estoy analizando una operación de comprar, reformar y vender (compra {precio} en {ccaa}).' }
    }

  };

  if (typeof module !== 'undefined' && module.exports) module.exports = { TEXTOS: TEXTOS };
  else raiz.TEXTOS = TEXTOS;

})(typeof globalThis !== 'undefined' ? globalThis : this);
