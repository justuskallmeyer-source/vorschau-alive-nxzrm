/* Menü auf kleinen Bildschirmen, YouTube erst nach Klick, heutiger Tag in den Sprechzeiten. */
(() => {
  const kopf = document.querySelector('[data-kopf]');
  const toggle = kopf && kopf.querySelector('[data-toggle]');
  if (toggle) {
    const set = open => { kopf.classList.toggle('is-open', open); toggle.setAttribute('aria-expanded', open); };
    toggle.addEventListener('click', () => set(!kopf.classList.contains('is-open')));
    kopf.querySelectorAll('.kopf-nav a').forEach(a => a.addEventListener('click', () => set(false)));
    addEventListener('keydown', e => { if (e.key === 'Escape') set(false); });
  }

  // Videos: Vorschaubild liegt lokal, die Verbindung zu YouTube (nocookie) entsteht erst beim Klick
  document.querySelectorAll('[data-yt]').forEach(btn => btn.addEventListener('click', () => {
    const titel = btn.querySelector('.video-titel').textContent;
    const box = document.createElement('div');
    box.className = 'video';
    box.innerHTML = `<div class="video-frame"><iframe src="https://www.youtube-nocookie.com/embed/${btn.dataset.yt}?autoplay=1&rel=0" title="${titel}" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe></div><span class="video-titel">${titel}</span>`;
    box.style.cursor = 'default';
    box.classList.add('is-playing');
    btn.replaceWith(box);
  }));

  // Sprechzeiten: heutigen Tag markieren
  const heute = new Date().getDay();
  document.querySelectorAll('[data-tage]').forEach(row => {
    if (row.dataset.tage.split(',').map(Number).includes(heute)) row.classList.add('is-heute');
  });
})();
