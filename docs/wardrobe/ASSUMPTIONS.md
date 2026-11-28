# S1 assumptions and visual QA

- The S1 starting point is the merged `main` commit `36bc7a4` (PR #14). The branch name `feature/wardrobe-levelup` was not present on the remote when this workspace was created, so the S1 work is isolated under that name locally.
- The outfit context controls stay available inside a collapsed disclosure on Studio 2D/3D. They remain expanded in the other outfit tabs. The properties panel still exposes the background color directly.
- On narrow screens, the closet opens as a bottom tray when its summary is selected. Its open state persists across Studio redraws during this session. The canvas comes first.
- The camera preserves the chosen lens and requested shooting distance. Initial framing may move farther away when the mannequin or outfit would otherwise be cropped. A user zoom overrides automatic framing until **V?a khung 3D** or the **0** key resets it.
- Visual QA uses Playwright at 1440x900 and 412x915. `npx playwright test tests/e2e/wardrobe.spec.js` captures desktop/mobile layout and 2D/3D screenshots in test artifacts. Inspect the screenshots for cropped garments, overlapping labels, unreadable form fields and controls below the visible canvas.
- No image baseline was supplied in this checkout. The screenshot artifacts are inspection references, not pixel-perfect golden images. Device emulation cannot establish physical Android performance or screen-reader behavior.
