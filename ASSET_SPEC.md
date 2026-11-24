# PhotoLens wardrobe asset specification

## Current inventory

The catalog contains 60 procedural illustration templates across 12 categories (five per category), 20 material labels, and 40 repeatable pattern definitions. The real retail-garment count is 0. Each template references one project-generated SVG renderer and one project-generated procedural 3D renderer in `data/wardrobe/assets-manifest.json`. There are no bundled garment photos, brand assets, or GLB models.

The SVG and Three.js output are generic category silhouettes. They are not sewing patterns, validated garment meshes, calibrated body geometry, or evidence of real-world fit. All currently unknown measurements and physical properties remain unset. User-imported assets stay on the user's device and are not part of the shipped manifest.

## Provenance and license rules

Every bundled render asset must have an exact ID in both the garment record and the manifest. Every manifest entry records `source`, `license`, and `author`, plus its generator and format. The current project-generated illustrations are marked CC0 in the manifest; this is a project asset declaration, not a claim about any external source. No third-party garment assets are bundled.

A new external asset is accepted only when its source and commercial-use terms are clear and recorded. An imported user file is private user data: store its name, MIME type, and bytes locally; do not add it to the public manifest or redistribute it.

## Coordinate systems and identifiers

### SVG 2D

- Current illustration canvas: `viewBox="0 0 410 450"`; origin at top-left, +X right, +Y down. These are illustration units, not centimetres.
- A garment root uses `data-garment="<catalog-id>"`. Layer order is the integer `layerOrder` in the catalog.
- Future region-aware SVG assets must use stable region IDs derived from the garment ID (for example, `<garment-id>--main`, `<garment-id>--sleeve-left`) and named anchors from the shared mannequin contract. Do not claim a recolor region or anchor until the SVG contains it.
- SVG/PNG exports are visual previews, not printable patterns or production cut files.

### 3D

- GLB authoring units: metres; local coordinate convention: Y up, +Z forward. Convert to the studio's centimetre measurements through one explicit scale transform (1 m = 100 cm).
- Current procedural scene geometry uses Y up and +Z toward the camera, but its rounded forms are illustrative and are not calibrated to the user's measurements.
- Future mannequin bones use the normalized names in the list below. Names are case-sensitive. A model with missing or renamed required bones fails validation rather than silently attaching to a guessed bone.

```text
root, spine, chest, neck, head
shoulder.L, elbow.L, wrist.L
shoulder.R, elbow.R, wrist.R
hip.L, knee.L, ankle.L
hip.R, knee.R, ankle.R
```

- Future mannequin morph targets are `height_cm`, `shoulder_width_cm`, `chest_circumference_cm`, `waist_circumference_cm`, `hip_circumference_cm`, `arm_length_cm`, `leg_length_cm`, and `neck_circumference_cm`. Each morph target records its neutral value and supported centimetre range in the asset manifest.
- Garment anchors follow the same landmark names as the mannequin (shoulders, chest, waist, hips, crotch, knees, ankles, wrists, and neck). Garments without a required anchor cannot be presented as fitted to that body dimension.
- UVs for repeating fabric motifs must be tileable without a visible seam. PBR texture maps, when present, must declare map type and dimensions in pixels.

## Size and performance contract

- Every known body/garment measurement is a positive number in centimetres with a documented landmark. Unknown values remain `null` or absent.
- A size table has a version and an explicit measurement source. Do not fabricate a brand size, physical fabric property, GLB, or fitted measurement.
- A future GLB manifest entry records model version, source, license, author, units, triangle count, texture dimensions, compression, and supported size-table version.
- Scene budget: no more than 150,000 triangles; texture maps 1,024–2,048 px. Use Draco or meshopt and KTX2 when the pipeline supports them, plus lazy loading and LOD. These are targets for future GLBs, not measurements of current assets.
- Asset tooling must reject missing IDs, provenance, invalid units/axes, forbidden triangle counts, and invalid SVG IDs. Optimization and thumbnail generation must preserve the manifest record.

## Current validator coverage

`npm run test:unit` runs `tools/assets/validate-wardrobe.mjs` to check schema shape, category coverage, unique IDs, catalog-to-manifest references, provenance, and actual catalog counts. There are currently no GLBs, so rig, morph, UV, triangle-budget, texture, compression, LOD, and clipping checks are not applicable yet. The current `inspectTemplateBounds` helper is explicitly a shell-margin proxy; it does not test mesh intersections. Do not label its output as a collision or clipping measurement.

## User imports and browser models

- User-provided photos, SVG, and GLB files are local user assets, separate from generated templates. Store their blobs in IndexedDB and keep only metadata/references in the state record. If IndexedDB cannot persist a binary, fail visibly and do not create a phantom asset reference.
- Imported SVG is sanitized before saving: remove scripts, foreign objects, style blocks/attributes, event handlers, external URLs, and remote references. Preview user SVG as an image resource, never inject its markup into the app DOM.
- A browser model record belongs in `assets-manifest.json` with a pinned revision, HTTPS source, SPDX license, author, byte size, SHA-256, input/output contract, loading behavior, and documented limitation. Verify its hash before inference.
- Model weights and runtime are fetched only after a user action, run locally in a browser worker, and are cached locally. The user’s image must never be included in fetch requests or Worker AI payloads. A generic saliency model must be described as approximate and its result reviewed by the user.
