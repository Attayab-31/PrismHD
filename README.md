# PrismHD — Immersive Image Upscaler

PrismHD is a cinematic, responsive image-enhancement experience built with React and TypeScript. Its editorial visual system, scroll-driven presentation, and focused Studio workspace are designed for a polished production website.

## What's included

- Warm editorial design system (porcelain, ink, cobalt, restrained coral).
- A custom Three.js framed-photo scene with real 3D frame rails, image planes, resolution tiles, pointer parallax, and scroll-driven source-to-enhanced reveal.
- GSAP ScrollTrigger choreography across the main pinned/sticky story.
- Lenis smooth scrolling on larger screens when reduced motion is not requested.
- Side-by-side comparison and a keyboard/touch-friendly drag-to-compare slider.
- Responsive layout and reduced-motion fallback.
- Image upload/drag-and-drop preview and enhancement settings.
- A resilient enhancement adapter that clearly reports when processing has not been connected without displaying false results.
- A matched image comparison for reviewing source and refined output in context.

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

## Image comparison assets

The comparison uses these production image files:

- `public/images/sample-before.jpg`
- `public/images/sample-after.png`

Keep the original and refined versions closely aligned in composition. For the strongest presentation, retain the same subject, crop, orientation, and focal point while only changing resolution and detail.

## Connect your existing enhancement backend

The frontend enhancement adapter is independent of the presentation layer. Connect an enhancement service whose request and response contract matches the implementation before enabling processing.

1. Copy `.env.example` to `.env.local`.
2. Set `VITE_UPSCALER_ENDPOINT` to your endpoint.
3. Open `src/lib/upscaler.ts`.
4. Adjust the multipart field names, authentication/credentials, endpoint, job polling, and response parser to match your actual API. The current example assumes one request returns JSON with `outputUrl`, `result_url`, or `url`; it does not implement a queued-job lifecycle.
5. Ensure CORS, authentication, file limits, supported formats, and download permissions are configured safely in your backend.

Configure the public endpoint only after verifying authentication, CORS, supported formats, file limits, output retention, and download behavior. The website never claims processing succeeded until a result is returned.

## Deploy

The project is Vite-based and can be deployed to Vercel, Netlify, or another static frontend host. Use the root directory, `npm run build` as the build command, and `dist` as the output directory. Configure `VITE_UPSCALER_ENDPOINT` as a public frontend endpoint only (never put secrets in `VITE_*` variables).

If the actual enhancement backend is a separate service, keep it deployed separately and configure its CORS/origin policy as needed.

## Production notes

- Verify current browser support and the actual device load before launch.
- Verify the published comparison against the original and final processed images.
- Add your real logo, privacy terms, file-retention policy, and supported-format limits.
- Measure Core Web Vitals on the deployed build; this repository does not claim that real-world performance metrics have been measured.
- Test upload, processing, output retrieval, and downloads using the actual backend contract.

## Reference study

- Hilo Studio, Tabasco case study: https://hilostudiolab.com/en/projects/tabasco
- GSAP ScrollTrigger docs: https://gsap.com/docs/v3/Plugins/ScrollTrigger/
- Three.js: https://threejs.org/
- Lenis: https://github.com/darkroomengineering/lenis
