import AsyncStorage from "@react-native-async-storage/async-storage";
import { VEHICLE_CHECKLIST } from "@/constants/inspectionChecklist";
import { Platform } from "react-native";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useReducer,
} from "react";

const API_BASE = Platform.OS === "web"
  ? `${typeof window !== "undefined" ? window.location.origin : ""}/api`
  : "/api";

export type JobStatus = "pending" | "in_progress" | "on_hold" | "completed";
export type TaskStatus = "pending" | "in_progress" | "done";
export type LaborType = "ELECTRICAL" | "MECHANICAL" | "BODY" | "PAINT" | "DIAGNOSTIC" | "OTHER";
export type PartStatus = "pending" | "ordered" | "received";

export interface Part {
  id: string;
  name: string;
  partNumber: string;
  quantity: number;
  unit: string;
  status: PartStatus;
  price?: number;
  notes?: string;
  receivedAt?: string;
}

export interface NoteAttachment { uri: string; label: string; type: "image" | "document" }

export interface TaskNote {
  id: string; author: string; text: string; timestamp: string;
  subject?: string; attachments?: NoteAttachment[];
}

export interface Task {
  id: string; title: string; type: "Repair" | "Inspection" | "Other";
  laborType: LaborType; status: TaskStatus; estimatedHours: number;
  workedHours: number; description: string; technician: string;
  notes: TaskNote[]; clockedIn: boolean; clockInStart: string | null;
  elapsedSeconds: number; parts: Part[];
}

export interface JobNote {
  id: string; author: string; text: string; timestamp: string;
  subject?: string; attachments?: NoteAttachment[];
}

export interface InspectionItem {
  id: string; title: string; status: "pass" | "fail" | "attention" | "pending";
  estimatedHours: number; notes: string;
  templateId?: string; section?: string;
}

export interface StageEntry {
  stageId: string;
  enteredAt: string;
}

export interface Job {
  id: string; estimateNumber: string; licensePlate: string; vehicle: string;
  serviceAdvisor: string; totalEstimatedHours: number; workedHours: number;
  customerNotes: string; odometer: number; appointmentDate: string;
  status: JobStatus; thumbnail: string | null; tasks: Task[];
  notes: JobNote[]; inspections: InspectionItem[]; progress: number;
  assignedTechnicianId?: string;
  currentStageId: string;
  stageHistory: StageEntry[];
}

export interface TimeRecord {
  id: string; date: string; shiftStart: string | null; shiftEnd: string | null;
  totalSeconds: number; breaks: Array<{ start: string; end: string | null }>;
  status: "active" | "completed" | "not_started";
}

export interface Technician {
  id: string; name: string; role: string; avatar: string;
  currentJobId: string | null; status: "active" | "idle" | "break" | "absent";
  totalHoursToday: number; efficiency: number;
  weekHoursBooked: number; monthHoursBooked: number;
  specializations: LaborType[]; completedJobs: number;
}

interface DashboardStats {
  totalTimeTracked: string; productivity: number;
  workingPattern: Record<string, "worked" | "partial" | "off">;
}

interface Notification {
  id: string; title: string; message: string; read: boolean;
  timestamp: string; type: "info" | "warning" | "success";
  jobId?: string; stageId?: string;
}

interface JobsState {
  jobs: Job[]; stats: DashboardStats;
  activeClockIn: { jobId: string; taskId: string; startTime: string } | null;
  isOffline: boolean; notifications: Notification[];
  timeRecords: TimeRecord[]; activeShift: TimeRecord | null;
  technicians: Technician[];
  activeBreak: boolean;
  activeNonProd: { taskType: string; elapsedSeconds: number } | null;
}

