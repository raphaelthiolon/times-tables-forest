/*
 * Engine: facts, mastery, adaptive selection, scoring, sessions.
 * Pure logic, no DOM. Works in the browser (window.Engine) and in tests.
 * Spec: PRD.md sections 6 and 7.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Engine = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var MIN = 3, MAX = 9;
  var FAST_MS = 4000;          // "fast" = correct in under 4 s (PRD section 5)
  var VERY_FAST_MS = 2000;
  var TIME_CAP_MS = 15000;     // ignore time spent looking away
  var MASTER_DAYS = 3;         // fast-correct on 3 different days
  var HARD = ['6x6', '6x7', '6x8', '6x9', '7x7', '7x8', '7x9', '8x8', '8x9', '9x9'];
  var SHARES = { weak: 0.7, learning: 0.2, mastered: 0.1 }; // PRD L2
  var SESSION_TOTAL = 15, WARMUP = 3, MAX_EXTRA = 3;
  var STATE_VERSION = 1;

  function key(a, b) { return Math.min(a, b) + 'x' + Math.max(a, b); }
  function parse(k) { var p = k.split('x'); return [Number(p[0]), Number(p[1])]; }
  function answerOf(k) { var p = parse(k); return p[0] * p[1]; }
  function isHard(k) { return HARD.indexOf(k) >= 0; }
  function allKeys() {
    var out = [];
    for (var a = MIN; a <= MAX; a++) for (var b = a; b <= MAX; b++) out.push(a + 'x' + b);
    return out;
  }
  var ALL = allKeys();

  function checkAnswer(a, b, input) {
    var s = String(input).trim();
    if (s === '' || !/^\d+$/.test(s)) return false;
    return Number(s) === a * b;
  }

  function dateStr(ms) {
    var d = new Date(ms);
    return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
  }

  // ---------- state ----------
  function newFact(k) {
    return { attempts: 0, correct: 0, times: [], lastSeen: 0, score: isHard(k) ? 0 : 0.6, bestMs: null, fastDays: [] };
  }
  function newState() {
    var facts = {};
    ALL.forEach(function (k) { facts[k] = newFact(k); });
    return {
      v: STATE_VERSION, facts: facts, points: 0, sessions: [],
      settings: { sfx: true, music: true, voice: true },
      diagnosticDone: false, baseline: {}
    };
  }
  function migrate(raw) {
    if (!raw || typeof raw !== 'object' || raw.v !== STATE_VERSION || !raw.facts) return newState();
    ALL.forEach(function (k) { if (!raw.facts[k]) raw.facts[k] = newFact(k); });
    raw.settings = raw.settings || { sfx: true, music: true };
    if (raw.settings.voice === undefined) raw.settings.voice = true;
    raw.sessions = raw.sessions || [];
    raw.baseline = raw.baseline || {};
    raw.points = raw.points || 0;
    raw.bestPoints = raw.bestPoints || 0;
    return raw;
  }

  function status(f) {
    if (f.fastDays.length >= MASTER_DAYS) return 'mastered';
    if (f.score < 0.5) return 'weak';
    return 'learning';
  }
  function statusOf(state, k) { return status(state.facts[k]); }
  function hardMasteredCount(state) {
    return HARD.filter(function (k) { return statusOf(state, k) === 'mastered'; }).length;
  }

  // ---------- mastery ----------
  function recordAnswer(state, k, correct, ms, opts) {
    opts = opts || {};
    var now = opts.now || Date.now();
    var f = state.facts[k];
    var capped = Math.min(Math.max(ms, 0), TIME_CAP_MS);
    var prevBest = f.bestMs;
    var statusBefore = status(f);
    var fast = correct && capped < FAST_MS;

    f.attempts++;
    if (correct) f.correct++;
    f.lastSeen = now;
    f.times.push(capped);
    if (f.times.length > 5) f.times.shift();

    if (opts.diagnostic) {
      f.score = correct ? (fast ? 0.6 : 0.4) : 0.05;
    } else if (correct) {
      f.score = Math.min(1, f.score + (fast ? 0.2 : 0.08));
      if (fast) {
        var day = dateStr(now);
        if (f.fastDays.indexOf(day) < 0) f.fastDays.push(day);
      }
    } else {
      f.score = Math.max(0, f.score - 0.25);
      f.fastDays.pop(); // a miss costs one mastery day: we measure, we don't assume
    }
    if (correct && (prevBest === null || capped < prevBest)) f.bestMs = capped;

    return {
      fast: fast, ms: capped, statusBefore: statusBefore,
      improved: correct && prevBest !== null && capped < prevBest
    };
  }

  // ---------- points (never negative) ----------
  function pointsFor(r) {
    if (!r.correct) return { total: 0, base: 0, speed: 0, first: 0, improve: 0, mult: 1 };
    var base = 10;
    var speed = r.ms < VERY_FAST_MS ? 10 : (r.ms < FAST_MS ? 5 : 0);
    var first = (r.firstTry && r.statusBefore === 'weak') ? 10 : 0;
    var improve = r.improved ? 5 : 0;
    var mult = Math.min(3, 1 + 0.5 * Math.floor(r.streak / 5));
    return { total: Math.round((base + speed + first + improve) * mult), base: base, speed: speed, first: first, improve: improve, mult: mult };
  }

  // ---------- selection ----------
  function weightedPick(items, weights, rng) {
    var sum = 0, i;
    for (i = 0; i < weights.length; i++) sum += weights[i];
    var r = rng() * sum;
    for (i = 0; i < items.length; i++) { r -= weights[i]; if (r <= 0) return items[i]; }
    return items[items.length - 1];
  }

  function factWeight(state, k, now) {
    var f = state.facts[k];
    var days = f.lastSeen ? Math.min((now - f.lastSeen) / 86400000, 7) : 7;
    return (1 - f.score) + 0.2 + (isHard(k) ? 0.5 : 0) + days * 0.05;
  }

  function pickNext(state, opts) {
    opts = opts || {};
    var rng = opts.rng || Math.random;
    var now = opts.now || Date.now();
    var recent = opts.recent || [];
    var buckets = { weak: [], learning: [], mastered: [] };
    ALL.forEach(function (k) { buckets[statusOf(state, k)].push(k); });

    var names = [], shares = [];
    ['weak', 'learning', 'mastered'].forEach(function (n) {
      if (buckets[n].length) { names.push(n); shares.push(SHARES[n]); }
    });
    var bucket = weightedPick(names, shares, rng);
    var pool = buckets[bucket].filter(function (k) { return recent.indexOf(k) < 0; });
    if (!pool.length) {
      pool = ALL.filter(function (k) { return recent.indexOf(k) < 0; });
    }
    var weights = pool.map(function (k) { return factWeight(state, k, now); });
    return weightedPick(pool, weights, rng);
  }

  function shuffle(arr, rng) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(rng() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  function pickWarmup(state, n, rng) {
    var easy = ALL.filter(function (k) { return !isHard(k) && state.facts[k].score >= 0.5; });
    if (easy.length < n) easy = ALL.filter(function (k) { return !isHard(k); });
    return shuffle(easy, rng).slice(0, n);
  }

  function diagnosticSet(rng) {
    var known = shuffle(ALL.filter(function (k) { return !isHard(k); }), rng).slice(0, 6);
    var rest = shuffle(HARD.concat(known.slice(2)), rng);
    return known.slice(0, 2).concat(rest); // starts with two easy wins
  }

  function orient(k, rng) {
    var p = parse(k);
    return rng() < 0.5 ? p : [p[1], p[0]]; // both orders appear (PRD L4)
  }

  // ---------- hints ----------
  function hintFor(a, b) {
    var lo = Math.min(a, b), hi = Math.max(a, b), n;
    if (lo === 9 || hi === 9) {
      n = lo === 9 ? hi : lo;
      return '9 × ' + n + ' = 10 × ' + n + ' − ' + n + ' = ' + (10 * n) + ' − ' + n + ' = ' + (9 * n) + '.';
    }
    if (lo === 8 || hi === 8) {
      n = lo === 8 ? hi : lo;
      return 'Double, double, double: ' + n + ' → ' + (2 * n) + ' → ' + (4 * n) + ' → ' + (8 * n) + '. So 8 × ' + n + ' = ' + (8 * n) + '.';
    }
    if (lo === 6 || hi === 6) {
      n = lo === 6 ? hi : lo;
      return '6 × ' + n + ' = 5 × ' + n + ' + ' + n + ' = ' + (5 * n) + ' + ' + n + ' = ' + (6 * n) + '.';
    }
    if (lo === 7 && hi === 7) {
      return '7 × 7 = 7 × 5 + 7 × 2 = 35 + 14 = 49.';
    }
    if (lo === 4 || hi === 4) {
      n = lo === 4 ? hi : lo;
      return 'Double, double: ' + n + ' → ' + (2 * n) + ' → ' + (4 * n) + '. So 4 × ' + n + ' = ' + (4 * n) + '.';
    }
    if (lo === 3 || hi === 3) {
      n = lo === 3 ? hi : lo;
      return '3 × ' + n + ' = 2 × ' + n + ' + ' + n + ' = ' + (2 * n) + ' + ' + n + ' = ' + (3 * n) + '.';
    }
    n = lo === 5 ? hi : lo;
    return '5 × ' + n + ' is half of 10 × ' + n + ': half of ' + (10 * n) + ' = ' + (5 * n) + '.';
  }

  // ---------- interludes (PRD F24 to F27) ----------
  var INTERLUDE_TYPES = ['firefly', 'spot', 'missing'];
  var INTERLUDE_POINTS = 25;

  // Plausible wrong answers: neighbouring products, a tens slip.
  function distractors(a, b, n, rng) {
    var p = a * b, out = [];
    [a * (b - 1), a * (b + 1), (a - 1) * b, (a + 1) * b, p + 10, p - 10, p + 1, p - 1].forEach(function (v) {
      if (v > 0 && v !== p && out.indexOf(v) < 0) out.push(v);
    });
    out = shuffle(out, rng);
    var guard = 0;
    while (out.length < n && guard++ < 200) {
      var v = 4 + Math.floor(rng() * 80);
      if (v !== p && out.indexOf(v) < 0) out.push(v);
    }
    return out.slice(0, n);
  }

  function buildInterlude(a, b, type, rng) {
    var p = a * b;
    if (type === 'firefly') {
      return { type: type, options: shuffle([p].concat(distractors(a, b, 3, rng)), rng) };
    }
    if (type === 'spot') {
      var ok = rng() < 0.5;
      return { type: type, isCorrect: ok, shown: ok ? p : distractors(a, b, 1, rng)[0] };
    }
    return { type: 'missing' }; // "? x b = p": type the missing a
  }

  function isInterludeSlot(session) {
    return session.mode === 'play' && (session.asked + 1) % 5 === 0 && session.asked + 1 < session.total;
  }

  function checkInterlude(q, response) {
    var it = q.interlude;
    if (it.type === 'spot') return response === it.isCorrect;
    if (it.type === 'firefly') return Number(response) === q.a * q.b;
    return /^\d+$/.test(String(response)) && Number(response) === q.a; // missing
  }

  function submitInterlude(session, state, q, response, ms) {
    var correct = checkInterlude(q, response);
    session.seen[q.key] = true;
    var pts = { total: 0, base: 0, speed: 0, first: 0, improve: 0, mult: 1 };
    if (correct) {
      session.streak++;
      if (session.streak > session.bestStreak) session.bestStreak = session.streak;
      pts.total = INTERLUDE_POINTS;
      session.points += pts.total;
      state.points += pts.total;
    } else {
      session.streak = 0;
      session.retries.push({ key: q.key, due: session.asked + 3 });
    }
    // F27: interludes never touch mastery. Typed recall stays the test.
    session.asked++;
    session.results.push({ key: q.key, correct: correct, ms: Math.min(ms, TIME_CAP_MS), firstTry: true, retry: false, interlude: q.interlude.type });
    return {
      correct: correct, answer: q.a * q.b, ms: ms, fast: false, improved: false, mastered: false,
      points: pts, hint: correct ? null : hintFor(q.a, q.b), streak: session.streak, interlude: q.interlude.type
    };
  }

  // ---------- music, voice, dance break (PRD F28 to F30) ----------
  var MUSIC_SWAP_MS = 5 * 60 * 1000;
  function trackIndexFor(elapsedMs, nTracks) {
    return Math.floor(Math.max(0, elapsedMs) / MUSIC_SWAP_MS) % nTracks;
  }
  function spokenText(a, b) { return a + ' times ' + b + ' equals ' + (a * b); }
  // Excited praise wrapped around the equation, so the voice sounds like a cheerleader, not a reader.
  var CHEERS = [
    'Yes! {eq}!', '{eq}! Brilliant!', 'Woohoo! {eq}!', 'Amazing! {eq}!', 'You got it! {eq}!', '{eq}! Super star!',
    'Fantastic! {eq}!', 'Ooh yes! {eq}!', 'Boom! {eq}!', '{eq}! You are on fire!', 'Wow! {eq}!', 'Nailed it! {eq}!'
  ];
  function cheerLine(a, b, rng) {
    rng = rng || Math.random;
    var eq = a + ' times ' + b + ' is ' + (a * b);
    return CHEERS[Math.floor(rng() * CHEERS.length)].replace('{eq}', eq);
  }
  // A dance break rewards every 5th correct answer in a row, in quests only.
  function isDanceBreak(result, mode) {
    return mode === 'play' && !!result.correct && result.streak > 0 && result.streak % 5 === 0;
  }

  // ---------- sessions ----------
  function createSession(state, opts) {
    opts = opts || {};
    var rng = opts.rng || Math.random;
    var diag = opts.mode === 'diagnostic';
    var statusStart = {};
    ALL.forEach(function (k) { statusStart[k] = statusOf(state, k); });
    return {
      mode: diag ? 'diagnostic' : 'play',
      rng: rng,
      now: opts.now || Date.now(),
      total: diag ? 16 : SESSION_TOTAL,
      list: diag ? diagnosticSet(rng) : null,
      warmKeys: diag ? [] : pickWarmup(state, WARMUP, rng),
      asked: 0, extra: 0, recent: [], retries: [], seen: {}, lastInterlude: null,
      streak: 0, bestStreak: 0, points: 0, results: [], statusStart: statusStart
    };
  }

  function nextQuestion(session, state) {
    var k, retry = false, i, interlude = null;
    if (session.mode === 'diagnostic') {
      if (session.asked >= session.list.length) return null;
      k = session.list[session.asked];
    } else if (session.asked >= session.total) {
      if (session.retries.length && session.extra < MAX_EXTRA) {
        session.extra++;
        k = session.retries.shift().key; retry = true;
      } else return null;
    } else if (session.asked < session.warmKeys.length) {
      k = session.warmKeys[session.asked];
    } else if (isInterludeSlot(session)) {
      k = pickNext(state, { rng: session.rng, recent: session.recent, now: Date.now() });
      var types = INTERLUDE_TYPES.filter(function (t) { return t !== session.lastInterlude; });
      interlude = types[Math.floor(session.rng() * types.length)];
      session.lastInterlude = interlude;
    } else {
      var dueIdx = -1;
      for (i = 0; i < session.retries.length; i++) {
        if (session.retries[i].due <= session.asked) { dueIdx = i; break; }
      }
      if (dueIdx >= 0) { k = session.retries.splice(dueIdx, 1)[0].key; retry = true; }
      else k = pickNext(state, { rng: session.rng, recent: session.recent, now: Date.now() });
    }
    var ab = orient(k, session.rng);
    session.recent.push(k);
    if (session.recent.length > 3) session.recent.shift();
    var q = { key: k, a: ab[0], b: ab[1], retry: retry, index: session.asked };
    if (interlude) q.interlude = buildInterlude(ab[0], ab[1], interlude, session.rng);
    return q;
  }

  function submitAnswer(session, state, q, input, ms, opts) {
    if (q.interlude) return submitInterlude(session, state, q, input, ms);
    opts = opts || {};
    var correct = checkAnswer(q.a, q.b, input);
    var diag = session.mode === 'diagnostic';
    var firstTry = !session.seen[q.key];
    session.seen[q.key] = true;
    var rec = recordAnswer(state, q.key, correct, ms, { diagnostic: diag, now: opts.now });
    var pts = { total: 0, base: 0, speed: 0, first: 0, improve: 0, mult: 1 };

    if (correct) {
      session.streak++;
      if (session.streak > session.bestStreak) session.bestStreak = session.streak;
      if (!diag) {
        pts = pointsFor({ correct: true, ms: rec.ms, statusBefore: rec.statusBefore, firstTry: firstTry, improved: rec.improved, streak: session.streak });
        session.points += pts.total;
        state.points += pts.total;
      }
    } else {
      session.streak = 0;
      if (!diag) session.retries.push({ key: q.key, due: session.asked + 3 });
    }
    session.asked++;
    session.results.push({ key: q.key, correct: correct, ms: rec.ms, firstTry: firstTry, retry: q.retry });
    return {
      correct: correct, answer: q.a * q.b, ms: rec.ms, fast: rec.fast, improved: rec.improved,
      mastered: !diag && correct && rec.statusBefore !== 'mastered' && statusOf(state, q.key) === 'mastered',
      points: pts, hint: correct ? null : hintFor(q.a, q.b), streak: session.streak
    };
  }

  function finishSession(session, state, endMs) {
    var res = session.results;
    var correct = res.filter(function (r) { return r.correct; }).length;
    var newlyMastered = ALL.filter(function (k) {
      return session.statusStart[k] !== 'mastered' && statusOf(state, k) === 'mastered';
    });
    var missed = [];
    res.forEach(function (r) { if (!r.correct && missed.indexOf(r.key) < 0) missed.push(r.key); });
    var fastest = null;
    res.forEach(function (r) { if (r.correct && (!fastest || r.ms < fastest.ms)) fastest = r; });

    if (session.mode === 'diagnostic') {
      state.diagnosticDone = true;
      res.forEach(function (r) { if (!state.baseline[r.key]) state.baseline[r.key] = { correct: r.correct, ms: r.ms }; });
    }
    var summary = {
      mode: session.mode, questions: res.length, correct: correct,
      accuracy: res.length ? correct / res.length : 0,
      points: session.points, bestStreak: session.bestStreak,
      newlyMastered: newlyMastered, missed: missed, fastest: fastest
    };
    if (res.length) {
      state.sessions.push({
        date: dateStr(session.now), ms: Math.max(0, (endMs || Date.now()) - session.now),
        q: res.length, c: correct, mode: session.mode,
        pts: session.points, bs: session.bestStreak
      });
      if (state.sessions.length > 100) state.sessions.shift();
      if (session.mode === 'play' && session.points > (state.bestPoints || 0)) state.bestPoints = session.points;
    }
    return summary;
  }

  // ---------- prizes and leaderboard ----------
  var PRIZES = [
    { stars: 1000, name: 'Bubble tea', emoji: '🧋' },
    { stars: 10000, name: 'Big surprise', emoji: '🎁' }
  ];
  // Where the star total stands against the prizes.
  function prizeProgress(points) {
    var reached = PRIZES.filter(function (p) { return points >= p.stars; });
    var next = PRIZES.filter(function (p) { return points < p.stars; })[0] || null;
    var prev = reached.length ? reached[reached.length - 1].stars : 0;
    return {
      reached: reached, next: next,
      remaining: next ? next.stars - points : 0,
      pct: next ? Math.max(0, Math.min(1, (points - prev) / (next.stars - prev))) : 1
    };
  }
  // Prizes crossed between two star totals (for the "you won!" moment).
  function prizesCrossed(before, after) {
    return PRIZES.filter(function (p) { return before < p.stars && after >= p.stars; });
  }
  // Quests (play mode, with a saved star count), best first; ties go to the newest.
  function leaderboard(state) {
    var rows = [];
    state.sessions.forEach(function (s, i) {
      if (s.mode === 'play' && typeof s.pts === 'number') rows.push({ date: s.date, pts: s.pts, q: s.q, c: s.c, bs: s.bs || 0, idx: i });
    });
    var byIdx = rows.slice();
    rows.sort(function (x, y) { return y.pts - x.pts || y.idx - x.idx; });
    rows.forEach(function (r, i) { r.rank = i + 1; });
    return { ranked: rows, history: byIdx.reverse() };
  }

  return {
    MIN: MIN, MAX: MAX, HARD: HARD, ALL: ALL, FAST_MS: FAST_MS, MASTER_DAYS: MASTER_DAYS, SHARES: SHARES,
    key: key, parse: parse, answerOf: answerOf, isHard: isHard, checkAnswer: checkAnswer, dateStr: dateStr,
    newState: newState, migrate: migrate, status: status, statusOf: statusOf, hardMasteredCount: hardMasteredCount,
    recordAnswer: recordAnswer, pointsFor: pointsFor, pickNext: pickNext, pickWarmup: pickWarmup,
    diagnosticSet: diagnosticSet, hintFor: hintFor, orient: orient,
    distractors: distractors, INTERLUDE_TYPES: INTERLUDE_TYPES, INTERLUDE_POINTS: INTERLUDE_POINTS,
    MUSIC_SWAP_MS: MUSIC_SWAP_MS, trackIndexFor: trackIndexFor, spokenText: spokenText, isDanceBreak: isDanceBreak, CHEERS: CHEERS, cheerLine: cheerLine,
    createSession: createSession, nextQuestion: nextQuestion, submitAnswer: submitAnswer, finishSession: finishSession,
    PRIZES: PRIZES, prizeProgress: prizeProgress, prizesCrossed: prizesCrossed, leaderboard: leaderboard
  };
});
