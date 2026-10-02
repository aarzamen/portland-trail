# Task 8 report: endings, records, the whole journal and moving a journey

Status: DONE_WITH_CONCERNS (small concerns in section 6).
Commit: `762b3ec` feat: scored endings with headstones and records, whole journal, journey transfer.

## 1. What I built, file by file

- `app/src/ui/trip-views.js`: the ending panel in the actions region (`.ending-panel`, `data-outcome`). It shows the
  heading and cause from `summarize`; miles, days and survivors; the score (`[data-score]`), the rank title (`[data-rank]`)
  and line; "Your $X covers N days of Portland rent." (`[data-rent]`); one headstone per `summary.fallen` entry
  (`[data-headstone=<id>]`: name, day and mile, death line, epitaph, `Edit epitaph` with `data-key="epitaph:<id>"`); Read
  the whole journal (`ending-journal`), Copy result (`copy-result`), Share (`share`, only when `navigator.share` is a
  function); best journeys, top five (`[data-list="records"]`: place, score, rank, background, day, survivors, this
  journey marked `aria-current`); the seed (`[data-seed]`) with Replay this seed (`replay`); Start another journey (`new`).
  The journal region gains "Read the whole journal" (`data-key="journal"`). The model has two new fields, `records` and
  `canShare`.
- `app/src/ui/dialogs.js`: `journalDialog` (every stored line, newest first, grouped by day in `[data-day]` sections, a
  line count, and a note when old lines have faded past the journal limit), `transferDialog` (when a journey exists: a
  description, Copy save code and Download save file; always a paste field `import-text`, Close and Load this journey),
  and a `memorialDialog` editing mode ("Recarve the headstone", "Keep it").
- `app/src/ui/views.js`: the title shows "Best journey N points · Rank" (`[data-best]`) when records exist, and the
  "Move a journey between devices" button (`transfer`).
- `app/src/ui/storage.js`: `RECORDS_KEY` is exported. `addRecord(entry)` adds an entry once by `key` and keeps the ten
  best by score, best first. Among equal scores the older entry stays first. `saveFileText(game, lastLeg)` returns the
  save record as indented JSON, which `importCode` already reads.
- `app/src/main.js` (controller):
  - Records: `recordEnding` stores `{ key: seed:day:distance:score, seed, day, distance, score, outcome, rank,
    professionName, survivors }` when an action ends the journey, and also when an ended journey is adopted (start-up,
    another tab, import). Adding is idempotent, so reloads never duplicate.
  - The ending's tools: Edit reopens the memorial and saves through `setEpitaph`. Focus then returns to that headstone's
    Edit button, and no death sound plays. Copy result and Share use `shareText`. Replay this seed fills the setup with
    the same background, crew names, the road "A seed of your own" and the seed, then opens step 1 without asking.
  - The whole journal dialog opens from both buttons.
  - Transfer:
    - Copy uses `exportCode`. Download builds a Blob link inside the dialog, because content outside a modal is inert.
    - Load uses `importCode`. An unreadable code gives an amber toast and changes nothing.
    - When a journey exists, a confirmation runs first. `openConfirm(view, onConfirm)` is now general.
    - After loading, the dialog closes, the title shows Resume (focused), and a toast confirms.
  - Toasts are placed inside the open dialog (the confirmation when it is stacked on top), then moved back on close. This
    keeps them above the 85% backdrop and inside the modal's accessibility tree. Without it, the refusal toast would sit
    under the backdrop.
  - Multi-tab: the `storage` handler now also follows `localStorage.clear()` (key `null`) and changes to the records
    (title best score).
  - `show()` closes all five dialogs. `resetJourneyView()` is shared by Pack the van and import. Both new dialogs get
    `aria-labelledby` from script, because `index.html` is not mine.
- `app/src/styles.css`: one appended block for the score box, headstones (rounded-top stones), tools, best list, seed row,
  title extras, the journal dialog (flex column, the day list scrolls inside, sticky day headings, Close always visible)
  and the transfer textarea (16px). Uses existing tokens and colours already in the file; Task 9 restyles.
- `app/tests/support/browser.mjs`: `openPage({ permissions })`, `RECORDS_KEY`, `readRecords(page)`.
- `app/tests/browser-journey.mjs`: new suite (section 2).

No rule logic was added to the interface. Heading, cause, score, rank, rent days, fallen lines and share text all come
from `summarize` and `shareText`. The only interface arithmetic is sorting stored records by their stored score and
"day"/"days" plurals.

## 2. The suite (`browser-journey.mjs`, 168 checks)

Seeds were chosen by running the real engine with the `balance.mjs` bots. The suite imports `BOTS` and asserts each
outcome in Node before the browser plays it:

