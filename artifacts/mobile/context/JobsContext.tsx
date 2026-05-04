import AsyncStorage from "@react-native-async-storage/async-storage";
import { VEHICLE_CHECKLIST } from "@/constants/inspectionChecklist";
import { AppState, AppStateStatus, Platform } from "react-native";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useReducer,
  useRef,
  useState,
} from "react";

const API_BASE = Platform.OS === "web"
  ? `${typeof window !== "undefined" ? window.location.origin : ""}/api`
  : "/api";

function patchJob(jobId: string, patch: Record<string, unknown>): void {
  fetch(`${API_BASE}/jobs/${encodeURIComponent(jobId)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  }).catch(() => {});
}

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
  jobsLoaded: boolean;
}

type Action =
  | { type: "SET_JOBS"; payload: Job[] }
  | { type: "MERGE_JOBS"; payload: Job[] }
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
];

function computeProgress(job: Job): number {
  if (job.tasks.length === 0) return 0;
  return Math.round((job.tasks.filter((t) => t.status === "done").length / job.tasks.length) * 100);
}

function mergeNoteArrays<T extends { id: string }>(serverNotes: T[], localNotes: T[]): T[] {
  const serverIds = new Set(serverNotes.map((n) => n.id));
  const localOnly = localNotes.filter((n) => !serverIds.has(n.id));
  return [...serverNotes, ...localOnly];
}

function mergeJobsWithLocal(serverJobs: Job[], localJobs: Job[]): Job[] {
  return serverJobs.map((serverJob) => {
    const local = localJobs.find((j) => j.id === serverJob.id);
    if (!local) return serverJob;
    const tasks = serverJob.tasks.map((serverTask) => {
      const localTask = local.tasks.find((t) => t.id === serverTask.id);
      if (!localTask) return serverTask;
      const elapsedSeconds = Math.max(serverTask.elapsedSeconds, localTask.elapsedSeconds);
      const workedHours = Math.max(serverTask.workedHours, localTask.workedHours);
      return {
        ...serverTask,
        clockedIn: localTask.clockedIn,
        clockInStart: localTask.clockInStart,
        elapsedSeconds,
        workedHours,
        notes: mergeNoteArrays(serverTask.notes, localTask.notes),
      };
    });
    const workedHours = tasks.reduce((s, t) => s + t.workedHours, 0);
    return { ...serverJob, tasks, workedHours: parseFloat(workedHours.toFixed(2)), notes: mergeNoteArrays(serverJob.notes, local.notes) };
  });
}

function mapTasks(tasks: Task[], taskId: string, fn: (t: Task) => Task): Task[] {
  return tasks.map((t) => (t.id === taskId ? fn(t) : t));
}

function mapJobs(jobs: Job[], jobId: string, fn: (j: Job) => Job): Job[] {
  return jobs.map((j) => (j.id === jobId ? fn(j) : j));
}

function reducer(state: JobsState, action: Action): JobsState {
  switch (action.type) {
    case "SET_JOBS": return { ...state, jobs: action.payload, jobsLoaded: true };
    case "MERGE_JOBS": return { ...state, jobs: mergeJobsWithLocal(action.payload, state.jobs), jobsLoaded: true };

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
  updateOdometer: (jobId: string, odometer: number) => Promise<void>;
  refreshJobs: () => Promise<void>;
  isRefreshing: boolean;
  unreadCount: number;
}

const JobsContext = createContext<JobsContextValue | null>(null);

function syncJobToServer(job: Job) {
  fetch(`${API_BASE}/jobs/${encodeURIComponent(job.id)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(job),
  }).catch(() => {});
}

