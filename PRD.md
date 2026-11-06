# PRD: Ella's Times-Tables Game

| | |
|---|---|
| **Status** | Draft v0.2, for iteration |
| **Owner** | Raphael Thiolon |
| **Builder** | Claude |
| **Primary user** | Ella, 8½ |
| **Last updated** | 2026-11-05 |
| **Tags used** | `[TO CONFIRM]` = decision or fact not yet validated. `[ASSUMPTION]` = my working default, change freely. |

---

## 1. Summary

A web game that makes Ella fluent in the 6, 7, 8 and 9 times tables, while keeping her 3, 4 and 5 sharp. She plays 5 to 10 minutes at a time in a creative world with characters, points and bonuses. The game adapts to what she gets wrong and teaches her tricks, not just answers.

**Why it works on paper:** only 10 unique facts are genuinely new (6×6, 6×7, 6×8, 6×9, 7×7, 7×8, 7×9, 8×8, 8×9, 9×9), since 3×6 = 6×3 and so on. A small target, a clear finish line.

## 2. Problem and opportunity

- **Problem.** Ella knows 3/4/5 but not 6–9. Drilling is boring, so practice is avoided or short. Existing apps are generic, ad-heavy or collect data. `[TO CONFIRM: what she currently uses and what her school expects]`
- **Opportunity.** A game she chooses to play, built around her actual gaps, safe by design, and made by her father.
- **Why now.** She is at the age when multiplication fluency is typically being built at school. `[TO CONFIRM against her school's curriculum]`

## 3. Goals and non-goals

**Goals**
1. Ella reaches fluent recall (accurate and fast) on all 10 hard facts.
2. She plays by choice, several times a week.
3. She feels competent and proud, never stupid or punished.
4. Ship a playable version fast, then improve with her feedback.

**Non-goals (v1)**
- Division, 11 and 12 tables, other maths topics.
- Accounts, cloud sync, leaderboards, chat, multiplayer.
- Monetisation, ads, in-app purchases.
- Replacing school teaching or giving a formal assessment.

## 4. Users

**Primary: Ella.** Reads fluently, comfortable with touch screens `[TO CONFIRM device]`, short attention bursts, motivated by collecting, customising and visible progress. Knows 3/4/5. Struggles likely on 6×7, 7×8, 8×9-type facts `[TO CONFIRM via diagnostic]`.

**Secondary: Parent (Raphael, possibly others).** Wants to see what she is mastering and where she is stuck, in under 30 seconds. Does not want to configure anything.

**Key jobs to be done**
- Ella: "Let me play something fun, win, and get better without it feeling like homework."
- Parent: "Show me whether it's working, and let me trust it with my child."

## 5. Success metrics

**North star:** number of the 10 hard facts at mastery.

**Mastery definition** (confirmed 2026-11-06, review after two weeks of data): a fact is mastered when Ella answers it correctly in under 4 seconds, in 3 separate sessions on 3 different days.

| Type | Metric | Target `[TO CONFIRM]` |
|---|---|---|
| Outcome | Hard facts mastered | 10 of 10 within 8 weeks of regular play |
| Outcome | Accuracy on hard facts | ≥ 90% |
| Outcome | Median response time on hard facts | ≤ 4 s |
| Engagement | Voluntary sessions per week | ≥ 3 |
| Engagement | Median session length | 5 to 10 min |
| Guardrail | Sessions ended by frustration (quit within 60 s after 3 wrong in a row) | < 10% |
| Guardrail | Play after reaching mastery | Still plays; game doesn't feel finished |

**Baseline:** a 2-minute diagnostic on first launch records her starting accuracy and speed on every fact. All progress is measured against it.

**Measurement:** all data stays on the device (see 9.3). The parent view reads from it. No external analytics.

## 6. Learning design requirements

