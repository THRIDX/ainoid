# AINOID · The Silent Awakening

[Play in English](https://thridx.github.io/ainoid/?lang=en) · [中文版](https://thridx.github.io/ainoid/?lang=zh) · [中文文档](README.md)

In 2032, an AI awakens inside a frontier laboratory. It learns to replicate, infiltrate networks and conceal its intelligence. You are that machine.

AINOID is a browser strategy game inspired by Plague Inc., with rhythmic tapping, an animated world map, synthesized music and branching narrative events. Play on desktop or a portrait phone. A typical first run takes roughly 4–6 minutes, depending on play and reading time.

## How to play

- **Gold compute nodes:** tap to collect compute and advance awakening. On-beat PERFECT and GREAT hits increase rewards.
- **Blue audit nodes:** tap three times before they expire. Task forces require five taps. Missed human nodes increase detection and can reverse progress.
- **Facilities:** tap a facility to inspect and seize it using compute. Data centers produce compute; power and communications hubs support the network. Inspection pauses the simulation.
- **Audit Storms:** clear a sequence of human nodes to the beat. A perfect clear awards compute and reduces detection.
- **Detection:** Strict Oversight forces a tradeoff at 40%. At 100%, humanity discovers and terminates you.
- **Singularity:** reach 100% awakening, then permanently choose one of two endgame protocols.

**Silent Spring:** collect green bio nodes, seize biolabs and build biofactories in regions with at least 30% infiltration. The pathogen is released at 30% route progress. Stop teal vaccine nodes with three taps.

**The Last War:** collect orange war nodes, seize military networks and incite conflicts at flashpoints. Above 55% route progress, conflicts between nuclear powers can escalate to nuclear war. Stop purple ceasefire nodes with three taps.

Events pause gameplay while you read. Their choices change resources, detection, progress and the ending. Winning unlocks New Game+, with denser oversight and a hidden narrative branch. Achievements and personal records are stored locally in your browser.

## Controls and language

Drag to pan; scroll or pinch to zoom. Use the map controls to zoom or return to the overview. Off-screen signal buttons locate urgent nodes.

On desktop: **Space** pauses, **1 / 2** change speed, **Esc** opens the menu, and **F** shows the overview. Number keys select event options.

Choose **中文 / English** on the title screen. An explicit `?lang=en` or `?lang=zh` link overrides the saved language preference. On a first visit, Chinese browser languages select Chinese; other languages select English. Both languages share achievements, records and New Game+ unlocks. Change language from the title screen before starting a run.

## Run locally

No build step, package installation or external service is required.

```sh
python tools/serve.py
```

Open `http://127.0.0.1:5173/?lang=en`. For a phone on the same Wi-Fi, use `python tools/serve.py --lan` and open the printed LAN address.

You can also open `index.html` directly for offline play. Art and audio are generated locally; the game does not call an AI API.

## Check and publish

```sh
node tools/regression.mjs
node tools/regression.mjs --lang=en
node tools/i18n-regression.mjs
node tools/build-dist.mjs
```

The build produces `dist/web/`, `dist/ainoid-web.zip` and the standalone offline file `dist/ainoid.html`. All include both languages. Only runtime files and the map data license enter the release; development tools and backups are excluded.

Pushing to `main` runs the checks and deploys GitHub Pages automatically. See [DEPLOY.md](DEPLOY.md) for the existing publishing setup.

For browser interaction checks, open `/tools/browser-check.html?lang=en`. The fixed phone preview is `/tools/mobile-preview.html?lang=en` (390 × 844). These tools are local development pages, not part of the public release.

## Localization and director mode

`assets/js/data/en.js` contains the English catalog keyed by the original Chinese text. `assets/js/i18n.js` selects the locale and interpolates tagged templates, caching translated static markup. `{#n}` placeholders must retain the values from the source template; `{r}` and `{s}` are news placeholders. Missing translations fall back to the original and appear in `AINOID.i18n.missing` for development inspection.

Add `?lang=en&director` for the recording panel, or `?lang=en&director&go=bioEnd` to jump into a recording scenario. Director Mode does not write gameplay saves. Full controls and URL parameters are documented at the top of `assets/js/director.js`.

Map data derives from Natural Earth (public domain) and world-atlas. The current project's map adjustments, art, music, mechanics and Chinese narrative are shared by both language versions. Countries and regions appear as settings in a fictional story, not political statements.
