# MicMix website

Marketing site for MicMix. Single page: hero with a live CSS mockup of the app, integration logos, features, a four-step guide, FAQ, download call to action and footer.

## Stack

| Package | Why |
| --- | --- |
| Vite 8 + React 19 + TypeScript | Same UI stack as the desktop app, instant dev server, static output. |
| Tailwind CSS v4 (`@tailwindcss/vite`) | Utility styling; theme tokens live in `src/index.css` under `@theme`. |
| `motion` (Framer Motion successor) | Header pill that slides between links, scroll-aware glass header, mobile drawer, hero stagger, mockup fader animation. |
| `lucide-react` | UI icons. |
| `simple-icons` | Brand marks for Discord, FiveM and OBS. Microsoft Teams is drawn by hand because Microsoft brands were removed from that set. |
| `@fontsource-variable/inter` | Inter is bundled locally, so the site makes no third-party font requests. |

## Run

```bash
cd site
npm install
npm run dev      # http://localhost:5173
npm run build    # type-check + static output in site/dist
npm run preview  # serve the built output
```

## Before publishing

1. On GitHub Pages nothing needs changing: URL, download link and version are injected by the deploy workflow. For another host, set `SITE_URL` when building or edit `siteUrl` in `src/site-config.ts`.
2. The footer Privacy and Terms links are placeholders (`#privacy`, `#terms`). Add pages or remove them.

## Deploy

Pushing to `main` runs `.github/workflows/site.yml`, which builds this folder and publishes it to GitHub Pages. The workflow injects the Pages URL (`SITE_URL`), base path (`VITE_BASE`), the latest-release download link (`VITE_DOWNLOAD_URL`) and the app version from the root `package.json`, so nothing here needs editing per release.

To host elsewhere, `site/dist` is plain static files: build with `npm run build` and set `SITE_URL` to the public origin.

## Brand assets

`public/brand/` holds the MicMix brand package files the site uses: `micmix-mark.svg` (header, mockup, SVG favicon), `favicon.ico`, `apple-touch-icon.png`, `icon-192.png` / `icon-512.png` with `site.webmanifest`, and `og-image.png` (1200x630) for Open Graph and Twitter previews. `micmix-logo-horizontal.svg` and `micmix-primary-512.png` are there for future use. The Tailwind palette in `src/index.css` follows the brand guide (`#071126`, `#00E5FF`, `#1478FF`, `#A855FF`, `#FF2BD6`).
