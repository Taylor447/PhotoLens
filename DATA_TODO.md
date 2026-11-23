# Wardrobe data TODO

The current catalog contains **60 generated illustration templates**, not verified retail garments. It has **0 real product records**.

- No verified garment size charts or physical measurements; template `measurementsCm` and `sizeTable` are empty.
- Material names are labels only. Weight, stretch, opacity, rain/wind resistance, and exact composition are not sourced.
- Shooting flags are mostly unset; the motif definitions are not measured textile samples.
- No licensed or user-provided GLB is in the bundled catalog. User GLB uploads are stored locally but are not rendered by the current 3D studio.
- No background-removal model or garment-photo classifier is included. No user image is sent to AI.
- Fit is arithmetic comparison only. Geometry clearance is a shell-margin proxy, not mesh collision/clipping detection.
- Traditional and cosplay labels are illustrative and have not been reviewed by cultural or costume specialists; they are not sewing patterns.
- 3D clothing uses lightweight procedural primitives. There is no rigged GLB, morph target fitting, PBR textile, cloth simulation, or triangle-level clipping test.
- The 60 FPS and Android performance targets have not been benchmarked.
