import { Router } from "express";
import { db, jobOdometerCorrectionsTable } from "@workspace/db";

const router = Router();

router.patch("/jobs/:id/odometer", async (req, res) => {
  const { id } = req.params;
  const { odometer } = req.body as { odometer?: unknown };

  if (typeof odometer !== "number" || !Number.isInteger(odometer) || odometer < 0) {
    res.status(400).json({ error: "odometer must be a non-negative integer" });
    return;
  }

  try {
    const [row] = await db
      .insert(jobOdometerCorrectionsTable)
      .values({ jobId: id, odometer })
      .onConflictDoUpdate({
        target: jobOdometerCorrectionsTable.jobId,
        set: { odometer, updatedAt: new Date() },
      })
      .returning();

    res.json({ id: row.jobId, odometer: row.odometer, updatedAt: row.updatedAt });
  } catch (err) {
    req.log.error(err, "Failed to save odometer correction");
    res.status(500).json({ error: "Failed to save odometer correction" });
  }
});

router.get("/jobs/odometer", async (req, res) => {
  try {
    const rows = await db.select().from(jobOdometerCorrectionsTable);
    const corrections: Record<string, number> = {};
    for (const row of rows) {
      corrections[row.jobId] = row.odometer;
    }
    res.json({ corrections });
  } catch (err) {
    req.log.error(err, "Failed to fetch odometer corrections");
    res.status(500).json({ error: "Failed to fetch odometer corrections" });
  }
});

export default router;
