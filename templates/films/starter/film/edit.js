// Default cut: the order and timing the studio starts from on first open.
// After that, timeline.json is the source of truth for timing; this file is only the seed.
film.edit([
  { scene: 'title' },                 // full scene at native speed
  { scene: 'outro', duration: 3 },    // stretched to 3 s
]);
film.start();
