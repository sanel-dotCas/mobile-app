import { db, jobsTable, techniciansTable } from "@workspace/db";
import { logger } from "./logger";

const SEED_TECHNICIANS = [
  {
    id: "tech-001",
    name: "Mike Rodriguez",
    role: "Senior Technician",
    avatar: "MR",
    userCode: "MR",
    status: "idle" as const,
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
    status: "idle" as const,
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
    status: "idle" as const,
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
    status: "idle" as const,
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
    status: "absent" as const,
    weekHoursBooked: 0,
    monthHoursBooked: 0,
    specializations: ["MECHANICAL", "ELECTRICAL", "DIAGNOSTIC", "BODY"],
    completedJobs: 289,
  },
];

export async function seedDatabase() {
  const [techCount, jobCount] = await Promise.all([
    db.select().from(techniciansTable),
    db.select().from(jobsTable),
  ]);

  if (techCount.length === 0) {
    logger.info("Seeding technicians table with initial data");
    await db.insert(techniciansTable).values(SEED_TECHNICIANS);
    logger.info({ count: SEED_TECHNICIANS.length }, "Technicians seeded");
  }

  if (jobCount.length === 0) {
    logger.info("Jobs table is empty — deferred to route-level seeding");
  }
}
