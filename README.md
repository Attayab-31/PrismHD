# PrismHD — Immersive Image Upscaler Starter

A standalone React/TypeScript website starter for a cinematic, scroll-driven image-upscaler experience inspired by the *storytelling principles* of Hilo Studio's Tabasco case study. It does not copy the reference's assets or branding.

## What's included

- Warm editorial design system (porcelain, ink, cobalt, restrained coral).
- A custom Three.js framed-photo scene with real 3D frame rails, image planes, resolution tiles, pointer parallax, and scroll-driven source-to-enhanced reveal.
- GSAP ScrollTrigger choreography across the main pinned/sticky story.
- Lenis smooth scrolling on larger screens when reduced motion is not requested.
- Side-by-side comparison and a keyboard/touch-friendly drag-to-compare slider.
- Responsive layout and reduced-motion fallback.
- Image upload/drag-and-drop preview and enhancement settings.
- Example API adapter that clearly reports when no enhancement endpoint is configured instead of faking success.
- A demo before/after SVG pair. These are illustrative sample assets, not real model output.

## Stack (versions verified on 27 October 2026)

- React 19.3.0 — https://react.dev/versions
- Vite 8.3.4 — https://vite.dev/
- Three.js 0.186.1 — https://www.npmjs.com/package/three
- GSAP 3.15.0 / ScrollTrigger — https://gsap.com/docs/v3/Plugins/ScrollTrigger/
- `@vitejs/plugin-react` 6.1.2 — https://www.npmjs.com/package/@vitejs/plugin-react
- `@types/three` 0.186.0 — https://www.npmjs.com/package/@types/three
- Lenis 1.3.27 — https://www.npmjs.com/package/lenis
- TypeScript 7.0.2

The site uses the stable Three.js API directly rather than the React Three Fiber v10 alpha line. This keeps the custom scene simple and lets the app retain explicit control over geometry and disposal.

## Run locally

Requires Node.js 22.12+ (Node 22.16 or later recommended) and npm.

```bash
npm install
npm run dev
```

Vite prints the local address (typically `http://localhost:5173`).

Production check:

```bash
npm run typecheck
npm run build
npm run preview
```

## Replace the sample image pair

Replace these two files, keeping the same aspect ratio/crop if possible:

- `public/images/sample-before.jpg`
- `public/images/sample-after.png`

They are currently illustrative landscape artwork and are **not actual enhancement results**. Before public launch, replace them with a genuine original and its actual processed output. If using raster images, update the paths in `src/App.tsx` and `src/scene/createStoryScene.ts` as required.

For a credible comparison, use the exact same photo, crop, orientation, and focal alignment in both assets. You can use different native resolutions, but make sure the displayed compositions line up.

## Connect your existing enhancement backend

This bundle is a frontend starter. It is not connected to the private backend behind your existing website because the API's real contract was not supplied.

1. Copy `.env.example` to `.env.local`.
2. Set `VITE_UPSCALER_ENDPOINT` to your endpoint.
3. Open `src/lib/upscaler.ts`.
4. Adjust the multipart field names, authentication/credentials, endpoint, job polling, and response parser to match your actual API. The current example assumes one request returns JSON with `outputUrl`, `result_url`, or `url`; it does not implement a queued-job lifecycle.
5. Ensure CORS, authentication, file limits, supported formats, and download permissions are configured safely in your backend.

Do not publish the example endpoint adapter unchanged unless it matches your API. The default state explains that processing needs a configured endpoint rather than pretending to enhance the image.

## Deploy

The project is Vite-based and can be deployed to Vercel, Netlify, or another static frontend host. Use the root directory, `npm run build` as the build command, and `dist` as the output directory. Configure `VITE_UPSCALER_ENDPOINT` as a public frontend endpoint only (never put secrets in `VITE_*` variables).

If the actual enhancement backend is a separate service, keep it deployed separately and configure its CORS/origin policy as needed.

## Production notes

- Verify current browser support and the actual device load before launch.
- Replace the demo sample image pair with a real processed pair.
- Add your real logo, privacy terms, file-retention policy, and supported-format limits.
- Measure Core Web Vitals on the deployed build; this repository does not claim that real-world performance metrics have been measured.
- Test upload, processing, output retrieval, and downloads using the actual backend contract.

## Reference study

- Hilo Studio, Tabasco case study: https://hilostudiolab.com/en/projects/tabasco
- GSAP ScrollTrigger docs: https://gsap.com/docs/v3/Plugins/ScrollTrigger/
- Three.js: https://threejs.org/
- Lenis: https://github.com/darkroomengineering/lenis
