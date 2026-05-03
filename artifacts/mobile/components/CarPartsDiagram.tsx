import { Feather } from "@expo/vector-icons";
import React, { useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Svg, {
  Circle,
  G,
  Path,
  Rect,
  Text as SvgText,
} from "react-native-svg";

import type { EstimateLine, LaborCategory } from "@/context/EstimatesContext";
import { useColors } from "@/hooks/useColors";

// ─── Types ───────────────────────────────────────────────────────────────────

interface ZonePart {
  name: string;
  type: "part" | "labor" | "material";
  unitPrice: number;
  hours?: number;
  qty?: number;
  laborCategory?: LaborCategory;
}

interface DiagramZone {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
  color: string;
  bg: string;
}

export interface CarPartsDiagramProps {
  vehicle: string;
  make: string;
  model: string;
  year: string;
  currency: string;
  onAddPart: (line: Omit<EstimateLine, "id">) => void;
}

// ─── Car Zone Geometry (ViewBox 0 0 200 340, FRONT=bottom, REAR=top) ─────────

const DIAGRAM_ZONES: DiagramZone[] = [
  { id: "rear-bumper",      x: 22,  y: 4,   w: 156, h: 22,  label: "Rear Bumper",     color: "#dc2626", bg: "#fecaca" },
  { id: "boot-lid",         x: 28,  y: 26,  w: 144, h: 55,  label: "Boot Lid",        color: "#ea580c", bg: "#fed7aa" },
  { id: "left-rear-door",   x: 4,   y: 81,  w: 43,  h: 84,  label: "L Rear\nDoor",   color: "#7c3aed", bg: "#ede9fe" },
  { id: "rear-windshield",  x: 47,  y: 81,  w: 106, h: 28,  label: "Rear Screen",    color: "#0284c7", bg: "#bae6fd" },
  { id: "right-rear-door",  x: 153, y: 81,  w: 43,  h: 84,  label: "R Rear\nDoor",   color: "#7c3aed", bg: "#ede9fe" },
  { id: "roof",             x: 47,  y: 109, w: 106, h: 56,  label: "Roof",            color: "#2563eb", bg: "#dbeafe" },
  { id: "left-front-door",  x: 4,   y: 165, w: 43,  h: 80,  label: "L Front\nDoor",  color: "#4f46e5", bg: "#e0e7ff" },
  { id: "windshield",       x: 47,  y: 165, w: 106, h: 30,  label: "Windshield",     color: "#0369a1", bg: "#e0f2fe" },
  { id: "right-front-door", x: 153, y: 165, w: 43,  h: 80,  label: "R Front\nDoor",  color: "#4f46e5", bg: "#e0e7ff" },
  { id: "left-fender",      x: 4,   y: 245, w: 43,  h: 62,  label: "L\nFender",      color: "#047857", bg: "#d1fae5" },
  { id: "hood",             x: 47,  y: 195, w: 106, h: 78,  label: "Hood",            color: "#d97706", bg: "#fef3c7" },
  { id: "right-fender",     x: 153, y: 245, w: 43,  h: 62,  label: "R\nFender",      color: "#047857", bg: "#d1fae5" },
  { id: "front-bumper",     x: 22,  y: 307, w: 156, h: 24,  label: "Front Bumper",   color: "#dc2626", bg: "#fecaca" },
];

// ─── Parts Catalog by Zone ────────────────────────────────────────────────────

const ZONE_CATALOG: Record<string, ZonePart[]> = {
  "front-bumper": [
    { name: "Front Bumper Assembly (OEM)",       type: "part",     qty: 1, unitPrice: 450 },
    { name: "Front Bumper Cover (Aftermarket)",  type: "part",     qty: 1, unitPrice: 220 },
    { name: "Bumper Absorber / Foam Insert",     type: "part",     qty: 1, unitPrice: 85 },
    { name: "Front Grille Assembly",             type: "part",     qty: 1, unitPrice: 145 },
    { name: "Fog Lamp Assembly (each)",          type: "part",     qty: 1, unitPrice: 145 },
    { name: "Front Parking Sensors (set of 4)", type: "part",     qty: 1, unitPrice: 195 },
    { name: "Bumper Retainer Clips Set",         type: "part",     qty: 1, unitPrice: 25 },
    { name: "Bumper Removal & Refit",            type: "labor",    hours: 1.5, unitPrice: 95, laborCategory: "body" },
    { name: "Bumper Repair & Refinish",          type: "labor",    hours: 2.5, unitPrice: 95, laborCategory: "refinish" },
    { name: "Paint & Primer — Front Bumper",     type: "material", qty: 1, unitPrice: 85 },
  ],
  "hood": [
    { name: "Hood / Bonnet Assembly (OEM)",      type: "part",     qty: 1, unitPrice: 780 },
    { name: "Hood Gas Struts (pair)",            type: "part",     qty: 1, unitPrice: 65 },
    { name: "Hood Insulation Pad",               type: "part",     qty: 1, unitPrice: 85 },
    { name: "Hood Latch & Release Cable",        type: "part",     qty: 1, unitPrice: 75 },
    { name: "Hood Hinge (each)",                 type: "part",     qty: 1, unitPrice: 45 },
    { name: "Hood Remove & Replace",             type: "labor",    hours: 2.0, unitPrice: 95, laborCategory: "body" },
    { name: "Hood Straighten & Repair",          type: "labor",    hours: 4.0, unitPrice: 95, laborCategory: "body" },
    { name: "Hood Refinish",                     type: "labor",    hours: 3.0, unitPrice: 95, laborCategory: "refinish" },
    { name: "Paint & Primer — Hood",             type: "material", qty: 1, unitPrice: 165 },
  ],
  "windshield": [
    { name: "Windshield (OEM)",                  type: "part",     qty: 1, unitPrice: 650 },
    { name: "Windshield (Aftermarket)",          type: "part",     qty: 1, unitPrice: 380 },
    { name: "Windshield Moulding Set",           type: "part",     qty: 1, unitPrice: 85 },
    { name: "Rain / Light Sensor Bracket",       type: "part",     qty: 1, unitPrice: 55 },
    { name: "Windshield Wiper Arm (each)",       type: "part",     qty: 1, unitPrice: 45 },
    { name: "Windshield Removal & Fitting",      type: "labor",    hours: 2.0, unitPrice: 95, laborCategory: "glass" },
    { name: "ADAS Camera Recalibration",         type: "labor",    hours: 1.0, unitPrice: 95, laborCategory: "electrical" },
    { name: "Windshield Adhesive & Primer Kit",  type: "material", qty: 1, unitPrice: 45 },
  ],
  "roof": [
    { name: "Roof Panel Replacement",            type: "part",     qty: 1, unitPrice: 1850 },
    { name: "Roof Lining / Headliner",           type: "part",     qty: 1, unitPrice: 320 },
    { name: "Roof Rails (pair)",                 type: "part",     qty: 1, unitPrice: 245 },
    { name: "Sunroof Assembly",                  type: "part",     qty: 1, unitPrice: 980 },
    { name: "Sunroof Drain Lines (set)",         type: "part",     qty: 1, unitPrice: 65 },
    { name: "Roof Panel Repair",                 type: "labor",    hours: 6.0, unitPrice: 95, laborCategory: "body" },
    { name: "Roof Refinish (full)",              type: "labor",    hours: 4.0, unitPrice: 95, laborCategory: "refinish" },
    { name: "Headliner Remove & Replace",        type: "labor",    hours: 3.0, unitPrice: 95, laborCategory: "trim" },
    { name: "Paint & Primer — Roof",             type: "material", qty: 1, unitPrice: 185 },
  ],
  "rear-windshield": [
    { name: "Rear Screen / Windshield (OEM)",    type: "part",     qty: 1, unitPrice: 480 },
    { name: "Rear Heated Screen Element",        type: "part",     qty: 1, unitPrice: 145 },
    { name: "Rear Wiper Motor",                  type: "part",     qty: 1, unitPrice: 85 },
    { name: "Rear Wiper Arm & Blade",            type: "part",     qty: 1, unitPrice: 35 },
    { name: "Rear Screen Removal & Fitting",     type: "labor",    hours: 1.5, unitPrice: 95, laborCategory: "glass" },
    { name: "Rear Screen Adhesive Kit",          type: "material", qty: 1, unitPrice: 35 },
  ],
  "boot-lid": [
    { name: "Boot Lid / Tailgate (OEM)",         type: "part",     qty: 1, unitPrice: 870 },
    { name: "Boot Lid Gas Struts (pair)",        type: "part",     qty: 1, unitPrice: 55 },
    { name: "Boot Lid Lock & Actuator",          type: "part",     qty: 1, unitPrice: 95 },
    { name: "Boot Lid Spoiler",                  type: "part",     qty: 1, unitPrice: 245 },
    { name: "Boot Lid Hinge (each)",             type: "part",     qty: 1, unitPrice: 55 },
    { name: "Number Plate Light",                type: "part",     qty: 1, unitPrice: 35 },
    { name: "Boot Lid Remove & Replace",         type: "labor",    hours: 2.5, unitPrice: 95, laborCategory: "body" },
    { name: "Boot Lid Straighten & Repair",      type: "labor",    hours: 4.0, unitPrice: 95, laborCategory: "body" },
    { name: "Boot Lid Refinish",                 type: "labor",    hours: 3.0, unitPrice: 95, laborCategory: "refinish" },
    { name: "Paint & Primer — Boot Lid",         type: "material", qty: 1, unitPrice: 165 },
  ],
  "rear-bumper": [
    { name: "Rear Bumper Assembly (OEM)",        type: "part",     qty: 1, unitPrice: 420 },
    { name: "Rear Bumper Cover",                 type: "part",     qty: 1, unitPrice: 195 },
    { name: "Rear Bumper Absorber",              type: "part",     qty: 1, unitPrice: 75 },
    { name: "Rear Parking Sensors (set of 4)",  type: "part",     qty: 1, unitPrice: 195 },
    { name: "Reverse / Backup Camera",           type: "part",     qty: 1, unitPrice: 145 },
    { name: "Tow Bar Assembly",                  type: "part",     qty: 1, unitPrice: 395 },
    { name: "Rear Bumper Remove & Replace",      type: "labor",    hours: 1.5, unitPrice: 95, laborCategory: "body" },
    { name: "Rear Bumper Repair & Refinish",     type: "labor",    hours: 2.5, unitPrice: 95, laborCategory: "refinish" },
    { name: "Paint & Primer — Rear Bumper",      type: "material", qty: 1, unitPrice: 85 },
  ],
  "left-front-door": [
    { name: "Front Door Shell LH (OEM)",         type: "part",     qty: 1, unitPrice: 680 },
    { name: "Front Door Skin LH",                type: "part",     qty: 1, unitPrice: 320 },
    { name: "Front Door Glass LH",               type: "part",     qty: 1, unitPrice: 245 },
    { name: "Door Handle Exterior LH",           type: "part",     qty: 1, unitPrice: 85 },
    { name: "Door Lock Actuator LH Front",       type: "part",     qty: 1, unitPrice: 95 },
    { name: "Side Mirror Assembly LH",           type: "part",     qty: 1, unitPrice: 185 },
    { name: "Window Regulator LH Front",         type: "part",     qty: 1, unitPrice: 145 },
    { name: "Door Trim Panel LH Front",          type: "part",     qty: 1, unitPrice: 165 },
    { name: "Front Door R&R LH",                 type: "labor",    hours: 3.0, unitPrice: 95, laborCategory: "body" },
    { name: "Door Skin Replacement LH",          type: "labor",    hours: 3.5, unitPrice: 95, laborCategory: "body" },
    { name: "Door Straighten & Repair LH",       type: "labor",    hours: 4.0, unitPrice: 95, laborCategory: "body" },
    { name: "Door Refinish LH",                  type: "labor",    hours: 2.5, unitPrice: 95, laborCategory: "refinish" },
    { name: "Paint & Primer — Front Door LH",    type: "material", qty: 1, unitPrice: 145 },
  ],
  "right-front-door": [
    { name: "Front Door Shell RH (OEM)",         type: "part",     qty: 1, unitPrice: 680 },
    { name: "Front Door Skin RH",                type: "part",     qty: 1, unitPrice: 320 },
    { name: "Front Door Glass RH",               type: "part",     qty: 1, unitPrice: 245 },
    { name: "Door Handle Exterior RH",           type: "part",     qty: 1, unitPrice: 85 },
    { name: "Door Lock Actuator RH Front",       type: "part",     qty: 1, unitPrice: 95 },
    { name: "Side Mirror Assembly RH",           type: "part",     qty: 1, unitPrice: 185 },
    { name: "Window Regulator RH Front",         type: "part",     qty: 1, unitPrice: 145 },
    { name: "Door Trim Panel RH Front",          type: "part",     qty: 1, unitPrice: 165 },
    { name: "Front Door R&R RH",                 type: "labor",    hours: 3.0, unitPrice: 95, laborCategory: "body" },
    { name: "Door Skin Replacement RH",          type: "labor",    hours: 3.5, unitPrice: 95, laborCategory: "body" },
    { name: "Door Straighten & Repair RH",       type: "labor",    hours: 4.0, unitPrice: 95, laborCategory: "body" },
    { name: "Door Refinish RH",                  type: "labor",    hours: 2.5, unitPrice: 95, laborCategory: "refinish" },
    { name: "Paint & Primer — Front Door RH",    type: "material", qty: 1, unitPrice: 145 },
  ],
  "left-rear-door": [
    { name: "Rear Door Shell LH (OEM)",          type: "part",     qty: 1, unitPrice: 640 },
    { name: "Rear Door Skin LH",                 type: "part",     qty: 1, unitPrice: 285 },
    { name: "Rear Door Glass LH",                type: "part",     qty: 1, unitPrice: 195 },
    { name: "Door Handle Exterior LH Rear",      type: "part",     qty: 1, unitPrice: 75 },
    { name: "Door Lock Actuator LH Rear",        type: "part",     qty: 1, unitPrice: 85 },
    { name: "Window Regulator LH Rear",          type: "part",     qty: 1, unitPrice: 125 },
    { name: "Rear Door R&R LH",                  type: "labor",    hours: 2.5, unitPrice: 95, laborCategory: "body" },
    { name: "Rear Door Skin Replacement LH",     type: "labor",    hours: 3.0, unitPrice: 95, laborCategory: "body" },
    { name: "Rear Door Straighten LH",           type: "labor",    hours: 3.5, unitPrice: 95, laborCategory: "body" },
    { name: "Rear Door Refinish LH",             type: "labor",    hours: 2.5, unitPrice: 95, laborCategory: "refinish" },
    { name: "Paint & Primer — Rear Door LH",     type: "material", qty: 1, unitPrice: 145 },
  ],
  "right-rear-door": [
    { name: "Rear Door Shell RH (OEM)",          type: "part",     qty: 1, unitPrice: 640 },
    { name: "Rear Door Skin RH",                 type: "part",     qty: 1, unitPrice: 285 },
    { name: "Rear Door Glass RH",                type: "part",     qty: 1, unitPrice: 195 },
    { name: "Door Handle Exterior RH Rear",      type: "part",     qty: 1, unitPrice: 75 },
    { name: "Door Lock Actuator RH Rear",        type: "part",     qty: 1, unitPrice: 85 },
    { name: "Window Regulator RH Rear",          type: "part",     qty: 1, unitPrice: 125 },
    { name: "Rear Door R&R RH",                  type: "labor",    hours: 2.5, unitPrice: 95, laborCategory: "body" },
    { name: "Rear Door Skin Replacement RH",     type: "labor",    hours: 3.0, unitPrice: 95, laborCategory: "body" },
    { name: "Rear Door Straighten RH",           type: "labor",    hours: 3.5, unitPrice: 95, laborCategory: "body" },
    { name: "Rear Door Refinish RH",             type: "labor",    hours: 2.5, unitPrice: 95, laborCategory: "refinish" },
    { name: "Paint & Primer — Rear Door RH",     type: "material", qty: 1, unitPrice: 145 },
  ],
  "left-fender": [
    { name: "Front Fender / Wing LH (OEM)",      type: "part",     qty: 1, unitPrice: 380 },
    { name: "Front Fender LH (Aftermarket)",     type: "part",     qty: 1, unitPrice: 195 },
    { name: "Fender Liner / Inner Wing LH",      type: "part",     qty: 1, unitPrice: 65 },
    { name: "Headlamp Assembly LH",              type: "part",     qty: 1, unitPrice: 385 },
    { name: "Headlamp Bulb Set LH",              type: "part",     qty: 1, unitPrice: 85 },
    { name: "Indicator / Turn Signal LH",        type: "part",     qty: 1, unitPrice: 95 },
    { name: "Fender Straighten LH",              type: "labor",    hours: 3.0, unitPrice: 95, laborCategory: "body" },
    { name: "Fender Remove & Replace LH",        type: "labor",    hours: 2.5, unitPrice: 95, laborCategory: "body" },
    { name: "Fender Refinish LH",                type: "labor",    hours: 2.5, unitPrice: 95, laborCategory: "refinish" },
    { name: "Paint & Primer — Fender LH",        type: "material", qty: 1, unitPrice: 145 },
  ],
  "right-fender": [
    { name: "Front Fender / Wing RH (OEM)",      type: "part",     qty: 1, unitPrice: 380 },
    { name: "Front Fender RH (Aftermarket)",     type: "part",     qty: 1, unitPrice: 195 },
    { name: "Fender Liner / Inner Wing RH",      type: "part",     qty: 1, unitPrice: 65 },
    { name: "Headlamp Assembly RH",              type: "part",     qty: 1, unitPrice: 385 },
    { name: "Headlamp Bulb Set RH",              type: "part",     qty: 1, unitPrice: 85 },
    { name: "Indicator / Turn Signal RH",        type: "part",     qty: 1, unitPrice: 95 },
    { name: "Fender Straighten RH",              type: "labor",    hours: 3.0, unitPrice: 95, laborCategory: "body" },
    { name: "Fender Remove & Replace RH",        type: "labor",    hours: 2.5, unitPrice: 95, laborCategory: "body" },
    { name: "Fender Refinish RH",                type: "labor",    hours: 2.5, unitPrice: 95, laborCategory: "refinish" },
    { name: "Paint & Primer — Fender RH",        type: "material", qty: 1, unitPrice: 145 },
  ],
};

const ZONE_LABEL_MAP: Record<string, string> = {
  "front-bumper":      "Front Bumper",
  "hood":              "Hood / Bonnet",
  "windshield":        "Windshield",
  "roof":              "Roof",
  "rear-windshield":   "Rear Screen",
  "boot-lid":          "Boot Lid",
  "rear-bumper":       "Rear Bumper",
  "left-front-door":   "Left Front Door",
  "right-front-door":  "Right Front Door",
  "left-rear-door":    "Left Rear Door",
  "right-rear-door":   "Right Rear Door",
  "left-fender":       "Left Front Fender",
  "right-fender":      "Right Front Fender",
};

// ─── SVG Car Diagram Component ────────────────────────────────────────────────

function CarSvgDiagram({
  selectedZoneId,
  onZonePress,
}: {
  selectedZoneId: string | null;
  onZonePress: (id: string) => void;
}) {
  return (
    <Svg width="100%" viewBox="0 0 200 340" style={{ maxHeight: 280 }}>
      {/* Car body outline */}
      <Path
        d="M22 15 Q22 4 34 4 L166 4 Q178 4 178 15 L178 320 Q178 332 166 332 L34 332 Q22 332 22 320 Z"
        fill="#f8fafc"
        stroke="#cbd5e1"
        strokeWidth="1.5"
      />
      {/* Wheel wells */}
      <Circle cx="18"  cy="100" r="14" fill="#e2e8f0" stroke="#94a3b8" strokeWidth="1" />
      <Circle cx="182" cy="100" r="14" fill="#e2e8f0" stroke="#94a3b8" strokeWidth="1" />
      <Circle cx="18"  cy="240" r="14" fill="#e2e8f0" stroke="#94a3b8" strokeWidth="1" />
      <Circle cx="182" cy="240" r="14" fill="#e2e8f0" stroke="#94a3b8" strokeWidth="1" />

      {/* Direction arrow — REAR label */}
      <SvgText x="100" y="1.5" textAnchor="middle" fontSize="5" fill="#94a3b8">▲ REAR</SvgText>

      {/* Zone rects */}
      {DIAGRAM_ZONES.map((zone) => {
        const isSelected = zone.id === selectedZoneId;
        return (
          <G key={zone.id} onPress={() => onZonePress(zone.id)}>
            <Rect
              x={zone.x}
              y={zone.y}
              width={zone.w}
              height={zone.h}
              rx={4}
              fill={isSelected ? zone.color : zone.bg}
              stroke={zone.color}
              strokeWidth={isSelected ? 2 : 1}
              opacity={isSelected ? 1 : 0.85}
            />
            {zone.label.split("\n").map((line, i, arr) => (
              <SvgText
                key={i}
                x={zone.x + zone.w / 2}
                y={zone.y + zone.h / 2 + (i - (arr.length - 1) / 2) * 7}
                textAnchor="middle"
                fontSize={zone.w < 60 ? 5.5 : 6.5}
                fontWeight={isSelected ? "700" : "600"}
                fill={isSelected ? "#fff" : zone.color}
              >
                {line}
              </SvgText>
            ))}
          </G>
        );
      })}

      {/* FRONT label */}
      <SvgText x="100" y="339" textAnchor="middle" fontSize="5" fill="#94a3b8">▼ FRONT</SvgText>
    </Svg>
  );
}

// ─── Part Row ─────────────────────────────────────────────────────────────────

function PartRow({
  part,
  currency,
  onAdd,
}: {
  part: ZonePart;
  currency: string;
  onAdd: () => void;
}) {
  const colors = useColors();
  const typeColor = part.type === "part" ? "#7c3aed" : part.type === "labor" ? "#1d4ed8" : "#d97706";
  const typeBg    = part.type === "part" ? "#ede9fe" : part.type === "labor" ? "#dbeafe" : "#fef3c7";
  const typeLabel = part.type === "part" ? "Part" : part.type === "labor" ? "Labour" : "Material";
  const displayTotal = part.type === "labor"
    ? (part.hours ?? 1) * part.unitPrice
    : (part.qty ?? 1) * part.unitPrice;

  return (
    <View style={[st.partRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={{ flex: 1 }}>
        <View style={st.partRowTop}>
          <View style={[st.typeTag, { backgroundColor: typeBg }]}>
            <Text style={[st.typeTagText, { color: typeColor }]}>{typeLabel}</Text>
          </View>
          <Text style={[st.partName, { color: colors.foreground }]} numberOfLines={2}>
            {part.name}
          </Text>
        </View>
        <Text style={[st.partMeta, { color: colors.mutedForeground }]}>
          {part.type === "labor"
            ? `${part.hours}h × ${currency}${part.unitPrice}/h`
            : `Qty 1 × ${currency}${part.unitPrice}`}
          {"  "}
          <Text style={{ fontFamily: "Inter_700Bold", color: typeColor }}>
            {currency}{displayTotal.toFixed(2)}
          </Text>
        </Text>
      </View>
      <Pressable
        style={({ pressed }) => [st.addBtn, { backgroundColor: pressed ? "#1d3fb5" : "#1d4ed8" }]}
        onPress={onAdd}
      >
        <Feather name="plus" size={14} color="#fff" />
      </Pressable>
    </View>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function CarPartsDiagram({
  vehicle,
  make,
  model,
  year,
  currency,
  onAddPart,
}: CarPartsDiagramProps) {
  const colors = useColors();
  const [selectedZone, setSelectedZone] = useState<string | null>(null);
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());

  const zone = selectedZone ? DIAGRAM_ZONES.find((z) => z.id === selectedZone) : null;
  const parts = selectedZone ? (ZONE_CATALOG[selectedZone] ?? []) : [];

  const handleAdd = (part: ZonePart) => {
    const key = `${selectedZone}-${part.name}`;
    setAddedIds((prev) => new Set([...prev, key]));
    const total = part.type === "labor"
      ? (part.hours ?? 1) * part.unitPrice
      : (part.qty ?? 1) * part.unitPrice;
    onAddPart({
      type: part.type,
      laborCategory: part.laborCategory,
      description: part.name,
      hours: part.type === "labor" ? (part.hours ?? 1) : undefined,
      quantity: part.type !== "labor" ? (part.qty ?? 1) : undefined,
      unitPrice: part.unitPrice,
      total,
    });
  };

  return (
    <View style={{ flex: 1 }}>
      {/* Vehicle context bar */}
      <View style={[st.vehicleBar, { backgroundColor: "#eff6ff", borderColor: "#bfdbfe" }]}>
        <Feather name="truck" size={13} color="#1d4ed8" />
        <Text style={st.vehicleText}>{vehicle || `${year} ${make} ${model}`}</Text>
        <Text style={st.vehicleHint}>Tap a zone · select parts</Text>
      </View>

      {/* SVG diagram */}
      <View style={st.svgWrap}>
        <CarSvgDiagram selectedZoneId={selectedZone} onZonePress={setSelectedZone} />
      </View>

      {/* Zone label + parts list */}
      {selectedZone && zone ? (
        <View style={[st.partsPanel, { borderTopColor: colors.border }]}>
          <View style={[st.zoneHeader, { backgroundColor: zone.bg }]}>
            <View style={[st.zoneColorDot, { backgroundColor: zone.color }]} />
            <Text style={[st.zoneTitle, { color: zone.color }]}>
              {ZONE_LABEL_MAP[selectedZone] ?? zone.label}
            </Text>
            <Text style={[st.partCount, { color: zone.color }]}>{parts.length} items</Text>
          </View>
          <FlatList
            data={parts}
            keyExtractor={(p) => p.name}
            style={{ maxHeight: 260 }}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 8, gap: 6, paddingHorizontal: 12, paddingTop: 8 }}
            renderItem={({ item }) => {
              const key = `${selectedZone}-${item.name}`;
              const added = addedIds.has(key);
              return added ? (
                <View style={[st.partRow, { backgroundColor: "#dcfce7", borderColor: "#bbf7d0" }]}>
                  <Feather name="check-circle" size={14} color="#16a34a" style={{ marginTop: 2 }} />
                  <Text style={{ flex: 1, fontSize: 12, color: "#16a34a", fontFamily: "Inter_500Medium", marginLeft: 6 }}>
                    {item.name}
                  </Text>
                  <Text style={{ fontSize: 11, color: "#16a34a80", fontFamily: "Inter_400Regular" }}>Added</Text>
                </View>
              ) : (
                <PartRow part={item} currency={currency} onAdd={() => handleAdd(item)} />
              );
            }}
          />
        </View>
      ) : (
        <View style={[st.noZone, { borderTopColor: colors.border }]}>
          <Feather name="mouse-pointer" size={28} color={colors.mutedForeground} />
          <Text style={[st.noZoneText, { color: colors.mutedForeground }]}>
            Tap a panel on the diagram above to browse parts
          </Text>
        </View>
      )}
    </View>
  );
}

// ─── VIN Decoder Hook ─────────────────────────────────────────────────────────

interface VinInfo {
  make: string;
  model: string;
  year: string;
  trim: string;
  bodyClass: string;
  fuelType: string;
  engineSize: string;
  driveType: string;
}

export function useVinDecoder() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [vinInfo, setVinInfo] = useState<VinInfo | null>(null);

  const decode = async (vin: string) => {
    const clean = vin.trim().toUpperCase().replace(/[^A-HJ-NPR-Z0-9]/g, "");
    if (clean.length !== 17) {
      setError("VIN must be exactly 17 characters");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `https://vpic.nhtsa.dot.gov/api/vehicles/decodevin/${clean}?format=json`,
        { signal: AbortSignal.timeout(10000) }
      );
      if (!res.ok) throw new Error("Network error");
      const data = await res.json();
      const results: { Variable: string; Value: string | null }[] = data.Results ?? [];
      const get = (v: string) => results.find((r) => r.Variable === v)?.Value ?? "";

      const decoded: VinInfo = {
        make:       get("Make"),
        model:      get("Model"),
        year:       get("Model Year"),
        trim:       get("Trim") || get("Series"),
        bodyClass:  get("Body Class"),
        fuelType:   get("Fuel Type - Primary"),
        engineSize: get("Displacement (L)") ? `${get("Displacement (L)")}L` : get("Engine Number of Cylinders") ? `${get("Engine Number of Cylinders")}-cyl` : "",
        driveType:  get("Drive Type"),
      };

      if (!decoded.make || decoded.make === "0") {
        setError("VIN not found in database — check the number and try again");
        return;
      }
      setVinInfo(decoded);
    } catch {
      setError("Could not reach VIN database — check your connection");
    } finally {
      setLoading(false);
    }
  };

  const clear = () => { setVinInfo(null); setError(null); };

  return { decode, loading, error, vinInfo, clear };
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const st = StyleSheet.create({
  vehicleBar:  { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: 1 },
  vehicleText: { flex: 1, fontSize: 12, fontFamily: "Inter_600SemiBold", color: "#1d4ed8" },
  vehicleHint: { fontSize: 10, fontFamily: "Inter_400Regular", color: "#93c5fd" },

  svgWrap:     { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 },

  partsPanel:  { flex: 1, borderTopWidth: 1 },
  zoneHeader:  { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, paddingVertical: 8 },
  zoneColorDot:{ width: 10, height: 10, borderRadius: 5 },
  zoneTitle:   { flex: 1, fontSize: 13, fontFamily: "Inter_700Bold" },
  partCount:   { fontSize: 11, fontFamily: "Inter_400Regular" },

  noZone:      { flex: 1, alignItems: "center", justifyContent: "center", gap: 10, borderTopWidth: 1, paddingVertical: 32 },
  noZoneText:  { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center", maxWidth: 220 },

  partRow:     { flexDirection: "row", alignItems: "flex-start", gap: 8, padding: 10, borderRadius: 10, borderWidth: 1 },
  partRowTop:  { flexDirection: "row", alignItems: "flex-start", gap: 6, flexWrap: "wrap", marginBottom: 4 },
  typeTag:     { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5, alignSelf: "flex-start" },
  typeTagText: { fontSize: 9, fontFamily: "Inter_700Bold" },
  partName:    { flex: 1, fontSize: 12, fontFamily: "Inter_500Medium" },
  partMeta:    { fontSize: 11, fontFamily: "Inter_400Regular" },
  addBtn:      { width: 30, height: 30, borderRadius: 8, alignItems: "center", justifyContent: "center", alignSelf: "center" },
});
