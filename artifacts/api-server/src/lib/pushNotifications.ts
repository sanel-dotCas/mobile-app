import { db } from "@workspace/db";
import { yardUsersTable, techniciansTable, jobNotificationsTable } from "@workspace/db";
import { eq, or } from "drizzle-orm";

interface PushMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sound?: "default" | null;
  badge?: number;
  priority?: "default" | "normal" | "high";
}

interface ExpoPushTicket {
  status: "ok" | "error";
  id?: string;
  message?: string;
  details?: { error?: string };
}

export async function sendExpoPushNotification(
  messages: PushMessage[]
): Promise<void> {
  if (messages.length === 0) return;
  try {
    const response = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Accept-Encoding": "gzip, deflate",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(messages),
    });
    if (!response.ok) return;
    const result = (await response.json()) as { data: ExpoPushTicket[] };
    const tickets = result.data ?? [];
    for (const ticket of tickets) {
      if (ticket.status === "error") {
        console.error("Expo push error:", ticket.message, ticket.details);
      }
    }
  } catch {
    // Non-critical — don't let notification failures break inspection routes
  }
}

async function persistNotification(
  yardUserId: string | number,
  title: string,
  body: string,
  opts?: { jobId?: string; inspectionId?: number }
): Promise<void> {
  try {
    await db.insert(jobNotificationsTable).values({
      yardUserId: String(yardUserId),
      title,
      body,
      jobId: opts?.jobId ?? null,
      inspectionId: opts?.inspectionId ?? null,
    });
  } catch {
    // Non-critical — don't let DB errors break notification flow
  }
}

/**
 * Looks up a yard user by the assignedTo string which may be either:
 * - A full name ("Mike Rodriguez") when set via auto-assign/generate from yard web app
 * - A username/code (e.g. "MR") when set via mobile app technician code
 */
async function findUserByAssignment(assignedTo: string) {
  const [user] = await db
    .select({
      id: yardUsersTable.id,
      expoPushToken: yardUsersTable.expoPushToken,
      notificationsEnabled: yardUsersTable.notificationsEnabled,
    })
    .from(yardUsersTable)
    .where(
      or(
        eq(yardUsersTable.name, assignedTo),
        eq(yardUsersTable.username, assignedTo)
      )
    )
    .limit(1);
  return user;
}

export async function notifyTechnicianAssigned(
  assignedTo: string,
  inspectionId: number,
  vehicleName: string,
  inspectionType: string,
  locationName: string | null
): Promise<void> {
  const user = await findUserByAssignment(assignedTo);

  if (!user || !user.expoPushToken || !user.notificationsEnabled) {
    return;
  }

  const typeLabel = INSPECTION_TYPE_LABELS[inspectionType] ?? inspectionType;
  const locationPart = locationName ? ` · ${locationName}` : "";
  const title = "New Inspection Assigned";
  const body = `${vehicleName}${locationPart} — ${typeLabel}`;

  await sendExpoPushNotification([
    {
      to: user.expoPushToken,
      title,
      body,
      data: { inspectionId, screen: "inspection" },
      sound: "default",
      priority: "high",
    },
  ]);

  await persistNotification(user.id, title, body, { inspectionId });
}

export async function notifyMultipleTechnicians(
  assignments: Array<{
    technicianName: string;
    inspectionId: number;
    vehicleName: string;
    inspectionType: string;
    locationName: string | null;
  }>
): Promise<void> {
  if (assignments.length === 0) return;

  // Fetch all users — resolve tokens by name OR username (to handle both assignment formats)
  const allUsers = await db
    .select({
      id: yardUsersTable.id,
      name: yardUsersTable.name,
      username: yardUsersTable.username,
      expoPushToken: yardUsersTable.expoPushToken,
      notificationsEnabled: yardUsersTable.notificationsEnabled,
    })
    .from(yardUsersTable);

  // Build a lookup map indexed by both name and username
  const userMap = new Map<string, { id: number; token: string }>();
  for (const u of allUsers) {
    if (!u.expoPushToken || !u.notificationsEnabled) continue;
    userMap.set(u.name, { id: u.id, token: u.expoPushToken });
    userMap.set(u.username, { id: u.id, token: u.expoPushToken });
  }

  const messages: PushMessage[] = [];
  const records: Array<{ userId: number; title: string; body: string; inspectionId: number }> = [];

  for (const a of assignments) {
    const entry = userMap.get(a.technicianName);
    if (!entry) continue;
    const typeLabel = INSPECTION_TYPE_LABELS[a.inspectionType] ?? a.inspectionType;
    const locationPart = a.locationName ? ` · ${a.locationName}` : "";
    const title = "New Inspection Assigned";
    const body = `${a.vehicleName}${locationPart} — ${typeLabel}`;
    messages.push({
      to: entry.token,
      title,
      body,
      data: { inspectionId: a.inspectionId, screen: "inspection" },
      sound: "default",
      priority: "high",
    });
    records.push({ userId: entry.id, title, body, inspectionId: a.inspectionId });
  }

  await sendExpoPushNotification(messages);

  for (const r of records) {
    await persistNotification(r.userId, r.title, r.body, { inspectionId: r.inspectionId });
  }
}

