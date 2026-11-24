# PhotoLens wardrobe studio

The existing quick suggestions remain available beside a local catalog, Studio 2D, Studio 3D, and Lookbook.

## Catalog counts

- 60 generated illustration templates across 12 categories (5 each).
- 20 material labels and 40 repeatable pattern definitions.
- 0 verified retail products and 0 sourced size tables.
- 120 template asset references: one SVG renderer and one procedural 3D renderer per template. There are no sourced retail images or bundled GLB models. Three.js 0.187.0 and ONNX Runtime Web 1.23.2 load on demand under MIT licenses.

Templates are not real garments. Unknown measurements and material properties remain empty; see `DATA_TODO.md`.

## Local data and privacy

The repository migrates saved items and looks from `photolens_wardrobe_v1` and `photolens_outfits_v1`, retaining IDs, names, colors, notes, and old pattern aliases. Items and looks use IndexedDB with localStorage fallback; uploaded binary files require IndexedDB and fail clearly if it is unavailable. Image, SVG, and GLB inputs are checked for supported signatures/headers and SVG active/external content is removed. Local image previews are read back from IndexedDB. Photos and measurements never go to AI; measurements stay in memory unless local save is selected. Optional AI compose sends only filtered candidate IDs and non-body attributes (category, color, style, pattern, material, season), background, genre, and weather to a configured Worker. If unavailable, local rules choose a look.

## On-device image cutout

The optional cutout starts only after the user presses its button. The browser worker downloads pinned ONNX Runtime Web 1.23.2 and the U²-NetP model on demand. The Apache-2.0 weights are 4,574,861 bytes and are SHA-256 checked before inference, then cached locally. The model card and authors are recorded in `data/wardrobe/assets-manifest.json`. The user photo is decoded and processed in the browser and is never sent to the model host or Worker AI. Runtime/model downloads need a network connection the first time. U²-NetP detects generic salient objects; it is not a garment-specific segmenter, so its transparent PNG preview must be checked before saving. If inference is unavailable, the original image remains available.


Studio 2D uses a shared centimetre mannequin record, four deliberately illustrative reference presets, bounded custom measurements, and parameterized SVG anchor geometry. Color, motif, pose, and flat-lay controls remain available. Reference dimensions are synthetic UI defaults, not population statistics or inferred body data. An automated test checks all 60 template paths against the 410×450 SVG viewBox for each of the four presets (240 combinations); this verifies 2D path bounds only, not garment-to-body penetration. Studio 3D uses low-poly procedural geometry with pointer/touch rotation, pinch/scroll zoom, arrow-key rotation, and camera height/distance sliders. If WebGL or the pinned Three.js module cannot load, the interface returns to 2D. Three.js loads on demand from the pinned CDN version recorded in the asset manifest.

Fit values are arithmetic differences between user-entered measurements and optional garment measurements. They do not predict drape, actual fit, body shape, or collisions. There is no trained model, photo segmentation, rigged GLB mannequin, morph-target fitting, cloth simulation, or triangle-level clipping test. Performance targets have not been benchmarked.

## Development

Run `npm run test:unit` for core, migration, Worker schema, and manifest checks. Run `npm run build` for the Vite build. `npm run worker:deploy` deploys the optional Worker route when a Cloudflare account is configured; GitHub Pages does not deploy the Worker.

## Architecture and asset contract

See [WARDROBE_ARCHITECTURE.md](WARDROBE_ARCHITECTURE.md) for module boundaries, shared centimetre measurements, privacy limits, and stage gates, and [ASSET_SPEC.md](ASSET_SPEC.md) for the asset coordinate, provenance, and validation rules.
