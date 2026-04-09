# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Mycelium Empire is a vanilla HTML/CSS/JavaScript incremental idle clicker game deployed to GitHub Pages at myceliumempire.net. There is no build system, no npm, no TypeScript — just three files served statically.

| File | Purpose |
|------|---------|
| `index.html` | DOM structure: all modals, tabs, UI containers |
| `game.js` | All game logic, state, calculations, event handlers (~2400 lines) |
| `style.css` | All styling: dark theme, animations, responsive layout (~3000 lines) |

External dependencies loaded via CDN only: Firebase SDK (compat v10.12.0) for auth/Firestore, and Google Analytics.

## Development

**To run locally:** Open `index.html` directly in a browser, or use any static file server:
```bash
python3 -m http.server 8080
# or
npx serve .
```

No build step, no install step, no test framework.

## Architecture

### State & Persistence

All game state lives in a flat global object (declared at the top of `game.js`). State is persisted:
- **localStorage** — auto-save every 30 seconds; loaded on page load
- **Firestore** — manual save/load via the Profile modal (requires Firebase auth)
- **Export/Import** — JSON string copied to clipboard

The save format is a serialized subset of the global state object.

### Main Game Loops

Three intervals drive the game:
- `setInterval(..., 50ms)` — production tick, UI update (sps display, progress bars)
- `setInterval(..., 1000ms)` — messages, tutorial progression checks, auto-save trigger
- `requestAnimationFrame(animateMycelium)` — canvas animation for the mycelium network background

### Core Systems

**Producers** — 20 types from "Mycelium Threads" up to "The Absolute". Cost scales as `Math.ceil(baseCost * 1.15^owned)`. Defined as an array of objects near the top of `game.js`.

**Upgrades** — ~40 permanent multiplier upgrades purchased with spores; prerequisites based on producer ownership count.

**Prestige (Sporulation)** — Resets producers/upgrades/spores but retains achievements and earns Essence. Players pick a destination biome. Legacy multiplier: `1 + prestigeCount * (0.5 or 0.75 with codex upgrade)`.

**Codex** — Persistent upgrades bought with Essence (earned from prestige). Affects cost reduction, production multipliers, biome bonuses, and pulse multipliers.

**Biomes** — Unlocked via prestige. Each biome has a unique modifier and sometimes a special mode flag (`swampMode`, `arcticMode`, `volcanicMode`) that alters game mechanics.

**Seasons** — 4-cycle progression (Spring/Summer/Fall/Winter) with production modifiers; advance automatically based on spore milestones.

**Hivemind Pulse** — A charged burst-click mechanic with a combo timer. Unlocked by the "Hivemind Awakening" upgrade.

**Symbiosis/Bonds** — Companion organisms that provide output bonuses; must be fed periodically or they break.

**Research** — Purchasable multipliers (production, clicks, pulse, cost reduction, symbiosis) that persist across prestige.

**Achievements** — Milestone rewards that apply permanent multipliers to production/clicks/pulse.

### UI Structure

- **Left panel:** Stats (spores, sps), status bar (season/event/bond), main clicker button, biome progress bar
- **Right panel:** 8 tabs — Producers, Upgrades, Research, Bonds, Goals, Stats, Essence, Lore
- **Modals:** Profile (auth/cloud save), Settings (event toggles, disaster mode)
- **Tutorial overlay:** 5-step guided intro, tracked in localStorage, auto-advances on milestones

### Firebase

Config is embedded at the top of `game.js`. Authentication uses email/password. Firestore stores saves per user UID. The `FIREBASE_CONFIGURED` flag controls whether cloud features are active.
