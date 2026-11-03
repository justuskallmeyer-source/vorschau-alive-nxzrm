/* Scroll-Hero: Ein Mann steht gebeugt auf einer Wiese vor der Frankfurter Skyline, richtet sich beim Scrollen auf
   und reißt die Arme hoch wie die Figur im Logo. Bildfolge aus dem Higgsfield-Video (tools/build_frames.py).
   GSAP ScrollTrigger hält den Hero fest (pin), bis die Bewegung durch ist und das Endbild kurz gestanden hat.
   Die Darstellung ist eine reine Funktion des Scrollfortschritts, kein Abfangen von Mausrad oder Wischen.
   Quer ("d"): ganzes Bild. Tablet hochkant ("t"): Querbild unten bündig. Handy ("m"): Ausschnitt um den Mann (1080 x 1406),
   unten bündig. Über dem Bild wird der Himmel aus der obersten Bildzeile verlängert, dort steht der Text.
   Touchgeräte (iPhone, iPad): jedes 2. Bild, einmal asynchron entpackt und in Anzeigegröße vorgerendert
   (zusammen höchstens ~150 MB), sonst wirft Safari entpackte Bilder weg und muss beim Scrollen neu entpacken (Ruckeln). */
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
  const touch = matchMedia('(pointer: coarse)').matches;
  const STEP = touch ? 2 : 1;                      // Touch: jedes 2. Bild
  const MEM = 150e6;                               // Touch: Speicher für alle vorgerenderten Bilder (Bytes)

  const stage = hero.querySelector('.hero-stage');
  const canvas = hero.querySelector('[data-canvas]');
  const poster = hero.querySelector('[data-poster]');
  const ctx = canvas.getContext('2d');

  const pickMode = () => (!portraitMQ.matches ? 'd' : phoneMQ.matches ? 'm' : 't');
  let mode = pickMode();
  const total = () => (mode === 'm' ? NM : N);
  // Bildliste: Index k (0 .. count-1) -> Dateinummer; letztes Bild immer dabei
  const files = () => { const n = total(), l = []; for (let i = 0; i < n; i += STEP) l.push(i); if (l[l.length - 1] !== n - 1) l.push(n - 1); return l; };
  let list = files();
  const count = () => list.length;
  const src = (m, k) => `${BASE}/${m === 't' ? 'd' : m}/f_${String(list[k] + 1).padStart(3, '0')}.webp`;
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));

  poster.src = src(mode, reduced ? count() - 1 : 0);

  // Geometrie für ein Bild der Größe iw x ih im aktuellen Modus (in CSS-Pixeln)
  function fit(iw, ih) {
    // Quer: bildschirmfüllend, links eher beschneiden (Mann steht rechts, Text links im Himmel).
    // Tablet hochkant: Querbild mindestens 50 % der Höhe, unten bündig, Mann im Bild.
    // Handy: Ausschnitt in voller Breite, mindestens 70 % der Höhe, unten bündig.
    const s = mode === 'd' ? Math.max(cw / iw, ch / ih) : Math.max(cw / iw, ch * (mode === 't' ? 0.5 : 0.7) / ih);
    const dw = iw * s, dh = ih * s;
    return { dw, dh, dx: (cw - dw) * (mode === 'm' ? 0.5 : 0.75), dy: mode === 'd' ? (ch - dh) * 0.6 : ch - dh };
  }

  // Touch: entpacktes Bild einmal in Anzeigegröße auf eine eigene kleine Leinwand übertragen
  function prerender(img) {
    const iw = img.naturalWidth, ih = img.naturalHeight;
    let w = Math.min(iw, Math.ceil(fit(iw, ih).dw * dpr));
    const maxPx = MEM / 4 / count();
    if (w * (w * ih / iw) > maxPx) w = Math.floor(Math.sqrt(maxPx * iw / ih));
    const c = document.createElement('canvas');
    c.width = w; c.height = Math.round(w * ih / iw);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    return c;
  }

  let frames = [], loadToken = 0;
  function load() {
    list = files();
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
      img.onload = async () => {
        if (token !== loadToken) return;
        if (touch) {
          try { await img.decode(); } catch (e) {}
          if (token !== loadToken) return;
          if (!cw) resize();
          frames[i] = prerender(img);
        } else frames[i] = img;
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
    const ndpr = Math.min(window.devicePixelRatio || 1, 2);
    const nw = stage.clientWidth, nh = stage.clientHeight;
    // iOS meldet beim Ein-/Ausfahren der Adressleiste "resize", die Bühne (100svh) bleibt gleich groß:
    // dann die Leinwand nicht neu anlegen (das leert sie und kostet Zeit)
    if (nw === cw && nh === ch && ndpr === dpr) return;
    const grew = touch && cw && nw > cw * 1.25;      // z. B. iPad gedreht: vorgerenderte Bilder wären zu klein
    dpr = ndpr; cw = nw; ch = nh;
    canvas.width = Math.round(cw * dpr); canvas.height = Math.round(ch * dpr);
    lastKey = ''; dirty = true;
    if (grew) load();
  }
  function nearest(i) {
    if (frames[i]) return frames[i];
    for (let d = 1; d < frames.length; d++) { if (frames[i - d]) return frames[i - d]; if (frames[i + d]) return frames[i + d]; }
    return null;
  }

  const wOf = img => img.naturalWidth || img.width, hOf = img => img.naturalHeight || img.height;
  function paint(img, dx, dy, dw, dh) {
    ctx.drawImage(img, dx, dy, dw, dh);
    if (dy > 0) ctx.drawImage(img, 0, 0, wOf(img), 2, dx, 0, dw, dy + 1);   // Himmel nach oben verlängern
  }

  function draw() {
    const f = clamp(prog / F_END);
    const n = count(), fi = f * (n - 1);
    // nächstliegendes Bild, keine Überblendung (die schnelle Armbewegung gäbe sonst Doppelkonturen)
    const i0 = Math.round(fi);
    const a = nearest(i0);
    if (!a || !cw) return;
    const { dw, dh, dx, dy } = fit(wOf(a), hOf(a));
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
    list = files();
    poster.src = src(mode, reduced ? count() - 1 : 0);
    hero.classList.remove('is-ready');
    lastKey = ''; load(); resize();
  };
  portraitMQ.addEventListener('change', onMode);
  phoneMQ.addEventListener('change', onMode);
  // Messstelle für Tests (Anzahl geladener Bilder, Speicher der vorgerenderten Leinwände)
  window.__heroStats = () => { const f = frames.filter(Boolean); return { mode, touch, dpr, frames: f.length, of: count(), w: f[0] && (f[0].width || f[0].naturalWidth), mb: Math.round(f.reduce((a, x) => a + (x.getContext ? x.width * x.height * 4 : 0), 0) / 1e6) }; };
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
