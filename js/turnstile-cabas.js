/* turnstile-cabas.js — Cloudflare Turnstile invisible, compartido por los
   formularios estáticos (form-lead.js) y el widget de Kitty (cabas-chatbot.js).
   Expone window.CabasTurnstile.getToken() → Promise<string> (token o '').

   ROLLOUT: mientras SITEKEY esté vacío, getToken() resuelve '' al instante y NO
   carga nada (coste cero). Cuando Alberto cree el widget de Turnstile en
   Cloudflare, pega aquí la CLAVE DE SITIO (pública) y el Worker exigirá el token
   en cuanto se ponga el secreto TURNSTILE_SECRET. Ambos extremos se activan solos. */
(function () {
  'use strict';
  var SITEKEY = '0x4AAAAAAEmFmAgbSUhAvb9_';   // clave de sitio pública de Cloudflare Turnstile

  var widgetId = null, cargando = false, pending = null, enCurso = null, yaEjecutado = false;

  function resolverPending(t) {
    if (pending) { var r = pending; pending = null; r(t || ''); }
  }
  function cargarScript(cb) {
    if (window.turnstile && window.turnstile.render) { cb(true); return; }
    if (cargando) {
      var iv = setInterval(function () {
        if (window.turnstile && window.turnstile.render) { clearInterval(iv); cb(true); }
      }, 100);
      setTimeout(function () { clearInterval(iv); if (!(window.turnstile && window.turnstile.render)) cb(false); }, 8000);
      return;
    }
    cargando = true;
    var s = document.createElement('script');
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    s.async = true; s.defer = true;
    s.onload = function () { cb(!!(window.turnstile && window.turnstile.render)); };
    s.onerror = function () { cb(false); };
    document.head.appendChild(s);
  }
  function asegurarWidget(cb) {
    if (widgetId !== null) { cb(true); return; }
    cargarScript(function (ok) {
      if (!ok) { cb(false); return; }
      var cont = document.createElement('div');
      cont.style.cssText = 'position:absolute;left:-9999px;top:-9999px;width:0;height:0;overflow:hidden';
      document.body.appendChild(cont);
      try {
        widgetId = window.turnstile.render(cont, {
          sitekey: SITEKEY,
          size: 'invisible',
          callback: function (t) { resolverPending(t); },
          'error-callback': function () { resolverPending(''); return true; },
          'timeout-callback': function () { resolverPending(''); }
        });
        cb(widgetId !== null && widgetId !== undefined);
      } catch (e) { cb(false); }
    });
  }

  window.CabasTurnstile = {
    activo: function () { return !!SITEKEY; },
    getToken: function () {
      if (!SITEKEY) return Promise.resolve('');
      if (enCurso) return enCurso;   // single-flight: reutiliza la verificación en vuelo
      enCurso = new Promise(function (resolve) {
        var settled = false;
        // Guard amplio (Turnstile invisible suele tardar <3 s; damos margen de sobra).
        // Si falla/tarda, resolvemos '' y el formulario ofrece WhatsApp/email como salida.
        var guard = setTimeout(function () { finish(''); }, 12000);
        function finish(t) { if (!settled) { settled = true; enCurso = null; clearTimeout(guard); resolve(t || ''); } }
        pending = finish;   // lo llaman los callbacks de render()
        asegurarWidget(function (ok) {
          if (!ok) { finish(''); return; }
          try {
            if (yaEjecutado) window.turnstile.reset(widgetId);   // limpia el token previo (no en el 1º)
            window.turnstile.execute(widgetId);
            yaEjecutado = true;
          } catch (e) { finish(''); }
        });
      });
      return enCurso;
    }
  };
})();
