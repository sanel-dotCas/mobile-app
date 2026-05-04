import { Router } from "express";
import { db, jobOdometerCorrectionsTable, jobsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { formatVehicleName } from "../lib/formatVehicleName";

const router = Router();

function parseVehicleString(vehicle: string): { year?: string; make?: string; model?: string } {
  const parts = vehicle.trim().split(/\s+/);
  if (parts.length === 0) return {};
  const [year, make, ...modelParts] = parts;
  return { year, make, model: modelParts.join(" ") || undefined };
}

const SEED_JOBS = [
  {
    id: "job-001", estimateNumber: "#00095", licensePlate: "Sert432",
    vehicleYear: "1995", vehicleMake: "BMW", vehicleModel: "325",
    serviceAdvisor: "Sanel Hodzic",
    totalEstimatedHours: "3.50", workedHours: "1.25",
    customerNotes: "Customer requested synthetic oil. Please check tire pressure.",
    odometer: 129500, appointmentDate: "2026-04-30T16:00:00Z",
    status: "in_progress", thumbnail: null, progress: 36, assignedTechnicianId: "tech-001",
    currentStageId: "stage-003",
    stageHistory: [
      { stageId: "stage-001", enteredAt: "2026-05-04T00:00:00Z" },
      { stageId: "stage-002", enteredAt: "2026-05-04T01:00:00Z" },
      { stageId: "stage-003", enteredAt: "2026-05-04T03:00:00Z" },
    ],
    tasks: [
      {
        id: "task-001", title: "Oil Change", type: "Repair", laborType: "MECHANICAL",
        status: "done", estimatedHours: 1.0, workedHours: 0.75,
        description: "Full synthetic oil change with filter replacement",
        technician: "Mike Rodriguez",
        notes: [{ id: "tn-001", author: "Mike Rodriguez", text: "Used Castrol Edge 5W-30. Filter replaced.", timestamp: "2026-04-30T10:30:00Z", subject: "Oil Change Complete" }],
        clockedIn: false, clockInStart: null, elapsedSeconds: 2700,
        parts: [
          { id: "part-001", name: "Engine Oil 5W-30 (5L)", partNumber: "OIL-5W30-5L", quantity: 1, unit: "bottle", status: "received", price: 45.00, receivedAt: "2026-04-30T09:00:00Z" },
          { id: "part-002", name: "Oil Filter", partNumber: "OF-BMW-325", quantity: 1, unit: "pcs", status: "received", price: 12.50, receivedAt: "2026-04-30T09:00:00Z" },
        ],
      },
      {
        id: "task-002", title: "Brake Inspection", type: "Inspection", laborType: "MECHANICAL",
        status: "in_progress", estimatedHours: 1.5, workedHours: 0.5,
        description: "Full brake system inspection — pads, rotors, calipers, lines",
        technician: "Mike Rodriguez", notes: [], clockedIn: false, clockInStart: null, elapsedSeconds: 1800,
        parts: [
          { id: "part-003", name: "Front Brake Pads Set", partNumber: "BP-BMW-F325", quantity: 1, unit: "set", status: "ordered", price: 78.00 },
          { id: "part-004", name: "Brake Rotor Front (x2)", partNumber: "BR-BMW-325-F", quantity: 2, unit: "pcs", status: "pending", price: 95.00 },
        ],
      },
      {
        id: "task-003", title: "Electrical Diagnostic", type: "Other", laborType: "ELECTRICAL",
        status: "pending", estimatedHours: 1.0, workedHours: 0.0,
        description: "Check all electrical systems and fault codes",
        technician: "Mike Rodriguez", notes: [], clockedIn: false, clockInStart: null, elapsedSeconds: 0,
        parts: [],
      },
    ],
    notes: [
      { id: "jn-001", author: "Sanel Hodzic", text: "Customer called to confirm appointment. Waiting for parts.", timestamp: "2026-04-29T09:00:00Z", subject: "Appointment Confirmed" },
      { id: "jn-002", author: "Mike Rodriguez", text: "Vehicle checked in. Starting with oil change.", timestamp: "2026-04-30T09:15:00Z", subject: "Work Started" },
    ],
    inspections: [
      { id: "ins-001", title: "Tire Tread Depth", status: "pass", estimatedHours: 0.2, notes: "All tires within spec — 5mm+ remaining" },
      { id: "ins-002", title: "Fluid Levels", status: "fail", estimatedHours: 0.3, notes: "Coolant low — requires top-up. Power steering fluid also low." },
      { id: "ins-003", title: "Battery Load Test", status: "pending", estimatedHours: 0.2, notes: "" },
      { id: "ins-004", title: "Engine Belt Condition", status: "pass", estimatedHours: 0.25, notes: "No cracking or glazing observed" },
      { id: "ins-005", title: "Brake Line Visual Check", status: "pending", estimatedHours: 0.3, notes: "" },
      { id: "ins-006", title: "Suspension & Steering Play", status: "pass", estimatedHours: 0.25, notes: "No excessive play detected" },
      { id: "ins-007", title: "Wiper Blade Condition", status: "fail", estimatedHours: 0.1, notes: "Both blades streaking — recommend replacement" },
      { id: "ins-008", title: "Exhaust System Visual", status: "pending", estimatedHours: 0.2, notes: "" },
    ],
  },
  {
    id: "job-002", estimateNumber: "#00102", licensePlate: "ABC123",
    vehicleYear: "2019", vehicleMake: "Toyota", vehicleModel: "Camry",
    serviceAdvisor: "Rachel Green",
    totalEstimatedHours: "2.00", workedHours: "0.00",
    customerNotes: "Squealing brakes when stopping.",
    odometer: 45200, appointmentDate: "2026-04-30T14:00:00Z",
    status: "pending", thumbnail: null, progress: 0, assignedTechnicianId: "tech-004",
    currentStageId: "stage-001",
    stageHistory: [{ stageId: "stage-001", enteredAt: "2026-05-04T06:00:00Z" }],
    tasks: [
      {
        id: "task-004", title: "Brake Pad Replacement", type: "Repair", laborType: "MECHANICAL",
        status: "pending", estimatedHours: 2.0, workedHours: 0.0,
        description: "Replace front and rear brake pads",
        technician: "Ahmed Hassan", notes: [], clockedIn: false, clockInStart: null, elapsedSeconds: 0,
        parts: [
          { id: "part-005", name: "Front Brake Pad Set", partNumber: "BP-TOY-CAM-F", quantity: 1, unit: "set", status: "ordered", price: 65.00 },
          { id: "part-006", name: "Rear Brake Pad Set", partNumber: "BP-TOY-CAM-R", quantity: 1, unit: "set", status: "pending", price: 55.00 },
          { id: "part-007", name: "Brake Cleaner Spray", partNumber: "BC-SPRAY-500", quantity: 1, unit: "can", status: "received", price: 8.00, receivedAt: "2026-04-30T08:00:00Z" },
        ],
      },
    ],
    notes: [],
    inspections: [{ id: "ins-005", title: "Brake Pad Thickness", status: "fail", estimatedHours: 0.2, notes: "Front pads at 2mm - replacement needed" }],
  },
  {
    id: "job-003", estimateNumber: "#00088", licensePlate: "XYZ789",
    vehicleYear: "2021", vehicleMake: "Honda", vehicleModel: "Accord",
    serviceAdvisor: "David Kim",
    totalEstimatedHours: "1.50", workedHours: "1.50",
    customerNotes: "Routine service.", odometer: 22100,
    appointmentDate: "2026-04-29T10:00:00Z",
    status: "completed", thumbnail: null, progress: 100, assignedTechnicianId: "tech-001",
    currentStageId: "stage-005",
    stageHistory: [
      { stageId: "stage-001", enteredAt: "2026-04-29T08:00:00Z" },
      { stageId: "stage-002", enteredAt: "2026-04-29T08:30:00Z" },
      { stageId: "stage-003", enteredAt: "2026-04-29T09:00:00Z" },
      { stageId: "stage-004", enteredAt: "2026-04-29T10:30:00Z" },
      { stageId: "stage-005", enteredAt: "2026-04-29T11:00:00Z" },
    ],
    tasks: [
      {
        id: "task-005", title: "Tire Rotation", type: "Repair", laborType: "MECHANICAL",
        status: "done", estimatedHours: 0.75, workedHours: 0.75,
        description: "Rotate all four tires",
        technician: "Mike Rodriguez", notes: [], clockedIn: false, clockInStart: null, elapsedSeconds: 2700,
        parts: [],
      },
      {
        id: "task-006", title: "Multi-Point Inspection", type: "Inspection", laborType: "DIAGNOSTIC",
        status: "done", estimatedHours: 0.75, workedHours: 0.75,
        description: "Full vehicle inspection",
        technician: "Mike Rodriguez", notes: [], clockedIn: false, clockInStart: null, elapsedSeconds: 2700,
        parts: [],
      },
    ],
    notes: [{ id: "jn-003", author: "David Kim", text: "All work completed. Vehicle ready for pickup.", timestamp: "2026-04-29T11:45:00Z", subject: "Job Complete" }],
    inspections: [{ id: "ins-006", title: "All Systems Check", status: "pass", estimatedHours: 0.5, notes: "Vehicle in excellent condition" }],
  },
  {
    id: "job-004", estimateNumber: "#00110", licensePlate: "DEF456",
    vehicleYear: "2022", vehicleMake: "Ford", vehicleModel: "F-150",
    serviceAdvisor: "Sanel Hodzic",
    totalEstimatedHours: "4.00", workedHours: "0.00",
    customerNotes: "Check engine light on. Rough idle.", odometer: 31800,
    appointmentDate: "2026-05-01T09:00:00Z",
    status: "pending", thumbnail: null, progress: 0, assignedTechnicianId: null,
    currentStageId: "stage-001",
    stageHistory: [{ stageId: "stage-001", enteredAt: "2026-05-04T07:00:00Z" }],
    tasks: [
      {
        id: "task-007", title: "Diagnostic Scan", type: "Inspection", laborType: "ELECTRICAL",
        status: "pending", estimatedHours: 1.0, workedHours: 0.0,
        description: "OBD-II diagnostic scan and analysis",
        technician: "Mike Rodriguez", notes: [], clockedIn: false, clockInStart: null, elapsedSeconds: 0,
        parts: [],
      },
      {
        id: "task-008", title: "Spark Plug Replacement", type: "Repair", laborType: "ELECTRICAL",
        status: "pending", estimatedHours: 3.0, workedHours: 0.0,
        description: "Replace all 8 spark plugs",
        technician: "Mike Rodriguez", notes: [], clockedIn: false, clockInStart: null, elapsedSeconds: 0,
        parts: [
          { id: "part-008", name: "Spark Plug (x8)", partNumber: "SP-FORD-F150-V8", quantity: 8, unit: "pcs", status: "ordered", price: 14.50 },
          { id: "part-009", name: "Ignition Coil Set", partNumber: "IC-FORD-V8-SET", quantity: 1, unit: "set", status: "pending", price: 185.00 },
        ],
      },
    ],
    notes: [],
    inspections: [
      { id: "ins-f01", title: "OBD-II Fault Code Analysis", status: "pending", estimatedHours: 0.5, notes: "P0301 misfire cylinder 1 — correlates with rough idle complaint" },
      { id: "ins-f02", title: "Air Filter Condition", status: "fail", estimatedHours: 0.1, notes: "Heavily soiled — recommend replacement" },
      { id: "ins-f03", title: "Spark Plug Visual (all 8)", status: "pending", estimatedHours: 0.5, notes: "Will inspect once plugs removed during replacement" },
      { id: "ins-f04", title: "Throttle Body Inspection", status: "pending", estimatedHours: 0.25, notes: "" },
      { id: "ins-f05", title: "Fuel Injector Spray Pattern", status: "pending", estimatedHours: 0.5, notes: "" },
      { id: "ins-f06", title: "Ignition Coil Resistance Test", status: "pending", estimatedHours: 0.5, notes: "Test all 8 coils — suspected coil on cyl 1" },
    ],
  },
  {
    id: "job-005", estimateNumber: "#00098", licensePlate: "GHI012",
    vehicleYear: "2023", vehicleMake: "Tesla", vehicleModel: "Model 3",
    serviceAdvisor: "Rachel Green",
    totalEstimatedHours: "0.50", workedHours: "0.25",
    customerNotes: "Charging port issue.", odometer: 8900,
    appointmentDate: "2026-04-30T11:00:00Z",
    status: "in_progress", thumbnail: null, progress: 50, assignedTechnicianId: "tech-002",
    currentStageId: "stage-002",
    stageHistory: [
      { stageId: "stage-001", enteredAt: "2026-05-04T04:00:00Z" },
      { stageId: "stage-002", enteredAt: "2026-05-04T05:00:00Z" },
    ],
    tasks: [
      {
        id: "task-009", title: "Charging Port Inspection", type: "Inspection", laborType: "ELECTRICAL",
        status: "in_progress", estimatedHours: 0.5, workedHours: 0.25,
        description: "Inspect and clean charging port contacts",
        technician: "James Wilson", notes: [], clockedIn: false, clockInStart: null, elapsedSeconds: 900,
        parts: [
          { id: "part-010", name: "Charging Port Connector", partNumber: "CP-TESLA-M3", quantity: 1, unit: "pcs", status: "pending", price: 320.00 },
        ],
      },
    ],
    notes: [],
    inspections: [],
  },
  {
    id: "job-006", estimateNumber: "#00115", licensePlate: "MNO234",
    vehicleYear: "2020", vehicleMake: "Mazda", vehicleModel: "6",
    serviceAdvisor: "Rachel Green",
    totalEstimatedHours: "2.50", workedHours: "0.50",
    customerNotes: "Intermittent ABS warning. Also reports front-left wheel bearing noise at speed.",
    odometer: 52300,
    appointmentDate: "2026-05-02T10:00:00Z",
    status: "on_hold", thumbnail: null, progress: 20, assignedTechnicianId: "tech-003",
    currentStageId: "stage-002",
    stageHistory: [
      { stageId: "stage-001", enteredAt: "2026-05-04T02:00:00Z" },
      { stageId: "stage-002", enteredAt: "2026-05-04T03:00:00Z" },
    ],
    tasks: [
      {
        id: "task-010", title: "ABS System Diagnosis", type: "Inspection", laborType: "ELECTRICAL",
        status: "in_progress", estimatedHours: 1.5, workedHours: 0.5,
        description: "OBD-II scan + ABS sensor resistance test on all four corners",
        technician: "Carlos Mendez", notes: [], clockedIn: false, clockInStart: null, elapsedSeconds: 1800,
        parts: [
          { id: "part-011", name: "ABS Wheel Speed Sensor FR", partNumber: "ABS-MAZ6-FR", quantity: 1, unit: "pcs", status: "ordered", price: 65.00 },
        ],
      },
      {
        id: "task-011", title: "Wheel Bearing Inspection", type: "Inspection", laborType: "MECHANICAL",
        status: "pending", estimatedHours: 1.0, workedHours: 0.0,
        description: "Inspect front-left wheel bearing for play, roughness, and noise",
        technician: "Carlos Mendez", notes: [], clockedIn: false, clockInStart: null, elapsedSeconds: 0,
        parts: [],
      },
    ],
    notes: [
      { id: "jn-007", author: "Rachel Green", text: "Job on hold — ABS sensor on order, ETA 2 days. Customer has been notified and agreed to wait.", timestamp: "2026-05-02T10:30:00Z", subject: "On Hold — Parts Awaiting" },
    ],
    inspections: [
      { id: "ins-m01", title: "ABS Sensor Visual (All 4)", status: "fail", estimatedHours: 0.25, notes: "Front right sensor corroded — replacement ordered" },
      { id: "ins-m02", title: "Brake System General Check", status: "pass", estimatedHours: 0.25, notes: "Pads and rotors in good condition — no replacement needed" },
      { id: "ins-m03", title: "Front Left Wheel Bearing Play", status: "pending", estimatedHours: 0.25, notes: "" },
    ],
  },
];

export async function seedJobsIfEmpty() {
  const existing = await db.select({ id: jobsTable.id }).from(jobsTable).limit(1);
  if (existing.length > 0) return;

  for (const job of SEED_JOBS) {
    await db.insert(jobsTable).values({
      id: job.id,
      estimateNumber: job.estimateNumber,
      licensePlate: job.licensePlate,
      vehicleYear: job.vehicleYear,
      vehicleMake: job.vehicleMake,
      vehicleModel: job.vehicleModel,
      serviceAdvisor: job.serviceAdvisor,
      status: job.status,
      odometer: job.odometer,
      totalEstimatedHours: job.totalEstimatedHours,
      workedHours: job.workedHours,
      progress: job.progress,
      appointmentDate: job.appointmentDate,
      customerNotes: job.customerNotes,
      thumbnail: job.thumbnail ?? null,
      currentStageId: job.currentStageId,
      assignedTechnicianId: job.assignedTechnicianId ?? null,
      tasks: job.tasks,
      notes: job.notes,
      inspections: job.inspections,
      stageHistory: job.stageHistory,
    });
  }
}

function rowToJob(row: typeof jobsTable.$inferSelect) {
  const vehicle = formatVehicleName({
    year: row.vehicleYear ?? undefined,
    make: row.vehicleMake ?? undefined,
    model: row.vehicleModel ?? undefined,
  });
  return {
    id: row.id,
    estimateNumber: row.estimateNumber,
    licensePlate: row.licensePlate,
    vehicle,
    serviceAdvisor: row.serviceAdvisor,
    totalEstimatedHours: parseFloat(row.totalEstimatedHours),
    workedHours: parseFloat(row.workedHours),
    customerNotes: row.customerNotes,
    odometer: row.odometer,
    appointmentDate: row.appointmentDate,
    status: row.status,
    thumbnail: row.thumbnail,
    progress: row.progress,
    assignedTechnicianId: row.assignedTechnicianId ?? undefined,
    currentStageId: row.currentStageId,
    tasks: row.tasks as unknown[],
    notes: row.notes as unknown[],
    inspections: row.inspections as unknown[],
    stageHistory: row.stageHistory as unknown[],
  };
}

router.get("/jobs", async (req, res) => {
  try {
    await seedJobsIfEmpty();
    const rows = await db.select().from(jobsTable).orderBy(jobsTable.createdAt);

    const corrections = await db.select().from(jobOdometerCorrectionsTable);
    const correctionMap: Record<string, number> = {};
    for (const c of corrections) {
      correctionMap[c.jobId] = c.odometer;
    }

    const jobs = rows.map((row) => {
      const job = rowToJob(row);
      if (correctionMap[job.id] !== undefined) {
        job.odometer = correctionMap[job.id];
      }
      return job;
    });

    res.json({ jobs });
  } catch (err) {
    req.log.error(err, "Failed to fetch jobs");
    res.status(500).json({ error: "Failed to fetch jobs" });
  }
});

router.get("/jobs/odometer", async (req, res) => {
  try {
    const rows = await db.select().from(jobOdometerCorrectionsTable);
    const corrections: Record<string, number> = {};
    for (const row of rows) {
      corrections[row.jobId] = row.odometer;
    }
    res.json({ corrections });
  } catch (err) {
    req.log.error(err, "Failed to fetch odometer corrections");
    res.status(500).json({ error: "Failed to fetch odometer corrections" });
  }
});

router.get("/jobs/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const rows = await db.select().from(jobsTable).where(eq(jobsTable.id, id));
    if (rows.length === 0) {
      res.status(404).json({ error: "Job not found" });
      return;
    }
    const job = rowToJob(rows[0]);

    const corrections = await db
      .select()
      .from(jobOdometerCorrectionsTable)
      .where(eq(jobOdometerCorrectionsTable.jobId, id));
    if (corrections.length > 0) {
      job.odometer = corrections[0].odometer;
    }

    res.json({ job });
  } catch (err) {
    req.log.error(err, "Failed to fetch job");
    res.status(500).json({ error: "Failed to fetch job" });
  }
});

