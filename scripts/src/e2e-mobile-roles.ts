/**
 * E2E role-flow verification for the IGMMA DMS mobile app.
 *
 * Exercises all four mobile roles (Technician, Supervisor, Parts, Admin)
 * against the live API server. Run this after seeding test data to confirm
 * the app is 100% functional for every role.
 *
 * Usage:
 *   pnpm --filter @workspace/scripts run e2e-mobile-roles
 *
 * Expected environment: API server reachable at http://localhost:80
 * (or set API_BASE env var to override)
 */

const BASE = process.env.API_BASE ?? "http://localhost:80/api";

type HttpMethod = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";

interface TestResult {
  label: string;
  pass: boolean;
  actual: number;
  expected: number;
  detail?: string;
}

const results: TestResult[] = [];

async function req(
  method: HttpMethod,
  path: string,
  token: string | null,
  body?: unknown
): Promise<{ status: number; json: unknown }> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const r = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  let json: unknown = null;
  try { json = await r.json(); } catch { /**/ }
  return { status: r.status, json };
}

function check(
  label: string,
  actual: number,
  expected: number,
  detail?: string
): void {
  const pass = actual === expected;
  results.push({ label, pass, actual, expected, detail });
  const icon = pass ? "✅" : "❌";
  const suffix = pass ? "" : ` — got ${actual}, want ${expected}${detail ? ` (${detail})` : ""}`;
  console.log(`  ${icon} ${label}${suffix}`);
}

async function login(code: string, pin: string): Promise<string> {
  const { status, json } = await req("POST", "/yard/auth/mobile-session", null, { code, pin });
  if (status !== 200 || typeof (json as Record<string, unknown>).sessionToken !== "string") {
    throw new Error(`Login failed for ${code}/${pin}: HTTP ${status}`);
  }
  return (json as Record<string, unknown>).sessionToken as string;
}

