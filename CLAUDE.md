# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository state

From `README.md`:
- Project name: `carassignment`
- Description (Japanese): 選手車の割り当てツール — a tool for assigning cars to athletes/players.

## Tech stack

- React 18 (function components, TypeScript / `.tsx`)
- Tailwind CSS v4 (via `@tailwindcss/vite`; directives live in `src/index.css`)
- Vite 5 (build tool / dev server)

## Commands

- `npm run dev` — start the Vite dev server
- `npm run build` — typecheck (`tsc --noEmit`) then production build
- `npm run typecheck` — typecheck only
- `npm run preview` — preview the production build

There is no lint or test setup yet.

## Architecture

- `index.html` / `src/main.tsx` / `src/App.tsx` — the car-assignment app (single-file `App.tsx` holding state, the `assignCars` allocation logic, and all three tabs: member setup, car/driver setup, result).
- `river-camera.html` — a separate static (non-React) page, built as its own Vite entry (see `vite.config.ts`).
- `.claude/agents/ui-icon-generator.md` — a subagent dedicated to generating new UI components (React/TSX + Tailwind) and icons (inline SVG).
