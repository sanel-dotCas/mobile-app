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
- **Login codes**: MR+1234/JW+1234=technician, SV+5678/AD+0000=supervisor, ET+1234/ET+5678=estimator, PT+1234/PD+1234=parts
- **Icons**: Uses Feather icon font from `assets/fonts/Feather.ttf` (family name: lowercase "feather")
- **Stack**: Expo Router, @expo/vector-icons v15, DMS Blue #1d4ed8

### 2. Yard Manager Web App (`artifacts/yard`)
- **Type**: React + Vite web app
- **Preview path**: `/yard/`
- **Port**: 21273
- **Purpose**: Vehicle Yard & Parking Management for IGMMA DMS
- **Login**: username `yard.manager` / password `yard123` OR `operator` / `op123`
- **Login**: `admin` / `admin` (admin/yard_manager roles); `operator` / `op123` (operator)
- **Pages**:
  - `/yard/login` — Login screen
  - `/yard/` — Operations Dashboard (stats, movement feed, **multi-branch vehicle search bar**)
  - `/yard/locations` — **Split-panel multi-yard view**: left panel = checkable location cards with capacity bars + ARRIVED/IN YARD/READY PDI/READY SALE stats; right panel = OVERVIEW tab (KPI cards + movement feed) + INSPECTIONS & CHECKS tab (PDI table + tech assignment)
  - `/yard/locations/:id` — Location detail with zone tabs + visual spot grid + spot detail panel
  - `/yard/inventory` — Vehicle inventory table with search, status filters, pagination, Add Vehicle modal, **Assign to Yard/Spot modal**
  - `/yard/inspections` — PDI inspections list with Create PDI modal (**technician assignment dropdown**)
  - `/yard/transfers` — **Transfer Requests** (yard → showroom): list, create modal, approve/transit/complete/cancel workflow
- **Auth**: Stored in localStorage key `yard_user`

### 3. API Server (`artifacts/api-server`)
- **Type**: Express 5 API
- **Preview path**: `/api`
- **Port**: 8080
- **Routes**: `/api/healthz`, `/api/estimates/analyze`, `/api/yard/auth/*`, `/api/yard/dashboard/*`, `/api/yard/locations/*`, `/api/yard/spots/*`, `/api/yard/vehicles/*`, `/api/yard/inspections/*`, `/api/yard/inspection-recommendations`, `/api/yard/permissions`
- **Yard auth note**: No session cookies — frontend sends `x-yard-user-id` header (or uses localStorage-based state). Login endpoint returns user object directly.

## Permissions System

Role-based access control is derived from user role (no separate DB table).

**Web Yard App roles:**
- `admin`: view_pricing, move_vehicles, create_inspections, manage_users, view_reports, configure_settings
- `yard_manager`: view_pricing, move_vehicles, create_inspections, view_reports
- `yard_operator`: move_vehicles, create_inspections only (NO pricing)

**Mobile DMS roles (for Yard tab):**
- `supervisor`: view_pricing, view_yard, create_inspections
- `technician`: view_yard, create_inspections only (NO pricing)
- `estimator`: view_yard only
- `parts`: parts inventory, orders, counts, suggestions (separate tab group)

Permissions utility: `useYardPermissions()` hook in `artifacts/yard/src/hooks/use-auth.tsx`
API endpoint: `GET /api/yard/permissions?role=yard_manager` or `?dmsRole=technician`

## Inspection Recommendation Engine

**Route**: `GET /api/yard/inspection-recommendations` (in `yard-recommendations.ts`)

Logic:
- Each vehicle has `inspectionIntervalDays` (default 30, stored in DB column)
- `nextDueDate = lastFinishedInspection.completedAt + intervalDays` (or `arrivedAt + intervalDays` if never inspected)
- `daysRemaining = nextDueDate - now`
- `urgency`: overdue (< 0 days), due-soon (0–7 days), ok (> 7 days)
- Returns `aiRecommendation` text describing urgency and action needed
- Summary: `{ overdue, dueSoon, ok, total }`

## Auto PDI on Sold

When PATCH `/api/yard/vehicles/:id` receives `{status: "sold"}`:
1. Auto-creates a `yard_inspection` record of type `final-quality`, status `queued`
2. Notes: "Auto-created: Final quality PDI for [vehicle] — marked sold by [actor]"
3. Records movement entry in `yard_movements`
4. Response includes `autoPdiInspection: { id, inspectionNumber }` or null

