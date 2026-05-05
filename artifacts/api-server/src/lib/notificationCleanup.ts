import { db, jobNotificationsTable } from "@workspace/db";
import { lt, sql } from "drizzle-orm";
import { logger } from "./logger";

const DEFAULT_RETENTION_DAYS = 30;

/**
 * Returns the configured retention period in days for job notifications.
 * Reads NOTIFICATION_RETENTION_DAYS from the environment; falls back to 30.
 */
export function getNotificationRetentionDays(): number {
  const raw = process.env["NOTIFICATION_RETENTION_DAYS"];
  if (!raw) return DEFAULT_RETENTION_DAYS;
  const parsed = parseInt(raw, 10);
  if (Number.isNaN(parsed) || parsed <= 0) {
    logger.warn(
      { NOTIFICATION_RETENTION_DAYS: raw },
      "Invalid NOTIFICATION_RETENTION_DAYS value — using default of 30 days"
    );
    return DEFAULT_RETENTION_DAYS;
  }
  return parsed;
}

/**
 * Deletes job_notifications rows whose sentAt is older than the configured
 * retention window. Returns the number of rows removed.
 */
export async function cleanupOldNotifications(): Promise<number> {
  const retentionDays = getNotificationRetentionDays();

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
  cleanupOldNotifications().catch((err) => {
    logger.error({ err }, "Initial job notification cleanup failed");
  });

  const handle = setInterval(() => {
    cleanupOldNotifications().catch((err) => {
      logger.error({ err }, "Scheduled job notification cleanup failed");
    });
  }, CLEANUP_INTERVAL_MS);

  handle.unref();

  logger.info(
    { retentionDays: getNotificationRetentionDays(), intervalHours: 24 },
    "Job notification cleanup job started"
  );

  return handle;
}
