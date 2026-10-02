# Task 9 report: Look, feel and sound

Status: DONE. Commit `9e2d609` on `feat/review-implementation` (not pushed).

## Files

- `app/src/styles.css`: rewritten (3,119 lines after Prettier).
- `app/src/ui/sound.js`: implemented.
- `app/index.html`: font preload, sound toggle, brand split into spans.
- `app/tests/browser-look.mjs`: new suite.
- `app/src/ui/trip-views.js`: route-map markup and the select face, both minimal.
- `app/src/main.js`: sound toggle, one banner message at a time, and the map van during the drive.

## What was built

1. **Tokens.** One `:root` block holds the ten base colours from spec 10. Every surface, border, tint, shade and road paint is derived from them with `color-mix()`. There are 0 colour literals outside the block, against a budget of 12.
   - Font sizes come from the rem scale only: 0.75 to 1.125, 1.25, 1.5, then display steps 2, 2.5, 3, 4 and 5 rem. Nothing is under 0.75rem.
   - There are three letter-spacings: 0, 0.08em for capitals, and −0.02em for the memorial name.
   - Dead CSS is gone: `.resources-compact`, `.mobile-party`, `.field-journal`, `.journal-cover`, `.button-item`, `.item-actions`, `.event-art-text`, `.main-column`, `.route-markers` and `.route-endpoints`. A grep confirms every class in the sheet is used by markup, including the classes built dynamically (`region-*`, `weather-*`, `light-*`, `atmosphere-*`, `kind-*`, `scene-shop`).
2. **Portland Pixel.**
   - `@font-face` uses `font-display: swap`, and `index.html` has `<link rel="preload" … crossorigin>`.
   - Every element using the face gets weight 400, `font-synthesis: none`, antialiased smoothing, letter-spacing 0 and line-height 1.25.
   - It is used for the brand, the title, setup headings, the scene heading, dialog titles, the ending heading, the score and the headstone "RIP".
   - Sizes step with media queries, never `clamp()`:
     - title: 80 / 64 / 48 / 40px
     - scene heading: 40 / 32 / 24px
     - dialog titles: 32 / 24px
     - score: 48 / 40px
   - The memorial title (a typed traveler name) and headstone names stay in the system face.
   - In the screenshots the face read better than system mono in every place I used it, so no spot was switched back.
3. **Health bars.**
   - The fill is phosphor, amber or rust by `data-band`, and the number takes the same colour.
   - A dead traveler gets a hatched rust track, a 0 in rust, a struck-through name and "DECEASED" in rust capitals.
4. **Supplies.**
   - They use the short names (Cash, Food, Fuel, Seeds, Repairs, Kombucha, NFTs) and are `nowrap`.
   - `scrollWidth <= clientWidth` holds at 320, 390 and 1440 on the road, in the shop and at the ending.
5. **Route map (L6).**
   - Every stop has a tick on the track; passed stops are phosphor, and the current stop and Portland are amber.
   - Shops are an amber `$` box with `role="img" aria-label="supplies"` and `title`.
   - From 640px up, every stop is labelled in two alternating lanes (above and below) with no overlaps.
   - Below 640px the labels are visually hidden (still read out), and a three-column row shows the previous, current ("On the road" between stops) and next stop, with miles and the `$` mark.
   - A 13×7 pixel SVG van sits at `data-mile`. `stepDrive` moves it with the counter.
   - The `<details>` full list stays.
6. **Console touches (L4).**
   - Scanlines are an 18% ink line every 3px over the scene, the encounter art and the title art.
   - The title has a soft phosphor glow over a hard pine shadow.
   - A blinking block cursor follows the latest note.
   - Typed encounter text is phosphor with a glow and a block cursor.
   - Everything stops under reduced motion through the existing global rule.
7. **Toasts.**
   - Success is phosphor, with a left bar on a card surface; refusal is amber on an amber tint.
   - They sit at `bottom: calc(16px + safe-area-inset-bottom)` with safe-area-aware width.
   - They are `pointer-events: none`, so they never take a tap meant for a control under them.
8. **Focus.**
   - The amber 3px ring is on every control.
   - Selected background and road cards show selection with a border and box-shadow instead of an outline, so the focus ring still shows.
   - The selects' face shows the ring through `:has(select:focus-visible)`.
   - `#app` never shows an outline.
9. **Safe areas.** The masthead, gutters (`--gutter-left` and `--gutter-right`), setup padding, footer, toasts and dialog sizes all use `env(safe-area-inset-*)`.
10. **Sound (L8).**
    - `sound.js` plays short square, triangle or sawtooth note sequences for all nine names, with an 8ms attack, an exponential release and peaks of 0.03 to 0.08.
    - The `AudioContext` is created lazily, on the first `play()` after a pointer or key gesture.
    - The masthead toggle `#sound-toggle` starts with `aria-pressed="false"`. Its accessible name is "Sound", and the visible "♪ Sound OFF/ON" changes. Its state is written with `writeSettings` and read on load. Switching it on plays the "good" tone.
