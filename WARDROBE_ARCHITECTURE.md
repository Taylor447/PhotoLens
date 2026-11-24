# Wardrobe & outfit studio architecture

## Repository snapshot

This document describes the current PhotoLens source for the GĐ0 baseline, following the initial catalog and studio implementation. The app is a Vite app made of JavaScript modules, with the shooting planner as its host.

| Concern | Current implementation | Boundary to preserve |
|---|---|---|
| Planner tabs and weather/background context | `features/planner.js` | Keep quick suggestions intact; pass only selected background, genre, and weather into wardrobe views. |
| Catalog, local closet, editor, lookbook, interaction state | `features/wardrobe-studio.js` | Split view/controller concerns as the wardrobe modules are built. |
| Garment normalization, IndexedDB/localStorage repository, fit arithmetic, color rules, score, SVG rendering, shared mannequin anchors | `core/wardrobe-engine.js` | Keep shared parameters in centimetres; fit arithmetic remains separate from physical fit claims. |
| Procedural 3D mannequin and garment shapes | `features/wardrobe3d.js` | Still illustrative; share the 2D centimetre input, but do not claim 3D collision or garment penetration measurements. |
| Static procedural data and asset provenance | `data/wardrobe/*` | Keep catalog templates separate from user-owned closet records. |
| Optional candidate-constrained AI | `worker/src/index.js` | The Worker receives filtered item IDs and non-body facts only; local rules remain the offline path. |
| Shared visual tokens and planner styling | `css/tokens.css`, `css/planner.css`, `css/studio.css` | Reuse existing tokens; keep controls readable and touch targets large. |

## Target module boundaries

Move code in small, reviewable steps; do not duplicate state during the migration.

- `features/wardrobe/catalog/`: static catalog loading, search/filter UI, user closet import/export, and local persistence.
- `features/wardrobe/studio2d/`: SVG paper-doll, flat-lay, pose, recolor/pattern, and image export.
- `features/wardrobe/studio3d/`: capability detection, scene lifecycle, renderer, camera presets, and GLB loading.
- `features/wardrobe/rules/`: deterministic outfit constraints, explanations, weather/dress-code rules, and score calculation.
- `features/wardrobe/lookbook/`: saved looks, comparison, image/PDF export, share sheet, and planner linkage.
- `core/fit/`: canonical centimetre measurements, size-table selection, ease calculation, and later geometric clipping tests.
- `core/color/`: hue relationships, background contrast, and accessible color checks.
- `tools/assets/`: schema/provenance checks now; SVG/GLB validation, optimization, thumbnails, and manifest generation only when those formats are implemented.

During migration, the current modules remain the compatibility façade. Each new module must have deterministic inputs and outputs so it can be unit-tested without a browser or Worker.

## Shared data contracts

### Garment data

The shipped `garments.json` contains **60 procedural illustration templates**, not 60 verified physical products. It currently spans 12 categories, with five templates per category; the actual closet starts empty. Material names and pattern definitions are controlled catalog labels. Unknown garment dimensions and physical properties remain `null` or absent; no dimensions are inferred from a picture or a name.

Every shipped render asset has a stable ID and a matching manifest record with source, license, and author. User imports are stored locally and do not become bundled project assets.

### Mannequin measurements

The 2D and 3D views consume one normalized mannequin object in centimetres. UI reference defaults and the four presets are synthetic drawing references; only a value the user enters or a preset they select is a user-provided measurement. A blank fit record stays blank; reference geometry is not silently saved or sent to AI. Canonical dimensions are centimetres:

- `heightCm`: floor to crown.
- `shoulderWidthCm`: left-to-right shoulder landmark distance, not circumference.
- `chestCircumferenceCm`, `waistCircumferenceCm`, `hipCircumferenceCm`, `neckCircumferenceCm`: circumference at the named body landmark.
- `armLengthCm`: shoulder landmark to wrist landmark.
- `legLengthCm`: crotch landmark to ankle landmark along the leg centreline; keep the user or preset measurement method with the value.