type Action =
  | { type: "SET_JOBS"; payload: Job[] }
  | { type: "CLOCK_IN"; payload: { jobId: string; taskId: string } }
  | { type: "CLOCK_OUT"; payload: { jobId: string; taskId: string } }
  | { type: "ADD_NOTE"; payload: { jobId: string; note: JobNote } }
  | { type: "ADD_TASK_NOTE"; payload: { jobId: string; taskId: string; note: TaskNote } }
  | { type: "MARK_TASK_DONE"; payload: { jobId: string; taskId: string } }
  | { type: "MARK_JOB_COMPLETE"; payload: { jobId: string } }
  | { type: "SET_OFFLINE"; payload: boolean }
  | { type: "MARK_NOTIFICATION_READ"; payload: string }
  | { type: "MARK_ALL_READ" }
  | { type: "TICK_CLOCK" }
  | { type: "START_SHIFT" }
  | { type: "END_SHIFT" }
  | { type: "ASSIGN_JOB"; payload: { jobId: string; technicianId: string } }
  | { type: "RECEIVE_PART"; payload: { jobId: string; taskId: string; partId: string } }
  | { type: "ADD_PART"; payload: { jobId: string; taskId: string; part: Part } }
  | { type: "UPDATE_PART_STATUS"; payload: { jobId: string; taskId: string; partId: string; status: PartStatus } }
  | { type: "ADVANCE_STAGE"; payload: { jobId: string; nextStageId: string; stageName: string } }
  | { type: "ADD_DELAY_NOTIFICATION"; payload: { jobId: string; estimateNumber: string; stageName: string; stageId: string; overdueHours: number } }
  | { type: "ADD_YARD_NOTIFICATION"; payload: { inspectionId: number; inspectionNumber: string; vehicleName: string } }
  | { type: "ADD_INSPECTION"; payload: { jobId: string; item: InspectionItem } }
  | { type: "UPDATE_INSPECTION"; payload: { jobId: string; itemId: string; status: InspectionItem["status"]; notes: string } }
  | { type: "HOLD_JOB"; payload: { jobId: string } }
  | { type: "UNHOLD_JOB"; payload: { jobId: string } }
  | { type: "LOAD_INSPECTION_TEMPLATE"; payload: { jobId: string; items: InspectionItem[] } }
  | { type: "START_BREAK" }
  | { type: "END_BREAK" }
  | { type: "START_NONPROD"; payload: { taskType: string } }
  | { type: "END_NONPROD" }
  | { type: "UPDATE_ODOMETER"; payload: { jobId: string; odometer: number } };

const INITIAL_TECHNICIANS: Technician[] = [
  { id: "tech-001", name: "Mike Rodriguez", role: "Senior Technician", avatar: "MR", currentJobId: "job-001", status: "active", totalHoursToday: 5.5, efficiency: 92, weekHoursBooked: 32, monthHoursBooked: 128, specializations: ["MECHANICAL", "ELECTRICAL", "DIAGNOSTIC"], completedJobs: 312 },
  { id: "tech-002", name: "James Wilson",   role: "Technician",        avatar: "JW", currentJobId: "job-005", status: "active", totalHoursToday: 4.0, efficiency: 78, weekHoursBooked: 24, monthHoursBooked: 98,  specializations: ["ELECTRICAL", "DIAGNOSTIC"],              completedJobs: 187 },
  { id: "tech-003", name: "Carlos Mendez",  role: "Junior Technician", avatar: "CM", currentJobId: null,      status: "idle",   totalHoursToday: 3.2, efficiency: 65, weekHoursBooked: 18, monthHoursBooked: 72,  specializations: ["MECHANICAL"],                            completedJobs: 95  },
  { id: "tech-004", name: "Ahmed Hassan",   role: "Technician",        avatar: "AH", currentJobId: "job-002", status: "break",  totalHoursToday: 6.1, efficiency: 88, weekHoursBooked: 38, monthHoursBooked: 152, specializations: ["MECHANICAL", "BODY", "PAINT"],            completedJobs: 241 },
  { id: "tech-005", name: "David Park",     role: "Senior Technician", avatar: "DP", currentJobId: null,      status: "absent", totalHoursToday: 0,   efficiency: 0,  weekHoursBooked: 0,  monthHoursBooked: 0,   specializations: ["MECHANICAL", "ELECTRICAL", "DIAGNOSTIC", "BODY"], completedJobs: 289 },
];

// Timestamps relative to now so delay detection fires immediately for demo
const _now = Date.now();
const hoursAgo = (h: number) => new Date(_now - h * 3600000).toISOString();

