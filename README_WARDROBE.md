# PhotoLens wardrobe studio

The existing quick suggestions remain available beside a local catalog, Studio 2D, Studio 3D, and Lookbook.

## Catalog counts

- 60 generated illustration templates across 12 categories (5 each).
- 20 material labels and 40 repeatable pattern definitions.
- 0 verified retail products and 0 sourced size tables.
- 120 manifest references: one SVG renderer and one procedural 3D renderer reference per template. There are no external images or bundled GLB models. Three.js 0.187.0 is fetched on demand under its MIT license, then disposed when leaving the studio.

Templates are not real garments. Unknown measurements and material properties remain empty; see `DATA_TODO.md`.

## Local data and privacy

The repository migrates saved items and looks from `photolens_wardrobe_v1` and `photolens_outfits_v1`, retaining IDs, names, colors, notes, and old pattern aliases. Items and looks use IndexedDB with localStorage fallback; binary imports require IndexedDB. No photo or body measurement is uploaded. Measurements stay in memory unless the user checks the local-save consent box. Optional AI compose sends only filtered candidate IDs and non-body attributes (category, color, style, pattern, material, season), background, genre, and weather to a configured Worker. If unavailable, local rules choose a look.

## Studio and limits

Studio 2D renders SVG layers with color, motif, pose, and flat-lay controls. Studio 3D uses low-poly procedural geometry with pointer/touch rotation, pinch/scroll zoom, arrow-key rotation, and camera height/distance sliders. If WebGL or the pinned Three.js module cannot load, the interface returns to 2D. Three.js loads on demand from the pinned CDN version recorded in the asset manifest.

Fit values are arithmetic differences between user-entered measurements and optional garment measurements. They do not predict drape, actual fit, body shape, or collisions. There is no trained model, photo segmentation, rigged GLB mannequin, morph-target fitting, cloth simulation, or triangle-level clipping test. Performance targets have not been benchmarked.

## Development

Run `npm run test:unit` for core, migration, Worker schema, and manifest checks. Run `npm run build` for the Vite build. `npm run worker:deploy` deploys the optional Worker route when a Cloudflare account is configured; GitHub Pages does not deploy the Worker.
