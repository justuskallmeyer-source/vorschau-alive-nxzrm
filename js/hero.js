/* Scroll-Hero: Ein Mann steht gebeugt auf einer Wiese vor der Frankfurter Skyline, richtet sich beim Scrollen auf
   und reißt die Arme hoch wie die Figur im Logo. Bildfolge aus dem Higgsfield-Video (tools/build_frames.py).
   GSAP ScrollTrigger hält den Hero fest (pin), bis die Bewegung durch ist und das Endbild kurz gestanden hat.
   Die Darstellung ist eine reine Funktion des Scrollfortschritts, kein Abfangen von Mausrad oder Wischen.
   Quer ("d"): ganzes Bild. Tablet hochkant ("t"): Querbild unten bündig. Handy ("m"): Ausschnitt um den Mann (1080 x 1406),
   unten bündig. Über dem Bild wird der Himmel aus der obersten Bildzeile verlängert, dort steht der Text. */
(() => {
  const hero = document.querySelector('[data-hero]');
  if (!hero) return;
  const N = +hero.dataset.n || 1;
  const NM = +hero.dataset.nm || N;
  const BASE = 'frames';
  const F_END = 0.82;                              // danach steht das Endbild
  const portraitMQ = matchMedia('(max-aspect-ratio: 11/10), (max-width: 759px)');
  const phoneMQ = matchMedia('(max-aspect-ratio: 5/8)');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const stage = hero.querySelector('.hero-stage');
  const canvas = hero.querySelector('[data-canvas]');
  const poster = hero.querySelector('[data-poster]');
  const ctx = canvas.getContext('2d');

  const pickMode = () => (!portraitMQ.matches ? 'd' : phoneMQ.matches ? 'm' : 't');
  let mode = pickMode();
  const count = () => (mode === 'm' ? NM : N);
  const src = (m, i) => `${BASE}/${m === 't' ? 'd' : m}/f_${String(i + 1).padStart(3, '0')}.webp`;
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));

  poster.src = src(mode, reduced ? count() - 1 : 0);

  let frames = [], loadToken = 0;
  function load() {
    const token = ++loadToken, n = count();
    frames = new Array(n);
    const order = [0, n - 1];                      // erst grob (jedes 8. Bild), dann immer dichter
    for (const s of [8, 4, 2, 1]) for (let i = 0; i < n; i += s) if (!order.includes(i)) order.push(i);
    let next = 0;
    const pump = () => {
      if (token !== loadToken || next >= order.length) return;
      const i = order[next++], img = new Image();
      img.decoding = 'async';
      let tries = 0;
      img.onload = () => {
        if (token !== loadToken) return;
        frames[i] = img;
        if (i === 0 || (reduced && i === n - 1)) { hero.classList.add('is-ready'); resize(); }
        dirty = true; pump();
      };
      img.onerror = () => { if (token === loadToken && ++tries < 3) setTimeout(() => { img.src = src(mode, i) + '?r=' + tries; }, 400 * tries); else pump(); };
      img.src = src(mode, i);
    };
    for (let k = 0; k < 6; k++) pump();
  }

  let cw = 0, ch = 0, dpr = 1, lastKey = '', dirty = true, prog = reduced ? 1 : 0;
  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    cw = stage.clientWidth; ch = stage.clientHeight;
    canvas.width = Math.round(cw * dpr); canvas.height = Math.round(ch * dpr);
    lastKey = ''; dirty = true;
  }
  function nearest(i) {
    if (frames[i]) return frames[i];
    for (let d = 1; d < frames.length; d++) { if (frames[i - d]) return frames[i - d]; if (frames[i + d]) return frames[i + d]; }
    return null;
  }

  function paint(img, dx, dy, dw, dh) {
    ctx.drawImage(img, dx, dy, dw, dh);
    if (dy > 0) ctx.drawImage(img, 0, 0, img.naturalWidth, 2, dx, 0, dw, dy + 1);   // Himmel nach oben verlängern
  }

  function draw() {
    const f = clamp(prog / F_END);
    const n = count(), fi = f * (n - 1);
    // nächstliegendes Bild, keine Überblendung (die schnelle Armbewegung gäbe sonst Doppelkonturen)
    const i0 = Math.round(fi);
    const a = nearest(i0);
    if (!a || !cw) return;
    const iw = a.naturalWidth, ih = a.naturalHeight;
    // Quer: bildschirmfüllend, links eher beschneiden (Mann steht rechts, Text links im Himmel).
    // Tablet hochkant: Querbild mindestens 50 % der Höhe, unten bündig, Mann im Bild.
    // Handy: Ausschnitt in voller Breite, mindestens 70 % der Höhe, unten bündig.
    const s = mode === 'd' ? Math.max(cw / iw, ch / ih) : Math.max(cw / iw, ch * (mode === 't' ? 0.5 : 0.7) / ih);
    const dw = iw * s, dh = ih * s;
    const dx = (cw - dw) * (mode === 'm' ? 0.5 : 0.75);
    const dy = mode === 'd' ? (ch - dh) * 0.6 : ch - dh;
    const key = i0 + '|' + cw + 'x' + ch + '|' + (a === frames[i0]);
    if (key === lastKey) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    paint(a, dx, dy, dw, dh);
    lastKey = key;
  }

  function render() { if (dirty) { draw(); dirty = false; } requestAnimationFrame(render); }

  addEventListener('resize', resize, { passive: true });
  const onMode = () => {
    if (pickMode() === mode) return;
    const was = mode === 'm' ? 'm' : 'd';
    mode = pickMode();
    if ((mode === 'm' ? 'm' : 'd') === was) { lastKey = ''; dirty = true; return; }
    poster.src = src(mode, reduced ? count() - 1 : 0);
    hero.classList.remove('is-ready');
    lastKey = ''; load(); resize();
  };
  portraitMQ.addEventListener('change', onMode);
  phoneMQ.addEventListener('change', onMode);
  load(); resize(); requestAnimationFrame(render);
  if (reduced) return;

  // Pin + Fortschritt über GSAP ScrollTrigger (ohne Bibliothek: Fortschritt aus der Scrollposition, ohne Pin)
  const start = () => {
    const gsap = window.gsap, ST = window.ScrollTrigger;
    if (!gsap || !ST) {
      const upd = () => { prog = clamp(scrollY / innerHeight); dirty = true; };
      addEventListener('scroll', upd, { passive: true }); upd();
      return;
    }
    gsap.registerPlugin(ST);
    const state = { p: 0 };
    gsap.to(state, {
      p: 1, ease: 'none',
      onUpdate: () => { prog = state.p; dirty = true; },
      scrollTrigger: {
        trigger: hero, pin: true, start: 'top top',
        end: () => '+=' + Math.round(innerHeight * (portraitMQ.matches ? 2.2 : 2.6)),
        scrub: 0.6, anticipatePin: 1, invalidateOnRefresh: true,
      },
    });
    addEventListener('load', () => ST.refresh());
  };
  if (document.readyState === 'complete') start(); else addEventListener('DOMContentLoaded', start);
})();
