# Five new scene masters

Generated October 2, 2026 with the built-in image generation tool from the [v4 brief](../../art/2026-10-02-scene-brief-v4.md). These opaque 1536×1024 RGB PNG masters are unchanged copies of the selected tool outputs. [generation.json](generation.json) records the exact expanded prompts, source paths, dates, dimensions, and SHA-256 hashes, including the Sasquatch refinement.

| Master | Game use |
| --- | --- |
| [road-pines.png](road-pines.png) | Dense old-growth road in region `pines`, miles 350–570. |
| [road-outskirts.png](road-outskirts.png) | Sparse roadside businesses in region `outskirts`, miles 750–870. |
| [sasquatch.png](sasquatch.png) | Two travelers spotting an ambiguous shaggy figure in pixel-dithered mist. |
| [toll-troll.png](toll-troll.png) | A self-appointed toll collector with a card reader beneath an overpass. |
| [brunch-line.png](brunch-line.png) | A patient queue crossing both lanes toward a Portland brunch spot. |

The shared style and exclusion blocks were expanded verbatim in every initial prompt. A targeted image-tool refinement removes the first Sasquatch version's obvious ape face; both generation steps are recorded. Original tool outputs remain at their recorded source paths. No existing masters were modified.

Each selected image was inspected for green palette, crisp stepped pixels, composition, and blank signs/screens. All five pass the brief's eight-color palette check: each representative color has green as its largest RGB component. Generated shading is not an assertion that each pixel equals one of the four prompt hex values.

The [asset pipeline](../../../app/scripts/prepare-assets.py) produces the full and 960px WebP pairs with crop `None`. The existing van stays a separate game sprite. See the [validation record](../../validation/2026-10-02-scene-art-v4.md) for the actual browser crop and regression checks.
