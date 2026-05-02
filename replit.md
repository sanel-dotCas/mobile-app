# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec in `lib/api-spec/openapi.yaml`)
- **Build**: esbuild (CJS bundle)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec (IMPORTANT: after running codegen, rewrite `lib/api-zod/src/index.ts` to only contain `export * from "./generated/api";` — codegen generates both exports causing TS2308 duplicate export errors)
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

## Artifacts

### 1. Technician Jobs Mobile App (`artifacts/mobile`)
- **Type**: Expo / React Native (Expo Router v6, SDK 54)
- **Preview path**: `/` (expo-domain router)
- **Port**: 18115
- **Purpose**: IGMMA DMS mobile app for technicians, supervisors, estimators
- **Login codes**: MR+1234/JW+1234=technician, SV+5678/AD+0000=supervisor, ET+1234/ET+5678=estimator
- **Icons**: Uses Feather icon font from `assets/fonts/Feather.ttf` (family name: lowercase "feather")
- **Stack**: Expo Router, @expo/vector-icons v15, DMS Blue #1d4ed8

### 2. Yard Manager Web App (`artifacts/yard`)
- **Type**: React + Vite web app
- **Preview path**: `/yard/`
- **Port**: 21273
- **Purpose**: Vehicle Yard & Parking Management for IGMMA DMS
- **Login**: username `yard.manager` / password `yard123` OR `operator` / `op123`
- **Pages**:
  - `/yard/login` — Login screen
  - `/yard/` — Operations Dashboard (stats, movement feed)
  - `/yard/locations` — All locations list with capacity bars
  - `/yard/locations/:id` — Location detail with zone tabs + visual spot grid + spot detail panel
  - `/yard/inventory` — Vehicle inventory table with search, status filters, pagination, Add Vehicle modal
  - `/yard/inspections` — PDI inspections list with Create PDI modal
- **Auth**: Stored in localStorage key `yard_user`

### 3. API Server (`artifacts/api-server`)
- **Type**: Express 5 API
- **Preview path**: `/api`
- **Port**: 8080
- **Routes**: `/api/healthz`, `/api/estimates/analyze`, `/api/yard/auth/*`, `/api/yard/dashboard/*`, `/api/yard/locations/*`, `/api/yard/spots/*`, `/api/yard/vehicles/*`, `/api/yard/inspections/*`
- **Yard auth note**: No session cookies — frontend sends `x-yard-user-id` header (or uses localStorage-based state). Login endpoint returns user object directly.

## Database Schema (lib/db/src/schema/yard.ts)

Key tables: `yard_users`, `yard_locations`, `yard_zones`, `yard_spots`, `yard_vehicles`, `yard_inspections`, `yard_movements`

Seed data: 8 locations (Al Khor, Sana Signal SWR, Mawater Showroom, Education City, Beni Hal, North Annex, Service Center, Offsite Storage), 12 vehicles, 6 inspections, 10 movement entries, ~55 spots across 7 zones.

## OpenAPI / Codegen

- Spec: `lib/api-spec/openapi.yaml`
- Generated hooks: `lib/api-client-react/src/generated/api.ts`
- Generated Zod schemas: `lib/api-zod/src/generated/api.ts`
- Barrel: `lib/api-zod/src/index.ts` — MUST be kept as single line: `export * from "./generated/api";`

## Notes

- Do NOT run `pnpm dev` at workspace root — run workflows individually
- After codegen, always fix `lib/api-zod/src/index.ts` to single export
- Yard app Vite config has no proxy — relies on shared Replit proxy routing `/api` → API server
- The mobile app uses expo-domain router; the yard app uses path-based routing at `/yard/`