const INITIAL_JOBS: Job[] = [
  {
    id: "job-001", estimateNumber: "#00095", licensePlate: "Sert432",
    vehicle: "BMW 325 (1995)", serviceAdvisor: "Sanel Hodzic",
    totalEstimatedHours: 3.5, workedHours: 1.25,
    customerNotes: "Customer requested synthetic oil. Please check tire pressure.",
    odometer: 129500, appointmentDate: "2026-04-30T16:00:00Z",
    status: "in_progress", thumbnail: null, progress: 36, assignedTechnicianId: "tech-001",
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
    id: "job-002", estimateNumber: "#00102", licensePlate: "ABC123",
    vehicle: "Toyota Camry (2019)", serviceAdvisor: "Rachel Green",
    totalEstimatedHours: 2.0, workedHours: 0.0,
    customerNotes: "Squealing brakes when stopping.",
    odometer: 45200, appointmentDate: "2026-04-30T14:00:00Z",
    status: "pending", thumbnail: null, progress: 0, assignedTechnicianId: "tech-004",
    currentStageId: "stage-001",
    stageHistory: [
      { stageId: "stage-001", enteredAt: hoursAgo(2) },
    ],
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
    notes: [], inspections: [{ id: "ins-005", title: "Brake Pad Thickness", status: "fail", estimatedHours: 0.2, notes: "Front pads at 2mm - replacement needed" }],
  },
  {
    id: "job-003", estimateNumber: "#00088", licensePlate: "XYZ789",
    vehicle: "Honda Accord (2021)", serviceAdvisor: "David Kim",
    totalEstimatedHours: 1.5, workedHours: 1.5,
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
    vehicle: "Ford F-150 (2022)", serviceAdvisor: "Sanel Hodzic",
    totalEstimatedHours: 4.0, workedHours: 0.0,
    customerNotes: "Check engine light on. Rough idle.", odometer: 31800,
    appointmentDate: "2026-05-01T09:00:00Z",
    status: "pending", thumbnail: null, progress: 0,
    currentStageId: "stage-001",
    stageHistory: [
      { stageId: "stage-001", enteredAt: hoursAgo(1) },
    ],
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
    vehicle: "Tesla Model 3 (2023)", serviceAdvisor: "Rachel Green",
    totalEstimatedHours: 0.5, workedHours: 0.25,
    customerNotes: "Charging port issue.", odometer: 8900,
    appointmentDate: "2026-04-30T11:00:00Z",
    status: "in_progress", thumbnail: null, progress: 50, assignedTechnicianId: "tech-002",
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
    notes: [], inspections: [],
  },
  {
    id: "job-006", estimateNumber: "#00115", licensePlate: "MNO234",
    vehicle: "Mazda 6 (2020)", serviceAdvisor: "Rachel Green",
    totalEstimatedHours: 2.5, workedHours: 0.5,
    customerNotes: "Intermittent ABS warning. Also reports front-left wheel bearing noise at speed.",
    odometer: 52300,
    appointmentDate: "2026-05-02T10:00:00Z",
    status: "on_hold", thumbnail: null, progress: 20, assignedTechnicianId: "tech-003",
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

const INITIAL_STATS: DashboardStats = {
  totalTimeTracked: "31h 56m", productivity: 77,
  workingPattern: {
    "2026-04-01": "worked", "2026-04-02": "worked", "2026-04-03": "partial",
    "2026-04-04": "worked", "2026-04-07": "worked", "2026-04-08": "worked",
    "2026-04-09": "partial", "2026-04-10": "worked", "2026-04-11": "worked",
    "2026-04-14": "partial", "2026-04-15": "worked", "2026-04-16": "worked",
    "2026-04-17": "worked", "2026-04-21": "worked", "2026-04-22": "worked",
    "2026-04-23": "worked", "2026-04-24": "partial", "2026-04-28": "worked",
    "2026-04-29": "worked", "2026-04-30": "partial",
  },
};

const INITIAL_NOTIFICATIONS: Notification[] = [
  { id: "notif-001", title: "Parts Ready", message: "Front brake pads for #00095 are ready to collect", read: false, timestamp: "2026-04-30T10:00:00Z", type: "success" },
  { id: "notif-002", title: "New Assignment", message: "Estimate #00110 assigned to you", read: false, timestamp: "2026-04-30T08:30:00Z", type: "success" },
  { id: "notif-003", title: "Parts Ordered", message: "Spark plugs for #00110 ordered — ETA 2 hours", read: true, timestamp: "2026-04-29T15:00:00Z", type: "info" },
  { id: "notif-004", title: "Appointment Reminder", message: "Tesla Model 3 appointment in 30 minutes", read: true, timestamp: "2026-04-30T10:30:00Z", type: "warning" },
  { id: "notif-005", title: "Stage Advanced", message: "Estimate #00095 moved to \"Repair\"", read: true, timestamp: hoursAgo(5), type: "info" },
  { id: "notif-006", title: "Stage Advanced", message: "Estimate #00098 moved to \"Diagnosis\"", read: true, timestamp: hoursAgo(3), type: "info" },
];

function computeProgress(job: Job): number {
  if (job.tasks.length === 0) return 0;
  return Math.round((job.tasks.filter((t) => t.status === "done").length / job.tasks.length) * 100);
}

function mapTasks(tasks: Task[], taskId: string, fn: (t: Task) => Task): Task[] {
  return tasks.map((t) => (t.id === taskId ? fn(t) : t));
}

function mapJobs(jobs: Job[], jobId: string, fn: (j: Job) => Job): Job[] {
  return jobs.map((j) => (j.id === jobId ? fn(j) : j));
}

function reducer(state: JobsState, action: Action): JobsState {
  switch (action.type) {
    case "SET_JOBS": return { ...state, jobs: action.payload };

    case "CLOCK_IN": {
      const { jobId, taskId } = action.payload;
      return {
        ...state,
        activeClockIn: { jobId, taskId, startTime: new Date().toISOString() },
        jobs: mapJobs(state.jobs, jobId, (job) => ({
          ...job, status: "in_progress" as JobStatus,
          tasks: mapTasks(job.tasks, taskId, (t) => ({ ...t, clockedIn: true, clockInStart: new Date().toISOString(), status: "in_progress" as TaskStatus })),
        })),
      };
    }

    case "CLOCK_OUT": {
      const { jobId, taskId } = action.payload;
      return {
        ...state, activeClockIn: null,
        jobs: mapJobs(state.jobs, jobId, (job) => {
          const updatedTasks = mapTasks(job.tasks, taskId, (t) => {
            const addedSeconds = t.clockInStart ? Math.floor((Date.now() - new Date(t.clockInStart).getTime()) / 1000) : 0;
            const newElapsed = t.elapsedSeconds + addedSeconds;
            return { ...t, clockedIn: false, clockInStart: null, elapsedSeconds: newElapsed, workedHours: parseFloat((newElapsed / 3600).toFixed(2)) };
          });
          const totalWorked = updatedTasks.reduce((s, t) => s + t.workedHours, 0);
          return { ...job, tasks: updatedTasks, workedHours: parseFloat(totalWorked.toFixed(2)), progress: computeProgress({ ...job, tasks: updatedTasks }) };
        }),
      };
    }

    case "ADD_NOTE":
      return { ...state, jobs: mapJobs(state.jobs, action.payload.jobId, (j) => ({ ...j, notes: [...j.notes, action.payload.note] })) };

    case "ADD_TASK_NOTE":
      return {
        ...state, jobs: mapJobs(state.jobs, action.payload.jobId, (j) => ({
          ...j, tasks: mapTasks(j.tasks, action.payload.taskId, (t) => ({ ...t, notes: [...t.notes, action.payload.note] })),
        })),
      };

    case "MARK_TASK_DONE":
      return {
        ...state, jobs: mapJobs(state.jobs, action.payload.jobId, (job) => {
          const updatedTasks = mapTasks(job.tasks, action.payload.taskId, (t) => ({ ...t, status: "done" as TaskStatus, clockedIn: false }));
          const allDone = updatedTasks.every((t) => t.status === "done");
          return { ...job, tasks: updatedTasks, progress: computeProgress({ ...job, tasks: updatedTasks }), status: allDone ? "completed" : job.status };
        }),
      };

    case "MARK_JOB_COMPLETE":
      return { ...state, jobs: mapJobs(state.jobs, action.payload.jobId, (j) => ({ ...j, status: "completed", progress: 100 })) };

    case "SET_OFFLINE": return { ...state, isOffline: action.payload };

    case "MARK_NOTIFICATION_READ":
      return { ...state, notifications: state.notifications.map((n) => n.id === action.payload ? { ...n, read: true } : n) };

    case "MARK_ALL_READ":
      return { ...state, notifications: state.notifications.map((n) => ({ ...n, read: true })) };

    case "TICK_CLOCK":
      return {
        ...state,
        jobs: state.jobs.map((job) => ({ ...job, tasks: job.tasks.map((t) => !t.clockedIn ? t : { ...t, elapsedSeconds: t.elapsedSeconds + 1 }) })),
        activeShift: state.activeShift && !state.activeBreak ? { ...state.activeShift, totalSeconds: state.activeShift.totalSeconds + 1 } : state.activeShift,
        activeNonProd: state.activeNonProd ? { ...state.activeNonProd, elapsedSeconds: state.activeNonProd.elapsedSeconds + 1 } : null,
      };

    case "START_SHIFT": {
      const now = new Date().toISOString();
      const today = now.split("T")[0];
      const record: TimeRecord = { id: Date.now().toString(), date: today, shiftStart: now, shiftEnd: null, totalSeconds: 0, breaks: [], status: "active" };
      return { ...state, activeShift: record, timeRecords: [record, ...state.timeRecords] };
    }

    case "END_SHIFT": {
      if (!state.activeShift) return state;
      const closedBreaks = state.activeShift.breaks.map((b) =>
        b.end === null ? { ...b, end: new Date().toISOString() } : b
      );
      const ended: TimeRecord = { ...state.activeShift, shiftEnd: new Date().toISOString(), status: "completed", breaks: closedBreaks };
      return { ...state, activeShift: null, activeBreak: false, activeNonProd: null, timeRecords: state.timeRecords.map((r) => r.id === ended.id ? ended : r) };
    }

    case "START_BREAK": {
      if (!state.activeShift) return state;
      const now = new Date().toISOString();
      const updatedShift = { ...state.activeShift, breaks: [...state.activeShift.breaks, { start: now, end: null }] };
      return { ...state, activeBreak: true, activeShift: updatedShift, timeRecords: state.timeRecords.map((r) => r.id === updatedShift.id ? updatedShift : r) };
    }

    case "END_BREAK": {
      if (!state.activeShift) return state;
      const now = new Date().toISOString();
      const updatedBreaks = state.activeShift.breaks.map((b, i) =>
        i === state.activeShift!.breaks.length - 1 && b.end === null ? { ...b, end: now } : b
      );
      const updatedShift = { ...state.activeShift, breaks: updatedBreaks };
      return { ...state, activeBreak: false, activeShift: updatedShift, timeRecords: state.timeRecords.map((r) => r.id === updatedShift.id ? updatedShift : r) };
    }

    case "START_NONPROD":
      return { ...state, activeNonProd: { taskType: action.payload.taskType, elapsedSeconds: 0 } };

    case "END_NONPROD":
      return { ...state, activeNonProd: null };

    case "UPDATE_ODOMETER":
      return { ...state, jobs: mapJobs(state.jobs, action.payload.jobId, (j) => ({ ...j, odometer: action.payload.odometer })) };

    case "ASSIGN_JOB":
      return { ...state, jobs: mapJobs(state.jobs, action.payload.jobId, (j) => ({ ...j, assignedTechnicianId: action.payload.technicianId })) };

    case "RECEIVE_PART":
      return {
        ...state, jobs: mapJobs(state.jobs, action.payload.jobId, (job) => ({
          ...job, tasks: mapTasks(job.tasks, action.payload.taskId, (t) => ({
            ...t, parts: t.parts.map((p) => p.id === action.payload.partId ? { ...p, status: "received" as PartStatus, receivedAt: new Date().toISOString() } : p),
          })),
        })),
      };

    case "ADD_PART":
      return {
        ...state, jobs: mapJobs(state.jobs, action.payload.jobId, (job) => ({
          ...job, tasks: mapTasks(job.tasks, action.payload.taskId, (t) => ({ ...t, parts: [...t.parts, action.payload.part] })),
        })),
      };

    case "UPDATE_PART_STATUS":
      return {
        ...state, jobs: mapJobs(state.jobs, action.payload.jobId, (job) => ({
          ...job, tasks: mapTasks(job.tasks, action.payload.taskId, (t) => ({
            ...t, parts: t.parts.map((p) => p.id === action.payload.partId ? { ...p, status: action.payload.status } : p),
          })),
        })),
      };

    case "ADVANCE_STAGE": {
      const { jobId, nextStageId, stageName } = action.payload;
      const job = state.jobs.find((j) => j.id === jobId);
      if (!job) return state;
      const uid = `${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
      const notification: Notification = {
        id: `notif-stage-${uid}`,
        title: "Stage Advanced",
        message: `Estimate ${job.estimateNumber} moved to "${stageName}"`,
        read: false,
        timestamp: new Date().toISOString(),
        type: "info",
        jobId,
        stageId: nextStageId,
      };
      return {
        ...state,
        notifications: [notification, ...state.notifications],
        jobs: mapJobs(state.jobs, jobId, (j) => ({
          ...j,
          currentStageId: nextStageId,
          stageHistory: [...j.stageHistory, { stageId: nextStageId, enteredAt: new Date().toISOString() }],
        })),
      };
    }

    case "HOLD_JOB":
      return { ...state, jobs: mapJobs(state.jobs, action.payload.jobId, (j) => ({ ...j, status: "on_hold" as JobStatus })) };

    case "UNHOLD_JOB":
      return { ...state, jobs: mapJobs(state.jobs, action.payload.jobId, (j) => ({ ...j, status: (j.tasks.some((t) => t.status !== "pending") ? "in_progress" : "pending") as JobStatus })) };

    case "LOAD_INSPECTION_TEMPLATE":
      return {
        ...state,
        jobs: mapJobs(state.jobs, action.payload.jobId, (j) => ({
          ...j,
          inspections: [...j.inspections, ...action.payload.items],
        })),
      };

    case "ADD_INSPECTION":
      return {
        ...state,
        jobs: mapJobs(state.jobs, action.payload.jobId, (j) => ({
          ...j,
          inspections: [...j.inspections, action.payload.item],
        })),
      };

    case "UPDATE_INSPECTION":
      return {
        ...state,
        jobs: mapJobs(state.jobs, action.payload.jobId, (j) => ({
          ...j,
          inspections: j.inspections.map((ins) =>
            ins.id === action.payload.itemId
              ? { ...ins, status: action.payload.status, notes: action.payload.notes }
              : ins
          ),
        })),
      };

    case "ADD_DELAY_NOTIFICATION": {
      const { jobId, estimateNumber, stageName, stageId, overdueHours } = action.payload;
      const alreadyExists = state.notifications.some(
        (n) => n.type === "warning" && n.jobId === jobId && n.stageId === stageId && n.title === "Stage Delay"
      );
      if (alreadyExists) return state;
      const uid = `${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
      const notification: Notification = {
        id: `notif-delay-${uid}`,
        title: "Stage Delay",
        message: `Estimate ${estimateNumber} is ${overdueHours}h overdue in "${stageName}" — action required`,
        read: false,
        timestamp: new Date().toISOString(),
        type: "warning",
        jobId,
        stageId,
      };
      return { ...state, notifications: [notification, ...state.notifications] };
    }

    case "ADD_YARD_NOTIFICATION": {
      const { inspectionId, inspectionNumber, vehicleName } = action.payload;
      const notifId = `notif-yard-${inspectionId}`;
      if (state.notifications.some((n) => n.id === notifId)) return state;
      const notification: Notification = {
        id: notifId,
        title: "New PDI Assignment",
        message: `You've been assigned to inspect ${vehicleName} — PDI #${inspectionNumber}. Tap to view.`,
        read: false,
        timestamp: new Date().toISOString(),
        type: "success",
      };
      return { ...state, notifications: [notification, ...state.notifications] };
    }

    default: return state;
  }
}

interface JobsContextValue {
  state: JobsState;
  clockIn: (jobId: string, taskId: string) => void;
  clockOut: (jobId: string, taskId: string) => void;
  addNote: (jobId: string, text: string, subject?: string, attachments?: NoteAttachment[]) => void;
  addTaskNote: (jobId: string, taskId: string, text: string, subject?: string, attachments?: NoteAttachment[]) => void;
  markTaskDone: (jobId: string, taskId: string) => void;
  markJobComplete: (jobId: string) => void;
  markNotificationRead: (id: string) => void;
  markAllRead: () => void;
  getJob: (id: string) => Job | undefined;
  startShift: () => void;
  endShift: () => void;
  startBreak: () => void;
  endBreak: () => void;
  startNonProd: (taskType: string) => void;
  endNonProd: () => void;
  assignJob: (jobId: string, technicianId: string) => void;
  receivePart: (jobId: string, taskId: string, partId: string) => void;
  addPart: (jobId: string, taskId: string, part: Omit<Part, "id">) => void;
  updatePartStatus: (jobId: string, taskId: string, partId: string, status: PartStatus) => void;
  advanceStage: (jobId: string, nextStageId: string, stageName: string) => void;
  addDelayNotification: (jobId: string, estimateNumber: string, stageName: string, stageId: string, overdueHours: number) => void;
  addYardNotification: (inspectionId: number, inspectionNumber: string, vehicleName: string) => void;
  addInspection: (jobId: string, item: Omit<InspectionItem, "id">) => void;
  updateInspection: (jobId: string, itemId: string, status: InspectionItem["status"], notes: string) => void;
  loadInspectionTemplate: (jobId: string) => void;
  holdJob: (jobId: string) => void;
  unholdJob: (jobId: string) => void;
  updateOdometer: (jobId: string, odometer: number) => void;
  unreadCount: number;
}

const JobsContext = createContext<JobsContextValue | null>(null);

export function JobsProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, {
    jobs: INITIAL_JOBS, stats: INITIAL_STATS, activeClockIn: null,
    isOffline: false, notifications: INITIAL_NOTIFICATIONS,
    timeRecords: [], activeShift: null, technicians: INITIAL_TECHNICIANS,
    activeBreak: false, activeNonProd: null,
  });

  useEffect(() => {
    const id = setInterval(() => dispatch({ type: "TICK_CLOCK" }), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const applyServerCorrections = () => {
      fetch(`${API_BASE}/jobs/odometer`)
        .then((r) => r.json())
        .then((data: { corrections?: Record<string, number> }) => {
          const corrections = data.corrections ?? {};
          Object.entries(corrections).forEach(([jobId, odometer]) => {
            dispatch({ type: "UPDATE_ODOMETER", payload: { jobId, odometer } });
          });
        })
        .catch(() => {});
    };

    AsyncStorage.getItem("jobs_v2").then((data) => {
      if (data) {
        try {
          const parsed: Job[] = JSON.parse(data);
          const migrated = parsed.map((job) => ({
            ...job,
            currentStageId: job.currentStageId ?? "stage-001",
            stageHistory: job.stageHistory ?? [{ stageId: "stage-001", enteredAt: job.appointmentDate }],
            tasks: job.tasks.map((t) => ({ ...t, parts: t.parts ?? [] })),
          }));
          dispatch({ type: "SET_JOBS", payload: migrated });
        } catch {}
      }
      applyServerCorrections();
    });
  }, []);

  useEffect(() => { AsyncStorage.setItem("jobs_v2", JSON.stringify(state.jobs)); }, [state.jobs]);

  const clockIn = useCallback((jobId: string, taskId: string) => dispatch({ type: "CLOCK_IN", payload: { jobId, taskId } }), []);
  const clockOut = useCallback((jobId: string, taskId: string) => dispatch({ type: "CLOCK_OUT", payload: { jobId, taskId } }), []);

  const addNote = useCallback((jobId: string, text: string, subject?: string, attachments?: NoteAttachment[]) => {
    const note: JobNote = { id: Date.now().toString() + Math.random().toString(36).substr(2, 5), author: "Mike Rodriguez", text, timestamp: new Date().toISOString(), subject, attachments };
    dispatch({ type: "ADD_NOTE", payload: { jobId, note } });
  }, []);

  const addTaskNote = useCallback((jobId: string, taskId: string, text: string, subject?: string, attachments?: NoteAttachment[]) => {
    const note: TaskNote = { id: Date.now().toString() + Math.random().toString(36).substr(2, 5), author: "Mike Rodriguez", text, timestamp: new Date().toISOString(), subject, attachments };
    dispatch({ type: "ADD_TASK_NOTE", payload: { jobId, taskId, note } });
  }, []);

  const markTaskDone = useCallback((jobId: string, taskId: string) => dispatch({ type: "MARK_TASK_DONE", payload: { jobId, taskId } }), []);
  const markJobComplete = useCallback((jobId: string) => dispatch({ type: "MARK_JOB_COMPLETE", payload: { jobId } }), []);
  const markNotificationRead = useCallback((id: string) => dispatch({ type: "MARK_NOTIFICATION_READ", payload: id }), []);
  const markAllRead = useCallback(() => dispatch({ type: "MARK_ALL_READ" }), []);
  const getJob = useCallback((id: string) => state.jobs.find((j) => j.id === id), [state.jobs]);
  const startShift = useCallback(() => dispatch({ type: "START_SHIFT" }), []);
  const endShift = useCallback(() => dispatch({ type: "END_SHIFT" }), []);
  const startBreak = useCallback(() => dispatch({ type: "START_BREAK" }), []);
  const endBreak = useCallback(() => dispatch({ type: "END_BREAK" }), []);
  const startNonProd = useCallback((taskType: string) => dispatch({ type: "START_NONPROD", payload: { taskType } }), []);
  const endNonProd = useCallback(() => dispatch({ type: "END_NONPROD" }), []);
  const assignJob = useCallback((jobId: string, technicianId: string) => dispatch({ type: "ASSIGN_JOB", payload: { jobId, technicianId } }), []);

  const receivePart = useCallback((jobId: string, taskId: string, partId: string) =>
    dispatch({ type: "RECEIVE_PART", payload: { jobId, taskId, partId } }), []);

  const addPart = useCallback((jobId: string, taskId: string, part: Omit<Part, "id">) =>
    dispatch({ type: "ADD_PART", payload: { jobId, taskId, part: { ...part, id: Date.now().toString() + Math.random().toString(36).substr(2, 5) } } }), []);

  const updatePartStatus = useCallback((jobId: string, taskId: string, partId: string, status: PartStatus) =>
    dispatch({ type: "UPDATE_PART_STATUS", payload: { jobId, taskId, partId, status } }), []);

  const advanceStage = useCallback((jobId: string, nextStageId: string, stageName: string) =>
    dispatch({ type: "ADVANCE_STAGE", payload: { jobId, nextStageId, stageName } }), []);

  const addDelayNotification = useCallback((jobId: string, estimateNumber: string, stageName: string, stageId: string, overdueHours: number) =>
    dispatch({ type: "ADD_DELAY_NOTIFICATION", payload: { jobId, estimateNumber, stageName, stageId, overdueHours } }), []);

  const addYardNotification = useCallback((inspectionId: number, inspectionNumber: string, vehicleName: string) =>
    dispatch({ type: "ADD_YARD_NOTIFICATION", payload: { inspectionId, inspectionNumber, vehicleName } }), []);

  const addInspection = useCallback((jobId: string, item: Omit<InspectionItem, "id">) => {
    const newItem: InspectionItem = { ...item, id: `ins-${Date.now()}-${Math.random().toString(36).substr(2, 5)}` };
    dispatch({ type: "ADD_INSPECTION", payload: { jobId, item: newItem } });
  }, []);

  const updateInspection = useCallback((jobId: string, itemId: string, status: InspectionItem["status"], notes: string) =>
    dispatch({ type: "UPDATE_INSPECTION", payload: { jobId, itemId, status, notes } }), []);

  const loadInspectionTemplate = useCallback((jobId: string) => {
    const job = state.jobs.find((j) => j.id === jobId);
    if (!job) return;
    const existingTemplateIds = new Set(
      job.inspections.filter((i) => i.templateId).map((i) => i.templateId),
    );
    const newItems: InspectionItem[] = [];
    const ts = Date.now();
    VEHICLE_CHECKLIST.forEach((section) => {
      section.items.forEach((item, idx) => {
        if (!existingTemplateIds.has(item.id)) {
          newItems.push({
            id: `ins-tpl-${item.id}-${ts}-${idx}`,
            title: item.title,
            status: "pending",
            estimatedHours: item.defaultHours,
            notes: "",
            templateId: item.id,
            section: section.id,
          });
        }
      });
    });
    if (newItems.length > 0) {
      dispatch({ type: "LOAD_INSPECTION_TEMPLATE", payload: { jobId, items: newItems } });
    }
  }, [state.jobs]);

  const holdJob = useCallback((jobId: string) => dispatch({ type: "HOLD_JOB", payload: { jobId } }), []);
  const unholdJob = useCallback((jobId: string) => dispatch({ type: "UNHOLD_JOB", payload: { jobId } }), []);

  const updateOdometer = useCallback((jobId: string, odometer: number) => {
    dispatch({ type: "UPDATE_ODOMETER", payload: { jobId, odometer } });
    fetch(`${API_BASE}/jobs/${encodeURIComponent(jobId)}/odometer`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ odometer }),
    })
      .then((r) => r.ok ? r.json() : Promise.reject(r.status))
      .then((data: { id: string; odometer: number }) => {
        if (data.odometer !== odometer) {
          dispatch({ type: "UPDATE_ODOMETER", payload: { jobId: data.id, odometer: data.odometer } });
        }
      })
      .catch(() => {});
  }, []);

  const unreadCount = state.notifications.filter((n) => !n.read).length;

  return (
    <JobsContext.Provider value={{ state, clockIn, clockOut, addNote, addTaskNote, markTaskDone, markJobComplete, markNotificationRead, markAllRead, getJob, startShift, endShift, startBreak, endBreak, startNonProd, endNonProd, assignJob, receivePart, addPart, updatePartStatus, advanceStage, addDelayNotification, addYardNotification, addInspection, updateInspection, loadInspectionTemplate, holdJob, unholdJob, updateOdometer, unreadCount }}>
      {children}
    </JobsContext.Provider>
  );
}

export function useJobs() {
  const ctx = useContext(JobsContext);
  if (!ctx) throw new Error("useJobs must be used within JobsProvider");
  return ctx;
}
