# Intro screen candidates

Generated October 2, 2026 with the built-in image generator. Three original, opaque 1536×1024 RGB masters explore a more polished introduction to the five travelers, loaded van and Oregon journey. The user selected the first generated image, **The Road Ahead**, as the splash replacement. All three masters are retained. All lettering and controls in the screen previews come from the existing game interface.

| Candidate | Master | Direction |
|---|---|---|
| 1. The Road Ahead | [title-road-ahead.png](title-road-ahead.png) | Broad adventure cover: a winding road, river gorge, bridge, distant city and mountain, with the crew puzzling over a blank map. |
| 2. The Departure Crew | [title-five-travelers.png](title-five-travelers.png) | Warm ensemble cover: five travelers at a mossy coffee shelter, an overloaded van and a fern escaping the luggage. |
| 3. Portland Beckons | [title-portland-beckons.png](title-portland-beckons.png) | Destination cover: the crew looks toward Portland's bridge, skyline and mountain, carrying an absurdly large coffee mug. |

[Exact prompts and provenance](generation.json) include the tool, date, original generator paths, dimensions and SHA-256 hashes. These masters are preserved unchanged. The provenance status records their initial creation as candidates. [Screen previews and checks](../../validation/splash-candidates-v5/) preserve all three alternatives using temporary WebP exports and browser request interception. The selected image is also checked through the actual asset pipeline; see the [integration record](../../validation/2026-10-02-splash-v5.md).

The Road Ahead makes the road trip, five travelers and destination legible together. The Departure Crew emphasizes personality; Portland Beckons emphasizes the destination.

[prepare-assets.py](../../../app/scripts/prepare-assets.py) registers `title-road-ahead.png` as `title` with no crop and no sign repair. The previous source JPEG remains preserved. The generated illustration contains no embedded lettering, so the old fixed repair would damage the replacement.