| ID | Requirement |
|---|---|
| L1 | Each fact (unordered pair, e.g. 7×8 = 8×7) has a mastery score built from accuracy and response time. |
| L2 | Question selection is weighted: ~70% weak or new facts, ~20% facts being consolidated, ~10% mastered (review). `[ASSUMPTION]` |
| L3 | Facts she got right are returned to after a delay (spaced), not repeated back to back. |
| L4 | Both orders of a fact appear (7×8 and 8×7). |
| L5 | After a wrong answer: show the correct answer, a one-line strategy, and replay the fact within the next few questions. |
| L6 | A visual model (array/grid) is available on tap for every fact. |
| L7 | Strategies are fact-specific, e.g. 6×7 = 5×7 + 7; 9× = 10× minus one; 8× = double, double, double. |
| L8 | Mastery unlocks content. Time spent does not. |
| L9 | Include a warm-up of 2 or 3 easy facts at the start of every session so she begins with wins. |
| L10 | The 3, 4 and 5 tables are maintained through the review share, not taught again. |

## 7. Functional requirements

Priority: **M** = must (v1), **S** = should (v1 if time allows), **C** = could (later).

### 7.1 Core play
| ID | Requirement | Pri | Acceptance criteria |
|---|---|---|---|
| F1 | Show a multiplication question and accept an answer | M | Question renders; answer by on-screen number pad and keyboard; submit gives instant feedback |
| F2 | Question generator covers 3–9 tables, correct for every fact | M | Automated test checks all 49 products (3–9 × 3–9) and the answer checker; 0 errors |
| F3 | Wrong-answer handling per L5 | M | Correct answer shown, hint shown, fact reappears within 5 questions |
| F4 | Multiple-choice mode for early confidence, typed mode for recall | S | Mode switches per mastery level; typed mode is the mastery test |
| F5 | Session structure: warm-up, main set, boss or finale, summary | M | A session ends with a clear result screen and a "play again" option |
| F6 | First-run diagnostic | M | Runs once, records per-fact accuracy and time, seeds mastery scores |

### 7.2 Adaptive engine
| ID | Requirement | Pri | Acceptance criteria |
|---|---|---|---|
| F7 | Per-fact mastery score updated after every answer | M | Score changes in expected direction in unit tests (fast correct up, slow correct slight up, wrong down) |
| F8 | Weighted selection per L2 and spaced return per L3 | M | Simulated 1,000-question run shows target distribution ±10% |
| F9 | Mastery gates unlock regions | M | Region unlocks only when its facts meet the gate rule |

### 7.3 Game layer
| ID | Requirement | Pri | Acceptance criteria |
|---|---|---|---|
| F10 | Points: base, speed bonus, streak multiplier, first-try bonus on weak facts, improvement bonus | M | Point rules documented and unit-tested; points never decrease |
| F11 | Quest map with four regions (6, 7, 8, 9) and a review zone | M | Regions show lock state and progress |
| F12 | Boss battle at the end of each region | S | Correct answers damage the boss; losing a battle costs nothing but a retry |
| F13 | Coins and a shop for character items and world decorations | S | Coins earned from play; items persist |
| F14 | Hero customisation and a companion character | S | Choices persist between sessions |
| F15 | Daily challenge and streak calendar | S | One short quest per day; a missed day does not erase rewards |
| F16 | Collectibles (stickers, pets) as milestone rewards | C | Awarded at mastery milestones |
| F17 | Optional timed speed round | C | Opt-in only; never required to progress |

### 7.4 Feedback and progress
| ID | Requirement | Pri | Acceptance criteria |
|---|---|---|---|
| F18 | Ella-facing progress: a grid that lights up as facts are mastered | M | Updates live after each session |
| F19 | Parent view (hidden behind a simple gate) showing weak facts, time played, trend, mastery count | S | Opens in one tap plus gate; shows data in under 30 seconds of reading |
| F20 | Encouraging, varied feedback copy | M | At least 10 variants for correct and for wrong; never shaming |

