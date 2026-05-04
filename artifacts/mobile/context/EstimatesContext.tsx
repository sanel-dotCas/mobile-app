import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useReducer,
  useState,
} from "react";

export type EstimateStatus =
  | "pending_inspection"
  | "inspection_in_progress"
  | "review"
  | "approved"
  | "submitted";

export type EstimateLineType = "labor" | "part" | "material";
export type LaborCategory = "body" | "refinish" | "mechanical" | "frame" | "glass" | "electrical" | "trim" | "other";

export const OPERATION_OPTIONS = ["Repair", "Replace", "Refinish", "Supplement", "Other"] as const;
export type OperationType = typeof OPERATION_OPTIONS[number];

export interface EstimateLine {
  id: string;
  type: EstimateLineType;
  laborCategory?: LaborCategory;
  description: string;
  hours?: number;
  quantity?: number;
  unitPrice: number;
  total: number;
  aiGenerated?: boolean;
  isPackage?: boolean;
  packageName?: string;
  operation?: string;
  accountType?: string;
}

export interface EstimatePhoto {
  id: string;
  uri: string;
  base64?: string;
  capturedAt: string;
}

export interface Estimate {
  id: string;
  estimateNo: string;
  status: EstimateStatus;
  vehicle: string;
  make: string;
  model: string;
  year: string;
  licensePlate: string;
  customer: string;
  serviceAdvisor: string;
  odometer: string;
  damageNotes: string;
  lines: EstimateLine[];
  photos: EstimatePhoto[];
  createdAt: string;
  assignedEstimatorCode: string;
}

interface EstimatesState {
  estimates: Estimate[];
}

type Action =
  | { type: "SET_ESTIMATES"; payload: Estimate[] }
  | { type: "UPDATE_STATUS"; payload: { id: string; status: EstimateStatus } }
  | { type: "ADD_LINE"; payload: { estimateId: string; line: EstimateLine } }
  | { type: "REMOVE_LINE"; payload: { estimateId: string; lineId: string } }
  | { type: "UPDATE_LINE"; payload: { estimateId: string; lineId: string; patch: Partial<EstimateLine> } }
  | { type: "SET_LINES"; payload: { estimateId: string; lines: EstimateLine[] } }
  | { type: "ADD_PHOTO"; payload: { estimateId: string; photo: EstimatePhoto } }
  | { type: "REMOVE_PHOTO"; payload: { estimateId: string; photoId: string } };

const SEED: Estimate[] = [
  {
    id: "est-001",
    estimateNo: "EST-20260502-001",
    status: "pending_inspection",
    vehicle: "2022 Toyota Camry",
    make: "Toyota",
    model: "Camry",
    year: "2022",
    licensePlate: "ABC 123",
    customer: "James Robertson",
    serviceAdvisor: "Sarah Mitchell",
    odometer: "34,210 km",
    damageNotes: "Front-end collision damage. Bonnet crumpled, both headlights broken, bumper displaced. Customer reports radiator may be affected.",
    lines: [],
    photos: [],
    createdAt: new Date(Date.now() - 2 * 3600000).toISOString(),
    assignedEstimatorCode: "ET",
  },
  {
    id: "est-002",
    estimateNo: "EST-20260502-002",
    status: "pending_inspection",
    vehicle: "2019 Ford Ranger",
    make: "Ford",
    model: "Ranger",
    year: "2019",
    licensePlate: "XYZ 789",
    customer: "Maria Santos",
    serviceAdvisor: "David Chen",
    odometer: "87,550 km",
    damageNotes: "Side swipe damage to driver-side panels. Door skin dented, rear quarter panel scratched, mirror housing cracked.",
    lines: [],
    photos: [],
    createdAt: new Date(Date.now() - 5 * 3600000).toISOString(),
    assignedEstimatorCode: "ET",
  },
  {
    id: "est-003",
    estimateNo: "EST-20260501-008",
    status: "inspection_in_progress",
    vehicle: "2021 Volkswagen Golf",
    make: "Volkswagen",
    model: "Golf",
    year: "2021",
    licensePlate: "GH 456",
    customer: "Thomas Müller",
    serviceAdvisor: "Sarah Mitchell",
    odometer: "22,100 km",
    damageNotes: "Rear-end shunt at low speed. Boot lid won't close properly, rear bumper cracked, possible chassis rail damage.",
    lines: [
      { id: "l1", type: "labor", laborCategory: "frame",    description: "Structural assessment & alignment check", hours: 2.0, unitPrice: 95, total: 190, aiGenerated: true },
      { id: "l2", type: "part",  description: "Rear bumper assembly", quantity: 1, unitPrice: 420, total: 420, aiGenerated: true },
      { id: "l3", type: "part",  description: "Boot lid (OEM replacement)", quantity: 1, unitPrice: 870, total: 870, aiGenerated: true },
      { id: "l4", type: "labor", laborCategory: "body",     description: "Panel removal & refitting", hours: 3.5, unitPrice: 95, total: 332.50, aiGenerated: true },
      { id: "l5", type: "material", description: "Paint & primer — rear section", quantity: 1, unitPrice: 185, total: 185, aiGenerated: true },
    ],
    photos: [],
    createdAt: new Date(Date.now() - 26 * 3600000).toISOString(),
    assignedEstimatorCode: "ET",
  },
];

