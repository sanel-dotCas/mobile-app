import { pgTable, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const techniciansTable = pgTable("technicians", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  role: text("role").notNull(),
  avatar: text("avatar").notNull(),
  userCode: text("user_code").notNull().unique(),
  status: text("status").notNull().default("idle"),
  specializations: text("specializations").array().notNull().default([]),
  completedJobs: integer("completed_jobs").notNull().default(0),
  weekHoursBooked: integer("week_hours_booked").notNull().default(0),
  monthHoursBooked: integer("month_hours_booked").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertTechnicianSchema = createInsertSchema(techniciansTable).omit({
  createdAt: true,
  updatedAt: true,
});

export const updateTechnicianStatusSchema = z.object({
  status: z.enum(["active", "idle", "break", "absent"]),
});

export type InsertTechnician = z.infer<typeof insertTechnicianSchema>;
export type Technician = typeof techniciansTable.$inferSelect;
