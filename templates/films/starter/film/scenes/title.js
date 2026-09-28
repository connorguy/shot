// Scene “title”: headline words rise from behind their baseline, an accent dot drops in on a spring, subline follows.
film.scene({
  id: 'title', label: 'Title card', section: 'Open', start: 0, end: 3,
  beats: [{ t: 1.2, label: 'Dot lands' }],
  vo: 'Here is the one idea this film is about.',
  notes: 'Replace with the first beat of the brief.',
}, el => {
  const words = '{{TITLE}}'.split(' ');
  const css = { fontSize: '120px', fontWeight: '600', letterSpacing: '-0.045em' };
  const lines = words.map(w => mask(el, 'headline', null, w));
  const widths = words.map(w => mw(w, css));
  const total = widths.reduce((a, b) => a + b, 0) + (words.length - 1) * 30;
  const dot = mk(el, 'dot', { width: '28px', height: '28px' });
  const [sub, subIn] = mask(el, 'sub', { width: W + 'px', textAlign: 'center' }, 'A subline that lands the point.');
  return t => {
    let x = (W - total) / 2;
    lines.forEach(([box, reveal], i) => {
      setv(box, x, H / 2 - 90);
      reveal(E.outExpo(P(t, 0.1 + i * 0.07, 0.9 + i * 0.07))); // stagger 70 ms, long settle
      x += widths[i] + 30;
    });
    const d = spring(t - 1.0, 0.55, 0.25);                       // lands on the beat at 1.2 s, one small overshoot
    setv(dot, (W + total) / 2 + 12, lerp(H / 2 - 400, H / 2 - 22, d), 1, t >= 1.0 ? 1 : 0);
    setv(sub, 0, H / 2 + 60);
    subIn(E.outExpo(P(t, 1.35, 2.0)));
  };
});
