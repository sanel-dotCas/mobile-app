import {
  pgTable,
  serial,
  text,
  integer,
  boolean,
  timestamp,
  numeric,
  pgEnum,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// ── Enums ────────────────────────────────────────────────────────────────────
export const yardLocationTypeEnum = pgEnum("yard_location_type", [
  "DEALERSHIP_LOT",
  "YARD",
  "PARKING_AREA",
  "PORT",
]);

export const yardZoneTypeEnum = pgEnum("yard_zone_type", [
  "SHOWROOM_FRONT",
  "NEW_INVENTORY",
  "PDI_QUEUE",
  "STANDARD",
  "RECEIVING",
  "OVERFLOW",
]);

export const yardSpotStatusEnum = pgEnum("yard_spot_status", [
  "available",
  "occupied",
  "reserved",
  "disabled",
]);

export const yardVehicleStatusEnum = pgEnum("yard_vehicle_status", [
  "available",
  "in_transit",
  "pdi_pending",
  "sold",
]);

export const yardVehicleConditionEnum = pgEnum("yard_vehicle_condition", [
  "new",
  "used",
]);

export const yardUserRoleEnum = pgEnum("yard_user_role", [
  "yard_manager",
  "yard_operator",
  "admin",
]);

export const yardInspectionTypeEnum = pgEnum("yard_inspection_type", [
  "pre-inspection",
  "secondary",
  "final-quality",
]);

export const yardInspectionStatusEnum = pgEnum("yard_inspection_status", [
  "finished",
  "in-progress",
  "queued",
]);

// ── Tables ───────────────────────────────────────────────────────────────────
export const yardUsersTable = pgTable("yard_users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  name: text("name").notNull(),
  role: yardUserRoleEnum("role").notNull().default("yard_operator"),
  locationId: integer("location_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const yardLocationsTable = pgTable("yard_locations", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  type: yardLocationTypeEnum("type").notNull(),
  city: text("city").notNull(),
  address: text("address"),
  totalCapacity: integer("total_capacity").notNull().default(0),
  autoChecks: boolean("auto_checks").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const yardZonesTable = pgTable("yard_zones", {
  id: serial("id").primaryKey(),
  locationId: integer("location_id").notNull(),
  name: text("name").notNull(),
  type: yardZoneTypeEnum("type").notNull().default("STANDARD"),
  isPremium: boolean("is_premium").notNull().default(false),
  displayOrder: integer("display_order").notNull().default(0),
});

export const yardSpotsTable = pgTable("yard_spots", {
  id: serial("id").primaryKey(),
  zoneId: integer("zone_id").notNull(),
  code: text("code").notNull(),
  status: yardSpotStatusEnum("status").notNull().default("available"),
  vehicleId: integer("vehicle_id"),
  reservedUntil: text("reserved_until"),
  dimensions: text("dimensions"),
  notes: text("notes"),
  spotType: text("spot_type"),
  assignedAt: timestamp("assigned_at"),
});

export const yardVehiclesTable = pgTable("yard_vehicles", {
  id: serial("id").primaryKey(),
  vin: text("vin").notNull().unique(),
  stockNumber: text("stock_number").notNull(),
  make: text("make").notNull(),
  model: text("model").notNull(),
  year: integer("year").notNull(),
  color: text("color"),
  mileage: integer("mileage"),
  condition: yardVehicleConditionEnum("condition"),
  status: yardVehicleStatusEnum("status").notNull().default("available"),
  locationId: integer("location_id"),
  spotId: integer("spot_id"),
  price: numeric("price", { precision: 10, scale: 2 }),
  imageUrl: text("image_url"),
  arrivedAt: timestamp("arrived_at"),
  inspectionIntervalDays: integer("inspection_interval_days").notNull().default(30),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const yardInspectionsTable = pgTable("yard_inspections", {
  id: serial("id").primaryKey(),
  inspectionNumber: text("inspection_number").notNull().unique(),
  vehicleId: integer("vehicle_id").notNull(),
  locationId: integer("location_id"),
  type: yardInspectionTypeEnum("type").notNull(),
  status: yardInspectionStatusEnum("status").notNull().default("queued"),
  notes: text("notes"),
  bodyDamage: text("body_damage"),
  fuelPercentage: integer("fuel_percentage"),
  assignedTo: text("assigned_to"),
  assignedAt: timestamp("assigned_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
});

export const yardMovementsTable = pgTable("yard_movements", {
  id: serial("id").primaryKey(),
  locationId: integer("location_id").notNull(),
  vehicleId: integer("vehicle_id"),
  vehicleName: text("vehicle_name"),
  action: text("action").notNull(),
  actor: text("actor").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ── Insert schemas ────────────────────────────────────────────────────────────
export const insertYardUserSchema = createInsertSchema(yardUsersTable).omit({
  id: true,
  createdAt: true,
});
export const insertYardLocationSchema = createInsertSchema(
  yardLocationsTable
).omit({ id: true, createdAt: true });
export const insertYardZoneSchema = createInsertSchema(yardZonesTable).omit({
  id: true,
});
export const insertYardSpotSchema = createInsertSchema(yardSpotsTable).omit({
  id: true,
});
export const insertYardVehicleSchema = createInsertSchema(
  yardVehiclesTable
).omit({ id: true, createdAt: true });
export const insertYardInspectionSchema = createInsertSchema(
  yardInspectionsTable
).omit({ id: true, createdAt: true });
export const insertYardMovementSchema = createInsertSchema(
  yardMovementsTable
).omit({ id: true });

// ── Types ─────────────────────────────────────────────────────────────────────
export type YardUser = typeof yardUsersTable.$inferSelect;
export type InsertYardUser = z.infer<typeof insertYardUserSchema>;
export type YardLocation = typeof yardLocationsTable.$inferSelect;
export type YardZone = typeof yardZonesTable.$inferSelect;
export type YardSpot = typeof yardSpotsTable.$inferSelect;
export type YardVehicle = typeof yardVehiclesTable.$inferSelect;
export type YardInspection = typeof yardInspectionsTable.$inferSelect;
export type YardMovement = typeof yardMovementsTable.$inferSelect;
