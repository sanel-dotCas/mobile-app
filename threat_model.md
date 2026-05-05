# Threat Model

## Project Overview

This project is a pnpm monorepo with an Express 5 API (`artifacts/api-server`), a React/Vite admin panel (`artifacts/admin`), and an Expo mobile app (`artifacts/mobile`) for technicians, supervisors, parts staff, and admins. PostgreSQL stores yard, inspection, job, parts, and service-package data. Replit object storage is used for uploaded files.

Production security posture depends primarily on the API server because both clients are untrusted and can be modified by an attacker.

## Assets

- **Operational data** -- yard vehicles, locations, spots, inspections, transfers, movement history, jobs, technician assignments, and service packages. Unauthorized access or modification can disrupt dealership operations and falsify workflow state.
- **User and role data** -- yard users, roles, location assignment, and notification settings. Compromise enables impersonation or privilege escalation.
- **Uploaded objects** -- files stored through the object-storage upload flow. These may include inspection attachments or other internal artifacts and should not be exposed by default.
- **Mobile notification tokens** -- Expo push tokens tied to named users. Exposure or tampering can redirect or suppress notifications.
- **Application secrets and third-party credentials** -- database access, object storage credentials, Anthropic integration secrets, and mobile session secret.

## Trust Boundaries

- **Browser/mobile client to API server** -- every request is attacker-controlled until validated by the server.
- **API server to PostgreSQL** -- the API has broad authority over business data; route-level auth failures become full data compromise.
- **API server to object storage** -- uploaded files and private object fetches cross a separate storage boundary and require explicit access control.
- **API server to external AI services** -- parts AI endpoints send internal inventory data to Anthropic and must prevent abuse and unexpected data exposure.
- **Public vs authenticated vs admin surfaces** -- health checks and intentionally public download/share endpoints may be public, but operational and admin APIs must enforce identity and role checks server-side.
- **Production vs dev-only boundary** -- `artifacts/mockup-sandbox` is out of scope for production unless explicitly wired into deployed routes.

## Scan Anchors

- **Production entry points:** `artifacts/api-server/src/index.ts`, `artifacts/api-server/src/app.ts`, `artifacts/api-server/src/routes/index.ts`
- **Highest-risk code areas:** `artifacts/api-server/src/routes/admin.ts`, `artifacts/api-server/src/routes/yard-*.ts`, `artifacts/api-server/src/routes/parts.ts`, `artifacts/api-server/src/routes/jobs.ts`, `artifacts/api-server/src/routes/storage.ts`
- **Current auth code:** `artifacts/api-server/src/routes/yard-auth.ts`, `artifacts/admin/src/hooks/use-auth.tsx`, `artifacts/mobile/context/AuthContext.tsx`
- **Dev-only to usually ignore:** `artifacts/mockup-sandbox/**`

## Threat Categories

### Spoofing

This system supports multiple operator roles and mobile technician sessions, so attackers must not be able to impersonate other users or roles by editing local client state, headers, or request bodies. All privileged API actions must derive identity from server-verified credentials, and any mobile session token must be bound to a server-recognized user with a strong secret.

### Tampering

The API exposes numerous mutation routes for vehicles, inspections, jobs, parts, transfers, service packages, and admin-managed users. The server must ensure only authorized roles can change records, and it must not trust client-supplied actor, role, or workflow state values without validation.

### Information Disclosure

Operational data includes pricing, movement logs, technician assignments, user metadata, uploaded objects, and possibly internal credentials or notification tokens. Only intended public share endpoints may disclose data publicly; internal APIs and object-storage paths must not leak private files, internal users, or sensitive settings.

### Denial of Service

Publicly reachable endpoints that mint upload URLs, trigger external AI work, or create large records can be abused for storage, compute, and third-party API cost amplification. The system must constrain unauthenticated access, request size, and rate for high-cost operations.

### Elevation of Privilege

The highest-risk failure mode is client-side-only access control: role checks in the web or mobile UI do not protect the API. Admin, manager, supervisor, and technician capabilities must be enforced server-side on every route, and private object access must honor ACL checks before serving data.