export async function notifyTechnicianReassigned(
  previousAssignedTo: string,
  inspectionId: number,
  vehicleName: string,
  inspectionType: string,
  locationName: string | null
): Promise<void> {
  const user = await findUserByAssignment(previousAssignedTo);

  if (!user || !user.expoPushToken || !user.notificationsEnabled) {
    return;
  }

  const typeLabel = INSPECTION_TYPE_LABELS[inspectionType] ?? inspectionType;
  const locationPart = locationName ? ` · ${locationName}` : "";
  const title = "Inspection Reassigned";
  const body = `${vehicleName}${locationPart} — ${typeLabel} has been reassigned to another technician`;

  await sendExpoPushNotification([
    {
      to: user.expoPushToken,
      title,
      body,
      data: { inspectionId, screen: "inspection" },
      sound: "default",
      priority: "high",
    },
  ]);

  await persistNotification(user.id, title, body, { inspectionId });
}

export async function notifyTechnicianUnassigned(
  previousAssignedTo: string,
  inspectionId: number,
  vehicleName: string,
  inspectionType: string,
  locationName: string | null
): Promise<void> {
  const user = await findUserByAssignment(previousAssignedTo);

  if (!user || !user.expoPushToken || !user.notificationsEnabled) {
    return;
  }

  const typeLabel = INSPECTION_TYPE_LABELS[inspectionType] ?? inspectionType;
  const locationPart = locationName ? ` · ${locationName}` : "";
  const title = "Inspection Removed";
  const body = `${vehicleName}${locationPart} — ${typeLabel} has been removed from your queue`;

  await sendExpoPushNotification([
    {
      to: user.expoPushToken,
      title,
      body,
      data: { inspectionId, screen: "inspection" },
      sound: "default",
      priority: "high",
    },
  ]);

  await persistNotification(user.id, title, body, { inspectionId });
}

export async function notifySupervisorsFailedInspection(
  inspectionId: number,
  vehicleName: string,
  inspectionType: string,
  locationName: string | null,
  failedCount: number,
  technicianName: string | null,
): Promise<void> {
  const supervisors = await db
    .select({
      id: yardUsersTable.id,
      expoPushToken: yardUsersTable.expoPushToken,
      notificationsEnabled: yardUsersTable.notificationsEnabled,
    })
    .from(yardUsersTable)
    .where(or(
      eq(yardUsersTable.role, "yard_manager"),
      eq(yardUsersTable.role, "admin"),
    ));

  const typeLabel = INSPECTION_TYPE_LABELS[inspectionType] ?? inspectionType;
  const locationPart = locationName ? ` · ${locationName}` : "";
  const techPart = technicianName ? ` by ${technicianName}` : "";
  const title = `⚠️ Inspection Failed Items (${failedCount})`;
  const body = `${vehicleName}${locationPart} — ${typeLabel}${techPart}. ${failedCount} item${failedCount !== 1 ? "s" : ""} failed. Review required.`;

  const eligibleSupervisors = supervisors.filter((u) => u.expoPushToken && u.notificationsEnabled);

  const messages: PushMessage[] = eligibleSupervisors.map((u) => ({
    to: u.expoPushToken!,
    title,
    body,
    data: { inspectionId, screen: "inspection" },
    sound: "default" as const,
    priority: "high" as const,
  }));

  await sendExpoPushNotification(messages);

  for (const u of eligibleSupervisors) {
    await persistNotification(u.id, title, body, { inspectionId });
  }
}

