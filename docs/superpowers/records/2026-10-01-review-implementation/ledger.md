# SDD ledger — plan: docs/superpowers/plans/2026-10-01-review-implementation.md

Worktree: /Users/ama/The Portland Trail/.worktrees/review-implementation (branch feat/review-implementation, from main 2143195).
Spec: docs/superpowers/specs/2026-10-01-review-implementation-design.md
Plan/spec commit: 1b5b3bd (BASE for wave 1).
Skill scripts: /Users/ama/.claude/plugins/cache/claude-plugins-official/superpowers/6.4.1/skills/subagent-driven-development/scripts/

## Preflight scan

| Tasks | Shared file or interface | Produces vs consumes | Finding |
|---|---|---|---|
| 1, 2 | actions.js, selectors.js, engine.js; action table | T1 gives `{type, check, apply}`; T2 adds `describe`, `availableActions` | consistent; serial |
| 1, 3 | data.js numbers | T3 changes only (T) numbers; T1 tests assert against constants | consistent; serial |
| 1+2, 7 | engine API | spec section 5 | consistent |
| 4, 5 | pixelfont.py, pixel-font.txt, portland-pixel.woff2 | T4 produces; T5 rebuilds the font through `build_woff2` | consistent after adding "deterministic build" to T4 |
| 1, 5 | scene ids | both from spec sections 3.8 and 7 (27 ids) | consistent |
| 5, 7 | asset paths | spec section 7 | consistent |
| 6, 7 | build-info.js, sw.js protocol, index.html refs, TEST_URL/TEST_DIST_URL | spec section 8 | consistent |
| 6, 7 | test-browser.mjs runs `tests/browser-*.mjs` | helper named `browser-helpers.mjs` would be run as a suite | CONFLICT, ruled below |
| 6, 3 | package.json `balance` script vs scripts/balance.mjs | T6 adds entry, T3 creates file | consistent |
| 6, 10 | format and typecheck | T6 config; T10 makes them pass | consistent |
| 7, 8 | main.js, views, dialogs, styles; hooks | T7 produces regions and storage API; T8 fills ending and dialogs | consistent; serial |
| 7+8, 9 | styles.css, data hooks, sound stub | serial | consistent |
| 4, 9 | font family and path | "Portland Pixel", app/assets/fonts/portland-pixel.woff2 | consistent |

Per task self-agreement: T1 ok (selectors.js holds only recommendSupplies; helpers in state.js). T2 ok. T3 ok (may change data.js numbers only). T4 ok. T5 ok (old manifest.json replaced by the new format at the same path). T6 ok. T7 ok. T8 ok. T9 ok. T10 ok.

## Rulings

- Ruling: the browser test helper lives at `app/tests/support/browser.mjs`, not `browser-helpers.mjs` — the runner globs `browser-*.mjs` — costs nothing if wrong.
- Ruling: lanes rules (T1→T2→T3), assets (T4→T5) and tooling (T6) run in parallel with path-scoped commits, against the skill's "never dispatch implementers in parallel" — the owner's standing instruction says never serialize lanes that share no state, and the lanes own disjoint files — if wrong, an interleaved commit could capture another lane's file; review packages are path-scoped to catch it.
- Ruling: no pause for plan approval — AGENTS.md says not to stop after a plan, and the owner said "implement all these changes" — if wrong, the owner sees design decisions only in the result.
- Ruling: plan steps give exact acceptance cases instead of full code listings — implementers are capable models and writing every line twice buys nothing — if wrong, more variance between implementers; task reviews gate it.
- Ruling: the display typeface is drawn in-house (Task 4) instead of downloading VT323, Silkscreen or Departure Mono — a file download needs the owner's explicit permission and an original face has no licence burden — if wrong, headings look less polished; Task 9 may keep the system face where the pixel face reads worse.
- Ruling: D2, the outbreak becomes a critical choice with no "everyone dies" branch, and its description changes only from "ends the journey" to "catches up with the van" — it is the review's own suggestion, which the owner approved; the handoff asked that the joke's tone be reviewed with the owner — if wrong, the owner restores the brutal version by editing one encounter in data.js.
- Ruling: an empty tank no longer ends the journey; last resorts replace it (F3) and the only loss is the death of the whole party — it removes the unfair two-click loss (B2) at the root — if wrong, losing takes longer to reach.
- Ruling: capacity is a per-item maximum (D7), with food at 100 so the prepper's starting kit stays as in the source — if wrong, the limits need retuning.
- Ruling: E6 (archive to a GitHub release) is not done — it needs a publish and a history rewrite, both outside what AGENTS.md allows — the owner decides.
- Ruling: models — implementers T1, T2, T3, T4, T7, T8, T9 on fable (design judgment); T5, T6 on opus; T10 on sonnet; task reviewers on opus; final review on fable.

