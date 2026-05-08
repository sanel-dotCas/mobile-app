import { Router } from "express";
import multer from "multer";
import * as XLSX from "xlsx";
import { db, servicePackagesTable, servicePackageLinesTable, servicePackageDeploymentsTable, yardLocationsTable } from "@workspace/db";
import { eq, asc, and, inArray, sql } from "drizzle-orm";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// ── Seed helpers ──────────────────────────────────────────────────────────────

const HARDCODED_PACKAGES = [
  {
    name: "Full Front Impact",
    icon: "alert-triangle",
    color: "#dc2626",
    description: "Bonnet, bumper, headlights, radiator check",
    lines: [
      { lineType: "labor" as const, laborCategory: "body",      description: "Bonnet repair / skin replacement",          hours: "4.0",  unitPrice: "95", displayOrder: 1 },
      { lineType: "labor" as const, laborCategory: "body",      description: "Front bumper removal & refit",              hours: "1.5",  unitPrice: "95", displayOrder: 2 },
      { lineType: "labor" as const, laborCategory: "refinish",  description: "Bonnet refinish — prime, base & clear",     hours: "3.0",  unitPrice: "95", displayOrder: 3 },
      { lineType: "labor" as const, laborCategory: "mechanical",description: "Radiator & cooling system check",           hours: "1.0",  unitPrice: "95", displayOrder: 4 },
      { lineType: "part"  as const, laborCategory: null,        description: "Front bumper assembly (OEM)",               quantity: "1", unitPrice: "450", displayOrder: 5 },
      { lineType: "material" as const, laborCategory: null,     description: "Paint & refinish materials — front",        quantity: "1", unitPrice: "195", displayOrder: 6 },
    ],
  },
  {
    name: "Side Swipe Repair",
    icon: "arrow-right",
    color: "#2563eb",
    description: "Door skin, quarter panel, mirror, blend",
    lines: [
      { lineType: "labor" as const, laborCategory: "body",     description: "Door skin replacement",                    hours: "3.5", unitPrice: "95", displayOrder: 1 },
      { lineType: "labor" as const, laborCategory: "body",     description: "Quarter panel repair / partial sectioning", hours: "2.5", unitPrice: "95", displayOrder: 2 },
      { lineType: "labor" as const, laborCategory: "trim",     description: "Mirror housing replacement",               hours: "0.5", unitPrice: "95", displayOrder: 3 },
      { lineType: "labor" as const, laborCategory: "refinish", description: "Door & quarter panel refinish with blend", hours: "4.0", unitPrice: "95", displayOrder: 4 },
      { lineType: "part" as const, laborCategory: null,        description: "Door skin panel",                           quantity: "1", unitPrice: "320", displayOrder: 5 },
      { lineType: "part" as const, laborCategory: null,        description: "Mirror housing assembly",                   quantity: "1", unitPrice: "185", displayOrder: 6 },
      { lineType: "material" as const, laborCategory: null,    description: "Paint materials — door & quarter",          quantity: "1", unitPrice: "170", displayOrder: 7 },
    ],
  },
  {
    name: "Rear Impact Package",
    icon: "arrow-left",
    color: "#7c3aed",
    description: "Boot lid, bumper, tail lights, structural check",
    lines: [
      { lineType: "labor" as const, laborCategory: "body",     description: "Boot lid removal & replacement",                hours: "2.5", unitPrice: "95", displayOrder: 1 },
      { lineType: "labor" as const, laborCategory: "body",     description: "Rear bumper removal & refit",                   hours: "1.5", unitPrice: "95", displayOrder: 2 },
      { lineType: "labor" as const, laborCategory: "frame",    description: "Chassis rail inspection & minor straightening", hours: "2.0", unitPrice: "95", displayOrder: 3 },
      { lineType: "labor" as const, laborCategory: "refinish", description: "Boot lid & bumper refinish",                    hours: "3.0", unitPrice: "95", displayOrder: 4 },
      { lineType: "part" as const, laborCategory: null,        description: "Boot lid assembly (OEM)",                       quantity: "1", unitPrice: "870", displayOrder: 5 },
      { lineType: "part" as const, laborCategory: null,        description: "Rear bumper assembly",                          quantity: "1", unitPrice: "420", displayOrder: 6 },
      { lineType: "material" as const, laborCategory: null,    description: "Paint materials — rear section",                quantity: "1", unitPrice: "185", displayOrder: 7 },
    ],
  },
  {
    name: "Windshield Replacement",
    icon: "eye",
    color: "#0891b2",
    description: "Glass, adhesive, ADAS camera recalibration",
    lines: [
      { lineType: "labor" as const, laborCategory: "glass",      description: "Windshield removal & replacement",    hours: "2.0", unitPrice: "95", displayOrder: 1 },
      { lineType: "labor" as const, laborCategory: "electrical", description: "ADAS forward camera recalibration",  hours: "1.0", unitPrice: "95", displayOrder: 2 },
      { lineType: "part" as const, laborCategory: null,          description: "OEM windshield",                      quantity: "1", unitPrice: "650", displayOrder: 3 },
      { lineType: "material" as const, laborCategory: null,      description: "Windshield adhesive kit & primer",    quantity: "1", unitPrice: "45",  displayOrder: 4 },
    ],
  },
  {
    name: "Single Panel Repaint",
    icon: "droplet",
    color: "#7c3aed",
    description: "Full prep, prime, base coat, clear coat",
    lines: [
      { lineType: "labor" as const, laborCategory: "refinish", description: "Panel preparation & feather edge",       hours: "1.5", unitPrice: "95", displayOrder: 1 },
      { lineType: "labor" as const, laborCategory: "refinish", description: "2K primer application & sanding",        hours: "1.0", unitPrice: "95", displayOrder: 2 },
      { lineType: "labor" as const, laborCategory: "refinish", description: "Base coat & clear coat application",     hours: "2.0", unitPrice: "95", displayOrder: 3 },
      { lineType: "material" as const, laborCategory: null,    description: "2K primer, base, clear coat & hardener", quantity: "1", unitPrice: "165", displayOrder: 4 },
      { lineType: "material" as const, laborCategory: null,    description: "Masking, thinners & sundries",           quantity: "1", unitPrice: "45",  displayOrder: 5 },
    ],
  },
  {
    name: "Mechanical Safety Check",
    icon: "settings",
    color: "#d97706",
    description: "Brakes, fluids, steering, wheel alignment",
    lines: [
      { lineType: "labor" as const, laborCategory: "mechanical", description: "Brake system inspection & pad check", hours: "1.0", unitPrice: "95", displayOrder: 1 },
      { lineType: "labor" as const, laborCategory: "mechanical", description: "Steering & suspension inspection",    hours: "0.5", unitPrice: "95", displayOrder: 2 },
      { lineType: "labor" as const, laborCategory: "mechanical", description: "Four-wheel alignment check",          hours: "0.5", unitPrice: "95", displayOrder: 3 },
      { lineType: "labor" as const, laborCategory: "mechanical", description: "All fluid levels top-up",             hours: "0.5", unitPrice: "95", displayOrder: 4 },
    ],
  },
];

