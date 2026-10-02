# Task 10 report: documentation, formatting, type check and checksums

Status: DONE_WITH_CONCERNS (two small residues found while writing the status table; section 5).

## Commits

| SHA | Subject |
|---|---|
| `3d6ac82` | docs: 0.2 validation record, review status per item, setup and handoff current; spec shows final balance numbers; checksums refreshed |

No formatting commit and no type-check commit: `npm run format:check` and `npm run typecheck` both passed at BASE `6fe1c72` with nothing to change (Task 9 had formatted `styles.css`). Committed by path, trailer `Co-Authored-By: Claude Opus 5.5`. Not pushed.

## Files

- Created: `docs/validation/2026-10-01-review-implementation.md`; `docs/validation/review-implementation/` with 16 screenshots from `app/test-results/look/` of this run (390×664: title, step1, shop, road, encounter, outcome, memorial, won, lost, journal; 844×390: road, encounter; 1440×900: title, road, shop, won). About 4.4 MB.
- `docs/reviews/2026-10-01-code-and-architecture-review.md`: new "Status" section after the header, one row for each of the 72 ids (B1–B19, D1–D7, A1–A7, E1–E6, S1–S6, L1–L8, F1–F13, T1–T6). Rulings reflected: B2/F3 (empty tank never ends the journey), D1 and the careful-play floor, D2 answerable outbreak, D7 per-item maximum, A2 exception (TEXT, NEED_TEXT, CONTINUE stay in selectors.js/actions.js), L5 in-house face, E6 not done, L7 partly done (wifi, motel, nft, food-carts, free-box, rest-stop), T1 not yet green on GitHub, T6 markup only. The Reproduce section now says the scripts need a checkout at `3e02b8a`.
- `docs/reviews/evidence/{fuzz,scenarios,balance}.mjs`: a new first line: "// Historical: reproduces the review findings at commit 3e02b8a; it no longer runs against the current (0.2) engine."
- `PROJECT_SETUP.md`: rewritten around 0.2: current state, run and every command (dev, start, test, ci, test:browser and its filter, build, balance, format, typecheck, assets, checksums and --check), CI, the development map with every engine and ui module, scripts and tests, offline and installed-app notes, what remains. The controller's run section is kept, with the PORT=0 note added.
- `docs/handoff/README.md`: header, "Read next" (0.2 records, review, spec, plan; note that graphics-v2/v3 READMEs describe replaced exports), "Implemented behavior" and "Remaining work" rewritten for 0.2; preservation section kept (one sentence adjusted: masters are "the generated PNG masters", checksum manifests written by the script).
- `docs/handoff/LOCAL_IMAGE_REVIEW.md`: only the "Development integration update" paragraph, now listing all 19 JPEGs with their scene ids, the pipeline, sign repairs and the remaining garbled lettering. The 19 original hashes were recomputed and all match the table.
- `docs/superpowers/specs/2026-10-01-review-implementation-design.md`: 3.2 intro now says the values are final, names the three changes, links the balance note and says `data.js` is authoritative; `eventChance` 0.5; 3.8 heatwave `{damage: 16}`, Wi-Fi `{influencerDamage: 5}`. Confirmed with `git diff a42a4e5 9e8684a -- app/src/data.js` and `git log 9e8684a..HEAD -- app/src/data.js` that these three are the only data.js number changes.
- `README.md`: Status paragraph says 0.2.0 is complete and links the validation record. `AGENTS.md`: "version 0.2.0 in progress" → "version 0.2.0". Nothing else in either was out of date.
- `checksums.json` (319 files) and `docs/handoff/checksums.json` (112 files): refreshed last.
- `.gitignore`: no change needed.

## Verification (commands and results)

- `cd app && npm run format:check` → "All matched files use Prettier code style!" (before and after).
- `cd app && npm run typecheck` → no output, exit 0 (before and after).
- `cd app && npm test` → tests 210, pass 210, fail 0 (before the docs and again after the commit).
- `cd app && PORT=0 npm run test:browser` (at 6fe1c72; this task changed nothing under `app/`) → encounters 50, flow 192, journey 180, layout 249, look 84, offline 25 checks, 0 failed; 6 suites of 6 passed.
- `cd app && node scripts/balance.mjs 2000` → identical to `docs/validation/2026-10-01-balance.md` (autopilot 43.5–45.5%, careful 100% with 5.00 alive, never-shops 0%).
- Link check (scratch script resolving every relative `](…)` link, anchors stripped) over the eight documents touched → 207 relative links checked, 0 missing.
- `node app/scripts/checksums.mjs` then `--check` → "Checksums are current" (exit 0), also after the commit; working tree clean.
- Screenshots looked at with Read: road 390, won 1440, lost 390, encounter 844, outcome 390, memorial 390, title 1440.

## Findings recorded in the documents

- CI did run once on GitHub (`gh run list`): run 36977286281 on `main` at `b3d1cdb` failed at the format check on `app/src/styles.css` (npm test, checksum check and npm ci passed; typecheck not reached). Task 9 has since formatted the file. The branch has not been pushed, so the workflow has not run on the final version. The validation record and T1 row say this rather than "CI never ran".
- The graphics-v2 and v3 READMEs' dead links (generated-manifest.json, mobile-art-manifest.json, mobile-images.json, assets/mobile/, prepare-generated-assets.mjs, prepare-mobile-art.mjs) are left untouched; the validation record has a section saying where they went (prepare-assets.py and app/assets/manifest.json).

## Concerns

1. **B18 residue (not fixed; outside this task's files).** On a won ending the line under the heading is hard-coded in `app/src/ui/trip-views.js` `sceneText`: "Against the odds, the van and at least some of its passengers made the city." It shows even when all five arrive (heading "All five made it to Portland."), which is exactly the wording B18 objected to. One-line fix: choose the sentence from `summary.survivors.length` (or have `summarize` supply it). Recorded as "Done, one residue" in the status table and listed in the validation record's limits and PROJECT_SETUP's remaining work.
2. **S6 small new case.** The route map's shop mark (`SHOP_MARK` in trip-views.js) has `title="Supplies"` inside `.route-points`, which has `pointer-events: none`, so the tooltip never shows (the same pattern S6 named). Harmless; `aria-label` carries the meaning. Recorded as "Done, one small new case".
3. The plan's iOS Simulator check (installed app, masthead vs status bar) is not done by this task; the documents say it belongs to the controller's final checks. If the controller runs it, the validation record's Limits bullet on WebKit should be updated.
4. Screenshots add about 4.4 MB to the repository (16 PNGs; the three 1440 shots are 0.6–1.1 MB each).
