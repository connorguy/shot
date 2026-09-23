// Scene “ship”: an LCD export bar fills to 100%, “done.”, then the tagline.
film.scene({ id: 'ship', label: 'export', section: 'Ship', start: 0, end: 3.4, vo: 'Then ship it.' }, el => {
  const lcd = mk(el, 'lcd', { left: (W / 2 - 520) + 'px', top: '330px', width: '1040px', height: '300px' });
  const name = mk(lcd, 'abs', { left: '56px', top: '52px', fontSize: '44px' }, 'export → film.mp4');
  const track = mk(lcd, 'bar', { left: '56px', top: '150px', width: '928px', height: '26px', background: '#33332f' });
  const fill = mk(track, 'bar', { left: '0', top: '0', height: '26px', background: 'var(--orange)' });
  const pct = mk(lcd, 'abs', { left: '56px', top: '206px', fontSize: '36px', color: '#8a8984' });
  const done = mk(lcd, 'abs', { left: '800px', top: '200px', fontSize: '44px', color: 'var(--orange)' }, 'done.');
  const tag = mk(el, 'abs cap', { width: W + 'px', textAlign: 'center' }, 'no frames were baked in the making of this film');
  return t => {
    const k = E.out3(P(t, 0.05, 0.4));
    setv(lcd, 0, (1 - k) * 30, lerp(0.97, 1, k), k);
    const p = E.io3(P(t, 0.45, 2.0));
    fill.style.width = (928 * p).toFixed(1) + 'px';
    pct.textContent = `${Math.round(p * 1224)} / 1224 frames · ${Math.round(p * 100)}%`;
    done.style.opacity = P(t, 2.05, 2.15).toFixed(3);
    const [o, b, kk] = env(t, 2.4, 0.5);
    setv(tag, 0, 720 + (1 - kk) * 12, 1, o, b);
  };
});
