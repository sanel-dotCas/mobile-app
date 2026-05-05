import { db } from "@workspace/db";
import {
  techniciansTable,
  jobsTable,
  yardUsersTable,
} from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "./logger";
import { hashPassword } from "./passwordHash";

const SEED_TECHNICIANS = [
  {
    id: "tech-001",
    name: "Mike Rodriguez",
    role: "Senior Technician",
    avatar: "MR",
    userCode: "MR",
    status: "idle" as const,
    weekHoursBooked: 0,
    monthHoursBooked: 0,
    specializations: ["MECHANICAL", "ELECTRICAL"],
    completedJobs: 142,
  },
  {
    id: "tech-002",
    name: "James Wilson",
    role: "Technician",
    avatar: "JW",
    userCode: "JW",
    status: "idle" as const,
    weekHoursBooked: 0,
    monthHoursBooked: 0,
    specializations: ["BODY", "PAINT"],
    completedJobs: 98,
  },
  {
    id: "tech-003",
    name: "Carlos Mendez",
    role: "Technician",
    avatar: "CM",
    userCode: "CM",
    status: "idle" as const,
    weekHoursBooked: 0,
    monthHoursBooked: 0,
    specializations: ["MECHANICAL", "DIAGNOSTIC"],
    completedJobs: 76,
  },
  {
    id: "tech-004",
    name: "Ahmed Hassan",
    role: "Technician",
    avatar: "AH",
    userCode: "AH",
    status: "idle" as const,
    weekHoursBooked: 0,
    monthHoursBooked: 0,
    specializations: ["ELECTRICAL", "DIAGNOSTIC"],
    completedJobs: 115,
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

// ─────────────────────────────────────────────────────────────────────────────
// Seed user definitions.
//
// Mobile users have a stable `username` (e.g. "MR") and a separate `userCode`
// (e.g. "MR") used as the login code on the mobile app.  The `password` column
// stores a scrypt hash of just the PIN — completely decoupled from the code so
// credentials can be rotated (admin changes password) without touching the
// stable username identity.
//
// Multiple users may share the same `userCode` (e.g. "ET" for two estimators);
// the server looks up all candidates by userCode, then selects the one whose
// PIN hash matches.
//
// IMPORTANT — password handling:
//   On INSERT (first-time bootstrap) the plain password is hashed with scrypt
//   and stored.  On conflict (user already exists) the password column is
//   intentionally NOT overwritten so that rotated credentials survive restarts.
//   Only name, role, mobileRole, and userCode are kept in sync by the upsert.
// ─────────────────────────────────────────────────────────────────────────────
type SeedUser = {
  username: string;
  userCode?: string;
  plainPassword: string;
  name: string;
  role: "admin" | "yard_manager" | "yard_operator";
  mobileRole?: string;
};

const SEED_YARD_USERS: SeedUser[] = [
  // ── Yard-web-only accounts ────────────────────────────────────────────────
  { username: "admin", plainPassword: "admin123", name: "Admin User", role: "admin" },

  // ── Mobile technician accounts ─────────────────────────────────────────────
  // username = stable display identity; userCode = login code on device; plainPassword = PIN only
  { username: "MR",   userCode: "MR", plainPassword: "1234", name: "Mike Rodriguez",  role: "yard_operator", mobileRole: "technician" },
  { username: "JW",   userCode: "JW", plainPassword: "1234", name: "James Wilson",    role: "yard_operator", mobileRole: "technician" },
  { username: "CM",   userCode: "CM", plainPassword: "1234", name: "Carlos Mendez",   role: "yard_operator", mobileRole: "technician" },
  { username: "AH",   userCode: "AH", plainPassword: "1234", name: "Ahmed Hassan",    role: "yard_operator", mobileRole: "technician" },
  { username: "DP",   userCode: "DP", plainPassword: "1234", name: "David Park",      role: "yard_operator", mobileRole: "technician" },

  // ── Mobile supervisor accounts ─────────────────────────────────────────────
  { username: "SV",   userCode: "SV", plainPassword: "5678", name: "Sarah Mitchell",  role: "yard_manager",  mobileRole: "supervisor" },
  { username: "AD",   userCode: "AD", plainPassword: "0000", name: "Adam Davis",      role: "yard_manager",  mobileRole: "supervisor" },

  // ── Mobile estimator accounts (two share userCode "ET", different PINs) ────
  { username: "ET-A", userCode: "ET", plainPassword: "1234", name: "Estimator 1",     role: "yard_operator", mobileRole: "estimator"  },
  { username: "ET-B", userCode: "ET", plainPassword: "5678", name: "Estimator 2",     role: "yard_operator", mobileRole: "estimator"  },

  // ── Mobile parts accounts ──────────────────────────────────────────────────
  { username: "PT",   userCode: "PT", plainPassword: "1234", name: "Parts User",      role: "yard_operator", mobileRole: "parts"      },
  { username: "PD",   userCode: "PD", plainPassword: "1234", name: "Parts Delivery",  role: "yard_operator", mobileRole: "parts"      },

  // ── Mobile admin accounts ──────────────────────────────────────────────────
  { username: "AM-A", userCode: "AM", plainPassword: "0000", name: "Mobile Admin 1",  role: "admin",         mobileRole: "admin"      },
  { username: "AM-B", userCode: "AM", plainPassword: "0001", name: "Mobile Admin 2",  role: "admin",         mobileRole: "admin"      },
];

// Legacy usernames from previous schema iterations that must be removed.
// Includes the old code+pin composite usernames (e.g. "MR1234") that were
// replaced by stable single-code usernames (e.g. "MR").
const LEGACY_USERNAMES = [
  // Very old era
  "yard.manager", "operator",
  // Previous era: usernames encoded as UPPER(code+pin)
  "MR1234", "JW1234", "CM1234", "AH1234", "DP1234",
  "SV5678", "AD0000",
  "ET1234", "ET5678",
  "PT1234", "PD1234",
  "AM0000", "AM0001",
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

  // ── One-time plaintext-to-scrypt migration ────────────────────────────────
  // Existing deployments may have been seeded before scrypt hashing was
  // introduced.  On every startup we scan all user rows and rehash any password
  // that does not yet carry the "scrypt:<salt>:<hash>" prefix.  Subsequent
  // startups are no-ops once all passwords are hashed.
  const allUsers = await db
    .select({ id: yardUsersTable.id, password: yardUsersTable.password })
    .from(yardUsersTable);
  for (const u of allUsers) {
    if (!u.password.startsWith("scrypt:")) {
      const hashed = hashPassword(u.password);  // hash the stored plaintext
      await db
        .update(yardUsersTable)
        .set({ password: hashed })
        .where(eq(yardUsersTable.id, u.id));
      logger.info({ userId: u.id }, "Migrated plaintext password to scrypt hash");
    }
  }

  // Upsert seed users — bootstraps missing accounts and keeps metadata
  // (name / role / mobileRole / userCode) in sync, but NEVER overwrites the
  // password of an existing row so rotated credentials survive restarts.
  for (const u of SEED_YARD_USERS) {
    const hashedPassword = hashPassword(u.plainPassword);
    await db
      .insert(yardUsersTable)
      .values({
        username: u.username,
        password: hashedPassword,       // used only on INSERT
        name: u.name,
        role: u.role,
        mobileRole: u.mobileRole ?? null,
        userCode: u.userCode ?? null,
      })
      .onConflictDoUpdate({
        target: yardUsersTable.username,
        set: {
          // Metadata kept in sync; password column deliberately excluded
          // so any admin-rotated credential is preserved across restarts.
          name: u.name,
          role: u.role,
          mobileRole: u.mobileRole ?? null,
          userCode: u.userCode ?? null,
        },
      });
  }

  // Remove obsolete legacy users.
  for (const oldUsername of LEGACY_USERNAMES) {
    await db.delete(yardUsersTable).where(eq(yardUsersTable.username, oldUsername));
  }

  if (jobCount.length === 0) {
    logger.info("Jobs table is empty — deferred to route-level seeding");
  }
}
