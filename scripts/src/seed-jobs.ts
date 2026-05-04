import { db, jobsTable } from "@workspace/db";

const _now = Date.now();
const hoursAgo = (h: number) => new Date(_now - h * 3600_000).toISOString();

type SeedJob = typeof jobsTable.$inferInsert;

const SEED_JOBS: SeedJob[] = [
  {
    id: "job-001",
    estimateNumber: "#00095",
    licensePlate: "Sert432",
    vehicleYear: "1995",
    vehicleMake: "BMW",
    vehicleModel: "325",
    serviceAdvisor: "Sanel Hodzic",
    totalEstimatedHours: "3.50",
    workedHours: "1.25",
    customerNotes: "Customer requested synthetic oil. Please check tire pressure.",
    odometer: 129500,
    appointmentDate: "2026-04-30T16:00:00Z",
    status: "in_progress",
    thumbnail: null,
    progress: 36,
    assignedTechnicianId: "tech-001",
    currentStageId: "stage-003",
    stageHistory: [
      { stageId: "stage-001", enteredAt: hoursAgo(8) },
      { stageId: "stage-002", enteredAt: hoursAgo(7) },
      { stageId: "stage-003", enteredAt: hoursAgo(5) },
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
    id: "job-002",
    estimateNumber: "#00102",
    licensePlate: "ABC123",
    vehicleYear: "2019",
    vehicleMake: "Toyota",
    vehicleModel: "Camry",
    serviceAdvisor: "Rachel Green",
    totalEstimatedHours: "2.00",
    workedHours: "0.00",
    customerNotes: "Squealing brakes when stopping.",
    odometer: 45200,
    appointmentDate: "2026-04-30T14:00:00Z",
    status: "pending",
    thumbnail: null,
    progress: 0,
    assignedTechnicianId: "tech-004",
    currentStageId: "stage-001",
    stageHistory: [{ stageId: "stage-001", enteredAt: hoursAgo(2) }],
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
    inspections: [{ id: "ins-009", title: "Brake Pad Thickness", status: "fail", estimatedHours: 0.2, notes: "Front pads at 2mm - replacement needed" }],
  },
  {
    id: "job-003",
    estimateNumber: "#00088",
    licensePlate: "XYZ789",
    vehicleYear: "2021",
    vehicleMake: "Honda",
    vehicleModel: "Accord",
    serviceAdvisor: "David Kim",
    totalEstimatedHours: "1.50",
    workedHours: "1.50",
    customerNotes: "Routine service.",
    odometer: 22100,
    appointmentDate: "2026-04-29T10:00:00Z",
    status: "completed",
    thumbnail: null,
    progress: 100,
    assignedTechnicianId: "tech-001",
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
    inspections: [{ id: "ins-010", title: "All Systems Check", status: "pass", estimatedHours: 0.5, notes: "Vehicle in excellent condition" }],
  },
  {
    id: "job-004",
    estimateNumber: "#00110",
    licensePlate: "DEF456",
    vehicleYear: "2022",
    vehicleMake: "Ford",
    vehicleModel: "F-150",
    serviceAdvisor: "Sanel Hodzic",
    totalEstimatedHours: "4.00",
    workedHours: "0.00",
    customerNotes: "Check engine light on. Rough idle.",
    odometer: 31800,
    appointmentDate: "2026-05-01T09:00:00Z",
    status: "pending",
    thumbnail: null,
    progress: 0,
    assignedTechnicianId: null,
    currentStageId: "stage-001",
    stageHistory: [{ stageId: "stage-001", enteredAt: hoursAgo(1) }],
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
    id: "job-005",
    estimateNumber: "#00098",
    licensePlate: "GHI012",
    vehicleYear: "2023",
    vehicleMake: "Tesla",
    vehicleModel: "Model 3",
    serviceAdvisor: "Rachel Green",
    totalEstimatedHours: "0.50",
    workedHours: "0.25",
    customerNotes: "Charging port issue.",
    odometer: 8900,
    appointmentDate: "2026-04-30T11:00:00Z",
    status: "in_progress",
    thumbnail: null,
    progress: 50,
    assignedTechnicianId: "tech-002",
    currentStageId: "stage-002",
    stageHistory: [
      { stageId: "stage-001", enteredAt: hoursAgo(4) },
      { stageId: "stage-002", enteredAt: hoursAgo(3) },
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
    id: "job-006",
    estimateNumber: "#00115",
    licensePlate: "MNO234",
    vehicleYear: "2020",
    vehicleMake: "Mazda",
    vehicleModel: "6",
    serviceAdvisor: "Rachel Green",
    totalEstimatedHours: "2.50",
    workedHours: "0.50",
    customerNotes: "Intermittent ABS warning. Also reports front-left wheel bearing noise at speed.",
    odometer: 52300,
    appointmentDate: "2026-05-02T10:00:00Z",
    status: "on_hold",
    thumbnail: null,
    progress: 20,
    assignedTechnicianId: "tech-003",
    currentStageId: "stage-002",
    stageHistory: [
      { stageId: "stage-001", enteredAt: hoursAgo(6) },
      { stageId: "stage-002", enteredAt: hoursAgo(5) },
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

async function main() {
  const existing = await db.select({ id: jobsTable.id }).from(jobsTable);
  const existingIds = new Set(existing.map((r) => r.id));
  const toInsert = SEED_JOBS.filter((j) => !existingIds.has(j.id));
  if (toInsert.length === 0) {
    console.log("All seed jobs already present — nothing to insert.");
    process.exit(0);
  }
  await db.insert(jobsTable).values(toInsert);
  console.log(`Seeded ${toInsert.length} job(s).`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
