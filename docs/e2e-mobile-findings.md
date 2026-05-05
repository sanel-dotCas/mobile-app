# IGMMA DMS Mobile App — E2E Test Findings

**Date:** 2026-05-05  
**Scope:** Mobile Expo app only (not admin/yard web panels)  
**Roles tested:** Technician, Supervisor, Parts, Admin

---

## Summary

| Category | Result |
|----------|--------|
| API role-flow checks | **46 / 46 pass** (see `scripts/src/e2e-mobile-roles.ts`) |
| Bugs found | 2 |
| Bugs fixed | 2 |
| Bugs deferred | 1 (minor, noted below) |

---

## Bugs Fixed

### BUG-01 — Admin Settings Screen Crash (Critical)

**Symptom:** Navigating to the admin Settings screen caused an immediate crash.  
**Root cause:** `GET /api/admin/settings` did not return `mobileCredentials` in its
response. The mobile screen called `.map()` on the missing field (undefined), throwing
`TypeError: Cannot read properties of undefined`.  
**Fix:** Added a DB query in the `/admin/settings` route handler to fetch all users
that have a `userCode` and `mobileRole` set, and included them as `mobileCredentials`
in the response payload.  
**File:** `artifacts/api-server/src/routes/admin.ts`  
**Verification:** `GET /api/admin/settings` with admin token returns 200 with
`mobileCredentials` array (13 entries in test environment).

---

### BUG-02 — Parts/Supervisor Role Blocked from Service Packages (403)

**Symptom:** The Parts dashboard and Supervisor view return 403 when fetching
`GET /api/service-packages`, preventing the service package list from loading.  
**Root cause:** `servicePackagesRouter` was registered inside `adminScopedRouter`
which applies `requireAdminRole` to all traffic — blocking Parts and Supervisor
mobile roles.  
**Fix:** Moved `servicePackagesRouter` out of `adminScopedRouter`. Applied
per-method RBAC in `routes/index.ts`:

| Method | Who can access |
|--------|---------------|
| GET / HEAD | parts, supervisor, admin mobile roles; any yard principal |
| POST (upload) | admin role only (yard admin or mobile admin) |

**File:** `artifacts/api-server/src/routes/index.ts`  
**Verification:** Parts token → `GET /service-packages` → 200 (6 packages); Parts
token → `POST /service-packages/upload` → 403.

---

## Test Data Seeded

All data is deterministically seeded by `scripts/src/seed-jobs.ts` (idempotent —
safe to re-run). Data is also present via the API upsert path (`PUT /api/jobs/:id`).

| Entity | Count | Statuses |
|--------|-------|----------|
| Jobs | 6 | pending, in_progress ×3, completed, on_hold |
| Technicians | 5 | — |
| Yard inspections assigned | 19 of 24 | — |
| Mobile credentials | 13 | admin, supervisor, parts, technician roles |
| Service packages | 6 | — |

Jobs seeded:
- `job-001` — 1995 BMW 325 (in_progress, tech-001/Mike Rodriguez, 8 inspection items)
- `job-002` — 2019 Toyota Camry (pending, tech-004/Ahmed Hassan, 1 inspection item)
- `job-003` — 2021 Honda Accord (completed, tech-001, 1 inspection item)
- `job-004` — 2022 Ford F-150 (in_progress, unassigned, 6 inspection items)
- `job-005` — 2023 Tesla Model 3 (in_progress, tech-002/James Wilson)
- `job-006` — 2020 Mazda 6 (on_hold, tech-003/Carlos Mendez, 3 inspection items)

---

## Role-Flow Verification Results

Run via: `pnpm --filter @workspace/scripts run e2e-mobile-roles`

### Technician (MR / 1234)

| Check | Result |
|-------|--------|
| Login | ✅ |
| GET /jobs (includes pending, in_progress, completed) | ✅ |
| GET /jobs/job-001 (in_progress) | ✅ |
| GET /jobs/job-002 (pending) | ✅ |
| GET /jobs/job-003 (completed) | ✅ |
| PATCH /jobs/job-001 (status update) | ✅ |
| GET /technicians | ✅ |
| GET /technicians/me/stats | ✅ |
| PATCH /technicians/tech-001 (active/idle/break/absent) | ✅ |
| POST /yard/auth/push-token (device registration) | ✅ |
| PATCH /jobs/:id/inspections/:inspId (pass + notes) | ✅ |
| Clock-in state persists in DB after re-fetch | ✅ |
| Elapsed seconds persist in DB | ✅ |
| Blocked from /service-packages (403) | ✅ |
| Blocked from /admin/settings (403) | ✅ |

