# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Vite + React multi-page app. Each page is a separate HTML entry registered in `vite.config.js` (`build.rollupOptions.input`):

- `index.html` → `src/main.jsx` / `src/App.jsx` — 選手車の割り当てツール (car assignment for players; JSX)
- `river-camera.html`, `hamasta-night-watch.html` — standalone pages with inline scripts
- `onsen.html` → `src/onsen/` — 湯めぐりマップ (hot spring map; TypeScript + Tailwind CSS v4 + react-leaflet)
  - Components: `src/onsen/components/` (Header, MapView, HotSpringList, DetailModal)
  - Mock data: `src/data/hotsprings.ts` (lat/lng, 泉質, 源泉温度, 効能, アクセス)
  - Tailwind is loaded via `@tailwindcss/vite` and imported only from `src/onsen/index.css`, so other pages are unaffected.

## Commands

- `npm run dev` — dev server (hot spring map at `/onsen.html`)
- `npm run typecheck` — `tsc` over `src/**/*.ts(x)`
- `npm run build` — typecheck + production build to `dist/`

There is no lint or test setup.