async function main(): Promise<void> {
  console.log("\n╔═══════════════════════════════════════════════════╗");
  console.log("║  IGMMA DMS — MOBILE APP E2E ROLE VERIFICATION    ║");
  console.log("╚═══════════════════════════════════════════════════╝\n");

  // ── 1. Login all four roles ─────────────────────────────────────────────────
  console.log("── AUTH / LOGIN ──");
  let techToken: string, supToken: string, partsToken: string, adminToken: string;
  try {
    techToken  = await login("MR", "1234");  check("Technician login (MR/1234)", 200, 200);
    supToken   = await login("SV", "5678");  check("Supervisor login (SV/5678)", 200, 200);
    partsToken = await login("PT", "1234");  check("Parts login (PT/1234)", 200, 200);
    adminToken = await login("AM", "0000");  check("Admin login (AM/0000)", 200, 200);
  } catch (err) {
    console.error("FATAL: login failure —", err);
    process.exit(1);
    return;
  }

  const { status: badLogin } = await req("POST", "/yard/auth/mobile-session", null, { code: "XX", pin: "9999" });
  check("Invalid credentials rejected", badLogin, 401);

  // ── 2. Technician flows ─────────────────────────────────────────────────────
  console.log("\n── TECHNICIAN ROLE ──");
  const { status: jobsStatus, json: jobsJson } = await req("GET", "/jobs", techToken);
  check("GET /jobs", jobsStatus, 200);
  const allJobs = (jobsJson as Record<string, unknown>).jobs as Array<Record<string, unknown>>;
  const statuses = new Set(allJobs?.map((j) => j.status as string) ?? []);
  check("Jobs list includes pending status",  statuses.has("pending")     ? 200 : 400, 200, "need pending job");
  check("Jobs list includes in_progress status", statuses.has("in_progress") ? 200 : 400, 200, "need in_progress job");
  check("Jobs list includes completed status",   statuses.has("completed")   ? 200 : 400, 200, "need completed job");
  check("Jobs list has at least 3 jobs",         (allJobs?.length ?? 0) >= 3 ? 200 : 400, 200, `got ${allJobs?.length ?? 0}`);

  const { status: job1 } = await req("GET", "/jobs/job-001", techToken);
  check("GET /jobs/job-001 (in_progress)", job1, 200);
  const { status: job2 } = await req("GET", "/jobs/job-002", techToken);
  check("GET /jobs/job-002 (pending)", job2, 200);
  const { status: job3 } = await req("GET", "/jobs/job-003", techToken);
  check("GET /jobs/job-003 (completed)", job3, 200);

  const { status: patchJob } = await req("PATCH", "/jobs/job-001", techToken, { status: "in_progress" });
  check("PATCH /jobs/job-001 (status update)", patchJob, 200);

  const { status: techs } = await req("GET", "/technicians", techToken);
  check("GET /technicians", techs, 200);
  const { status: stats } = await req("GET", "/technicians/me/stats", techToken);
  check("GET /technicians/me/stats", stats, 200);

  const { status: patchActive } = await req("PATCH", "/technicians/tech-001", techToken, { status: "active" });
  check("PATCH /technicians/tech-001 (active)", patchActive, 200);
  const { status: patchIdle } = await req("PATCH", "/technicians/tech-001", techToken, { status: "idle" });
  check("PATCH /technicians/tech-001 (idle)", patchIdle, 200);
  const { status: patchBreak } = await req("PATCH", "/technicians/tech-001", techToken, { status: "break" });
  check("PATCH /technicians/tech-001 (break)", patchBreak, 200);
  const { status: patchAbsent } = await req("PATCH", "/technicians/tech-001", techToken, { status: "absent" });
  check("PATCH /technicians/tech-001 (absent)", patchAbsent, 200);

  const { status: pushTok } = await req("POST", "/yard/auth/push-token", techToken, {
    token: "ExponentPushToken[e2e-test-123]",
  });
  check("POST /yard/auth/push-token (register device)", pushTok, 200);

  const { status: techSvcPkg } = await req("GET", "/service-packages", techToken);
  check("Technician BLOCKED from /service-packages (403)", techSvcPkg, 403);
  const { status: techAdmin } = await req("GET", "/admin/settings", techToken);
  check("Technician BLOCKED from /admin/settings (403)", techAdmin, 403);

  // ── 3. Inspection update flow ────────────────────────────────────────────────
  console.log("\n── INSPECTION UPDATE (TECHNICIAN) ──");
  const { json: job1Details } = await req("GET", "/jobs/job-001", techToken);
  const job1Obj = (job1Details as Record<string, unknown>)?.job as Record<string, unknown> | undefined;
  const inspections = (job1Obj?.inspections as Array<Record<string, unknown>> | undefined) ?? [];
  const firstInspId = inspections[0]?.id as string | undefined;
  if (firstInspId) {
    const { status: inspUpdate } = await req("PATCH", `/jobs/job-001/inspections/${firstInspId}`, techToken, {
      status: "pass",
      notes: "Verified OK during E2E test run",
    });
    check("PATCH /jobs/:id/inspections/:inspId (pass)", inspUpdate, 200);
  } else {
    check("PATCH /jobs/:id/inspections/:inspId (pass)", 400, 200, "no inspection found on job-001");
  }

  // ── 4. Clock-in state persistence ───────────────────────────────────────────
  console.log("\n── CLOCK-IN STATE PERSISTENCE ──");
  const clockInTime = new Date(Date.now() - 3600_000).toISOString();
  const { status: clockInPatch, json: clockInResult } = await req("PATCH", "/jobs/job-001", techToken, {
    tasks: [
      {
        id: "task-001", type: "Repair", title: "Oil Change",
        description: "Full synthetic oil change", laborType: "MECHANICAL",
        technician: "Mike Rodriguez", status: "in_progress",
        clockedIn: true, clockInStart: clockInTime, clockInBaseElapsed: 3600,
        elapsedSeconds: 3600, workedHours: 1.0, estimatedHours: 2.0,
        notes: [], parts: [],
      },
    ],
  });
  check("PATCH /jobs/job-001 with clockedIn=true", clockInPatch, 200);

  const { status: refetchStatus, json: refetchJson } = await req("GET", "/jobs/job-001", techToken);
  check("Re-fetch job after clock-in patch", refetchStatus, 200);
  const refetchedTask = ((refetchJson as Record<string, unknown>)
    ?.job as Record<string, unknown>)
    ?.tasks as Array<Record<string, unknown>>;
  const taskClockedIn = refetchedTask?.[0]?.clockedIn === true;
  check("Clock-in state persists in DB (clockedIn=true)", taskClockedIn ? 200 : 400, 200, "clockedIn must survive re-fetch");
  const taskElapsed = (refetchedTask?.[0]?.elapsedSeconds as number) >= 3600;
  check("Elapsed seconds persist in DB (≥3600)", taskElapsed ? 200 : 400, 200, `got ${refetchedTask?.[0]?.elapsedSeconds}`);

  // Reset clock-in state
  await req("PATCH", "/jobs/job-001", techToken, {
    tasks: [
      {
        id: "task-001", type: "Repair", title: "Oil Change",
        description: "Full synthetic oil change", laborType: "MECHANICAL",
        technician: "Mike Rodriguez", status: "in_progress",
        clockedIn: false, clockInStart: null, clockInBaseElapsed: 3600,
        elapsedSeconds: 3600, workedHours: 1.0, estimatedHours: 2.0,
        notes: [], parts: [],
      },
    ],
  });

  // ── 5. Supervisor flows ──────────────────────────────────────────────────────
  console.log("\n── SUPERVISOR ROLE ──");
  const { status: supTechs } = await req("GET", "/technicians", supToken);
  check("GET /technicians (floor view data)", supTechs, 200);
  const { status: supJobs } = await req("GET", "/jobs", supToken);
  check("GET /jobs", supJobs, 200);
  const { status: supSvcPkg } = await req("GET", "/service-packages", supToken);
  check("GET /service-packages (read allowed)", supSvcPkg, 200);
  const { status: supPatchTech } = await req("PATCH", "/technicians/tech-002", supToken, { status: "break" });
  check("PATCH /technicians/tech-002 (break)", supPatchTech, 200);
  const { status: supAdmin } = await req("GET", "/admin/settings", supToken);
  check("Supervisor BLOCKED from /admin/settings (403)", supAdmin, 403);

  // ── 6. Parts flows ───────────────────────────────────────────────────────────
  console.log("\n── PARTS ROLE ──");
  const { status: partsDash } = await req("GET", "/parts/dashboard", partsToken);
  check("GET /parts/dashboard", partsDash, 200);
  const { status: partsJobs } = await req("GET", "/jobs", partsToken);
  check("GET /jobs", partsJobs, 200);
  const { status: partsSvcPkg, json: svcPkgJson } = await req("GET", "/service-packages", partsToken);
  check("GET /service-packages (RBAC fixed — parts can read)", partsSvcPkg, 200);
  const pkgCount = ((svcPkgJson as Record<string, unknown>)?.packages as unknown[])?.length ?? 0;
  check("Service packages list has ≥1 package", pkgCount >= 1 ? 200 : 400, 200, `got ${pkgCount}`);
  const { status: partsUpload } = await req("POST", "/service-packages/upload", partsToken, {});
  check("Parts BLOCKED from service-packages upload (403)", partsUpload, 403);
  const { status: partsAdmin } = await req("GET", "/admin/settings", partsToken);
  check("Parts BLOCKED from /admin/settings (403)", partsAdmin, 403);

  // ── 7. Admin flows ───────────────────────────────────────────────────────────
  console.log("\n── ADMIN ROLE ──");
  const { status: adminStats } = await req("GET", "/admin/stats", adminToken);
  check("GET /admin/stats", adminStats, 200);

  const { status: adminSettings, json: settingsJson } = await req("GET", "/admin/settings", adminToken);
  check("GET /admin/settings", adminSettings, 200);
  const credCount = ((settingsJson as Record<string, unknown>)?.mobileCredentials as unknown[])?.length ?? 0;
  check("admin/settings includes mobileCredentials (≥1)", credCount >= 1 ? 200 : 400, 200, `got ${credCount} credentials`);

  const { status: adminTechs } = await req("GET", "/admin/technicians", adminToken);
  check("GET /admin/technicians", adminTechs, 200);
  const { status: adminUsers } = await req("GET", "/admin/users", adminToken);
  check("GET /admin/users", adminUsers, 200);
  const { status: adminLocs } = await req("GET", "/admin/locations", adminToken);
  check("GET /admin/locations", adminLocs, 200);
  const { status: adminSvcPkg } = await req("GET", "/service-packages", adminToken);
  check("GET /service-packages (admin)", adminSvcPkg, 200);

  // ── 8. Summary ───────────────────────────────────────────────────────────────
  const passed = results.filter((r) => r.pass).length;
  const failed = results.filter((r) => !r.pass).length;

  console.log("\n╔═══════════════════════════════════════════════════╗");
  console.log(`║  RESULT: ${passed} passed, ${failed} failed                    ║`);
  console.log("╚═══════════════════════════════════════════════════╝\n");

  if (failed > 0) {
    console.log("FAILED CHECKS:");
    results.filter((r) => !r.pass).forEach((r) =>
      console.log(`  ❌ ${r.label} — got ${r.actual}, want ${r.expected}${r.detail ? ` (${r.detail})` : ""}`)
    );
    process.exit(1);
  }

  process.exit(0);
}

main().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});
