# PhotoLens wardrobe asset specification

## Current inventory

The studio draws SVG shapes and low-poly Three.js geometry generated from project code. It bundles no third-party photos, brand assets, GLB models, or textures. `data/wardrobe/assets-manifest.json` records each template renderer, source, license note, and author. User imports stay in local IndexedDB and are not redistributed.

## Coordinates and IDs

- SVG viewBox: 410 × 450 illustration units; top-left origin, X right, Y down.
- Studio 3D: Y-up, +Z faces the camera. Geometry uses a centimetre-scale illustration coordinate system, not a calibrated anthropometric model.
- SVG includes the garment ID in `data-garment`; garment data supplies color, motif, and template parameters. Ascending `layerOrder` determines stacking.
- Anchor concepts are neck/head, shoulder, torso, waist, hip, knee/leg, ankle, and wrist. No rig or named GLB bones currently exist.
- User-entered measurements and any future size-table values use centimetres; absent measurements remain null.
- Exported SVG is an illustration, not a sewing pattern or production cut file.

## Future GLB contract

For future project-owned or properly licensed GLBs, author in metres, Y-up, +Z forward; record source, license, author, model version, units, triangle count, and texture sizes in the manifest. Suggested bone names: `root`, `spine`, `chest`, `neck`, `head`, `shoulder.L/R`, `elbow.L/R`, `wrist.L/R`, `hip.L/R`, `knee.L/R`, `ankle.L/R`. Suggested morph names: `shoulder_cm`, `chest_cm`, `waist_cm`, `hip_cm`, `height_cm`. Garment meshes should expose recolorable materials and documented anchors. This is a future contract; no current asset implements it.

## License and validation

Generated illustrations use project code and no external asset source; the manifest says so and does not claim a third-party license. User files keep their own rights. `npm run test:unit` runs `tools/assets/validate-wardrobe.mjs` to verify schema version, unique IDs, references, and provenance fields. There are no GLBs, so triangle-budget and mesh-license checks are not exercised.
