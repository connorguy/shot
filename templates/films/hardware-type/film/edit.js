// Default cut: every scene at native speed, a short crossfade into each.
film.edit([
  { scene: 'hello' },
  { scene: 'code', xfade: 0.25 },
  { scene: 'knobs', xfade: 0.25 },
  { scene: 'voice', xfade: 0.25 },
  { scene: 'ship', xfade: 0.25 },
]);
film.start();
