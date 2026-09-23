/*! film-kit v1 — the contract between a designed HTML film and Shot.
 *
 * Load this file before your film code (a <script src> in a studio project, or inlined in a one-file film).
 * It gives you:
 *   - a 1920×1080 (configurable) stage, scaled to fit in the browser, with a play/scrub player
 *   - scene registration: film.scene({id,label,start,end,...}, el => t => { ...draw at time t... })
 *     Builders run inside film.start(), after everything passed to film.before() has resolved
 *     (fonts, images), so scenes can measure text safely. Scene files can load in any order.
 *   - a default cut (film.edit([...])) that the player plays and the studio imports as its first timeline
 *   - window.__film, the API Shot drives: manifest + renderFrame(layers)
 *   - ?render: bare frame at native size, no controls (used for thumbnails and MP4 export)
 *   - errors: a scene whose build or draw throws shows the error on stage and in manifest().scenes[i].error
 *
 * Rule of the contract: every frame is a pure function of time. A scene's draw(t) must produce the same
 * pixels for the same t no matter what was drawn before (no Date.now, no unseeded Math.random, no CSS
 * animations or transitions). Scene time t is on the scene's own clock, between its start and end.
 */
(function () {
  'use strict';
  var qs = new URLSearchParams(location.search);
  var RENDER = qs.has('render');

  function clamp(x, a, b) { return Math.min(b, Math.max(a, x)); }

  // Resolve an edit (list of clips) into the scene layers visible at video time tv.
  function layersAt(edit, tv) {
    var acc = 0;
    for (var i = 0; i < edit.length; i++) {
      var c = edit[i];
      var last = i === edit.length - 1;
      if (tv < acc + c.duration || last) {
        var u = c.duration > 0 ? clamp((tv - acc) / c.duration, 0, 0.999999) : 0;
        var layers = [{ scene: c.scene, t: c.in + (c.out - c.in) * u, opacity: 1 }];
        var into = tv - acc;
        if (c.xfade > 0 && i > 0 && into < c.xfade) {
          var p = edit[i - 1];
          layers = [
            { scene: p.scene, t: p.out > p.in ? p.out - 1e-4 : p.out, opacity: 1 },
            { scene: c.scene, t: layers[0].t, opacity: clamp(into / c.xfade, 0, 1) },
          ];
        }
        return layers;
      }
      acc += c.duration;
    }
    return [];
  }

  function normEdit(edit, scenes) {
    return edit.map(function (c, i) {
      var s = scenes.find(function (x) { return x.id === c.scene; });
      if (!s) throw new Error('film-kit: edit[' + i + '] references unknown scene "' + c.scene + '"');
      var a = c.in != null ? c.in : s.start, b = c.out != null ? c.out : s.end;
      var d = c.duration != null ? c.duration : (b - a) / (c.speed || 1);
      return { scene: c.scene, in: a, out: b, duration: +d.toFixed(4), xfade: c.xfade || 0, label: c.label };
    });
  }

  function create(opts) {
    opts = opts || {};
    var W = opts.width || 1920, H = opts.height || 1080, FPS = opts.fps || 30;
    var BG = opts.background || '#ffffff';

    var style = document.createElement('style');
    style.textContent = [
      'html,body{margin:0;height:100%}',
      'body.fk{background:var(--fk-page,#f1f1ee);color:var(--fk-page-ink,#18150e);font-family:system-ui,-apple-system,"Segoe UI",sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:16px;box-sizing:border-box}',
      '@media (prefers-color-scheme: dark){body.fk{--fk-page:#141310;--fk-page-ink:#efefea;--fk-muted:#a2a29c;--fk-ctl:#23211c;--fk-line:#3a3833}}',
      '.fk-player{width:min(100%, calc((100vh - 110px) * ' + W + ' / ' + H + '));max-width:1600px}',
      '.fk-viewport{position:relative;width:100%;aspect-ratio:' + W + '/' + H + ';overflow:hidden;border-radius:10px;background:' + BG + '}',
      '.fk-frame{position:absolute;left:0;top:0;width:' + W + 'px;height:' + H + 'px;transform-origin:0 0;overflow:hidden;background:' + BG + '}',
      '.fk-stage{position:absolute;inset:0;overflow:hidden}',
      '.fk-scene{position:absolute;inset:0;display:none}',
      '.fk-scene>.fk-el{position:absolute;inset:0}',
      '.fk-controls{display:flex;align-items:center;gap:14px;margin-top:14px;flex-wrap:wrap}',
      '.fk-controls button{font:inherit;font-size:15px;font-weight:500;background:var(--fk-ctl,#fff);color:inherit;border:1px solid var(--fk-line,#d8d8d3);border-radius:8px;min-height:44px;padding:0 16px;cursor:pointer}',
      '.fk-controls input[type=range]{flex:1;min-width:160px;min-height:44px}',
      '.fk-controls .fk-time{font-variant-numeric:tabular-nums;font-size:14px;color:var(--fk-muted,#6a6a65);min-width:108px}',
      'body.fk-render{padding:0;display:block;background:' + BG + '}',
      'body.fk-render .fk-player{width:' + W + 'px;max-width:none}',
      'body.fk-render .fk-viewport{width:' + W + 'px;height:' + H + 'px;aspect-ratio:auto;border-radius:0}',
      'body.fk-render .fk-controls{display:none}',
    ].join('\n');
    document.head.appendChild(style);
    document.body.classList.add('fk');
    if (RENDER) document.body.classList.add('fk-render');

    var player = document.createElement('div'); player.className = 'fk-player';
    player.innerHTML =
      '<div class="fk-viewport"><div class="fk-frame"><div class="fk-stage" role="img"></div></div></div>' +
      '<div class="fk-controls"><button type="button" data-a="play">Pause</button><button type="button" data-a="restart">Restart</button>' +
      '<input type="range" min="0" step="0.01" value="0" aria-label="Scrub timeline"><span class="fk-time"></span></div>';
    document.body.appendChild(player);
    var viewport = player.querySelector('.fk-viewport'), frame = player.querySelector('.fk-frame');
    var stage = player.querySelector('.fk-stage');
    if (opts.title) stage.setAttribute('aria-label', opts.title);
    if (opts.stageClass) stage.className += ' ' + opts.stageClass;

    var scenes = [], byId = {}, edit = null, pendingEdit = null;

    var befores = [], started = false;

    function showError(s, e) {
      s.error = String((e && e.stack) || e);
      s.el.innerHTML = '<pre style="position:absolute;inset:60px;margin:0;padding:32px;background:#fff1ef;color:#9b1c10;font:22px/1.4 ui-monospace,Menlo,monospace;white-space:pre-wrap;border:3px solid #c61b0f;border-radius:16px;overflow:hidden"></pre>';
      s.el.firstChild.textContent = 'Scene "' + s.id + '" failed\n\n' + s.error;
      if (window.console) console.error('[film-kit] scene "' + s.id + '":', e);
    }

    function build(s) {
      try {
        s.draw = s.builder(s.el) || function () {};
      } catch (e) {
        showError(s, e);
        s.draw = function () {};
      }
    }

    function scene(meta, builder) {
      if (!meta || !meta.id) throw new Error('film-kit: scene needs an id');
      if (byId[meta.id]) throw new Error('film-kit: duplicate scene id "' + meta.id + '"');
      var wrap = document.createElement('div'); wrap.className = 'fk-scene'; wrap.dataset.scene = meta.id;
      var el = document.createElement('div'); el.className = 'fk-el';
      wrap.appendChild(el); stage.appendChild(wrap);
      var s = {
        id: meta.id, label: meta.label || meta.id, section: meta.section || null,
        start: meta.start, end: meta.end, beats: meta.beats || [], notes: meta.notes || '', vo: meta.vo || '',
        wrap: wrap, el: el, builder: builder, draw: null, error: null,
      };
      scenes.push(s); byId[s.id] = s;
      if (started) build(s);
      return s;
    }

    /** Anything scenes need before they build: a promise, or a function returning one. */
    function before(p) { befores.push(typeof p === 'function' ? p() : p); }

    function renderFrame(layers) {
      var on = {};
      for (var i = 0; i < layers.length; i++) {
        var L = layers[i], s = byId[L.scene];
        if (!s) continue;
        on[s.id] = true;
        s.wrap.style.display = 'block';
        s.wrap.style.opacity = L.opacity == null ? '1' : String(L.opacity);
        s.wrap.style.zIndex = String(i + 1);
        if (s.error) continue;
        try { s.draw(L.t); } catch (e) { showError(s, e); }
      }
      for (var j = 0; j < scenes.length; j++) if (!on[scenes[j].id]) scenes[j].wrap.style.display = 'none';
    }

    function manifest() {
      return {
        version: 1, title: opts.title || document.title, width: W, height: H, fps: FPS, background: BG,
        scenes: scenes.map(function (s) {
          return { id: s.id, label: s.label, section: s.section, start: s.start, end: s.end, beats: s.beats, notes: s.notes, vo: s.vo, error: s.error };
        }),
        edit: edit,
      };
    }

    function start() {
      return Promise.all(befores).catch(function (e) { console.error('[film-kit] before():', e); }).then(boot);
    }

    function boot() {
      started = true;
      scenes.forEach(build);
      if (window.__filmEdit) pendingEdit = window.__filmEdit; // set by `npm run bundle` to play the studio's cut
      if (pendingEdit) { try { edit = normEdit(pendingEdit, scenes); } catch (e) { console.error(e); edit = null; } }
      if (!edit) edit = normEdit(scenes.map(function (s) { return { scene: s.id }; }), scenes);
      var DUR = edit.reduce(function (a, c) { return a + c.duration; }, 0);
      var renderAt = function (tv) { renderFrame(layersAt(edit, clamp(tv, 0, DUR))); };
      window.__film = { version: 1, manifest: manifest, renderFrame: renderFrame, renderAt: renderAt, duration: DUR };
      // legacy hooks, so frame renderers written for older films keep working
      window.__renderAt = renderAt; window.__DUR = +DUR.toFixed(3); window.__ready = true;

      function fit() { frame.style.transform = RENDER ? 'none' : 'scale(' + viewport.clientWidth / W + ')'; }
      new ResizeObserver(fit).observe(viewport); fit();
      renderAt(0);
      if (RENDER) return;

      var btn = player.querySelector('[data-a=play]'), scrub = player.querySelector('input'), timeEl = player.querySelector('.fk-time');
      scrub.max = String(DUR);
      var playing = !matchMedia('(prefers-reduced-motion: reduce)').matches, cur = 0, last = performance.now();
      function setPlay(p) { playing = p; btn.textContent = p ? 'Pause' : 'Play'; last = performance.now(); }
      function ui() { scrub.value = String(cur); timeEl.textContent = cur.toFixed(2) + ' / ' + DUR.toFixed(2); }
      setPlay(playing); ui();
      btn.addEventListener('click', function () { setPlay(!playing); });
      player.querySelector('[data-a=restart]').addEventListener('click', function () { cur = 0; setPlay(true); });
      scrub.addEventListener('input', function () { cur = parseFloat(scrub.value); renderAt(cur); ui(); });
      (function loop(now) {
        if (playing) { cur += (now - last) / 1000; if (cur >= DUR) cur = 0; renderAt(cur); ui(); }
        last = now; requestAnimationFrame(loop);
      })(performance.now());
    }

    return {
      W: W, H: H, FPS: FPS, RENDER: RENDER, stage: stage, frame: frame,
      scene: scene,
      before: before,
      edit: function (e) { pendingEdit = e; }, // resolved at start(), so it may reference scenes registered later
      start: start,
      renderFrame: renderFrame,
    };
  }

  window.FilmKit = { version: 1, create: create, layersAt: layersAt };
})();