- **WIN**: Influencer, seed 5, careful policy, 1440×900. It wins on day 20 with all five alive, through two outbreaks,
  other encounters, a rest, talks, a meal and the ability.
- **LOSS**: Prepper, seed 3, never shops, 390×664. It drives, trades the luggage, then pushes. Everyone falls near
  mile 750 ("Roadside Legend").
- **FALLEN_WIN**: Influencer, seed 14, autopilot. The engine plays it to a win with two fallen, and it is loaded as a
  fixture. Over 3,000 seeds per background, the careful bot never lost a traveler, so a careful win with headstones does
  not exist with the current numbers.

How a journey is played: setup goes through the visible controls (Start, background card, Continue, A seed of your own,
seed, Pack the van). The bot decides from the saved state each time, and the decision is sent through the visible control:
- option buttons by `data-key`;
- the pace and rations selects;
- Auto-buy;
- encounter choices, then Keep going;
- Leave it on memorials.

The engine plays the same actions alongside, and after every action the saved journey must deep-equal the engine's.

Checks:
- **Ending (each outcome):** heading and cause from `summarize`; score; rank title and line; the rent sentence; miles,
  days and survivors; one headstone per fallen traveler with name, line, epitaph and Edit; the seed. Layout at both widths:
  no overflow, images load, controls ≥44px and inputs ≥16px below 1000px.
- **Epitaph edit (loss):** Edit opens the memorial holding the current epitaph. Carve saves through `setEpitaph` (saved
  state) and the headstone changes. Focus returns to Edit.
- **Journal dialog (both runs):** the lines equal `[...journal].reverse()` texts, and the day groups come latest first.
  Escape and Close both close it.
- **Copy result:** the clipboard equals `shareText` (clipboard permissions granted), with a phosphor toast.
- **Share:** with a stand-in `navigator.share`, the shared text is `shareText`.
- **Records:**
  - The ending is stored once, and is still once after a reload and View saved ending.
  - The title shows the best score and its rank.
  - Best journeys lists it.
  - With ten weaker journeys already stored, the new one comes first, the weakest is dropped, ten are kept and five are
    shown.
- **Replay this seed:** no confirmation; step 1 has the same background; the road options hold the seed. The new save
  deep-equals `createGame({ profession, names, seed })`, i.e. mile 0, day 1, healthy crew.
- **Start another journey (loss):** goes to step 1 with no confirmation (B16). The new journey is at mile 0 on day 1 and
  every traveler has health 100 with status good.
- **Transfer (390 and 1440):**
  - The downloaded `.json` holds the game and last leg.
  - Copy save code gives a `PT2.` code.
  - A truncated code gives exactly one amber `role=alert` toast, visible above the dialog. The save is byte-identical
    and no confirmation appears.
  - Loading over a journey asks first. Keep this one changes nothing.
  - Clear storage and reload: no Resume and no copy button. A truncated code is refused and stores nothing. The full code
    loads without asking and closes the dialog. Resume gives the same game, the same last leg and the same route mile.
  - A bare state's JSON replaces the journey after confirming.
- **Another tab:** a save written in tab two gives tab one Resume. Removing it takes Resume away.
- No browser errors anywhere.

Failing first: before the implementation the suite ran with
`23 checks, 5 failed` ("winning journey threw: locator.getAttribute: Timeout…" for the missing `[data-score]`,
same for the losing and fallen-win steps; transfer threw on the missing `[data-key="transfer"]`). The playthrough
itself already matched the engine at every action with Task 7's interface.

## 3. Command output

```
cd app && npm test            # tests 210, pass 210, fail 0
cd app && npm run test:browser
browser-encounters: 50 checks, 0 failed.
browser-flow: 192 checks, 0 failed (widths 390/414/430/768/1440).
browser-journey: 168 checks, 0 failed (win seed 5 at 1440, loss seed 3 at 390).
browser-layout: 249 checks, 0 failed (12 viewports).
browser-offline: 25 checks, 0 failed.
5 suites, 5 passed, 0 failed.
```

My files pass `prettier --check`, have no line over 120 characters, and `tsc -p jsconfig.json` reports nothing in
`src/main.js` or `src/ui/`.

## 4. Screenshots looked at (Read tool), in `app/test-results/browser-journey/`

- `ending-won-fallen-1440.png` (full page), `ending-won-fallen-390.png` (full page) and `ending-won-fallen-390-view.png`:
  score box, rank, rent line, two headstones, tools, five best journeys with the current one marked, seed row, Start
  another journey. At 1440 the stones sit side by side; at 390 they stack and the tools are full width.
- `ending-lost-390.png`: "The road won this round.", the cause, 150 points, Roadside Legend, five headstones (one
  re-carved), one record.
