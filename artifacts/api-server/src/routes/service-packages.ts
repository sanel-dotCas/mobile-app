import { Router } from "express";
import multer from "multer";
import * as XLSX from "xlsx";
import { db, servicePackagesTable, servicePackageLinesTable } from "@workspace/db";
import { eq, asc } from "drizzle-orm";

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

async function getPackagesWithLines() {
  const packages = await db
    .select()
    .from(servicePackagesTable)
    .where(eq(servicePackagesTable.isActive, true))
    .orderBy(asc(servicePackagesTable.id));

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
    const packages = await getPackagesWithLines();
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

export default router;