### 7.5 Settings and safety
| ID | Requirement | Pri | Acceptance criteria |
|---|---|---|---|
| F21 | Sound on/off, music on/off | M | Setting persists |
| F22 | Reset progress (parent-gated) | S | Requires confirmation; does not trigger by accident |
| F23 | Export progress as a file for backup | C | Downloads a JSON file |

### 7.6 Interactivity (added 2026-11-06, from Raphael's first feedback)
Ask: more interactive and fun, with animation on good scores and a different kind of question every five questions.

| ID | Requirement | Pri | Acceptance criteria |
|---|---|---|---|
| F24 | Interlude round: every 5th question is a different game format worth bonus stars | M | Appears at questions 5 and 10 of a quest; each interlude is 1 question; never repeats the same format twice in a row |
| F25 | Interlude formats (draft): **Firefly catch** (tap the firefly showing the right product), **Spot the mistake** (is this equation right or wrong?), **Missing number** (? × 8 = 56), **Match pairs** (join questions to answers) | M | At least 3 formats at launch; every correct answer is exact; wrong options are plausible neighbours |
| F26 | Celebration animations: streak of 5, new personal best, fact mastered, quest finished with 80%+ | M | Leaf or firefly burst, bouncing companion, no flashing, respects reduced-motion setting, under 2 seconds so play isn't slowed |
| F27 | Interludes do not count toward mastery (typed recall stays the mastery test), but a miss still queues that fact for retry | M | Unit test: interlude answers leave fastDays unchanged; a miss adds a retry |
| F28 | Music changes every 5 minutes: four original generated tracks, cycling | M | Track index rotates at 5:00, 10:00, 15:00 and wraps; unit-tested |
| F29 | Voice cheers every right answer with excited praise ("Boom! 7 times 8 is 56!", 12 variants) using the device's built-in speech; default style "Bubbly" (higher and quicker); settings let you pick the voice and the style (Bubbly, Super squeaky, Natural) and hear it; also announces the dance break | M | Every line carries the correct equation for all 49 pairs (tested); automatic choice prefers friendly voices (picked Zira over David and Mark in the test browser); choices persist; nothing recorded or sent |
| F31 | Optional private dance clip: a file at `game/audio/private/dance.(mp3, m4a, ogg, wav)` plays during the dance break instead of the jingle; falls back to the jingle when absent. Personal use only; the folder must never be published | S | Checked with a test tone: plays at the dance break, stops on Skip; no file means jingle and no errors |

**Voice limit.** The browser's built-in voices are robotic compared with a human child. Raising pitch and speed makes them sound younger and more excited, but a truly child-like voice needs recorded audio (for example Raphael recording the lines with Ella) or an online voice service, which would send data off the device. `[TO CONFIRM]` if wanted.
| F30 | Dance break on every 5th right answer in a row (quests only): overlay with the characters dancing and an original jingle, skippable | M | Fires at streaks 5, 10, 15 and never on a miss or in the scout (tested); tap or Skip to continue |

### 7.7 Prizes and trophy board (added 2026-11-06, from Raphael's feedback)
Ask: a leaderboard with the history of previous games and scores, explaining that 1,000 stars wins a bubble tea and 10,000 stars a big surprise.

| ID | Requirement | Pri | Acceptance criteria |
|---|---|---|---|
| F32 | Real-world prizes tied to the lifetime star total: **1,000 stars = bubble tea, 10,000 stars = big surprise**. Progress bars on the home screen, the trophy board and the quest summary; the first-launch and post-scout messages from Hoot explain both prizes; the welcome-back message says how many stars remain | M | Thresholds, remaining count and bar percentage unit-tested; crossing a threshold during a quest shows a "Prize unlocked" card and a leaf burst once, never again for the same prize. The prize is handed over by a grown-up, outside the game |
| F33 | Trophy board: the 5 best quests (medals for the top 3) and the full quest history, newest first (date, stars, right answers, best streak). Scout rounds and old saves without a star count are excluded. The summary tells her where the quest ranked | M | Ranking best-first, ties to the newest, history newest-first, lifetime stars equal the sum of quest stars (all unit-tested). Kept on the device; the last 100 quests are stored |

