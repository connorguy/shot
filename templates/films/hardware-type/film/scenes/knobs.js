// Scene “knobs”: four knob caps (navy, tan, grey, orange) spin up; retime, reorder, split, hold.
film.scene({ id: 'knobs', label: 'turn the knobs', section: 'Tinker', start: 0, end: 3, vo: 'Retime it. Reorder it. Hold that frame.' }, el => {
  const head = mk(el, 'abs big', { fontSize: '110px', width: W + 'px', textAlign: 'center' }, 'turn the knobs.');
  const caps = ['var(--navy)', 'var(--tan)', 'var(--grey)', 'var(--orange)'];
  const names = ['retime', 'reorder', 'split', 'hold'];
  const S = 230, gap = 110, x0 = (W - (4 * S + 3 * gap)) / 2;
  const knobs = caps.map((c, i) => {
    const k = mk(el, 'knob', { width: S + 'px', height: S + 'px' });
    mk(k, null, { left: '40px', top: '40px', width: (S - 80) + 'px', height: (S - 80) + 'px', background: c }, null, 'i');
    const tick = mk(k, null, { left: (S / 2 - 3) + 'px', top: '52px', height: '44px', transformOrigin: `3px ${S / 2 - 52}px` }, null, 'b');
    const lab = mk(el, 'abs cap', { width: S + 'px', textAlign: 'center' }, names[i]);
    return { k, tick, lab, x: x0 + i * (S + gap), phase: i * 1.3, speed: [1.6, -1.1, 2.3, -0.8][i] };
  });
  return t => {
    const [o, b, kk] = env(t, 0.05, 0.45);
    setv(head, 0, 190 + (1 - kk) * 20, 1, o, b);
    knobs.forEach((n, i) => {
      const k = E.outBack(P(t, 0.3 + i * 0.12, 0.75 + i * 0.12));
      setv(n.k, n.x, 470, Math.max(0, k), k > 0 ? 1 : 0);
      const ang = -135 + 270 * (0.5 + 0.5 * Math.sin(t * n.speed + n.phase));
      n.tick.style.transform = `rotate(${ang.toFixed(1)}deg)`;
      const [lo, lb] = env(t, 0.7 + i * 0.12, 0.4);
      setv(n.lab, n.x, 470 + S + 36, 1, lo, lb);
    });
  };
});
