/* Menü auf kleinen Bildschirmen, heutiger Tag in den Sprechzeiten. */
(() => {
  const kopf = document.querySelector('[data-kopf]');
  const toggle = kopf && kopf.querySelector('[data-toggle]');
  if (toggle) {
    const set = open => { kopf.classList.toggle('is-open', open); toggle.setAttribute('aria-expanded', open); };
    toggle.addEventListener('click', () => set(!kopf.classList.contains('is-open')));
    kopf.querySelectorAll('.kopf-nav a').forEach(a => a.addEventListener('click', () => set(false)));
    addEventListener('keydown', e => { if (e.key === 'Escape') set(false); });
  }

  // Sprechzeiten: heutigen Tag markieren
  const heute = new Date().getDay();
  document.querySelectorAll('[data-tage]').forEach(row => {
    if (row.dataset.tage.split(',').map(Number).includes(heute)) row.classList.add('is-heute');
  });
})();
