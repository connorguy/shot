// Scene “voice”: a navy waveform reads across; the playhead lights it orange; a target-length chip.
film.scene({ id: 'voice', label: 'voiceover, paced', section: 'Tinker', start: 0, end: 3, vo: 'Give it a voice, paced to the cut.' }, el => {
  const head = mk(el, 'abs big', { fontSize: '110px', width: W + 'px', textAlign: 'center' }, 'voiced to the frame.');
  const R = rng(7), N = 72, bw = 14, gap = 8, x0 = (W - (N * bw + (N - 1) * gap)) / 2;
  const env0 = [...Array(N)].map((_, i) => (0.35 + 0.65 * R()) * Math.pow(Math.sin(Math.PI * (i + 0.5) / N), 0.6));
  const bars = env0.map(() => mk(el, 'bar', { width: bw + 'px' }));
  const ph = mk(el, 'bar', { width: '4px', height: '360px', top: '430px', background: 'var(--orange)' });
  const chip = mk(el, 'lcd', { left: (W / 2 - 260) + 'px', top: '880px', width: '520px', height: '90px', fontSize: '40px', lineHeight: '90px', textAlign: 'center' }, 'target ⇥ 2.40 s');
  return t => {
    const [o, b, kk] = env(t, 0.05, 0.45);
    setv(head, 0, 190 + (1 - kk) * 20, 1, o, b);
    const grow = E.out3(P(t, 0.25, 0.8)), prog = P(t, 0.7, 2.7);
    bars.forEach((e, i) => {
      const h = Math.max(10, 320 * env0[i] * (0.55 + 0.45 * Math.abs(Math.sin(i * 0.7 + t * 6))) * grow);
      const x = x0 + i * (bw + gap);
      e.style.height = h.toFixed(1) + 'px';
      e.style.transform = `translate(${x}px,${(610 - h / 2).toFixed(1)}px)`;
      e.style.background = (i + 0.5) / N < prog ? 'var(--orange)' : 'var(--navy)';
    });
    ph.style.transform = `translateX(${(x0 + prog * (N * (bw + gap) - gap)).toFixed(1)}px)`;
    ph.style.opacity = (P(t, 0.7, 0.8) * (1 - P(t, 2.7, 2.9))).toFixed(3);
    chip.style.opacity = P(t, 1.2, 1.5).toFixed(3);
  };
});