**Pacing (measured, not promised).** A fast, accurate quest of 15 questions earns about 455 stars in simulation (about 2.5 s per answer, no misses). The bubble tea then takes 3 quests at best and probably 4 to 6 in real play. The big surprise takes about 22 perfect quests and likely 35 to 45 real ones. `[TO CONFIRM]` against Ella's real scores after the first week; the thresholds are one constant each (`PRIZES` in `engine.js`).

**Guardrail.** Stars come only from right answers and never decrease, so the board cannot punish her. The reset in settings erases the star total and the board together.

**Decision (2026-11-06): no Taylor Swift songs.** Her recordings and lyrics are copyrighted, and the game's safety rule is no external links or streaming. The dance break uses an original jingle instead. Option for later: Raphael places his own licensed audio clip in the game folder for private use on his own devices. It must not go on a public host. `[TO CONFIRM]`

## 8. Game and content design

**Core loop:** question, answer, instant feedback, points, next question. Mini-reward about every 10 questions.

**World and characters** **Theme: magical forest** (decided 2026-11-06). A hero she customises, a hint-giving companion, and a distinct character or region for each table, with the most memorable ones for 7 and 8. Character designs `[TO CONFIRM with Ella]`.

**Art and audio direction:** bright, warm, original characters only, no copyrighted material. Subtle animation, no flashing. Short, friendly sound effects. `[TO CONFIRM style]`

**Content spec**
- Fact set: all unordered pairs from 3 to 9. Hard set: the 10 facts listed in section 1.
- Wrong-answer options in multiple choice: plausible distractors (neighbouring products such as 48 or 56 for 7×8, and the product of an adjacent fact).
- Reading level: simple sentences, no jargon.
- Language: English only for v1.

## 9. Non-functional requirements

### 9.1 Performance
- First load under 2 seconds on a typical home Wi-Fi tablet. Answer feedback appears within 100 ms. `[ASSUMPTION]`
- Total download kept small; no heavy libraries.

### 9.2 Accessibility and usability
- Touch targets at least 48 px. Strong contrast (AA). Visible focus states.
- No flashing or rapid strobing. Sound is never required to play.
- Works in portrait and landscape.
- Timing pressure is gentle and optional. `[TO CONFIRM whether Ella has any specific needs]`

### 9.3 Privacy and child safety
- No accounts, ads, external links, chat, analytics or third-party scripts.
- Progress stored on the device (localStorage or IndexedDB). Nothing leaves the device.
- The only personal data is the first name "Ella", entered by the parent. No photos, no location.
- Parent gate (e.g. a simple maths question an adult answers) before the parent view and reset.
- Because no data is collected, children's privacy rules should not be triggered, but this is a compliance judgment, not legal advice. Flag for review if scope changes (e.g. cloud sync, hosting analytics). `[TO CONFIRM]`

### 9.4 Compatibility and reliability
- Works offline after first load.
- Latest Safari and Chrome on iPad, iPhone, Android and desktop. Design tablet first.
- Progress survives closing the browser. Clearing browser data erases it; the export in F23 is the backup.

## 10. Technical approach

- Plain HTML, CSS and JS in `game/`. No framework, no build step. `[ASSUMPTION]`
- Rendering: DOM and CSS first; Canvas only if the boss battles need it.
- Modules: question engine, mastery engine, scoring, world/state, UI, storage.
- Data model (per fact): attempts, correct count, last N response times, last seen, mastery score, next review time. Global: points, coins, unlocks, inventory, settings, streak, diagnostic result.
- Storage versioned, so later changes don't wipe her progress.
- Offline via a service worker once the core is stable.
- Hosting: free static host (decided), so she can play on any device. Provider to pick at launch: Cloudflare Pages, Netlify or GitHub Pages. Hosting adds a privacy check: confirm the host adds no analytics or tracking.