router.patch("/jobs/:id", async (req, res) => {
  const { id } = req.params;
  const body = req.body as {
    status?: string;
    tasks?: unknown[];
    notes?: unknown[];
    workedHours?: number;
    progress?: number;
    currentStageId?: string;
    stageHistory?: unknown[];
    inspections?: unknown[];
  };

  const updateData: Partial<typeof jobsTable.$inferInsert> & { updatedAt: Date } = {
    updatedAt: new Date(),
  };

  if (body.status !== undefined) updateData.status = body.status;
  if (body.tasks !== undefined) updateData.tasks = body.tasks;
  if (body.notes !== undefined) updateData.notes = body.notes;
  if (body.workedHours !== undefined) {
    if (typeof body.workedHours !== "number" || body.workedHours < 0) {
      res.status(400).json({ error: "workedHours must be a non-negative number" });
      return;
    }
    updateData.workedHours = body.workedHours.toFixed(2);
  }
  if (body.progress !== undefined) {
    if (typeof body.progress !== "number" || body.progress < 0 || body.progress > 100) {
      res.status(400).json({ error: "progress must be a number between 0 and 100" });
      return;
    }
    updateData.progress = body.progress;
  }
  if (body.currentStageId !== undefined) updateData.currentStageId = body.currentStageId;
  if (body.stageHistory !== undefined) updateData.stageHistory = body.stageHistory;
  if (body.inspections !== undefined) updateData.inspections = body.inspections;

  try {
    const rows = await db
      .update(jobsTable)
      .set(updateData)
      .where(eq(jobsTable.id, id))
      .returning();

    if (rows.length === 0) {
      res.status(404).json({ error: "Job not found" });
      return;
    }

    res.json(rowToJob(rows[0]));
  } catch (err) {
    req.log.error(err, "Failed to update job");
    res.status(500).json({ error: "Failed to update job" });
  }
});

