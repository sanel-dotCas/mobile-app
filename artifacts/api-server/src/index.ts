import app from "./app";
import { logger } from "./lib/logger";
import { startSubmissionCleanup } from "./lib/submissionCleanup";
import { startNotificationCleanup } from "./lib/notificationCleanup";
import { startDailyDigest } from "./lib/dailyDigest";
import { seedDatabase } from "./lib/seedDatabase";
import { seedServicePackages } from "./routes/service-packages";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

async function sendCrashAlert(kind: string, detail: string) {
  const webhookUrl = process.env["ALERT_WEBHOOK_URL"];
  if (!webhookUrl) return;
  try {
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: `🔴 API Server crash (${kind}) — shutting down. Detail: ${detail.slice(0, 500)}`,
      }),
      signal: AbortSignal.timeout(4_000),
    });
  } catch {
    // Best-effort; do not delay shutdown
  }
}

process.on("uncaughtException", (err: Error) => {
  logger.fatal({ err }, "Uncaught exception — shutting down");
  sendCrashAlert("uncaughtException", err.message).finally(() => process.exit(1));
});

process.on("unhandledRejection", (reason: unknown) => {
  const detail = reason instanceof Error ? reason.message : String(reason);
  logger.fatal({ reason }, "Unhandled promise rejection — shutting down");
  sendCrashAlert("unhandledRejection", detail).finally(() => process.exit(1));
});

seedDatabase()
  .then(() => {
    app.listen(port, (err) => {
      if (err) {
        logger.error({ err }, "Error listening on port");
        process.exit(1);
      }

      logger.info({ port }, "Server listening");
      startSubmissionCleanup();
      startNotificationCleanup();
      startDailyDigest();
      seedServicePackages().catch((e) => logger.error({ err: e }, "Service package seeding failed"));
    });
  })
  .catch((err) => {
    logger.error({ err }, "Database seeding failed — aborting startup");
    process.exit(1);
  });
