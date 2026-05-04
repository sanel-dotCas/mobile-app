import { pgTable, text, integer, timestamp } from "drizzle-orm/pg-core";

export const jobOdometerCorrectionsTable = pgTable("job_odometer_corrections", {
  jobId: text("job_id").primaryKey(),
  odometer: integer("odometer").notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