let seeded = false;
async function seedIfEmpty() {
  if (seeded) return;
  const [existing] = await db.select({ id: servicePackagesTable.id }).from(servicePackagesTable).limit(1);
  if (!existing) {
    for (const pkg of HARDCODED_PACKAGES) {
      const [inserted] = await db
        .insert(servicePackagesTable)
        .values({ name: pkg.name, icon: pkg.icon, color: pkg.color, description: pkg.description })
        .onConflictDoNothing()
        .returning();
      if (inserted) {
        await db.insert(servicePackageLinesTable).values(
          pkg.lines.map((l) => ({ ...l, packageId: inserted.id }))
        );
      }
    }
  }
  seeded = true;
}

export async function seedServicePackages() {
  await seedIfEmpty();
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function getPackagesWithLines(locationId?: number) {
  let packages;
  if (locationId) {
    // Only return packages that have an active deployment to this location
    const deployments = await db
      .select({ packageId: servicePackageDeploymentsTable.packageId })
      .from(servicePackageDeploymentsTable)
      .where(
        and(
          eq(servicePackageDeploymentsTable.locationId, locationId),
          eq(servicePackageDeploymentsTable.isActive, true)
        )
      );
    const packageIds = deployments.map((d) => d.packageId);
    if (packageIds.length === 0) {
      return [];
    }
    packages = await db
      .select()
      .from(servicePackagesTable)
      .where(and(eq(servicePackagesTable.isActive, true), inArray(servicePackagesTable.id, packageIds)))
      .orderBy(asc(servicePackagesTable.id));
  } else {
    packages = await db
      .select()
      .from(servicePackagesTable)
      .where(eq(servicePackagesTable.isActive, true))
      .orderBy(asc(servicePackagesTable.id));
  }

  const lines = await db
    .select()
    .from(servicePackageLinesTable)
    .orderBy(asc(servicePackageLinesTable.packageId), asc(servicePackageLinesTable.displayOrder));

  return packages.map((pkg) => ({
    ...pkg,
    lines: lines.filter((l) => l.packageId === pkg.id),
  }));
}

// ── GET /api/service-packages ─────────────────────────────────────────────────

router.get("/service-packages", async (req, res) => {
  await seedIfEmpty();
  try {
    const locationId = req.query.locationId ? Number(req.query.locationId) : undefined;
    const packages = await getPackagesWithLines(locationId);
    res.json({ packages });
  } catch (err) {
    req.log.error(err, "Failed to fetch service packages");
    res.status(500).json({ error: "Failed to fetch service packages" });
  }
});

// ── GET /api/service-packages/template ───────────────────────────────────────

router.get("/service-packages/template", (_req, res) => {
  const wb = XLSX.utils.book_new();

  const packagesData = [
    ["PackageName", "Icon", "Color", "Description"],
    ["Full Front Impact", "alert-triangle", "#dc2626", "Bonnet, bumper, headlights, radiator check"],
  ];
  const packagesSheet = XLSX.utils.aoa_to_sheet(packagesData);
  packagesSheet["!freeze"] = { xSplit: 0, ySplit: 1 };
  packagesSheet["!cols"] = [{ wch: 30 }, { wch: 20 }, { wch: 12 }, { wch: 45 }];
  XLSX.utils.book_append_sheet(wb, packagesSheet, "Packages");

  const linesData = [
    ["PackageName", "LineType", "LaborCategory", "Description", "Hours", "Quantity", "UnitPrice", "DisplayOrder"],
    ["Full Front Impact", "labor", "body", "Bonnet repair / skin replacement", 4.0, "", 95, 1],
    ["Full Front Impact", "part", "", "Front bumper assembly (OEM)", "", 1, 450, 2],
    ["Full Front Impact", "material", "", "Paint & refinish materials — front", "", 1, 195, 3],
  ];
  const linesSheet = XLSX.utils.aoa_to_sheet(linesData);
  linesSheet["!freeze"] = { xSplit: 0, ySplit: 1 };
  linesSheet["!cols"] = [
    { wch: 30 }, { wch: 12 }, { wch: 16 }, { wch: 45 },
    { wch: 8 }, { wch: 10 }, { wch: 12 }, { wch: 14 },
  ];
  XLSX.utils.book_append_sheet(wb, linesSheet, "Lines");

  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  res.setHeader("Content-Disposition", 'attachment; filename="service-packages-template.xlsx"');
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.send(buf);
});

// ── GET /api/service-packages/deployments ─────────────────────────────────────

router.get("/service-packages/deployments", async (req, res) => {
  try {
    const locationId = req.query.locationId ? Number(req.query.locationId) : undefined;
    const conditions = [eq(servicePackageDeploymentsTable.isActive, true)];
    if (locationId) {
      conditions.push(eq(servicePackageDeploymentsTable.locationId, locationId));
    }
    const deployments = await db
      .select({
        id: servicePackageDeploymentsTable.id,
        packageId: servicePackageDeploymentsTable.packageId,
        locationId: servicePackageDeploymentsTable.locationId,
        isActive: servicePackageDeploymentsTable.isActive,
        deployedAt: servicePackageDeploymentsTable.deployedAt,
        deployedBy: servicePackageDeploymentsTable.deployedBy,
        locationName: yardLocationsTable.name,
        packageName: servicePackagesTable.name,
      })
      .from(servicePackageDeploymentsTable)
      .leftJoin(yardLocationsTable, eq(yardLocationsTable.id, servicePackageDeploymentsTable.locationId))
      .leftJoin(servicePackagesTable, eq(servicePackagesTable.id, servicePackageDeploymentsTable.packageId))
      .where(conditions.length === 1 ? conditions[0] : and(...conditions as [typeof conditions[0], ...typeof conditions]));
    res.json({ deployments });
  } catch (err) {
    req.log.error(err, "Failed to fetch deployments");
    res.status(500).json({ error: "Failed to fetch deployments" });
  }
});

// ── POST /api/service-packages/deployments ────────────────────────────────────

router.post("/service-packages/deployments", async (req, res) => {
  const { packageId, locationId, deployedBy } = req.body as {
    packageId?: number;
    locationId?: number;
    deployedBy?: string;
  };
  if (!packageId || !locationId) {
    res.status(400).json({ error: "packageId and locationId are required" });
    return;
  }
  try {
    // DB-level upsert — unique index on (package_id, location_id) guarantees
    // at most one row per package+location pair even under concurrent requests.
    const [deployment] = await db
      .insert(servicePackageDeploymentsTable)
      .values({ packageId, locationId, isActive: true, deployedBy: deployedBy ?? null })
      .onConflictDoUpdate({
        target: [servicePackageDeploymentsTable.packageId, servicePackageDeploymentsTable.locationId],
        set: { isActive: true, deployedAt: sql`now()`, deployedBy: deployedBy ?? null },
      })
      .returning();
    res.status(201).json({ deployment });
  } catch (err) {
    req.log.error(err, "Failed to create deployment");
    res.status(500).json({ error: "Failed to create deployment" });
  }
});

// ── DELETE /api/service-packages/deployments/:id ──────────────────────────────

router.delete("/service-packages/deployments/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  try {
    const [updated] = await db
      .update(servicePackageDeploymentsTable)
      .set({ isActive: false })
      .where(eq(servicePackageDeploymentsTable.id, id))
      .returning({ id: servicePackageDeploymentsTable.id });
    if (!updated) {
      res.status(404).json({ error: "Deployment not found" });
      return;
    }
    res.json({ ok: true });
  } catch (err) {
    req.log.error(err, "Failed to deactivate deployment");
    res.status(500).json({ error: "Failed to deactivate deployment" });
  }
});

