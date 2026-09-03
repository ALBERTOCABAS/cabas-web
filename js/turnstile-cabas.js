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

  var widgetId = null, cargando = false, pending = null;

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
      return new Promise(function (resolve) {
        if (!SITEKEY) { resolve(''); return; }
        // Nunca bloquear el envío legítimo: si Turnstile tarda, se envía sin token
        // (y si el Worker exige token, reintentará; el usuario siempre tiene WhatsApp/email).
        var guard = setTimeout(function () { resolverPending(''); }, 7000);
        var done = function (t) { clearTimeout(guard); resolve(t); };
        // Encadena: si hay una petición previa sin resolver, la cerramos con ''.
        resolverPending('');
        pending = done;
        asegurarWidget(function (ok) {
          if (!ok) { resolverPending(''); return; }
          try { window.turnstile.reset(widgetId); } catch (e) {}
          try { window.turnstile.execute(widgetId); }
          catch (e) { resolverPending(''); }
        });
      });
    }
  };
})();
