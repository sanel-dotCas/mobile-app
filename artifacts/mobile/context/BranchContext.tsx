import React, { createContext, useContext, useEffect, useState } from "react";
import { Platform } from "react-native";

const BASE =
  Platform.OS === "web"
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/api`
    : "/api";

export interface BranchLocation {
  id: number;
  name: string;
  type: string;
  city: string | null;
}

interface BranchContextValue {
  locations: BranchLocation[];
  selectedBranchId: number | null;
  setSelectedBranchId: (id: number | null) => void;
  branchParam: string;
}

const BranchContext = createContext<BranchContextValue>({
  locations: [],
  selectedBranchId: null,
  setSelectedBranchId: () => {},
  branchParam: "",
});

export function BranchProvider({ children }: { children: React.ReactNode }) {
  const [locations, setLocations] = useState<BranchLocation[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<number | null>(null);

  useEffect(() => {
    fetch(`${BASE}/admin/locations`)
      .then(r => (r.ok ? r.json() : []))
      .then(d => setLocations(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, []);

  const branchParam = selectedBranchId != null ? `&locationId=${selectedBranchId}` : "";

  return (
    <BranchContext.Provider value={{ locations, selectedBranchId, setSelectedBranchId, branchParam }}>
      {children}
    </BranchContext.Provider>
  );
}

export function useBranch() {
  return useContext(BranchContext);
}