Unknown measurements are `null`; do not fill defaults into the user's measurement record. A neutral mannequin render may use a documented drawing proportion, but it must be labelled an illustration, not a measurement.

The current interface accepts `heightCm`, `shoulders`, `chest`, `waist`, `hips`, `sleeve`, `inseam`, and `neck`; each is a centimetre value. Bounds are explicit in `normalizeMannequin`. `createMannequinAnchors` maps them into one 410×450 2D stage. These abbreviated keys are not yet the fully documented semantic `*Cm` contract above; garment-size records need landmark metadata before their differences can be presented as physical ease.

### Fit and collision language

Body measurements and garment measurements are separate records even when their dimensions can be compared. Garment `measurementsCm` fields describe the garment itself: `shoulderWidthCm`, chest/waist/hip and neck circumferences, `sleeveLengthCm`, `inseamLengthCm`, and `garmentLengthCm`. The body mannequin record uses the fields above. Compare only compatible landmarks and dimensions: shoulder width to shoulder width; each circumference to the same circumference; arm length to sleeve length only when both endpoints are documented; and leg length to inseam only when the chosen endpoints are documented. Height alone does not imply a garment length. Report a signed centimetre difference with its definitions; do not call it fit or ease when the landmarks differ. Missing, mismatched, or unverified values produce “Chưa có dữ liệu”. No arithmetic result predicts drape or comfort.

A clipping percentage may be reported only after testing mesh intersections against the mannequin geometry, with the tested preset set, garment set, and threshold recorded. A shell margin, coverage radius, image-space overlap, or heuristic score is a proxy and must not be labelled “collision”, “clipping”, or a measured body dimension. Collision/coverage-style labels are not evidence of measured clipping unless backed by a calibrated geometry test.

## Privacy boundary

Body measurements, clothing photos, and imported SVG/GLB files stay on device. A saved measurement is written locally only after the user opts in. The AI route may receive candidate item IDs and the minimum non-body attributes needed to compose an outfit, plus the selected background, genre, and weather. It must not receive body measurements or photos. Do not add photo segmentation or virtual try-on models in the required stages; the optional ML phases remain off until the user explicitly enables them.

## Stage gates

| Gate | Deliverable | Evidence required before marking complete |
|---|---|---|
| GĐ0 | Architecture, asset contract, and strict catalog schema | Schema/data/provenance checks and repository build/unit CI. |
| GĐ1 | Searchable catalog, local closet, imports | Accurate counts separated into templates, verified real garments, and user imports; privacy and migration tests. |
| GĐ2 | Shared mannequin data and measurement-driven 2D anchor geometry | Unit tests cover centimetre clamping, the single anchor transform, existing layer order, and all 60 template SVG bounds across four references (240 path-bound checks). This is not a 3D intersection test. |
| GĐ3 | Deterministic rules, explanations, lookbook, weather/background context | Unit tests cover fit arithmetic, contrast, layer order, known large-pattern collisions, weather warnings, seed stability, anchor selection, and capsule categories. Rules cannot infer missing material or size data. |
| GĐ4 | 3D renderer and numeric fit | Calibrated asset checks and actual intersection tests across each declared preset/template combination; no proxy reported as clipping. |
| GĐ5 | 2D/3D synchronization, Worker compose, planner linkage | Contract tests prove AI IDs are a subset of the filtered candidate IDs and no body data leaves the device. |
| GĐ6 | Parameterized garment builder | Generated assets pass the same schema, bounds, provenance, and export checks. |
| GĐ7 | Optional ML / photo try-on | Disabled by default; model and dataset license, execution location, and independent evaluation reported before enabling. |
| GĐ8 | Performance and release documentation | CI, accessibility, offline/WebGL fallback, performance measurements, and final inventory report. |

GĐ0–GĐ2 provide the architecture, catalog, and measured 2D anchor geometry; GĐ3 adds deterministic outfit constraints, a seeded local composer, manual weather, and explainable scoring. Current coverage does not imply calibrated garment measurements or physical fit. Later-stage capabilities must not be described as delivered until their evidence exists.
