# Sharks and Minnows 🦈🐟

A single-player browser arcade game inspired by the classic playground game. You're a minnow. Swim from the starting shore across the pool to the safe shore — without getting caught by the sharks patrolling the water. AI teammate minnows make the crossing alongside you (and don't always make it).

**Play it live:** https://reece-bunnage.github.io/sharks-and-minnows/

## How to Play

- Cross from the left shore to the right shore to complete a round.
- Each round gets harder: more sharks, faster sharks.
- Sharks patrol unpredictably — but swim too close and they'll notice you and give chase (watch for the red eye). A chasing shark is slightly faster than you: dash away or reach a shore to shake it off.
- **If a shark touches you, you go all the way back to Round 1.** That's the rule of the pool.
- Teammates can be caught too; they're out for the round, but your run continues.

## Controls

| Action | Keys |
| ------ | ---- |
| Move   | WASD or Arrow keys |
| Dash   | Space or Shift (short speed burst, ~2 second cooldown) |
| Start / Restart | Enter |

## Running Locally

No build step, no dependencies. Just open `index.html` in a modern browser.

## Tech

Plain HTML, CSS, and vanilla JavaScript with Canvas rendering. All art is drawn programmatically — no external assets.
