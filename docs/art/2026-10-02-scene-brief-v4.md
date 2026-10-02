# Scene brief, graphics v4: five new scenes

For an image-generation agent (Codex or any other). Read [AGENTS.md](../../AGENTS.md), section "Adding new scenes and artwork", first; this brief fills in what to draw and how it must look. Reference art to study before generating: `app/assets/scenes/road-forest.webp`, `road-river.webp`, `road-city.webp`, `heatwave.webp`, `mushroom-market.webp`, `forest-camp.webp` (the newest, most consistent set) and `app/assets/sprites/van.png`.

## The five scenes

| Scene id | Replaces | Used for | Kind |
|---|---|---|---|
| `road-pines` | `road-forest` | region `pines`, miles 350–570, "The long way through the pines" | road backdrop |
| `road-outskirts` | `road-forest` | region `outskirts`, miles 750–870, "The outskirts of somewhere" | road backdrop |
| `sasquatch` | `road-forest` | encounter "Blurry Shape in the Treeline" | encounter illustration |
| `toll-troll` | `road-river` | encounter "Toll Under the Bridge" | encounter illustration |
| `brunch-line` | `road-city` | encounter "Brunch Line Across the Highway" | encounter illustration |

## The shared look

Every prompt starts with the **style block** and ends with the **exclusion block**, word for word. Only the scene paragraph in the middle changes. Keeping these two blocks identical across all five images is what makes them belong together.

### Style block

> Original illustration for The Portland Trail, a deadpan comic Oregon road-trip game. 1536×1024 landscape, opaque. Crisp retro handheld-console pixel art: chunky deliberate pixels, ordered dithering for gradients, hard pixel edges, no anti-aliased blur, no painterly brushwork, no photographic texture. Strictly monochrome green palette, four bands only: near-black ink green #07110A for the deepest shadows and outlines, dark pine #18331B for shadow masses, moss #426E35 for midtones, pale phosphor sage #A4C96A for highlights and sky. One consistent dark evergreen outline weight on every silhouette. Light from the upper left. Soft Pacific Northwest overcast mist in layers, atmospheric perspective by lightening toward the sky. Tall Douglas firs with stepped pixel crowns, ferns, mossy rocks. Calm, wry, cozy mood; the humor comes from small props and posture, never from text. Strong readable silhouettes that still read at 390 pixels wide. Key subjects inside the central 75% of the width and 80% of the height.

### Exclusion block

> No text, letters, numbers, words or lettering of any kind, including on signs, boards, shirts, cups, books and screens: signs are blank shapes. No logos, brands, UI, frames, borders, captions or watermarks. No orange, red, blue, purple or warm skin tones: every colour is a shade of the same green. No photorealism, no 3D render, no vector flatness, no lens flare, no bokeh.

### Steering words

Use these to nudge, never to replace the blocks.

- **Lean toward:** monochrome, dithered, chunky, crisp, stepped, layered, misty, overcast, mossy, damp, hushed, deadpan, cozy, slightly absurd, handheld, Game Boy-era, side-view, silhouette-first.
- **Lean away from:** glossy, neon, cinematic, epic, gritty, grimdark, cute-chibi, kawaii, saturated, painterly, airbrushed, high-detail noise, busy, cluttered, isometric, fisheye.
- **Characters:** small (about one eighth of the image height), scruffy, beanies, raincoats, flannel, backpacks, round glasses; expressive through posture, not faces. Bodies are mid-green; no skin tones.
- **Humor register:** understated Portland satire. One clear gag per scene, staged in the middle ground. The joke should land with no caption.

### Two kinds of scene, two compositions

**Road backdrops** (`road-pines`, `road-outskirts`) scroll behind the game's own van sprite.

- Side view, as in `road-forest` and `road-river`. The lower third is one straight, flat, horizontal two-lane road running left to right across the whole width, edge to edge, with a pale dashed centre line and a grassy verge along the bottom. It must not recede toward a horizon.
- The upper two thirds hold layered scenery: far mountains, middle trees and landmarks, near verge.
- No vehicles and no people anywhere. The van is drawn by the game on top of the road.
- The left and right edges should be quiet, without strong subjects cut off, because the image is panned and cropped.

**Encounter illustrations** (`sasquatch`, `toll-troll`, `brunch-line`) appear in the encounter dialog, cropped to a wide strip on phones and shown nearly whole on desktop.

- Put the gag in a horizontal band through the middle 50% of the height. The top and bottom 20% may be lost on phones.
- Do not draw the van. Its design differs between generations, and the game's van sprite is the canonical one. Show the travelers on foot, or imply the van with a corner of a bumper at the frame's edge at most.
- A clear foreground, middle ground and background, as in `heatwave`.

## Prompts

Copy each prompt in full: style block, scene paragraph, exclusion block.

### road-pines

> [Style block] Scene: a side-view highway through a dense, dark, old-growth pine and Douglas-fir forest late in the afternoon. Upper two thirds: towering straight trunks in rhythmic vertical columns, three depths of firs fading into pale mist, shafts of soft sage light slanting between the trunks, a far ridge barely visible. A rustic split-rail fence and a single wooden mile post (blank) by the verge. Ferns and a fallen mossy log in the near verge. Lower third: the straight horizontal road described below, edge to edge. Mood: hushed, endless, faintly comic in its monotony; the long way round. The lower third is one straight, flat, horizontal two-lane road running left to right across the entire width, pale dashed centre line, grassy verge along the bottom edge, no perspective, no vehicles, no people. [Exclusion block]

