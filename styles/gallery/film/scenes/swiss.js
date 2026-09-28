// Style gallery: Swiss (styles/swiss.md). The grid, the index cut, re-setting the poster, and the red block hand-off.
// Gallery scenes keep their tokens inside the builder and their CSS under .g-<id>, so fifteen styles can share a film.
// In a real film the tokens go in lib.js and styles.css, as the preset says.
document.head.insertAdjacentHTML('beforeend', `<style>
.g-swiss { position: absolute; inset: 0; background: #f2f0eb; color: #111; font-family: "Inter Tight", sans-serif; overflow: hidden; }
.g-swiss .hero { font-size: 320px; font-weight: 700; letter-spacing: -0.045em; line-height: .9; white-space: nowrap; }
.g-swiss .disp { font-size: 200px; font-weight: 700; letter-spacing: -0.035em; line-height: .9; white-space: nowrap; }
.g-swiss .sec { font-size: 40px; font-weight: 500; letter-spacing: -0.01em; line-height: 1.2; white-space: nowrap; }
.g-swiss .lab { font-size: 24px; font-weight: 500; line-height: 1.5; white-space: nowrap; color: #6b6b66; }
.g-swiss .lab b { color: #111; font-weight: 500; }
.g-swiss .rule { position: absolute; left: 0; top: 0; height: 2px; background: #111; transform-origin: 0 0; }
.g-swiss .disc { position: absolute; left: 0; top: 0; width: 264px; height: 264px; border-radius: 50%; background: #e4002b; }
.g-swiss .block { position: absolute; top: 0; height: 1080px; background: #e4002b; }
</style>`);

film.scene({
  id: 'swiss', label: 'Swiss', section: 'Gallery', start: 0, end: 6.4,
  beats: [{ t: 2.6, label: 'Cover' }, { t: 3.2, label: 'Re-set' }, { t: 5.2, label: 'Block' }],
  notes: 'Worked example of styles/swiss.md.',
}, el => {
  const root = mk(el, 'g-swiss');
  const GRID = { cols: 12, margin: 96, gutter: 24, base: 12 };
  const MOD = (W - 2 * GRID.margin + GRID.gutter) / GRID.cols;
  const col = n => GRID.margin + n * MOD;
  const colEnd = n => col(n) + MOD - GRID.gutter;
  const EASE = { in: bez(0.16, 1, 0.3, 1), out: bez(0.5, 0, 0.75, 0), move: bez(0.87, 0, 0.13, 1) };
  const DUR = { in: 0.7, out: 0.45, move: 0.8, rule: 0.6 };
  const STAGGER = { line: 0.09 };
  const inAt = (t, a, d = DUR.in) => EASE.in(P(t, a, a + d));

  // index cut: numeral, label, rule
  const [num, numIn] = mask(root, 'hero', null, '01');
  const [lab, labIn] = mask(root, 'sec', null, 'Build time');
  const rule = mk(root, 'rule', { width: (colEnd(11) - col(0)) + 'px' });
  // headline, set by sense: two lines
  const lines = ['Ship in', 'minutes.'].map(s => mask(root, 'disp', null, s));
  // metadata column
  const [meta, metaIn] = mask(root, 'lab', null, '<b>Relay CI</b><br>Version 2.0<br>Illustrative');
  // what fills the space the headline leaves
  const [note, noteIn] = mask(root, 'sec', null, 'One config line.<br>Same pipeline.');
  const disc = mk(root, 'disc'); // the film's one geometric gesture
  const block = mk(root, 'block', { left: col(8) - GRID.gutter / 2 + 'px', width: W - col(8) + GRID.gutter / 2 + 'px' });

  return t => {
    setv(num, col(0), 96); numIn(inAt(t, 0));
    setv(lab, col(3) + (1 - inAt(t, 0.25)) * MOD, 96 + 36); labIn(P(t, 0.25, 0.3)); // slides one module, no fade
    rule.style.transform = `translate(${col(0)}px, ${96 + 300}px) scaleX(${EASE.in(P(t, 0.1, 0.1 + DUR.rule)).toFixed(4)})`;

    // re-set: the headline block moves three modules right, the note rises where it was
    const shift = 3 * MOD * EASE.move(P(t, 3.0, 3.0 + DUR.move));
    lines.forEach(([box, reveal], i) => { setv(box, col(0) + shift, 600 + i * 180); reveal(inAt(t, 0.55 + i * STAGGER.line)); });
    setv(note, col(0), 612); noteIn(inAt(t, 3.3));
    setv(meta, col(9), 432); metaIn(inAt(t, 1.1));
    const d = inAt(t, 1.3, 0.9);
    setv(disc, col(9) + (1 - d) * MOD, 708); disc.style.clipPath = `inset(0 ${((1 - d) * 100).toFixed(2)}% 0 0)`;

    // red block hand-off: wipes in from the right at the end of the scene
    const k = EASE.move(P(t, 5.2, 5.2 + DUR.move));
    block.style.clipPath = `inset(0 0 0 ${((1 - k) * 100).toFixed(2)}%)`;
  };
});