router.put("/jobs/:id", async (req, res) => {
  const { id } = req.params;
  const body = req.body as Record<string, unknown>;

  if (!body || typeof body !== "object" || typeof body.id !== "string") {
    res.status(400).json({ error: "Invalid job body" });
    return;
  }

  const vehicleStr = String(body.vehicle ?? "");
  const { year: vehicleYear, make: vehicleMake, model: vehicleModel } = parseVehicleString(vehicleStr);

  try {
    const values = {
      id,
      estimateNumber: String(body.estimateNumber ?? ""),
      licensePlate: String(body.licensePlate ?? ""),
      vehicleYear: vehicleYear ?? null,
      vehicleMake: vehicleMake ?? null,
      vehicleModel: vehicleModel ?? null,
      serviceAdvisor: String(body.serviceAdvisor ?? ""),
      status: String(body.status ?? "pending"),
      odometer: Number(body.odometer ?? 0),
      totalEstimatedHours: String(Number(body.totalEstimatedHours ?? 0).toFixed(2)),
      workedHours: String(Number(body.workedHours ?? 0).toFixed(2)),
      progress: Number(body.progress ?? 0),
      appointmentDate: String(body.appointmentDate ?? ""),
      customerNotes: String(body.customerNotes ?? ""),
      thumbnail: body.thumbnail != null ? String(body.thumbnail) : null,
      currentStageId: String(body.currentStageId ?? "stage-001"),
      assignedTechnicianId: body.assignedTechnicianId != null ? String(body.assignedTechnicianId) : null,
      tasks: Array.isArray(body.tasks) ? body.tasks : [],
      notes: Array.isArray(body.notes) ? body.notes : [],
      inspections: Array.isArray(body.inspections) ? body.inspections : [],
      stageHistory: Array.isArray(body.stageHistory) ? body.stageHistory : [],
      updatedAt: new Date(),
    };

    const [row] = await db
      .insert(jobsTable)
      .values(values)
      .onConflictDoUpdate({
        target: jobsTable.id,
        set: {
          estimateNumber: values.estimateNumber,
          licensePlate: values.licensePlate,
          vehicleYear: values.vehicleYear,
          vehicleMake: values.vehicleMake,
          vehicleModel: values.vehicleModel,
          serviceAdvisor: values.serviceAdvisor,
          status: values.status,
          odometer: values.odometer,
          totalEstimatedHours: values.totalEstimatedHours,
          workedHours: values.workedHours,
          progress: values.progress,
          appointmentDate: values.appointmentDate,
          customerNotes: values.customerNotes,
          thumbnail: values.thumbnail,
          currentStageId: values.currentStageId,
          assignedTechnicianId: values.assignedTechnicianId,
          tasks: values.tasks,
          notes: values.notes,
          inspections: values.inspections,
          stageHistory: values.stageHistory,
          updatedAt: values.updatedAt,
        },
      })
      .returning();

    res.json({ job: rowToJob(row) });
  } catch (err) {
    req.log.error(err, "Failed to save job");
    res.status(500).json({ error: "Failed to save job" });
  }
});

