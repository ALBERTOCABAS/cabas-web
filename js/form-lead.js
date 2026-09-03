/* form-lead.js — envía los formularios estáticos de lead al Worker (/lead-web).
   Misma tubería que Kitty: D1 primero, aviso Telegram + email best-effort.
   La clave de Web3Forms vive como secreto del Worker; NUNCA viaja en el HTML.
   Un formulario se activa marcándolo con class="form-lead-js" y data-flujo="<nombre>".
   Campos leídos por name: nombre, telefono, email, mensaje (opcional), resumen (opcional). */
(function () {
  'use strict';
  var ENDPOINT = 'https://cabas-bot.alberto-f06.workers.dev/lead-web';

  function val(form, name) {
    var el = form.elements[name];
    return el && el.value != null ? String(el.value).trim() : '';
  }

  function enviar(payload, onOk, onFail) {
    var intentos = 0;
    (function mandar() {
      fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }).then(function (r) {
        if (!r.ok) throw new Error('http ' + r.status);
        onOk();
      }).catch(function () {
        if (++intentos < 3) setTimeout(mandar, 1500 * intentos);
        else onFail();
      });
    })();
  }

  function conectar(form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      // La validación nativa (required, type=email) ya ha pasado en este punto.
      var btn = form.querySelector('button[type="submit"], button:not([type])');
      var textoBtn = btn ? btn.textContent : '';
      var payload = {
        nombre: val(form, 'nombre'),
        telefono: val(form, 'telefono'),
        email: val(form, 'email'),
        contexto: val(form, 'mensaje') || (form.getAttribute('data-contexto') || ''),
        resumen: val(form, 'resumen'),
        pagina: location.href,
        flujo: form.getAttribute('data-flujo') || 'web',
        fecha: new Date().toISOString().slice(0, 10),
        k_extra: val(form, 'k_extra')   // honeypot: vacío en humanos
      };
      if (btn) { btn.disabled = true; btn.textContent = 'Enviando…'; }

      var lanzar = function () { enviar(payload, exito, fallo); };
      // Turnstile (si está activo) añade el token antes de enviar; si no, envía directo.
      if (window.CabasTurnstile && window.CabasTurnstile.activo()) {
        window.CabasTurnstile.getToken().then(function (tok) { payload['cf-turnstile-response'] = tok; lanzar(); });
      } else { lanzar(); }

      function exito() {
        // Éxito: sustituir el formulario por un aviso de confirmación.
        var ok = document.createElement('div');
        ok.className = 'form-lead-ok';
        ok.setAttribute('role', 'status');
        ok.style.cssText = 'padding:1.4rem;border-radius:12px;background:rgba(198,160,74,.14);border:1px solid rgba(198,160,74,.45);text-align:center;color:var(--hueso)';
        ok.innerHTML = '<p style="margin:0;font-weight:600;color:var(--oro-claro)">✅ ¡Recibido! Gracias, ' +
          (payload.nombre ? payload.nombre.replace(/[<>&]/g, '') : '') +
          '.</p><p style="margin:.4rem 0 0;color:var(--hueso)">Te contactaré personalmente lo antes posible.</p>';
        form.parentNode.replaceChild(ok, form);
      }

      function fallo() {
        // Fallo tras 3 intentos: dejar el formulario y ofrecer vías directas.
        if (btn) { btn.disabled = false; btn.textContent = textoBtn; }
        var err = form.querySelector('.form-lead-err');
        if (!err) {
          err = document.createElement('p');
          err.className = 'form-lead-err';
          err.setAttribute('role', 'alert');
          err.style.cssText = 'margin:.8rem 0 0;color:#b00;font-size:.9rem';
          err.innerHTML = 'No se pudo enviar ahora mismo. Escríbeme a ' +
            '<a href="mailto:alberto@cabas.es">alberto@cabas.es</a> o por ' +
            '<a href="https://wa.me/34604854690" target="_blank" rel="noopener">WhatsApp</a>.';
          form.appendChild(err);
        }
      }
    });
  }

  function init() {
    var forms = document.querySelectorAll('form.form-lead-js');
    for (var i = 0; i < forms.length; i++) conectar(forms[i]);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
