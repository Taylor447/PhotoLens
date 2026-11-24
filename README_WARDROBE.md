# PhotoLens wardrobe studio

The existing quick suggestions remain available beside a local catalog, Studio 2D, Studio 3D, and Lookbook.

## Catalog counts

- 60 generated illustration templates across 12 categories (5 each).
- 20 material labels and 40 repeatable pattern definitions.
- 0 verified retail products and 0 sourced size tables.
- 120 template asset references: one SVG renderer and one procedural 3D renderer per template. There are no sourced retail images or bundled GLB models. Three.js 0.187.0 and ONNX Runtime Web 1.23.2 load on demand under MIT licenses. The shipped decoder provenance is in the manifest.

Templates are not real garments. Unknown measurements and material properties remain empty; see `DATA_TODO.md`.

## Local data and privacy

The repository migrates saved items and looks from `photolens_wardrobe_v1` and `photolens_outfits_v1`, retaining IDs, names, colors, notes, and old pattern aliases. Items and looks use IndexedDB with localStorage fallback; uploaded binary files require IndexedDB and fail clearly if it is unavailable. Image, SVG, and GLB inputs are checked for supported signatures/headers and SVG active/external content is removed. Local image previews are read back from IndexedDB. Photos and measurements never go to AI; measurements stay in memory unless local save is selected. Optional AI compose sends only filtered candidate IDs and non-body attributes (category, color, style, pattern, material, season), background, genre, and weather to a configured Worker. If unavailable, deterministic local rules still choose from the visible candidate pool. Random, variation, anchor-item, and compact capsule modes are seeded/reproducible where applicable. Rules explain color contrast, pattern count, fit-label balance, layer order, dress-code tags, shoot genre, weather, moiré, reflection, wrinkling, and highlight risk. Missing product data stays “Chưa có dữ liệu”; no score claims body fit.

## On-device image cutout

The optional cutout starts only after the user presses its button. The browser worker downloads pinned ONNX Runtime Web 1.23.2 and the U²-NetP model on demand. The Apache-2.0 weights are 4,574,861 bytes and are SHA-256 checked before inference, then cached locally. The model card and authors are recorded in `data/wardrobe/assets-manifest.json`. The user photo is decoded and processed in the browser and is never sent to the model host or Worker AI. Runtime/model downloads need a network connection the first time. U²-NetP detects generic salient objects; it is not a garment-specific segmenter, so its transparent PNG preview must be checked before saving. If inference is unavailable, the original image remains available.


The rule score is a transparent heuristic, not a visual-quality guarantee. Manual temperature, rain, and wind inputs are available when forecast data is absent. Lookbook supports local save, tags, rename, duplicate, compare, and SVG/PNG/PDF export.

Studio 2D uses a shared centimetre mannequin record, four deliberately illustrative reference presets, bounded custom measurements, and parameterized SVG anchor geometry. Color, motif, pose, and flat-lay controls remain available. Reference dimensions are synthetic UI defaults, not population statistics or inferred body data. An automated test checks all 60 template paths against the 410×450 SVG viewBox for each of the four presets (240 combinations); this verifies 2D path bounds only, not garment-to-body penetration. Studio 3D renders a rigged procedural mannequin with eight measurement morphs. Rotation, pinch and keyboard controls, turntable, five lighting presets and optional camera settings from Góc chụp are available. The cloth worker updates skirts, dresses and capes on supported devices. Local GLB imports must follow the PhotoLens units and anchor contract. The browser falls back to Studio 2D if WebGL2 fails.

Size recommendations and signed differences in centimetres require comparable measurements. The catalog contains no measured physical garments or sourced size tables. The user can supply those dimensions in the local closet. The 3D vertex penetration gate for generated assets is 1% or less against posed body geometry. Garment-to-garment contact, true cloth drape and real-world fit are outside this result. Browser FPS targets need device measurements.


## Mix & Match and Lookbook

Studio 2D and Studio 3D read the same ordered outfit state. Colour, pattern and layer edits belong to the outfit. The same undo/redo history also tracks locks. A Lookbook save stores outfit edits, tags, background and pose. It does not store a copy of local body measurements. Attach a saved look from either Lookbook or the shooting plan editor. A plan retains the name saved with its reference if the original look is later deleted.

Quick suggestions and the Studio use the same weather inputs and background colour. With an analysis report open, the picker can reuse the on-device K-means swatches from image A or B. Manual weather values take precedence for the current session. Lookbook can export PNG/PDF, or send a PNG through the Android share sheet when running through Capacitor. Browsers without file sharing download the PNG.

The browser and Worker share the outfit request/response contract. The request includes the current genre, selected background colour, weather and up to 60 filtered candidate records. Free-text notes, names, photos, size data and avatar settings are excluded. The Worker accepts only unique IDs from the candidate pool and can retry malformed model output twice after its first attempt. The browser uses deterministic local rules if AI is disabled, unavailable or returns invalid data.

## Development

Run `npm run test:unit` for core, migration, Worker schema, and manifest checks. Run `npm run build` for the Vite build. `npm run worker:deploy` deploys the optional Worker route when a Cloudflare account is configured; GitHub Pages does not deploy the Worker.

## Architecture and asset contract

See [WARDROBE_ARCHITECTURE.md](WARDROBE_ARCHITECTURE.md) for module boundaries, shared centimetre measurements, privacy limits, and stage gates, and [ASSET_SPEC.md](ASSET_SPEC.md) for the asset coordinate, provenance, and validation rules.
