import { db, yardLocationsTable, yardUsersTable, yardInspectionsTable } from "@workspace/db";
import { and, or, eq } from "drizzle-orm";
import { logger } from "./logger";
import { sendExpoPushNotification } from "./pushNotifications";

const DEFAULT_DIGEST_HOUR_UTC = 7;

/**
 * Returns the server-wide fallback UTC hour (0–23) for the daily digest.
 * Controlled by DIGEST_HOUR_UTC; defaults to 7 (7 AM UTC).
 * Individual yards can override this via their digestHourUtc column.
 */
export function getGlobalDigestHourUTC(): number {
  const raw = process.env["DIGEST_HOUR_UTC"];
  if (!raw) return DEFAULT_DIGEST_HOUR_UTC;
  const parsed = parseInt(raw, 10);
  if (Number.isNaN(parsed) || parsed < 0 || parsed > 23) {
    logger.warn(
      { DIGEST_HOUR_UTC: raw },
      "Invalid DIGEST_HOUR_UTC — using default of 7 (7 AM UTC)"
    );
    return DEFAULT_DIGEST_HOUR_UTC;
  }
  return parsed;
}

/**
 * Returns whether the digest is globally enabled.
 * Set DIGEST_ENABLED=false to disable across all yards.
 * Individual yards can also be disabled via their digestEnabled column.
 */
export function isGlobalDigestEnabled(): boolean {
  const raw = process.env["DIGEST_ENABLED"];
  if (!raw) return true;
  return raw.toLowerCase() !== "false" && raw !== "0";
}

/**
 * Returns the number of milliseconds until the top of the next clock hour.
 * The hourly tick is used to check whether any yard's digest hour has arrived.
 */
function msUntilNextHour(): number {
  const now = new Date();
  const next = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
      now.getUTCHours() + 1,
      0,
      0,
      0
    )
  );
  return next.getTime() - now.getTime();
}

/**
 * In-memory record of which locations have already received a digest today.
 * Keyed by location id, value is the UTC date string ("YYYY-MM-DD") of the
 * last send. Cleared on server restart (acceptable — a restart-triggered
 * duplicate send is benign and rare).
 */
const sentTodayByLocation = new Map<number, string>();

/**
 * Sends a morning digest push to every technician with open inspections at
 * the given yard location. Only users linked to this location are considered,
 * preventing cross-location misdelivery when names are not globally unique.
 * Respects each user's notificationsEnabled flag.
 */
async function sendDigestForLocation(locationId: number, locationName: string): Promise<void> {
  const pendingInspections = await db
    .select({
      id: yardInspectionsTable.id,
      assignedTo: yardInspectionsTable.assignedTo,
    })
    .from(yardInspectionsTable)
    .where(
      and(
        eq(yardInspectionsTable.locationId, locationId),
        or(
          eq(yardInspectionsTable.status, "queued"),
          eq(yardInspectionsTable.status, "in-progress")
        )
      )
    );

  // Group by assignedTo (skip unassigned inspections)
  const countByTechnician = new Map<string, number>();
  for (const insp of pendingInspections) {
    if (!insp.assignedTo) continue;
    countByTechnician.set(
      insp.assignedTo,
      (countByTechnician.get(insp.assignedTo) ?? 0) + 1
    );
  }

  if (countByTechnician.size === 0) {
    logger.info(
      { locationId, locationName },
      "Daily digest: no pending assigned inspections for this yard"
    );
    return;
  }

  // Fetch users scoped to this location to prevent cross-location name collisions
  const locationUsers = await db
    .select({
      name: yardUsersTable.name,
      username: yardUsersTable.username,
      expoPushToken: yardUsersTable.expoPushToken,
      notificationsEnabled: yardUsersTable.notificationsEnabled,
    })
    .from(yardUsersTable)
    .where(eq(yardUsersTable.locationId, locationId));

  // Build a lookup indexed by both name and username
  // (assignments may use either format depending on whether set via web or mobile)
  type UserEntry = { token: string };
  const userMap = new Map<string, UserEntry>();
  for (const u of locationUsers) {
    if (!u.expoPushToken || !u.notificationsEnabled) continue;
    userMap.set(u.name, { token: u.expoPushToken });
    userMap.set(u.username, { token: u.expoPushToken });
  }

  const messages: Parameters<typeof sendExpoPushNotification>[0] = [];

  for (const [techName, count] of countByTechnician) {
    const entry = userMap.get(techName);
    if (!entry) continue;

    const title = "Good morning!";
    const body =
      count === 1
        ? "You have 1 inspection pending in your queue."
        : `You have ${count} inspections pending in your queue.`;

    messages.push({
      to: entry.token,
      title,
      body,
      data: { screen: "inspections", locationId },
      sound: "default",
      priority: "high",
    });
  }

  if (messages.length === 0) {
    logger.info(
      { locationId, locationName },
      "Daily digest: no eligible technicians with push tokens for this yard"
    );
    return;
  }

  await sendExpoPushNotification(messages);

  logger.info(
    { locationId, locationName, recipientCount: messages.length },
    "Daily digest notifications sent"
  );
}

