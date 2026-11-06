/* UI, storage and sound. Game logic lives in engine.js. */
(function () {
  'use strict';

  var E = window.Engine;
  var STORE_KEY = 'ella_times_tables_v1';
  var NAME = 'Ella';

  function $(id) { return document.getElementById(id); }
  function show(el, on) { el.classList.toggle('hidden', !on); }
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
  function times(k) { var p = E.parse(k); return p[0] + ' × ' + p[1] + ' = ' + (p[0] * p[1]); }

  // ---------- storage (device only) ----------
  var state = load();
  function load() {
    try {
      var raw = window.localStorage.getItem(STORE_KEY);
      return E.migrate(raw ? JSON.parse(raw) : null);
    } catch (e) { return E.newState(); }
  }
  function save() {
    try { window.localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) { /* private mode: play on without saving */ }
  }

  // ---------- sound ----------
  var ctx = null, musicTimer = null;
  function audio() {
    if (!ctx) {
      try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { ctx = null; }
    }
    if (ctx && ctx.state === 'suspended') ctx.resume();
    return ctx;
  }
  function tone(freq, start, dur, vol, type) {
    var c = audio(); if (!c) return;
    var o = c.createOscillator(), g = c.createGain(), t = c.currentTime + start;
    o.type = type || 'sine'; o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(c.destination);
    o.start(t); o.stop(t + dur + 0.05);
  }
  var sfx = {
    right: function () { tone(660, 0, .16, .12); tone(880, .09, .22, .12); },
    bonus: function () { tone(784, 0, .14, .1); tone(988, .08, .14, .1); tone(1318, .16, .26, .1); },
    wrong: function () { tone(294, 0, .3, .06, 'triangle'); },
    done: function () { [523, 659, 784, 1047].forEach(function (f, i) { tone(f, i * .12, .3, .1); }); }
  };
  function playSfx(name) { if (state.settings.sfx) sfx[name](); }

  // Four original generated tracks. The track changes every 5 minutes of music (engine.trackIndexFor).
  var TRACKS = [
    { name: 'Moonlit glade',    scale: [262, 294, 330, 392, 440, 523, 588, 660], gap: 650, wave: 'sine',     vol: 0.025, bass: true },
    { name: 'Mushroom march',   scale: [294, 330, 370, 440, 494, 588, 660, 740], gap: 430, wave: 'triangle', vol: 0.03,  bass: true },
    { name: 'Starlight stream', scale: [220, 262, 294, 330, 392, 440, 524, 588], gap: 900, wave: 'sine',     vol: 0.028, bass: false },
    { name: 'Firefly dance',    scale: [392, 440, 494, 587, 659, 784, 880, 988], gap: 340, wave: 'triangle', vol: 0.022, bass: true }
  ];
  var musicStart = 0, currentTrack = -1, musicStep = 0, musicDuck = false;
  function musicTick() {
    musicTimer = null;
    if (!state.settings.music) return;
    var ti = E.trackIndexFor(Date.now() - musicStart, TRACKS.length), tr = TRACKS[ti];
    if (ti !== currentTrack) { currentTrack = ti; musicStep = 0; }
    if (!document.hidden && !musicDuck) {
      var f = tr.scale[(musicStep * 3 + Math.floor(Math.random() * 3)) % tr.scale.length];
      tone(f, 0, tr.gap / 1000 * 2.2, tr.vol, tr.wave);
      if (tr.bass && musicStep % 4 === 0) tone(f / 2, 0, tr.gap / 1000 * 3.5, tr.vol * 0.8, 'sine');
      musicStep++;
    }
    musicTimer = setTimeout(musicTick, tr.gap);
  }
  function startMusic() {
    if (musicTimer || !state.settings.music) return;
    musicStart = Date.now(); currentTrack = -1;
    musicTick();
  }
  function stopMusic() { if (musicTimer) { clearTimeout(musicTimer); musicTimer = null; } }

  // Voice: says each right answer out loud with the browser's built-in speech (nothing is recorded or sent).
  // Style = pitch and speed. "Bubbly" is the default: higher and quicker, so it sounds young and excited.
  var VOICE_STYLES = {
    bubbly:   { label: 'Bubbly (young and excited)', pitch: 1.5, rate: 1.08 },
    squeaky:  { label: 'Super squeaky', pitch: 1.9, rate: 1.15 },
    natural:  { label: 'Natural', pitch: 1.0, rate: 1.0 }
  };
  function englishVoices() {
    if (!('speechSynthesis' in window)) return [];
    return window.speechSynthesis.getVoices().filter(function (v) { return /^en/i.test(v.lang); });
  }
  // Rank installed voices: natural/neural and lighter, friendlier voices first; deep male voices last.
  function voiceScore(v) {
    var s = 0, n = v.name;
    if (/natural|neural|online/i.test(n)) s += 5;
    if (/samantha|ava\b|allison|susan|karen|serena|moira|tessa|fiona|libby|sonia|jenny|aria|zira|emma|google uk english female|google us english|female/i.test(n)) s += 3;
    if (/daniel|alex\b|fred|ralph|david|mark|george|male\b/i.test(n) && !/female/i.test(n)) s -= 3;
    if (/^en-GB/i.test(v.lang)) s += 1;
    return s;
  }
  function chosenVoice() {
    var vs = englishVoices(), i;
    if (!vs.length) return null;
    var want = state.settings.voiceName;
    if (want) for (i = 0; i < vs.length; i++) if (vs[i].name === want) return vs[i];
    return vs.slice().sort(function (a, b) { return voiceScore(b) - voiceScore(a); })[0];
  }
  function speak(text) {
    if (!state.settings.voice || !('speechSynthesis' in window)) return;
    try {
      window.speechSynthesis.cancel();
      var u = new SpeechSynthesisUtterance(text), st = VOICE_STYLES[state.settings.voiceStyle] || VOICE_STYLES.bubbly, v = chosenVoice();
      if (v) { u.voice = v; u.lang = v.lang; } else u.lang = 'en-GB';
      u.pitch = st.pitch; u.rate = st.rate; u.volume = 1;
      window.speechSynthesis.speak(u);
    } catch (e) { /* voice is optional */ }
  }
  function fillVoicePickers() {
    var pick = $('set-voice-name'), styleSel = $('set-voice-style');
    if (!pick || !styleSel) return;
    pick.textContent = '';
    var auto = document.createElement('option'); auto.value = ''; auto.textContent = 'Automatic (friendliest voice)'; pick.appendChild(auto);
    englishVoices().forEach(function (v) {
      var o = document.createElement('option'); o.value = v.name; o.textContent = v.name + ' (' + v.lang + ')'; pick.appendChild(o);
    });
    pick.value = state.settings.voiceName || '';
    if (pick.value !== (state.settings.voiceName || '')) pick.value = '';
    if (!styleSel.options.length) {
      Object.keys(VOICE_STYLES).forEach(function (k) {
        var o = document.createElement('option'); o.value = k; o.textContent = VOICE_STYLES[k].label; styleSel.appendChild(o);
      });
    }
    styleSel.value = state.settings.voiceStyle || 'bubbly';
  }
  if ('speechSynthesis' in window) window.speechSynthesis.addEventListener('voiceschanged', fillVoicePickers);
  function stopSpeaking() { try { if ('speechSynthesis' in window) window.speechSynthesis.cancel(); } catch (e) { /* ignore */ } }
  function voiceOn() { return !!state.settings.voice && 'speechSynthesis' in window; }

  // Optional private clip for the dance break: game/audio/private/dance.(mp3|m4a|ogg|wav).
  // Personal use only; never publish that folder. If absent, the original jingle plays.
  var ownClip = null;
  (function probeOwnClip() {
    var exts = ['mp3', 'm4a', 'ogg', 'wav'], i = 0;
    function next() {
      if (i >= exts.length) return;
      var a = new Audio();
      a.preload = 'auto';
      a.addEventListener('canplaythrough', function () { ownClip = a; }, { once: true });
      a.addEventListener('error', function () { i++; next(); }, { once: true });
      a.src = 'audio/private/dance.' + exts[i];
    }
    try { next(); } catch (e) { /* optional */ }
  })();
  function playDanceSound() {
    if (ownClip) {
      try {
        ownClip.currentTime = 0; ownClip.volume = 0.9;
        var p = ownClip.play();
        if (p && p.catch) p.catch(function () { jingle(); });
        return;
      } catch (e) { /* fall back */ }
    }
    jingle();
  }
  function stopDanceSound() { if (ownClip) { try { ownClip.pause(); } catch (e) { /* ignore */ } } }

  // Original dance-break jingle (generated, no recordings).
  function jingle() {
    var mel = [523, 659, 784, 659, 880, 784, 659, 523, 587, 740, 880, 740, 988, 880, 740, 587];
    mel.forEach(function (f, i) { tone(f, i * 0.3, 0.26, 0.09, 'triangle'); });
    [131, 196, 131, 196, 147, 220, 147, 220].forEach(function (f, i) { tone(f, i * 0.6, 0.5, 0.07, 'sine'); });
  }
  document.addEventListener('pointerdown', function first() {
    document.removeEventListener('pointerdown', first);
    audio(); startMusic();
  });

  // ---------- scenery ----------
  (function fireflies() {
    var box = $('fireflies');
    for (var i = 0; i < 14; i++) {
      var s = document.createElement('span');
      s.style.left = Math.random() * 100 + '%';
      s.style.top = (35 + Math.random() * 55) + '%';
      s.style.setProperty('--d', (9 + Math.random() * 9) + 's');
      s.style.setProperty('--delay', (-Math.random() * 12) + 's');
      s.style.setProperty('--dx', (Math.random() * 80 - 40) + 'px');
      s.style.setProperty('--dy', (-20 - Math.random() * 60) + 'px');
      box.appendChild(s);
    }
  })();

  // ---------- screens ----------
  var screens = ['home', 'play', 'summary', 'board'];
  function showScreen(name) {
    screens.forEach(function (n) { show($('screen-' + n), n === name); });
    window.scrollTo(0, 0);
  }

  // ---------- progress grid ----------
  function renderGrid(el) {
    el.textContent = '';
    var corner = document.createElement('div'); corner.className = 'h'; corner.textContent = '×'; el.appendChild(corner);
    var a, b, mastered = 0;
    for (b = E.MIN; b <= E.MAX; b++) { var h = document.createElement('div'); h.className = 'h'; h.textContent = b; el.appendChild(h); }
    for (a = E.MIN; a <= E.MAX; a++) {
      var rh = document.createElement('div'); rh.className = 'h'; rh.textContent = a; el.appendChild(rh);
      for (b = E.MIN; b <= E.MAX; b++) {
        var k = E.key(a, b), st = E.statusOf(state, k);
        var c = document.createElement('div');
        c.className = 'cell ' + st + (E.isHard(k) ? ' hard' : '');
        c.textContent = a * b;
        c.title = a + ' × ' + b + ': ' + st;
        el.appendChild(c);
      }
    }
    E.ALL.forEach(function (k) { if (E.statusOf(state, k) === 'mastered') mastered++; });
    el.setAttribute('aria-label', 'Times-tables map. ' + mastered + ' of ' + E.ALL.length + ' facts mastered. ' + E.hardMasteredCount(state) + ' of 10 tricky facts mastered.');
  }

  // ---------- prizes and trophy board ----------
  function fmt(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }

  function renderPrizes(el) {
    el.textContent = '';
    var pts = state.points;
    E.PRIZES.forEach(function (p) {
      var won = pts >= p.stars;
      var row = document.createElement('div'); row.className = 'prize' + (won ? ' won' : '');
      var ico = document.createElement('span'); ico.className = 'prize-ico'; ico.setAttribute('aria-hidden', 'true'); ico.textContent = p.emoji;
      var body = document.createElement('div'); body.className = 'prize-body';
      var top = document.createElement('div'); top.className = 'prize-top';
      var nm = document.createElement('b'); nm.textContent = fmt(p.stars) + ' stars = ' + (p.name === 'Bubble tea' ? 'a bubble tea' : 'a big surprise');
      var st = document.createElement('span');
      st.textContent = won ? 'Won! Tell a grown-up' : fmt(p.stars - pts) + ' to go';
      top.appendChild(nm); top.appendChild(st);
      var bar = document.createElement('div'); bar.className = 'prize-bar';
      bar.setAttribute('role', 'progressbar'); bar.setAttribute('aria-valuemin', '0'); bar.setAttribute('aria-valuemax', String(p.stars));
      bar.setAttribute('aria-valuenow', String(Math.min(pts, p.stars)));
      bar.setAttribute('aria-label', p.name + ' progress');
      var fill = document.createElement('div'); fill.style.width = Math.round(Math.min(1, pts / p.stars) * 100) + '%';
      bar.appendChild(fill);
      body.appendChild(top); body.appendChild(bar);
      row.appendChild(ico); row.appendChild(body);
      el.appendChild(row);
    });
    var tot = document.createElement('p'); tot.className = 'prize-total';
    tot.textContent = 'You have ' + fmt(pts) + ' stars so far.';
    el.appendChild(tot);
  }

  function niceDate(ds) {
    var p = String(ds).split('-');
    if (p.length !== 3) return ds;
    var M = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return Number(p[2]) + ' ' + (M[Number(p[1]) - 1] || '');
  }

  function renderBoard() {
    renderPrizes($('prize-board'));
    var lb = E.leaderboard(state);
    var medals = ['🥇', '🥈', '🥉'];
    var top = $('board-top'); top.textContent = '';
    lb.ranked.slice(0, 5).forEach(function (r, i) {
      var li = document.createElement('li');
      var rk = document.createElement('span'); rk.className = 'rk'; rk.textContent = medals[i] || String(r.rank);
      var main = document.createElement('span'); main.className = 'bd-main';
      main.textContent = fmt(r.pts) + ' stars';
      var sub = document.createElement('span'); sub.className = 'bd-sub';
      sub.textContent = niceDate(r.date) + ' · ' + r.c + '/' + r.q + ' right · streak ' + r.bs;
      li.appendChild(rk); li.appendChild(main); li.appendChild(sub);
      top.appendChild(li);
    });
    show($('board-empty'), lb.ranked.length === 0);
    show(top, lb.ranked.length > 0);

    var hist = $('board-history'); hist.textContent = '';
    lb.history.forEach(function (r) {
      var li = document.createElement('li');
      var d = document.createElement('span'); d.className = 'rk wide'; d.textContent = niceDate(r.date);
      var main = document.createElement('span'); main.className = 'bd-main';
      main.textContent = fmt(r.pts) + ' stars' + (r.rank === 1 ? ' · best!' : '');
      var sub = document.createElement('span'); sub.className = 'bd-sub';
      sub.textContent = r.c + '/' + r.q + ' right · streak ' + r.bs;
      li.appendChild(d); li.appendChild(main); li.appendChild(sub);
      hist.appendChild(li);
    });
    show(hist.parentNode, lb.history.length > 0);
  }
  function openBoard() { renderBoard(); showScreen('board'); }

  // ---------- home ----------
  function renderHome() {
    var hard = E.hardMasteredCount(state);
    $('st-hard').textContent = hard + '/10';
    $('st-points').textContent = fmt(state.points);
    $('st-sessions').textContent = state.sessions.filter(function (s) { return s.mode === 'play'; }).length;
    renderGrid($('grid-home'));
    renderPrizes($('prize-home'));
    var pp = E.prizeProgress(state.points);

    var msg;
    if (!state.diagnosticDone) {
      msg = 'Hi ' + NAME + '! I’m Hoot, guardian of the forest. Your mission: turn the tricky 6, 7, 8 and 9 times tables gold on your map. Every right answer earns stars, and quick answers earn more. Collect 1,000 stars for a bubble tea, and 10,000 for a big surprise! First, a quick scout so I know where to start.';
      $('btn-play').textContent = 'Start the Forest Scout';
    } else if (hard === 10) {
      msg = 'Wow, ' + NAME + '! All 10 tricky facts are mastered. You’re a times-tables wizard!';
      $('btn-play').textContent = 'Play';
    } else if (state.sessions.filter(function (s) { return s.mode === 'play'; }).length === 0) {
      msg = 'Great scouting, ' + NAME + '! Now the real adventure: win stars with every right answer, and the faster you answer, the more you get. 1,000 stars wins a bubble tea, and 10,000 stars a big surprise! Ready for your first quest?';
      $('btn-play').textContent = 'Play';
    } else {
      msg = 'Welcome back, ' + NAME + '! ' + hard + ' of the 10 tricky facts are gold. ' +
        (pp.next ? fmt(pp.remaining) + ' more stars to win ' + (pp.next.name === 'Bubble tea' ? 'your bubble tea' : 'the big surprise') + '. Beat your best!'
                 : 'You have won every prize! Keep playing to beat your best.');
      $('btn-play').textContent = 'Play';
    }
    $('home-msg').textContent = msg;
  }

  // ---------- session ----------
  var CORRECT_MSG = ['Yes!', 'Nailed it!', 'Brilliant!', 'You got it!', 'Magic!', 'Spot on!', 'Wonderful!', 'That’s it!', 'Superb!', 'Forest-fast!', 'Amazing, ' + NAME + '!'];
  var WRONG_MSG = ['Not quite, and that’s okay.', 'Close! Let’s look at it together.', 'Every mistake grows a new leaf.', 'No worries, here’s a trick.', 'Good try! Here’s how it works.', 'Almost! Let’s learn this one.', 'That one’s tricky. Here we go.', 'Thanks for trying. Now we know it better.', 'Mistakes help us learn. Look:', 'Let’s crack this one together.'];

  var sess = null, q = null, input = '', t0 = 0, locked = false, advanceTimer = null;

  function startSession(mode) {
    sess = E.createSession(state, { mode: mode });
    audio(); startMusic();
    showScreen('play');
    updateHud();
    nextQuestion();
  }

  function updateHud() {
    $('hud-points').textContent = sess ? sess.points : 0;
    $('hud-streak').textContent = sess ? sess.streak : 0;
    var total = sess.mode === 'diagnostic' ? sess.list.length : sess.total;
    var pct = Math.min(100, Math.round(sess.asked / total * 100));
    $('progress-bar').style.width = pct + '%';
    $('progress').setAttribute('aria-valuenow', pct);
  }

  function nextQuestion() {
    clearTimeout(advanceTimer);
    q = E.nextQuestion(sess, state);
    if (!q) { endSession(); return; }
    input = ''; locked = false;
    var it = q.interlude, type = it ? it.type : null;
    var qa = $('q-a'), ans = $('q-answer');
    qa.textContent = q.a; qa.className = '';
    $('q-b').textContent = q.b;
    ans.textContent = '?'; ans.className = 'answer';
    $('q-points').textContent = ''; $('q-prompt').textContent = '';
    $('qcard').classList.toggle('bonus', !!it);
    show($('feedback'), false);
    $('pad').classList.remove('locked');
    var choices = $('choices'); choices.textContent = ''; choices.classList.remove('locked');
    var useChoices = type === 'firefly' || type === 'spot';
    show($('pad'), !useChoices); show(choices, useChoices);

    var tag;
    if (sess.mode === 'diagnostic') tag = 'Forest scout';
    else if (it) tag = 'Bonus round: ' + BONUS_NAME[type];
    else if (q.retry) tag = 'Let’s try this one again';
    else if (q.index < 3) tag = 'Warm-up';
    else tag = 'Quest';
    $('q-tag').textContent = tag;

    if (type === 'firefly') {
      $('q-prompt').textContent = 'Catch the firefly with the right answer!';
      it.options.forEach(function (n, i) {
        var b = document.createElement('button');
        b.className = 'choice firefly'; b.textContent = n; b.setAttribute('data-v', n);
        b.style.setProperty('--bd', (2.8 + i * 0.5) + 's'); b.style.setProperty('--bdelay', (-i * 0.7) + 's');
        choices.appendChild(b);
      });
    } else if (type === 'spot') {
      ans.textContent = it.shown;
      $('q-prompt').textContent = 'Hoot says this is right. Is Hoot correct?';
      [['yes', 'Yes, right ✓', 'true'], ['no', 'No, wrong ✗', 'false']].forEach(function (c) {
        var b = document.createElement('button');
        b.className = 'choice verdict ' + c[0]; b.textContent = c[1]; b.setAttribute('data-v', c[2]);
        choices.appendChild(b);
      });
    } else if (type === 'missing') {
      qa.textContent = '?'; qa.className = 'answer';
      ans.textContent = q.a * q.b; ans.className = 'answer plain';
      $('q-prompt').textContent = 'Find the missing number!';
    }
    updateHud();
    t0 = performance.now();
  }

  var BONUS_NAME = { firefly: 'Firefly catch', spot: 'Spot the mistake', missing: 'Missing number' };

  // The element that receives typed digits, and how many digits are expected.
  function typeTarget() { return q.interlude && q.interlude.type === 'missing' ? $('q-a') : $('q-answer'); }
  function expectedLen() { return String(q.interlude && q.interlude.type === 'missing' ? q.a : q.a * q.b).length; }
  function isTyped() { return !q.interlude || q.interlude.type === 'missing'; }

  function onKey(k) {
    if (locked || !q || !isTyped()) return;
    if (k === 'back') { input = input.slice(0, -1); }
    else if (k === 'unsure') { submit('', true); return; }
    else {
      if (input.length >= expectedLen()) return;
      input += k;
    }
    typeTarget().textContent = input === '' ? '?' : input;
    if (k !== 'back' && input.length >= expectedLen()) submit(input, false);
  }

  // ---------- celebrations ----------
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function burst(count, glyphs) {
    if (reduceMotion) return;
    var fx = $('fx');
    for (var i = 0; i < count; i++) {
      var p = document.createElement('span');
      p.className = 'p'; p.textContent = pick(glyphs);
      var ang = Math.random() * Math.PI * 2, dist = 90 + Math.random() * 190;
      p.style.setProperty('--dx', Math.cos(ang) * dist + 'px');
      p.style.setProperty('--dy', (Math.sin(ang) * dist - 40) + 'px');
      p.style.setProperty('--rot', (Math.random() * 360 - 180) + 'deg');
      p.style.setProperty('--t', (1.1 + Math.random() * .8) + 's');
      fx.appendChild(p);
      setTimeout(function (el) { el.remove(); }.bind(null, p), 2100);
    }
  }
  var toastTimer = null;
  function toast(text) {
    var t = $('toast');
    t.textContent = text; t.classList.remove('on');
    void t.offsetWidth; t.classList.add('on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('on'); }, 1900);
  }
  var LEAVES = ['🍃', '✨', '⭐', '🍂'];
  function celebrate(r) {
    if (r.mastered) { toast('🌟 ' + times(q.key).split(' =')[0] + ' mastered!'); burst(36, LEAVES); }
    else if (r.streak > 0 && r.streak % 5 === 0) { toast('🔥 ' + r.streak + ' in a row!'); burst(28, LEAVES); }
    else if (r.improved) { toast('⚡ New best time!'); burst(12, ['✨', '⚡']); }
    else if (r.interlude) { toast('🎉 Bonus round cleared!'); burst(16, LEAVES); }
  }

  // ---------- dance break (every 5 right answers in a row) ----------
  var danceTimer = null, danceDone = null;
  function startDance(done) {
    stopSpeaking();
    danceDone = done;
    $('dance-sub').textContent = sess.streak + ' in a row!';
    speak('Dance break! ' + sess.streak + ' in a row!');
    show($('dance'), true);
    musicDuck = true;
    if (state.settings.sfx) playDanceSound();
    burst(30, ['🎵', '🎶', '✨', '🍃']);
    $('dance-skip').focus();
    danceTimer = setTimeout(endDance, 5200);
  }
  function endDance() {
    if (!danceDone) return;
    clearTimeout(danceTimer);
    var cb = danceDone; danceDone = null;
    show($('dance'), false);
    stopDanceSound();
    musicDuck = false;
    cb();
  }

  function submit(response, unsure) {
    if (locked) return;
    locked = true;
    var ms = performance.now() - t0;
    var it = q.interlude, type = it ? it.type : null;
    var r = E.submitAnswer(sess, state, q, response, ms);
    save();
    $('pad').classList.add('locked');
    $('choices').classList.add('locked');
    var ans = $('q-answer'), diag = sess.mode === 'diagnostic';

    if (type === 'firefly' || type === 'spot') {
      var right = type === 'spot' ? String(it.isCorrect) : String(q.a * q.b);
      Array.prototype.forEach.call($('choices').children, function (b) {
        var v = b.getAttribute('data-v');
        if (v === right) b.classList.add('right');
        else if (v === String(response)) b.classList.add('miss');
      });
    }

    if (r.correct) {
      ans.className = type === 'missing' ? 'answer plain' : 'answer right';
      if (type === 'missing') $('q-a').className = 'answer right';
      if (type === 'spot') ans.textContent = q.a * q.b;
      if (it) {
        $('q-points').textContent = '+' + r.points.total + ' ⭐ bonus round!';
        playSfx('bonus');
      } else if (!diag) {
        var p = r.points, bits = [];
        if (p.speed) bits.push('speed +' + p.speed);
        if (p.first) bits.push('first try +' + p.first);
        if (p.improve) bits.push('new best +' + p.improve);
        if (p.mult > 1) bits.push('streak ×' + p.mult);
        $('q-points').textContent = '+' + p.total + ' ⭐' + (bits.length ? '   (' + bits.join(', ') + ')' : '');
        playSfx(p.total >= 20 ? 'bonus' : 'right');
      } else {
        $('q-points').textContent = '+' + r.points.total + ' ⭐  ' + pick(CORRECT_MSG);
        playSfx('right');
      }
      updateHud();
      speak(E.cheerLine(q.a, q.b));
      var big = !diag && (r.mastered || r.improved || it || (r.streak > 0 && r.streak % 5 === 0));
      if (!diag) celebrate(r);
      var voiceExtra = voiceOn() ? 700 : 0;
      if (E.isDanceBreak(r, sess.mode)) {
        advanceTimer = setTimeout(function () { startDance(nextQuestion); }, 1400 + voiceExtra);
      } else {
        advanceTimer = setTimeout(nextQuestion, (diag ? 650 : (big ? 1800 : 1100)) + voiceExtra);
      }
    } else {
      if (type === 'missing') { $('q-a').textContent = q.a; $('q-a').className = 'answer reveal'; }
      else { ans.textContent = r.answer; ans.className = 'answer reveal'; }
      playSfx('wrong');
      $('fb-text').textContent = diag ? 'No worries! The answer is ' + times(q.key) + '. We’ll learn it together.' : pick(WRONG_MSG) + ' ' + times(q.key);
      $('fb-hint').textContent = diag ? '' : r.hint;
      show($('feedback'), true);
      $('btn-next').focus();
      updateHud();
    }
  }

  function endSession() {
    var s = E.finishSession(sess, state, Date.now());
    save();
    stopTimers();
    playSfx('done');
    renderSummary(s);
    var won = s.mode === 'play' ? E.prizesCrossed(state.points - s.points, state.points) : [];
    show($('sum-prize-card'), won.length > 0);
    if (won.length) {
      $('sum-prize').textContent = won.map(function (p) { return p.emoji + ' ' + fmt(p.stars) + ' stars: ' + (p.name === 'Bubble tea' ? 'you won a bubble tea!' : 'you won the big surprise!'); }).join('  ') + ' Tell a grown-up!';
    }
    sess = null; q = null;
    showScreen('summary');
    if (won.length) { burst(70, LEAVES); }
    else if (s.mode === 'play' && (s.accuracy >= 0.8 || s.newlyMastered.length)) {
      burst(48, LEAVES);
      var av = document.querySelector('#screen-summary .avatar');
      av.classList.remove('hop'); void av.offsetWidth; av.classList.add('hop');
    }
  }
  function stopTimers() { clearTimeout(advanceTimer); }

  function renderSummary(s) {
    var diag = s.mode === 'diagnostic';
    $('sum-title').textContent = diag ? 'Scout report' : 'Quest complete!';
    $('sum-correct').textContent = s.correct + '/' + s.questions;
    $('sum-points').textContent = s.points;
    $('sum-streak').textContent = s.bestStreak;
    show($('sum-points-wrap'), true);
    $('btn-again').textContent = diag ? 'Start your first quest' : 'Play again';

    var msg;
    if (diag) {
      msg = 'Thanks, ' + NAME + '! ' + (s.points > 0 ? 'You earned ' + s.points + ' stars, and now ' : 'Now ') + 'I know where to start. In quests, quick answers and streaks earn even more stars!';
    } else if (s.newlyMastered.length) {
      msg = 'You mastered ' + s.newlyMastered.length + ' new fact' + (s.newlyMastered.length > 1 ? 's' : '') + '! That’s real progress, ' + NAME + '.';
    } else if (s.accuracy >= 0.8) {
      msg = 'Great quest, ' + NAME + '! Every round makes the answers faster.';
    } else {
      msg = 'Good effort, ' + NAME + '! The tricky ones are getting friendlier each time.';
    }
    $('sum-msg').textContent = msg;

    show($('sum-rank-card'), !diag);
    if (!diag) {
      var lb = E.leaderboard(state), last = lb.history[0];
      var rankMsg = '';
      if (last) {
        if (lb.ranked.length > 1 && last.rank === 1) rankMsg = 'New best quest: ' + fmt(last.pts) + ' stars! You are number 1 on the board.';
        else if (lb.ranked.length > 1) rankMsg = 'This quest is number ' + last.rank + ' of ' + lb.ranked.length + '. Best so far: ' + fmt(lb.ranked[0].pts) + ' stars.';
        else rankMsg = 'Your first quest is on the board: ' + fmt(last.pts) + ' stars. Can you beat it?';
      }
      $('sum-rank').textContent = rankMsg;
      renderPrizes($('prize-sum'));
    }

    show($('sum-mastered-card'), s.newlyMastered.length > 0);
    $('sum-mastered').textContent = s.newlyMastered.map(function (k) { return times(k); }).join('   •   ');

    var list = $('sum-missed'); list.textContent = '';
    s.missed.forEach(function (k) {
      var li = document.createElement('li');
      var p = E.parse(k);
      li.textContent = times(k) + (diag ? '' : '  — ' + E.hintFor(p[0], p[1]));
      list.appendChild(li);
    });
    show($('sum-missed-card'), s.missed.length > 0);
    renderGrid($('grid-sum'));
  }

  function leaveToHome() {
    if (sess && sess.asked > 0) { E.finishSession(sess, state, Date.now()); save(); }
    stopTimers(); sess = null; q = null;
    renderHome(); showScreen('home');
  }

  // ---------- settings ----------
  function openSettings() {
    $('set-sfx').checked = !!state.settings.sfx;
    $('set-music').checked = !!state.settings.music;
    $('set-voice').checked = !!state.settings.voice;
    fillVoicePickers();
    show($('gate'), false); show($('confirm'), false); show($('btn-reset'), true);
    show($('overlay'), true);
    $('btn-close').focus();
  }
  function closeSettings() { show($('overlay'), false); }

  var gateAnswer = 0;
  function startGate() {
    var a = 20 + Math.floor(Math.random() * 40), b = 20 + Math.floor(Math.random() * 40);
    gateAnswer = a + b;
    $('gate-q').textContent = 'Grown-ups only: what is ' + a + ' + ' + b + '?';
    $('gate-in').value = ''; $('gate-msg').textContent = '';
    show($('gate'), true); show($('btn-reset'), false);
    $('gate-in').focus();
  }

  // ---------- wiring ----------
  $('btn-play').addEventListener('click', function () { startSession(state.diagnosticDone ? 'play' : 'diagnostic'); });
  $('btn-again').addEventListener('click', function () { startSession('play'); });
  $('btn-home').addEventListener('click', function () { renderHome(); showScreen('home'); });
  $('btn-board').addEventListener('click', openBoard);
  $('btn-board-sum').addEventListener('click', openBoard);
  $('btn-board-back').addEventListener('click', function () { renderHome(); showScreen('home'); });
  $('btn-quit').addEventListener('click', leaveToHome);
  $('btn-next').addEventListener('click', nextQuestion);
  $('dance-skip').addEventListener('click', endDance);
  $('dance').addEventListener('click', endDance);
  $('choices').addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b || locked || !q || !q.interlude) return;
    var v = b.getAttribute('data-v');
    submit(q.interlude.type === 'spot' ? v === 'true' : Number(v), false);
  });
  $('pad').addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (b) onKey(b.getAttribute('data-k'));
  });
  $('btn-settings').addEventListener('click', openSettings);
  $('btn-close').addEventListener('click', closeSettings);
  $('set-sfx').addEventListener('change', function (e) { state.settings.sfx = e.target.checked; save(); });
  $('set-voice').addEventListener('change', function (e) {
    state.settings.voice = e.target.checked; save();
    if (e.target.checked) speak('Hi Ella! Seven times eight is fifty six!'); else stopSpeaking();
  });
  $('set-voice-name').addEventListener('change', function (e) {
    state.settings.voiceName = e.target.value || null; save();
    speak(E.cheerLine(7, 8));
  });
  $('set-voice-style').addEventListener('change', function (e) {
    state.settings.voiceStyle = e.target.value; save();
    speak(E.cheerLine(7, 8));
  });
  $('btn-voice-test').addEventListener('click', function () { speak(E.cheerLine(6, 9)); });
  $('set-music').addEventListener('change', function (e) {
    state.settings.music = e.target.checked; save();
    if (e.target.checked) { audio(); startMusic(); } else stopMusic();
  });
  $('btn-reset').addEventListener('click', startGate);
  $('gate-ok').addEventListener('click', function () {
    if (Number($('gate-in').value) === gateAnswer) { show($('gate'), false); show($('confirm'), true); }
    else { $('gate-msg').textContent = 'Not quite. Try again.'; }
  });
  $('confirm-no').addEventListener('click', function () { show($('confirm'), false); show($('btn-reset'), true); });
  $('confirm-yes').addEventListener('click', function () {
    var settings = state.settings;
    state = E.newState(); state.settings = settings; save();
    closeSettings(); renderHome(); showScreen('home');
  });

  document.addEventListener('keydown', function (e) {
    if (!$('overlay').classList.contains('hidden')) { if (e.key === 'Escape') closeSettings(); return; }
    if ($('screen-play').classList.contains('hidden')) return;
    if (e.key >= '0' && e.key <= '9') { onKey(e.key); e.preventDefault(); }
    else if (e.key === 'Backspace') { onKey('back'); e.preventDefault(); }
    else if (e.key === 'Enter' && locked && !$('feedback').classList.contains('hidden')) { nextQuestion(); e.preventDefault(); }
  });

  renderHome();
  showScreen('home');
})();