function reducer(state: EstimatesState, action: Action): EstimatesState {
  switch (action.type) {
    case "SET_ESTIMATES":
      return { ...state, estimates: action.payload };
    case "UPDATE_STATUS":
      return {
        ...state,
        estimates: state.estimates.map((e) =>
          e.id === action.payload.id ? { ...e, status: action.payload.status } : e
        ),
      };
    case "ADD_LINE":
      return {
        ...state,
        estimates: state.estimates.map((e) =>
          e.id === action.payload.estimateId
            ? { ...e, lines: [...e.lines, action.payload.line] }
            : e
        ),
      };
    case "REMOVE_LINE":
      return {
        ...state,
        estimates: state.estimates.map((e) =>
          e.id === action.payload.estimateId
            ? { ...e, lines: e.lines.filter((l) => l.id !== action.payload.lineId) }
            : e
        ),
      };
    case "UPDATE_LINE":
      return {
        ...state,
        estimates: state.estimates.map((e) =>
          e.id === action.payload.estimateId
            ? {
                ...e,
                lines: e.lines.map((l) =>
                  l.id === action.payload.lineId ? { ...l, ...action.payload.patch } : l
                ),
              }
            : e
        ),
      };
    case "SET_LINES":
      return {
        ...state,
        estimates: state.estimates.map((e) =>
          e.id === action.payload.estimateId
            ? { ...e, lines: action.payload.lines }
            : e
        ),
      };
    case "ADD_PHOTO":
      return {
        ...state,
        estimates: state.estimates.map((e) =>
          e.id === action.payload.estimateId
            ? { ...e, photos: [...e.photos, action.payload.photo] }
            : e
        ),
      };
    case "REMOVE_PHOTO":
      return {
        ...state,
        estimates: state.estimates.map((e) =>
          e.id === action.payload.estimateId
            ? { ...e, photos: e.photos.filter((p) => p.id !== action.payload.photoId) }
            : e
        ),
      };
    default:
      return state;
  }
}

interface EstimatesContextValue {
  state: EstimatesState;
  getEstimate: (id: string) => Estimate | undefined;
  updateStatus: (id: string, status: EstimateStatus) => void;
  addLine: (estimateId: string, line: Omit<EstimateLine, "id">) => void;
  removeLine: (estimateId: string, lineId: string) => void;
  updateLine: (estimateId: string, lineId: string, patch: Partial<EstimateLine>) => void;
  setLines: (estimateId: string, lines: EstimateLine[]) => void;
  addPhoto: (estimateId: string, photo: Omit<EstimatePhoto, "id">) => void;
  removePhoto: (estimateId: string, photoId: string) => void;
}

const EstimatesContext = createContext<EstimatesContextValue | null>(null);
const STORAGE_KEY = "igmma_estimates_v1";

export function EstimatesProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, { estimates: SEED });
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (raw) {
          try {
            const saved: Estimate[] = JSON.parse(raw);
            if (saved.length) dispatch({ type: "SET_ESTIMATES", payload: saved });
          } catch {}
        }
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  useEffect(() => {
    if (!loaded) return;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state.estimates));
  }, [state.estimates, loaded]);

  const getEstimate = useCallback(
    (id: string) => state.estimates.find((e) => e.id === id),
    [state.estimates]
  );

  const updateStatus = useCallback(
    (id: string, status: EstimateStatus) =>
      dispatch({ type: "UPDATE_STATUS", payload: { id, status } }),
    []
  );

  const addLine = useCallback(
    (estimateId: string, line: Omit<EstimateLine, "id">) =>
      dispatch({
        type: "ADD_LINE",
        payload: { estimateId, line: { ...line, id: `line-${Date.now()}` } },
      }),
    []
  );

  const removeLine = useCallback(
    (estimateId: string, lineId: string) =>
      dispatch({ type: "REMOVE_LINE", payload: { estimateId, lineId } }),
    []
  );

  const updateLine = useCallback(
    (estimateId: string, lineId: string, patch: Partial<EstimateLine>) =>
      dispatch({ type: "UPDATE_LINE", payload: { estimateId, lineId, patch } }),
    []
  );

  const setLines = useCallback(
    (estimateId: string, lines: EstimateLine[]) =>
      dispatch({ type: "SET_LINES", payload: { estimateId, lines } }),
    []
  );

  const addPhoto = useCallback(
    (estimateId: string, photo: Omit<EstimatePhoto, "id">) =>
      dispatch({
        type: "ADD_PHOTO",
        payload: {
          estimateId,
          photo: {
            ...photo,
            id: `photo-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          },
        },
      }),
    []
  );

  const removePhoto = useCallback(
    (estimateId: string, photoId: string) =>
      dispatch({ type: "REMOVE_PHOTO", payload: { estimateId, photoId } }),
    []
  );

  return (
    <EstimatesContext.Provider
      value={{ state, getEstimate, updateStatus, addLine, removeLine, updateLine, setLines, addPhoto, removePhoto }}
    >
      {children}
    </EstimatesContext.Provider>
  );
}

export function useEstimates() {
  const ctx = useContext(EstimatesContext);
  if (!ctx) throw new Error("useEstimates must be inside EstimatesProvider");
  return ctx;
}