11. **Layout guarantees kept.** Body text is now 14px, controls 16px and small text at least 12px. Room was found without hiding anything new:
    - The scene image is 200px on phones, 152px on short phones and 136px at 360px or narrower.
    - In the shop on phones, the heading and its flavor text sit on a 136px strip of art, and Auto-buy shows its price and button before the list of what it packs.
    - Exception: on short phones (height 600px or less) the shop's flavor sentence is hidden. The old stylesheet already hid it on every phone; it is now shown on all other phones. The shop stamp ("THE PORTLAND TRAIL 01/0000") is hidden on shop phones; it repeats the day and mile already shown in the top line and the numbers.
12. **Endings, headstones, journal, transfer, memorial and outcome.**
    - Headstones are stone cards with a rounded top, a pixel "RIP", the epitaph in amber italics and a hard shadow.
    - On a lost ending the heading is amber. The score box has an amber border.
    - The journal days have sticky amber headings. Results in the outcome step use the console `›` bullets.

Deferred items also fixed:
- The font preload is in `index.html`.
- **Rations and pace labels.** The `<select>` is see-through and covers a face showing the engine's label for the chosen option, which wraps to two lines instead of being cut. It stays 44px or taller with 16px text, and every tap, key and screen reader goes to the real select.
- **Banner.** It now shows one storage problem in priority order: unavailable, then unsaved, then unreadable.
- Task 8's literal colours are tokenised.
- `styles.css` passes `prettier --check`.

## A bug the new look exposed (fixed)

The journey suite's losing run timed out: "element is not stable" on an encounter choice. The cause was `.button:hover { transform: translateY(-1px) }`. A pointer resting on a button's bottom edge flipped it between hovered and not every frame, and the button jittered by 1px. That is real flicker for mouse users too. Hover now changes only the colour. The press nudges the button down 1px only while it is held.

## Tests

- `npm test`: 210 pass, 0 fail, no warnings.
- `npm run test:browser`: 6 suites, 6 passed, with nothing printed beyond the build and server lines and the summaries:
  - encounters
  - flow 192
  - journey
  - layout 249
  - look 59
  - offline 25
- `npx prettier --check` passes for `src/styles.css` and every other file I touched.
- `npm run typecheck` is clean.
- No line in my files is over 120 characters.
- I watched `browser-look.mjs` fail first: 22 of 43 checks failed against the old stylesheet.

`browser-look.mjs` checks:
- The face loads, and the title and scene heading use it at multiples of 8px and weight 400; the preload is present.
- No visible text is under 12px, and supply labels are whole, at 320, 390 and 1440 on the road, in the shop and at the ending.
- Health bars at 80, 50 and 20 have three colours with their numbers; the dead show `data-band="dead"` plus the word and a different colour.
- The map van is within 2% of the mile before and after a drive at 1440 and 390, and moves during an animated drive. Every stop is marked; shops have text alternatives; there are no label overlaps at 1440. At 390 the previous, current and next labels are visible and do not overlap. The full list stays.
- Toast roles and border colours, and a toast does not cover the primary action at 390.
- The amber ring on the keyboard-focused selected card; `<main>` has no outline.
- The sound toggle goes off, on, survives a reload, and goes off again with no errors.
- No running animations under reduced motion on the road, in an encounter and after an arrival.
- Static stylesheet budgets: font sizes, colour literals, letter-spacings and the `font-display` declaration.
- Screenshots of every screen.

## Screenshots looked at, and what changed after looking

Screenshots are in `app/test-results/look/`. Each name is shot at 390x664, 844x390 and 1440x900, most with a `-full` page version: `title-*`, `confirm-*`, `step1-*`, `step2-*`, `shop-*`, `stop-*`, `road-*`, `encounter-*`, `outcome-*`, `memorial-*`, `won-*`, `lost-*`, `journal-*`, `transfer-*`, plus `toast-refusal-390x664`. I also looked at `app/test-results/browser-layout/{road,shop,encounter}-{320x568,375x548,390x664,844x390,1440x900}.png`.

Images I opened with Read:
- `look/title-1440x900`, `title-390x664`, `title-844x390`, each looked at before and after changes
- `road-1440x900` and `-full`, `road-390x664-full`, `road-390x664`, `road-844x390-full`
- `shop-390x664` (twice), `shop-1440x900-full`
- `encounter-390x664`, `encounter-844x390`, `encounter-1440x900`
- `won-1440x900-full`, `won-390x664-full`, `lost-390x664-full`, `lost-390x664`
- `memorial-390x664`, `stop-844x390-full`, `stop-390x664`, `stop-390x664-full`
- `step1-1440x900`, `step2-390x664`, `journal-844x390`, `transfer-390x664`
- `browser-layout/road-390x664`, `road-375x548`, `road-320x568`, `shop-375x548`, `encounter-390x664`
- the font specimen `test-results/font/lines-x4.png`

