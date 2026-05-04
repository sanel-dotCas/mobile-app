import { db, jobsTable, techniciansTable, yardUsersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
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

const SEED_YARD_USERS = [
  { username: "admin", password: "admin",  name: "Admin User",      role: "admin"          as const },
  { username: "MR",    password: "1234",   name: "Mike Rodriguez",  role: "yard_operator"  as const },
  { username: "JW",    password: "1234",   name: "James Wilson",    role: "yard_operator"  as const },
  { username: "CM",    password: "1234",   name: "Carlos Mendez",   role: "yard_operator"  as const },
  { username: "AH",    password: "1234",   name: "Ahmed Hassan",    role: "yard_operator"  as const },
  { username: "DP",    password: "1234",   name: "David Park",      role: "yard_operator"  as const },
];

export async function seedDatabase() {
  const [techCount, jobCount, yardUserCount] = await Promise.all([
    db.select().from(techniciansTable),
    db.select().from(jobsTable),
    db.select().from(yardUsersTable),
  ]);

  if (techCount.length === 0) {
    logger.info("Seeding technicians table with initial data");
    await db.insert(techniciansTable).values(SEED_TECHNICIANS);
    logger.info({ count: SEED_TECHNICIANS.length }, "Technicians seeded");
  }

  if (yardUserCount.length === 0) {
    logger.info("Seeding yard_users table with initial data");
    for (const u of SEED_YARD_USERS) {
      await db
        .insert(yardUsersTable)
        .values(u)
        .onConflictDoUpdate({ target: yardUsersTable.username, set: { name: u.name, role: u.role } });
    }
    logger.info({ count: SEED_YARD_USERS.length }, "Yard users seeded");
  } else {
    // Ensure the 5 technician yard users exist even if the table was previously seeded with old data
    for (const u of SEED_YARD_USERS) {
      await db
        .insert(yardUsersTable)
        .values(u)
        .onConflictDoUpdate({ target: yardUsersTable.username, set: { name: u.name, role: u.role } });
    }
    // Remove legacy placeholder users that are no longer needed
    for (const oldUsername of ["yard.manager", "operator"]) {
      await db.delete(yardUsersTable).where(eq(yardUsersTable.username, oldUsername));
    }
  }

  if (jobCount.length === 0) {
    logger.info("Jobs table is empty — deferred to route-level seeding");
  }
}