## Progress

- Wave 1 dispatched at BASE 1b5b3bd (parallel lanes):
  - Task 1 implementer: agent af6d9df0c6d42edef (fable). Report: task-1-report.md
  - Task 4 implementer: agent ad82ddb2b56f6be8b (fable). Report: task-4-report.md
  - Task 6 implementer: agent adbc08c39ebba53af (opus). Report: task-6-report.md
- Task 6: implementer DONE_WITH_CONCERNS, commit b9dced8 (19/19 tooling tests). Review dispatched: agent a4337a62ac1542ca7 (opus), package review-1b5b3bd..b9dced8.diff.
  - Ruling: add @types/node as a fourth dev dependency and "types": ["node"] in jsconfig (TypeScript 7 needs both to type-check tests) — spec named three dev dependencies but its own typecheck scope includes Node tests — costs nothing if wrong; goes into Task 6's fix round.
  - Ruling: the Task 6 commit keeps its Co-Authored-By: Claude Opus 5.5 line — it is the truthful author, and amending would rewrite history under concurrent lanes.
  - Ruling: Tasks 7 to 9 use PORT=4387 (or PORT=0), not 4174 — 4174 is held by the main checkout's dist server (pid 38121).
  - Ruling: accept npm start = build then serve the build, npm run dev = serve source — spec left it open; the built game is what a player should run (stamp, offline) — Task 10 documents it; if wrong, swap two lines in package.json.
  - Notes for Task 7 from the T6 report: footer skips empty stamp parts (branch is '' when detached); send cache-scenes with absolute URLs on every load.
- Task 4: implementer DONE, commit 5a45131 (104 glyphs, 1,732-byte WOFF2, deterministic). Controller looked at specimens: reads cleanly. Review dispatched: agent a40bd55f150f6fb87 (opus), package review-b9dced8..5a45131.diff.
  - Notes for Task 9 from the T4 report: headings in the pixel face need font-weight 400 and -webkit-font-smoothing: antialiased.
  - Note for Task 5 from the T4 report: importing pixelfont can create app/scripts/__pycache__/ on machines without PYTHONDONTWRITEBYTECODE; prevent or ignore it.
- Task 6: review (opus) = Needs fixes. Important: typecheck needs @types/node (plan-mandated). Spec: two lines over 120 chars. Fix round 1 dispatched to the original implementer (resumed adbc08c39ebba53af) with 5 items: @types/node + types; two long lines; cache name with content digest (stale art on same-commit rebuild); drop .mjs from shell rules; store navigations under ./.
  - Ruling: minors 2, 4 and 5 from the T6 review are fixed in this round rather than deferred — npm start now serves the build, so a stale cache hits the normal play path, and all three are small — costs one slightly larger fix diff.
  - Spec amended (commit follows): cache name portland-trail-<sha>-<digest>; fourth dev dependency @types/node; types: [node]; npm start/dev semantics.
  - Task 6: minor (deferred): untested failure paths of versionPage/replaceLine and HEAD responses.
  - Task 6: minor (deferred): spawn-server helper duplicated in test-browser.mjs and tooling.test.js; tooling.test.js is 638 lines for four tools; build.mjs mixes stamp code with the build.
  - Task 6: minor (deferred): dirty-flag assertion can flake while other lanes commit (not in CI).
  - Task 6 review ⚠️ for Task 7's review: page registers the worker only in build mode and unregisters/clears caches in dev mode; committed browser test of the worker (browser-offline.mjs).
