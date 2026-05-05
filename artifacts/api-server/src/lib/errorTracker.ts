import { logger } from "./logger";

const WINDOW_MS = 60_000;

function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const val = Number(raw);
  return Number.isFinite(val) && val > 0 ? val : fallback;
}

function getThreshold() {
  return envInt("ERROR_ALERT_THRESHOLD", 5);
}

function getCooldownMs() {
  return envInt("ERROR_ALERT_COOLDOWN_MINUTES", 5) * 60_000;
}

const errorTimestamps: number[] = [];
let lastAlertAt = 0;

export interface ErrorContext {
  statusCode: number;
  path?: string;
  message?: string;
}

function pruneWindow(now: number) {
  while (errorTimestamps.length > 0 && errorTimestamps[0]! < now - WINDOW_MS) {
    errorTimestamps.shift();
  }
}

export function recordServerError(context: ErrorContext) {
  const now = Date.now();
  errorTimestamps.push(now);
  pruneWindow(now);

  const recentCount = errorTimestamps.length;
  const threshold = getThreshold();

  logger.error(
    { statusCode: context.statusCode, path: context.path, recentErrors: recentCount },
    context.message ?? "Server error recorded",
  );

  if (recentCount >= threshold && now - lastAlertAt > getCooldownMs()) {
    lastAlertAt = now;
    sendAlert(recentCount, context).catch((e: unknown) => {
      logger.warn({ err: e }, "Failed to send error alert webhook");
    });
  }
}

async function sendAlert(count: number, context: ErrorContext) {
  const webhookUrl = process.env["ALERT_WEBHOOK_URL"];
  const threshold = getThreshold();
  const message =
    `🚨 API Error Spike: ${count} server errors (5xx) in the last 60 seconds` +
    ` (threshold: ${threshold}). Last: ${context.statusCode} on ${context.path ?? "unknown path"}`;

  logger.error({ errorCount: count, path: context.path, threshold }, `CRITICAL ALERT — ${message}`);

  if (!webhookUrl) {
    logger.warn("ALERT_WEBHOOK_URL is not set — alert not delivered externally");
    return;
  }

  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: message }),
  });

  if (!response.ok) {
    logger.warn({ status: response.status }, "Alert webhook returned non-OK response");
  } else {
    logger.info({ webhookStatus: response.status }, "Alert webhook delivered successfully");
  }
}

export function getErrorStats() {
  const now = Date.now();
  pruneWindow(now);
  return {
    errorsInLastMinute: errorTimestamps.length,
    alertThreshold: getThreshold(),
    alertCooldownMinutes: envInt("ERROR_ALERT_COOLDOWN_MINUTES", 5),
    webhookConfigured: Boolean(process.env["ALERT_WEBHOOK_URL"]),
  };
}
