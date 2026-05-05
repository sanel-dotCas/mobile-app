import { db } from "@workspace/db";
import { yardUsersTable, techniciansTable } from "@workspace/db";
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

/**
 * Looks up a yard user by the assignedTo string which may be either:
 * - A full name ("Mike Rodriguez") when set via auto-assign/generate from yard web app
 * - A username/code (e.g. "MR") when set via mobile app technician code
 */
async function findUserByAssignment(assignedTo: string) {
  const [user] = await db
    .select({
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

  await sendExpoPushNotification([
    {
      to: user.expoPushToken,
      title: "New Inspection Assigned",
      body: `${vehicleName}${locationPart} — ${typeLabel}`,
      data: { inspectionId, screen: "inspection" },
      sound: "default",
      priority: "high",
    },
  ]);
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
      name: yardUsersTable.name,
      username: yardUsersTable.username,
      expoPushToken: yardUsersTable.expoPushToken,
      notificationsEnabled: yardUsersTable.notificationsEnabled,
    })
    .from(yardUsersTable);

  // Build a lookup map indexed by both name and username
  const tokenMap = new Map<string, string>();
  for (const u of allUsers) {
    if (!u.expoPushToken || !u.notificationsEnabled) continue;
    tokenMap.set(u.name, u.expoPushToken);
    tokenMap.set(u.username, u.expoPushToken);
  }

  const messages: PushMessage[] = [];
  for (const a of assignments) {
    const token = tokenMap.get(a.technicianName);
    if (!token) continue;
    const typeLabel = INSPECTION_TYPE_LABELS[a.inspectionType] ?? a.inspectionType;
    const locationPart = a.locationName ? ` · ${a.locationName}` : "";
    messages.push({
      to: token,
      title: "New Inspection Assigned",
      body: `${a.vehicleName}${locationPart} — ${typeLabel}`,
      data: { inspectionId: a.inspectionId, screen: "inspection" },
      sound: "default",
      priority: "high",
    });
  }

  await sendExpoPushNotification(messages);
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

  await sendExpoPushNotification([
    {
      to: user.expoPushToken,
      title: "Inspection Reassigned",
      body: `${vehicleName}${locationPart} — ${typeLabel} has been reassigned to another technician`,
      data: { inspectionId, screen: "inspection" },
      sound: "default",
      priority: "high",
    },
  ]);
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

  await sendExpoPushNotification([
    {
      to: user.expoPushToken,
      title: "Inspection Removed",
      body: `${vehicleName}${locationPart} — ${typeLabel} has been removed from your queue`,
      data: { inspectionId, screen: "inspection" },
      sound: "default",
      priority: "high",
    },
  ]);
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
  const messages: PushMessage[] = supervisors
    .filter((u) => u.expoPushToken && u.notificationsEnabled)
    .map((u) => ({
      to: u.expoPushToken!,
      title: `⚠️ Inspection Failed Items (${failedCount})`,
      body: `${vehicleName}${locationPart} — ${typeLabel}${techPart}. ${failedCount} item${failedCount !== 1 ? "s" : ""} failed. Review required.`,
      data: { inspectionId, screen: "inspection" },
      sound: "default" as const,
      priority: "high" as const,
    }));

  await sendExpoPushNotification(messages);
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
    const [tech] = await db
      .select({ userCode: techniciansTable.userCode })
      .from(techniciansTable)
      .where(eq(techniciansTable.id, technicianId))
      .limit(1);

    if (!tech?.userCode) return;

    const [user] = await db
      .select({
        expoPushToken: yardUsersTable.expoPushToken,
        notificationsEnabled: yardUsersTable.notificationsEnabled,
      })
      .from(yardUsersTable)
      .where(eq(yardUsersTable.userCode, tech.userCode))
      .limit(1);

    if (!user || !user.expoPushToken || !user.notificationsEnabled) return;

    await sendExpoPushNotification([
      {
        to: user.expoPushToken,
        title: "New Job Assigned",
        body: `New job assigned: ${vehicleName}`,
        data: { jobId, screen: "job" },
        sound: "default",
        priority: "high",
      },
    ]);
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
