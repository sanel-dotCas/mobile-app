import { Router } from "express";
import { db, jobNotificationsTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { requireMobileRoles } from "../middlewares/requireAuth";

const router = Router();

router.get("/jobs/notifications", requireMobileRoles("technician", "supervisor", "admin"), async (req, res) => {
  const principal = res.locals.principal;
  if (!principal) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    const rows = await db
      .select()
      .from(jobNotificationsTable)
      .where(eq(jobNotificationsTable.yardUserId, String(principal.userId)))
      .orderBy(desc(jobNotificationsTable.sentAt))
      .limit(100);

    const unreadCount = rows.filter((r) => !r.read).length;
    res.json({ notifications: rows, unreadCount });
  } catch {
    res.status(500).json({ error: "Failed to fetch notifications" });
  }
});

router.patch("/jobs/notifications/:id/read", requireMobileRoles("technician", "supervisor", "admin"), async (req, res) => {
  const principal = res.locals.principal;
  if (!principal) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid notification id" });
    return;
  }

  try {
    await db
      .update(jobNotificationsTable)
      .set({ read: true })
      .where(
        and(
          eq(jobNotificationsTable.id, id),
          eq(jobNotificationsTable.yardUserId, String(principal.userId))
        )
      );
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Failed to mark notification as read" });
  }
});

router.post("/jobs/notifications/read-all", requireMobileRoles("technician", "supervisor", "admin"), async (req, res) => {
  const principal = res.locals.principal;
  if (!principal) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    await db
      .update(jobNotificationsTable)
      .set({ read: true })
      .where(eq(jobNotificationsTable.yardUserId, String(principal.userId)));
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Failed to mark all notifications as read" });
  }
});

export default router;
