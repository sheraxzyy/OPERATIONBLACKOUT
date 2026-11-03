# OPERATION: BLACKOUT

A tactical top-down military shooter built with **Phaser 3**, **TypeScript**, and **Vite**. All art and audio are generated at runtime; no external assets are required.

## Status

Implemented and build-ready:
- 20 mission campaign plus Survival, Training and Free Play modes.
- 6 weapon classes, attachments, equipment, 5 vehicle types.
- 5 enemy AI classes with perception, cover, flanking and reinforcements.
- Easy / Medium / Hard difficulty scaling.
- Persistent save with versioned schema and recovery.
- HUD, minimap-less world camera, objectives, pause, results.
- `npm run dev`, `npm run build`, `npm run test` all pass.

## Requirements

- Node.js 20+
- npm 10+
- Desktop Chrome, Edge or Firefox

## Install

```bash
npm install
```

## Commands

```bash
npm run dev        # start Vite dev server (127.0.0.1:5173)
npm run typecheck # TypeScript check
npm run test      # Vitest suite
npm run build     # production build
npm run preview   # preview built app
```

## Controls (default)

- `WASD` move, `Mouse0` fire, `R` reload, `E` interact.
- `Shift` sprint, `Ctrl` crouch, `1/2/3` switch weapons.
- `G` grenade, `F` vehicle enter/exit, `L` flashlight, `H` medkit.
- `Escape` pause.

Controls are stored in the save and can be rebound in Settings.

## Architecture

- `src/core` – engine-agnostic logic (combat, weapons, progression, saving, keybinds).
- `src/data` – weapon, attachment, equipment, vehicle, enemy, map and mission data.
- `src/art` – procedural Canvas2D texture factory.
- `src/systems` – audio, pathfinding.
- `src/world` – deterministic `MapBuilder`.
- `src/game` – entities and systems (`Player`, `Enemy`, `Vehicle`, projectiles, grenades, weather, objectives).
- `src/scenes` – Phaser scenes (`Boot`, `Menu`, `Campaign`, `Briefing`, `Loadout`, `Armory`, `Garage`, `Stats`, `Settings`, `FreePlay`, `Training`, `Survival`, `Game`, `Hud`, `Results`).
- `src/ui` – theme and reusable components.

## Generated assets

All textures are generated in `src/art/textures.ts` (soldiers, weapons pickups, vehicles, props, objectives, FX). Audio is synthesized in `src/systems/audio.ts`. No external images or audio files are bundled.

## Save data

Save schema v1. Stored in localStorage with IndexedDB mirror and normalized on load. Corrupt data is repaired to safe defaults. Progress can be reset from Settings (controls preserved).