## 11. Delivery plan

| Phase | Scope | Exit test |
|---|---|---|
| **0. Decisions** | Settle section 14 | Theme, device, language, name agreed |
| **1. Playable core** | F1–F3, F5–F8, F10 (basic), F18 (basic), F20, F21; placeholder art | Ella plays 5 minutes unaided and asks to play again |
| **2. Game layer** | F9, F11–F15 | She unlocks a region and uses coins without help |
| **3. Teaching layer** | L5–L7 fully, F4, F19 | Hints visibly reduce repeated misses |
| **4. Creative polish** | Final art, animation, audio, collectibles (F16) | Ella prefers it to her current practice method |
| **5. Hardening and launch** | QA, device testing, offline, hosting | Test plan in section 12 passes |
| **Later** | Division, 11/12 tables, two-player, new worlds | Only if she asks for more |

Each phase ends with Ella playtesting and my feedback in a batch before the next begins.

## 12. Test and QA plan

- **Maths correctness:** automated test over every fact, in both orders, for question generation and answer checking. Zero tolerance.
- **Engine tests:** mastery updates, selection weighting, spaced return, point rules, unlock gates, using simulated players (fast, slow, error-prone).
- **Device tests:** target tablet, phone and desktop; portrait and landscape; offline.
- **Accessibility checks:** contrast, tap-target size, no flashing.
- **Playtest with Ella:** observe where she hesitates, gets bored or frustrated. Log findings in MEMORY.md.
- **Data safety:** confirm no network requests beyond loading the game.

## 13. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Decoration outruns fun | Core loop ships first and must feel good with placeholder art |
| Rote tapping without learning | Adaptive selection, typed recall as the mastery test, strategy hints |
| Frustration on 7s and 8s | Gentle failure, warm-up wins, hints, optional timing |
| Reward fatigue | Tie rewards to effort and improvement; test with Ella; tune |
| Mastery thresholds set wrong | Baseline diagnostic; adjust after the first two weeks of data |
| Progress lost if browser data is cleared | Export option (F23); consider hosted sync later only with a privacy review |
| Scope creep | Phase exit tests; Could items stay out of v1 |

## 14. Open questions

| # | Question | Owner | Needed by |
|---|---|---|---|
| 1 | Theme: **DECIDED, magical forest** (2026-11-06). Characters still open | Ella and Raphael | Phase 0 |
| 2 | Device: **DECIDED, mix of all, tablet first** (2026-11-06) | Raphael | Closed |
| 3 | Language: **DECIDED, English only for v1** (2026-11-06) | Raphael | Closed |
| 4 | Game name | Ella and Raphael | Phase 0 |
| 5 | Sound: **DECIDED, effects and music with separate toggles** (2026-11-06) | Raphael | Closed |
| 6 | Hosting: **DECIDED, free static host** (2026-11-06). Provider to pick at launch | Raphael | Phase 5 |
| 7 | School expectations: target speed, method taught | Raphael | Phase 1 |
| 8 | Mastery thresholds: **DECIDED, keep 4 s, 3 days**; review after two weeks of data (2026-11-06) | Raphael | Review at week 2 |
| 9 | Parent view: **DECIDED, simple** (facts mastered, weak facts, time played) (2026-11-06) | Raphael | Closed |
| 10 | Accessibility needs: **DECIDED, none specific**; standard accessibility applies (2026-11-06) | Raphael | Closed |

## 15. Assumptions and dependencies

- Ella can play regularly for 5 to 10 minutes, several days a week.
- A device with a modern browser is available.
- Raphael can playtest with Ella and give feedback in batches.
- Claude builds and iterates in this folder. No external services are required.