// ── GET /api/service-packages/:id ────────────────────────────────────────────

router.get("/service-packages/:id", async (req, res) => {
  await seedIfEmpty();
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }
    const [pkg] = await db.select().from(servicePackagesTable).where(eq(servicePackagesTable.id, id));
    if (!pkg) {
      res.status(404).json({ error: "Package not found" });
      return;
    }
    const lines = await db
      .select()
      .from(servicePackageLinesTable)
      .where(eq(servicePackageLinesTable.packageId, id))
      .orderBy(asc(servicePackageLinesTable.displayOrder));
    res.json({ ...pkg, lines });
  } catch (err) {
    req.log.error(err, "Failed to fetch service package");
    res.status(500).json({ error: "Failed to fetch service package" });
  }
});

// ── POST /api/service-packages/upload ────────────────────────────────────────

const VALID_LINE_TYPES = ["labor", "part", "material"];
const VALID_LABOR_CATEGORIES = ["body", "refinish", "mechanical", "frame", "glass", "electrical", "trim", "other"];

router.post("/service-packages/upload", upload.single("file"), async (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: "No file uploaded" });
    return;
  }

  const errors: string[] = [];
  let imported = 0;
  let updated = 0;

  try {
    const wb = XLSX.read(req.file.buffer, { type: "buffer" });

    const packagesSheet = wb.Sheets["Packages"];
    const linesSheet = wb.Sheets["Lines"];

    if (!packagesSheet) {
      res.status(400).json({ error: "Missing 'Packages' sheet in workbook" });
      return;
    }
    if (!linesSheet) {
      res.status(400).json({ error: "Missing 'Lines' sheet in workbook" });
      return;
    }

    type PkgRow = { PackageName?: string; Icon?: string; Color?: string; Description?: string };
    type LineRow = {
      PackageName?: string; LineType?: string; LaborCategory?: string;
      Description?: string; Hours?: number | string; Quantity?: number | string;
      UnitPrice?: number | string; DisplayOrder?: number | string;
    };

    const pkgRows: PkgRow[] = XLSX.utils.sheet_to_json(packagesSheet, { defval: "" });
    const lineRows: LineRow[] = XLSX.utils.sheet_to_json(linesSheet, { defval: "" });

    // Validate + collect packages
    const validPackages: Map<string, { icon: string; color: string; description: string }> = new Map();
    for (let i = 0; i < pkgRows.length; i++) {
      const row = pkgRows[i];
      const rowNum = i + 2;
      const name = String(row.PackageName ?? "").trim();
      if (!name) {
        errors.push(`Packages row ${rowNum}: PackageName is required`);
        continue;
      }
      validPackages.set(name, {
        icon: String(row.Icon ?? "package").trim() || "package",
        color: String(row.Color ?? "#2563eb").trim() || "#2563eb",
        description: String(row.Description ?? "").trim(),
      });
    }

    // Validate lines
    type ValidLine = {
      packageName: string;
      lineType: "labor" | "part" | "material";
      laborCategory: string | null;
      description: string;
      hours: string | null;
      quantity: string | null;
      unitPrice: string;
      displayOrder: number;
    };

    const validLines: ValidLine[] = [];
    for (let i = 0; i < lineRows.length; i++) {
      const row = lineRows[i];
      const rowNum = i + 2;
      const pkgName = String(row.PackageName ?? "").trim();
      const lineType = String(row.LineType ?? "").trim().toLowerCase();
      const desc = String(row.Description ?? "").trim();

      if (!pkgName) { errors.push(`Lines row ${rowNum}: PackageName is required`); continue; }
      if (!validPackages.has(pkgName)) {
        errors.push(`Lines row ${rowNum}: PackageName "${pkgName}" is not defined in the Packages sheet`);
        continue;
      }
      if (!VALID_LINE_TYPES.includes(lineType)) {
        errors.push(`Lines row ${rowNum}: LineType must be labor/part/material, got "${lineType}"`);
        continue;
      }
      if (!desc) { errors.push(`Lines row ${rowNum}: Description is required`); continue; }

      const laborCategory = String(row.LaborCategory ?? "").trim().toLowerCase() || null;
      if (lineType === "labor" && laborCategory && !VALID_LABOR_CATEGORIES.includes(laborCategory)) {
        errors.push(`Lines row ${rowNum}: LaborCategory "${laborCategory}" is not valid. Use: ${VALID_LABOR_CATEGORIES.join(", ")}`);
        continue;
      }

      const unitPriceRaw = row.UnitPrice;
      const unitPrice = unitPriceRaw !== "" && unitPriceRaw !== undefined ? Number(unitPriceRaw) : 0;
      if (isNaN(unitPrice) || unitPrice < 0) {
        errors.push(`Lines row ${rowNum}: UnitPrice must be a non-negative number`);
        continue;
      }

      const hoursRaw = row.Hours;
      const hours = hoursRaw !== "" && hoursRaw !== undefined ? Number(hoursRaw) : null;
      if (hours !== null && (isNaN(hours) || hours < 0)) {
        errors.push(`Lines row ${rowNum}: Hours must be a non-negative number`);
        continue;
      }

      const qtyRaw = row.Quantity;
      const quantity = qtyRaw !== "" && qtyRaw !== undefined ? Number(qtyRaw) : null;
      if (quantity !== null && (isNaN(quantity) || quantity < 0)) {
        errors.push(`Lines row ${rowNum}: Quantity must be a non-negative number`);
        continue;
      }

      const displayOrder = Number(row.DisplayOrder ?? 0) || 0;

      validLines.push({
        packageName: pkgName,
        lineType: lineType as "labor" | "part" | "material",
        laborCategory: laborCategory || null,
        description: desc,
        hours: hours !== null ? String(hours) : null,
        quantity: quantity !== null ? String(quantity) : null,
        unitPrice: String(unitPrice),
        displayOrder,
      });
    }

    // Upsert packages and their lines
    for (const [name, meta] of validPackages) {
      const existing = await db
        .select({ id: servicePackagesTable.id })
        .from(servicePackagesTable)
        .where(eq(servicePackagesTable.name, name))
        .limit(1);

      let packageId: number;

      if (existing.length > 0) {
        packageId = existing[0].id;
        await db
          .update(servicePackagesTable)
          .set({ icon: meta.icon, color: meta.color, description: meta.description, updatedAt: new Date() })
          .where(eq(servicePackagesTable.id, packageId));
        updated++;
      } else {
        const [inserted] = await db
          .insert(servicePackagesTable)
          .values({ name, icon: meta.icon, color: meta.color, description: meta.description })
          .returning();
        packageId = inserted.id;
        imported++;
      }

      // Replace lines for this package
      const pkgLines = validLines.filter((l) => l.packageName === name);
      if (pkgLines.length > 0) {
        await db.delete(servicePackageLinesTable).where(eq(servicePackageLinesTable.packageId, packageId));
        await db.insert(servicePackageLinesTable).values(
          pkgLines.map((l) => ({
            packageId,
            lineType: l.lineType,
            laborCategory: l.laborCategory,
            description: l.description,
            hours: l.hours,
            quantity: l.quantity,
            unitPrice: l.unitPrice,
            displayOrder: l.displayOrder,
          }))
        );
      }
    }

    seeded = true;

    res.json({ imported, updated, errors });
  } catch (err) {
    req.log.error(err, "Failed to process service package upload");
    res.status(500).json({ error: "Failed to process upload" });
  }
});

