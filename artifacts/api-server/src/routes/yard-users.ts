import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { yardUsersTable } from "@workspace/db";

const router: IRouter = Router();

router.get("/yard/users", async (_req, res) => {
  const users = await db
    .select({
      id: yardUsersTable.id,
      username: yardUsersTable.username,
      name: yardUsersTable.name,
      role: yardUsersTable.role,
      locationId: yardUsersTable.locationId,
    })
    .from(yardUsersTable)
    .orderBy(yardUsersTable.name);

  res.json(users);
});

export default router;
