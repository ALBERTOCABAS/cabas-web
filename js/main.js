// CABAS REALTOR — utilidades compartidas

// Menú móvil
const toggle = document.querySelector('.nav-toggle');
const links = document.querySelector('.nav-links');
if (toggle && links) {
  toggle.addEventListener('click', () => {
    const open = links.classList.toggle('open');
    toggle.setAttribute('aria-expanded', open);
  });
}

// Animación de aparición al hacer scroll
const io = new IntersectionObserver((entries) => {
  entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
}, { threshold: 0.12 });
document.querySelectorAll('.reveal').forEach(el => io.observe(el));

// Formato de moneda (compartido por las calculadoras)
// Separador de miles SIEMPRE (el formato es-ES nativo no lo pone en cifras de 4 dígitos)
function _miles(entero) {
  return entero.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}
function eur(n) {
  const neg = n < 0 ? '−' : '';
  return neg + _miles(String(Math.round(Math.abs(n)))) + '\u00A0€';
}
function eur2(n) {
  const neg = n < 0 ? '−' : '';
  const abs = Math.abs(n).toFixed(2);
  const [ent, dec] = abs.split('.');
  return neg + _miles(ent) + ',' + dec + '\u00A0€';
}
function num(id) {
  const v = parseFloat(document.getElementById(id)?.value);
  return isNaN(v) ? 0 : v;
}