async function findUserByTechnicianId(technicianId: string): Promise<{ id: number; token: string } | null> {
  const [tech] = await db
    .select({ userCode: techniciansTable.userCode })
    .from(techniciansTable)
    .where(eq(techniciansTable.id, technicianId))
    .limit(1);

  if (!tech?.userCode) return null;

  const [user] = await db
    .select({
      id: yardUsersTable.id,
      expoPushToken: yardUsersTable.expoPushToken,
      notificationsEnabled: yardUsersTable.notificationsEnabled,
    })
    .from(yardUsersTable)
    .where(eq(yardUsersTable.userCode, tech.userCode))
    .limit(1);

  if (!user || !user.expoPushToken || !user.notificationsEnabled) return null;
  return { id: user.id, token: user.expoPushToken };
}

/**
 * Sends a push notification to a technician when a job is assigned to them.
 * Resolves the push token via: assignedTechnicianId → techniciansTable.userCode → yardUsersTable.userCode
 */
export async function notifyJobAssigned(
  technicianId: string,
  jobId: string,
  vehicleName: string
): Promise<void> {
  try {
    const found = await findUserByTechnicianId(technicianId);
    if (!found) return;

    const title = "New Job Assigned";
    const body = `New job assigned: ${vehicleName}`;

    await sendExpoPushNotification([
      {
        to: found.token,
        title,
        body,
        data: { jobId, screen: "job" },
        sound: "default",
        priority: "high",
      },
    ]);

    await persistNotification(found.id, title, body, { jobId });
  } catch {
    // Non-critical — don't let notification failures break job routes
  }
}

/**
 * Sends a "Job Reassigned" notification to the technician who previously held the job.
 */
export async function notifyJobReassigned(
  previousTechnicianId: string,
  jobId: string,
  vehicleName: string
): Promise<void> {
  try {
    const found = await findUserByTechnicianId(previousTechnicianId);
    if (!found) return;

    const title = "Job Reassigned";
    const body = `${vehicleName} has been reassigned to another technician`;

    await sendExpoPushNotification([
      {
        to: found.token,
        title,
        body,
        data: { jobId, screen: "job" },
        sound: "default",
        priority: "high",
      },
    ]);

    await persistNotification(found.id, title, body, { jobId });
  } catch {
    // Non-critical — don't let notification failures break job routes
  }
}

/**
 * Sends a "Job Reassigned to You" notification to the technician who is taking over the job.
 * Used instead of notifyJobAssigned when the job was previously held by someone else.
 */
export async function notifyJobReassignedToNew(
  technicianId: string,
  jobId: string,
  vehicleName: string
): Promise<void> {
  try {
    const found = await findUserByTechnicianId(technicianId);
    if (!found) return;

    const title = "Job Reassigned to You";
    const body = `Job reassigned to you: ${vehicleName}`;

    await sendExpoPushNotification([
      {
        to: found.token,
        title,
        body,
        data: { jobId, screen: "job" },
        sound: "default",
        priority: "high",
      },
    ]);

    await persistNotification(found.id, title, body, { jobId });
  } catch {
    // Non-critical — don't let notification failures break job routes
  }
}

/**
 * Sends a "Job Removed" notification to the technician whose assignment was cleared.
 */
export async function notifyJobUnassigned(
  previousTechnicianId: string,
  jobId: string,
  vehicleName: string
): Promise<void> {
  try {
    const found = await findUserByTechnicianId(previousTechnicianId);
    if (!found) return;

    const title = "Job Removed";
    const body = `${vehicleName} has been removed from your queue`;

    await sendExpoPushNotification([
      {
        to: found.token,
        title,
        body,
        data: { jobId, screen: "job" },
        sound: "default",
        priority: "high",
      },
    ]);

    await persistNotification(found.id, title, body, { jobId });
  } catch {
    // Non-critical — don't let notification failures break job routes
  }
}

const INSPECTION_TYPE_LABELS: Record<string, string> = {
  "pre-inspection": "Pre-Inspection (PDI)",
  "secondary": "Secondary Check",
  "final-quality": "Final Quality Check",
  "new-arrival": "New Arrival PDI",
  "used-arrival": "Used Arrival PDI",
  "periodic-fluid": "Periodic — Fluid Check",
  "periodic-damage": "Periodic — Damage Scan",
  "start-and-run": "Start & Run Cycle",
};