## Movement Recording

Recorded in `yard_movements` table for:
- Spot assignment/release (via `/api/yard/spots/:spotId` PATCH)
- Vehicle status changes (via `/api/yard/vehicles/:id` PATCH)
- Vehicle location transfers (via `/api/yard/vehicles/:id` PATCH)
- New vehicle arrivals (via POST `/api/yard/vehicles`)
- Auto-PDI creation events

## Parts Department Module

**Role**: `parts` — separate (parts) route group in Expo Router, purple accent (#7c3aed)
**Login**: PT+1234 or PD+1234

**5 Bottom Tabs:**
1. **Dashboard** — KPI cards (Total Parts, Low Stock, Out of Stock, Pending Orders), quick actions, alert banner for critical stock, recent orders preview
2. **Inventory** — Full parts catalog with search, filter chips (All/Low Stock/Out of Stock), category filter (Filters/Lubricants/Tyres/Batteries/Brakes/Electrical/Materials/Other). Scan button opens modal for part number lookup. Color-coded left-border cards (red=out, amber=low, green=ok). Tap → `parts/item.tsx` detail screen.
3. **Orders** — Incoming orders list with Pending / All tabs. Per-order: show line items, qty ordered/received/remaining. "Receive now" quantity controls per item. Submit receives → updates stock in DB, recalculates order status (ordered → partial → received).
4. **Count** — Cycle count sessions. Start a new count → scan/enter part numbers → enter counted qty (with +/- controls) → compare vs expected → Complete applies counted qtys to live inventory and records `lastCountedAt`.
5. **Suggestions** — Smart reorder analysis: critical (0 stock), urgent (<50% min), warning (below min), info (not counted in 30+ days). Sorted by priority. Summary cards filter the list.

**Detail screen** (`parts/item.tsx`): big qty display, stock level grid (on-hand/reserved/available/min/max/to-reorder), bin code display & edit, quantity adjustment, save changes.

**API routes** (`/api/parts/*`):
- `GET /parts/dashboard` — aggregated KPIs
- `GET /parts/items` — list with ?search=&category=&lowStock=&outOfStock=&limit=
- `GET /parts/items/by-number/:partNumber` — scan lookup by part number
- `GET/PATCH /parts/items/:id` — get/update individual item
- `POST /parts/items` — create item
- `GET/POST /parts/orders` — list/create orders
- `GET /parts/orders/:id` — get order with line items
- `PATCH /parts/orders/:id` — update status/notes
- `POST /parts/orders/:id/receive` — receive items → updates qtyOnHand in parts_items
- `GET/POST /parts/count-sessions` — list/start count sessions
- `GET /parts/count-sessions/:id` — get session with items
- `POST /parts/count-sessions/:id/items` — add/update counted item
- `PATCH /parts/count-sessions/:id/complete` — complete count, apply to inventory
- `GET /parts/suggestions` — smart reorder suggestions

**DB Tables**: `parts_items`, `parts_orders`, `parts_order_items`, `parts_count_sessions`, `parts_count_items`

**Seed data**: 36 realistic parts across 8 categories (Filters, Lubricants, Tyres, Batteries, Brakes, Electrical, Materials), 3 seeded orders (PO-2026-001 ordered, PO-2026-002 partial, PO-2026-003 received)

## Technician PDI Assignment & Notifications

**DB**: `yard_inspections` now has `assigned_to` text (DMS user code e.g. "MR") and `assigned_at` timestamp.

**API**: `PATCH /api/yard/inspections/:id` accepts `{assignedTo: "MR"}` to assign a tech. `GET /api/yard/inspections?assignedTo=MR&status=queued` filters by assigned tech.

**Supervisor UI** (`app/(supervisor)/yard.tsx`):
- Inspections list shows "Unassigned" badge on queued PDIs with no tech
- Blue left-border accent on unassigned inspection cards
- "Unassigned PDIs" count banner when on Inspections tab
- Tap any inspection → Inspection detail has "Assign Tech" button → bottom-sheet modal lists technicians

**Inspection Detail** (`app/yard/inspection.tsx`):
- Shows "Assigned Technician" card with avatar, name, assigned date
- Supervisors see "Assign Tech" / "Reassign Tech" / "Remove" buttons (not shown for finished inspections)
- Completed inspections show a green "Inspection Complete" summary card with completion date
- Loads single inspection via `GET /api/yard/inspections/:id` (not batch fetch)
- Timeline card includes "Assigned" date row when `assignedAt` is set

**In-app Notification System** (`_layout.tsx` + `JobsContext.tsx`):
- `YardPDIChecker` component polls every 60 seconds for `assignedTo={userCode}&status=queued` inspections
- New assignments are de-duplicated via AsyncStorage (`yard_pdi_notified_ids`)
- New assignments → `ADD_YARD_NOTIFICATION` action → appears in bell notification center
- Bell notifications show "New PDI Assignment: You've been assigned to inspect [Vehicle] — PDI #XXXXX"

**Expo Push Notification System** (`artifacts/mobile/components/NotificationSetup.tsx`):
- `NotificationSetup` component registers for push permissions on login (technician role, native only)
- Gets Expo push token and registers it to DB via `POST /api/yard/auth/push-token` (by technician name)
- Token stored in `yard_users.expo_push_token`; preference in `yard_users.notifications_enabled`
- Notification tap handler routes to `/yard/inspection?id=<inspectionId>`
- Push notifications fire from API on all 4 assignment paths: single create, batch generate, auto-assign, and manual PATCH
- API utility: `artifacts/api-server/src/lib/pushNotifications.ts` — calls Expo push API
- All notification calls are fire-and-forget (non-blocking, won't fail inspection routes)

**Push Notification API Endpoints** (`artifacts/api-server/src/routes/yard-auth.ts`):
- `POST /api/yard/auth/push-token` — registers Expo push token by `userId` or `technicianName`
- `PATCH /api/yard/auth/notifications-enabled` — toggles push preference by `userId` or `technicianName`

**Notification preference toggle** (`artifacts/mobile/components/ProfileScreen.tsx`):
- Settings tab now shows a real `Switch` component for push notifications (was "Coming soon")
- Web platform: toggle is disabled with label explaining push requires native app
- Toggle persists to AsyncStorage locally AND syncs to DB via API

## Database Schema (lib/db/src/schema/yard.ts)

Key tables: `yard_users`, `yard_locations`, `yard_zones`, `yard_spots`, `yard_vehicles`, `yard_inspections`, `yard_movements`

`yard_vehicles` has `inspection_interval_days` integer column (default 30).
`yard_inspections` has `assigned_to` text and `assigned_at` timestamp columns.
`yard_users` has `expo_push_token` text and `notifications_enabled` boolean (default true) columns.

Seed data: 8 locations, 12 vehicles, 6 inspections, 10 movement entries, ~55 spots across 7 zones.

## OpenAPI / Codegen

- Spec: `lib/api-spec/openapi.yaml`
- Generated hooks: `lib/api-client-react/src/generated/api.ts`
- Generated Zod schemas: `lib/api-zod/src/generated/api.ts`
- Barrel: `lib/api-zod/src/index.ts` — MUST be kept as single line: `export * from "./generated/api";`

## DMS Submission Retention

`estimate_submissions` records are deleted automatically on a 24-hour schedule by a background job that starts when the API server boots (`artifacts/api-server/src/lib/submissionCleanup.ts`).

**Environment variable**: `SUBMISSION_RETENTION_DAYS` (integer, default `90`)
- Records older than this many days are permanently deleted.
- This also defines the **idempotency window**: duplicate DMS submissions for the same `estimateId` are detected and return the existing RO number only while the original row is still within the retention window. After `SUBMISSION_RETENTION_DAYS` days have elapsed, a re-submission will generate a new RO number.
- Set `SUBMISSION_RETENTION_DAYS=180` (for example) to extend both the storage period and the duplicate-protection window.

## Notes

- Do NOT run `pnpm dev` at workspace root — run workflows individually
- After codegen, always fix `lib/api-zod/src/index.ts` to single export
- Yard app Vite config has no proxy — relies on shared Replit proxy routing `/api` → API server
- The mobile app uses expo-domain router; the yard app uses path-based routing at `/yard/`
