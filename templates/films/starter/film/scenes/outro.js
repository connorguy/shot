// Scene “outro”: logo/wordmark and URL.
film.scene({ id: 'outro', label: 'Outro', section: 'Close', start: 0, end: 2.5, vo: '' }, el => {
  const mark = mk(el, 'abs headline', { width: W + 'px', textAlign: 'center' }, 'Brand');
  const url = mk(el, 'abs sub', { width: W + 'px', textAlign: 'center' }, 'example.com');
  return t => {
    const k = E.out3(P(t, 0, 0.6));
    setv(mark, 0, H / 2 - 80, lerp(1.04, 1, k), k);
    const [o, b, kk] = env(t, 0.8, 0.5);
    setv(url, 0, H / 2 + 70 + (1 - kk) * 10, 1, o, b);
  };
});
