# PhotoLens wardrobe asset specification

## Current inventory

The catalog contains 60 procedural illustration templates across 12 categories (five per category), 20 material labels, and 40 repeatable pattern definitions. The real retail-garment count is 0. Each template references one project-generated SVG renderer and one project-generated procedural 3D renderer in `data/wardrobe/assets-manifest.json`. There are no bundled garment photos, brand assets, or GLB models.

The build also emits one SVG thumbnail per template at `public/assets/wardrobe/previews/<template-id>.svg`. Each path is recorded as `assets.thumbnail` in `garments.json` and as a `thumbnail-svg` manifest record with SHA-256 and CC0 PhotoLens-code provenance. `npm run dev`, `npm test`, and `npm run build` regenerate missing or stale previews before use. The browser resolves the relative manifest path through Vite's `BASE_URL`, so GitHub Pages project paths are preserved. The 60 previews are procedural illustrations, not product photos; there are 0 retail photos and 0 bundled garment GLBs.

The SVG and Three.js output are reference geometry. Three.js deforms the mannequin and generates shells using the selected centimetre dimensions. Real garment measurements and size tables must be supplied independently. All currently unknown measurements and physical properties remain unset. User-imported assets stay on the user's device and are not part of the shipped manifest.

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

GLB authoring uses metres, Y up and +Z forward. The Studio renderer converts metres to centimetres with one 100× root scale. Procedural geometry uses centimetres directly. Height is measured from floor to crown. Shoulder width is measured between the two upper-arm joints. Arm length is measured from shoulder to wrist in the bind pose. Inseam is the vertical crotch-to-ankle distance in the standing reference. Circumferences define elliptical sections at neck, chest, waist and hips. The cross-sections are a simplified illustration with documented depth ratios in the geometry module. They are not scans or a grade rule for sewing.

Bone names are case-sensitive. The rest skeleton and convention are:

    Root
      Pelvis
        Spine
          Neck
            Head
          UpperArm_L → Forearm_L → Hand_L
          UpperArm_R → Forearm_R → Hand_R
        Thigh_L → Shin_L → Foot_L
        Thigh_R → Shin_R → Foot_R

The procedural mannequin uses one closed surface with shared vertices at the head, neck, torso, shoulders, hands, hips, knees and feet. Catmull–Clark subdivision smooths the surface at two levels of detail. Joint regions interpolate up to four normalized bone weights from the same control mesh. The posed renderer and collider use the same surface and weights. The asset manifest records the generator and provenance.

Each relative position morph target records the incremental geometry change for its own centimetre input. The summed targets must match the reference body used for collision checks.

| Morph | Reference cm | Control range cm |
|---|---:|---:|
| Height | 170 | 140–210 |
| ShoulderWidth | 40 | 30–60 |
| ChestCircumference | 90 | 60–150 |
| WaistCircumference | 74 | 45–140 |
| HipCircumference | 96 | 60–160 |
| ArmLength | 58 | 40–90 |
| InseamLength | 78 | 55–110 |
| NeckCircumference | 34 | 25–55 |

Place the following metadata at **asset.extras.photoLens** in the GLB JSON:

    { "schemaVersion": 1, "unit": "m", "upAxis": "Y", "binding": "anchor", "anchor": "Pelvis" }

- For binding **anchor**, author the static mesh around the named bone's local origin. Use **Root** for a full piece positioned in standing world coordinates. The studio moves the mesh with that bone. Geometry should already be sized for the intended reference.
- For binding **rigged**, the skin joints must use the names above. Author the garment bones in a matching reference pose and parent hierarchy. The studio applies the preset rotation deltas to matching joints and validates the visible pose against the current body. Arbitrary rigs, user-authored morph targets and size-table rows do not imply geometric retargeting.
- Use a GLB 2 file with embedded textures and buffers. No resource URI is accepted. Triangles are the only supported primitive mode. UVs must tile over seams. Name the recolorable base material **main** for generated assets.
- A garment vertex inside the mannequin counts as penetration. The studio measures this by ray parity against the closed posed body surface. It indexes triangles in the plane transverse to the ray so that each query visits only the triangles close to the ray. Procedural garment vertices found inside move to a nearby exterior position. A user GLB exceeding 1% at the current pose falls back to the procedural preview. This criterion does not measure edge-to-edge crossings, garment-on-garment intersections, fabric pressure, or actual fit. Cloth frames are screened against the same body mesh before display.

## Size and performance contract

- Every known measurement is a positive centimetre value taken at a documented landmark. Unknown values stay empty. A size table has a version and source. Select the size with the most comparable measurements, then the smallest total absolute difference. Show signed differences even when the closest size has a negative difference.
- The live scene reserves a 150,000-triangle budget including the mannequin and floor. User assets count each mesh instance. The renderer loads on demand and selects 12 or 20 radial segments based on device capacity. Generated PBR maps are 1,024 px; user textures can be smaller, with a strict 2,048 px maximum per edge. Target 1,024–2,048 px for main maps of authored assets.
- GLB loading accepts Draco and meshopt geometry and KTX2 textures via the pinned Three.js codecs. Runtime, decoders and maps are listed in the asset manifest. On devices using low power mode or reduced motion, cloth and certain renderer effects are disabled. WebGL2 absence or context loss returns the user to 2D.

## Tools and validation

- **npm run test:unit** validates catalog records and provenance, checks mannequin topology, skin weights and posed triangle crossings at both levels of detail, checks garment vertex penetration across presets and poses, and tests GLB validation and fit arithmetic.
- **node tools/assets/wardrobe-asset.mjs generate tpl-tops-1 output** creates a standalone procedural GLB, SVG thumbnail and a SHA-256 manifest. Generated files are local outputs and are not bundled by default.
- **node tools/assets/wardrobe-asset.mjs inspect FILE** validates a GLB or project SVG. **node tools/assets/wardrobe-asset.mjs manifest FILE OUTPUT_JSON SOURCE LICENSE AUTHOR** checks a file and records its provenance.
- **node tools/assets/wardrobe-asset.mjs compress INPUT_GLB OUTPUT_GLB** requires a local native gltfpack build with Basis Universal. It produces meshopt and KTX2 as applicable, preserves the PhotoLens contract and validates the result. Draco files can be authored with a separate encoder and loaded directly.

## User imports and browser models

- User-provided photos, SVG, and GLB files are local user assets, separate from generated templates. Store their blobs in IndexedDB and keep only metadata/references in the state record. If IndexedDB cannot persist a binary, fail visibly and do not create a phantom asset reference.
- Imported SVG is sanitized before saving: remove scripts, foreign objects, style blocks/attributes, event handlers, external URLs, and remote references. Preview user SVG as an image resource, never inject its markup into the app DOM.
- A browser model record belongs in `assets-manifest.json` with a pinned revision, HTTPS source, SPDX license, author, byte size, SHA-256, input/output contract, loading behavior, and documented limitation. Verify its hash before inference.
- Model weights and runtime are fetched only after a user action, run locally in a browser worker, and are cached locally. The user’s image must never be included in fetch requests or Worker AI payloads. A generic saliency model must be described as approximate and its result reviewed by the user.