### Supervisor (SV / 5678)

| Check | Result |
|-------|--------|
| Login | ✅ |
| GET /technicians (floor view) | ✅ |
| GET /jobs | ✅ |
| GET /service-packages (read allowed) | ✅ |
| PATCH /technicians/tech-002 (break) | ✅ |
| Blocked from /admin/settings (403) | ✅ |

### Parts (PT / 1234)

| Check | Result |
|-------|--------|
| Login | ✅ |
| GET /parts/dashboard | ✅ |
| GET /jobs | ✅ |
| GET /service-packages (fixed — was 403) | ✅ |
| Service packages list has ≥1 package | ✅ |
| Blocked from service-packages upload (403) | ✅ |
| Blocked from /admin/settings (403) | ✅ |

### Admin (AM / 0000)

| Check | Result |
|-------|--------|
| Login | ✅ |
| GET /admin/stats | ✅ |
| GET /admin/settings (with mobileCredentials) | ✅ |
| GET /admin/technicians | ✅ |
| GET /admin/users | ✅ |
| GET /admin/locations | ✅ |
| GET /service-packages | ✅ |

---

## Resilience Checks

### Clock-in State Persistence

The clock-in timer state (clockedIn, clockInStart, elapsedSeconds) is stored in the
API database via `PATCH /api/jobs/:id`. On app restart (native) or page reload (web):

1. `JobsContext` reads cached jobs from AsyncStorage (`jobs_v2`) on mount.
2. If a task has `clockedIn=true`, it dispatches `RESTORE_CLOCK_IN` with the saved
   `clockInStart` and `clockInBaseElapsed`, resuming the timer from where it stopped.
3. The API also returns the current `elapsedSeconds` on the next fresh fetch.

**API verification:** PATCH with `clockedIn=true, elapsedSeconds=3600` → re-fetch →
both fields present and correct. ✅

### Offline Banner

The `OfflineBanner` component in `artifacts/mobile/components/OfflineBanner.tsx`
listens to `state.isOffline` from `JobsContext`. Offline state is detected via
`@react-native-community/netinfo` (NetInfo.addEventListener). When offline, the banner
renders at the top of the screen; when back online, pending queues (notes, odometer,
inspections) are flushed via dedicated `useEffect` hooks in `JobsContext`.

### App UI — Login Screen

Confirmed rendering correctly via screenshot. The login screen shows:
- IGMMA branding with car hero image
- 2-step custom keyboard: A–Z letter grid → 4-digit numpad
- Step indicators for "2-Letter Code" and "4-Digit PIN"

### App UI — Jobs Screen (Technician)

Confirmed rendering correctly via screenshot (after auth injection):
- Jobs tab selected with "MR" avatar
- Search bar and filter chips (All, Active, Pending, Completed) visible
- Bottom tab bar: Dashboard, Jobs, Time Record, Yard, Profile

### App UI — Supervisor Dashboard

Confirmed rendering correctly via Playwright test. The supervisor floor view loads
and displays the live supervision dashboard without errors.

---

## Known Limitations / Deferred Items

### DEFERRED-01 — Jobs List Race on First Load (Web Only, Minor)

On Expo web, when the page is reloaded after auth injection (Playwright test
environment), `JobsContext` may fire the initial `GET /jobs` fetch before
`AuthContext` has restored the session token from AsyncStorage, resulting in a
401 and the list staying on "Loading jobs..." until the user pulls to refresh.

**Impact:** Expo web browser reload only. On native iOS/Android, the login flow
sets the token synchronously before navigating to the jobs tab — no race.

**Mitigation:** Jobs are also cached in AsyncStorage (`jobs_v2`); cached data
loads immediately and the clock-in state is restored from cache even if the API
refetch fails.

**Recommended fix:** Make `JobsContext` wait for `isAuthenticated === true` from
`AuthContext` before issuing the initial fetch. See follow-up task #105.

---

## How to Re-run Tests

```bash
# 1. Seed test data (idempotent)
pnpm --filter @workspace/scripts run seed-jobs

# 2. Run E2E role-flow checks (requires API server running)
pnpm --filter @workspace/scripts run e2e-mobile-roles
```

Expected output: `RESULT: 46 passed, 0 failed`