Steering: *columnar, cathedral-quiet, repetitive, shaded, misty shafts.* Make it read as darker and denser than `road-forest`, so the stretch feels different.

### road-outskirts

> [Style block] Scene: a side-view highway on the drab edge of a small Oregon town. Upper two thirds: a strip of modest roadside businesses with flat roofs and blank signs on poles: a self-storage block, a drive-through coffee hut no bigger than a shed, a tire shop with stacked tires, a lone water tower, power lines sagging between wooden poles, a few scraggly firs and a hazy hill line behind. Overcast and slightly washed out. Lower third: the straight horizontal road described below, edge to edge, with a cracked shoulder and a few traffic cones. Mood: deadpan in-between place, the middle of nowhere a little too close to somewhere. The lower third is one straight, flat, horizontal two-lane road running left to right across the entire width, pale dashed centre line, grassy verge along the bottom edge, no perspective, no vehicles, no people. [Exclusion block]

Steering: *flat, sparse, utilitarian, power lines, blank signs, washed-out sky.* Keep buildings small and set back so the road reads first.

### sasquatch

> [Style block] Scene: the edge of a misty fir forest beside a quiet road. In the middle ground a very tall, shaggy, slightly blurred figure stands half behind a tree trunk, looking back over its shoulder at the viewer, perfectly still, as if caught mid-step. Its outline is softened by mist so it could be a big man in a fur coat. In the near middle ground, small on the left, two scruffy travelers in beanies crouch behind a fern, one holding up a phone at arm's length, the other covering their mouth. Foreground: road shoulder, a lost hiking boot. Background: layered firs fading into fog. Mood: hushed, uncertain, comic standoff. Key subjects in the middle band. [Exclusion block]

Steering: *blurry, ambiguous, caught-in-the-act, hushed, fog-softened.* The figure must stay ambiguous (the joke: "a tall man named Greg"). No gore, no menace.

### toll-troll

> [Style block] Scene: under a heavy concrete highway overpass beside a calm river in a green gorge. In the shadow beneath the overpass, a stout bearded man in a reflective safety vest sits on a folding camp chair behind a small folding table, holding up a handheld card reader with great ceremony. Beside him a homemade barrier: a sawhorse and a traffic cone. In the near middle ground two travelers on foot stop short, one rummaging through a wallet, one looking at the sky. Background: the river, fir-covered cliffs, mist, light at the far end of the underpass. Mood: bureaucratic fairy tale, deadpan. Key subjects in the middle band. [Exclusion block]

Steering: *shadowed underpass, folding furniture, self-appointed authority, fairy-tale troll as a man with a card reader.* The vest is pale sage, not orange.

### brunch-line

> [Style block] Scene: a city street at the edge of Portland on a damp weekend morning. A trendy little brunch spot with a striped awning and potted ferns sits on the right. From its door a very long, orderly queue of people in raincoats and beanies snakes out, across the sidewalk and straight across both lanes of the road in the middle ground, patiently waiting, several holding coffee cups and phones, one with a dog, one reading. A folding chalkboard sign (blank) by the door. Background: brick warehouses, a green steel truss bridge, a hazy downtown skyline, a volcanic mountain far behind. Mood: absurdly patient, quietly comic. Key subjects in the middle band. [Exclusion block]

Steering: *orderly queue, crossing the road, umbrellas, patience as performance.* The line must clearly cross the road; that is the joke.

## Accepting an image

Before an image goes into the game, check every point. Regenerate rather than edit pixels by hand.

1. **Palette.** Only the four greens and their dithered mixes. No orange vests, red cones, blue water, skin tones or warm light. To check, quantise to eight colours; every colour should be green.
2. **No lettering.** Zoom to 2×: signs, cups, vests and screens are blank shapes, with no fake letters.
3. **Pixel crispness.** Hard edges, visible dithering, no soft gradients or photographic noise.
4. **Composition.** Road backdrops: a straight horizontal road in the lower third, edge to edge, no vehicles or people. Encounters: the gag reads in the middle 50% band, and no van appears.
5. **Consistency.** Put the image beside `road-forest`, `road-river` and `heatwave`: the same outline weight, light direction, tree style and mood.
6. **Phone legibility.** Shrink to 390 pixels wide: the subject and the gag still read.

## Putting the scenes in the game

1. Save each accepted master as `docs/handoff/graphics-v4/<scene id>.png` (1536×1024). Add `docs/handoff/graphics-v4/README.md` (what each image is for, and its date) and `generation.json` (an array of `{ id, tool, prompt, date }`, as in `graphics-v3/generation.json`). Never edit the masters afterwards.
2. In `app/scripts/prepare-assets.py`, add each id to `SCENES` with source `docs/handoff/graphics-v4/<id>.png` and crop `None`, beside the graphics-v3 entries.
3. Run `cd app && npm run assets`. Look at `app/test-results/assets/scenes.png`.
4. In `app/src/data.js`, set `scene: 'road-pines'` on the `pines` region and `scene: 'road-outskirts'` on the `outskirts` region. Set `scene: 'sasquatch'`, `scene: 'toll-troll'` and `scene: 'brunch-line'` on those three encounters.
5. Run `cd app && npm test` and `npm run test:browser`. Then play to each stretch and trigger each encounter at 390 and 1440 pixels wide; `npm run dev` and a seed help.
6. Run `npm run checksums`, then commit the masters, the script change, the regenerated assets and the data change together.
