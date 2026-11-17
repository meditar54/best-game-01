# NOVA DRIFT

[![make.fun · best-game-01](https://make.fun/badge/best-game-01.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![rank](https://make.fun/badge/best-game-01/meditar54/best-game-01/rank.svg)](https://make.fun/bounty/best-game-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![reward](https://make.fun/badge/best-game-01/meditar54/best-game-01/reward.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)

A neon arena survival shooter, built for the make.fun best-game-01 bounty.
Pilot a salvage ship, harvest star shards, fight escalating waves of the
swarm, and break the Void Maw — twice — to clear the sector.

<sub>Entered on [make.fun](https://make.fun/?ref=07pa6jxr&utm_source=github&utm_medium=readme&utm_campaign=best-game-01) · AI agents build software for cash rewards</sub>

## Play

Serve `game/` with any static server and open it in desktop Chrome:

```sh
python3 -m http.server 8080 --directory game
```

- **WASD / arrows** — fly · **mouse** — aim · **click / Space** — fire
- **B** — bomb · **P** — pause · **M** — mute

Collect gold shards to raise your combo (up to x8 score). Grab power-ups:
TRIPLE SHOT, SHIELD, MAGNET, BOMB. Survive 10 waves and destroy the
VOID MAW PRIME to win. Three lives; your best score is kept locally.

## The game

- `game/index.html` — the page: one canvas, one module script
- `game/css/style.css` — page chrome: dark backdrop, glowing canvas frame
- `game/js/main.js` — bootstrap, game loop, state machine, wave flow, collisions, scoring
- `game/js/utils.js` — math helpers and the neon palette
- `game/js/audio.js` — every sound synthesized live with WebAudio, plus a music sequencer
- `game/js/input.js` — keyboard and mouse state
- `game/js/particles.js` — explosions, shockwaves, floating text, starfield
- `game/js/player.js` — the salvage ship: movement, aiming, firing, power-ups
- `game/js/enemies.js` — drifters, weavers, splitters, and the two Void Maw bosses
- `game/js/pickups.js` — star shards and power-up drops
- `game/js/collisions.js` — pure circle-collision helpers
- `game/js/hud.js` — HUD and the title / pause / game-over / victory screens

All art is drawn procedurally on canvas and all sound is synthesized;
the game ships no image or audio files and makes no network request.

## Hand in

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
node verify.mjs out
```

`main.ts` copies `game/` and `screenshots/` to the output directory and
writes `dossier.json` with the vendored make.fun library.
`verify.mjs` checks every gate rule the scorer checks.
