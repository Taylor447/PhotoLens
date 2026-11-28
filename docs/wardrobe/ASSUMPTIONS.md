# S1 assumptions and visual QA

- S1 starts at merged `main` commit `36bc7a4` (PR #14). The branch `feature/wardrobe-levelup` was created for this work.
- Outfit context controls remain available inside a collapsed disclosure in Studio 2D/3D, and stay expanded in other outfit tabs.
- The mobile closet opens as a bottom tray when selected. Its open state persists across redraws in the session.
- Initial camera framing can move farther away to include the mannequin and outfit while preserving lens and requested minimum distance. User zoom disables auto framing until reset using the button or key 0.
- Visual QA targets 1440×900 and 412×915. Screenshots are inspection references, not pixel-perfect golden images.