/**
 * Evaluates every yard location against the current UTC hour and fires
 * digests for locations whose configured (or globally defaulted) hour matches.
 * Each location receives at most one digest per calendar day (UTC).
 *
 * @param forceHour - If provided, treat this as the current UTC hour instead
 *   of reading the clock. Used by the startup check to send digests for any
 *   yard whose configured hour has already passed today.
 */
export async function runDigestCheck(options?: { forceHour?: number }): Promise<void> {
  if (!isGlobalDigestEnabled()) {
    logger.debug("Daily digest globally disabled — skipping check");
    return;
  }

  const globalHour = getGlobalDigestHourUTC();
  const nowUtc = new Date();
  const currentHourUtc = options?.forceHour ?? nowUtc.getUTCHours();
  const todayDateStr = nowUtc.toISOString().slice(0, 10); // "YYYY-MM-DD"

  const locations = await db
    .select({
      id: yardLocationsTable.id,
      name: yardLocationsTable.name,
      digestEnabled: yardLocationsTable.digestEnabled,
      digestHourUtc: yardLocationsTable.digestHourUtc,
    })
    .from(yardLocationsTable);

  for (const loc of locations) {
    if (!loc.digestEnabled) continue;

    const targetHour = loc.digestHourUtc ?? globalHour;
    if (targetHour !== currentHourUtc) continue;

    // Guard: only send once per calendar day per location
    if (sentTodayByLocation.get(loc.id) === todayDateStr) {
      logger.debug(
        { locationId: loc.id, locationName: loc.name },
        "Daily digest already sent to this yard today — skipping"
      );
      continue;
    }

    // Mark before sending to prevent duplicate triggers on concurrent checks;
    // on a failure the server will retry the following day.
    sentTodayByLocation.set(loc.id, todayDateStr);

    await sendDigestForLocation(loc.id, loc.name).catch((err) => {
      logger.error(
        { err, locationId: loc.id, locationName: loc.name },
        "Daily digest failed for yard"
      );
    });
  }
}

/**
 * Starts the hourly digest check loop.
 *
 * On startup, runs a catch-up check across all configured digest hours from
 * midnight up to and including the current UTC hour. This ensures that if the
 * server restarts after a yard's digest hour has passed, the digest is still
 * delivered once before the end of the day.
 *
 * Subsequently fires at the top of every clock hour via chained setTimeout.
 *
 * Global configuration (environment variables):
 *   DIGEST_ENABLED  — set to "false" or "0" to disable globally (default: true)
 *   DIGEST_HOUR_UTC — server-wide fallback UTC hour (0–23, default: 7)
 *
 * Per-yard configuration (yard_locations table columns):
 *   digest_enabled  — boolean, defaults to true; managers can toggle via PATCH /api/yard/locations/:id/digest
 *   digest_hour_utc — integer 0–23, null = inherit global default; configurable via the same endpoint
 */
export function startDailyDigest(): void {
  if (!isGlobalDigestEnabled()) {
    logger.info(
      "Daily digest notifications are disabled (DIGEST_ENABLED=false)"
    );
    return;
  }

  const currentHourUtc = new Date().getUTCHours();

  // Startup catch-up: replay every hour from 0 to now so yards whose digest
  // hour already passed today still get their notification after a restart.
  for (let h = 0; h <= currentHourUtc; h++) {
    const hour = h;
    runDigestCheck({ forceHour: hour }).catch((err) => {
      logger.error({ err, hour }, "Daily digest startup catch-up check failed");
    });
  }

  const scheduleNextHourTick = () => {
    const delayMs = msUntilNextHour();
    const nextTick = new Date(Date.now() + delayMs).toISOString();

    logger.debug({ nextTick }, "Daily digest: next hourly check scheduled");

    const timer = setTimeout(() => {
      runDigestCheck()
        .catch((err) => {
          logger.error({ err }, "Daily digest hourly check failed");
        })
        .finally(() => {
          scheduleNextHourTick();
        });
    }, delayMs);

    timer.unref();
  };

  scheduleNextHourTick();

  logger.info(
    {
      globalHourUTC: getGlobalDigestHourUTC(),
      checksEvery: "1 hour",
      startupCatchUpThroughHour: currentHourUtc,
    },
    "Daily digest job started"
  );
}
