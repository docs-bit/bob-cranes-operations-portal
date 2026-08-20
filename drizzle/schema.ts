import {
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
  json,
} from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  companyName: varchar("companyName", { length: 160 }),
  phone: varchar("phone", { length: 48 }),
  localEmail: varchar("localEmail", { length: 320 }).unique(),
  passwordHash: varchar("passwordHash", { length: 255 }),
  departmentCode: varchar("departmentCode", { length: 32 }),
  supervisorId: int("supervisorId"),
  isActive: int("isActive").notNull().default(1),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "supervisor", "admin"])
    .default("user")
    .notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const userActivityLogs = mysqlTable("user_activity_logs", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  action: varchar("action", { length: 64 }).notNull(),
  detail: text("detail").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const clientFeedback = mysqlTable("client_feedback", {
  id: varchar("id", { length: 64 }).primaryKey(),
  bookingId: varchar("bookingId", { length: 64 }).notNull(),
  category: varchar("category", { length: 32 }).notNull().default("Bug report"),
  message: text("message").notNull(),
  contactEmail: varchar("contactEmail", { length: 320 }),
  status: varchar("status", { length: 32 }).notNull().default("Open"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const systemSettings = mysqlTable("system_settings", {
  key: varchar("key", { length: 64 }).primaryKey(),
  value: varchar("value", { length: 255 }).notNull(),
  updatedBy: int("updatedBy"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const runtimeErrorEvents = mysqlTable("runtime_error_events", {
  id: varchar("id", { length: 64 }).primaryKey(),
  source: varchar("source", { length: 32 }).notNull(),
  message: varchar("message", { length: 1000 }).notNull(),
  path: varchar("path", { length: 512 }).notNull(),
  fingerprint: varchar("fingerprint", { length: 64 }).notNull(),
  userId: int("userId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const telemetryEvents = mysqlTable("telemetry_events", {
  id: varchar("id", { length: 64 }).primaryKey(),
  metricName: varchar("metricName", { length: 64 }).notNull(),
  metricValue: varchar("metricValue", { length: 64 }).notNull(),
  path: varchar("path", { length: 512 }).notNull(),
  userId: int("userId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
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
  stage: varchar("stage", { length: 128 })
    .notNull()
    .default("Created by Salesperson"),
  craneId: varchar("craneId", { length: 64 }),
  crewIds: json("crewIds"),
  gearIds: json("gearIds"),
  trailerIds: json("trailerIds"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const bookingCrewAllocations = mysqlTable("booking_crew_allocations", {
  id: int("id").autoincrement().primaryKey(),
  bookingId: varchar("bookingId", { length: 64 }).notNull(),
  crewId: varchar("crewId", { length: 64 }).notNull(),
  crewName: varchar("crewName", { length: 255 }).notNull(),
  assignedBy: int("assignedBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
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
  availability: varchar("availability", { length: 64 })
    .notNull()
    .default("Present"),
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
  trailerType: varchar("trailerType", { length: 64 })
    .notNull()
    .default("Flatbed"),
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
  userId: int("userId"),
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

export const departmentDashboards = mysqlTable("department_dashboards", {
  departmentCode: varchar("departmentCode", { length: 16 }).primaryKey(),
  description: text("description").notNull(),
  accent: varchar("accent", { length: 32 }).notNull().default("orange"),
  icon: varchar("icon", { length: 48 }).notNull().default("LayoutDashboard"),
  dashboardConfig: json("dashboardConfig").notNull(),
  createdBy: int("createdBy").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const departmentWorkflowTemplates = mysqlTable("department_workflow_templates", {
  id: varchar("id", { length: 64 }).primaryKey(),
  departmentCode: varchar("departmentCode", { length: 16 }).notNull(),
  name: varchar("name", { length: 160 }).notNull(),
  description: text("description").notNull(),
  checklist: json("checklist").notNull(),
  active: int("active").notNull().default(1),
  createdBy: int("createdBy").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const rentalEnquiries = mysqlTable("rental_enquiries", {
  id: varchar("id", { length: 64 }).primaryKey(),
  contactName: varchar("contactName", { length: 160 }).notNull(),
  companyName: varchar("companyName", { length: 160 }).notNull(),
  email: varchar("email", { length: 320 }).notNull(),
  phone: varchar("phone", { length: 48 }).notNull(),
  projectLocation: varchar("projectLocation", { length: 255 }).notNull(),
  equipmentInterest: varchar("equipmentInterest", { length: 120 }).notNull(),
  rentalDuration: varchar("rentalDuration", { length: 80 }).notNull().default("To be confirmed"),
  liftDetails: text("liftDetails").notNull(),
  status: varchar("status", { length: 32 }).notNull().default("New"),
  assignedToUserId: int("assignedToUserId"),
  convertedBookingId: varchar("convertedBookingId", { length: 64 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const rentalEnquiryEvents = mysqlTable("rental_enquiry_events", {
  id: varchar("id", { length: 64 }).primaryKey(),
  rentalEnquiryId: varchar("rentalEnquiryId", { length: 64 }).notNull(),
  actorUserId: int("actorUserId").notNull(),
  eventType: varchar("eventType", { length: 64 }).notNull(),
  summary: text("summary").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
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
export type ClientFeedbackRecord = typeof clientFeedback.$inferSelect;
export type SystemSetting = typeof systemSettings.$inferSelect;
export type RuntimeErrorEvent = typeof runtimeErrorEvents.$inferSelect;
export type Booking = typeof bookings.$inferSelect;
export type BookingCrewAllocation = typeof bookingCrewAllocations.$inferSelect;
export type InsertBooking = typeof bookings.$inferInsert;
export type EquipmentItem = typeof equipment.$inferSelect;
export type CrewMemberItem = typeof crew.$inferSelect;
export type LiftingGearItem = typeof liftingGears.$inferSelect;
export type TrailerItem = typeof trailers.$inferSelect;
export type DocumentItemRecord = typeof documents.$inferSelect;
export type ChatMessageRecord = typeof chatMessages.$inferSelect;
export type NotificationRecord = typeof notifications.$inferSelect;
export type DepartmentRecord = typeof departments.$inferSelect;
export type DepartmentDashboardRecord = typeof departmentDashboards.$inferSelect;
export type DepartmentWorkflowTemplateRecord = typeof departmentWorkflowTemplates.$inferSelect;
export type RentalEnquiryRecord = typeof rentalEnquiries.$inferSelect;
export type RentalEnquiryEventRecord = typeof rentalEnquiryEvents.$inferSelect;
export type AuditLogRecord = typeof auditLogs.$inferSelect;

export const documentTaxonomyCategories = mysqlTable("document_taxonomy_categories", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 128 }).notNull().unique(),
  description: text("description"),
  createdBy: int("createdBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const documentTaxonomyTags = mysqlTable("document_taxonomy_tags", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 64 }).notNull().unique(),
  categoryId: int("categoryId"),
  createdBy: int("createdBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const persistedDocumentMetadata = mysqlTable("persisted_document_metadata", {
  id: varchar("id", { length: 64 }).primaryKey(),
  bookingId: varchar("bookingId", { length: 64 }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  departmentCode: varchar("departmentCode", { length: 32 }).notNull(),
  state: varchar("state", { length: 64 }).notNull().default("Required"),
  category: varchar("category", { length: 128 }),
  tagsJson: json("tagsJson"),
  fileName: varchar("fileName", { length: 255 }),
  fileType: varchar("fileType", { length: 128 }),
  fileSize: int("fileSize"),
  uploadedBy: int("uploadedBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const clientFilterPresets = mysqlTable("client_filter_presets", {
  id: varchar("id", { length: 64 }).primaryKey(),
  userId: int("userId").notNull(),
  name: varchar("name", { length: 128 }).notNull(),
  category: varchar("category", { length: 128 }).notNull(),
  tagsJson: text("tagsJson").notNull(),
  search: varchar("search", { length: 255 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ClientFilterPresetRecord = typeof clientFilterPresets.$inferSelect;