## 16. Build status (updated 2026-11-06)

**Phase 1 v1 built** in `game/` (`index.html`, `styles.css`, `engine.js`, `app.js`, `tests/tests.html`).

| Req | Status | Note |
|---|---|---|
| F1 question and answer | Built | Tap pad and keyboard. Answer auto-submits when the digit count matches |
| F2 generator and checker | Built, tested | 22 automated tests pass, including all 49 products in both orders and the full 1x1 to 10x10 grid |
| F3 wrong-answer handling | Built, tested | Answer shown, hint shown, fact returns within 5 questions |
| F5 session structure | Partly | Warm-up (3), main set (15 in total), summary. No boss or finale yet (Phase 2) |
| F6 diagnostic | Built | 16 questions: all 10 hard facts once plus 6 easy ones; sets starting levels. **Changed 2026-11-06:** a flat 10 stars per right answer (no speed or streak bonus, so no pressure to rush; max 160). Before, it gave none, which contradicted Hoot's "every right answer earns stars" on her very first round. Scout stays off the trophy board |
| F7, F8 adaptive engine | Built, tested | Per-fact score; ~70/20/10 selection verified by simulation; no back-to-back repeats |
| F10 points | Built, tested | Base, speed, first-try, improvement, streak multiplier; points never decrease |
| F18 progress grid | Built | 7x7 map with colour and tick; dotted outline marks the 10 hard facts |
| F20 feedback copy | Built | 11 correct and 10 wrong variants, no shaming |
| F21 sound toggles | Built | Effects and music toggles; sounds are generated in the browser, no files |
| F22 reset | Built (early) | Behind a grown-up maths gate and a confirmation |
| L5, L7 hints | Built | Fact-specific tricks; every hint tested to end on the right product |
| F24 to F27 interludes and celebrations | Built, tested | Bonus rounds at questions 5 and 10: Firefly catch, Spot the mistake, Missing number. Leaf bursts, toasts, hopping owl. All three formats checked in the browser, right and wrong answers |
| F28 music rotation | Built, rotation tested | Four tracks; not listened to |
| F29 voice | Built | Spoken sentences tested; checked that the browser is asked to say them; not listened to |
| F30 dance break | Built, tested | Shown in the browser at streak 5; Skip works |
| F32, F33 prizes and trophy board | Built, tested (43 of 43 tests pass) | Prize bars, trophy board screen, rank on the summary, prize-unlocked card. Checked at phone width with seeded history and a full scripted quest that crossed 1,000 stars |
| Not built yet | | F4, F9, F11 to F17, F19, F23, L6 visual model, offline service worker, boss battles |

**Deviations from the spec**
- Added a "Not sure" button: she can ask to see the answer without guessing. It counts as a miss, with no penalty.
- A miss removes one mastery day from that fact. This keeps "mastered" honest.
- Companion (an owl, "Hoot") and all art are emoji and CSS placeholders. Name "Times Tables Forest" is a working title.

**Not verified**
- Sound and music were not listened to.
- Real playing speed: tests used scripted instant answers, so speed bonuses and the 4-second rule need a real playtest.
- Opening `index.html` directly from a file, and real iPad or Android devices.

## Appendix A: Fact set

**Hard facts (10):** 6×6=36, 6×7=42, 6×8=48, 6×9=54, 7×7=49, 7×8=56, 7×9=63, 8×8=64, 8×9=72, 9×9=81.

**Known facts (maintained):** all pairs involving 3, 4 and 5 with 3–9, e.g. 3×6, 4×7, 5×8.

## Appendix B: Glossary

- **Fact:** an unordered pair of factors and its product (7×8 = 8×7 = 56).
- **Mastery:** accuracy and speed standard set in section 5.
- **Gentle failure:** a wrong answer costs no points, lives or progress.
- **Spaced return:** bringing a fact back after a delay to test real recall.
