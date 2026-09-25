# SysCommander

A Commander Keen style platformer, playable in the browser, about the Syscoin journey.
You are **SysCommander**, a Syscoin supporter in a football helmet with a Z-DAG blaster and
a pogo stick, fighting your way through the challenges Syscoin has faced.

> Fan-made game. It isn't affiliated with the Syscoin Foundation, and the history is simplified for fun.

## Play

Open `index.html` in any modern browser. It has no build step or dependencies and works straight from disk
or from any static host, such as GitHub Pages.

| Action | Keys |
| --- | --- |
| Move | Arrow keys / A, D |
| Jump | Z, Space, Up / W (hold to jump higher) |
| Fire Z-DAG blaster | X, Ctrl, F |
| Pogo stick on/off | C, Alt (hold jump while bouncing for big hops) |
| Start / confirm | Enter |
| Pause / mute | P or Esc / M |

Touch devices get on-screen buttons.

## The eras

1. **Genesis Block (2014)**: Syscoin launches, merge-mined with Bitcoin. Watch out for Rug Pullers and FUD Ghosts. Find the pogo stick.
2. **The Flash Crash (2018)**: the day SYS briefly traded at 96 BTC on a major exchange. Ride the moving price candles and dodge the whales dumping red candles on you.
3. **Crypto Winter (2018/19)**: slippery ice and charging Bear Markets, while the builders keep shipping (Z-DAG, the SYS-Ethereum bridge).
4. **The Gas Wars (2021)**: gas guzzlers everywhere. Reach the NEVM.
5. **The 51% Siege**: boss fight. Collect all 4 Chainlocks to break the 51% Attacker's shield, then blast it.

## Pickups

- Blue **SYS coins** (100) and orange **BTC merge-mining orbs** (500). Collect every coin in an era for a bonus.
- **Z-DAG cells** give 5 more blaster shots.
- **Keygems** open red force-field gates.
- **1UP** helmets. You also get an extra life every 20,000 points.
- **Sentry Node flags** are checkpoints.
- A pogo stomp from above damages regular enemies.

## Development

- `js/levels.js` has the level maps, built with a tiny builder API. The tile legend is at the top of the file.
- `js/render.js` draws all the art procedurally with pixel rectangles. There are no image assets.
- `js/game.js` holds the game loop, physics, enemies, boss and screens.
- `js/audio.js` synthesizes the sound effects with WebAudio.

Debug URL parameters: `?level=3` starts at era 3, and `?god` makes you invincible.

After editing a level, run the reachability checker. It simulates the player's jump and pogo physics
and verifies that every keygem, chainlock and exit can be reached:

```sh
node tools/check-levels.js
```
