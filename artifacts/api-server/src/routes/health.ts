import { Router, type IRouter } from "express";
import { sql } from "drizzle-orm";
import { HealthCheckResponse } from "@workspace/api-zod";
import { db } from "@workspace/db";
import { logger } from "../lib/logger";
import { getErrorStats } from "../lib/errorTracker";

const router: IRouter = Router();
const startedAt = new Date();

router.get("/healthz", async (_req, res) => {
  let dbOk = false;
  try {
    await db.execute(sql`SELECT 1`);
    dbOk = true;
  } catch (e) {
    logger.error({ err: e }, "Health check: database ping failed");
  }

  if (!dbOk) {
    res.status(503).json({ status: "error", error: "Database unreachable" });
    return;
  }

  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json(data);
});

router.get("/status", (_req, res) => {
  const uptimeSeconds = Math.floor((Date.now() - startedAt.getTime()) / 1000);
  const stats = getErrorStats();

  res.json({
    status: "ok",
    uptime: uptimeSeconds,
    startedAt: startedAt.toISOString(),
    errors: {
      lastMinute: stats.errorsInLastMinute,
      alertThreshold: stats.alertThreshold,
      alertCooldownMinutes: stats.alertCooldownMinutes,
    },
    alerting: {
      webhookConfigured: stats.webhookConfigured,
      webhookEnvVar: "ALERT_WEBHOOK_URL",
    },
    services: {
      api: "up",
    },
  });
});

export default router;
