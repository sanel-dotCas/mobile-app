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
  useWindowDimensions,
} from "react-native";
import Svg, {
  Circle,
  G,
  Path,
  Polygon,
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
//
// ViewBox: 0 0 200 340  |  REAR = top (y≈0)  FRONT = bottom (y≈340)
// Car silhouette has realistic wheel-arch bumps on the sides.
// Zones are proper car-panel polygons, not plain rectangles.

// Polygon point strings for each zone (top-down sedan view)
const ZONE_POLYS: Record<string, string> = {
  "rear-bumper":      "30,6 170,6 180,22 20,22",
  "boot-lid":         "20,22 180,22 186,78 14,78",
  "left-rear-door":   "14,78 46,78 46,165 14,165",
  "rear-windshield":  "46,78 154,78 156,108 44,108",
  "right-rear-door":  "186,78 154,78 154,165 186,165",
  "roof":             "44,108 156,108 156,165 44,165",
  "left-front-door":  "14,165 46,165 46,230 14,230",
  "windshield":       "44,165 156,165 150,195 50,195",
  "right-front-door": "186,165 154,165 154,230 186,230",
  "left-fender":      "14,230 46,230 44,308 22,308",
  "hood":             "50,195 150,195 156,308 44,308",
  "right-fender":     "186,230 154,230 156,308 178,308",
  "front-bumper":     "22,308 178,308 170,330 30,330",
};

// [x, y, fontSize] for each zone label
const ZONE_LABEL_POS: Record<string, [number, number, number]> = {
  "rear-bumper":      [100, 15,  5.5],
  "boot-lid":         [100, 50,  6.5],
  "left-rear-door":   [30,  118, 5.0],
  "rear-windshield":  [100, 93,  6.0],
  "right-rear-door":  [170, 118, 5.0],
  "roof":             [100, 137, 7.0],
  "left-front-door":  [30,  197, 5.0],
  "windshield":       [100, 178, 6.0],
  "right-front-door": [170, 197, 5.0],
  "left-fender":      [30,  268, 5.0],
  "hood":             [100, 252, 7.0],
  "right-fender":     [170, 268, 5.0],
  "front-bumper":     [100, 319, 5.5],
};

// Zones that represent glass (get a blue glass tint when unselected)
const GLASS_ZONES = new Set(["windshield", "rear-windshield"]);

function CarSvgDiagram({
  selectedZoneId,
  onZonePress,
}: {
  selectedZoneId: string | null;
  onZonePress: (id: string) => void;
}) {
  const { width } = useWindowDimensions();
  // Explicit pixel dimensions — fixes the "0 height" collapse on React Native
  const svgW = Math.min(width - 32, 340);
  const svgH = Math.round(svgW * 340 / 200);

  return (
    <Svg width={svgW} height={svgH} viewBox="0 0 200 340">

      {/* ── Realistic car body outline with wheel-arch bumps ── */}
      <Path
        d={[
          "M30,6 C100,2 100,2 170,6",          // rear bumper curve
          "Q188,8 190,22 L190,76",              // rear-right corner → right side
          "C196,82 198,91 198,100",             // right rear arch (out)
          "C198,109 196,118 190,124",           // right rear arch (in)
          "L190,216",                           // right side, between arches
          "C196,222 198,231 198,240",           // right front arch (out)
          "C198,249 196,258 190,264",           // right front arch (in)
          "L190,314 Q188,328 170,330",          // right side → front-right corner
          "C100,334 100,334 30,330",            // front bumper curve
          "Q12,328 10,314 L10,264",             // front-left corner → left side
          "C4,258 2,249 2,240",                 // left front arch (out)
          "C2,231 4,222 10,216",               // left front arch (in)
          "L10,124",                            // left side, between arches
          "C4,118 2,109 2,100",                 // left rear arch (out)
          "C2,91 4,82 10,76",                   // left rear arch (in)
          "L10,22 Q12,8 30,6 Z",               // rear-left corner → close
        ].join(" ")}
        fill="#f1f5f9"
        stroke="#64748b"
        strokeWidth="1.5"
      />

      {/* ── Panel zones ── */}
      {DIAGRAM_ZONES.map((zone) => {
        const pts = ZONE_POLYS[zone.id];
        if (!pts) return null;
        const isSelected = zone.id === selectedZoneId;
        const isGlass    = GLASS_ZONES.has(zone.id);
        const lp         = ZONE_LABEL_POS[zone.id];

        const fillColor   = isSelected ? zone.color : isGlass ? "#bfdbfe" : zone.bg;
        const strokeColor = isGlass && !isSelected ? "#93c5fd" : zone.color;

        return (
          <G key={zone.id} onPress={() => onZonePress(zone.id)}>
            <Polygon
              points={pts}
              fill={fillColor}
              stroke={strokeColor}
              strokeWidth={isSelected ? 2.5 : 1}
              opacity={isSelected ? 1 : 0.88}
            />
            {lp && zone.label.split("\n").map((line, i, arr) => (
              <SvgText
                key={i}
                x={lp[0]}
                y={lp[1] + (i - (arr.length - 1) / 2) * 7}
                textAnchor="middle"
                fontSize={lp[2]}
                fontWeight={isSelected ? "700" : "600"}
                fill={isSelected ? "#fff" : isGlass ? "#1e40af" : zone.color}
              >
                {line}
              </SvgText>
            ))}
          </G>
        );
      })}

      {/* ── Structural detail lines ── */}
      {/* B-pillar (front/rear door split) */}
      <Path d="M14,165 L46,165"   stroke="#64748b" strokeWidth="1.5" />
      <Path d="M154,165 L186,165" stroke="#64748b" strokeWidth="1.5" />
      {/* Hood centre crease */}
      <Path d="M100,200 L100,305" stroke="#94a3b8" strokeWidth="0.8" strokeDasharray="4,3" />
      {/* Boot lid centre crease */}
      <Path d="M100,26 L100,75"   stroke="#94a3b8" strokeWidth="0.8" strokeDasharray="4,3" />

      {/* ── Wheel arches (drawn over panels so they always show) ── */}
      {/* Tyres */}
      <Circle cx="12"  cy="100" r="13" fill="#334155" stroke="#1e293b" strokeWidth="1" opacity={0.9} />
      <Circle cx="188" cy="100" r="13" fill="#334155" stroke="#1e293b" strokeWidth="1" opacity={0.9} />
      <Circle cx="12"  cy="240" r="13" fill="#334155" stroke="#1e293b" strokeWidth="1" opacity={0.9} />
      <Circle cx="188" cy="240" r="13" fill="#334155" stroke="#1e293b" strokeWidth="1" opacity={0.9} />
      {/* Rims */}
      <Circle cx="12"  cy="100" r="6.5" fill="#64748b" stroke="#475569" strokeWidth="0.8" />
      <Circle cx="188" cy="100" r="6.5" fill="#64748b" stroke="#475569" strokeWidth="0.8" />
      <Circle cx="12"  cy="240" r="6.5" fill="#64748b" stroke="#475569" strokeWidth="0.8" />
      <Circle cx="188" cy="240" r="6.5" fill="#64748b" stroke="#475569" strokeWidth="0.8" />

      {/* ── Direction labels ── */}
      <SvgText x="100" y="3.5" textAnchor="middle" fontSize="4" fill="#94a3b8" fontWeight="600">▲ REAR</SvgText>
      <SvgText x="100" y="337" textAnchor="middle" fontSize="4" fill="#94a3b8" fontWeight="600">▼ FRONT</SvgText>
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