- Task 4: review (opus) = Spec ✅, Approved, no Critical/Important. Commit trailer verified present (controller checked ⚠️).
  - Task 4: minor (deferred): text_width does not validate scale while draw_text does (pixelfont.py:155-159).
  - Task 4: minor (deferred): draw_text raises on an unknown character only after drawing the ones before it (pixelfont.py:174-180).
  - Task 4: minor (deferred): l and | differ only by the row-8 pixel.
  - Ruling: T4 minor 1 (unpinned Python dependencies) is handed to Task 5 — it pins exact versions in prepare-assets.py and in pixelfont.py's PEP 723 block (the only part of that file it may change) — a later task builds on it (manifest hash, identical font bytes), and it avoids a separate fix loop.
- Task 4: complete (commits b9dced8..5a45131, review clean)
- Task 5 dispatched at BASE 01310b4: implementer agent ab235d2f4476da1a1 (opus). Report: task-5-report.md
- Task 6: fix round 1 committed 613b1cf (21/21 tooling tests; fix report has covering tests, command, output). Scoped re-review dispatched: agent a3c2ee8ad2de794ae (sonnet), package review-01310b4..613b1cf.diff.
- Task 6: fix round 1/5 (5 addressed, 0 open — @types/node, long lines, cache digest, .mjs, navigation entries; commits 01310b4..613b1cf). Re-review (sonnet): all addressed, no new Critical/Important.
  - Task 6: minor (deferred): the digest fixture test assumes the temp folder is outside any repository and compares bytes that include the build date (UTC-midnight flake).
  - Plan text synced with the amended spec (cache name with digest; four dev dependencies).
- Task 6: complete (commits 1b5b3bd..613b1cf, review clean)
- Task 5: implementer DONE_WITH_CONCERNS, commit dbe884b (27 scenes x 2 sizes, sprites byte-identical, font identical, second run no change; scenes 13.9 MB -> 5.66 MB). Controller looked at the repaired signs: they read natively (White Stag lettering lighter than the original). Review dispatched: agent a66f70ad15fe7d3e8 (opus), package review-b97dd5b..dbe884b.diff.
  - Note for Task 10: docs/handoff/graphics-v2 and v3 READMEs link to removed manifest files and scripts; docs/handoff is read-only by spec, so the validation record must say where those files went.