export function JobsProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, {
    jobs: [], stats: INITIAL_STATS, activeClockIn: null,
    isOffline: false, notifications: INITIAL_NOTIFICATIONS,
    timeRecords: [], activeShift: null, technicians: INITIAL_TECHNICIANS,
    activeBreak: false, activeNonProd: null, jobsLoaded: false,
  });

  const [isRefreshing, setIsRefreshing] = useState(false);
  const initialLoadDone = useRef(false);
  const prevJobsRef = useRef<Job[]>([]);
  const jobsLoadedRef = useRef(false);

  useEffect(() => {
    const id = setInterval(() => dispatch({ type: "TICK_CLOCK" }), 1000);
    return () => clearInterval(id);
  }, []);

  const fetchAndMergeJobs = useCallback(async (isInitial = false) => {
    try {
      const r = await fetch(`${API_BASE}/jobs`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data: { jobs?: Job[] } = await r.json();
      if (Array.isArray(data.jobs) && data.jobs.length > 0) {
        prevJobsRef.current = data.jobs;
        jobsLoadedRef.current = true;
        dispatch({ type: isInitial ? "SET_JOBS" : "MERGE_JOBS", payload: data.jobs });
        AsyncStorage.setItem("jobs_v2", JSON.stringify(data.jobs)).catch(() => {});
      }
    } catch {}
  }, []);

  useEffect(() => {
    AsyncStorage.getItem("jobs_v2").then((cached) => {
      if (cached) {
        try {
          const parsed: Job[] = JSON.parse(cached);
          const migrated = parsed.map((job) => {
            const vehicleMatch = /^(.+)\s+\((\d{4})\)$/.exec(job.vehicle);
            const vehicle = vehicleMatch ? `${vehicleMatch[2]} ${vehicleMatch[1]}` : job.vehicle;
            return {
              ...job,
              vehicle,
              currentStageId: job.currentStageId ?? "stage-001",
              stageHistory: job.stageHistory ?? [{ stageId: "stage-001", enteredAt: job.appointmentDate }],
              tasks: job.tasks.map((t) => ({ ...t, parts: t.parts ?? [] })),
            };
          });
          prevJobsRef.current = migrated;
          jobsLoadedRef.current = true;
          dispatch({ type: "SET_JOBS", payload: migrated });
        } catch {}
      }
      fetchAndMergeJobs(true).finally(() => { initialLoadDone.current = true; });
    });
  }, [fetchAndMergeJobs]);

  useEffect(() => {
    const id = setInterval(() => {
      if (initialLoadDone.current) fetchAndMergeJobs(false);
    }, 60000);
    return () => clearInterval(id);
  }, [fetchAndMergeJobs]);

  useEffect(() => {
    const handleAppStateChange = (nextState: AppStateStatus) => {
      if (nextState === "active" && initialLoadDone.current) {
        fetchAndMergeJobs(false);
      }
    };
    const sub = AppState.addEventListener("change", handleAppStateChange);
    return () => sub.remove();
  }, [fetchAndMergeJobs]);

  const refreshJobs = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await fetchAndMergeJobs(false);
    } finally {
      setIsRefreshing(false);
    }
  }, [fetchAndMergeJobs]);

  useEffect(() => {
    if (!jobsLoadedRef.current) return;
    const prev = prevJobsRef.current;
    const changed: Job[] = [];
    for (const job of state.jobs) {
      const prevJob = prev.find((j) => j.id === job.id);
      if (!prevJob || JSON.stringify(prevJob) !== JSON.stringify(job)) {
        changed.push(job);
      }
    }
    if (changed.length > 0) {
      prevJobsRef.current = state.jobs;
      AsyncStorage.setItem("jobs_v2", JSON.stringify(state.jobs)).catch(() => {});
      for (const job of changed) {
        syncJobToServer(job);
      }
    }
  }, [state.jobs]);

  const clockIn = useCallback((jobId: string, taskId: string) => {
    dispatch({ type: "CLOCK_IN", payload: { jobId, taskId } });
    const job = state.jobs.find((j) => j.id === jobId);
    if (!job) return;
    const clockInStart = new Date().toISOString();
    const updatedTasks = mapTasks(job.tasks, taskId, (t) => ({
      ...t, clockedIn: true, clockInStart, status: "in_progress" as TaskStatus,
    }));
    patchJob(jobId, { tasks: updatedTasks, status: "in_progress" });
  }, [state.jobs]);

  const clockOut = useCallback((jobId: string, taskId: string) => {
    dispatch({ type: "CLOCK_OUT", payload: { jobId, taskId } });
    const job = state.jobs.find((j) => j.id === jobId);
    if (!job) return;
    const updatedTasks = mapTasks(job.tasks, taskId, (t) => {
      const addedSeconds = t.clockInStart ? Math.floor((Date.now() - new Date(t.clockInStart).getTime()) / 1000) : 0;
      const newElapsed = t.elapsedSeconds + addedSeconds;
      return { ...t, clockedIn: false, clockInStart: null, elapsedSeconds: newElapsed, workedHours: parseFloat((newElapsed / 3600).toFixed(2)) };
    });
    const totalWorked = updatedTasks.reduce((s, t) => s + t.workedHours, 0);
    patchJob(jobId, {
      tasks: updatedTasks,
      workedHours: parseFloat(totalWorked.toFixed(2)),
      progress: computeProgress({ ...job, tasks: updatedTasks }),
    });
  }, [state.jobs]);

  const addNote = useCallback((jobId: string, text: string, subject?: string, attachments?: NoteAttachment[]) => {
    const note: JobNote = { id: Date.now().toString() + Math.random().toString(36).substr(2, 5), author: "Mike Rodriguez", text, timestamp: new Date().toISOString(), subject, attachments };
    dispatch({ type: "ADD_NOTE", payload: { jobId, note } });
    const job = state.jobs.find((j) => j.id === jobId);
    if (job) patchJob(jobId, { notes: [...job.notes, note] });
  }, [state.jobs]);

  const addTaskNote = useCallback((jobId: string, taskId: string, text: string, subject?: string, attachments?: NoteAttachment[]) => {
    const note: TaskNote = { id: Date.now().toString() + Math.random().toString(36).substr(2, 5), author: "Mike Rodriguez", text, timestamp: new Date().toISOString(), subject, attachments };
    dispatch({ type: "ADD_TASK_NOTE", payload: { jobId, taskId, note } });
    const job = state.jobs.find((j) => j.id === jobId);
    if (job) {
      const updatedTasks = mapTasks(job.tasks, taskId, (t) => ({ ...t, notes: [...t.notes, note] }));
      patchJob(jobId, { tasks: updatedTasks });
    }
  }, [state.jobs]);

  const markTaskDone = useCallback((jobId: string, taskId: string) => {
    dispatch({ type: "MARK_TASK_DONE", payload: { jobId, taskId } });
    const job = state.jobs.find((j) => j.id === jobId);
    if (job) {
      const updatedTasks = mapTasks(job.tasks, taskId, (t) => ({ ...t, status: "done" as TaskStatus, clockedIn: false }));
      const allDone = updatedTasks.every((t) => t.status === "done");
      patchJob(jobId, {
        tasks: updatedTasks,
        progress: computeProgress({ ...job, tasks: updatedTasks }),
        status: allDone ? "completed" : job.status,
      });
    }
  }, [state.jobs]);

  const markJobComplete = useCallback((jobId: string) => {
    dispatch({ type: "MARK_JOB_COMPLETE", payload: { jobId } });
    patchJob(jobId, { status: "completed", progress: 100 });
  }, []);
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

  const advanceStage = useCallback((jobId: string, nextStageId: string, stageName: string) => {
    dispatch({ type: "ADVANCE_STAGE", payload: { jobId, nextStageId, stageName } });
    const job = state.jobs.find((j) => j.id === jobId);
    if (job) {
      patchJob(jobId, {
        currentStageId: nextStageId,
        stageHistory: [...job.stageHistory, { stageId: nextStageId, enteredAt: new Date().toISOString() }],
      });
    }
  }, [state.jobs]);

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

  const holdJob = useCallback((jobId: string) => {
    dispatch({ type: "HOLD_JOB", payload: { jobId } });
    patchJob(jobId, { status: "on_hold" });
  }, []);

  const unholdJob = useCallback((jobId: string) => {
    dispatch({ type: "UNHOLD_JOB", payload: { jobId } });
    const job = state.jobs.find((j) => j.id === jobId);
    if (job) {
      const newStatus = job.tasks.some((t) => t.status !== "pending") ? "in_progress" : "pending";
      patchJob(jobId, { status: newStatus });
    }
  }, [state.jobs]);

  const updateOdometer = useCallback((jobId: string, odometer: number): Promise<void> => {
    dispatch({ type: "UPDATE_ODOMETER", payload: { jobId, odometer } });
    return fetch(`${API_BASE}/jobs/${encodeURIComponent(jobId)}/odometer`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ odometer }),
    })
      .then((r) => r.ok ? r.json() : Promise.reject(new Error(`Server error ${r.status}`)))
      .then((data: { id: string; odometer: number }) => {
        if (data.odometer !== odometer) {
          dispatch({ type: "UPDATE_ODOMETER", payload: { jobId: data.id, odometer: data.odometer } });
        }
      });
  }, []);

  const unreadCount = state.notifications.filter((n) => !n.read).length;

  return (
    <JobsContext.Provider value={{ state, clockIn, clockOut, addNote, addTaskNote, markTaskDone, markJobComplete, markNotificationRead, markAllRead, getJob, startShift, endShift, startBreak, endBreak, startNonProd, endNonProd, assignJob, receivePart, addPart, updatePartStatus, advanceStage, addDelayNotification, addYardNotification, addInspection, updateInspection, loadInspectionTemplate, holdJob, unholdJob, updateOdometer, refreshJobs, isRefreshing, unreadCount }}>
      {children}
    </JobsContext.Provider>
  );
}

export function useJobs() {
  const ctx = useContext(JobsContext);
  if (!ctx) throw new Error("useJobs must be used within JobsProvider");
  return ctx;
}
