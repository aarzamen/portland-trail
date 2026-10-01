# The Portland Trail Implementation Plan

> **For agentic workers:** Use superpowers:subagent-driven-development. Track completed work below; keep original evidence unchanged.

**Goal:** A complete, tested local route with a responsive illustrated interface.

**Architecture:** Pure deterministic rules and data feed a native-module browser UI. LocalStorage holds validated versioned state; a static build requires no runtime service.

**Tech Stack:** HTML, CSS, JavaScript modules, Node built-in test runner, browser automation.

**Spec:** [Playable rebuild design](../specs/2026-10-01-playable-rebuild-design.md)

## Global constraints

- Preserve original resource and profession ids and all source evidence.
- Root owns assets, tooling, integration, and documentation; engine and UI tasks own disjoint files.
- Use the spec's exact integration contract. Do not add runtime dependencies.
- No publication in this development pass.

## Review focus

- Malformed saves and localStorage failure must not erase valid progress or crash play (tasks 1, 2).
- Pending-event reload and repeated clicks must not skip or duplicate outcomes (tasks 1, 2).
- Death, unaffordable actions, and critical/arrival transitions must remain coherent (task 1).
- A player at a location or with depleted supplies must have clear next actions (tasks 1, 2).
- Long names, phone widths, keyboard-only play, focus restoration, and all image loads (tasks 2, 3).

## Task 1 Rules and persistence contract

Files: `app/src/data.js`, `app/src/engine.js`, `app/tests/engine.test.js`, `app/tests/routes.test.js`.

Consumes source constants and spec. Produces all data and engine exports specified in the integration contract.

- [ ] Write and run behavioral tests first, verifying failure before implementation.
- [ ] Implement validated pure transitions, deterministic RNG, coherent arrivals/endings, and safe serialization.
- [ ] Test critical death, independent New Game, exactly-once outcomes, restored events, affordability, permanent death, restrictions, all advertised abilities and item uses.
- [ ] Prove seeded successful and losing complete routes; tune solvability with small seeded sample.
- [ ] Review implementation against tests and handoff.

## Task 2 Browser interface

Files: `app/index.html`, `app/src/main.js`, `app/src/styles.css`.

Consumes the exact task 1 interface and assets prepared in task 3. Produces full setup/shop/travel/location/dialog/ending flows. Can be implemented independently against the fixed contract while task 1 runs.

- [ ] Build semantic controls and safe text handling for editable names.
- [ ] Implement new/resume, all actions, live resource feedback, clear costs, and visible storage warnings.
- [ ] Implement native dialog focus, pending-event reopening, replacement confirmation, and keyboard navigation.
- [ ] Check script syntax and then browser integration when task 1 is ready.

## Task 3 Assets and local tooling

Files: `app/assets/*`, `app/package.json`, `app/scripts/*`, `app/tests/browser*`, project status documents.

- [ ] Inspect PDF pages and masters; copy selected illustrations to semantic asset paths and record source hashes.
- [ ] Provide npm test/build/start commands with zero product dependencies and a localhost server.
- [ ] Run full rules suite, build, and browser journeys at 390/414/430/768/1440px.
- [ ] Capture screenshots; check for overflow, missing images, and browser errors.
- [ ] Obtain fresh review of integrated source and acceptance evidence; resolve material findings.
- [ ] Refresh project setup and handoff with tested behavior, runnable commands, remaining limitations.

## Execution decisions

The project instructions explicitly ask for autonomous ordinary choices and parallel independent scaffolding. Use separate engine and UI implementers against the fixed contract while the controller prepares assets and tooling. This overrides generic skill approval checkpoints and serial execution where tasks do not share writable files. No prior repository existed; initialize a dedicated local development branch and preserve the existing folder as the user-designated root.
