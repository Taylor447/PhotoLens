# PhotoLens

PhotoLens is a Vietnamese app for analyzing one photo or comparing two photos. Image metrics run locally in Canvas 2D and a Web Worker. Optional AI analysis sends a resized image to a Cloudflare Worker that you configure.

## Platforms

- Web: Windows and modern browsers
- Android: Capacitor Camera, Share, and Preferences
- Windows desktop: Electron

## Run locally

Requires Node.js and npm. On Windows PowerShell, use `npm.cmd` and `npx.cmd` if script execution is restricted.

```powershell
npm.cmd install
npm.cmd run dev
```

## Gemini and Worker

1. Create a Gemini API key in Google AI Studio.
2. Never put the key in frontend code or commit it to GitHub.
3. For a deployed Worker, set the key as a Worker secret:

```powershell
npx.cmd wrangler secret put GEMINI_API_KEY --config worker/wrangler.toml
npm.cmd run worker:deploy
```

4. In PhotoLens, configure the Worker URL in AI settings.

For local development, create `worker/.dev.vars` from `worker/.dev.vars.example`, add the key there, then run:

```powershell
npm.cmd run worker:dev
```

Do not commit `worker/.dev.vars`. Technical measurements work locally; Gemini requires network access, a valid API key, and an available Worker endpoint.

## Build

```powershell
npm.cmd run build
npm.cmd run electron:build
```

The Windows installer is generated under `release/`.