router.post("/jobs", async (req, res) => {
  const body = req.body as Record<string, unknown>;

  if (!body || typeof body !== "object") {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const estimateNumber = typeof body.estimateNumber === "string" ? body.estimateNumber.trim() : "";
  if (!estimateNumber) {
    res.status(400).json({ error: "estimateNumber is required" });
    return;
  }

  const vehicleStr = typeof body.vehicle === "string" ? body.vehicle.trim() : "";
  const { year: vehicleYear, make: vehicleMake, model: vehicleModel } = parseVehicleString(vehicleStr);

  const id = `job-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const now = new Date().toISOString();

  try {
    const values = {
      id,
      estimateNumber,
      licensePlate: typeof body.licensePlate === "string" ? body.licensePlate.trim() : "",
      vehicleYear: vehicleYear ?? null,
      vehicleMake: vehicleMake ?? null,
      vehicleModel: vehicleModel ?? null,
      serviceAdvisor: typeof body.serviceAdvisor === "string" ? body.serviceAdvisor.trim() : "",
      status: "pending",
      odometer: typeof body.odometer === "number" ? body.odometer : 0,
      totalEstimatedHours: String(Number(body.totalEstimatedHours ?? 0).toFixed(2)),
      workedHours: "0.00",
      progress: 0,
      appointmentDate: typeof body.appointmentDate === "string" ? body.appointmentDate : now,
      customerNotes: typeof body.customerNotes === "string" ? body.customerNotes.trim() : "",
      thumbnail: null,
      currentStageId: "stage-001",
      assignedTechnicianId: null,
      tasks: [],
      notes: [],
      inspections: [],
      stageHistory: [{ stageId: "stage-001", enteredAt: now }],
    };

    const [row] = await db.insert(jobsTable).values(values).returning();
    res.status(201).json({ job: rowToJob(row) });
  } catch (err) {
    req.log.error(err, "Failed to create job");
    res.status(500).json({ error: "Failed to create job" });
  }
});

router.delete("/jobs/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const deleted = await db.delete(jobsTable).where(eq(jobsTable.id, id)).returning({ id: jobsTable.id });
    if (deleted.length === 0) {
      res.status(404).json({ error: "Job not found" });
      return;
    }
    await db.delete(jobOdometerCorrectionsTable).where(eq(jobOdometerCorrectionsTable.jobId, id));
    res.status(204).send();
  } catch (err) {
    req.log.error(err, "Failed to delete job");
    res.status(500).json({ error: "Failed to delete job" });
  }
});

router.post("/jobs/:id/notes", async (req, res) => {
  const { id } = req.params;
  const note = req.body as { id?: string; author?: string; text?: string; timestamp?: string; subject?: string };

  if (!note || typeof note.text !== "string" || !note.text.trim()) {
    res.status(400).json({ error: "note.text is required" });
    return;
  }

  try {
    const rows = await db.select().from(jobsTable).where(eq(jobsTable.id, id));
    if (rows.length === 0) {
      res.status(404).json({ error: "Job not found" });
      return;
    }
    const existing = rows[0];
    const notes = Array.isArray(existing.notes) ? (existing.notes as unknown[]) : [];
    const newNote = {
      id: note.id ?? `jn-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      author: note.author ?? "Technician",
      text: note.text,
      timestamp: note.timestamp ?? new Date().toISOString(),
      subject: note.subject,
    };
    const alreadyExists = notes.some((n) => typeof n === "object" && n !== null && (n as { id?: string }).id === newNote.id);
    const updatedNotes = alreadyExists ? notes : [...notes, newNote];
    const [updated] = await db
      .update(jobsTable)
      .set({ notes: updatedNotes, updatedAt: new Date() })
      .where(eq(jobsTable.id, id))
      .returning();
    res.status(201).json({ note: newNote, job: rowToJob(updated) });
  } catch (err) {
    req.log.error(err, "Failed to add note");
    res.status(500).json({ error: "Failed to add note" });
  }
});

