import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useReducer } from "react";

export interface ProductionStage {
  id: string;
  name: string;
  color: string;
  icon: string;
  expectedHours: number;
  order: number;
}

export const DEFAULT_STAGES: ProductionStage[] = [
  { id: "stage-001", name: "Reception",         color: "#6366f1", icon: "inbox",        expectedHours: 0.5, order: 0 },
  { id: "stage-002", name: "Diagnosis",          color: "#0284c7", icon: "search",       expectedHours: 1.0, order: 1 },
  { id: "stage-003", name: "Repair",             color: "#d97706", icon: "tool",         expectedHours: 3.0, order: 2 },
  { id: "stage-004", name: "QC Check",           color: "#7c3aed", icon: "check-square", expectedHours: 0.5, order: 3 },
  { id: "stage-005", name: "Ready for Delivery", color: "#16a34a", icon: "package",      expectedHours: 0.5, order: 4 },
];

type StageAction =
  | { type: "SET_STAGES"; payload: ProductionStage[] }
  | { type: "ADD_STAGE"; payload: Omit<ProductionStage, "id" | "order"> }
  | { type: "UPDATE_STAGE"; payload: ProductionStage }
  | { type: "DELETE_STAGE"; payload: string }
  | { type: "MOVE_UP"; payload: string }
  | { type: "MOVE_DOWN"; payload: string };

function stagesReducer(state: ProductionStage[], action: StageAction): ProductionStage[] {
  switch (action.type) {
    case "SET_STAGES": return action.payload;
    case "ADD_STAGE": {
      const maxOrder = state.reduce((m, s) => Math.max(m, s.order), -1);
      return [...state, { ...action.payload, id: `stage-${Date.now()}`, order: maxOrder + 1 }];
    }
    case "UPDATE_STAGE":
      return state.map((s) => (s.id === action.payload.id ? action.payload : s));
    case "DELETE_STAGE":
      return state.filter((s) => s.id !== action.payload);
    case "MOVE_UP": {
      const sorted = [...state].sort((a, b) => a.order - b.order);
      const idx = sorted.findIndex((s) => s.id === action.payload);
      if (idx <= 0) return state;
      const aOrder = sorted[idx].order;
      const bOrder = sorted[idx - 1].order;
      return state.map((s) =>
        s.id === sorted[idx].id ? { ...s, order: bOrder } :
        s.id === sorted[idx - 1].id ? { ...s, order: aOrder } : s
      );
    }
    case "MOVE_DOWN": {
      const sorted = [...state].sort((a, b) => a.order - b.order);
      const idx = sorted.findIndex((s) => s.id === action.payload);
      if (idx < 0 || idx >= sorted.length - 1) return state;
      const aOrder = sorted[idx].order;
      const bOrder = sorted[idx + 1].order;
      return state.map((s) =>
        s.id === sorted[idx].id ? { ...s, order: bOrder } :
        s.id === sorted[idx + 1].id ? { ...s, order: aOrder } : s
      );
    }
    default: return state;
  }
}

interface StagesContextValue {
  stages: ProductionStage[];
  sortedStages: ProductionStage[];
  addStage: (stage: Omit<ProductionStage, "id" | "order">) => void;
  updateStage: (stage: ProductionStage) => void;
  deleteStage: (id: string) => void;
  moveUp: (id: string) => void;
  moveDown: (id: string) => void;
  getStage: (id: string) => ProductionStage | undefined;
}

const StagesContext = createContext<StagesContextValue | null>(null);

export function StagesProvider({ children }: { children: React.ReactNode }) {
  const [stages, dispatch] = useReducer(stagesReducer, DEFAULT_STAGES);

  useEffect(() => {
    AsyncStorage.getItem("stages_v1").then((data) => {
      if (data) { try { dispatch({ type: "SET_STAGES", payload: JSON.parse(data) }); } catch {} }
    });
  }, []);

  useEffect(() => { AsyncStorage.setItem("stages_v1", JSON.stringify(stages)); }, [stages]);

  const sortedStages = [...stages].sort((a, b) => a.order - b.order);
  const addStage = useCallback((stage: Omit<ProductionStage, "id" | "order">) => dispatch({ type: "ADD_STAGE", payload: stage }), []);
  const updateStage = useCallback((stage: ProductionStage) => dispatch({ type: "UPDATE_STAGE", payload: stage }), []);
  const deleteStage = useCallback((id: string) => dispatch({ type: "DELETE_STAGE", payload: id }), []);
  const moveUp = useCallback((id: string) => dispatch({ type: "MOVE_UP", payload: id }), []);
  const moveDown = useCallback((id: string) => dispatch({ type: "MOVE_DOWN", payload: id }), []);
  const getStage = useCallback((id: string) => stages.find((s) => s.id === id), [stages]);

  return (
    <StagesContext.Provider value={{ stages, sortedStages, addStage, updateStage, deleteStage, moveUp, moveDown, getStage }}>
      {children}
    </StagesContext.Provider>
  );
}

export function useStages() {
  const ctx = useContext(StagesContext);
  if (!ctx) throw new Error("useStages must be used within StagesProvider");
  return ctx;
}
