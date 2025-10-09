# Tech Context

## Primary Stack
- **Frontend:** Next.js 15 (App Router) + React 19 + TypeScript, styled with handcrafted CSS for now (Tailwind/shadcn still optional future add-ons).
- **Backend Worker:** Node.js service run with `tsx`, using `youtubei.js` for Innertube chat ingestion, `fastify` + `@fastify/cors` for REST/SSE transport, and `eventemitter3` for internal pub/sub.
- **Shared Types:** Simple TypeScript module in `shared/chat.ts`, imported via the `@shared/*` path alias defined in `tsconfig.base.json`.
- **Realtime:** Server-Sent Events for overlay updates; intelligent polling with auto-refresh for Direction Studio; WebSockets remain a future enhancement option.
- **Search Engine:** Custom backend filtering with regex support (!), debounced frontend search, and request abort control.

## Tooling & Commands
- Single root `package.json`; `pnpm install` manages all deps.
- `pnpm dev` runs backend (`tsx backend/src/index.ts`) and client (`next dev client`) concurrently via `concurrently`.
- `pnpm build` compiles the backend with `tsc` and builds the Next app; `pnpm start:backend` / `pnpm start:client` serve production bundles separately.
- **Development Pages**: `/dashboard` for live chat monitoring, `/direction` for advanced search and filtering, `/overlay` for OBS integration.

## Environment & Dependencies
- Requires `YOUTUBE_LIVE_ID` (or full URL) to enable real chat ingestion; omitted value triggers mock mode.
- Optional overrides for Innertube API keys/version can be supplied through env vars when needed.
- `better-sqlite3` is included for future persistence work but not yet wired in.
- Environment files: `.env.example` documents required keys, `.env.local` powers local development, and `.env.production` should be filled with deployment values. Core variables today are `PORT`, `YOUTUBE_LIVE_ID`, and `NEXT_PUBLIC_BACKEND_URL`.

## Constraints & Considerations
- Innertube endpoints may break; keep ingestion module adaptable and plan for a headless-browser fallback.
- Project expected to run on the streamer’s machine; dependencies must remain cross-platform and avoid heavyweight native builds where possible.
- No separate package boundaries anymore, so TypeScript path aliases and import hygiene are important to prevent tangled relative paths.
