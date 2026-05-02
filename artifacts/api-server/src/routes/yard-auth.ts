import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { yardUsersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

router.post("/yard/auth/login", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    res.status(400).json({ error: "username and password required" });
    return;
  }
  const [user] = await db
    .select()
    .from(yardUsersTable)
    .where(eq(yardUsersTable.username, username))
    .limit(1);

  if (!user || user.password !== password) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  res.json({
    id: user.id,
    username: user.username,
    name: user.name,
    role: user.role,
    locationId: user.locationId ?? null,
  });
});

router.post("/yard/auth/logout", (_req, res) => {
  res.json({ ok: true });
});

router.get("/yard/auth/me", async (req, res) => {
  const userId = req.headers["x-yard-user-id"];
  if (!userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  const [user] = await db
    .select()
    .from(yardUsersTable)
    .where(eq(yardUsersTable.id, Number(userId)))
    .limit(1);
  if (!user) {
    res.status(401).json({ error: "User not found" });
    return;
  }
  res.json({
    id: user.id,
    username: user.username,
    name: user.name,
    role: user.role,
    locationId: user.locationId ?? null,
  });
});

export default router;
