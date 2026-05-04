import { Router } from "express";
import { eq } from "drizzle-orm";
import { db, jobsTable, techniciansTable, updateTechnicianStatusSchema } from "@workspace/db";
import { seedJobsIfEmpty } from "./jobs";

const router = Router();

type TaskShape = {
  workedHours?: number;
  estimatedHours?: number;
  elapsedSeconds?: number;
  status?: string;
  clockedIn?: boolean;
};

router.get("/technicians", async (req, res) => {
  try {
    await seedJobsIfEmpty();

    const [techRows, jobs] = await Promise.all([
      db.select().from(techniciansTable),
      db.select().from(jobsTable),
    ]);

    const technicians = techRows.map((tech) => {
      const assignedJobs = jobs.filter((j) => j.assignedTechnicianId === tech.id);
      const activeJob = assignedJobs.find((j) => j.status === "in_progress");

      let totalHoursToday = 0;
      let efficiencyWorked = 0;
      let efficiencyEstimated = 0;

      const today = new Date().toISOString().split("T")[0];

      for (const job of assignedJobs) {
        const tasks = Array.isArray(job.tasks) ? (job.tasks as TaskShape[]) : [];
        const jobDate = job.appointmentDate ? job.appointmentDate.split("T")[0] : null;
        const isToday = jobDate === today;

        for (const task of tasks) {
          const worked = typeof task.workedHours === "number" ? task.workedHours : 0;
          const estimated = typeof task.estimatedHours === "number" ? task.estimatedHours : 0;
          const hasWork = worked > 0;

          if (hasWork) {
            efficiencyWorked += worked;
            efficiencyEstimated += estimated;
          }
          if (isToday && hasWork) {
            totalHoursToday += worked;
          }
        }
      }

      const efficiency =
        efficiencyEstimated > 0
          ? Math.min(Math.round((efficiencyWorked / efficiencyEstimated) * 100), 100)
          : 0;

      return {
        id: tech.id,
        name: tech.name,
        role: tech.role,
        avatar: tech.avatar,
        currentJobId: activeJob?.id ?? null,
        status: tech.status as "active" | "idle" | "break" | "absent",
        totalHoursToday: parseFloat(totalHoursToday.toFixed(1)),
        efficiency,
        weekHoursBooked: tech.weekHoursBooked,
        monthHoursBooked: tech.monthHoursBooked,
        specializations: tech.specializations,
        completedJobs: tech.completedJobs,
      };
    });

    res.json({ technicians });
  } catch (err) {
    req.log.error(err, "Failed to fetch technicians");
    res.status(500).json({ error: "Failed to fetch technicians" });
  }
});

router.patch("/technicians/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const parsed = updateTechnicianStatusSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid status value", details: parsed.error.issues });
      return;
    }

    const existing = await db
      .select()
      .from(techniciansTable)
      .where(eq(techniciansTable.id, id));

    if (existing.length === 0) {
      res.status(404).json({ error: "Technician not found" });
      return;
    }

    const [updated] = await db
      .update(techniciansTable)
      .set({ status: parsed.data.status, updatedAt: new Date() })
      .where(eq(techniciansTable.id, id))
      .returning();

    res.json({ technician: updated });
  } catch (err) {
    req.log.error(err, "Failed to update technician status");
    res.status(500).json({ error: "Failed to update technician status" });
  }
});

router.get("/technicians/me/stats", async (req, res) => {
  try {
    await seedJobsIfEmpty();

    const userCode =
      typeof req.query.userCode === "string" ? req.query.userCode.toUpperCase() : "MR";

    const techRows = await db
      .select()
      .from(techniciansTable)
      .where(eq(techniciansTable.userCode, userCode));

    const tech = techRows[0] ?? (await db.select().from(techniciansTable))[0];

    if (!tech) {
      res.status(404).json({ error: "Technician not found" });
      return;
    }

    const jobs = await db.select().from(jobsTable);
    const assignedJobs = jobs.filter((j) => j.assignedTechnicianId === tech.id);

    let totalSeconds = 0;
    let totalEstimatedHours = 0;
    let totalWorkedHours = 0;

    const workingDays = new Map<string, number>();

    for (const job of assignedJobs) {
      const tasks = Array.isArray(job.tasks) ? (job.tasks as TaskShape[]) : [];
      const dateKey = job.appointmentDate ? job.appointmentDate.split("T")[0] : null;

      for (const task of tasks) {
        const elapsed = typeof task.elapsedSeconds === "number" ? task.elapsedSeconds : 0;
        const worked = typeof task.workedHours === "number" ? task.workedHours : 0;
        const estimated = typeof task.estimatedHours === "number" ? task.estimatedHours : 0;

        totalSeconds += elapsed;
        totalWorkedHours += worked;
        totalEstimatedHours += estimated;

        if (elapsed > 0 && dateKey) {
          workingDays.set(dateKey, (workingDays.get(dateKey) ?? 0) + elapsed);
        }
      }
    }

    const totalHours = Math.floor(totalSeconds / 3600);
    const totalMinutes = Math.floor((totalSeconds % 3600) / 60);
    const totalTimeTracked = `${totalHours}h ${totalMinutes}m`;

    const productivity =
      totalEstimatedHours > 0
        ? Math.min(Math.round((totalWorkedHours / totalEstimatedHours) * 100), 100)
        : 0;

    const workingPattern: Record<string, "worked" | "partial" | "off"> = {};
    for (const [date, secs] of workingDays.entries()) {
      workingPattern[date] = secs >= 3600 ? "worked" : "partial";
    }

    res.json({ totalTimeTracked, productivity, workingPattern });
  } catch (err) {
    req.log.error(err, "Failed to fetch technician stats");
    res.status(500).json({ error: "Failed to fetch technician stats" });
  }
});

export default router;
