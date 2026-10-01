# iPhone scenery and motion artwork

Generated October 1, 2026 with the built-in image generation tool. These three PNG masters are preserved unchanged. Exact prompts and generation provenance are in [generation.json](generation.json).

| Master | App role |
| --- | --- |
| [road-river.png](road-river.png) | River-gorge highway between miles 200 and 350; the existing van is layered over the empty road. |
| [road-city.png](road-city.png) | Portland bridge and skyline from mile 870 to the destination. |
| [heatwave.png](heatwave.png) | The existing heatwave encounter, with wilted roadside greenery and a bird hiding beneath a sunhat. |

All three were visually inspected. They use the game's green illustrated style and avoid embedded interface text. The two road scenes contain no vehicle, keeping the animated van consistent. Forest scenery also replaces the campground background during open-road travel around mile 570; the campground remains a destination scene.

App copies are 1280×853 JPEGs, exported at quality 82 with macOS `sips`. [mobile-art-manifest.json](../../../app/assets/mobile-art-manifest.json) records dimensions, byte counts and SHA-256 hashes. Existing artwork was preserved.

## Phone exports

All 24 app scene JPEGs now have 640px and 960px wide copies at quality 72 in [app/assets/mobile/](../../../app/assets/mobile/). The browser selects a smaller image for phone portrait and short touch-device landscape viewports; desktop retains its full-size source. A DPR3 phone selects the 960px copy. The 960px forest-road file is 64% smaller than its desktop source, and the mushroom-market file is 66% smaller. These are encoded file-size reductions, not a measured network-speed claim.

The [export script](../../../app/scripts/prepare-mobile-art.mjs) is reproducible on macOS and never overwrites sources. [mobile-images.json](../../../app/assets/mobile-images.json) records source/output hashes. The exported images are committed; normal builds need only Node and do not invoke `sips`.

## Motion

The app adds CSS layers for clouds, road dust and passing marks during Drive. Stops briefly show leaves, rain, embers or steam; arrival effects begin after an encounter closes. Supply and health changes receive a short highlight. Effects use transforms and opacity, are hidden from accessibility APIs, and do not intercept input. They stop automatically and are disabled by reduced-motion settings. No new animation files or save fields are required.

See [iPhone validation](../../validation/2026-10-01-iphone-polish.md) for measurements and screenshots.
