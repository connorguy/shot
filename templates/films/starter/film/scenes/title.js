// Scene “title”: headline rises word by word, an accent dot lands, subline fades in.
film.scene({
  id: 'title', label: 'Title card', section: 'Open', start: 0, end: 3,
  beats: [{ t: 1.2, label: 'Dot lands' }],
  vo: 'Here is the one idea this film is about.',
  notes: 'Replace with the first beat of the brief.',
}, el => {
  const words = '{{TITLE}}'.split(' ');
  const css = { fontSize: '120px', fontWeight: '600', letterSpacing: '-0.045em' };
  const spans = words.map(w => mk(el, 'abs headline', null, w));
  const widths = words.map(w => mw(w, css));
  const total = widths.reduce((a, b) => a + b, 0) + (words.length - 1) * 30;
  const dot = mk(el, 'dot', { width: '28px', height: '28px' });
  const sub = mk(el, 'abs sub', { width: W + 'px', textAlign: 'center' }, 'A subline that lands the point.');
  return t => {
    let x = (W - total) / 2;
    spans.forEach((s, i) => {
      const k = EB(P(t, 0.1 + i * 0.12, 0.7 + i * 0.12));
      setv(s, x, H / 2 - 90 + (1 - k) * 60, 1, k, (1 - k) * 10);
      x += widths[i] + 30;
    });
    const d = E.outBack(P(t, 1.0, 1.4));
    setv(dot, (W + total) / 2 + 12, lerp(H / 2 - 400, H / 2 - 22, d), 1, d > 0 ? 1 : 0);
    const [o, b, k] = env(t, 1.5, 0.5);
    setv(sub, 0, H / 2 + 60 + (1 - k) * 12, 1, o, b);
  };
});
