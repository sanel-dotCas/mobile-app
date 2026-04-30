import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useReducer,
} from "react";

export type JobStatus = "pending" | "in_progress" | "completed";
export type TaskStatus = "pending" | "in_progress" | "done";

export interface TaskNote {
  id: string;
  author: string;
  text: string;
  timestamp: string;
}

export interface Task {
  id: string;
  title: string;
  type: "Repair" | "Inspection" | "Other";
  status: TaskStatus;
  estimatedHours: number;
  workedHours: number;
  description: string;
  technician: string;
  notes: TaskNote[];
  clockedIn: boolean;
  clockInStart: string | null;
  elapsedSeconds: number;
}

export interface JobNote {
  id: string;
  author: string;
  text: string;
  timestamp: string;
}

export interface InspectionItem {
  id: string;
  title: string;
  status: "pass" | "fail" | "pending";
  estimatedHours: number;
  notes: string;
}

export interface Job {
  id: string;
  estimateNumber: string;
  licensePlate: string;
  vehicle: string;
  serviceAdvisor: string;
  totalEstimatedHours: number;
  workedHours: number;
  customerNotes: string;
  odometer: number;
  appointmentDate: string;
  status: JobStatus;
  thumbnail: string | null;
  tasks: Task[];
  notes: JobNote[];
  inspections: InspectionItem[];
  progress: number;
}

interface DashboardStats {
  totalTimeTracked: string;
  productivity: number;
  workingPattern: Record<string, "worked" | "partial" | "off">;
}

interface JobsState {
  jobs: Job[];
  stats: DashboardStats;
  activeClockIn: { jobId: string; taskId: string; startTime: string } | null;
  isOffline: boolean;
  notifications: Notification[];
}

