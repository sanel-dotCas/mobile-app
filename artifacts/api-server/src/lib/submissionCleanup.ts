import { db, estimateSubmissionsTable } from "@workspace/db";
import { lt, sql } from "drizzle-orm";
import { logger } from "./logger";

const DEFAULT_RETENTION_DAYS = 90;

/**
 * Returns the configured retention period in days.
 * Reads SUBMISSION_RETENTION_DAYS from the environment; falls back to 90.
 * The idempotency window for duplicate DMS submissions equals this value:
 * a re-submission of the same estimateId within the retention window will
 * return the existing RO number rather than creating a new one.
 */
export function getRetentionDays(): number {
  const raw = process.env["SUBMISSION_RETENTION_DAYS"];
  if (!raw) return DEFAULT_RETENTION_DAYS;
  const parsed = parseInt(raw, 10);
  if (Number.isNaN(parsed) || parsed <= 0) {
    logger.warn(
      { SUBMISSION_RETENTION_DAYS: raw },
      "Invalid SUBMISSION_RETENTION_DAYS value — using default of 90 days"
    );
    return DEFAULT_RETENTION_DAYS;
  }
  return parsed;
}

/**
 * Deletes estimate_submissions rows whose submittedAt is older than
 * the configured retention window. Returns the number of rows removed.
 */
export async function cleanupOldSubmissions(): Promise<number> {
  const retentionDays = getRetentionDays();

  const cutoff = sql`now() - (${retentionDays} * interval '1 day')`;

  const result = await db
    .delete(estimateSubmissionsTable)
    .where(lt(estimateSubmissionsTable.submittedAt, cutoff));

  const deleted = result.rowCount ?? 0;

  if (deleted > 0) {
    logger.info(
      { deleted, retentionDays },
      "Cleaned up expired DMS submission records"
    );
  } else {
    logger.debug(
      { retentionDays },
      "DMS submission cleanup ran — no expired records found"
    );
  }

  return deleted;
}

const CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1000;

/**
 * Starts the periodic cleanup job. Runs once immediately on startup,
 * then every 24 hours. The interval handle is returned so callers can
 * clear it during graceful shutdown if needed.
 */
export function startSubmissionCleanup(): ReturnType<typeof setInterval> {
  cleanupOldSubmissions().catch((err) => {
    logger.error({ err }, "Initial DMS submission cleanup failed");
  });

  const handle = setInterval(() => {
    cleanupOldSubmissions().catch((err) => {
      logger.error({ err }, "Scheduled DMS submission cleanup failed");
    });
  }, CLEANUP_INTERVAL_MS);

  handle.unref();

  logger.info(
    { retentionDays: getRetentionDays(), intervalHours: 24 },
    "DMS submission cleanup job started"
  );

  return handle;
}
