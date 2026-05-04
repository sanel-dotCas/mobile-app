import { Router } from "express";
import { db, jobsTable } from "@workspace/db";
import { seedJobsIfEmpty } from "./jobs";

const router = Router();

const SEED_TECHNICIANS = [
  {
    id: "tech-001",
    name: "Mike Rodriguez",
    role: "Senior Technician",
    avatar: "MR",
    userCode: "MR",
    weekHoursBooked: 32,
    monthHoursBooked: 128,
    specializations: ["MECHANICAL", "ELECTRICAL", "DIAGNOSTIC"],
    completedJobs: 312,
  },
  {
    id: "tech-002",
    name: "James Wilson",
    role: "Technician",
    avatar: "JW",
    userCode: "JW",
    weekHoursBooked: 24,
    monthHoursBooked: 98,
    specializations: ["ELECTRICAL", "DIAGNOSTIC"],
    completedJobs: 187,
  },
  {
    id: "tech-003",
    name: "Carlos Mendez",
    role: "Junior Technician",
    avatar: "CM",
    userCode: "CM",
    weekHoursBooked: 18,
    monthHoursBooked: 72,
    specializations: ["MECHANICAL"],
    completedJobs: 95,
  },
  {
    id: "tech-004",
    name: "Ahmed Hassan",
    role: "Technician",
    avatar: "AH",
    userCode: "AH",
    weekHoursBooked: 38,
    monthHoursBooked: 152,
    specializations: ["MECHANICAL", "BODY", "PAINT"],
    completedJobs: 241,
  },
  {
    id: "tech-005",
    name: "David Park",
    role: "Senior Technician",
    avatar: "DP",
    userCode: "DP",
    weekHoursBooked: 0,
    monthHoursBooked: 0,
    specializations: ["MECHANICAL", "ELECTRICAL", "DIAGNOSTIC", "BODY"],
    completedJobs: 289,
  },
];

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
    const jobs = await db.select().from(jobsTable);

    const technicians = SEED_TECHNICIANS.map((tech) => {
      const assignedJobs = jobs.filter((j) => j.assignedTechnicianId === tech.id);
      const activeJob = assignedJobs.find((j) => j.status === "in_progress");

      let totalHoursToday = 0;
      let efficiencyWorked = 0;
      let efficiencyEstimated = 0;
      let hasClockedInTask = false;

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
          if (task.clockedIn) hasClockedInTask = true;
        }
      }

      const efficiency =
        efficiencyEstimated > 0
          ? Math.min(Math.round((efficiencyWorked / efficiencyEstimated) * 100), 100)
          : 0;

      let status: "active" | "idle" | "break" | "absent";
      if (tech.id === "tech-005") {
        status = "absent";
      } else if (hasClockedInTask || activeJob) {
        status = "active";
      } else {
        status = "idle";
      }

      return {
        id: tech.id,
        name: tech.name,
        role: tech.role,
        avatar: tech.avatar,
        currentJobId: activeJob?.id ?? null,
        status,
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

router.get("/technicians/me/stats", async (req, res) => {
  try {
    await seedJobsIfEmpty();
    const userCode =
      typeof req.query.userCode === "string" ? req.query.userCode.toUpperCase() : "MR";

    const tech =
      SEED_TECHNICIANS.find((t) => t.userCode === userCode) ?? SEED_TECHNICIANS[0];

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
