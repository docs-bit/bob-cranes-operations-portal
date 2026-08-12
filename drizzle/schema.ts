import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, json } from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const bookings = mysqlTable("bookings", {
  id: varchar("id", { length: 64 }).primaryKey(),
  clientName: varchar("clientName", { length: 255 }).notNull(),
  projectName: varchar("projectName", { length: 255 }).notNull(),
  projectManager: varchar("projectManager", { length: 255 }).notNull(),
  lpoReference: varchar("lpoReference", { length: 128 }).notNull(),
  mobilizationDate: varchar("mobilizationDate", { length: 64 }).notNull(),
  offHireDate: varchar("offHireDate", { length: 64 }).notNull(),
  clientContactName: varchar("clientContactName", { length: 255 }).notNull(),
  clientEmail: varchar("clientEmail", { length: 320 }).notNull(),
  clientPhone: varchar("clientPhone", { length: 64 }).notNull(),
  priority: varchar("priority", { length: 32 }).notNull().default("Standard"),
  stage: varchar("stage", { length: 128 }).notNull().default("Created by Salesperson"),
  craneId: varchar("craneId", { length: 64 }),
  crewIds: json("crewIds"),
  gearIds: json("gearIds"),
  trailerIds: json("trailerIds"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const equipment = mysqlTable("equipment", {
  id: varchar("id", { length: 64 }).primaryKey(),
  assetCode: varchar("assetCode", { length: 64 }).notNull().unique(),
  name: varchar("name", { length: 255 }).notNull(),
  capacityTons: int("capacityTons").notNull().default(50),
  status: varchar("status", { length: 32 }).notNull().default("Available"),
  inspectionExpiry: varchar("inspectionExpiry", { length: 64 }).notNull(),
  type: varchar("type", { length: 64 }).notNull().default("Mobile Crane"),
  registration: varchar("registration", { length: 64 }),
});

export const crew = mysqlTable("crew", {
  id: varchar("id", { length: 64 }).primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  designation: varchar("designation", { length: 128 }).notNull(),
  availability: varchar("availability", { length: 64 }).notNull().default("Present"),
  certificateExpiry: varchar("certificateExpiry", { length: 64 }).notNull(),
  trainingRequired: int("trainingRequired").notNull().default(0),
});

export const liftingGears = mysqlTable("lifting_gears", {
  id: varchar("id", { length: 64 }).primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  gearType: varchar("gearType", { length: 64 }).notNull().default("Shackle"),
  swlTons: int("swlTons").notNull().default(10),
  inspectionExpiry: varchar("inspectionExpiry", { length: 64 }).notNull(),
});

export const trailers = mysqlTable("trailers", {
  id: varchar("id", { length: 64 }).primaryKey(),
  plateNumber: varchar("plateNumber", { length: 64 }).notNull(),
  trailerType: varchar("trailerType", { length: 64 }).notNull().default("Flatbed"),
  status: varchar("status", { length: 64 }).notNull().default("Available"),
});

export const documents = mysqlTable("documents", {
  id: varchar("id", { length: 64 }).primaryKey(),
  bookingId: varchar("bookingId", { length: 64 }).notNull(),
  departmentCode: varchar("departmentCode", { length: 16 }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  state: varchar("state", { length: 64 }).notNull().default("Required"),
  expiryDate: varchar("expiryDate", { length: 64 }),
  required: int("required").notNull().default(1),
});

export const chatMessages = mysqlTable("chat_messages", {
  id: varchar("id", { length: 64 }).primaryKey(),
  bookingId: varchar("bookingId", { length: 64 }).notNull(),
  team: varchar("team", { length: 128 }).notNull(),
  sender: varchar("sender", { length: 255 }).notNull(),
  body: text("body").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const notifications = mysqlTable("notifications", {
  id: varchar("id", { length: 64 }).primaryKey(),
  departmentCode: varchar("departmentCode", { length: 16 }).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  body: text("body").notNull(),
  read: int("read").notNull().default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const departments = mysqlTable("departments", {
  code: varchar("code", { length: 16 }).primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  active: int("active").notNull().default(1),
});

export const auditLogs = mysqlTable("audit_logs", {
  id: varchar("id", { length: 64 }).primaryKey(),
  actor: varchar("actor", { length: 255 }).notNull(),
  action: varchar("action", { length: 255 }).notNull(),
  details: text("details"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Booking = typeof bookings.$inferSelect;
export type InsertBooking = typeof bookings.$inferInsert;
export type EquipmentItem = typeof equipment.$inferSelect;
export type CrewMemberItem = typeof crew.$inferSelect;
export type LiftingGearItem = typeof liftingGears.$inferSelect;
export type TrailerItem = typeof trailers.$inferSelect;
export type DocumentItemRecord = typeof documents.$inferSelect;
export type ChatMessageRecord = typeof chatMessages.$inferSelect;
export type NotificationRecord = typeof notifications.$inferSelect;
export type DepartmentRecord = typeof departments.$inferSelect;
export type AuditLogRecord = typeof auditLogs.$inferSelect;
