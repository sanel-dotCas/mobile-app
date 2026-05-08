import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  yardUsersTable,
  yardLocationsTable,
  yardVehiclesTable,
  yardInspectionsTable,
  yardMovementsTable,
  servicePackagesTable,
  servicePackageLinesTable,
  servicePackageDeploymentsTable,
  dmsAccountTypesTable,
  systemSettingsTable,
} from "@workspace/db";
import { techniciansTable } from "@workspace/db";
import { jobsTable } from "@workspace/db";
import { eq, count, desc, sql, and, or } from "drizzle-orm";
import { hashPassword } from "../lib/passwordHash";
import { getNotificationRetentionDays } from "../lib/notificationCleanup";

const router: IRouter = Router();

// ── Stats ────────────────────────────────────────────────────────────────────
router.get("/admin/stats", async (req, res) => {
  try {
    const { locationId } = req.query as Record<string, string>;
    const locId = locationId && locationId !== "all" ? Number(locationId) : null;
    const vWhere = locId ? eq(yardVehiclesTable.locationId, locId) : undefined;
    const iWhere = locId ? eq(yardInspectionsTable.locationId, locId) : undefined;
    const uWhere = locId ? eq(yardUsersTable.locationId, locId) : undefined;

    const [
      vehicleRows,
      inspectionRows,
      jobRows,
      technicianRows,
      userRows,
      locationRows,
      servicePackageRows,
    ] = await Promise.all([
      db.select({ status: yardVehiclesTable.status, cnt: count() })
        .from(yardVehiclesTable)
        .where(vWhere)
        .groupBy(yardVehiclesTable.status),
      db.select({ status: yardInspectionsTable.status, cnt: count() })
        .from(yardInspectionsTable)
        .where(iWhere)
        .groupBy(yardInspectionsTable.status),
      db.select({ status: jobsTable.status, cnt: count() })
        .from(jobsTable)
        .groupBy(jobsTable.status),
      db.select({ cnt: count() }).from(techniciansTable),
      db.select({ cnt: count() }).from(yardUsersTable).where(uWhere),
      db.select({ cnt: count() }).from(yardLocationsTable),
      db.select({ cnt: count() }).from(servicePackagesTable),
    ]);

    const vehicleByStatus: Record<string, number> = {};
    let totalVehicles = 0;
    for (const r of vehicleRows) {
      vehicleByStatus[r.status] = Number(r.cnt);
      totalVehicles += Number(r.cnt);
    }

    const inspectionByStatus: Record<string, number> = {};
    let totalInspections = 0;
    for (const r of inspectionRows) {
      inspectionByStatus[r.status] = Number(r.cnt);
      totalInspections += Number(r.cnt);
    }

    const jobByStatus: Record<string, number> = {};
    let totalJobs = 0;
    for (const r of jobRows) {
      jobByStatus[r.status] = Number(r.cnt);
      totalJobs += Number(r.cnt);
    }

    res.json({
      vehicles: { total: totalVehicles, byStatus: vehicleByStatus },
      inspections: { total: totalInspections, byStatus: inspectionByStatus },
      jobs: { total: totalJobs, byStatus: jobByStatus },
      technicians: Number(technicianRows[0]?.cnt ?? 0),
      users: Number(userRows[0]?.cnt ?? 0),
      locations: Number(locationRows[0]?.cnt ?? 0),
      servicePackages: Number(servicePackageRows[0]?.cnt ?? 0),
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch stats" });
  }
});

// ── Activity feed ─────────────────────────────────────────────────────────────
router.get("/admin/activity", async (req, res) => {
  try {
    const { locationId } = req.query as Record<string, string>;
    const locId = locationId && locationId !== "all" ? Number(locationId) : null;
    const whereClause = locId ? eq(yardMovementsTable.locationId, locId) : undefined;
    const movements = await db
      .select()
      .from(yardMovementsTable)
      .where(whereClause)
      .orderBy(desc(yardMovementsTable.createdAt))
      .limit(30);
    res.json({ activity: movements });
  } catch {
    res.status(500).json({ error: "Failed to fetch activity" });
  }
});

// ── Yard Users ────────────────────────────────────────────────────────────────
router.get("/admin/users", async (_req, res) => {
  try {
    const users = await db
      .select({
        id: yardUsersTable.id,
        username: yardUsersTable.username,
        name: yardUsersTable.name,
        role: yardUsersTable.role,
        locationId: yardUsersTable.locationId,
        notificationsEnabled: yardUsersTable.notificationsEnabled,
        expoPushToken: yardUsersTable.expoPushToken,
        createdAt: yardUsersTable.createdAt,
      })
      .from(yardUsersTable)
      .orderBy(yardUsersTable.name);
    res.json(users);
  } catch {
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

router.post("/admin/users", async (req, res) => {
  const { username, password, name, role, locationId } = req.body as {
    username?: string; password?: string; name?: string;
    role?: string; locationId?: number | null;
  };
  if (!username || !password || !name || !role) {
    res.status(400).json({ error: "username, password, name, role are required" });
    return;
  }
  const validRoles = ["admin", "yard_manager", "yard_operator"];
  if (!validRoles.includes(role)) {
    res.status(400).json({ error: "Invalid role" });
    return;
  }
  try {
    const [user] = await db
      .insert(yardUsersTable)
      .values({
        username,
        password: hashPassword(password),
        name,
        role: role as "admin" | "yard_manager" | "yard_operator",
        locationId: locationId ?? null,
      })
      .returning({
        id: yardUsersTable.id,
        username: yardUsersTable.username,
        name: yardUsersTable.name,
        role: yardUsersTable.role,
        locationId: yardUsersTable.locationId,
        notificationsEnabled: yardUsersTable.notificationsEnabled,
        createdAt: yardUsersTable.createdAt,
      });
    res.status(201).json(user);
  } catch (err: any) {
    if (err?.message?.includes("unique")) {
      res.status(409).json({ error: "Username already exists" });
    } else {
      res.status(500).json({ error: "Failed to create user" });
    }
  }
});

router.patch("/admin/users/:id", async (req, res) => {
  const id = Number(req.params.id);
  const { name, role, locationId, notificationsEnabled, password } = req.body as {
    name?: string; role?: string; locationId?: number | null;
    notificationsEnabled?: boolean; password?: string;
  };
  const validRoles = ["admin", "yard_manager", "yard_operator"];
  if (role && !validRoles.includes(role)) {
    res.status(400).json({ error: "Invalid role" });
    return;
  }
  try {
    const updates: Record<string, unknown> = {};
    if (name !== undefined) updates.name = name;
    if (role !== undefined) updates.role = role;
    if (locationId !== undefined) updates.locationId = locationId;
    if (notificationsEnabled !== undefined) updates.notificationsEnabled = notificationsEnabled;
    if (password !== undefined) updates.password = hashPassword(password);

    const [user] = await db
      .update(yardUsersTable)
      .set(updates)
      .where(eq(yardUsersTable.id, id))
      .returning({
        id: yardUsersTable.id,
        username: yardUsersTable.username,
        name: yardUsersTable.name,
        role: yardUsersTable.role,
        locationId: yardUsersTable.locationId,
        notificationsEnabled: yardUsersTable.notificationsEnabled,
        createdAt: yardUsersTable.createdAt,
      });
    if (!user) { res.status(404).json({ error: "User not found" }); return; }
    res.json(user);
  } catch {
    res.status(500).json({ error: "Failed to update user" });
  }
});

router.delete("/admin/users/:id", async (req, res) => {
  const id = Number(req.params.id);
  try {
    const [deleted] = await db
      .delete(yardUsersTable)
      .where(eq(yardUsersTable.id, id))
      .returning({ id: yardUsersTable.id });
    if (!deleted) { res.status(404).json({ error: "User not found" }); return; }
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Failed to delete user" });
  }
});

// ── Technicians ───────────────────────────────────────────────────────────────
router.get("/admin/technicians", async (_req, res) => {
  try {
    const techs = await db
      .select()
      .from(techniciansTable)
      .orderBy(techniciansTable.name);
    res.json(techs);
  } catch {
    res.status(500).json({ error: "Failed to fetch technicians" });
  }
});

router.post("/admin/technicians", async (req, res) => {
  const { id, name, role, avatar, userCode, specializations, status } = req.body as {
    id?: string; name?: string; role?: string; avatar?: string;
    userCode?: string; specializations?: string[]; status?: string;
  };
  if (!id || !name || !role || !userCode) {
    res.status(400).json({ error: "id, name, role, userCode are required" });
    return;
  }
  try {
    const [tech] = await db
      .insert(techniciansTable)
      .values({
        id,
        name,
        role,
        avatar: avatar ?? "👤",
        userCode,
        specializations: specializations ?? [],
        status: status ?? "idle",
      })
      .returning();
    res.status(201).json(tech);
  } catch (err: any) {
    if (err?.message?.includes("unique")) {
      res.status(409).json({ error: "Technician ID or user code already exists" });
    } else {
      res.status(500).json({ error: "Failed to create technician" });
    }
  }
});

router.patch("/admin/technicians/:id", async (req, res) => {
  const id = req.params.id;
  const { name, role, avatar, specializations, status } = req.body as {
    name?: string; role?: string; avatar?: string;
    specializations?: string[]; status?: string;
  };
  try {
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (name !== undefined) updates.name = name;
    if (role !== undefined) updates.role = role;
    if (avatar !== undefined) updates.avatar = avatar;
    if (specializations !== undefined) updates.specializations = specializations;
    if (status !== undefined) updates.status = status;

    const [tech] = await db
      .update(techniciansTable)
      .set(updates)
      .where(eq(techniciansTable.id, id))
      .returning();
    if (!tech) { res.status(404).json({ error: "Technician not found" }); return; }
    res.json(tech);
  } catch {
    res.status(500).json({ error: "Failed to update technician" });
  }
});

router.delete("/admin/technicians/:id", async (req, res) => {
  const id = req.params.id;
  try {
    const [deleted] = await db
      .delete(techniciansTable)
      .where(eq(techniciansTable.id, id))
      .returning({ id: techniciansTable.id });
    if (!deleted) { res.status(404).json({ error: "Technician not found" }); return; }
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Failed to delete technician" });
  }
});

// ── Roles & Permissions ───────────────────────────────────────────────────────
// All available permission keys
const ALL_PERMISSIONS = [
  "view_pricing",
  "move_vehicles",
  "create_inspections",
  "manage_users",
  "view_reports",
  "configure_settings",
  "view_all_locations",
  "view_yard",
  "manage_technicians",
  "manage_jobs",
  "manage_parts",
  "manage_service_packages",
  "view_accounting",
  "manage_accounting",
  "view_hr",
  "manage_hr",
];

const YARD_ROLE_PERMISSIONS: Record<string, string[]> = {
  admin: ["view_pricing", "move_vehicles", "create_inspections", "manage_users", "view_reports", "configure_settings", "view_all_locations", "manage_technicians", "manage_jobs", "manage_parts", "manage_service_packages"],
  yard_manager: ["view_pricing", "move_vehicles", "create_inspections", "view_reports", "view_all_locations", "manage_technicians"],
  yard_operator: ["move_vehicles", "create_inspections"],
};

const DMS_ROLE_PERMISSIONS: Record<string, string[]> = {
  supervisor: ["view_pricing", "view_yard", "create_inspections", "view_reports", "manage_technicians"],
  technician: ["view_yard", "create_inspections"],
  estimator: ["view_yard"],
};

router.get("/admin/roles", (_req, res) => {
  res.json({
    availablePermissions: ALL_PERMISSIONS,
    yardRoles: YARD_ROLE_PERMISSIONS,
    dmsRoles: DMS_ROLE_PERMISSIONS,
    yardRoleNames: ["admin", "yard_manager", "yard_operator"],
    dmsRoleNames: ["supervisor", "technician", "estimator"],
  });
});

// ── Locations ─────────────────────────────────────────────────────────────────
router.get("/admin/locations", async (_req, res) => {
  try {
    const locations = await db
      .select()
      .from(yardLocationsTable)
      .orderBy(yardLocationsTable.name);
    res.json(locations);
  } catch {
    res.status(500).json({ error: "Failed to fetch locations" });
  }
});

// ── Service Packages ──────────────────────────────────────────────────────────
router.get("/admin/service-packages", async (_req, res) => {
  try {
    const pkgs = await db
      .select({
        id: servicePackagesTable.id,
        name: servicePackagesTable.name,
        icon: servicePackagesTable.icon,
        color: servicePackagesTable.color,
        description: servicePackagesTable.description,
        isActive: servicePackagesTable.isActive,
        vehicleModel: servicePackagesTable.vehicleModel,
        serviceInterval: servicePackagesTable.serviceInterval,
        bundleCode: servicePackagesTable.bundleCode,
        createdAt: servicePackagesTable.createdAt,
        lineCount: count(servicePackageLinesTable.id),
      })
      .from(servicePackagesTable)
      .leftJoin(servicePackageLinesTable, eq(servicePackageLinesTable.packageId, servicePackagesTable.id))
      .groupBy(servicePackagesTable.id)
      .orderBy(servicePackagesTable.name);
    res.json(pkgs);
  } catch {
    res.status(500).json({ error: "Failed to fetch service packages" });
  }
});

router.post("/admin/service-packages", async (req, res) => {
  const {
    name, vehicleModel, serviceInterval, bundleCode,
    icon, color, description, lines,
  } = req.body as {
    name?: string;
    vehicleModel?: string;
    serviceInterval?: string;
    bundleCode?: string;
    icon?: string;
    color?: string;
    description?: string;
    lines?: Array<{
      lineType: "labor" | "part" | "material";
      laborCategory?: string;
      description: string;
      hours?: string;
      quantity?: string;
      unitPrice?: string;
      displayOrder?: number;
    }>;
  };

  if (!name?.trim()) {
    res.status(400).json({ error: "name is required" });
    return;
  }

  try {
    const [pkg] = await db
      .insert(servicePackagesTable)
      .values({
        name: name.trim(),
        icon: icon ?? "package",
        color: color ?? "#2563eb",
        description: description ?? "",
        vehicleModel: vehicleModel ?? null,
        serviceInterval: serviceInterval ?? null,
        bundleCode: bundleCode ?? null,
      })
      .returning();

    if (lines && lines.length > 0) {
      await db.insert(servicePackageLinesTable).values(
        lines.map((l, idx) => ({
          packageId: pkg.id,
          lineType: l.lineType,
          laborCategory: l.laborCategory ?? null,
          description: l.description,
          hours: l.hours ?? null,
          quantity: l.quantity ?? null,
          unitPrice: l.unitPrice ?? "0",
          displayOrder: l.displayOrder ?? idx + 1,
        }))
      );
    }

    const packageLines = await db
      .select()
      .from(servicePackageLinesTable)
      .where(eq(servicePackageLinesTable.packageId, pkg.id))
      .orderBy(servicePackageLinesTable.displayOrder);

    res.status(201).json({ ...pkg, lines: packageLines });
  } catch (err: any) {
    if (err?.message?.includes("unique")) {
      res.status(409).json({ error: "A package with this name already exists" });
    } else {
      res.status(500).json({ error: "Failed to create service package" });
    }
  }
});

// GET /admin/service-packages/:id — fetch single package with lines
router.get("/admin/service-packages/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!id) { res.status(400).json({ error: "Invalid id" }); return; }
  try {
    const [pkg] = await db.select().from(servicePackagesTable).where(eq(servicePackagesTable.id, id));
    if (!pkg) { res.status(404).json({ error: "Not found" }); return; }
    const lines = await db
      .select()
      .from(servicePackageLinesTable)
      .where(eq(servicePackageLinesTable.packageId, id))
      .orderBy(servicePackageLinesTable.displayOrder);
    res.json({ ...pkg, lines });
  } catch {
    res.status(500).json({ error: "Failed to fetch service package" });
  }
});

// PATCH /admin/service-packages/:id — update package and replace lines
router.patch("/admin/service-packages/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!id) { res.status(400).json({ error: "Invalid id" }); return; }
  const {
    name, vehicleModel, serviceInterval, bundleCode,
    icon, color, description, isActive, lines,
  } = req.body as {
    name?: string;
    vehicleModel?: string | null;
    serviceInterval?: string | null;
    bundleCode?: string | null;
    icon?: string;
    color?: string;
    description?: string;
    isActive?: boolean;
    lines?: Array<{
      lineType: "labor" | "part" | "material";
      laborCategory?: string;
      description: string;
      hours?: string;
      quantity?: string;
      unitPrice?: string;
      displayOrder?: number;
    }>;
  };

  if (name !== undefined && !name.trim()) {
    res.status(400).json({ error: "name cannot be empty" });
    return;
  }

  try {
    const updateValues: Record<string, unknown> = { updatedAt: new Date() };
    if (name !== undefined) updateValues.name = name.trim();
    if (vehicleModel !== undefined) updateValues.vehicleModel = vehicleModel?.trim() || null;
    if (serviceInterval !== undefined) updateValues.serviceInterval = serviceInterval?.trim() || null;
    if (bundleCode !== undefined) updateValues.bundleCode = bundleCode?.trim() || null;
    if (icon !== undefined) updateValues.icon = icon;
    if (color !== undefined) updateValues.color = color;
    if (description !== undefined) updateValues.description = description;
    if (isActive !== undefined) updateValues.isActive = isActive;

    const [pkg] = await db
      .update(servicePackagesTable)
      .set(updateValues)
      .where(eq(servicePackagesTable.id, id))
      .returning();

    if (!pkg) { res.status(404).json({ error: "Not found" }); return; }

    if (lines !== undefined) {
      await db.delete(servicePackageLinesTable).where(eq(servicePackageLinesTable.packageId, id));
      if (lines.length > 0) {
        await db.insert(servicePackageLinesTable).values(
          lines.map((l, idx) => ({
            packageId: id,
            lineType: l.lineType,
            laborCategory: l.laborCategory ?? null,
            description: l.description,
            hours: l.hours ?? null,
            quantity: l.quantity ?? null,
            unitPrice: l.unitPrice ?? "0",
            displayOrder: l.displayOrder ?? idx + 1,
          }))
        );
      }
    }

    const updatedLines = await db
      .select()
      .from(servicePackageLinesTable)
      .where(eq(servicePackageLinesTable.packageId, id))
      .orderBy(servicePackageLinesTable.displayOrder);

    res.json({ ...pkg, lines: updatedLines });
  } catch (err: any) {
    if (err?.message?.includes("unique")) {
      res.status(409).json({ error: "A package with this name already exists" });
    } else {
      res.status(500).json({ error: "Failed to update service package" });
    }
  }
});

// ── Delete service package ────────────────────────────────────────────────────
router.delete("/admin/service-packages/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!id) { res.status(400).json({ error: "Invalid id" }); return; }
  try {
    await db.delete(servicePackageLinesTable).where(eq(servicePackageLinesTable.packageId, id));
    await db.delete(servicePackageDeploymentsTable).where(eq(servicePackageDeploymentsTable.packageId, id));
    const [deleted] = await db
      .delete(servicePackagesTable)
      .where(eq(servicePackagesTable.id, id))
      .returning({ id: servicePackagesTable.id });
    if (!deleted) {
      res.status(404).json({ error: "Package not found" });
      return;
    }
    res.json({ ok: true });
  } catch (err) {
    req.log.error(err, "Failed to delete service package");
    res.status(500).json({ error: "Failed to delete service package" });
  }
});

// ── Account Types ─────────────────────────────────────────────────────────────
router.get("/admin/account-types", async (_req, res) => {
  try {
    const types = await db
      .select()
      .from(dmsAccountTypesTable)
      .orderBy(dmsAccountTypesTable.displayOrder);
    res.json(types);
  } catch {
    res.status(500).json({ error: "Failed to fetch account types" });
  }
});

router.post("/admin/account-types", async (req, res) => {
  const { name, code, displayOrder } = req.body as { name?: string; code?: string; displayOrder?: number };
  if (!name || !code) {
    res.status(400).json({ error: "name and code are required" });
    return;
  }
  try {
    const [type] = await db
      .insert(dmsAccountTypesTable)
      .values({ name, code, displayOrder: displayOrder ?? 0, isActive: true })
      .returning();
    res.status(201).json(type);
  } catch (err: any) {
    if (err?.message?.includes("unique")) {
      res.status(409).json({ error: "Code already exists" });
    } else {
      res.status(500).json({ error: "Failed to create account type" });
    }
  }
});

router.patch("/admin/account-types/:id", async (req, res) => {
  const id = Number(req.params.id);
  const { name, isActive, displayOrder } = req.body as { name?: string; isActive?: boolean; displayOrder?: number };
  try {
    const updates: Record<string, unknown> = {};
    if (name !== undefined) updates.name = name;
    if (isActive !== undefined) updates.isActive = isActive;
    if (displayOrder !== undefined) updates.displayOrder = displayOrder;
    const [type] = await db
      .update(dmsAccountTypesTable)
      .set(updates)
      .where(eq(dmsAccountTypesTable.id, id))
      .returning();
    if (!type) { res.status(404).json({ error: "Account type not found" }); return; }
    res.json(type);
  } catch {
    res.status(500).json({ error: "Failed to update account type" });
  }
});

router.delete("/admin/account-types/:id", async (req, res) => {
  const id = Number(req.params.id);
  try {
    const [deleted] = await db
      .delete(dmsAccountTypesTable)
      .where(eq(dmsAccountTypesTable.id, id))
      .returning({ id: dmsAccountTypesTable.id });
    if (!deleted) { res.status(404).json({ error: "Account type not found" }); return; }
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Failed to delete account type" });
  }
});

// ── Vehicles monitor (summary) ────────────────────────────────────────────────
router.get("/admin/monitor/vehicles", async (req, res) => {
  try {
    const { limit = "20", page = "1", locationId, status } = req.query as Record<string, string>;
    const offset = (Number(page) - 1) * Number(limit);
    const locFilter = locationId && locationId !== "all" ? eq(yardVehiclesTable.locationId, Number(locationId)) : undefined;
    const statusFilter = status && status !== "all" ? eq(yardVehiclesTable.status, status as "available" | "in_transit" | "pdi_pending" | "sold") : undefined;
    const whereClause = locFilter && statusFilter ? and(locFilter, statusFilter) : locFilter ?? statusFilter;
    const [vehicles, total] = await Promise.all([
      db.select().from(yardVehiclesTable)
        .where(whereClause)
        .orderBy(desc(yardVehiclesTable.createdAt))
        .limit(Number(limit))
        .offset(offset),
      db.select({ cnt: count() }).from(yardVehiclesTable).where(whereClause),
    ]);
    res.json({ vehicles, total: Number(total[0]?.cnt ?? 0) });
  } catch {
    res.status(500).json({ error: "Failed to fetch vehicles" });
  }
});

// ── Inspections monitor (summary) ─────────────────────────────────────────────
router.get("/admin/monitor/inspections", async (req, res) => {
  try {
    const { limit = "20", page = "1", status, locationId } = req.query as Record<string, string>;
    const offset = (Number(page) - 1) * Number(limit);
    const statusFilter = status && status !== "all"
      ? eq(yardInspectionsTable.status, status as "finished" | "in-progress" | "queued")
      : undefined;
    const locFilter = locationId && locationId !== "all"
      ? eq(yardInspectionsTable.locationId, Number(locationId))
      : undefined;
    const whereClause = statusFilter && locFilter ? and(statusFilter, locFilter) : statusFilter ?? locFilter;
    const [inspections, total] = await Promise.all([
      db.select().from(yardInspectionsTable)
        .where(whereClause)
        .orderBy(desc(yardInspectionsTable.createdAt))
        .limit(Number(limit))
        .offset(offset),
      db.select({ cnt: count() }).from(yardInspectionsTable).where(whereClause),
    ]);
    res.json({ inspections, total: Number(total[0]?.cnt ?? 0) });
  } catch {
    res.status(500).json({ error: "Failed to fetch inspections" });
  }
});

// ── Jobs monitor ──────────────────────────────────────────────────────────────
router.get("/admin/monitor/jobs", async (req, res) => {
  try {
    const { limit = "20", page = "1" } = req.query as Record<string, string>;
    const offset = (Number(page) - 1) * Number(limit);
    const [jobs, total] = await Promise.all([
      db.select({
        id: jobsTable.id,
        estimateNumber: jobsTable.estimateNumber,
        licensePlate: jobsTable.licensePlate,
        vehicleMake: jobsTable.vehicleMake,
        vehicleModel: jobsTable.vehicleModel,
        vehicleYear: jobsTable.vehicleYear,
        status: jobsTable.status,
        progress: jobsTable.progress,
        assignedTechnicianId: jobsTable.assignedTechnicianId,
        serviceAdvisor: jobsTable.serviceAdvisor,
        appointmentDate: jobsTable.appointmentDate,
        createdAt: jobsTable.createdAt,
      }).from(jobsTable)
        .orderBy(desc(jobsTable.createdAt))
        .limit(Number(limit))
        .offset(offset),
      db.select({ cnt: count() }).from(jobsTable),
    ]);
    res.json({ jobs, total: Number(total[0]?.cnt ?? 0) });
  } catch {
    res.status(500).json({ error: "Failed to fetch jobs" });
  }
});

// ── Notification retention setting ────────────────────────────────────────────
router.get("/admin/settings/notification-retention", async (_req, res) => {
  try {
    const days = await getNotificationRetentionDays();
    res.json({ notificationRetentionDays: days });
  } catch {
    res.status(500).json({ error: "Failed to read notification retention setting" });
  }
});

router.put("/admin/settings/notification-retention", async (req, res) => {
  const { days } = req.body as { days?: unknown };
  const parsed = typeof days === "number" ? days : parseInt(String(days), 10);
  if (Number.isNaN(parsed) || !Number.isInteger(parsed) || parsed < 1 || parsed > 3650) {
    res.status(400).json({ error: "days must be a whole number between 1 and 3650" });
    return;
  }
  try {
    await db
      .insert(systemSettingsTable)
      .values({ key: "notification_retention_days", value: String(parsed) })
      .onConflictDoUpdate({
        target: systemSettingsTable.key,
        set: { value: String(parsed), updatedAt: new Date() },
      });
    res.json({ notificationRetentionDays: parsed });
  } catch {
    res.status(500).json({ error: "Failed to update notification retention setting" });
  }
});

// ── System settings (static/info) ─────────────────────────────────────────────
router.get("/admin/settings", async (_req, res) => {
  const [userCount, techCount, vehicleCount, mobileUsers] = await Promise.all([
    db.select({ cnt: count() }).from(yardUsersTable),
    db.select({ cnt: count() }).from(techniciansTable),
    db.select({ cnt: count() }).from(yardVehiclesTable),
    db
      .select({ code: yardUsersTable.userCode, role: yardUsersTable.mobileRole })
      .from(yardUsersTable)
      .where(sql`${yardUsersTable.userCode} is not null and ${yardUsersTable.mobileRole} is not null`)
      .orderBy(yardUsersTable.mobileRole, yardUsersTable.userCode),
  ]).catch(() => [[{ cnt: 0 }], [{ cnt: 0 }], [{ cnt: 0 }], []]);

  res.json({
    yardRoles: ["admin", "yard_manager", "yard_operator"],
    dmsRoles: ["technician", "supervisor", "estimator", "parts", "admin"],
    mobileCredentials: (mobileUsers as { code: string | null; role: string | null }[])
      .filter(u => u.code && u.role)
      .map(u => ({ code: u.code!, role: u.role! })),
    dbInfo: {
      users: Number((userCount as {cnt: unknown}[])[0]?.cnt ?? 0),
      technicians: Number((techCount as {cnt: unknown}[])[0]?.cnt ?? 0),
      vehicles: Number((vehicleCount as {cnt: unknown}[])[0]?.cnt ?? 0),
    },
    inspectionTypes: [
      { key: "pre-inspection", label: "Pre-Inspection" },
      { key: "secondary", label: "Secondary" },
      { key: "final-quality", label: "Final Quality" },
      { key: "new-arrival", label: "New Arrival PDI" },
      { key: "used-arrival", label: "Used Arrival PDI" },
      { key: "periodic-fluid", label: "Periodic — Fluid Check" },
      { key: "periodic-damage", label: "Periodic — Damage Scan" },
      { key: "start-and-run", label: "Start & Run Cycle" },
    ],
    defaultInspectionIntervalDays: 30,
    notificationsEnabled: true,
    version: "1.0.0",
    modules: [
      { id: "inventory", label: "Inventory", enabled: true },
      { id: "yard", label: "Yard Management", enabled: true },
      { id: "jobs", label: "Workshop Jobs", enabled: true },
      { id: "inspections", label: "PDI Inspections", enabled: true },
      { id: "estimates", label: "Damage Estimates", enabled: true },
      { id: "parts", label: "Parts & Procurement", enabled: true },
      { id: "service-packages", label: "Service Packages", enabled: true },
      { id: "mobile", label: "Mobile App", enabled: true },
    ],
  });
});

export default router;
