// Scene “hello”: the wordmark types in, the record-dot mark pops, a caption lands.
film.scene({ id: 'hello', label: 'hello, shot', section: 'Open', start: 0, end: 2.6, vo: 'Meet shot.' }, el => {
  const css = { fontSize: '300px', fontWeight: '300', letterSpacing: '-0.045em' };
  const word = 'shot';
  const letters = [...word].map(ch => mk(el, 'abs big', { fontSize: '300px' }, ch));
  const widths = [...word].map(ch => mw(ch, css));
  const markS = 190, gap = 56;
  const total = markS + gap + mw(word, css);
  const x0 = (W - total) / 2, base = H / 2 - 150;
  const mark = mk(el, 'abs mark', { width: markS + 'px', height: markS + 'px' });
  const ring = mk(mark, 'dotc', { left: '28px', top: '28px', width: (markS - 56) + 'px', height: (markS - 56) + 'px', boxShadow: 'inset 0 0 0 3px #3b3b39' });
  const dot = mk(mark, 'dotc', { left: '57px', top: '57px', width: '76px', height: '76px', background: 'var(--orange)' });
  const cap = mk(el, 'abs cap', { width: W + 'px', textAlign: 'center' }, 'a video editor for films made of code');
  return t => {
    const m = E.outBack(P(t, 0.05, 0.5));
    setv(mark, x0, H / 2 - markS / 2 - 20, Math.max(0, m), m > 0 ? 1 : 0);
    ring.style.opacity = P(t, 0.3, 0.6);
    const pulse = 1 + 0.06 * Math.sin(t * 8) * P(t, 0.6, 0.8);
    dot.style.transform = `scale(${(E.outBack(P(t, 0.35, 0.7)) * pulse).toFixed(3)})`;
    let x = x0 + markS + gap;
    letters.forEach((l, i) => {
      const k = EB(P(t, 0.55 + i * 0.12, 0.95 + i * 0.12));
      setv(l, x, base + (1 - k) * 90, 1, k, (1 - k) * 8);
      x += widths[i] * 0.985;
    });
    const [o, b, kk] = env(t, 1.45, 0.5);
    setv(cap, 0, H / 2 + 150 + (1 - kk) * 14, 1, o, b);
  };
});
