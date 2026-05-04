import { pgTable, text, integer, timestamp, jsonb, numeric } from "drizzle-orm/pg-core";

export const jobOdometerCorrectionsTable = pgTable("job_odometer_corrections", {
  jobId: text("job_id").primaryKey(),
  odometer: integer("odometer").notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const jobsTable = pgTable("jobs", {
  id: text("id").primaryKey(),
  estimateNumber: text("estimate_number").notNull(),
  licensePlate: text("license_plate").notNull().default(""),
  vehicleYear: text("vehicle_year"),
  vehicleMake: text("vehicle_make"),
  vehicleModel: text("vehicle_model"),
  serviceAdvisor: text("service_advisor").notNull().default(""),
  totalEstimatedHours: numeric("total_estimated_hours", { precision: 6, scale: 2 }).notNull().default("0"),
  workedHours: numeric("worked_hours", { precision: 6, scale: 2 }).notNull().default("0"),
  customerNotes: text("customer_notes").notNull().default(""),
  odometer: integer("odometer").notNull().default(0),
  appointmentDate: text("appointment_date").notNull(),
  status: text("status").notNull().default("pending"),
  thumbnail: text("thumbnail"),
  progress: integer("progress").notNull().default(0),
  assignedTechnicianId: text("assigned_technician_id"),
  currentStageId: text("current_stage_id").notNull().default("stage-001"),
  tasks: jsonb("tasks").notNull().$type<unknown[]>().default([]),
  notes: jsonb("notes").notNull().$type<unknown[]>().default([]),
  inspections: jsonb("inspections").notNull().$type<unknown[]>().default([]),
  stageHistory: jsonb("stage_history").notNull().$type<unknown[]>().default([]),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