- Task 1 implementer has committed b97dd5b and f2aed74 but has not reported yet.
- Task 1: implementer DONE_WITH_CONCERNS, commits b97dd5b, f2aed74, f8b33b8, d04b7c2 (129/129 own tests; npm test 150/150; mutation-tested with 213 deliberate breaks). Review dispatched: agent ac80ab34aeca74cfe (opus), path-scoped package review-task-1-1b5b3bd..d04b7c2.diff.
  - Ruling (to go into Task 1's fix round with the review findings): createGame keeps `seed` as given and sets `rng = mix32(seed)` with a 32-bit mixer — neighbouring whole-number seeds give nearly the same first roll (seeds 0 to 164 all meet an encounter on day one; 9.7% of seeds 1 to 2000 against the 30% chance), which would make typed seeds like 1, 2, 3 play alike (F12) — spec 3.1/3.10 and the "rng equal to the seed" test change; costs a small diff.
  - Ruling: unify "repair part" with "repair kit" in the two kept sentences (ferry talk, salvage) — spec's new lines say kit — one word in two templates; goes with the fix round.
  - Notes for Task 2 (T1 report section 7.2): refusalFor(state, action) gives transition's exact answer; choicesFor, needsOf, restHere, forageHere, mealHere, drivePlan, weatherOn, fill are exported; trap: the seed bombs' text uses {max} for the top of the yield while the item's own max is the van's limit; a migrated v1/v2 ending lost to an empty tank has everyone alive, so summarize must cope with a lost journey with no fallen traveler.
  - Notes for Task 3 (T1 report 7.3 to 7.5): four numbers are spelled out in sentences (kombuchaCost, quarantineDays, donation, standard repair cost); health numbers must stay whole.
- Task 5: review (opus) = Spec ✅, Approved, no Critical/Important. Controller viewed the contact sheet.
  - Ruling: three crops in the spec table were wrong (controller's own table): bike-convoy left edge 270 -> 287 (sliver of a cut-off person), motel top 0 -> 195 (baked title in the sky), wifi bottom 930 -> 865 (cut-through baked caption). Spec amended; fix round 1 sent to the original implementer (resumed ab235d2f4476da1a1) — visible defects in shipped art, cheap to fix now — costs one small extra round.
  - Ruling: the breakdown scene's sign "THE PORTLAND TRAL" joins the repairs (same class as L7, visible in the breakdown dialog), with the same "native or leave it" rule.
  - Fix round 1 also asks for bounds checks on repair rectangles and sprite crops (review minor 4).
  - Task 5: minor (deferred): White Stag lettering lighter than the original (accepted; owner may want a look).
  - Task 5: minor (deferred): font rewritten on every run (bytes identical, mtime changes); --only font prints an empty previews line; repairs[].rect is in cropped-image coordinates in -960 entries too; a spaces-only line would fail with a bare min() error.
  - Task 5: minor (deferred): garbled in-scene lettering remains in wifi (NO SIGGCNAL), nft, food-carts, free-box, rest-stop; not in scope of L7.
- Task 5: fix round 1 committed 6d156a5 (recrops, breakdown sign, bounds checks). Fix report being appended; scoped re-review NOT yet dispatched.

## PAUSED by the owner at 18:19 PDT on October 1, 2026

Nothing new is to be dispatched until the owner says to continue. State at the pause:

- Complete and reviewed: Task 4 (typeface), Task 6 (tooling).
- Task 5 (assets): built and approved; fix round 1 committed as 6d156a5; its fix report is being finished. NEXT on resume: path-scoped re-review of 6d156a5 (sonnet, with a look at the previews of bike-convoy, motel, wifi and the breakdown sign), then mark complete.
- Task 1 (rules engine): built, commits b97dd5b, f2aed74, f8b33b8, d04b7c2. Review by agent ac80ab34aeca74cfe was asked to deliver what it has. NEXT on resume: read its report; send fix round 1 to the implementer (resume af6d9df0c6d42edef) with the review's findings plus the two rulings above (rng = mix32(seed); "repair kit" wording); then scoped re-review; then mark complete.
- Not started: Task 2 (after Task 1 is complete), Task 3, Task 7, Task 8, Task 9, Task 10, final whole-branch review, controller's own checks (full suites, visual pass, installed app in the iOS Simulator), finishing.
- After the pause request: Task 5 fix implementer reported DONE for 6d156a5 (two runs with 0 changed, font hash unchanged, tree clean; fix report appended). Its notes: the breakdown repair uses two new optional repair keys (`area`, `shadow`); the breakdown panel is flat where it was speckled; wifi's bottom edge at 865 cuts one woman's shoes, and about 890 would keep them and still clear the caption (not applied; decide on resume, with the re-review).
- After the pause request: Task 1 review (opus, agent ac80ab34aeca74cfe) arrived, complete ("Not reviewed": nothing). Verdict: Approved; spec ❌ only on the literal "never throws for any input"; no Critical; two Important, both plan-mandated; eight Minor. NOT yet acted on. Prepared rulings for the fix round (resume implementer af6d9df0c6d42edef), to send on resume:
  1. Important 1, numbers written out in sentences (kombuchaCost "Two bottles", quarantineDays "Two days", donation "$20"/"Twenty dollars", "instead of 2"). Ruling: rewrite those sentences with slots filled from the numbers, and amend spec 3.2/3.8 to match: "It took {bottles} bottles of kombucha and a lot of confidence to hold the outbreak to {damage} health each."; "A {days}-day quarantine cost {damage} health each and most of the snacks."; label "Give ${donation} to make it stop", result "${donation} bought silence and a tote bag."; developer ability "… cost {repairCost} kit instead of {standardCost}." Add a test that no sentence in data.js spells a tunable number as a word or literal.
  2. Important 2, seeds. Ruling (already above): keep `seed` as given, start the generator at `mix32(seed)`; amend spec 3.1/3.10 and the "rng equal to the seed" test; add a test that small whole-number seeds meet a first-day encounter at close to eventChance.
  3. Wording: "repair part" -> "repair kit" in the ferry talk line and the salvage line.
  4. Minor 1: copy the action once with structuredClone inside try/catch in transition (failure -> "Choose a valid action."), pass the copy to the gates and to apply. Spec 5 wording to amend: "never throws for any action, given a state produced by createGame, deserializeGame or transition".
  5. Minor 2: repairs in save.js: phase shop with a pending encounter becomes location; clamp death.day to day; cap journal line length and day.
  6. Minor 3: strip control characters from names in createGame (keep loading old saves that have them).
  7. Minor 5: rename template slots that invite mistakes ({low}/{high} for the seed bombs' yield, {milesPerFuel} for the fuel text).
  8. Minor 7: events.test.js fixture stocks each response from its own needs instead of fixed amounts.
  9. Minor 4 (optional in the same round): one exported helper for the "never past the next stop" clamp used by moveVan and the drizzle effect; share the two-decimal food rounding.
  - Task 1: minor (deferred): test helpers (act, refusal, quiet, crew, …) are copied across the four test files; a shared app/tests/helpers.js can come with Task 2 or 3.
  - Task 1: minor (deferred): rules.test.js is 1,419 lines; split by topic later. selectors.js legCost repeats drivePlan's arithmetic (cross-checked by shop.test.js:235).
  - Task 1 review ⚠️: porting of every case from the three deleted test files could not be verified from the package (their text was excluded); the final review should spot-check against commit 1b5b3bd.
- Reminders for later dispatches: Tasks 7 to 9 use PORT=4387 or PORT=0 (4173 and 4174 belong to the main checkout); Task 7 gets the T6 notes (footer skips empty stamp parts; cache-scenes with absolute URLs on every load) and the T6 review ⚠️ items; Task 9 gets the T4 notes (font-weight 400, antialiased smoothing, sizes in multiples of 8px, line-height in multiples of 0.125em); Task 10 documents npm start = build + serve, and the handoff graphics READMEs' dangling links.

## RESUMED by the owner at 18:35 PDT on October 1, 2026

- Spec and plan amended for the Task 1 rulings (mix32 seed; sentences built from numbers; narrowed never-throws; {low}/{high} slots).
- Task 1: fix round 1 sent to the original implementer (resumed af6d9df0c6d42edef) with nine items (two Important, seven Minor) per the prepared rulings above.
- Task 5: scoped re-review of 6d156a5 dispatched: agent ad5071a827e931085 (sonnet), package review-2f5dd25..6d156a5.diff.
  - Ruling: wifi keeps its bottom edge at 865 (spec value); the option of about 890 to keep one woman's shoes is not taken — the edge also crops the man at left, and a lower edge brings the cut-off emoji bubble back — costs nothing visible.
  - Ruling: the two optional repair keys `area` and `shadow` are accepted (only the breakdown sign uses them).
- Ruling: after Task 2 completes, Task 3 (balance numbers in data.js and new test/script files) and Task 7 (interface) run in parallel — they share no files, and Task 7 depends on the engine API, not on the numbers — saves an hour of wall-clock; a balance change that alters a label is caught by Task 7's tests reading labels from the engine.
- Commit trailers: the session now runs on Opus 5.5; commits made by this controller from here on carry `Co-Authored-By: Claude Opus 5.5`.
- Task 5: fix round 1/5 (5 addressed, 0 open — three recrops, breakdown sign, bounds checks; commits 2f5dd25..6d156a5). Re-review (sonnet): all addressed, no new Critical/Important.
  - Task 5: minor (deferred): with `area`, the fit check measures text against the bounding rect, not the polygon; no visible defect today.
  - Task 5: minor (deferred): garbled in-picture signs remain in wifi (NO SIGGNAL, PITRCL) and motel (VAC_NCY, MDEND 0.0 !5); motel's VAC_NCY was ruled in-character by the spec.
- Task 5: complete (commits b97dd5b..6d156a5, review clean)
- Task 1: fix round 1 committed da1f3af (139/139 rules files; npm test 160/160). Spec amended (99058fa): counted nouns after a number slot use {one|many}.
- Task 1: plural-slot addendum was sent to the implementer, which STOPPED on the usage limit (18:58 PDT). It left UNCOMMITTED edits in app/src/data.js and app/tests/rules.test.js. NEXT on resume: resume af6d9df0c6d42edef (or a fresh implementer with task-1-brief.md + task-1-report.md) to finish the plural addendum from that working state, run the tests and commit; then scoped re-review of 6d156a5..HEAD for Task 1's paths (findings: the nine fix-round items + plural slots); then mark Task 1 complete and dispatch Task 2.

## STOPPED: usage limit reached at 18:58 PDT on October 1, 2026 (resets 19:40 PDT). No agents running.

## RESUMED 22:54 PDT
- Task 1: fix round 1/5 (10 addressed, 0 open — numbers from slots, mix32 seed, repair kit, action copy, save repairs, control chars, slot names, needs-based fixtures, shared clamp/rounding, plurals; commits da1f3af..22898b1). Re-review (sonnet): all addressed, no new breakage. Spec synced (save repairs, name stripping).
  - Note for Task 2: fill {standardCost} in the dev ability text and {donation} in the donate choice label.
- Task 1: complete (commits 1b5b3bd..22898b1, review clean)
- Task 2 dispatched at BASE 006ac52: implementer agent a4fa65cbf1506f21d (opus). Report: task-2-report.md
- Task 2: implementer DONE_WITH_CONCERNS, commit a42a4e5 (197/197; 36 new). Review dispatched: agent aed476168ca431e5c (opus), package review-006ac52..a42a4e5.diff.
  - Ruling: number-free interface sentences in selectors.js (TEXT) and actions.js (NEED_TEXT) stay there for now — spec 2 requires numbers in data.js, not every word; Task 10 may move them — costs a later mechanical move.
  - Ruling: Task 2's six interpretations (report section 6) accepted pending review.
- Ruling: Task 3 dispatched in parallel with Task 2's review — disjoint files (data.js numbers and new test/script files) — if Task 2's fix round changes option keys, Task 3's bots may need a small update.
- Task 3 dispatched at BASE a42a4e5: implementer agent a58690273a3e5298b (opus). Report: task-3-report.md
- Task 2: review (opus) = Spec ✅, Approved, no Critical/Important.
  - Task 2: minor (deferred): player-facing text constants in selectors.js (TEXT) and actions.js (NEED_TEXT, CONTINUE) outside data.js and outside the sentence lint.
  - Task 2: minor (deferred): forecast nextStop/nextShop/shortfall ignore drizzle cap and heat food multiplier (only `today` uses drivePlan).
  - Task 2: minor (deferred): standardRepairCost repeats needsOf's number lookup (selectors.js:437 vs events.js:55).
  - Task 2: minor (deferred): encounter choice detail covers only needs (e-bike wait / brunch detour fuel cost shows '').
  - Task 2: minor (deferred): some detail tests use includes(String(n)).
- Task 2: complete (commits 006ac52..a42a4e5, review clean)
- Task 7 dispatched at BASE a42a4e5+ (parallel with Task 3): implementer agent a82542a7d973d78c4 (opus), told PORT=4387 or 0. Report: task-7-report.md
- Task 3: implementer DONE_WITH_CONCERNS, commit a4a0f86 (205/205). eventChance 0.3->0.55, heatwave 6->14, influencerDamage 8->5. Autopilot 42-45%, careful 100% with 5.0 alive.
  - Ruling: careful play must carry risk — spec 3.11 careful target becomes wins 85-97%, >=3.5 alive, a death in >=25% of journeys (committed) — the review's D1 said nothing threatened a supplied crew; 100%/5.0 repeats that — costs one more tuning round. Sent as round 2 to the same implementer (resumed a58690273a3e5298b), with a preference for eventChance near 0.45-0.5.
  - Ruling: bots sending autoPurchase/setPace/setRations straight to transition is accepted (spec gives those their own controls).
- Task 3 round 2: commit 63cdb50 (eventChance 0.5, heatwave 16; autopilot 43.5-45.5%; careful 100%, 5.0 alive). Careful-risk target not reachable with (T) numbers (barista's untunable brew and the bot's kombucha safety net).
  - Ruling: careful target restored to the original floor (>=80%, >=3.5 alive); the stakes live in the gap between attentive play (always wins) and autopilot (~44%) — a human plays between them — further tuning would need rule changes (weaker brew, thinner safety net) that make backgrounds diverge — costs: an expert who checks kombucha every day will rarely lose anyone. Spec amended back.
  - Task 3 review dispatched (sonnet), diff review-task3.diff.
- Task 3: review (sonnet) = Needs fixes (Important: validation note claimed an unmet target). Fix round 1/5 (1 addressed, 0 open; commit 9e8684a: note rewritten, careful bands aligned to spec floors). Scoped re-check done by controller (doc + two constants; grep confirms no stale target text, bands 0.8/3.5) — Ruling: controller verifies this doc-only fix instead of a re-review dispatch — the diff is two constants and prose — costs nothing if wrong.
  - Task 3: minor (deferred): careful bands have a large cushion; spec 3.8 lists starting values for heatwave/outage (final values in the validation note; Task 10 syncs the spec).
- Task 3: complete (commits a42a4e5..9e8684a, review clean)
- Task 7: implementer DONE_WITH_CONCERNS, commit 396e480 (browser suites 4/4: encounters 46, flow 169, layout 249, offline 25; npm test 205/205). Review dispatched: agent a4fe59363ae332334 (opus), package review-9e8684a..396e480.diff. Controller played setup -> shop -> auto-buy -> drive -> encounter -> outcome -> road at 390px on PORT=4387 (server running, started by controller): all worked; forecast and health numbers visible.
  - Notes for Task 9 from T7: add the font preload with the @font-face; styles.css is not Prettier-formatted.
- Task 7: review (opus) = Needs fixes. Important: shop quantity clear-and-type gives 10x; route list reads LOCATIONS activities. Fix round 1 sent (resumed a82542a7d973d78c4) with both plus minors 3,5,6,8 and test fixes.
  - Ruling: Task 7 may add one engine selector routeStops(state) in selectors.js (+ route.test.js) — the interface must not hold the stop-kind rule — costs a small cross-lane edit; no other task is editing the engine now.
  - Task 7: minor (deferred to Task 9): font preload; ration select truncated on phones; dead CSS (.resources-compact, .mobile-party, .field-journal); banner shows two storage sentences when storage is unavailable.
- Task 7: fix round 1 committed 17e1084 (npm test 210/210; browser 4/4). Scoped re-review dispatched (sonnet), package review-396e480..17e1084.diff.
- Task 7: fix round 1/5 (4 addressed, 0 open; commits 396e480..17e1084). Re-review (sonnet): all addressed, no new breakage.
  - Task 7: minor (deferred): step()/buy() do not clear quantityDraft (relies on focus-loss timeout); routeStops has its own sells() (tied to stopOffers by test); route markers use <= while the list uses <.
- Task 7: complete (commits 9e8684a..17e1084, review clean)
- Task 8 dispatched at BASE 17e1084.
- 00:10 PDT owner request: housekeeping docs (README.md new, AGENTS.md rewritten with architecture, rules and the Codex art contract, CLAUDE.md pointer) committed 24d67bc; main fast-forwarded to 24d67bc, PROJECT_SETUP run section updated and checksums refreshed (b3d1cdb), all suites passed on main (210 unit, 4/4 browser), pushed to origin/main. Feature branch fast-forwarded to b3d1cdb. Task 8 continues on the branch.
  - Note: CI's format step flags app/src/styles.css until Task 9 formats it; typecheck currently passes.
  - Note for Task 10: AGENTS.md and README now exist and must be kept current; the owner plans Codex-generated scenes via graphics-v4 (AGENTS.md section).
- Task 8: implementer DONE_WITH_CONCERNS, commit 762b3ec (210 unit; browser 5/5 incl. journey 168). Review dispatched (opus), package review-b3d1cdb..762b3ec.diff.
  - Task 8 concern 7 (Task 7 area): last-leg receipt shows "+0 mi -0 fuel -2 food" for a final push that ends the journey — fold into Task 8's fix round or Task 9.
- Task 8: review (opus) = Spec ✅, Approved, no Critical/Important.
  - Ruling: three minors fixed now by the same implementer before Task 9 edits the same files: sticky replay seed, injection test on headstones/journal/transfer, wrong last-leg receipt on a fatal push (Task 7 code).
  - Task 8: minor (deferred): transfer refusal checks cover only the save key; imported endings enter local records; `confirmed` not cleared on Escape.
- Task 8: follow-up committed 09ca000 (3 items; new checks red first; 210 unit, browser 5/5). Ruling: controller accepts the follow-up on the implementer's red/green evidence without a separate re-review — the review already approved, these were minors — costs little if wrong; the final whole-branch review covers it.
- Task 8: complete (commits b3d1cdb..09ca000, review clean)
- Task 9 dispatched at BASE 09ca000.
- Task 9: implementer DONE, commit 9e2d609 (210 unit; browser 6/6 incl. look 59; prettier and typecheck clean). Controller viewed road 1440/390 and the lost ending 390: in character, pixel headings, banded bars, labelled route map. Review dispatched (opus), package review-09ca000..9e2d609.diff.
  - Noted for review/fix: the ending still shows "Next stop" in the trip numbers (B18 residue).
- Task 9: review (opus) = Needs fixes (Important: route labels overlap at 761-1023px). Fix round 1 sent (resumed a67dedb966ad3ba8e): container-query route labels + test; small-text contrast to AA + test; select face 16px; ending hides Next stop and a loss reads "Journey over"; supplies show whole food.
  - Task 9: minor (deferred): phone shop strip small; select face can lag during the drive; memorial title in system face (typed names; accepted); encounter crops slice the decorative sign.
- Task 9: fix round 1/5 (5 addressed; commit 6fe1c72; look 84 checks; browser 6/6). Controller checked route-768x900.png: clean three-label row. Ruling: controller verification instead of a re-review dispatch — visual fix with a new automated overlap and contrast check — final review covers it.
- Task 9: complete (commits 09ca000..6fe1c72, review clean)
- Task 10 dispatched at BASE 6fe1c72.
- Task 10: DONE_WITH_CONCERNS, commit 3d6ac82 (210 unit; browser 6/6, 780 checks; format and typecheck clean; links 207/207; checksums current). Concerns: B18 residue (won ending text says "at least some" when all five arrive); S6 title on shop mark never shows; CI ran once on main (b3d1cdb) and failed at the format step since fixed; Simulator check left to controller; screenshots add 4.4 MB.
  - Ruling: Task 10 accepted without a separate task review — documentation and verification only, and the final whole-branch review reads it — costs little.
- Task 10: complete (commits 6fe1c72..3d6ac82)
- Final whole-branch review dispatched (fable), range 2143195..3d6ac82.
- Controller check: built copy (3d6ac82) served on PORT=4388; Safari in the iPhone 17 Pro simulator (iOS 26) shows the title (pixel face, repaired GLOBAL WARMING sign, masthead clear of the status bar) and step 1 correctly in portrait. Landscape and home-screen install not exercised.
- Final review (fable): Ready to merge "With fixes". Important: B18 residue. Minors 2-10. No ruling reversed. 210 unit, 780 browser checks re-run by reviewer.
  - Ruling: the single fix wave covers Important 1 plus minors 2 (worker controllerchange), 3 (imported endings not recorded), 4 (travel-at-stop save repair), 7 (wording), 8 (shop mark title) — all small and player-visible — dispatched (opus). Deferred after merge: forecast drizzle/heat (5), choice costs beyond needs (6), CI action majors (9, verify on first push), old-tab offline (10, accepted trade-off).
- Final fix wave: commits 47fb116, 73fdbb8 (6 items). Re-review (sonnet): all addressed, no new breakage.
- MERGED: main fast-forwarded to 73fdbb8; on main: 211 unit, browser 6/6, Prettier, typecheck, checksums all pass; pushed 02:15 PDT; GitHub CI run 36988703953 success.
