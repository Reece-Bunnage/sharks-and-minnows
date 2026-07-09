# Sharks and Minnows — Build Spec

## Overview

Build a simple, single-player browser game called **Sharks and Minnows**, inspired by the classic playground game. The player controls a minnow trying to swim across a pool without being caught by shark bots. The game should be nostalgic in *feel* (simple, arcade-y, childhood-game energy) but with clean, polished modern visuals — not pixel art, not retro-8-bit. Think smooth shapes, soft gradients, subtle animation, rounded forms — closer to a well-made casual mobile/flash game than a NES throwback.

The finished product must be a fully self-contained static site, deployable directly to GitHub Pages, with no backend, no build step, and no external asset downloads required at runtime (SVG/CSS/Canvas-drawn art only, or embedded/inlined assets if truly needed).

## Repo & Deployment Setup

Please handle the full repo setup as part of this task:

1. Initialize a new git repository for this project.
2. Create a clean project structure (e.g. `index.html`, `style.css`, `game.js`, or a reasonable equivalent — your call on organization).
3. Create a `README.md` with a short description of the game, controls, and a link placeholder for the live GitHub Pages URL.
4. Set up GitHub Pages deployment (via the `main` branch root, or a `gh-pages` branch/GitHub Actions workflow — whichever is simplest and most reliable).
5. Make an initial commit and push to a new GitHub repository named `sharks-and-minnows`.
6. Confirm the Pages URL once deployed, or clearly document the steps needed if Pages activation requires a manual step in GitHub's UI that you can't perform directly.

## Core Gameplay Loop

- The play area is a horizontal "pool," with a shore/start zone on the left and a goal shore on the right (or top-to-bottom — pick whichever reads more clearly at a glance; horizontal is the default assumption).
- The player controls one minnow. There are also **AI teammate minnows** attempting the same crossing simultaneously, to capture the group feel of the original playground game.
- **Shark bots** patrol the pool between the shores. Their movement is **random and unpredictable** — not pathfinding toward the player. Implement this via randomized direction/speed changes on randomized timers, not real chase AI. A little bit of per-shark personality is nice (e.g. one lurks mid-pool, one patrols edge-to-edge, one is fast but jittery) — but all still fundamentally randomized, not player-seeking.
- If any shark touches the player minnow, the round ends immediately:
  - **The player is sent back to the very start of Round 1** (not just the current round — a full reset). This is an intentional, punishing design choice per project requirements — the difficulty ramp is meant to matter.
  - AI teammates can also be caught by sharks; this does not need to end the player's run, but should be visually acknowledged (e.g. teammate is removed from the round, maybe a small effect).
- If the player successfully reaches the far shore, they win the round and advance to the next round.

## Difficulty Ramp / Round Structure

- The game is structured in rounds, each crossing attempt getting harder.
- Concrete example ramp (adjust as needed for good pacing/playtesting, but this is the intended shape):
  - Round 1: 1–2 sharks, slower speed, more room to maneuver.
  - Each subsequent round: increase shark count and/or shark speed and/or shrink the safe passage room slightly.
  - Consider capping difficulty increases at some reasonable round (e.g. round 8–10) so it doesn't become unwinnable, rather than scaling forever.
- Track and display current round number clearly during play.
- On a shark catching the player: reset entirely back to Round 1's starting conditions (see above).

## Dash Mechanic

- Player has a **dash** ability: a short burst of increased speed, usable to slip past a close call.
- Limited-use — pick a reasonable balance (e.g. dash has a cooldown timer, or a limited number of charges per round that refill between rounds). Cooldown-based is probably simpler and feels better in the moment — use your judgment.
- Should have a clear visual/motion cue when activated (e.g. brief speed trail, slight squash-and-stretch, etc.) so it feels responsive.

## Controls

- Arrow keys and/or WASD for movement (support both if easy).
- A dedicated key for dash (e.g. Spacebar or Shift).
- Simple 2D movement — no physics simulation needed, just direct velocity-based movement with screen-edge/shore boundary handling.

## Visual Style

- **Nice, clean visuals — not pixel art.** Smooth shapes (rounded rectangles, curves, soft gradients), pleasant color palette (blues/teals for water, warm sand tones for shores, a friendly color for the minnow, a slightly ominous but not scary gray/slate for sharks).
- Simple shape-based character design is fine and encouraged (e.g. a minnow as a small rounded teardrop/fish shape with a tail flick animation; a shark as a bigger sleek shape with a visible dorsal fin and subtle motion).
- Subtle water texture/motion in the background (e.g. gentle gradient shift, faint moving wave lines, or soft particle shimmer) — nothing performance-heavy, just enough to keep the pool from feeling static.
- Clean, readable HUD: current round number, lives/status if applicable, dash availability/cooldown indicator.
- Should look intentional and cohesive — like a small polished indie/casual game, not a programmer-art prototype.

## Technical Constraints

- Static site only: HTML + CSS + vanilla JavaScript (Canvas or SVG for rendering — Canvas is likely the better fit for animated sprites, but use your judgment).
- No build tooling, no external framework dependencies required to run — should work by simply opening `index.html` or visiting the deployed GitHub Pages URL.
- No external asset files needed if avoidable (draw everything programmatically); if you do decide a small number of assets meaningfully improve quality, keep them lightweight and included in the repo.
- Should run smoothly in modern desktop browsers; mobile responsiveness is a nice-to-have but not the primary target.

## Acceptance Criteria

- [ ] Game loads and runs by opening `index.html` directly, no errors in console.
- [ ] Deployed and playable via GitHub Pages at a public URL.
- [ ] Player can move a minnow with keyboard controls and dash on demand.
- [ ] AI teammate minnows are present and cross alongside the player.
- [ ] Shark bots move with randomized, unpredictable patterns (not pathfinding/chasing).
- [ ] Getting caught by a shark resets the player fully back to Round 1.
- [ ] Reaching the far shore advances to the next round, and each round is measurably harder than the last (more/faster sharks and/or tighter space).
- [ ] Round number is visibly displayed during play.
- [ ] Visual style is clean and polished — smooth shapes and color, not pixel/8-bit art.
- [ ] `README.md` explains what the game is, controls, and links to the live version.

## Notes for the Agent

- Where this spec is ambiguous or leaves room for judgment (exact pacing numbers, exact color palette, exact shark personality variety, exact dash cooldown length), use your best judgment to make something that feels good to play, and briefly note in your final summary what choices you made and why.
- Favor a fun, satisfying feel over strict literal adherence to any single number in this doc — the intent (randomized non-chasing sharks, escalating difficulty, full reset on death, clean modern visuals, dash mechanic, AI teammates) is what matters most.