// ── POST /api/service-packages/import-menu-kits ───────────────────────────────
// Parses the brand/model Excel format used by dealerships.
// The format has model blocks separated by "Model" header rows.
// Each block has 3 tier columns with bundle codes and a parts list.
//
// Query param ?commit=false (default) → preview only (no DB writes)
// Query param ?commit=true → upsert packages + lines

router.post("/service-packages/import-menu-kits", upload.single("file"), async (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: "No file uploaded" });
    return;
  }

  const commit = req.query.commit === "true";

  try {
    const wb = XLSX.read(req.file.buffer, { type: "buffer", cellText: true, cellNF: false });

    // Use first sheet
    const sheetName = wb.SheetNames[0];
    if (!sheetName) {
      res.status(400).json({ error: "Empty workbook" });
      return;
    }
    const sheet = wb.Sheets[sheetName];
    const rows: string[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", raw: false }) as string[][];

    // ── Parse model blocks ───────────────────────────────────────────────────
    // The sheet structure:
    // Row N:   "Model" | <model_code> | ...
    // Row N+1: interval header row — col indices 2,3,4 have interval labels (e.g. "1.1yr")
    // Row N+2: bundle code row — col indices 2,3,4 have bundle codes
    // Row N+3+: data rows — col0=part_description, col1=part_number, col2/3/4=qty (or "x") if included in that tier
    // Block ends when next "Model" row or end of sheet.

    type TierPreview = {
      interval: string;
      bundleCode: string;
      partCount: number;
    };

    type ModelBlock = {
      modelCode: string;
      tiers: TierPreview[];
      rowStart: number;
    };

    type ParsedPackage = {
      name: string;
      vehicleModel: string;
      serviceInterval: string;
      bundleCode: string;
      partCount: number;
      lines: Array<{
        lineType: "part";
        description: string;
        partNumber: string;
        quantity: string;
      }>;
    };

    const errors: string[] = [];
    const parsedPackages: ParsedPackage[] = [];
    const modelBlocks: ModelBlock[] = [];

    // Find all "Model" header rows
    const modelRowIndices: number[] = [];
    for (let r = 0; r < rows.length; r++) {
      const row = rows[r];
      if (row && String(row[0] ?? "").trim().toLowerCase() === "model") {
        modelRowIndices.push(r);
      }
    }

    if (modelRowIndices.length === 0) {
      res.status(400).json({ error: "No model blocks found. Expected rows with 'Model' in column A." });
      return;
    }

    for (let blockIdx = 0; blockIdx < modelRowIndices.length; blockIdx++) {
      const blockStart = modelRowIndices[blockIdx];
      const blockEnd = blockIdx + 1 < modelRowIndices.length ? modelRowIndices[blockIdx + 1] : rows.length;

      const modelRow = rows[blockStart];
      const modelCode = String(modelRow[1] ?? "").trim();
      if (!modelCode) {
        errors.push(`Row ${blockStart + 1}: Model row missing model code in column B`);
        continue;
      }

      // Header row (blockStart+1): interval labels in cols 2,3,4
      const headerRow = rows[blockStart + 1] ?? [];
      // Bundle code row (blockStart+2): bundle codes in cols 2,3,4
      const bundleRow = rows[blockStart + 2] ?? [];

      // Detect how many tier columns (2, 3, or 4) based on non-empty bundle codes
      const tierCols: number[] = [];
      for (const colIdx of [2, 3, 4, 5, 6]) {
        const bundleCode = String(bundleRow[colIdx] ?? "").trim();
        if (bundleCode) tierCols.push(colIdx);
      }

      if (tierCols.length === 0) {
        errors.push(`Model "${modelCode}" (row ${blockStart + 1}): No bundle codes found in columns C-G of the bundle code row`);
        continue;
      }

      const tiers = tierCols.map((colIdx) => ({
        colIdx,
        interval: (() => {
          const raw = String(headerRow[colIdx] ?? "").trim() || `Tier ${colIdx - 1}`;
          return /yr$/i.test(raw) ? raw : `${raw}yr`;
        })(),
        bundleCode: String(bundleRow[colIdx] ?? "").trim(),
        lines: [] as Array<{ description: string; partNumber: string; quantity: string }>,
      }));

      // Data rows: blockStart+3 to blockEnd-1
      for (let r = blockStart + 3; r < blockEnd; r++) {
        const dataRow = rows[r];
        if (!dataRow) continue;
        const desc = String(dataRow[0] ?? "").trim();
        const partNumber = String(dataRow[1] ?? "").trim();
        if (!desc) continue; // skip blank rows

        for (const tier of tiers) {
          const cellVal = String(dataRow[tier.colIdx] ?? "").trim();
          if (cellVal && cellVal !== "0" && cellVal.toLowerCase() !== "") {
            // Non-empty cell means this part is included in this tier
            const qty = /^\d/.test(cellVal) ? cellVal : "1";
            tier.lines.push({ description: desc, partNumber, quantity: qty });
          }
        }
      }

      modelBlocks.push({
        modelCode,
        rowStart: blockStart,
        tiers: tiers.map((t) => ({ interval: t.interval, bundleCode: t.bundleCode, partCount: t.lines.length })),
      });

      // Build parsed packages
      for (const tier of tiers) {
        if (tier.lines.length === 0) continue; // skip empty tiers
        const packageName = `${modelCode} — ${tier.interval} (${tier.bundleCode})`;
        parsedPackages.push({
          name: packageName,
          vehicleModel: modelCode,
          serviceInterval: tier.interval,
          bundleCode: tier.bundleCode,
          partCount: tier.lines.length,
          lines: tier.lines.map((l) => ({
            lineType: "part" as const,
            description: l.description,
            partNumber: l.partNumber,
            quantity: l.quantity,
          })),
        });
      }
    }

    // Return preview if not committing
    const preview = modelBlocks.map((b) => ({
      modelCode: b.modelCode,
      tiers: b.tiers,
    }));

    if (!commit) {
      res.json({
        preview,
        packageCount: parsedPackages.length,
        errors,
      });
      return;
    }

    // ── Commit: upsert packages + lines ─────────────────────────────────────
    let created = 0;
    let updatedCount = 0;

    for (const pkg of parsedPackages) {
      const [existing] = await db
        .select({ id: servicePackagesTable.id })
        .from(servicePackagesTable)
        .where(eq(servicePackagesTable.name, pkg.name))
        .limit(1);

      let packageId: number;
      if (existing) {
        packageId = existing.id;
        await db
          .update(servicePackagesTable)
          .set({
            vehicleModel: pkg.vehicleModel,
            serviceInterval: pkg.serviceInterval,
            bundleCode: pkg.bundleCode,
            updatedAt: new Date(),
          })
          .where(eq(servicePackagesTable.id, packageId));
        updatedCount++;
      } else {
        const [inserted] = await db
          .insert(servicePackagesTable)
          .values({
            name: pkg.name,
            icon: "package",
            color: "#2563eb",
            description: `${pkg.vehicleModel} service kit — ${pkg.serviceInterval} interval`,
            vehicleModel: pkg.vehicleModel,
            serviceInterval: pkg.serviceInterval,
            bundleCode: pkg.bundleCode,
          })
          .returning();
        packageId = inserted.id;
        created++;
      }

      // Replace lines
      await db.delete(servicePackageLinesTable).where(eq(servicePackageLinesTable.packageId, packageId));
      if (pkg.lines.length > 0) {
        await db.insert(servicePackageLinesTable).values(
          pkg.lines.map((l, idx) => ({
            packageId,
            lineType: l.lineType,
            description: l.description,
            quantity: l.quantity,
            unitPrice: "0",
            displayOrder: idx + 1,
          }))
        );
      }
    }

    seeded = true;

    res.json({
      preview,
      packageCount: parsedPackages.length,
      created,
      updated: updatedCount,
      errors,
    });
  } catch (err) {
    req.log.error(err, "Failed to process menu kits import");
    res.status(500).json({ error: "Failed to process import" });
  }
});

export default router;