router.post("/jobs/:id/tasks/:taskId/notes", async (req, res) => {
  const { id, taskId } = req.params;
  const note = req.body as { id?: string; author?: string; text?: string; timestamp?: string; subject?: string };

  if (!note || typeof note.text !== "string" || !note.text.trim()) {
    res.status(400).json({ error: "note.text is required" });
    return;
  }

  try {
    const rows = await db.select().from(jobsTable).where(eq(jobsTable.id, id));
    if (rows.length === 0) {
      res.status(404).json({ error: "Job not found" });
      return;
    }
    const existing = rows[0];
    const tasks = Array.isArray(existing.tasks) ? (existing.tasks as Array<{ id: string; notes?: unknown[] }>) : [];
    const taskIndex = tasks.findIndex((t) => t.id === taskId);
    if (taskIndex === -1) {
      res.status(404).json({ error: "Task not found" });
      return;
    }
    const newNote = {
      id: note.id ?? `tn-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      author: note.author ?? "Technician",
      text: note.text,
      timestamp: note.timestamp ?? new Date().toISOString(),
      subject: note.subject,
    };
    const existingTaskNotes: unknown[] = Array.isArray(tasks[taskIndex].notes) ? (tasks[taskIndex].notes as unknown[]) : [];
    const alreadyExists = existingTaskNotes.some((n) => typeof n === "object" && n !== null && (n as { id?: string }).id === newNote.id);
    const updatedTasks = tasks.map((t, i) =>
      i === taskIndex ? { ...t, notes: alreadyExists ? existingTaskNotes : [...existingTaskNotes, newNote] } : t
    );
    const [updated] = await db
      .update(jobsTable)
      .set({ tasks: updatedTasks, updatedAt: new Date() })
      .where(eq(jobsTable.id, id))
      .returning();
    res.status(201).json({ note: newNote, job: rowToJob(updated) });
  } catch (err) {
    req.log.error(err, "Failed to add task note");
    res.status(500).json({ error: "Failed to add task note" });
  }
});

router.patch("/jobs/:id/inspections/:itemId", async (req, res) => {
  const { id, itemId } = req.params;
  const { status, notes } = req.body as { status?: string; notes?: string };

  const validStatuses = ["pass", "fail", "attention", "pending"];
  if (status !== undefined && !validStatuses.includes(status)) {
    res.status(400).json({ error: `status must be one of: ${validStatuses.join(", ")}` });
    return;
  }

  try {
    const rows = await db.select().from(jobsTable).where(eq(jobsTable.id, id));
    if (rows.length === 0) {
      res.status(404).json({ error: "Job not found" });
      return;
    }
    const existing = rows[0];
    const inspections = Array.isArray(existing.inspections)
      ? (existing.inspections as Array<{ id: string; status?: string; notes?: string }>)
      : [];
    const itemIndex = inspections.findIndex((ins) => ins.id === itemId);
    if (itemIndex === -1) {
      res.status(404).json({ error: "Inspection item not found" });
      return;
    }
    const updatedInspections = inspections.map((ins, i) => {
      if (i !== itemIndex) return ins;
      return {
        ...ins,
        ...(status !== undefined ? { status } : {}),
        ...(notes !== undefined ? { notes } : {}),
      };
    });
    const [updated] = await db
      .update(jobsTable)
      .set({ inspections: updatedInspections, updatedAt: new Date() })
      .where(eq(jobsTable.id, id))
      .returning();
    res.json({ inspection: updatedInspections[itemIndex], job: rowToJob(updated) });
  } catch (err) {
    req.log.error(err, "Failed to update inspection item");
    res.status(500).json({ error: "Failed to update inspection item" });
  }
});

router.patch("/jobs/:id/odometer", async (req, res) => {
  const { id } = req.params;
  const { odometer } = req.body as { odometer?: unknown };

  if (typeof odometer !== "number" || !Number.isInteger(odometer) || odometer < 0) {
    res.status(400).json({ error: "odometer must be a non-negative integer" });
    return;
  }

  try {
    const [row] = await db
      .insert(jobOdometerCorrectionsTable)
      .values({ jobId: id, odometer })
      .onConflictDoUpdate({
        target: jobOdometerCorrectionsTable.jobId,
        set: { odometer, updatedAt: new Date() },
      })
      .returning();

    res.json({ id: row.jobId, odometer: row.odometer, updatedAt: row.updatedAt });
  } catch (err) {
    req.log.error(err, "Failed to save odometer correction");
    res.status(500).json({ error: "Failed to save odometer correction" });
  }
});

export default router;
