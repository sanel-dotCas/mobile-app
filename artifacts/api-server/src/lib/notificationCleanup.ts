import { db, jobNotificationsTable, systemSettingsTable } from "@workspace/db";
import { lt, sql, eq } from "drizzle-orm";
import { logger } from "./logger";

const DEFAULT_RETENTION_DAYS = 30;
const SETTING_KEY = "notification_retention_days";

/**
 * Returns the configured retention period in days for job notifications.
 * Priority: DB setting → NOTIFICATION_RETENTION_DAYS env var → default 30.
 */
export async function getNotificationRetentionDays(): Promise<number> {
  try {
    const [row] = await db
      .select({ value: systemSettingsTable.value })
      .from(systemSettingsTable)
      .where(eq(systemSettingsTable.key, SETTING_KEY))
      .limit(1);

    if (row) {
      const parsed = parseInt(row.value, 10);
      if (!Number.isNaN(parsed) && parsed > 0) return parsed;
    }
  } catch (err) {
    logger.warn({ err }, "Could not read notification retention setting from DB — falling back to env/default");
  }

  const raw = process.env["NOTIFICATION_RETENTION_DAYS"];
  if (raw) {
    const parsed = parseInt(raw, 10);
    if (!Number.isNaN(parsed) && parsed > 0) return parsed;
    logger.warn(
      { NOTIFICATION_RETENTION_DAYS: raw },
      "Invalid NOTIFICATION_RETENTION_DAYS value — using default of 30 days"
    );
  }

  return DEFAULT_RETENTION_DAYS;
}

/**
 * Deletes job_notifications rows whose sentAt is older than the configured
 * retention window. Returns the number of rows removed.
 */
export async function cleanupOldNotifications(): Promise<number> {
  const retentionDays = await getNotificationRetentionDays();

  const cutoff = sql`now() - (${retentionDays} * interval '1 day')`;

  const result = await db
    .delete(jobNotificationsTable)
    .where(lt(jobNotificationsTable.sentAt, cutoff));

  const deleted = result.rowCount ?? 0;

  if (deleted > 0) {
    logger.info(
      { deleted, retentionDays },
      "Cleaned up expired job notification records"
    );
  } else {
    logger.debug(
      { retentionDays },
      "Job notification cleanup ran — no expired records found"
    );
  }

  return deleted;
}

const CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1000;

/**
 * Starts the periodic notification cleanup job. Runs once immediately on
 * startup, then every 24 hours. The interval handle is returned so callers
 * can clear it during graceful shutdown if needed.
 */
export function startNotificationCleanup(): ReturnType<typeof setInterval> {
  getNotificationRetentionDays()
    .then((retentionDays) => {
      logger.info(
        { retentionDays, intervalHours: 24 },
        "Job notification cleanup job started"
      );
    })
    .catch(() => {});

  cleanupOldNotifications().catch((err) => {
    logger.error({ err }, "Initial job notification cleanup failed");
  });

  const handle = setInterval(() => {
    cleanupOldNotifications().catch((err) => {
      logger.error({ err }, "Scheduled job notification cleanup failed");
    });
  }, CLEANUP_INTERVAL_MS);

  handle.unref();

  return handle;
}
