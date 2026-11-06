# Times Tables Forest

A web game that helps an 8-year-old master the 6, 7, 8 and 9 times tables while keeping 3, 4 and 5 sharp. Magical-forest world, points and bonuses, bonus rounds every five questions, a dance break for every five right answers in a row.

Plain HTML, CSS and JavaScript. No framework, no build step, no dependencies, no accounts, no tracking. Progress is stored on the device only.

## Run it

```bash
python -m http.server 5173 --directory game
```

Open http://localhost:5173. Tests: http://localhost:5173/tests/tests.html

## How it teaches

- Only 10 facts are genuinely new (6×6, 6×7, 6×8, 6×9, 7×7, 7×8, 7×9, 8×8, 8×9, 9×9). Everything with 3, 4 or 5 is already known by symmetry.
- A first "Forest Scout" sets her starting level. After that, about 70% of questions come from weak facts.
- A wrong answer shows the answer and a trick (for example 6×7 = 5×7 + 7), and the fact returns within a few questions.
- A fact counts as mastered when it is answered correctly in under 4 seconds on 3 different days.

## Files

- `game/engine.js`: pure game logic (facts, mastery, selection, scoring, bonus rounds). Tested.
- `game/app.js`: screens, storage, sound, voice, animation.
- `game/tests/tests.html`: automated tests, run in the browser.
- `PRD.md`: product requirements and build status.

## Private audio

`game/audio/private/` is for personal-use audio only and is excluded from this repository. Do not commit or host copyrighted music.