Changes made after looking:
- **Phone title.** The bigger title covered the cover art, and the kicker and title sat on top of the van. The art now sits whole at the top in normal flow, with a fade at its foot. The words follow under it, overlapping the fade by 40px. On landscape phones the title is 48px; at 64px it broke into three lines.
- **Encounter and stop screenshots.** These first showed empty scanlined boxes. That was a test artifact: the shot was taken before the async image decoded. The suite now decodes every image and waits for fonts before each screenshot. The layout suite's own shots confirmed the art was always there.
- **Map labels on phones.** The `$` wrapped onto its own line beside the next stop's name. The mark now sits on the miles line ("$ 100 mi").
- **Action cards on phones.** Two narrow columns squeezed 16px button labels into two or three lines. On phones they are now one column.
- **Encounter choice notes.** On phones these wrapped to three lines at 9ch; they now get 12ch.
- **Scanlines.** At 26% they striped the van too heavily, so they are now 18%.
- **Shop heading on art.** It needed contrast over the bright art. It now has a hard ink shadow plus a soft ink glow, and the vignette's dark band starts lower so more of the art shows.
- **Phone ending.** "Start another journey" was the only button there not at full width; it now is.
- **Phone layout limits.** Auto-buy was out of the first screen at 375x548 and 320x568, and the trip numbers were out of it at 320x568. Fixed by the shop strip layout, by Auto-buy's price and button coming first, and by a shorter scene at 360px or narrower. The select face started at 42px tall because the select was inset inside the border; it now covers the border and is 44px.

## Concerns

- On short phones (height 600px or less) the shop's flavor sentence is hidden, and on phones the shop stamp is hidden (its day and mile are shown elsewhere). The trip-numbers and Auto-buy first-screen limits leave no room otherwise. The old stylesheet hid the flavor sentence on all phones.
- On the ending, "Next stop: Portland" still shows in the numbers. That comes from Task 7's route view; I left it.
- The masthead at 320px is tight but fits: "Portland Trail" (the "The" and the ✳ drop out), a two-line save status, "♪ OFF" and "New journey". No overflow, and the layout suite passes at 320.
- I could not hear the sound in a headless browser. The tones were checked for errors only, with a real `AudioContext` created after a gesture. They have not been heard on a device.
- There was no real-device browser. Everything was checked in installed Chrome through Playwright.

## Fix round 1

Commit `6fe1c72` (by path; nothing amended or pushed). Files: `app/src/styles.css`, `app/src/ui/trip-views.js`, `app/tests/browser-look.mjs`.

1. **Route labels overlapping from 761 to 1023px (Important).**
   - `.trip-strip` is now a size container: `container: trip / inline-size`.
   - The rules that switch to the three-nearest row moved from `@media (max-width: 639px)` to `@container trip (max-width: 699px)`, sized by the strip's content box. The track then needs about 686px or more before every stop is labelled.
   - Result by viewport:
     - Below about 1150px, in the two-column layout: the previous / current / next row.
     - 1200 and 1440: every stop on the map.
     - Landscape phones (756, 844), where the strip spans the screen: every stop on the map.
   - `browser-look.mjs` opens a stop (River Ferry, the most crowded stretch) at 756x352, 768x900, 844x390, 1000x900, 1024x768, 1200x900 and 1440x900. At each width it checks that:
     - no two visible route labels (map labels and the row together) intersect;
     - every stop is labelled, or the row shows Rest Stop | River Ferry | Roadside Motel;
     - at 1200 and above, every stop is on the map.
   - It writes `test-results/look/route-<size>.png`. I looked at `route-768x900`, `route-1000x900`, `route-1200x900` and `route-756x352` with Read: the row is clean at 768 and 1000, and the full map is clean at 1200 and 756.
2. **Contrast of small text.**
   - A new `--rust-text` token (rust 65% with paper) is now used for DECEASED, the bad-band number and the dead "0". Bars and borders keep `--rust` and `--rust-dim`.
   - `--text-dim` is now quiet 90% with ink-2 (was 75%).
   - Computed ratios:
     - `--rust-text`: 5.6:1 on the panel, 5.2:1 on the card, 6.5:1 on the well.
     - `--text-dim`: 5.05:1 on the panel, 4.7:1 on the card.
   - The new test measures four texts against their first opaque background, reading both `rgb()` and `color(srgb …)` values: DECEASED, a bad-band number, a dead "0", and a dead traveler's dimmed name. All four must reach 4.5:1.
3. **Select face text** is now `var(--fs-16)` (1rem).
4. **Endings.**
   - The third trip number reads "Ended at Portland" (won) or "Ended at Mile 750" (lost) instead of a next stop.
   - A lost journey's overline reads "Journey over"; a won one still reads "Journey complete".
   - Tested on the won and lost fixtures.
5. **Food** in the supplies list is `Math.floor` of the engine's value. The engine state is unchanged. Tested: "35" for 35.5.

Tests after the round:
- `npm test`: 210 pass, 0 fail.
- `npm run test:browser`: 6 of 6 suites pass, with nothing printed beyond the build and server lines and summaries. look now has 84 checks.
- `npx prettier --check` passes for the touched files, and `typecheck` is clean.

One slip during the round: a helper named `ahead` clashed with a local variable of the same name in `route()`, which broke the journey screen. Every suite failed until it was renamed `endOrNext`. It was fixed before the commit.
