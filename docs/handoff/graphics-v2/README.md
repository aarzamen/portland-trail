# Roadtrip artwork

Six new masters were generated with the built-in image_gen tool on October 1, 2026. [generation.json](generation.json) preserves the exact prompts and original output locations. These project copies are the durable sources; the app does not read from Codex's image output directory.

| Master | Game use |
|---|---|
| [mushroom-market.png](mushroom-market.png) | Mushroom market at mile 100 |
| [river-ferry.png](river-ferry.png) | River ferry landing at mile 280 |
| [forest-camp.png](forest-camp.png) | Fir forest campground at mile 570 |
| [bookshop.png](bookshop.png) | Used-book shop at mile 870 |
| [road-forest.png](road-forest.png) | Road backdrop behind the animated van |
| [app-icon.png](app-icon.png) | Desktop, home-screen and browser icons |

All six outputs were visually inspected. Scenes use green pixel-style illustration and contain no vehicles, so the existing van can be animated separately. This is a pixel-inspired art treatment rather than a strict fixed sprite grid. The location scenes are distinct places in the playable route with activities and conversation rewards.

The [production manifest](../../../app/assets/generated-manifest.json) records dimensions, source hashes and output hashes. On macOS, run `node app/scripts/prepare-generated-assets.mjs` from the project root to export JPEG scenes and PNG icons with the built-in `sips` tool. Original masters and the earlier artwork remain unchanged.

Icons are supplied at 16, 32, 180, 192 and 512 pixels. Browser icons and Apple touch metadata are linked from the app's HTML; standalone launch metadata is in [manifest.webmanifest](../../../app/manifest.webmanifest). Relative paths support hosting under a subdirectory. The manifest follows the [Web Application Manifest specification](https://www.w3.org/TR/appmanifest/); Apple icon behavior follows [WebKit's web-app icon guidance](https://webkit.org/blog/14787/webkit-features-in-safari-17-2/). No offline caching is implied.