- `ending-won-1440.png`: the careful win, with no headstones section.
- `journal-1440.png` and `journal-390.png`: heading and count, day groups, list scrolling inside the dialog, Close always
  visible.
- `transfer-1440.png` and `transfer-refused-390.png`: the two send buttons, the paste field and the actions; the amber
  refusal toast shows above the dialog.
- `title-390.png` and `title-1440.png`: the best score line and the transfer link.

Fixed after looking:
- The journal dialog used to put focus on Close at the bottom, which scrolled away from the newest lines. The list now
  scrolls inside a flex dialog.
- Dialog screenshots are now taken of the viewport, not the full page.
- The refusal toast sat hidden under the backdrop (the toast-host change above).

## 5. Interpretations

- Records are also written when an ended journey is adopted (start-up, other tab, import). Thanks to the key this is
  idempotent. It covers endings saved by 0.1 or ones whose record write failed.
- Replay this seed also preselects the old background and crew names. Both stay changeable on steps 1 and 2.
- Loading through Transfer asks for confirmation whenever a journey (including an ended one) is on the device. It then
  stays on the title with Resume focused rather than jumping into the game.
- "Your $X covers N days" uses "day" for one. The spec quote uses "days" literally.

## 6. Concerns

1. With the current numbers the careful bot never loses a traveler, so the won ending with fallen travelers comes from
   an autopilot seed played by the engine and loaded as a fixture. The careful win itself is played through the controls.
2. Headless Chrome exposes `navigator.share`, so the real Share button appears in the screenshots. The suite tests Share
   only with a stand-in, to avoid opening a system sheet.
3. Spec section 2 asks for a `Claude Fable 5.1` trailer. As instructed, I used my own model's line (`Claude Opus 5.5`).
4. The new CSS reuses five literal colours that already exist in the file. The spec's literal-colour budget and the
   type scale are for Task 9.
5. Seen in passing, not mine: on the lost ending, the "last leg" receipt (Task 7) shows "+0 mi −0 fuel −2 food" for the
   final push that killed everyone.

## Follow-up (review round 1)

1. **Replay no longer sticks.** `forgetRoad()` in `main.js` resets `setup.road` to `'surprise'` and clears the seed
   text. It runs whenever a new journey is started any way other than Replay (Start, Start another journey, the header's
   New journey after its confirmation) and after every successful Pack the van, so a replayed seed is used once. Crew
   names are kept (B13). The suite checks both cases at 1440:
   - Replay, back to the title, Start: Surprise me with an empty seed.
   - Replay, pack, header New journey, confirm: Surprise me with an empty seed.
2. **Markup on the new surfaces.** The won-with-fallen fixture now has a fallen traveler named
   `<img src=x onerror=alert(1)>` (also in the journal lines that name them) and the epitaph `<b>bold</b>`. The save
   accepts both unchanged. At 390 and 1440 the suite checks that both show as text:
   - on the headstone;
   - in the whole-journal dialog;
   - in the transfer field, where a pasted save holding them is kept verbatim after the dialog is closed and redrawn.

   It also checks that no `img[src="x"]` and no stray `<b>` exist, and that no browser dialog fired (`errors` records
   every dialog). These checks passed before the fix too, because everything already went through `escapeHtml`.
3. **Last-leg receipt.**
   - `updateLeg` now records a receipt only when a drive or a push moved the van, with its real miles, fuel and food.
   - A drive or push whose day ends the journey before the van moves clears the receipt (`lastLeg = null`), and the save
     stores `ui.lastLeg: null`.
   - The leg region also hides any zero-mile receipt saved before this fix.
   - A winning drive still shows its arrival leg.
   - Hitchhiking and the luggage trade never moved the van and still leave the previous receipt as it was.

   Checks on the losing journey: every push that moved the van shows `+N mi`, `−fuel` and `−food` equal to the engine's
   change (several pushes were checked). After the fatal push the leg region is empty and `ui.lastLeg` is null.

Red first: against `762b3ec`, `browser-journey` gave 3 of 180 checks failed. The two surprise-road checks failed, and the
receipt check failed with the text "Another stretch behind you. Day 19 → 20 +0 mi −0 fuel −2 food Mile 750".

Output after the fix:

```
cd app && npm test            # tests 210, pass 210, fail 0
cd app && npm run test:browser
browser-encounters: 50 checks, 0 failed.
browser-flow: 192 checks, 0 failed (widths 390/414/430/768/1440).
browser-journey: 180 checks, 0 failed (win seed 5 at 1440, loss seed 3 at 390).
browser-layout: 249 checks, 0 failed (12 viewports).
browser-offline: 25 checks, 0 failed.
5 suites, 5 passed, 0 failed.
```

Files: `app/src/main.js`, `app/src/ui/trip-views.js`, `app/tests/browser-journey.mjs`. Concern 5 above is resolved.
