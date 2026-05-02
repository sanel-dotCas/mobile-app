export interface ChecklistItem {
  id: string;
  title: string;
  defaultHours: number;
}

export interface ChecklistSection {
  id: string;
  title: string;
  icon: string;
  color: string;
  items: ChecklistItem[];
}

export const VEHICLE_CHECKLIST: ChecklistSection[] = [
  {
    id: "engine",
    title: "Engine & Powertrain",
    icon: "settings",
    color: "#dc2626",
    items: [
      { id: "eng-001", title: "Engine Oil Level & Condition",    defaultHours: 0.10 },
      { id: "eng-002", title: "Coolant Level & Condition",       defaultHours: 0.10 },
      { id: "eng-003", title: "Engine Air Filter",               defaultHours: 0.10 },
      { id: "eng-004", title: "Drive Belt Condition",            defaultHours: 0.15 },
      { id: "eng-005", title: "Timing Belt / Chain Status",      defaultHours: 0.15 },
      { id: "eng-006", title: "PCV Valve Condition",             defaultHours: 0.10 },
    ],
  },
  {
    id: "brakes",
    title: "Brakes & Wheels",
    icon: "disc",
    color: "#7c3aed",
    items: [
      { id: "brk-001", title: "Front Brake Pad Thickness",       defaultHours: 0.15 },
      { id: "brk-002", title: "Rear Brake Pad Thickness",        defaultHours: 0.15 },
      { id: "brk-003", title: "Front Brake Rotor Condition",     defaultHours: 0.20 },
      { id: "brk-004", title: "Rear Brake Rotor Condition",      defaultHours: 0.20 },
      { id: "brk-005", title: "Brake Fluid Level & Condition",   defaultHours: 0.10 },
      { id: "brk-006", title: "Brake Lines & Hoses Visual",      defaultHours: 0.20 },
      { id: "brk-007", title: "Caliper Operation",               defaultHours: 0.15 },
      { id: "brk-008", title: "Parking Brake Operation",         defaultHours: 0.10 },
    ],
  },
  {
    id: "suspension",
    title: "Suspension & Steering",
    icon: "sliders",
    color: "#0284c7",
    items: [
      { id: "sus-001", title: "Front Shock / Strut Condition",   defaultHours: 0.20 },
      { id: "sus-002", title: "Rear Shock / Strut Condition",    defaultHours: 0.20 },
      { id: "sus-003", title: "Ball Joint Play",                 defaultHours: 0.15 },
      { id: "sus-004", title: "Tie Rod End Play",                defaultHours: 0.15 },
      { id: "sus-005", title: "Wheel Bearing Play & Noise",      defaultHours: 0.15 },
      { id: "sus-006", title: "Steering Play & Alignment",       defaultHours: 0.15 },
      { id: "sus-007", title: "CV Boot Condition",               defaultHours: 0.15 },
    ],
  },
  {
    id: "electrical",
    title: "Electrical & Lighting",
    icon: "zap",
    color: "#d97706",
    items: [
      { id: "elc-001", title: "Battery Voltage & Load Test",     defaultHours: 0.20 },
      { id: "elc-002", title: "Alternator Output Check",         defaultHours: 0.15 },
      { id: "elc-003", title: "Headlights (High & Low Beam)",    defaultHours: 0.10 },
      { id: "elc-004", title: "Tail & Brake Lights",             defaultHours: 0.10 },
      { id: "elc-005", title: "Turn Signals & Hazards",          defaultHours: 0.10 },
      { id: "elc-006", title: "Dashboard Warning Lights",        defaultHours: 0.10 },
      { id: "elc-007", title: "OBD-II Fault Codes",              defaultHours: 0.20 },
    ],
  },
  {
    id: "fluids",
    title: "Fluids & Filters",
    icon: "droplet",
    color: "#2563eb",
    items: [
      { id: "fld-001", title: "Power Steering Fluid Level",      defaultHours: 0.10 },
      { id: "fld-002", title: "Transmission Fluid Level",        defaultHours: 0.10 },
      { id: "fld-003", title: "Differential / Transfer Case",    defaultHours: 0.10 },
      { id: "fld-004", title: "Windshield Washer Fluid",         defaultHours: 0.05 },
      { id: "fld-005", title: "Fuel Filter Condition",           defaultHours: 0.10 },
      { id: "fld-006", title: "Cabin Air Filter",                defaultHours: 0.10 },
    ],
  },
  {
    id: "tyres",
    title: "Tyres",
    icon: "circle",
    color: "#64748b",
    items: [
      { id: "tyr-001", title: "Front Left Tyre Tread",           defaultHours: 0.10 },
      { id: "tyr-002", title: "Front Right Tyre Tread",          defaultHours: 0.10 },
      { id: "tyr-003", title: "Rear Left Tyre Tread",            defaultHours: 0.10 },
      { id: "tyr-004", title: "Rear Right Tyre Tread",           defaultHours: 0.10 },
      { id: "tyr-005", title: "Tyre Pressures (all 4)",          defaultHours: 0.10 },
      { id: "tyr-006", title: "Tyre Sidewall Condition",         defaultHours: 0.10 },
    ],
  },
  {
    id: "safety",
    title: "Safety & Body",
    icon: "shield",
    color: "#16a34a",
    items: [
      { id: "bod-001", title: "Seat Belt Operation (all)",       defaultHours: 0.10 },
      { id: "bod-002", title: "Horn Operation",                  defaultHours: 0.05 },
      { id: "bod-003", title: "Wiper Blade Condition",           defaultHours: 0.10 },
      { id: "bod-004", title: "Exhaust System Visual",           defaultHours: 0.20 },
      { id: "bod-005", title: "Underbody Rust / Damage",         defaultHours: 0.20 },
      { id: "bod-006", title: "Windshield & Glass Condition",    defaultHours: 0.10 },
    ],
  },
];

export const TOTAL_TEMPLATE_ITEMS = VEHICLE_CHECKLIST.reduce((s, sec) => s + sec.items.length, 0);
