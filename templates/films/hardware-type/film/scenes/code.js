// Scene “code”: “every frame is a function of time.” with a live t counter and a dot wave driven by t.
film.scene({ id: 'code', label: 'a function of time', section: 'Idea', start: 0, end: 3, vo: 'Every frame is a function of time.' }, el => {
  const lines = [['every', 'frame', 'is'], ['a', 'function', 'of', 'time.']];
  const css = { fontSize: '120px', fontWeight: '300', letterSpacing: '-0.045em' };
  const space = mw(' ', css) * 1.2;
  const words = [];
  lines.forEach((ln, li) => {
    const ws = ln.map(w => mw(w, css));
    let x = (W - (ws.reduce((a, b) => a + b, 0) + space * (ln.length - 1))) / 2;
    ln.forEach((w, wi) => { words.push({ e: mk(el, 'abs big', { fontSize: '120px', color: w === 'time.' ? 'var(--orange)' : '' }, w), x, y: 250 + li * 140 }); x += ws[wi] + space; });
  });
  const N = 28, dots = [...Array(N)].map((_, i) => mk(el, 'dotc', { width: '22px', height: '22px', background: i % 7 === 3 ? 'var(--orange)' : 'var(--ink)' }));
  const lcd = mk(el, 'lcd', { left: (W / 2 - 230) + 'px', top: '880px', width: '460px', height: '96px', fontSize: '46px', lineHeight: '96px', textAlign: 'center' });
  return t => {
    words.forEach((w, i) => { const k = E.out3(P(t, 0.05 + i * 0.09, 0.5 + i * 0.09)); setv(w.e, w.x, w.y + (1 - k) * 40, 1, k, (1 - k) * 10); });
    const wave = P(t, 0.8, 1.2);
    dots.forEach((d, i) => {
      const x = W / 2 + (i - (N - 1) / 2) * 52 - 11;
      const y = 720 + Math.sin(i * 0.45 + t * 3.2) * 46 * wave - 11;
      setv(d, x, y, 1, wave);
    });
    lcd.textContent = `t = ${t.toFixed(3)} s`;
    lcd.style.opacity = P(t, 1.0, 1.25).toFixed(3);
  };
});