interface Notification {
  id: string;
  title: string;
  message: string;
  read: boolean;
  timestamp: string;
  type: "info" | "warning" | "success";
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
  | { type: "TICK_CLOCK" };

const INITIAL_JOBS: Job[] = [
  {
    id: "job-001",
    estimateNumber: "#00095",
    licensePlate: "Sert432",
    vehicle: "BMW 325 (1995)",
    serviceAdvisor: "Sanel Hodzic",
    totalEstimatedHours: 3.5,
    workedHours: 1.25,
    customerNotes: "Customer requested synthetic oil. Please check tire pressure.",
    odometer: 129500,
    appointmentDate: "2026-04-30T16:00:00Z",
    status: "in_progress",
    thumbnail: null,
    progress: 36,
    tasks: [
      {
        id: "task-001",
        title: "Oil Change",
        type: "Repair",
        status: "done",
        estimatedHours: 1.0,
        workedHours: 0.75,
        description: "Full synthetic oil change with filter replacement",
        technician: "Mike Rodriguez",
        notes: [
          { id: "tn-001", author: "Mike Rodriguez", text: "Used Castrol Edge 5W-30. Filter replaced.", timestamp: "2026-04-30T10:30:00Z" }
        ],
        clockedIn: false,
        clockInStart: null,
        elapsedSeconds: 2700,
      },
      {
        id: "task-002",
        title: "Brake Inspection",
        type: "Inspection",
        status: "in_progress",
        estimatedHours: 1.5,
        workedHours: 0.5,
        description: "Full brake system inspection — pads, rotors, calipers, lines",
        technician: "Mike Rodriguez",
        notes: [],
        clockedIn: false,
        clockInStart: null,
        elapsedSeconds: 1800,
      },
      {
        id: "task-003",
        title: "Customized Inspection",
        type: "Other",
        status: "pending",
        estimatedHours: 1.0,
        workedHours: 0.0,
        description: "Comprehensive multi-point vehicle inspection",
        technician: "Mike Rodriguez",
        notes: [],
        clockedIn: false,
        clockInStart: null,
        elapsedSeconds: 0,
      },
    ],
    notes: [
      { id: "jn-001", author: "Sanel Hodzic", text: "Customer called to confirm appointment. Waiting for parts.", timestamp: "2026-04-29T09:00:00Z" },
      { id: "jn-002", author: "Mike Rodriguez", text: "Vehicle checked in. Starting with oil change.", timestamp: "2026-04-30T09:15:00Z" },
    ],
    inspections: [
      { id: "ins-001", title: "Tire Tread Depth", status: "pass", estimatedHours: 0.2, notes: "All tires within spec" },
      { id: "ins-002", title: "Fluid Levels", status: "fail", estimatedHours: 0.3, notes: "Coolant low - requires top up" },
      { id: "ins-003", title: "Battery Test", status: "pending", estimatedHours: 0.2, notes: "" },
      { id: "ins-004", title: "Air Filter", status: "pass", estimatedHours: 0.1, notes: "Clean, no replacement needed" },
    ],
  },
  {
    id: "job-002",
    estimateNumber: "#00102",
    licensePlate: "ABC123",
    vehicle: "Toyota Camry (2019)",
    serviceAdvisor: "Rachel Green",
    totalEstimatedHours: 2.0,
    workedHours: 0.0,
    customerNotes: "Squealing brakes when stopping.",
    odometer: 45200,
    appointmentDate: "2026-04-30T14:00:00Z",
    status: "pending",
    thumbnail: null,
    progress: 0,
    tasks: [
      {
        id: "task-004",
        title: "Brake Pad Replacement",
        type: "Repair",
        status: "pending",
        estimatedHours: 2.0,
        workedHours: 0.0,
        description: "Replace front and rear brake pads",
        technician: "Mike Rodriguez",
        notes: [],
        clockedIn: false,
        clockInStart: null,
        elapsedSeconds: 0,
      },
    ],
    notes: [],
    inspections: [
      { id: "ins-005", title: "Brake Pad Thickness", status: "fail", estimatedHours: 0.2, notes: "Front pads at 2mm - replacement needed" },
    ],
  },
  {
    id: "job-003",
    estimateNumber: "#00088",
    licensePlate: "XYZ789",
    vehicle: "Honda Accord (2021)",
    serviceAdvisor: "David Kim",
    totalEstimatedHours: 1.5,
    workedHours: 1.5,
    customerNotes: "Routine service.",
    odometer: 22100,
    appointmentDate: "2026-04-29T10:00:00Z",
    status: "completed",
    thumbnail: null,
    progress: 100,
    tasks: [
      {
        id: "task-005",
        title: "Tire Rotation",
        type: "Repair",
        status: "done",
        estimatedHours: 0.75,
        workedHours: 0.75,
        description: "Rotate all four tires",
        technician: "Mike Rodriguez",
        notes: [],
        clockedIn: false,
        clockInStart: null,
        elapsedSeconds: 2700,
      },
      {
        id: "task-006",
        title: "Multi-Point Inspection",
        type: "Inspection",
        status: "done",
        estimatedHours: 0.75,
        workedHours: 0.75,
        description: "Full vehicle inspection",
        technician: "Mike Rodriguez",
        notes: [],
        clockedIn: false,
        clockInStart: null,
        elapsedSeconds: 2700,
      },
    ],
    notes: [
      { id: "jn-003", author: "David Kim", text: "All work completed. Vehicle ready for pickup.", timestamp: "2026-04-29T11:45:00Z" },
    ],
    inspections: [
      { id: "ins-006", title: "All Systems Check", status: "pass", estimatedHours: 0.5, notes: "Vehicle in excellent condition" },
    ],
  },
  {
    id: "job-004",
    estimateNumber: "#00110",
    licensePlate: "DEF456",
    vehicle: "Ford F-150 (2022)",
    serviceAdvisor: "Sanel Hodzic",
    totalEstimatedHours: 4.0,
    workedHours: 0.0,
    customerNotes: "Check engine light on. Rough idle.",
    odometer: 31800,
    appointmentDate: "2026-05-01T09:00:00Z",
    status: "pending",
    thumbnail: null,
    progress: 0,
    tasks: [
      {
        id: "task-007",
        title: "Diagnostic Scan",
        type: "Inspection",
        status: "pending",
        estimatedHours: 1.0,
        workedHours: 0.0,
        description: "OBD-II diagnostic scan and analysis",
        technician: "Mike Rodriguez",
        notes: [],
        clockedIn: false,
        clockInStart: null,
        elapsedSeconds: 0,
      },
      {
        id: "task-008",
        title: "Spark Plug Replacement",
        type: "Repair",
        status: "pending",
        estimatedHours: 3.0,
        workedHours: 0.0,
        description: "Replace all 8 spark plugs",
        technician: "Mike Rodriguez",
        notes: [],
        clockedIn: false,
        clockInStart: null,
        elapsedSeconds: 0,
      },
    ],
    notes: [],
    inspections: [],
  },
  {
    id: "job-005",
    estimateNumber: "#00098",
    licensePlate: "GHI012",
    vehicle: "Tesla Model 3 (2023)",
    serviceAdvisor: "Rachel Green",
    totalEstimatedHours: 0.5,
    workedHours: 0.25,
    customerNotes: "Charging port issue.",
    odometer: 8900,
    appointmentDate: "2026-04-30T11:00:00Z",
    status: "in_progress",
    thumbnail: null,
    progress: 50,
    tasks: [
      {
        id: "task-009",
        title: "Charging Port Inspection",
        type: "Inspection",
        status: "in_progress",
        estimatedHours: 0.5,
        workedHours: 0.25,
        description: "Inspect and clean charging port contacts",
        technician: "Mike Rodriguez",
        notes: [],
        clockedIn: false,
        clockInStart: null,
        elapsedSeconds: 900,
      },
    ],
    notes: [],
    inspections: [],
  },
];

const INITIAL_STATS: DashboardStats = {
  totalTimeTracked: "31h 56m",
  productivity: 77,
  workingPattern: {
    "2026-04-01": "worked",
    "2026-04-02": "worked",
    "2026-04-03": "partial",
    "2026-04-04": "worked",
    "2026-04-07": "worked",
    "2026-04-08": "worked",
    "2026-04-09": "partial",
    "2026-04-10": "worked",
    "2026-04-11": "worked",
    "2026-04-14": "partial",
    "2026-04-15": "worked",
    "2026-04-16": "worked",
    "2026-04-17": "worked",
    "2026-04-21": "worked",
    "2026-04-22": "worked",
    "2026-04-23": "worked",
    "2026-04-24": "partial",
    "2026-04-28": "worked",
    "2026-04-29": "worked",
    "2026-04-30": "partial",
  },
};

const INITIAL_NOTIFICATIONS: Notification[] = [
  { id: "notif-001", title: "Job Updated", message: "Estimate #00095 brake inspection started", read: false, timestamp: "2026-04-30T10:00:00Z", type: "info" },
  { id: "notif-002", title: "New Assignment", message: "Estimate #00110 assigned to you", read: false, timestamp: "2026-04-30T08:30:00Z", type: "success" },
  { id: "notif-003", title: "Parts Ready", message: "Parts for #00102 have arrived", read: true, timestamp: "2026-04-29T15:00:00Z", type: "success" },
  { id: "notif-004", title: "Appointment Reminder", message: "Tesla Model 3 appointment in 30 minutes", read: true, timestamp: "2026-04-30T10:30:00Z", type: "warning" },
];

function computeProgress(job: Job): number {
  if (job.tasks.length === 0) return 0;
  const done = job.tasks.filter((t) => t.status === "done").length;
  return Math.round((done / job.tasks.length) * 100);
}

function reducer(state: JobsState, action: Action): JobsState {
  switch (action.type) {
    case "SET_JOBS":
      return { ...state, jobs: action.payload };

    case "CLOCK_IN": {
      const { jobId, taskId } = action.payload;
      return {
        ...state,
        activeClockIn: { jobId, taskId, startTime: new Date().toISOString() },
        jobs: state.jobs.map((job) =>
          job.id !== jobId
            ? job
            : {
                ...job,
                status: "in_progress" as JobStatus,
                tasks: job.tasks.map((t) =>
                  t.id !== taskId
                    ? t
                    : { ...t, clockedIn: true, clockInStart: new Date().toISOString(), status: "in_progress" as TaskStatus }
                ),
              }
        ),
      };
    }

    case "CLOCK_OUT": {
      const { jobId, taskId } = action.payload;
      return {
        ...state,
        activeClockIn: null,
        jobs: state.jobs.map((job) => {
          if (job.id !== jobId) return job;
          const updatedTasks = job.tasks.map((t) => {
            if (t.id !== taskId) return t;
            const addedSeconds = t.clockInStart
              ? Math.floor((Date.now() - new Date(t.clockInStart).getTime()) / 1000)
              : 0;
            const newElapsed = t.elapsedSeconds + addedSeconds;
            const newWorked = parseFloat((newElapsed / 3600).toFixed(2));
            return {
              ...t,
              clockedIn: false,
              clockInStart: null,
              elapsedSeconds: newElapsed,
              workedHours: newWorked,
            };
          });
          const totalWorked = updatedTasks.reduce((s, t) => s + t.workedHours, 0);
          const prog = computeProgress({ ...job, tasks: updatedTasks });
          return { ...job, tasks: updatedTasks, workedHours: parseFloat(totalWorked.toFixed(2)), progress: prog };
        }),
      };
    }

    case "ADD_NOTE": {
      const { jobId, note } = action.payload;
      return {
        ...state,
        jobs: state.jobs.map((j) =>
          j.id !== jobId ? j : { ...j, notes: [...j.notes, note] }
        ),
      };
    }

    case "ADD_TASK_NOTE": {
      const { jobId, taskId, note } = action.payload;
      return {
        ...state,
        jobs: state.jobs.map((j) =>
          j.id !== jobId
            ? j
            : {
                ...j,
                tasks: j.tasks.map((t) =>
                  t.id !== taskId ? t : { ...t, notes: [...t.notes, note] }
                ),
              }
        ),
      };
    }

    case "MARK_TASK_DONE": {
      const { jobId, taskId } = action.payload;
      return {
        ...state,
        jobs: state.jobs.map((job) => {
          if (job.id !== jobId) return job;
          const updatedTasks = job.tasks.map((t) =>
            t.id !== taskId ? t : { ...t, status: "done" as TaskStatus, clockedIn: false }
          );
          const prog = computeProgress({ ...job, tasks: updatedTasks });
          const allDone = updatedTasks.every((t) => t.status === "done");
          return {
            ...job,
            tasks: updatedTasks,
            progress: prog,
            status: allDone ? "completed" : job.status,
          };
        }),
      };
    }

    case "MARK_JOB_COMPLETE": {
      const { jobId } = action.payload;
      return {
        ...state,
        jobs: state.jobs.map((j) =>
          j.id !== jobId ? j : { ...j, status: "completed", progress: 100 }
        ),
      };
    }

    case "SET_OFFLINE":
      return { ...state, isOffline: action.payload };

    case "MARK_NOTIFICATION_READ":
      return {
        ...state,
        notifications: state.notifications.map((n) =>
          n.id === action.payload ? { ...n, read: true } : n
        ),
      };

    case "TICK_CLOCK":
      return {
        ...state,
        jobs: state.jobs.map((job) => ({
          ...job,
          tasks: job.tasks.map((t) => {
            if (!t.clockedIn) return t;
            return { ...t, elapsedSeconds: t.elapsedSeconds + 1 };
          }),
        })),
      };

    default:
      return state;
  }
}

interface JobsContextValue {
  state: JobsState;
  clockIn: (jobId: string, taskId: string) => void;
  clockOut: (jobId: string, taskId: string) => void;
  addNote: (jobId: string, text: string) => void;
  addTaskNote: (jobId: string, taskId: string, text: string) => void;
  markTaskDone: (jobId: string, taskId: string) => void;
  markJobComplete: (jobId: string) => void;
  markNotificationRead: (id: string) => void;
  getJob: (id: string) => Job | undefined;
  unreadCount: number;
}

const JobsContext = createContext<JobsContextValue | null>(null);

export function JobsProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, {
    jobs: INITIAL_JOBS,
    stats: INITIAL_STATS,
    activeClockIn: null,
    isOffline: false,
    notifications: INITIAL_NOTIFICATIONS,
  });

  useEffect(() => {
    const id = setInterval(() => dispatch({ type: "TICK_CLOCK" }), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    AsyncStorage.getItem("jobs").then((data) => {
      if (data) {
        try {
          dispatch({ type: "SET_JOBS", payload: JSON.parse(data) });
        } catch {}
      }
    });
  }, []);

  useEffect(() => {
    AsyncStorage.setItem("jobs", JSON.stringify(state.jobs));
  }, [state.jobs]);

  const clockIn = useCallback((jobId: string, taskId: string) => {
    dispatch({ type: "CLOCK_IN", payload: { jobId, taskId } });
  }, []);

  const clockOut = useCallback((jobId: string, taskId: string) => {
    dispatch({ type: "CLOCK_OUT", payload: { jobId, taskId } });
  }, []);

  const addNote = useCallback((jobId: string, text: string) => {
    const note: JobNote = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
      author: "Mike Rodriguez",
      text,
      timestamp: new Date().toISOString(),
    };
    dispatch({ type: "ADD_NOTE", payload: { jobId, note } });
  }, []);

  const addTaskNote = useCallback((jobId: string, taskId: string, text: string) => {
    const note: TaskNote = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
      author: "Mike Rodriguez",
      text,
      timestamp: new Date().toISOString(),
    };
    dispatch({ type: "ADD_TASK_NOTE", payload: { jobId, taskId, note } });
  }, []);

  const markTaskDone = useCallback((jobId: string, taskId: string) => {
    dispatch({ type: "MARK_TASK_DONE", payload: { jobId, taskId } });
  }, []);

  const markJobComplete = useCallback((jobId: string) => {
    dispatch({ type: "MARK_JOB_COMPLETE", payload: { jobId } });
  }, []);

  const markNotificationRead = useCallback((id: string) => {
    dispatch({ type: "MARK_NOTIFICATION_READ", payload: id });
  }, []);

  const getJob = useCallback(
    (id: string) => state.jobs.find((j) => j.id === id),
    [state.jobs]
  );

  const unreadCount = state.notifications.filter((n) => !n.read).length;

  return (
    <JobsContext.Provider
      value={{ state, clockIn, clockOut, addNote, addTaskNote, markTaskDone, markJobComplete, markNotificationRead, getJob, unreadCount }}
    >
      {children}
    </JobsContext.Provider>
  );
}

export function useJobs() {
  const ctx = useContext(JobsContext);
  if (!ctx) throw new Error("useJobs must be used within JobsProvider");
  return ctx;
}
