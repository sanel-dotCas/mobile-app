import { Router } from "express";
import { db, jobOdometerCorrectionsTable, jobsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { formatVehicleName } from "../lib/formatVehicleName";

const router = Router();

function rowToJob(row: typeof jobsTable.$inferSelect) {
  const vehicle = formatVehicleName({
    year: row.vehicleYear ?? undefined,
    make: row.vehicleMake ?? undefined,
    model: row.vehicleModel ?? undefined,
  });
  return {
    id: row.id,
    estimateNumber: row.estimateNumber,
    licensePlate: row.licensePlate,
    vehicle,
    serviceAdvisor: row.serviceAdvisor,
    totalEstimatedHours: parseFloat(row.totalEstimatedHours),
    workedHours: parseFloat(row.workedHours),
    customerNotes: row.customerNotes,
    odometer: row.odometer,
    appointmentDate: row.appointmentDate,
    status: row.status,
    thumbnail: row.thumbnail,
    progress: row.progress,
    assignedTechnicianId: row.assignedTechnicianId ?? undefined,
    currentStageId: row.currentStageId,
    tasks: row.tasks as unknown[],
    notes: row.notes as unknown[],
    inspections: row.inspections as unknown[],
    stageHistory: row.stageHistory as unknown[],
  };
}

router.get("/jobs", async (req, res) => {
  try {
    const rows = await db.select().from(jobsTable);

    const corrections = await db.select().from(jobOdometerCorrectionsTable);
    const correctionMap: Record<string, number> = {};
    for (const c of corrections) {
      correctionMap[c.jobId] = c.odometer;
    }

    const jobs = rows.map((row) => {
      const job = rowToJob(row);
      if (correctionMap[job.id] !== undefined) {
        job.odometer = correctionMap[job.id];
      }
      return job;
    });

    res.json({ jobs });
  } catch (err) {
    req.log.error(err, "Failed to fetch jobs");
    res.status(500).json({ error: "Failed to fetch jobs" });
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

router.get("/jobs/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const rows = await db.select().from(jobsTable).where(eq(jobsTable.id, id));
    if (rows.length === 0) {
      res.status(404).json({ error: "Job not found" });
      return;
    }
    const job = rowToJob(rows[0]);

    const corrections = await db
      .select()
      .from(jobOdometerCorrectionsTable)
      .where(eq(jobOdometerCorrectionsTable.jobId, id));
    if (corrections.length > 0) {
      job.odometer = corrections[0].odometer;
    }

    res.json(job);
  } catch (err) {
    req.log.error(err, "Failed to fetch job");
    res.status(500).json({ error: "Failed to fetch job" });
  }
});

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

export default router;
