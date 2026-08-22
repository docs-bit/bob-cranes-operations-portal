// server/_core/app.ts
import express from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";

// shared/const.ts
var COOKIE_NAME = "app_session_id";
var LOCAL_AUTH_COOKIE_NAME = "bob_local_session";
var ONE_YEAR_MS = 1e3 * 60 * 60 * 24 * 365;
var AXIOS_TIMEOUT_MS = 3e4;
var UNAUTHED_ERR_MSG = "Please login (10001)";
var NOT_ADMIN_ERR_MSG = "You do not have required permission (10002)";
var OAUTH_STATE_COOKIE = "__Host-oauth_state";
var decodeOAuthState = (state) => {
  let decoded;
  try {
    decoded = atob(state);
  } catch {
    return { redirectUri: "" };
  }
  try {
    const parsed = JSON.parse(decoded);
    if (parsed && typeof parsed.redirectUri === "string") return parsed;
  } catch {
  }
  return { redirectUri: decoded };
};

// server/_core/oauth.ts
import { parse as parseCookieHeader2 } from "cookie";

// server/db.ts
import {
  and,
  desc,
  eq,
  gte,
  isNotNull,
  isNull,
  lt,
  lte,
  or
} from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { nanoid } from "nanoid";

// drizzle/schema.ts
import {
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
  json
} from "drizzle-orm/mysql-core";
var users = mysqlTable("users", {
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
  role: mysqlEnum("role", ["user", "supervisor", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull()
});
var userActivityLogs = mysqlTable("user_activity_logs", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  action: varchar("action", { length: 64 }).notNull(),
  detail: text("detail").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull()
});
var clientFeedback = mysqlTable("client_feedback", {
  id: varchar("id", { length: 64 }).primaryKey(),
  bookingId: varchar("bookingId", { length: 64 }).notNull(),
  category: varchar("category", { length: 32 }).notNull().default("Bug report"),
  message: text("message").notNull(),
  contactEmail: varchar("contactEmail", { length: 320 }),
  status: varchar("status", { length: 32 }).notNull().default("Open"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
});
var systemSettings = mysqlTable("system_settings", {
  key: varchar("key", { length: 64 }).primaryKey(),
  value: varchar("value", { length: 255 }).notNull(),
  updatedBy: int("updatedBy"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
});
var runtimeErrorEvents = mysqlTable("runtime_error_events", {
  id: varchar("id", { length: 64 }).primaryKey(),
  source: varchar("source", { length: 32 }).notNull(),
  message: varchar("message", { length: 1e3 }).notNull(),
  path: varchar("path", { length: 512 }).notNull(),
  fingerprint: varchar("fingerprint", { length: 64 }).notNull(),
  userId: int("userId"),
  createdAt: timestamp("createdAt").defaultNow().notNull()
});
var telemetryEvents = mysqlTable("telemetry_events", {
  id: varchar("id", { length: 64 }).primaryKey(),
  metricName: varchar("metricName", { length: 64 }).notNull(),
  metricValue: varchar("metricValue", { length: 64 }).notNull(),
  path: varchar("path", { length: 512 }).notNull(),
  userId: int("userId"),
  createdAt: timestamp("createdAt").defaultNow().notNull()
});
var bookings = mysqlTable("bookings", {
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
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
});
var bookingCrewAllocations = mysqlTable("booking_crew_allocations", {
  id: int("id").autoincrement().primaryKey(),
  bookingId: varchar("bookingId", { length: 64 }).notNull(),
  crewId: varchar("crewId", { length: 64 }).notNull(),
  crewName: varchar("crewName", { length: 255 }).notNull(),
  assignedBy: int("assignedBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull()
});
var equipment = mysqlTable("equipment", {
  id: varchar("id", { length: 64 }).primaryKey(),
  assetCode: varchar("assetCode", { length: 64 }).notNull().unique(),
  name: varchar("name", { length: 255 }).notNull(),
  capacityTons: int("capacityTons").notNull().default(50),
  status: varchar("status", { length: 32 }).notNull().default("Available"),
  inspectionExpiry: varchar("inspectionExpiry", { length: 64 }).notNull(),
  type: varchar("type", { length: 64 }).notNull().default("Mobile Crane"),
  registration: varchar("registration", { length: 64 })
});
var crew = mysqlTable("crew", {
  id: varchar("id", { length: 64 }).primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  designation: varchar("designation", { length: 128 }).notNull(),
  availability: varchar("availability", { length: 64 }).notNull().default("Present"),
  certificateExpiry: varchar("certificateExpiry", { length: 64 }).notNull(),
  trainingRequired: int("trainingRequired").notNull().default(0)
});
var liftingGears = mysqlTable("lifting_gears", {
  id: varchar("id", { length: 64 }).primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  gearType: varchar("gearType", { length: 64 }).notNull().default("Shackle"),
  swlTons: int("swlTons").notNull().default(10),
  inspectionExpiry: varchar("inspectionExpiry", { length: 64 }).notNull()
});
var trailers = mysqlTable("trailers", {
  id: varchar("id", { length: 64 }).primaryKey(),
  plateNumber: varchar("plateNumber", { length: 64 }).notNull(),
  trailerType: varchar("trailerType", { length: 64 }).notNull().default("Flatbed"),
  status: varchar("status", { length: 64 }).notNull().default("Available")
});
var documents = mysqlTable("documents", {
  id: varchar("id", { length: 64 }).primaryKey(),
  bookingId: varchar("bookingId", { length: 64 }).notNull(),
  departmentCode: varchar("departmentCode", { length: 16 }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  state: varchar("state", { length: 64 }).notNull().default("Required"),
  expiryDate: varchar("expiryDate", { length: 64 }),
  required: int("required").notNull().default(1)
});
var chatMessages = mysqlTable("chat_messages", {
  id: varchar("id", { length: 64 }).primaryKey(),
  bookingId: varchar("bookingId", { length: 64 }).notNull(),
  team: varchar("team", { length: 128 }).notNull(),
  sender: varchar("sender", { length: 255 }).notNull(),
  body: text("body").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull()
});
var notifications = mysqlTable("notifications", {
  id: varchar("id", { length: 64 }).primaryKey(),
  userId: int("userId"),
  departmentCode: varchar("departmentCode", { length: 16 }).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  body: text("body").notNull(),
  read: int("read").notNull().default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull()
});
var departments = mysqlTable("departments", {
  code: varchar("code", { length: 16 }).primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  active: int("active").notNull().default(1)
});
var departmentDashboards = mysqlTable("department_dashboards", {
  departmentCode: varchar("departmentCode", { length: 16 }).primaryKey(),
  description: text("description").notNull(),
  accent: varchar("accent", { length: 32 }).notNull().default("orange"),
  icon: varchar("icon", { length: 48 }).notNull().default("LayoutDashboard"),
  dashboardConfig: json("dashboardConfig").notNull(),
  createdBy: int("createdBy").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
});
var departmentWorkflowTemplates = mysqlTable("department_workflow_templates", {
  id: varchar("id", { length: 64 }).primaryKey(),
  departmentCode: varchar("departmentCode", { length: 16 }).notNull(),
  name: varchar("name", { length: 160 }).notNull(),
  description: text("description").notNull(),
  checklist: json("checklist").notNull(),
  active: int("active").notNull().default(1),
  createdBy: int("createdBy").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
});
var rentalEnquiries = mysqlTable("rental_enquiries", {
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
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
});
var rentalEnquiryEvents = mysqlTable("rental_enquiry_events", {
  id: varchar("id", { length: 64 }).primaryKey(),
  rentalEnquiryId: varchar("rentalEnquiryId", { length: 64 }).notNull(),
  actorUserId: int("actorUserId").notNull(),
  eventType: varchar("eventType", { length: 64 }).notNull(),
  summary: text("summary").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull()
});
var auditLogs = mysqlTable("audit_logs", {
  id: varchar("id", { length: 64 }).primaryKey(),
  actor: varchar("actor", { length: 255 }).notNull(),
  action: varchar("action", { length: 255 }).notNull(),
  details: text("details"),
  createdAt: timestamp("createdAt").defaultNow().notNull()
});
var documentTaxonomyCategories = mysqlTable("document_taxonomy_categories", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 128 }).notNull().unique(),
  description: text("description"),
  createdBy: int("createdBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
});
var documentTaxonomyTags = mysqlTable("document_taxonomy_tags", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 64 }).notNull().unique(),
  categoryId: int("categoryId"),
  createdBy: int("createdBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull()
});
var persistedDocumentMetadata = mysqlTable("persisted_document_metadata", {
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
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
});
var clientFilterPresets = mysqlTable("client_filter_presets", {
  id: varchar("id", { length: 64 }).primaryKey(),
  userId: int("userId").notNull(),
  name: varchar("name", { length: 128 }).notNull(),
  category: varchar("category", { length: 128 }).notNull(),
  tagsJson: text("tagsJson").notNull(),
  search: varchar("search", { length: 255 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
});

// server/_core/env.ts
var ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? ""
};

// server/db.ts
var _db = null;
async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}
async function upsertUser(user) {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }
  const db = await getDb();
  if (!db) return;
  try {
    const values = {
      openId: user.openId,
      name: user.name ?? null,
      email: user.email ?? null,
      loginMethod: user.loginMethod ?? null,
      role: user.role ?? (user.openId === ENV.ownerOpenId ? "admin" : "user"),
      lastSignedIn: user.lastSignedIn ?? /* @__PURE__ */ new Date()
    };
    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: {
        name: values.name,
        email: values.email,
        loginMethod: values.loginMethod,
        lastSignedIn: values.lastSignedIn
      }
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}
async function getUserByOpenId(openId) {
  const db = await getDb();
  if (!db) return void 0;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : void 0;
}
async function getUserById(id) {
  const db = await getDb();
  if (!db) return void 0;
  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return result[0];
}
async function getUserByLocalEmail(localEmail) {
  const db = await getDb();
  if (!db) return void 0;
  const result = await db.select().from(users).where(eq(users.localEmail, localEmail)).limit(1);
  return result[0];
}
async function countLocalUsers() {
  const db = await getDb();
  if (!db) return 0;
  const result = await db.select().from(users).where(isNotNull(users.localEmail));
  return result.length;
}
async function listLocalUsers() {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(users).where(isNotNull(users.localEmail)).orderBy(desc(users.createdAt));
}
async function createLocalUser(input) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable for account creation.");
  await db.insert(users).values({
    openId: `local-${nanoid(32)}`,
    name: input.name,
    email: input.email,
    localEmail: input.email,
    passwordHash: input.passwordHash,
    departmentCode: input.departmentCode,
    supervisorId: input.supervisorId ?? null,
    isActive: 1,
    loginMethod: "password",
    role: input.role,
    lastSignedIn: /* @__PURE__ */ new Date()
  });
  const user = await getUserByLocalEmail(input.email);
  if (!user) throw new Error("Account was created but could not be retrieved.");
  return user;
}
async function updateUserLastSignedIn(id) {
  const db = await getDb();
  if (!db) return;
  await db.update(users).set({ lastSignedIn: /* @__PURE__ */ new Date() }).where(eq(users.id, id));
}
async function updateLocalUser(id, input) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable for account update.");
  await db.update(users).set({
    name: input.name,
    email: input.email,
    localEmail: input.email,
    departmentCode: input.departmentCode,
    supervisorId: input.supervisorId ?? null,
    role: input.role,
    ...input.passwordHash ? { passwordHash: input.passwordHash } : {}
  }).where(eq(users.id, id));
  return await getUserById(id);
}
async function updateUserProfileContactDetails(id, input) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable for profile update.");
  await db.update(users).set({ companyName: input.companyName, phone: input.phone }).where(eq(users.id, id));
  return await getUserById(id);
}
async function setLocalUserActive(id, isActive) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable for account status update.");
  await db.update(users).set({ isActive }).where(eq(users.id, id));
  return await getUserById(id);
}
async function addUserActivity(input) {
  const db = await getDb();
  if (!db) return;
  await db.insert(userActivityLogs).values(input);
}
async function listRecentUserActivity({
  limit = 40,
  departmentCode,
  from,
  to
} = {}) {
  const db = await getDb();
  if (!db) return [];
  const query = db.select({
    id: userActivityLogs.id,
    userId: userActivityLogs.userId,
    userName: users.name,
    userEmail: users.localEmail,
    departmentCode: users.departmentCode,
    action: userActivityLogs.action,
    detail: userActivityLogs.detail,
    createdAt: userActivityLogs.createdAt
  }).from(userActivityLogs).leftJoin(users, eq(userActivityLogs.userId, users.id));
  const filters = [
    departmentCode ? eq(users.departmentCode, departmentCode) : void 0,
    from ? gte(userActivityLogs.createdAt, from) : void 0,
    to ? lte(userActivityLogs.createdAt, to) : void 0
  ].filter((filter) => Boolean(filter));
  return await query.where(filters.length ? and(...filters) : void 0).orderBy(desc(userActivityLogs.createdAt)).limit(Math.min(Math.max(limit, 1), 250));
}
async function getActivityRetentionDays() {
  const db = await getDb();
  if (!db) return 365;
  const result = await db.select().from(systemSettings).where(eq(systemSettings.key, "activity_log_retention_days")).limit(1);
  const value = Number(result[0]?.value);
  return [30, 90, 180, 365, 730].includes(value) ? value : 365;
}
async function setActivityRetentionDays(days, updatedBy) {
  const db = await getDb();
  if (!db)
    throw new Error("Database is unavailable for activity retention settings.");
  await db.insert(systemSettings).values({
    key: "activity_log_retention_days",
    value: String(days),
    updatedBy
  }).onDuplicateKeyUpdate({
    set: { value: String(days), updatedBy }
  });
  return await getActivityRetentionDays();
}
async function getDashboardGreetingTemplate() {
  const db = await getDb();
  if (!db) return "Hello, {name}";
  const result = await db.select().from(systemSettings).where(eq(systemSettings.key, "dashboard_greeting_template")).limit(1);
  const template = result[0]?.value?.trim();
  return template?.includes("{name}") ? template : "Hello, {name}";
}
async function setDashboardGreetingTemplate(template, updatedBy) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable for dashboard greeting settings.");
  await db.insert(systemSettings).values({
    key: "dashboard_greeting_template",
    value: template,
    updatedBy
  }).onDuplicateKeyUpdate({
    set: { value: template, updatedBy }
  });
  return await getDashboardGreetingTemplate();
}
async function purgeUserActivityBefore(cutoff) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable for activity retention.");
  const expired = await db.select({ id: userActivityLogs.id }).from(userActivityLogs).where(lt(userActivityLogs.createdAt, cutoff));
  if (expired.length)
    await db.delete(userActivityLogs).where(lt(userActivityLogs.createdAt, cutoff));
  return expired.length;
}
async function createClientFeedback(input) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable for client feedback.");
  const id = `feedback-${nanoid(16)}`;
  await db.insert(clientFeedback).values({
    id,
    bookingId: input.bookingId,
    category: input.category,
    message: input.message,
    contactEmail: input.contactEmail ?? null,
    status: "Open"
  });
  return { id };
}
async function listClientFeedback(limit = 100) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(clientFeedback).orderBy(desc(clientFeedback.createdAt)).limit(Math.min(Math.max(limit, 1), 250));
}
async function updateClientFeedbackStatus(id, status) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable for client feedback.");
  await db.update(clientFeedback).set({ status }).where(eq(clientFeedback.id, id));
  const result = await db.select().from(clientFeedback).where(eq(clientFeedback.id, id)).limit(1);
  return result[0];
}
async function createRuntimeErrorEvent(input) {
  const db = await getDb();
  if (!db) return { id: null };
  const id = `runtime-${nanoid(16)}`;
  await db.insert(runtimeErrorEvents).values({
    id,
    source: input.source,
    message: input.message,
    path: input.path,
    fingerprint: input.fingerprint,
    userId: input.userId ?? null
  });
  return { id };
}
async function listRuntimeErrorEvents(limit = 100) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(runtimeErrorEvents).orderBy(desc(runtimeErrorEvents.createdAt)).limit(Math.min(Math.max(limit, 1), 250));
}
async function createTelemetryEvent(input) {
  const db = await getDb();
  if (!db) return { id: null };
  const id = `tel-${nanoid(16)}`;
  await db.insert(telemetryEvents).values({
    id,
    metricName: input.metricName,
    metricValue: input.metricValue,
    path: input.path,
    userId: input.userId ?? null
  });
  return { id };
}
async function listTelemetryEvents(limit = 250) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(telemetryEvents).orderBy(desc(telemetryEvents.createdAt)).limit(Math.min(Math.max(limit, 1), 500));
}
async function getAllBookings() {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(bookings).orderBy(desc(bookings.createdAt));
}
async function getBookingById(id) {
  const db = await getDb();
  if (!db) return void 0;
  const res = await db.select().from(bookings).where(eq(bookings.id, id)).limit(1);
  return res[0];
}
async function createBooking(data) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(bookings).values({
    id: data.id,
    clientName: data.clientName,
    projectName: data.projectName,
    projectManager: data.projectManager,
    lpoReference: data.lpoReference,
    mobilizationDate: data.mobilizationDate,
    offHireDate: data.offHireDate,
    clientContactName: data.clientContactName,
    clientEmail: data.clientEmail,
    clientPhone: data.clientPhone,
    priority: data.priority,
    stage: data.stage,
    craneId: data.craneId ?? null,
    crewIds: data.crewIds ?? [],
    gearIds: data.gearIds ?? [],
    trailerIds: data.trailerIds ?? []
  });
  return await getBookingById(data.id);
}
async function updateBookingStage(id, stage) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(bookings).set({ stage }).where(eq(bookings.id, id));
  return await getBookingById(id);
}
async function updateBookingAssignment(id, updates) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(bookings).set(updates).where(eq(bookings.id, id));
  return await getBookingById(id);
}
async function listBookingCrewAllocations() {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(bookingCrewAllocations).orderBy(desc(bookingCrewAllocations.createdAt));
}
async function replaceCrewBookingAllocations(input) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(bookingCrewAllocations).where(eq(bookingCrewAllocations.crewId, input.crewId));
  if (input.bookingIds.length > 0) {
    await db.insert(bookingCrewAllocations).values(
      input.bookingIds.map((bookingId) => ({
        bookingId,
        crewId: input.crewId,
        crewName: input.crewName,
        assignedBy: input.assignedBy ?? null
      }))
    );
  }
  return await listBookingCrewAllocations();
}
async function getAllEquipment() {
  const fallbackEquipment = [
    { id: "eq-demo-1", assetCode: "B-205", name: "50T Mobile Crane \xB7 DEMAG", capacityTons: 50, status: "Available", inspectionExpiry: "2027-03-15", type: "Mobile Crane", registration: "60312" },
    { id: "eq-demo-2", assetCode: "B-210", name: "35T Mobile Crane \xB7 PPM", capacityTons: 35, status: "Available", inspectionExpiry: "2027-06-20", type: "Mobile Crane", registration: "98274" }
  ];
  const db = await getDb();
  if (!db) return fallbackEquipment;
  const rows = await db.select().from(equipment);
  return rows.length > 0 ? rows : fallbackEquipment;
}
async function getAllCrew() {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(crew);
}
async function getAllLiftingGears() {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(liftingGears);
}
async function getAllTrailers() {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(trailers);
}
async function getDocumentsForBooking(bookingId) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(documents).where(eq(documents.bookingId, bookingId));
}
async function upsertDocument(data) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(documents).values(data).onDuplicateKeyUpdate({
    set: { state: data.state, expiryDate: data.expiryDate, name: data.name }
  });
  return data;
}
async function getChatForBooking(bookingId) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(chatMessages).where(eq(chatMessages.bookingId, bookingId)).orderBy(chatMessages.createdAt);
}
async function addChatMessage(data) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(chatMessages).values(data);
  return data;
}
async function getNotifications(filters) {
  const db = await getDb();
  if (!db) return [];
  const { departmentCode, userId } = filters ?? {};
  if (userId !== void 0 && departmentCode) {
    return await db.select().from(notifications).where(
      or(
        eq(notifications.userId, userId),
        and(
          isNull(notifications.userId),
          eq(notifications.departmentCode, departmentCode)
        )
      )
    ).orderBy(desc(notifications.createdAt));
  }
  if (userId !== void 0) {
    return await db.select().from(notifications).where(eq(notifications.userId, userId)).orderBy(desc(notifications.createdAt));
  }
  if (departmentCode) {
    return await db.select().from(notifications).where(eq(notifications.departmentCode, departmentCode)).orderBy(desc(notifications.createdAt));
  }
  return await db.select().from(notifications).orderBy(desc(notifications.createdAt));
}
async function addNotification(data) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(notifications).values(data);
  return data;
}
async function markAllNotificationsRead(filters) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const { departmentCode, userId } = filters ?? {};
  if (userId !== void 0 && departmentCode) {
    await db.update(notifications).set({ read: 1 }).where(
      or(
        eq(notifications.userId, userId),
        and(
          isNull(notifications.userId),
          eq(notifications.departmentCode, departmentCode)
        )
      )
    );
    return;
  }
  if (userId !== void 0) {
    await db.update(notifications).set({ read: 1 }).where(eq(notifications.userId, userId));
    return;
  }
  if (departmentCode) {
    await db.update(notifications).set({ read: 1 }).where(eq(notifications.departmentCode, departmentCode));
    return;
  }
  await db.update(notifications).set({ read: 1 });
}
async function listProvisionedDepartmentDashboards(options = {}) {
  const db = await getDb();
  if (!db) return [];
  const query = db.select({
    code: departments.code,
    name: departments.name,
    active: departments.active,
    description: departmentDashboards.description,
    accent: departmentDashboards.accent,
    icon: departmentDashboards.icon,
    dashboardConfig: departmentDashboards.dashboardConfig,
    createdBy: departmentDashboards.createdBy,
    createdAt: departmentDashboards.createdAt,
    updatedAt: departmentDashboards.updatedAt
  }).from(departments).innerJoin(
    departmentDashboards,
    eq(departments.code, departmentDashboards.departmentCode)
  );
  return await (options.includeArchived ? query.orderBy(departments.name) : query.where(eq(departments.active, 1)).orderBy(departments.name));
}
async function getProvisionedDepartmentDashboard(code) {
  const db = await getDb();
  if (!db) return void 0;
  const result = await db.select({
    code: departments.code,
    name: departments.name,
    active: departments.active,
    description: departmentDashboards.description,
    accent: departmentDashboards.accent,
    icon: departmentDashboards.icon,
    dashboardConfig: departmentDashboards.dashboardConfig,
    createdBy: departmentDashboards.createdBy,
    createdAt: departmentDashboards.createdAt,
    updatedAt: departmentDashboards.updatedAt
  }).from(departments).innerJoin(
    departmentDashboards,
    eq(departments.code, departmentDashboards.departmentCode)
  ).where(eq(departments.code, code)).limit(1);
  return result[0];
}
async function createProvisionedDepartmentDashboard(input) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const existing = await db.select({ code: departments.code }).from(departments).where(eq(departments.code, input.code)).limit(1);
  if (existing[0]) throw new Error("A department already uses this code.");
  await db.transaction(async (transaction) => {
    await transaction.insert(departments).values({
      code: input.code,
      name: input.name,
      active: 1
    });
    await transaction.insert(departmentDashboards).values({
      departmentCode: input.code,
      description: input.description,
      accent: input.accent,
      icon: input.icon,
      dashboardConfig: input.dashboardConfig,
      createdBy: input.createdBy
    });
  });
  const created = await getProvisionedDepartmentDashboard(input.code);
  if (!created) throw new Error("Department dashboard could not be provisioned.");
  return created;
}
async function updateProvisionedDepartmentDashboardConfig(input) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(departmentDashboards).set({
    description: input.description,
    dashboardConfig: input.dashboardConfig
  }).where(eq(departmentDashboards.departmentCode, input.code));
  const updated = await getProvisionedDepartmentDashboard(input.code);
  if (!updated) throw new Error("Department dashboard could not be updated.");
  return updated;
}
async function setProvisionedDepartmentActive(input) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(departments).set({ active: input.active ? 1 : 0 }).where(eq(departments.code, input.code));
  const updated = await getProvisionedDepartmentDashboard(input.code);
  if (!updated) throw new Error("Department dashboard could not be updated.");
  return updated;
}
async function listDepartmentWorkflowTemplates(input) {
  const db = await getDb();
  if (!db) return [];
  const query = db.select().from(departmentWorkflowTemplates).where(eq(departmentWorkflowTemplates.departmentCode, input.departmentCode));
  const rows = await query.orderBy(desc(departmentWorkflowTemplates.updatedAt));
  return input.includeArchived ? rows : rows.filter((template) => template.active === 1);
}
async function createDepartmentWorkflowTemplate(input) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const id = `workflow-${nanoid(14)}`;
  await db.insert(departmentWorkflowTemplates).values({
    id,
    departmentCode: input.departmentCode,
    name: input.name,
    description: input.description,
    checklist: input.checklist,
    active: 1,
    createdBy: input.createdBy
  });
  const [template] = await db.select().from(departmentWorkflowTemplates).where(eq(departmentWorkflowTemplates.id, id)).limit(1);
  if (!template) throw new Error("Workflow template could not be created.");
  return template;
}
async function updateDepartmentWorkflowTemplate(input) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(departmentWorkflowTemplates).set({
    name: input.name,
    description: input.description,
    checklist: input.checklist
  }).where(eq(departmentWorkflowTemplates.id, input.id));
  const [template] = await db.select().from(departmentWorkflowTemplates).where(eq(departmentWorkflowTemplates.id, input.id)).limit(1);
  if (!template) throw new Error("Workflow template could not be updated.");
  return template;
}
async function setDepartmentWorkflowTemplateActive(input) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(departmentWorkflowTemplates).set({ active: input.active ? 1 : 0 }).where(eq(departmentWorkflowTemplates.id, input.id));
  const [template] = await db.select().from(departmentWorkflowTemplates).where(eq(departmentWorkflowTemplates.id, input.id)).limit(1);
  if (!template) throw new Error("Workflow template could not be updated.");
  return template;
}
async function createRentalEnquiry(input) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const id = `rental-enquiry-${nanoid(14)}`;
  await db.insert(rentalEnquiries).values({ id, ...input, status: "New" });
  return { id, status: "New" };
}
async function listRentalEnquiries(filters) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const status = filters?.status;
  if (status && status !== "all") {
    return await db.select().from(rentalEnquiries).where(eq(rentalEnquiries.status, status)).orderBy(desc(rentalEnquiries.updatedAt));
  }
  return await db.select().from(rentalEnquiries).orderBy(desc(rentalEnquiries.updatedAt));
}
async function getRentalEnquiryById(id) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [enquiry] = await db.select().from(rentalEnquiries).where(eq(rentalEnquiries.id, id)).limit(1);
  return enquiry;
}
async function updateRentalEnquirySalesContext(input) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const values = {};
  if (input.status !== void 0) values.status = input.status;
  if (input.assignedToUserId !== void 0) values.assignedToUserId = input.assignedToUserId;
  await db.update(rentalEnquiries).set(values).where(eq(rentalEnquiries.id, input.id));
  return await getRentalEnquiryById(input.id);
}
async function markRentalEnquiryConverted(input) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(rentalEnquiries).set({ status: "Converted", convertedBookingId: input.bookingId }).where(eq(rentalEnquiries.id, input.id));
  return await getRentalEnquiryById(input.id);
}
var DEFAULT_SALES_ENQUIRY_SLA = {
  warningHours: 4,
  criticalHours: 24
};
async function getSalesEnquirySlaConfig() {
  const db = await getDb();
  if (!db) return DEFAULT_SALES_ENQUIRY_SLA;
  const rows = await db.select().from(systemSettings).where(or(eq(systemSettings.key, "sales_enquiry_sla_warning_hours"), eq(systemSettings.key, "sales_enquiry_sla_critical_hours")));
  const warningHours = Number(rows.find((row) => row.key === "sales_enquiry_sla_warning_hours")?.value);
  const criticalHours = Number(rows.find((row) => row.key === "sales_enquiry_sla_critical_hours")?.value);
  if (!Number.isFinite(warningHours) || !Number.isFinite(criticalHours) || warningHours < 1 || criticalHours <= warningHours) return DEFAULT_SALES_ENQUIRY_SLA;
  return { warningHours, criticalHours };
}
async function setSalesEnquirySlaConfig(config, updatedBy) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable for Sales SLA settings.");
  await db.insert(systemSettings).values([
    { key: "sales_enquiry_sla_warning_hours", value: String(config.warningHours), updatedBy },
    { key: "sales_enquiry_sla_critical_hours", value: String(config.criticalHours), updatedBy }
  ]).onDuplicateKeyUpdate({ set: { value: String(config.warningHours), updatedBy } });
  await db.update(systemSettings).set({ value: String(config.criticalHours), updatedBy }).where(eq(systemSettings.key, "sales_enquiry_sla_critical_hours"));
  return await getSalesEnquirySlaConfig();
}
async function createRentalEnquiryEvent(input) {
  const db = await getDb();
  if (!db) throw new Error("Database not available for enquiry audit event.");
  const id = `rental-enquiry-event-${nanoid(14)}`;
  await db.insert(rentalEnquiryEvents).values({ id, ...input });
  return await getRentalEnquiryEventById(id);
}
async function getRentalEnquiryEventById(id) {
  const db = await getDb();
  if (!db) throw new Error("Database not available for enquiry audit event.");
  const [event] = await db.select().from(rentalEnquiryEvents).where(eq(rentalEnquiryEvents.id, id)).limit(1);
  return event;
}
async function listRentalEnquiryEvents(rentalEnquiryId) {
  const db = await getDb();
  if (!db) throw new Error("Database not available for enquiry audit events.");
  return await db.select().from(rentalEnquiryEvents).where(eq(rentalEnquiryEvents.rentalEnquiryId, rentalEnquiryId)).orderBy(desc(rentalEnquiryEvents.createdAt));
}
async function seedInitialDataIfNeeded() {
  const db = await getDb();
  if (!db) return;
  const eqList = await db.select().from(equipment).limit(1);
  if (eqList.length === 0) {
    const initialEquipment = [
      {
        id: "eq-1",
        assetCode: "B-205",
        name: "50T Mobile Crane \xB7 DEMAG",
        capacityTons: 50,
        status: "Available",
        inspectionExpiry: "2027-03-15",
        type: "Mobile Crane",
        registration: "60312"
      },
      {
        id: "eq-2",
        assetCode: "B-210",
        name: "35T Mobile Crane \xB7 PPM",
        capacityTons: 35,
        status: "Available",
        inspectionExpiry: "2027-06-20",
        type: "Mobile Crane",
        registration: "98274"
      },
      {
        id: "eq-3",
        assetCode: "B-213",
        name: "250T Mobile Crane \xB7 LTM",
        capacityTons: 250,
        status: "Assigned",
        inspectionExpiry: "2027-01-10",
        type: "Mobile Crane",
        registration: "92080"
      },
      {
        id: "eq-4",
        assetCode: "B-217",
        name: "350T Mobile Crane \xB7 LTM",
        capacityTons: 350,
        status: "Available",
        inspectionExpiry: "2027-09-01",
        type: "Mobile Crane",
        registration: "95095"
      },
      {
        id: "eq-5",
        assetCode: "B-218",
        name: "100T Lattice Crane",
        capacityTons: 100,
        status: "Available",
        inspectionExpiry: "2026-12-05",
        type: "Lattice Crane",
        registration: "71597"
      },
      {
        id: "eq-6",
        assetCode: "B-220",
        name: "50T Mobile Crane \xB7 SANY",
        capacityTons: 50,
        status: "Available",
        inspectionExpiry: "2027-04-12",
        type: "Mobile Crane",
        registration: "69009"
      },
      {
        id: "eq-7",
        assetCode: "B-221",
        name: "500T Mobile Crane \xB7 LTM",
        capacityTons: 500,
        status: "Available",
        inspectionExpiry: "2027-08-30",
        type: "Mobile Crane",
        registration: "63309"
      },
      {
        id: "eq-8",
        assetCode: "B-222",
        name: "130T Mobile Crane \xB7 LTM",
        capacityTons: 130,
        status: "Available",
        inspectionExpiry: "2027-05-18",
        type: "Mobile Crane",
        registration: "88999"
      },
      {
        id: "eq-9",
        assetCode: "B-224",
        name: "75T Mobile Crane \xB7 SANY",
        capacityTons: 75,
        status: "Available",
        inspectionExpiry: "2027-02-28",
        type: "Mobile Crane",
        registration: "65577"
      }
    ];
    for (const item of initialEquipment) {
      await db.insert(equipment).values(item).onDuplicateKeyUpdate({ set: item });
    }
  }
  const crewList = await db.select().from(crew).limit(1);
  if (crewList.length === 0) {
    const initialCrew = [
      {
        id: "cr-1",
        name: "Vineeth Vijayan",
        designation: "Crane Operator",
        availability: "Present",
        certificateExpiry: "2027-05-10",
        trainingRequired: 0
      },
      {
        id: "cr-2",
        name: "Anoop Panikashery",
        designation: "Crane Operator",
        availability: "Assigned",
        certificateExpiry: "2026-11-15",
        trainingRequired: 0
      },
      {
        id: "cr-3",
        name: "Vijayakumar",
        designation: "Rigger",
        availability: "Present",
        certificateExpiry: "2027-08-20",
        trainingRequired: 0
      },
      {
        id: "cr-4",
        name: "Amal Krishnan",
        designation: "Rigger",
        availability: "Present",
        certificateExpiry: "2027-01-30",
        trainingRequired: 0
      },
      {
        id: "cr-5",
        name: "ABDUL JALEEL",
        designation: "Rigger",
        availability: "Present",
        certificateExpiry: "2027-04-11",
        trainingRequired: 0
      },
      {
        id: "cr-6",
        name: "ABI RENJU KUMAR",
        designation: "Crane Operator Assistant",
        availability: "Present",
        certificateExpiry: "2027-06-01",
        trainingRequired: 0
      },
      {
        id: "cr-7",
        name: "ABHILASH UNNI",
        designation: "Rigger",
        availability: "Present",
        certificateExpiry: "2027-07-15",
        trainingRequired: 0
      },
      {
        id: "cr-8",
        name: "ABHIRAM SUNEEF",
        designation: "Rigger",
        availability: "Present",
        certificateExpiry: "2027-03-22",
        trainingRequired: 0
      },
      {
        id: "cr-9",
        name: "ABHISHEK KRISHNA",
        designation: "Crane Operator Assistant",
        availability: "Present",
        certificateExpiry: "2027-09-09",
        trainingRequired: 0
      },
      {
        id: "cr-10",
        name: "ADERSH SREEKUMAR NAIR",
        designation: "Rigger",
        availability: "On Leave",
        certificateExpiry: "2027-02-14",
        trainingRequired: 1
      },
      {
        id: "cr-11",
        name: "AMAL APPUKUTTAN",
        designation: "Rigger",
        availability: "Present",
        certificateExpiry: "2027-10-05",
        trainingRequired: 0
      },
      {
        id: "cr-12",
        name: "AMARNADH BAIJU",
        designation: "Rigger",
        availability: "Off-Site",
        certificateExpiry: "2027-04-04",
        trainingRequired: 0
      }
    ];
    for (const item of initialCrew) {
      await db.insert(crew).values(item).onDuplicateKeyUpdate({ set: item });
    }
  }
  const gearList = await db.select().from(liftingGears).limit(1);
  if (gearList.length === 0) {
    const initialGears = [
      {
        id: "g-1",
        name: "Heavy Shackle 50T Set",
        gearType: "Shackle",
        swlTons: 50,
        inspectionExpiry: "2027-06-01"
      },
      {
        id: "g-2",
        name: "Wire Rope Sling 20m",
        gearType: "Sling",
        swlTons: 25,
        inspectionExpiry: "2026-10-15"
      },
      {
        id: "g-3",
        name: "Spreader Beam 100T",
        gearType: "Spreader beam",
        swlTons: 100,
        inspectionExpiry: "2027-12-31"
      },
      {
        id: "g-4",
        name: "Webbing Sling 10T",
        gearType: "Sling",
        swlTons: 10,
        inspectionExpiry: "2027-03-30"
      }
    ];
    for (const item of initialGears) {
      await db.insert(liftingGears).values(item).onDuplicateKeyUpdate({ set: item });
    }
  }
  const trailerList = await db.select().from(trailers).limit(1);
  if (trailerList.length === 0) {
    const initialTrailers = [
      {
        id: "tr-1",
        plateNumber: "AD-55102",
        trailerType: "Flatbed",
        status: "Available"
      },
      {
        id: "tr-2",
        plateNumber: "DXB-8819",
        trailerType: "Lowboy",
        status: "Assigned"
      },
      {
        id: "tr-3",
        plateNumber: "SHJ-3341",
        trailerType: "Extendable",
        status: "Available"
      }
    ];
    for (const item of initialTrailers) {
      await db.insert(trailers).values(item).onDuplicateKeyUpdate({ set: item });
    }
  }
  const bookingList = await db.select().from(bookings).limit(1);
  if (bookingList.length === 0) {
    const initialBookings = [
      {
        id: "BOB-59116",
        clientName: "NPCC-NMDC Energy",
        projectName: "Musaffah Fabrication Yard Expansion",
        projectManager: "Manoj Kumar",
        lpoReference: "LPO-2026-8812",
        mobilizationDate: "2026-08-20",
        offHireDate: "2026-09-05",
        clientContactName: "Salem Al-Nuaimi",
        clientEmail: "salem@nmdc-energy.com",
        clientPhone: "+971 50 123 4567",
        priority: "High",
        stage: "Documentation Supervisor",
        craneId: "eq-3",
        crewIds: ["cr-1", "cr-3"],
        gearIds: ["g-1", "g-3"],
        trailerIds: ["tr-1"]
      },
      {
        id: "BOB-59117",
        clientName: "Laing O'Rourke Middle East",
        projectName: "Ajman Coastal Tower Lift",
        projectManager: "Sarath Chandran",
        lpoReference: "LOR-2026-4401",
        mobilizationDate: "2026-08-25",
        offHireDate: "2026-09-10",
        clientContactName: "Liam O'Connor",
        clientEmail: "liam.oconnor@laingorourke.com",
        clientPhone: "+971 55 987 6543",
        priority: "Critical",
        stage: "Crew Assigned",
        craneId: "eq-5",
        crewIds: ["cr-2", "cr-4"],
        gearIds: ["g-2"],
        trailerIds: ["tr-2"]
      },
      {
        id: "BOB-59118",
        clientName: "Al Nasr Contracting",
        projectName: "Dubai Hills C-149 Podium Erection",
        projectManager: "Sarath Chandran",
        lpoReference: "ANC-9921",
        mobilizationDate: "2026-09-01",
        offHireDate: "2026-09-20",
        clientContactName: "Tariq Al-Mansoor",
        clientEmail: "tariq@alnasrcontracting.ae",
        clientPhone: "+971 52 444 8899",
        priority: "Standard",
        stage: "Created by Salesperson",
        craneId: "eq-1",
        crewIds: [],
        gearIds: [],
        trailerIds: []
      }
    ];
    for (const b of initialBookings) {
      await db.insert(bookings).values(b).onDuplicateKeyUpdate({ set: b });
      const docs = [
        {
          id: `${b.id}-d1`,
          bookingId: b.id,
          departmentCode: "documentation",
          name: "Client LPO & Contract",
          state: "Approved",
          required: 1
        },
        {
          id: `${b.id}-d2`,
          bookingId: b.id,
          departmentCode: "hse",
          name: "Third Party Crane Inspection",
          state: "Uploaded",
          required: 1
        },
        {
          id: `${b.id}-d3`,
          bookingId: b.id,
          departmentCode: "lifting-gears",
          name: "Rigging Study & SWL Certification",
          state: "Required",
          required: 1
        },
        {
          id: `${b.id}-d4`,
          bookingId: b.id,
          departmentCode: "crew",
          name: "Operator Medical & License Verification",
          state: "Approved",
          required: 1
        },
        {
          id: `${b.id}-d5`,
          bookingId: b.id,
          departmentCode: "accounts",
          name: "Advance Payment Receipt",
          state: "Uploaded",
          required: 1
        }
      ];
      for (const d of docs) {
        await db.insert(documents).values(d).onDuplicateKeyUpdate({ set: d });
      }
    }
  }
  const allocationList = await db.select().from(bookingCrewAllocations).limit(1);
  if (allocationList.length === 0) {
    await db.insert(bookingCrewAllocations).values([
      {
        bookingId: "BOB-59116",
        crewId: "cr-1",
        crewName: "Vineeth Vijayan",
        assignedBy: null
      },
      {
        bookingId: "BOB-59116",
        crewId: "cr-2",
        crewName: "Anoop Panikashery",
        assignedBy: null
      },
      {
        bookingId: "BOB-59116",
        crewId: "cr-3",
        crewName: "Vijayakumar",
        assignedBy: null
      },
      {
        bookingId: "BOB-59116",
        crewId: "cr-4",
        crewName: "Amal Krishnan",
        assignedBy: null
      }
    ]);
  }
}
function normalizeTags(value) {
  if (!Array.isArray(value)) return [];
  return value.filter((tag) => typeof tag === "string").map((tag) => tag.trim()).filter(Boolean);
}
async function listDocumentTaxonomy() {
  const db = await getDb();
  if (!db) return { categories: [], tags: [] };
  const [categories, tags] = await Promise.all([
    db.select().from(documentTaxonomyCategories).orderBy(documentTaxonomyCategories.name),
    db.select().from(documentTaxonomyTags).orderBy(documentTaxonomyTags.name)
  ]);
  return { categories, tags };
}
async function createDocumentCategory(input) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable for document category creation.");
  await db.insert(documentTaxonomyCategories).values({
    name: input.name,
    description: input.description ?? null,
    createdBy: input.createdBy ?? null
  });
  const result = await db.select().from(documentTaxonomyCategories).where(eq(documentTaxonomyCategories.name, input.name)).limit(1);
  return result[0];
}
async function updateDocumentCategory(input) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable for document category update.");
  await db.update(documentTaxonomyCategories).set({ name: input.name, description: input.description ?? null }).where(eq(documentTaxonomyCategories.id, input.id));
  const result = await db.select().from(documentTaxonomyCategories).where(eq(documentTaxonomyCategories.id, input.id)).limit(1);
  return result[0];
}
async function deleteDocumentCategory(id) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable for document category deletion.");
  await db.delete(documentTaxonomyCategories).where(eq(documentTaxonomyCategories.id, id));
  return { success: true };
}
async function createDocumentTag(input) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable for document tag creation.");
  await db.insert(documentTaxonomyTags).values({
    name: input.name,
    categoryId: input.categoryId ?? null,
    createdBy: input.createdBy ?? null
  });
  const result = await db.select().from(documentTaxonomyTags).where(eq(documentTaxonomyTags.name, input.name)).limit(1);
  return result[0];
}
async function updateDocumentTag(input) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable for document tag update.");
  await db.update(documentTaxonomyTags).set({ name: input.name, categoryId: input.categoryId ?? null }).where(eq(documentTaxonomyTags.id, input.id));
  const result = await db.select().from(documentTaxonomyTags).where(eq(documentTaxonomyTags.id, input.id)).limit(1);
  return result[0];
}
async function deleteDocumentTag(id) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable for document tag deletion.");
  await db.delete(documentTaxonomyTags).where(eq(documentTaxonomyTags.id, id));
  return { success: true };
}
async function listPersistedDocumentMetadata(bookingId) {
  const db = await getDb();
  if (!db) return [];
  const records = await db.select().from(persistedDocumentMetadata).where(eq(persistedDocumentMetadata.bookingId, bookingId));
  return records.map((record) => ({
    ...record,
    tags: normalizeTags(record.tagsJson)
  }));
}
async function upsertPersistedDocumentMetadata(input) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable for document metadata persistence.");
  const values = {
    id: input.id,
    bookingId: input.bookingId,
    name: input.name,
    departmentCode: input.departmentCode,
    state: input.state,
    category: input.category ?? null,
    tagsJson: input.tags ? JSON.stringify(input.tags) : null,
    fileName: input.fileName ?? null,
    fileType: input.fileType ?? null,
    fileSize: input.fileSize ?? null,
    uploadedBy: input.uploadedBy ?? null
  };
  await db.insert(persistedDocumentMetadata).values(values).onDuplicateKeyUpdate({
    set: {
      state: values.state,
      category: values.category,
      tagsJson: values.tagsJson,
      fileName: values.fileName,
      fileType: values.fileType,
      fileSize: values.fileSize,
      uploadedBy: values.uploadedBy
    }
  });
  const result = await db.select().from(persistedDocumentMetadata).where(eq(persistedDocumentMetadata.id, input.id)).limit(1);
  return {
    ...result[0],
    tags: normalizeTags(result[0].tagsJson)
  };
}
async function seedDocumentTaxonomy() {
  const db = await getDb();
  if (!db) return;
  const defaults = [
    { name: "Safety & HSE", description: "Safety plans, approvals, and site controls." },
    { name: "Commercial", description: "LPOs, licenses, and commercial documentation." },
    { name: "Crew & Competency", description: "Crew certificates, training, and competency records." },
    { name: "Access & Permits", description: "Site access passes and permits." },
    { name: "Transport & Delivery", description: "Delivery notes and transport records." },
    { name: "Other", description: "Other client-submitted documents." }
  ];
  for (const category of defaults) {
    await db.insert(documentTaxonomyCategories).values(category).onDuplicateKeyUpdate({ set: { description: category.description } });
  }
}
async function deletePersistedDocumentMetadata(id) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable for document metadata deletion.");
  await db.delete(persistedDocumentMetadata).where(eq(persistedDocumentMetadata.id, id));
  return { success: true };
}
async function listClientFilterPresets(userId) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(clientFilterPresets).where(eq(clientFilterPresets.userId, userId)).orderBy(desc(clientFilterPresets.updatedAt));
}
async function saveClientFilterPreset(input) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const id = input.id ?? `preset-${nanoid(12)}`;
  const tagsJson = JSON.stringify(input.tags);
  const [existing] = await db.select().from(clientFilterPresets).where(and(eq(clientFilterPresets.userId, input.userId), eq(clientFilterPresets.name, input.name))).limit(1);
  if (existing && !input.id) {
    await db.update(clientFilterPresets).set({
      category: input.category,
      tagsJson,
      search: input.search,
      updatedAt: /* @__PURE__ */ new Date()
    }).where(eq(clientFilterPresets.id, existing.id));
    const [updated] = await db.select().from(clientFilterPresets).where(eq(clientFilterPresets.id, existing.id)).limit(1);
    return updated;
  }
  await db.insert(clientFilterPresets).values({
    id,
    userId: input.userId,
    name: input.name,
    category: input.category,
    tagsJson,
    search: input.search
  }).onDuplicateKeyUpdate({
    set: {
      category: input.category,
      tagsJson,
      search: input.search
    }
  });
  const [saved] = await db.select().from(clientFilterPresets).where(eq(clientFilterPresets.id, id)).limit(1);
  return saved;
}
async function deleteClientFilterPreset(userId, name) {
  const db = await getDb();
  if (!db) return;
  await db.delete(clientFilterPresets).where(and(eq(clientFilterPresets.userId, userId), eq(clientFilterPresets.name, name)));
}

// server/_core/cookies.ts
function isSecureRequest(req) {
  if (req.protocol === "https") return true;
  const forwardedProto = req.headers["x-forwarded-proto"];
  if (!forwardedProto) return false;
  const protoList = Array.isArray(forwardedProto) ? forwardedProto : forwardedProto.split(",");
  return protoList.some((proto) => proto.trim().toLowerCase() === "https");
}
function getSessionCookieOptions(req) {
  return {
    httpOnly: true,
    path: "/",
    sameSite: "none",
    secure: isSecureRequest(req)
  };
}

// shared/_core/errors.ts
var HttpError = class extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
    this.name = "HttpError";
  }
};
var ForbiddenError = (msg) => new HttpError(403, msg);

// server/_core/sdk.ts
import axios from "axios";
import { parse as parseCookieHeader } from "cookie";
import { SignJWT, jwtVerify } from "jose";
var isNonEmptyString = (value) => typeof value === "string" && value.length > 0;
var EXCHANGE_TOKEN_PATH = `/webdev.v1.WebDevAuthPublicService/ExchangeToken`;
var GET_USER_INFO_PATH = `/webdev.v1.WebDevAuthPublicService/GetUserInfo`;
var GET_USER_INFO_WITH_JWT_PATH = `/webdev.v1.WebDevAuthPublicService/GetUserInfoWithJwt`;
var OAuthService = class {
  constructor(client) {
    this.client = client;
    console.log("[OAuth] Initialized with baseURL:", ENV.oAuthServerUrl);
    if (!ENV.oAuthServerUrl) {
      console.error(
        "[OAuth] ERROR: OAUTH_SERVER_URL is not configured! Set OAUTH_SERVER_URL environment variable."
      );
    }
  }
  decodeState(state) {
    return decodeOAuthState(state).redirectUri;
  }
  async getTokenByCode(code, state) {
    const payload = {
      clientId: ENV.appId,
      grantType: "authorization_code",
      code,
      redirectUri: this.decodeState(state)
    };
    const { data } = await this.client.post(
      EXCHANGE_TOKEN_PATH,
      payload
    );
    return data;
  }
  async getUserInfoByToken(token) {
    const { data } = await this.client.post(
      GET_USER_INFO_PATH,
      {
        accessToken: token.accessToken
      }
    );
    return data;
  }
};
var createOAuthHttpClient = () => axios.create({
  baseURL: ENV.oAuthServerUrl,
  timeout: AXIOS_TIMEOUT_MS
});
var SDKServer = class {
  client;
  oauthService;
  constructor(client = createOAuthHttpClient()) {
    this.client = client;
    this.oauthService = new OAuthService(this.client);
  }
  deriveLoginMethod(platforms, fallback) {
    if (fallback && fallback.length > 0) return fallback;
    if (!Array.isArray(platforms) || platforms.length === 0) return null;
    const set = new Set(
      platforms.filter((p) => typeof p === "string")
    );
    if (set.has("REGISTERED_PLATFORM_EMAIL")) return "email";
    if (set.has("REGISTERED_PLATFORM_GOOGLE")) return "google";
    if (set.has("REGISTERED_PLATFORM_APPLE")) return "apple";
    if (set.has("REGISTERED_PLATFORM_MICROSOFT") || set.has("REGISTERED_PLATFORM_AZURE"))
      return "microsoft";
    if (set.has("REGISTERED_PLATFORM_GITHUB")) return "github";
    const first = Array.from(set)[0];
    return first ? first.toLowerCase() : null;
  }
  /**
   * Exchange OAuth authorization code for access token
   * @example
   * const tokenResponse = await sdk.exchangeCodeForToken(code, state);
   */
  async exchangeCodeForToken(code, state) {
    return this.oauthService.getTokenByCode(code, state);
  }
  /**
   * Get user information using access token
   * @example
   * const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);
   */
  async getUserInfo(accessToken) {
    const data = await this.oauthService.getUserInfoByToken({
      accessToken
    });
    const loginMethod = this.deriveLoginMethod(
      data?.platforms,
      data?.platform ?? data.platform ?? null
    );
    return {
      ...data,
      platform: loginMethod,
      loginMethod
    };
  }
  parseCookies(cookieHeader) {
    if (!cookieHeader) {
      return /* @__PURE__ */ new Map();
    }
    const parsed = parseCookieHeader(cookieHeader);
    return new Map(Object.entries(parsed));
  }
  getSessionSecret() {
    const secret = ENV.cookieSecret;
    return new TextEncoder().encode(secret);
  }
  /**
   * Create a session token for a Manus user openId
   * @example
   * const sessionToken = await sdk.createSessionToken(userInfo.openId);
   */
  async createSessionToken(openId, options = {}) {
    return this.signSession(
      {
        openId,
        appId: ENV.appId,
        name: options.name || ""
      },
      options
    );
  }
  async signSession(payload, options = {}) {
    const issuedAt = Date.now();
    const expiresInMs = options.expiresInMs ?? ONE_YEAR_MS;
    const expirationSeconds = Math.floor((issuedAt + expiresInMs) / 1e3);
    const secretKey = this.getSessionSecret();
    return new SignJWT({
      openId: payload.openId,
      appId: payload.appId,
      name: payload.name
    }).setProtectedHeader({ alg: "HS256", typ: "JWT" }).setExpirationTime(expirationSeconds).sign(secretKey);
  }
  async verifySession(cookieValue) {
    if (!cookieValue) {
      console.warn("[Auth] Missing session cookie");
      return null;
    }
    try {
      const secretKey = this.getSessionSecret();
      const { payload } = await jwtVerify(cookieValue, secretKey, {
        algorithms: ["HS256"]
      });
      const { openId, appId, name } = payload;
      if (!isNonEmptyString(openId) || !isNonEmptyString(appId) || !isNonEmptyString(name)) {
        console.warn("[Auth] Session payload missing required fields");
        return null;
      }
      return {
        openId,
        appId,
        name
      };
    } catch (error) {
      console.warn("[Auth] Session verification failed", String(error));
      return null;
    }
  }
  async getUserInfoWithJwt(jwtToken) {
    const payload = {
      jwtToken,
      projectId: ENV.appId
    };
    const { data } = await this.client.post(
      GET_USER_INFO_WITH_JWT_PATH,
      payload
    );
    const loginMethod = this.deriveLoginMethod(
      data?.platforms,
      data?.platform ?? data.platform ?? null
    );
    return {
      ...data,
      platform: loginMethod,
      loginMethod
    };
  }
  async authenticateRequest(req) {
    const cookies = this.parseCookies(req.headers.cookie);
    let sessionToken = cookies.get(COOKIE_NAME);
    if (!sessionToken) {
      const authHeader = req.headers.authorization;
      if (typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
        sessionToken = authHeader.slice(7);
      }
    }
    const session = await this.verifySession(sessionToken);
    if (!session) {
      throw ForbiddenError("Invalid session cookie");
    }
    if (session.openId.startsWith(CRON_OPEN_ID_PREFIX)) {
      const userInfo = await this.getUserInfoWithJwt(sessionToken ?? "");
      const taskUid = userInfo.taskUid ?? null;
      if (!taskUid) {
        throw ForbiddenError("Cron session missing task_uid");
      }
      return buildCronUser(userInfo);
    }
    const sessionUserId = session.openId;
    const signedInAt = /* @__PURE__ */ new Date();
    let user = await getUserByOpenId(sessionUserId);
    if (!user) {
      try {
        const userInfo = await this.getUserInfoWithJwt(sessionToken ?? "");
        await upsertUser({
          openId: userInfo.openId,
          name: userInfo.name || null,
          email: userInfo.email ?? null,
          loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
          lastSignedIn: signedInAt
        });
        user = await getUserByOpenId(userInfo.openId);
      } catch (error) {
        console.error("[Auth] Failed to sync user from OAuth:", error);
        throw ForbiddenError("Failed to sync user info");
      }
    }
    if (!user) {
      throw ForbiddenError("User not found");
    }
    await upsertUser({
      openId: user.openId,
      lastSignedIn: signedInAt
    });
    return user;
  }
};
var CRON_OPEN_ID_PREFIX = "cron_";
function buildCronUser(userInfo) {
  const now = /* @__PURE__ */ new Date();
  return {
    id: -1,
    openId: userInfo.openId,
    name: userInfo.name || "Manus Scheduled Task",
    email: null,
    loginMethod: null,
    role: "user",
    createdAt: now,
    updatedAt: now,
    lastSignedIn: now,
    taskUid: userInfo.taskUid ?? void 0,
    isCron: true
  };
}
var sdk = new SDKServer();

// server/_core/oauth.ts
function getQueryParam(req, key) {
  const value = req.query[key];
  return typeof value === "string" ? value : void 0;
}
function registerOAuthRoutes(app) {
  app.get("/api/oauth/callback", async (req, res) => {
    const code = getQueryParam(req, "code");
    const state = getQueryParam(req, "state");
    if (!code || !state) {
      res.status(400).json({ error: "code and state are required" });
      return;
    }
    const { nonce } = decodeOAuthState(state);
    const expectedNonce = parseCookieHeader2(req.headers.cookie ?? "")[OAUTH_STATE_COOKIE];
    if (!nonce || nonce !== expectedNonce) {
      res.status(403).json({ error: "invalid oauth state" });
      return;
    }
    res.clearCookie(OAUTH_STATE_COOKIE, { path: "/", secure: true, sameSite: "none" });
    try {
      const tokenResponse = await sdk.exchangeCodeForToken(code, state);
      const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);
      if (!userInfo.openId) {
        res.status(400).json({ error: "openId missing from user info" });
        return;
      }
      await upsertUser({
        openId: userInfo.openId,
        name: userInfo.name || null,
        email: userInfo.email ?? null,
        loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
        lastSignedIn: /* @__PURE__ */ new Date()
      });
      const sessionToken = await sdk.createSessionToken(userInfo.openId, {
        name: userInfo.name || "",
        expiresInMs: ONE_YEAR_MS
      });
      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
      res.redirect(302, "/");
    } catch (error) {
      console.error("[OAuth] Callback failed", error);
      res.status(500).json({ error: "OAuth callback failed" });
    }
  });
}

// server/_core/storageProxy.ts
function registerStorageProxy(app) {
  app.get("/manus-storage/*", async (req, res) => {
    const key = req.params[0];
    if (!key) {
      res.status(400).send("Missing storage key");
      return;
    }
    if (!ENV.forgeApiUrl || !ENV.forgeApiKey) {
      res.status(500).send("Storage proxy not configured");
      return;
    }
    try {
      const forgeUrl = new URL(
        "v1/storage/presign/get",
        ENV.forgeApiUrl.replace(/\/+$/, "") + "/"
      );
      forgeUrl.searchParams.set("path", key);
      const forgeResp = await fetch(forgeUrl, {
        headers: { Authorization: `Bearer ${ENV.forgeApiKey}` }
      });
      if (!forgeResp.ok) {
        const body = await forgeResp.text().catch(() => "");
        console.error(`[StorageProxy] forge error: ${forgeResp.status} ${body}`);
        res.status(502).send("Storage backend error");
        return;
      }
      const { url } = await forgeResp.json();
      if (!url) {
        res.status(502).send("Empty signed URL from backend");
        return;
      }
      res.set("Cache-Control", "no-store");
      res.redirect(307, url);
    } catch (err) {
      console.error("[StorageProxy] failed:", err);
      res.status(502).send("Storage proxy error");
    }
  });
}

// server/_core/systemRouter.ts
import { z } from "zod";

// server/_core/notification.ts
import { TRPCError } from "@trpc/server";
var TITLE_MAX_LENGTH = 1200;
var CONTENT_MAX_LENGTH = 2e4;
var trimValue = (value) => value.trim();
var isNonEmptyString2 = (value) => typeof value === "string" && value.trim().length > 0;
var buildEndpointUrl = (baseUrl) => {
  const normalizedBase = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  return new URL(
    "webdevtoken.v1.WebDevService/SendNotification",
    normalizedBase
  ).toString();
};
var validatePayload = (input) => {
  if (!isNonEmptyString2(input.title)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Notification title is required."
    });
  }
  if (!isNonEmptyString2(input.content)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Notification content is required."
    });
  }
  const title = trimValue(input.title);
  const content = trimValue(input.content);
  if (title.length > TITLE_MAX_LENGTH) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Notification title must be at most ${TITLE_MAX_LENGTH} characters.`
    });
  }
  if (content.length > CONTENT_MAX_LENGTH) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Notification content must be at most ${CONTENT_MAX_LENGTH} characters.`
    });
  }
  return { title, content };
};
async function notifyOwner(payload) {
  const { title, content } = validatePayload(payload);
  if (!ENV.forgeApiUrl) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Notification service URL is not configured."
    });
  }
  if (!ENV.forgeApiKey) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Notification service API key is not configured."
    });
  }
  const endpoint = buildEndpointUrl(ENV.forgeApiUrl);
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        accept: "application/json",
        authorization: `Bearer ${ENV.forgeApiKey}`,
        "content-type": "application/json",
        "connect-protocol-version": "1"
      },
      body: JSON.stringify({ title, content })
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      console.warn(
        `[Notification] Failed to notify owner (${response.status} ${response.statusText})${detail ? `: ${detail}` : ""}`
      );
      return false;
    }
    return true;
  } catch (error) {
    console.warn("[Notification] Error calling notification service:", error);
    return false;
  }
}

// server/_core/trpc.ts
import { initTRPC, TRPCError as TRPCError2 } from "@trpc/server";
import superjson from "superjson";
var t = initTRPC.context().create({
  transformer: superjson
});
var router = t.router;
var publicProcedure = t.procedure;
var requireUser = t.middleware(async (opts) => {
  const { ctx, next } = opts;
  if (!ctx.user) {
    throw new TRPCError2({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }
  return next({
    ctx: {
      ...ctx,
      user: ctx.user
    }
  });
});
var protectedProcedure = t.procedure.use(requireUser);
var adminProcedure = t.procedure.use(
  t.middleware(async (opts) => {
    const { ctx, next } = opts;
    if (!ctx.user || ctx.user.role !== "admin") {
      throw new TRPCError2({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }
    return next({
      ctx: {
        ...ctx,
        user: ctx.user
      }
    });
  })
);

// server/_core/systemRouter.ts
var systemRouter = router({
  health: publicProcedure.input(
    z.object({
      timestamp: z.number().min(0, "timestamp cannot be negative")
    })
  ).query(() => ({
    ok: true
  })),
  notifyOwner: adminProcedure.input(
    z.object({
      title: z.string().min(1, "title is required"),
      content: z.string().min(1, "content is required")
    })
  ).mutation(async ({ input }) => {
    const delivered = await notifyOwner(input);
    return {
      success: delivered
    };
  })
});

// shared/departmentAccess.ts
var DEPARTMENTS = [
  { code: "sales", label: "Sales & Client Relations" },
  { code: "documentation", label: "Documentation & Permits" },
  { code: "lifting-gears", label: "Lifting Gears / Engineering" },
  { code: "maintenance", label: "Maintenance" },
  { code: "crew", label: "Crew / Workmen Assignment" },
  { code: "hse", label: "HSE / Safety" },
  { code: "accounts", label: "Accounts" },
  { code: "hr", label: "HR" },
  { code: "transportation", label: "Transportation" },
  { code: "administrator", label: "Administrator / Super Admin" }
];
var DEPARTMENT_BY_CODE = Object.fromEntries(
  DEPARTMENTS.map((department) => [department.code, department])
);
var DEPARTMENT_LABEL_TO_CODE = Object.fromEntries(
  DEPARTMENTS.map((department) => [department.label, department.code])
);
function roleLabel(role) {
  return role === "admin" ? "Administrator" : role === "supervisor" ? "Department supervisor" : "Department user";
}
function isDepartmentCode(value) {
  return value in DEPARTMENT_BY_CODE;
}
function canAccessDepartment(user, departmentCode) {
  return user.role === "admin" || user.departmentCode === departmentCode;
}

// shared/activityRules.ts
var signInActivity = (userId) => ({
  userId,
  action: "sign_in",
  detail: "Signed in to the department workspace."
});
var profileUpdateActivity = (userId, actorLabel, roleLabel2, departmentLabel) => ({
  userId,
  action: "profile_update",
  detail: `Profile updated by ${actorLabel}${roleLabel2 ? ` \xB7 role set to ${roleLabel2}` : ""}${departmentLabel ? ` \xB7 department set to ${departmentLabel}` : ""}.`
});
var accountStatusActivity = (userId, isActive, actorLabel) => ({
  userId,
  action: isActive ? "account_activated" : "account_deactivated",
  detail: `${isActive ? "Account activated" : "Account deactivated"} by ${actorLabel}.`
});

// shared/accountNotifications.ts
function accountUpdateNotification(roleLabel2, departmentLabel) {
  return {
    title: "Your profile or role was updated",
    body: `An administrator updated your profile. Your access is now ${roleLabel2} in ${departmentLabel}. Sign in to review the latest details.`
  };
}

// server/routers/auth.ts
import { TRPCError as TRPCError4 } from "@trpc/server";
import { z as z3 } from "zod";

// server/localAuth.ts
import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { parse } from "cookie";
import { jwtVerify as jwtVerify2, SignJWT as SignJWT2 } from "jose";
var scryptAsync = promisify(scrypt);
var SESSION_ISSUER = "bob-cranes-local-auth";
var SESSION_AUDIENCE = "bob-cranes-operations-portal";
var SESSION_LIFETIME = "12h";
function sessionKey() {
  if (!ENV.cookieSecret) {
    throw new Error("JWT_SECRET must be configured before local password sign-in can be used.");
  }
  return new TextEncoder().encode(ENV.cookieSecret);
}
function normalizeEmail(value) {
  return value.trim().toLowerCase();
}
async function hashPassword(password) {
  const salt = randomBytes(16).toString("base64url");
  const derived = await scryptAsync(password, salt, 64);
  return `scrypt$${salt}$${derived.toString("base64url")}`;
}
async function verifyPassword(password, storedHash) {
  const [algorithm, salt, saved] = storedHash.split("$");
  if (algorithm !== "scrypt" || !salt || !saved) return false;
  const expected = Buffer.from(saved, "base64url");
  const derived = await scryptAsync(password, salt, expected.length);
  return expected.length === derived.length && timingSafeEqual(expected, derived);
}
async function createLocalSession(user) {
  return new SignJWT2({ type: "password" }).setProtectedHeader({ alg: "HS256" }).setSubject(String(user.id)).setIssuer(SESSION_ISSUER).setAudience(SESSION_AUDIENCE).setIssuedAt().setExpirationTime(SESSION_LIFETIME).sign(sessionKey());
}
async function readLocalSession(cookieHeader) {
  const token = cookieHeader ? parse(cookieHeader)[LOCAL_AUTH_COOKIE_NAME] : void 0;
  if (!token) return void 0;
  try {
    const { payload } = await jwtVerify2(token, sessionKey(), {
      issuer: SESSION_ISSUER,
      audience: SESSION_AUDIENCE
    });
    const userId = Number(payload.sub);
    return Number.isSafeInteger(userId) && userId > 0 ? userId : void 0;
  } catch {
    return void 0;
  }
}
function toSessionUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.localEmail ?? user.email,
    companyName: user.companyName,
    phone: user.phone,
    role: user.role,
    departmentCode: user.departmentCode,
    supervisorId: user.supervisorId,
    isActive: user.isActive,
    createdAt: user.createdAt,
    lastSignedIn: user.lastSignedIn
  };
}

// shared/dashboardGreeting.ts
function isValidDashboardGreetingTemplate(template) {
  const normalized = template.trim();
  return normalized.length >= 3 && normalized.length <= 120 && normalized.includes("{name}");
}

// server/_core/helpers.ts
import { TRPCError as TRPCError3 } from "@trpc/server";
import { z as z2 } from "zod";
var accountInput = z2.object({
  name: z2.string().trim().min(2).max(120),
  email: z2.string().trim().email().max(320),
  password: z2.string().min(10).max(160),
  departmentCode: z2.string().trim().min(3).max(16)
});
var registrationInput = accountInput.extend({
  role: z2.enum(["user", "supervisor"]).default("user")
});
var workflowChecklistInput = z2.object({
  id: z2.string().trim().min(2).max(64),
  label: z2.string().trim().min(2).max(160),
  category: z2.string().trim().min(2).max(80),
  required: z2.boolean(),
  guidance: z2.string().trim().min(2).max(600)
});
var localSessionMaxAge = 12 * 60 * 60 * 1e3;
function writeLocalSession(ctx, token) {
  ctx.res.cookie(LOCAL_AUTH_COOKIE_NAME, token, {
    ...getSessionCookieOptions(ctx.req),
    maxAge: localSessionMaxAge
  });
}
function clearAuthCookies(ctx) {
  const cookieOptions = getSessionCookieOptions(ctx.req);
  ctx.res.clearCookie(COOKIE_NAME, cookieOptions);
  ctx.res.clearCookie(LOCAL_AUTH_COOKIE_NAME, cookieOptions);
}
function requireDepartmentAccess(user, code) {
  if (!canAccessDepartment(user, code)) {
    throw new TRPCError3({
      code: "FORBIDDEN",
      message: "Your department account cannot access this workspace."
    });
  }
}
function requireAccountManagementAccess(user, targetDepartment) {
  if (user.role === "admin") return;
  if (user.role === "supervisor" && user.departmentCode && targetDepartment === user.departmentCode)
    return;
  throw new TRPCError3({
    code: "FORBIDDEN",
    message: "Only an administrator or the department supervisor can manage this account."
  });
}
function requireDocumentTaxonomyManager(user) {
  if (user.role !== "admin" && user.role !== "supervisor") {
    throw new TRPCError3({
      code: "FORBIDDEN",
      message: "Only supervisors and administrators can manage document categories and tags."
    });
  }
}
async function requireActiveProvisionedDepartment(code) {
  const dashboard = await getProvisionedDepartmentDashboard(code);
  if (!dashboard || dashboard.active !== 1) {
    throw new TRPCError3({
      code: "BAD_REQUEST",
      message: "Choose an active department dashboard before assigning access."
    });
  }
  return dashboard;
}

// server/routers/auth.ts
var authRouter = router({
  setupStatus: publicProcedure.query(async () => ({
    needsAdminSetup: await countLocalUsers() === 0
  })),
  me: publicProcedure.query(
    (opts) => opts.ctx.user ? toSessionUser(opts.ctx.user) : null
  ),
  updateMyContactDetails: protectedProcedure.input(
    z3.object({
      companyName: z3.string().trim().max(160).optional().or(z3.literal("")),
      phone: z3.string().trim().max(48).optional().or(z3.literal(""))
    })
  ).mutation(async ({ ctx, input }) => {
    const user = await updateUserProfileContactDetails(ctx.user.id, {
      companyName: input.companyName?.trim() || null,
      phone: input.phone?.trim() || null
    });
    if (!user)
      throw new TRPCError4({
        code: "NOT_FOUND",
        message: "Your profile could not be updated."
      });
    await addUserActivity(
      profileUpdateActivity(
        ctx.user.id,
        ctx.user.name ?? ctx.user.email ?? "Current user"
      )
    );
    return toSessionUser(user);
  }),
  bootstrapAdmin: publicProcedure.input(accountInput).mutation(async ({ ctx, input }) => {
    if (await countLocalUsers() > 0) {
      throw new TRPCError4({
        code: "FORBIDDEN",
        message: "An administrator account is already configured."
      });
    }
    const email = normalizeEmail(input.email);
    const passwordHash = await hashPassword(input.password);
    const user = await createLocalUser({
      name: input.name,
      email,
      passwordHash,
      departmentCode: "administrator",
      role: "admin"
    });
    writeLocalSession(ctx, await createLocalSession(user));
    return toSessionUser(user);
  }),
  login: publicProcedure.input(
    z3.object({
      email: z3.string().trim().email().max(320),
      password: z3.string().min(1).max(160)
    })
  ).mutation(async ({ ctx, input }) => {
    const user = await getUserByLocalEmail(
      normalizeEmail(input.email)
    );
    const passwordMatches = user?.passwordHash ? await verifyPassword(input.password, user.passwordHash) : false;
    if (!user || user.isActive !== 1 || !passwordMatches) {
      throw new TRPCError4({
        code: "UNAUTHORIZED",
        message: "Invalid email or password."
      });
    }
    if (user.role !== "admin" && user.departmentCode && !isDepartmentCode(user.departmentCode)) {
      const dashboard = await getProvisionedDepartmentDashboard(
        user.departmentCode
      );
      if (!dashboard || dashboard.active !== 1) {
        throw new TRPCError4({
          code: "UNAUTHORIZED",
          message: "Invalid email or password."
        });
      }
    }
    await updateUserLastSignedIn(user.id);
    await addUserActivity(signInActivity(user.id));
    writeLocalSession(ctx, await createLocalSession(user));
    return toSessionUser({ ...user, lastSignedIn: /* @__PURE__ */ new Date() });
  }),
  listUsers: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user.role === "admin")
      return (await listLocalUsers()).map(toSessionUser);
    if (ctx.user.role === "supervisor" && ctx.user.departmentCode)
      return (await listLocalUsers()).filter(
        (account) => account.departmentCode === ctx.user.departmentCode
      ).map(toSessionUser);
    throw new TRPCError4({
      code: "FORBIDDEN",
      message: "Only department supervisors can view their department accounts."
    });
  }),
  listActivity: protectedProcedure.input(
    z3.object({
      from: z3.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      to: z3.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      limit: z3.number().int().min(1).max(250).optional()
    }).optional()
  ).query(async ({ ctx, input }) => {
    const from = input?.from ? /* @__PURE__ */ new Date(`${input.from}T00:00:00.000Z`) : void 0;
    const to = input?.to ? /* @__PURE__ */ new Date(`${input.to}T23:59:59.999Z`) : void 0;
    if (from && to && from > to)
      throw new TRPCError4({
        code: "BAD_REQUEST",
        message: "The activity start date must be before the end date."
      });
    if (ctx.user.role === "admin")
      return await listRecentUserActivity({
        from,
        to,
        limit: input?.limit ?? 100
      });
    if (ctx.user.role === "supervisor" && ctx.user.departmentCode)
      return await listRecentUserActivity({
        from,
        to,
        limit: input?.limit ?? 100,
        departmentCode: ctx.user.departmentCode
      });
    throw new TRPCError4({
      code: "FORBIDDEN",
      message: "Only department supervisors can view their department activity."
    });
  }),
  getSupervisorPermissionAudit: adminProcedure.query(async () => {
    const accounts = await listLocalUsers();
    return accounts.filter((account) => account.role === "supervisor").map((supervisor) => ({
      id: supervisor.id,
      name: supervisor.name,
      email: supervisor.localEmail ?? supervisor.email,
      departmentCode: supervisor.departmentCode,
      isActive: supervisor.isActive,
      createdAt: supervisor.createdAt,
      lastSignedIn: supervisor.lastSignedIn,
      managedUserCount: accounts.filter(
        (account) => account.role === "user" && account.departmentCode === supervisor.departmentCode && account.isActive === 1
      ).length
    }));
  }),
  getActivityRetention: adminProcedure.query(async () => ({
    retentionDays: await getActivityRetentionDays()
  })),
  getDashboardGreeting: protectedProcedure.query(async () => ({
    template: await getDashboardGreetingTemplate()
  })),
  updateDashboardGreeting: adminProcedure.input(
    z3.object({
      template: z3.string().trim().refine(isValidDashboardGreetingTemplate, {
        message: "Use 3\u2013120 characters and include {name} to personalize the greeting."
      })
    })
  ).mutation(async ({ ctx, input }) => {
    const template = await setDashboardGreetingTemplate(
      input.template.trim(),
      ctx.user.id
    );
    await addUserActivity({
      userId: ctx.user.id,
      action: "dashboard_greeting_updated",
      detail: `${ctx.user.name ?? ctx.user.email ?? "Administrator"} updated the dashboard greeting template.`
    });
    return { template };
  }),
  updateActivityRetention: adminProcedure.input(
    z3.object({
      retentionDays: z3.union([
        z3.literal(30),
        z3.literal(90),
        z3.literal(180),
        z3.literal(365),
        z3.literal(730)
      ])
    })
  ).mutation(async ({ ctx, input }) => {
    const retentionDays = await setActivityRetentionDays(
      input.retentionDays,
      ctx.user.id
    );
    await addUserActivity({
      userId: ctx.user.id,
      action: "retention_setting_updated",
      detail: `${ctx.user.name ?? ctx.user.email ?? "Administrator"} set activity-log retention to ${retentionDays} days.`
    });
    return { retentionDays };
  }),
  purgeExpiredActivity: adminProcedure.input(z3.object({ confirm: z3.literal(true) })).mutation(async ({ ctx }) => {
    const retentionDays = await getActivityRetentionDays();
    const cutoff = new Date(
      Date.now() - retentionDays * 24 * 60 * 60 * 1e3
    );
    const purgedCount = await purgeUserActivityBefore(cutoff);
    await addUserActivity({
      userId: ctx.user.id,
      action: "retention_purge",
      detail: `${ctx.user.name ?? ctx.user.email ?? "Administrator"} purged ${purgedCount} activity event${purgedCount === 1 ? "" : "s"} older than ${retentionDays} days.`
    });
    return { retentionDays, purgedCount, cutoff };
  }),
  registerUser: protectedProcedure.input(registrationInput).mutation(async ({ ctx, input }) => {
    const targetRole = input.role;
    if (targetRole === "supervisor" && ctx.user.role !== "admin") {
      throw new TRPCError4({
        code: "FORBIDDEN",
        message: "Only an administrator can add a department supervisor."
      });
    }
    requireAccountManagementAccess(ctx.user, input.departmentCode);
    if (input.departmentCode === "administrator")
      throw new TRPCError4({
        code: "BAD_REQUEST",
        message: "Use the administrator setup flow for the administrator department."
      });
    if (!isDepartmentCode(input.departmentCode))
      await requireActiveProvisionedDepartment(input.departmentCode);
    const email = normalizeEmail(input.email);
    if (await getUserByLocalEmail(email)) {
      throw new TRPCError4({
        code: "CONFLICT",
        message: "An account already exists for this email address."
      });
    }
    const passwordHash = await hashPassword(input.password);
    const user = await createLocalUser({
      name: input.name,
      email,
      passwordHash,
      departmentCode: input.departmentCode,
      role: targetRole,
      supervisorId: ctx.user.role === "supervisor" ? ctx.user.id : null
    });
    return toSessionUser(user);
  }),
  updateUser: protectedProcedure.input(
    z3.object({
      id: z3.number().int().positive(),
      name: z3.string().trim().min(2).max(120),
      email: z3.string().trim().email().max(320),
      departmentCode: z3.string().trim().min(3).max(16),
      role: z3.enum(["user", "supervisor", "admin"]),
      password: z3.string().min(10).max(160).optional().or(z3.literal(""))
    })
  ).mutation(async ({ ctx, input }) => {
    if (input.id === ctx.user.id)
      throw new TRPCError4({
        code: "FORBIDDEN",
        message: "You cannot edit your own account here."
      });
    if (input.role === "admin" && ctx.user.role !== "admin")
      throw new TRPCError4({
        code: "FORBIDDEN",
        message: "Only an administrator can assign administrator access."
      });
    const existing = await getUserById(input.id);
    if (!existing?.localEmail)
      throw new TRPCError4({
        code: "NOT_FOUND",
        message: "That local account could not be found."
      });
    requireAccountManagementAccess(ctx.user, existing.departmentCode);
    if (ctx.user.role === "supervisor" && (existing.departmentCode !== input.departmentCode || input.role !== "user")) {
      throw new TRPCError4({
        code: "FORBIDDEN",
        message: "Supervisors can only edit users in their own department."
      });
    }
    if (existing.role === "admin" && ctx.user.role !== "admin")
      throw new TRPCError4({
        code: "FORBIDDEN",
        message: "Administrator accounts are managed by administrators only."
      });
    const email = normalizeEmail(input.email);
    const emailOwner = await getUserByLocalEmail(email);
    if (emailOwner && emailOwner.id !== input.id)
      throw new TRPCError4({
        code: "CONFLICT",
        message: "An account already exists for this email address."
      });
    const departmentCode = input.role === "admin" ? "administrator" : input.departmentCode;
    if (input.role !== "admin" && !isDepartmentCode(departmentCode))
      await requireActiveProvisionedDepartment(departmentCode);
    const user = await updateLocalUser(input.id, {
      name: input.name,
      email,
      departmentCode,
      role: input.role,
      supervisorId: input.role === "user" && ctx.user.role === "supervisor" ? ctx.user.id : input.role === "admin" || input.role === "supervisor" ? null : existing.supervisorId,
      ...input.password ? { passwordHash: await hashPassword(input.password) } : {}
    });
    if (!user)
      throw new TRPCError4({
        code: "NOT_FOUND",
        message: "The account could not be updated."
      });
    const actorLabel = ctx.user.name ?? ctx.user.email ?? "an administrator";
    const nextRoleLabel = roleLabel(input.role);
    const departmentLabel = input.role === "admin" ? "Administrator" : DEPARTMENTS.find(
      (department) => department.code === input.departmentCode
    )?.label ?? input.departmentCode;
    await addUserActivity(
      profileUpdateActivity(
        input.id,
        actorLabel,
        nextRoleLabel,
        departmentLabel
      )
    );
    const accountNotification = accountUpdateNotification(
      nextRoleLabel,
      departmentLabel
    );
    await addNotification({
      id: `account-update-${user.id}-${Date.now()}`,
      userId: user.id,
      departmentCode: user.departmentCode ?? input.departmentCode,
      ...accountNotification
    });
    return toSessionUser(user);
  }),
  setUserActive: protectedProcedure.input(
    z3.object({ id: z3.number().int().positive(), isActive: z3.boolean() })
  ).mutation(async ({ ctx, input }) => {
    if (input.id === ctx.user.id)
      throw new TRPCError4({
        code: "FORBIDDEN",
        message: "You cannot deactivate your own account."
      });
    const existing = await getUserById(input.id);
    if (!existing?.localEmail)
      throw new TRPCError4({
        code: "NOT_FOUND",
        message: "That local account could not be found."
      });
    if (existing.role === "admin")
      throw new TRPCError4({
        code: "FORBIDDEN",
        message: "Administrator accounts cannot be deactivated from this workspace."
      });
    requireAccountManagementAccess(ctx.user, existing.departmentCode);
    if (ctx.user.role === "supervisor" && existing.role !== "user")
      throw new TRPCError4({
        code: "FORBIDDEN",
        message: "Supervisors can only manage users in their own department."
      });
    const user = await setLocalUserActive(
      input.id,
      input.isActive ? 1 : 0
    );
    if (!user)
      throw new TRPCError4({
        code: "NOT_FOUND",
        message: "The account status could not be updated."
      });
    await addUserActivity(
      accountStatusActivity(
        input.id,
        input.isActive,
        ctx.user.name ?? ctx.user.email ?? "a department supervisor"
      )
    );
    return toSessionUser(user);
  }),
  logout: publicProcedure.mutation(({ ctx }) => {
    clearAuthCookies(ctx);
    return { success: true };
  })
});

// server/routers/departments.ts
import { TRPCError as TRPCError5 } from "@trpc/server";
import { z as z4 } from "zod";

// shared/departmentDashboardRules.ts
var DEPARTMENT_DASHBOARD_ACCENTS = ["orange", "blue", "green", "violet"];
var DEPARTMENT_DASHBOARD_ICONS = ["LayoutDashboard", "HardHat", "ShieldCheck", "Truck", "Users", "ClipboardCheck"];
var DEPARTMENT_WORKSTREAMS = ["operations", "compliance", "commercial", "support"];
var DEPARTMENT_DASHBOARD_WIDGETS = ["handoff_queue", "team_readiness", "workflow_library"];
var DEPARTMENT_DASHBOARD_METRICS = ["active_dossiers", "priority_dossiers", "assigned_team", "total_dossiers"];
var WORKSTREAM_DETAILS = {
  operations: {
    objective: "Coordinate field readiness, equipment and crew handoffs for active dossiers.",
    primaryMetricLabel: "Active dossiers",
    secondaryMetricLabel: "Readiness checks",
    quickActions: ["Review work queue", "Coordinate team"]
  },
  compliance: {
    objective: "Control evidence, verification and compliance handoffs before dispatch.",
    primaryMetricLabel: "Evidence checks",
    secondaryMetricLabel: "Items awaiting review",
    quickActions: ["Review evidence", "Escalate a gap"]
  },
  commercial: {
    objective: "Prioritise client commitments, approvals and commercial follow-through.",
    primaryMetricLabel: "Client commitments",
    secondaryMetricLabel: "Priority dossiers",
    quickActions: ["Review commitments", "Open client portal"]
  },
  support: {
    objective: "Keep shared service requests, records and team readiness on track.",
    primaryMetricLabel: "Open requests",
    secondaryMetricLabel: "Team updates",
    quickActions: ["Review requests", "Manage team"]
  }
};
function createDepartmentDashboardConfig(input) {
  const detail = WORKSTREAM_DETAILS[input.workstream];
  return {
    version: 2,
    workstream: input.workstream,
    overviewLabel: `${input.name} workspace`,
    widgets: ["handoff_queue", "team_readiness", "workflow_library"],
    metrics: ["active_dossiers", "priority_dossiers"],
    ...detail
  };
}
function normalizeDepartmentDashboardConfig(value, fallback) {
  const base = createDepartmentDashboardConfig({
    name: fallback.name,
    workstream: fallback.workstream ?? "operations"
  });
  if (!value || typeof value !== "object") return base;
  const candidate = value;
  const widgetSet = new Set(DEPARTMENT_DASHBOARD_WIDGETS);
  const metricSet = new Set(DEPARTMENT_DASHBOARD_METRICS);
  const widgets = Array.isArray(candidate.widgets) ? candidate.widgets.filter((widget) => typeof widget === "string" && widgetSet.has(widget)) : base.widgets;
  const metrics = Array.isArray(candidate.metrics) ? candidate.metrics.filter((metric) => typeof metric === "string" && metricSet.has(metric)) : base.metrics;
  const workstream = DEPARTMENT_WORKSTREAMS.includes(candidate.workstream) ? candidate.workstream : base.workstream;
  return {
    version: 2,
    workstream,
    overviewLabel: typeof candidate.overviewLabel === "string" ? candidate.overviewLabel : base.overviewLabel,
    objective: typeof candidate.objective === "string" ? candidate.objective : base.objective,
    primaryMetricLabel: typeof candidate.primaryMetricLabel === "string" ? candidate.primaryMetricLabel : base.primaryMetricLabel,
    secondaryMetricLabel: typeof candidate.secondaryMetricLabel === "string" ? candidate.secondaryMetricLabel : base.secondaryMetricLabel,
    quickActions: Array.isArray(candidate.quickActions) && candidate.quickActions.length === 2 && candidate.quickActions.every((action) => typeof action === "string") ? [candidate.quickActions[0], candidate.quickActions[1]] : base.quickActions,
    widgets: widgets.length ? widgets : base.widgets,
    metrics: metrics.length >= 2 ? [metrics[0], metrics[1]] : base.metrics
  };
}
function canAccessProvisionedDepartmentDashboard(actor, departmentCode) {
  return actor.role === "admin" || actor.departmentCode === departmentCode;
}
function canManageProvisionedDepartmentDashboard(actor, departmentCode) {
  return actor.role === "admin" || actor.role === "supervisor" && actor.departmentCode === departmentCode;
}
function defaultWorkflowChecklist(workstream) {
  const shared = [
    { id: "scope-review", label: "Scope and dossier review", category: "Planning", required: true, guidance: "Confirm the client brief, project location, dates, and assigned handoff owner." },
    { id: "handoff-note", label: "Department handoff note", category: "Coordination", required: true, guidance: "Record the decision, open items, and named next owner before handoff." }
  ];
  const workstreamItem = {
    operations: { id: "field-readiness", label: "Field readiness confirmation", category: "Operations", required: true, guidance: "Confirm equipment, crew, access, and site readiness before mobilization." },
    compliance: { id: "evidence-check", label: "Required evidence check", category: "Compliance", required: true, guidance: "Verify that each required certificate and document is current, legible, and assigned to the dossier." },
    commercial: { id: "client-approval", label: "Client approval record", category: "Commercial", required: true, guidance: "Confirm scope, commercial reference, and approved client contact details." },
    support: { id: "service-request", label: "Service request record", category: "Support", required: true, guidance: "Capture the request, priority, owner, and expected response time." }
  };
  return [...shared, workstreamItem[workstream]];
}
function normalizeDepartmentCode(value) {
  return value.trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "");
}
function isValidProvisionedDepartmentCode(value) {
  return /^[a-z][a-z0-9-]{2,15}$/.test(value);
}

// server/routers/departments.ts
var departmentsRouter = router({
  listProvisioned: protectedProcedure.query(async ({ ctx }) => {
    const dashboards = await listProvisionedDepartmentDashboards({
      includeArchived: ctx.user.role === "admin"
    });
    return ctx.user.role === "admin" ? dashboards : dashboards.filter(
      (dashboard) => dashboard.active === 1 && dashboard.code === ctx.user.departmentCode
    );
  }),
  getProvisioned: protectedProcedure.input(z4.object({ code: z4.string().trim().min(3).max(16) })).query(async ({ ctx, input }) => {
    if (!canAccessProvisionedDepartmentDashboard(ctx.user, input.code)) {
      throw new TRPCError5({
        code: "FORBIDDEN",
        message: "Your account cannot access this department dashboard."
      });
    }
    const dashboard = await getProvisionedDepartmentDashboard(input.code);
    if (!dashboard)
      throw new TRPCError5({
        code: "NOT_FOUND",
        message: "This provisioned department dashboard was not found."
      });
    if (dashboard.active !== 1 && ctx.user.role !== "admin") {
      throw new TRPCError5({
        code: "FORBIDDEN",
        message: "This department workspace is archived and unavailable."
      });
    }
    return dashboard;
  }),
  createProvisioned: adminProcedure.input(
    z4.object({
      name: z4.string().trim().min(3).max(120),
      code: z4.string().trim().min(3).max(32),
      description: z4.string().trim().min(12).max(600),
      accent: z4.enum(DEPARTMENT_DASHBOARD_ACCENTS),
      icon: z4.enum(DEPARTMENT_DASHBOARD_ICONS),
      workstream: z4.enum(DEPARTMENT_WORKSTREAMS)
    })
  ).mutation(async ({ ctx, input }) => {
    const code = normalizeDepartmentCode(input.code);
    if (!isValidProvisionedDepartmentCode(code) || isDepartmentCode(code)) {
      throw new TRPCError5({
        code: "BAD_REQUEST",
        message: "Use a new 3\u201316 character department code with lowercase letters, numbers, or hyphens."
      });
    }
    try {
      const dashboardConfig = createDepartmentDashboardConfig({
        name: input.name,
        workstream: input.workstream
      });
      const created = await createProvisionedDepartmentDashboard({
        code,
        name: input.name,
        description: input.description,
        accent: input.accent,
        icon: input.icon,
        dashboardConfig,
        createdBy: ctx.user.id
      });
      await addUserActivity({
        userId: ctx.user.id,
        action: "department_created",
        detail: `${ctx.user.name ?? ctx.user.email ?? "Administrator"} provisioned the ${input.name} department dashboard.`
      });
      await addNotification({
        id: `department-provisioned-${code}-${Date.now()}`,
        departmentCode: code,
        title: `${input.name} dashboard is ready`,
        body: "Assign a supervisor and department users to begin working in this workspace."
      });
      return created;
    } catch (caught) {
      if (caught instanceof TRPCError5) throw caught;
      throw new TRPCError5({
        code: "CONFLICT",
        message: caught instanceof Error ? caught.message : "The department could not be provisioned."
      });
    }
  }),
  updateDashboardConfig: protectedProcedure.input(
    z4.object({
      code: z4.string().trim().min(3).max(16),
      overviewLabel: z4.string().trim().min(3).max(160),
      objective: z4.string().trim().min(12).max(600),
      widgets: z4.array(z4.enum(DEPARTMENT_DASHBOARD_WIDGETS)).min(1).max(DEPARTMENT_DASHBOARD_WIDGETS.length),
      metrics: z4.tuple([
        z4.enum(DEPARTMENT_DASHBOARD_METRICS),
        z4.enum(DEPARTMENT_DASHBOARD_METRICS)
      ])
    })
  ).mutation(async ({ ctx, input }) => {
    if (!canManageProvisionedDepartmentDashboard(ctx.user, input.code)) {
      throw new TRPCError5({
        code: "FORBIDDEN",
        message: "Only this department's supervisor or an administrator can configure its dashboard."
      });
    }
    const dashboard = await requireActiveProvisionedDepartment(input.code);
    const current = normalizeDepartmentDashboardConfig(
      dashboard.dashboardConfig,
      { name: dashboard.name }
    );
    const updated = await updateProvisionedDepartmentDashboardConfig({
      code: input.code,
      description: dashboard.description,
      dashboardConfig: {
        ...current,
        overviewLabel: input.overviewLabel,
        objective: input.objective,
        widgets: input.widgets,
        metrics: input.metrics
      }
    });
    await addUserActivity({
      userId: ctx.user.id,
      action: "department_dashboard_configured",
      detail: `${ctx.user.name ?? ctx.user.email ?? "A department lead"} updated the ${dashboard.name} dashboard widgets and metrics.`
    });
    return updated;
  }),
  setProvisionedActive: adminProcedure.input(
    z4.object({
      code: z4.string().trim().min(3).max(16),
      active: z4.boolean()
    })
  ).mutation(async ({ ctx, input }) => {
    const dashboard = await getProvisionedDepartmentDashboard(
      input.code
    );
    if (!dashboard)
      throw new TRPCError5({
        code: "NOT_FOUND",
        message: "This department dashboard was not found."
      });
    const updated = await setProvisionedDepartmentActive(input);
    await addUserActivity({
      userId: ctx.user.id,
      action: input.active ? "department_reactivated" : "department_archived",
      detail: `${ctx.user.name ?? ctx.user.email ?? "Administrator"} ${input.active ? "reactivated" : "archived"} the ${dashboard.name} department without deleting its history.`
    });
    return updated;
  }),
  listWorkflowTemplates: protectedProcedure.input(
    z4.object({
      departmentCode: z4.string().trim().min(3).max(16)
    })
  ).query(async ({ ctx, input }) => {
    if (!canAccessProvisionedDepartmentDashboard(
      ctx.user,
      input.departmentCode
    )) {
      throw new TRPCError5({
        code: "FORBIDDEN",
        message: "Your account cannot access this department workflow library."
      });
    }
    const dashboard = await getProvisionedDepartmentDashboard(
      input.departmentCode
    );
    if (!dashboard)
      throw new TRPCError5({
        code: "NOT_FOUND",
        message: "This department dashboard was not found."
      });
    if (dashboard.active !== 1 && ctx.user.role !== "admin") {
      throw new TRPCError5({
        code: "FORBIDDEN",
        message: "This department workspace is archived."
      });
    }
    return await listDepartmentWorkflowTemplates({
      departmentCode: input.departmentCode,
      includeArchived: ctx.user.role === "admin"
    });
  }),
  createWorkflowTemplate: protectedProcedure.input(
    z4.object({
      departmentCode: z4.string().trim().min(3).max(16),
      name: z4.string().trim().min(3).max(160),
      description: z4.string().trim().min(12).max(800),
      checklist: z4.array(workflowChecklistInput).min(1).max(16)
    })
  ).mutation(async ({ ctx, input }) => {
    if (!canManageProvisionedDepartmentDashboard(
      ctx.user,
      input.departmentCode
    )) {
      throw new TRPCError5({
        code: "FORBIDDEN",
        message: "Only this department's supervisor or an administrator can create workflow templates."
      });
    }
    await requireActiveProvisionedDepartment(input.departmentCode);
    const template = await createDepartmentWorkflowTemplate({
      ...input,
      createdBy: ctx.user.id
    });
    await addUserActivity({
      userId: ctx.user.id,
      action: "department_workflow_created",
      detail: `${ctx.user.name ?? ctx.user.email ?? "A department lead"} created the ${template.name} workflow template.`
    });
    return template;
  }),
  updateWorkflowTemplate: protectedProcedure.input(
    z4.object({
      id: z4.string().trim().min(4).max(64),
      departmentCode: z4.string().trim().min(3).max(16),
      name: z4.string().trim().min(3).max(160),
      description: z4.string().trim().min(12).max(800),
      checklist: z4.array(workflowChecklistInput).min(1).max(16)
    })
  ).mutation(async ({ ctx, input }) => {
    if (!canManageProvisionedDepartmentDashboard(
      ctx.user,
      input.departmentCode
    )) {
      throw new TRPCError5({
        code: "FORBIDDEN",
        message: "Only this department's supervisor or an administrator can update workflow templates."
      });
    }
    await requireActiveProvisionedDepartment(input.departmentCode);
    const templates = await listDepartmentWorkflowTemplates({
      departmentCode: input.departmentCode,
      includeArchived: true
    });
    if (!templates.some((template) => template.id === input.id)) {
      throw new TRPCError5({
        code: "NOT_FOUND",
        message: "This workflow template was not found in the selected department."
      });
    }
    return await updateDepartmentWorkflowTemplate(input);
  }),
  setWorkflowTemplateActive: adminProcedure.input(
    z4.object({
      id: z4.string().trim().min(4).max(64),
      departmentCode: z4.string().trim().min(3).max(16),
      active: z4.boolean()
    })
  ).mutation(async ({ ctx, input }) => {
    const templates = await listDepartmentWorkflowTemplates({
      departmentCode: input.departmentCode,
      includeArchived: true
    });
    const template = templates.find(
      (item) => item.id === input.id
    );
    if (!template)
      throw new TRPCError5({
        code: "NOT_FOUND",
        message: "This workflow template was not found."
      });
    const updated = await setDepartmentWorkflowTemplateActive({
      id: input.id,
      active: input.active
    });
    await addUserActivity({
      userId: ctx.user.id,
      action: input.active ? "department_workflow_reactivated" : "department_workflow_archived",
      detail: `${ctx.user.name ?? ctx.user.email ?? "Administrator"} ${input.active ? "restored" : "archived"} the ${template.name} workflow template.`
    });
    return updated;
  }),
  defaultWorkflowChecklist: protectedProcedure.input(
    z4.object({
      workstream: z4.enum(DEPARTMENT_WORKSTREAMS)
    })
  ).query(({ input }) => defaultWorkflowChecklist(input.workstream))
});

// server/routers/documents.ts
import { z as z5 } from "zod";
var documentsRouter = router({
  getTaxonomy: protectedProcedure.query(async () => {
    await seedDocumentTaxonomy();
    return await listDocumentTaxonomy();
  }),
  getMetadata: protectedProcedure.input(z5.object({ bookingId: z5.string().trim().min(1).max(64) })).query(async ({ input }) => await listPersistedDocumentMetadata(input.bookingId)),
  saveMetadata: protectedProcedure.input(
    z5.object({
      id: z5.string().trim().min(1).max(64),
      bookingId: z5.string().trim().min(1).max(64),
      name: z5.string().trim().min(1).max(255),
      departmentCode: z5.string().trim().min(1).max(32),
      state: z5.string().trim().min(1).max(64),
      category: z5.string().trim().max(128).nullable().optional(),
      tags: z5.array(z5.string().trim().min(1).max(64)).max(20).optional(),
      fileName: z5.string().trim().max(255).nullable().optional(),
      fileType: z5.string().trim().max(128).nullable().optional(),
      fileSize: z5.number().int().nonnegative().max(25 * 1024 * 1024).nullable().optional()
    })
  ).mutation(async ({ ctx, input }) => await upsertPersistedDocumentMetadata({ ...input, uploadedBy: ctx.user.id })),
  deleteMetadata: protectedProcedure.input(z5.object({ id: z5.string().trim().min(1).max(64) })).mutation(async ({ input }) => await deletePersistedDocumentMetadata(input.id)),
  createCategory: protectedProcedure.input(z5.object({ name: z5.string().trim().min(2).max(128), description: z5.string().trim().max(600).nullable().optional() })).mutation(async ({ ctx, input }) => {
    requireDocumentTaxonomyManager(ctx.user);
    return await createDocumentCategory({ ...input, createdBy: ctx.user.id });
  }),
  updateCategory: protectedProcedure.input(z5.object({ id: z5.number().int().positive(), name: z5.string().trim().min(2).max(128), description: z5.string().trim().max(600).nullable().optional() })).mutation(async ({ ctx, input }) => {
    requireDocumentTaxonomyManager(ctx.user);
    return await updateDocumentCategory(input);
  }),
  deleteCategory: protectedProcedure.input(z5.object({ id: z5.number().int().positive() })).mutation(async ({ ctx, input }) => {
    requireDocumentTaxonomyManager(ctx.user);
    return await deleteDocumentCategory(input.id);
  }),
  createTag: protectedProcedure.input(z5.object({ name: z5.string().trim().min(1).max(64), categoryId: z5.number().int().positive().nullable().optional() })).mutation(async ({ ctx, input }) => {
    requireDocumentTaxonomyManager(ctx.user);
    return await createDocumentTag({ ...input, createdBy: ctx.user.id });
  }),
  updateTag: protectedProcedure.input(z5.object({ id: z5.number().int().positive(), name: z5.string().trim().min(1).max(64), categoryId: z5.number().int().positive().nullable().optional() })).mutation(async ({ ctx, input }) => {
    requireDocumentTaxonomyManager(ctx.user);
    return await updateDocumentTag(input);
  }),
  deleteTag: protectedProcedure.input(z5.object({ id: z5.number().int().positive() })).mutation(async ({ ctx, input }) => {
    requireDocumentTaxonomyManager(ctx.user);
    return await deleteDocumentTag(input.id);
  })
});

// server/routers/sales.ts
import { TRPCError as TRPCError6 } from "@trpc/server";
import { z as z6 } from "zod";

// shared/rentalEnquiryOptions.ts
var RENTAL_EQUIPMENT_TYPES = [
  "Mobile crane",
  "Crawler crane",
  "Rough-terrain crane",
  "Transport and trailers",
  "Lifting gear and rigging",
  "Managed lifting service"
];
var RENTAL_DURATION_OPTIONS = [
  "One day",
  "2\u20137 days",
  "1\u20134 weeks",
  "1\u20133 months",
  "More than 3 months",
  "To be confirmed"
];

// server/routers/sales.ts
var SALES_ENQUIRY_STATUSES = ["New", "In review", "Quoted", "Converted", "Closed"];
var rentalRouter = router({
  submitEnquiry: publicProcedure.input(
    z6.object({
      contactName: z6.string().trim().min(2).max(160),
      companyName: z6.string().trim().min(2).max(160),
      email: z6.string().trim().email().max(320),
      phone: z6.string().trim().min(7).max(48),
      projectLocation: z6.string().trim().min(2).max(255),
      equipmentInterest: z6.enum(RENTAL_EQUIPMENT_TYPES),
      rentalDuration: z6.enum(RENTAL_DURATION_OPTIONS),
      liftDetails: z6.string().trim().min(12).max(2e3)
    })
  ).mutation(async ({ input }) => {
    const enquiry = await createRentalEnquiry({ ...input, email: normalizeEmail(input.email) });
    await addNotification({
      id: `rental-enquiry-follow-up-${enquiry.id}`,
      userId: null,
      departmentCode: "sales",
      title: "New rental quote follow-up",
      body: `${input.contactName} from ${input.companyName} requested ${input.equipmentInterest} for ${input.rentalDuration} at ${input.projectLocation}. Enquiry ${enquiry.id} is ready for Sales follow-up.`
    });
    return enquiry;
  })
});
var salesEnquiriesRouter = router({
  list: protectedProcedure.input(z6.object({ status: z6.enum([...SALES_ENQUIRY_STATUSES, "all"]).default("all") }).optional()).query(async ({ ctx, input }) => {
    requireDepartmentAccess(ctx.user, "sales");
    return await listRentalEnquiries({ status: input?.status ?? "all" });
  }),
  get: protectedProcedure.input(z6.object({ id: z6.string().trim().min(4).max(64) })).query(async ({ ctx, input }) => {
    requireDepartmentAccess(ctx.user, "sales");
    const enquiry = await getRentalEnquiryById(input.id);
    if (!enquiry) throw new TRPCError6({ code: "NOT_FOUND", message: "Sales enquiry not found." });
    return enquiry;
  }),
  updateStatus: protectedProcedure.input(z6.object({ id: z6.string().trim().min(4).max(64), status: z6.enum(SALES_ENQUIRY_STATUSES) })).mutation(async ({ ctx, input }) => {
    requireDepartmentAccess(ctx.user, "sales");
    const enquiry = await getRentalEnquiryById(input.id);
    if (!enquiry) throw new TRPCError6({ code: "NOT_FOUND", message: "Sales enquiry not found." });
    if (enquiry.convertedBookingId && input.status !== "Converted") throw new TRPCError6({ code: "BAD_REQUEST", message: "Converted enquiries retain their Converted status for traceability." });
    const updated = await updateRentalEnquirySalesContext(input);
    await addUserActivity({ userId: ctx.user.id, action: "sales_enquiry_status_updated", detail: `${ctx.user.name ?? ctx.user.email ?? "Sales user"} changed enquiry ${input.id} to ${input.status}.` });
    return updated;
  }),
  assignOwner: protectedProcedure.input(z6.object({ id: z6.string().trim().min(4).max(64), assignedToUserId: z6.number().int().positive().nullable() })).mutation(async ({ ctx, input }) => {
    requireDepartmentAccess(ctx.user, "sales");
    if (ctx.user.role !== "admin" && ctx.user.role !== "supervisor") throw new TRPCError6({ code: "FORBIDDEN", message: "Only Sales supervisors can assign enquiry ownership." });
    const enquiry = await getRentalEnquiryById(input.id);
    if (!enquiry) throw new TRPCError6({ code: "NOT_FOUND", message: "Sales enquiry not found." });
    if (input.assignedToUserId !== null) {
      const owner = (await listLocalUsers()).find((user) => user.id === input.assignedToUserId && user.departmentCode === "sales" && user.isActive === 1);
      if (!owner) throw new TRPCError6({ code: "BAD_REQUEST", message: "Select an active Sales account as enquiry owner." });
    }
    const updated = await updateRentalEnquirySalesContext(input);
    await addUserActivity({ userId: ctx.user.id, action: "sales_enquiry_owner_assigned", detail: `${ctx.user.name ?? ctx.user.email ?? "Sales supervisor"} ${input.assignedToUserId ? "assigned" : "cleared"} ownership for enquiry ${input.id}.` });
    if (input.assignedToUserId) await addNotification({ id: `sales-enquiry-assigned-${input.id}-${Date.now()}`, userId: input.assignedToUserId, departmentCode: "sales", title: "Rental enquiry assigned to you", body: `${enquiry.contactName} \xB7 ${enquiry.equipmentInterest} \xB7 ${enquiry.projectLocation}.` });
    return updated;
  }),
  getAuditEvents: protectedProcedure.input(z6.object({ id: z6.string().trim().min(4).max(64) })).query(async ({ ctx, input }) => {
    requireDepartmentAccess(ctx.user, "sales");
    const enquiry = await getRentalEnquiryById(input.id);
    if (!enquiry) throw new TRPCError6({ code: "NOT_FOUND", message: "Sales enquiry not found." });
    return await listRentalEnquiryEvents(input.id);
  }),
  recordQuickReply: protectedProcedure.input(z6.object({ id: z6.string().trim().min(4).max(64) })).mutation(async ({ ctx, input }) => {
    requireDepartmentAccess(ctx.user, "sales");
    const enquiry = await getRentalEnquiryById(input.id);
    if (!enquiry) throw new TRPCError6({ code: "NOT_FOUND", message: "Sales enquiry not found." });
    const event = await createRentalEnquiryEvent({
      rentalEnquiryId: input.id,
      actorUserId: ctx.user.id,
      eventType: "quick_reply_sent",
      summary: `Quick reply email opened for ${enquiry.contactName} at ${enquiry.email}.`
    });
    await addUserActivity({ userId: ctx.user.id, action: "sales_enquiry_quick_reply_sent", detail: `${ctx.user.name ?? ctx.user.email ?? "Sales user"} opened a quick reply for enquiry ${input.id}.` });
    return event;
  }),
  getSlaConfig: protectedProcedure.query(async ({ ctx }) => {
    requireDepartmentAccess(ctx.user, "sales");
    return await getSalesEnquirySlaConfig();
  }),
  updateSlaConfig: protectedProcedure.input(z6.object({ warningHours: z6.number().int().min(1).max(168), criticalHours: z6.number().int().min(2).max(336) })).mutation(async ({ ctx, input }) => {
    requireDepartmentAccess(ctx.user, "sales");
    if (ctx.user.role !== "admin") throw new TRPCError6({ code: "FORBIDDEN", message: "Only administrators can update Sales SLA thresholds." });
    if (input.criticalHours <= input.warningHours) throw new TRPCError6({ code: "BAD_REQUEST", message: "Critical threshold must be greater than warning threshold." });
    const config = await setSalesEnquirySlaConfig(input, ctx.user.id);
    await addUserActivity({ userId: ctx.user.id, action: "sales_enquiry_sla_updated", detail: `${ctx.user.name ?? ctx.user.email ?? "Administrator"} set Sales SLA thresholds to ${input.warningHours}h warning and ${input.criticalHours}h critical.` });
    return config;
  }),
  convertToBooking: protectedProcedure.input(z6.object({ id: z6.string().trim().min(4).max(64) })).mutation(async ({ ctx, input }) => {
    requireDepartmentAccess(ctx.user, "sales");
    const enquiry = await getRentalEnquiryById(input.id);
    if (!enquiry) throw new TRPCError6({ code: "NOT_FOUND", message: "Sales enquiry not found." });
    if (enquiry.convertedBookingId) throw new TRPCError6({ code: "CONFLICT", message: "This enquiry has already been converted to a booking." });
    const bookingId = `BOB Booking-${Date.now().toString().slice(-8)}`;
    await createBooking({
      id: bookingId,
      clientName: enquiry.companyName,
      projectName: `Rental enquiry \xB7 ${enquiry.projectLocation}`,
      projectManager: ctx.user.name ?? ctx.user.email ?? "Sales follow-up",
      lpoReference: `Enquiry ${enquiry.id}`,
      mobilizationDate: "To be confirmed",
      offHireDate: "To be confirmed",
      clientContactName: enquiry.contactName,
      clientEmail: enquiry.email,
      clientPhone: enquiry.phone,
      priority: "Standard",
      stage: "Created by Salesperson"
    });
    const converted = await markRentalEnquiryConverted({ id: enquiry.id, bookingId });
    const booking = await getBookingById(bookingId);
    await addUserActivity({ userId: ctx.user.id, action: "sales_enquiry_converted", detail: `${ctx.user.name ?? ctx.user.email ?? "Sales user"} converted enquiry ${enquiry.id} to ${bookingId}.` });
    await addNotification({ id: `sales-enquiry-converted-${enquiry.id}`, departmentCode: "sales", title: "Rental enquiry converted to booking", body: `${enquiry.companyName} is now tracked as ${bookingId}. Complete mobilisation and off-hire dates in the booking dossier.` });
    return { enquiry: converted, booking: booking ?? { id: bookingId } };
  })
});

// shared/bookingRules.ts
var BOOKING_STAGES = [
  "Created by Salesperson",
  "Documentation Supervisor",
  "Crew Assigned",
  "Gear Confirmed",
  "Docs In Progress",
  "All Docs Submitted",
  "Reviewed",
  "Dispatched"
];
var DEPARTMENTS2 = [
  { code: "sales", name: "Sales & Client Relations", active: true },
  { code: "documentation", name: "Documentation & Permits", active: true },
  { code: "lifting-gears", name: "Lifting Gears / Engineering", active: true },
  { code: "maintenance", name: "Maintenance", active: true },
  { code: "crew", name: "Crew / Workmen Assignment", active: true },
  { code: "hse", name: "HSE / Safety", active: true },
  { code: "accounts", name: "Accounts", active: true },
  { code: "hr", name: "HR", active: true },
  { code: "transportation", name: "Transportation", active: true },
  { code: "administrator", name: "Administrator / Super Admin", active: true }
];
var STAGE_ROLES = {
  "Created by Salesperson": "Salesperson",
  "Documentation Supervisor": "Documentation Supervisor",
  "Crew Assigned": "Crew Assignment",
  "Gear Confirmed": "Lifting Gears",
  "Docs In Progress": "Department users",
  "All Docs Submitted": "Documentation",
  Reviewed: "Salesperson",
  Dispatched: "Salesperson"
};
function canAdvanceStage(current, next, actorRole) {
  const currentIndex = BOOKING_STAGES.indexOf(current);
  const nextIndex = BOOKING_STAGES.indexOf(next);
  return nextIndex === currentIndex + 1 && STAGE_ROLES[next] === actorRole;
}
function transitionBooking(current, next, actorRole) {
  if (!canAdvanceStage(current, next, actorRole)) {
    throw new Error(`Role ${actorRole} cannot advance ${current} to ${next}`);
  }
  const notifications2 = [
    { departmentCode: "sales", title: `Booking moved to ${next}`, body: `The dossier is now owned by ${STAGE_ROLES[next]}.` },
    { departmentCode: "documentation", title: `Booking ${next}`, body: "Documentation Supervisor coordination queue updated." }
  ];
  if (next === "Docs In Progress") {
    notifications2.push(...DEPARTMENTS2.filter((department) => department.code !== "administrator").map((department) => ({ departmentCode: department.code, title: "New booking action", body: "A new dossier requires your department documents." })));
  }
  return { stage: next, notifications: notifications2 };
}

// shared/attendanceCrewRoster.ts
var ATTENDANCE_CREW_ROSTER = [
  {
    "id": "att-1",
    "sourceId": "B2-735",
    "name": "AAMIR MEHMOOD",
    "initials": "AM",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Off-Site",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-2",
    "sourceId": "B2-877",
    "name": "ABDUL HAMEED",
    "initials": "AH",
    "role": "CRAWLER CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Present",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-3",
    "sourceId": "B2-598",
    "name": "ABDUL KAISH",
    "initials": "AK",
    "role": "CRAWLER OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-4",
    "sourceId": "B2-1226",
    "name": "ABDUL RASHEED PARAMBADAN",
    "initials": "AR",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-5",
    "sourceId": "B2-866",
    "name": "ABDUL MATEEN",
    "initials": "AM",
    "role": "FORLIFT/BOOM LOAD OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-6",
    "sourceId": "B2-1146",
    "name": "ABHAY KUMAR SINGH",
    "initials": "AK",
    "role": "CRALER OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-7",
    "sourceId": "B2-106",
    "name": "ABUBAKKER VADAKKATH",
    "initials": "AV",
    "role": "CANTILEVER CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-8",
    "sourceId": "B2-139",
    "name": "ADNAN KAHAN",
    "initials": "AK",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-9",
    "sourceId": "B2-881",
    "name": "AFTAB ALAM",
    "initials": "AA",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Present",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-10",
    "sourceId": "B2-316",
    "name": "AFZAL ALI",
    "initials": "AA",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-11",
    "sourceId": "B2-931",
    "name": "AGIL K THAMPY",
    "initials": "AK",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-12",
    "sourceId": "B1-235",
    "name": "AHSAN ALI",
    "initials": "AA",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-13",
    "sourceId": "B2-760",
    "name": "AJAY KUMAR",
    "initials": "AK",
    "role": "FORKLIFT OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-14",
    "sourceId": "B2-933",
    "name": "AJI KUMAR",
    "initials": "AK",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-15",
    "sourceId": "B2-736",
    "name": "AJIT KUMAR SINGH",
    "initials": "AK",
    "role": "FORKLIFT OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-16",
    "sourceId": "B2-909",
    "name": "AJIT SINGH",
    "initials": "AS",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Present",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-17",
    "sourceId": "B2-128",
    "name": "AJITH RAGHAVAN",
    "initials": "AR",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-18",
    "sourceId": "B2-1011",
    "name": "ALAMJIT SINGH",
    "initials": "AS",
    "role": "CRAWLER OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-19",
    "sourceId": "B2-191-CHANGED TO B1-300",
    "name": "ALI ABBAS SARDAR KAHN",
    "initials": "AA",
    "role": "SHOVEL OPERATION DRIVER",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-20",
    "sourceId": "B2-554",
    "name": "AMANDEEP SINGH",
    "initials": "AS",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-21",
    "sourceId": "B2-286",
    "name": "AMARJEET KUMAR GUPTA",
    "initials": "AK",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-22",
    "sourceId": "B2-496",
    "name": "AMRIK SINGH",
    "initials": "AS",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-23",
    "sourceId": "B2-450",
    "name": "AMULKUMAR",
    "initials": "A",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-24",
    "sourceId": "B2-915",
    "name": "ANANDHU PRASAD VALIL",
    "initials": "AP",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-25",
    "sourceId": "B2-916",
    "name": "ANANDU PRASAD CHELLAPPAN",
    "initials": "AP",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-26",
    "sourceId": "B2-604",
    "name": "ANCY MENEZES",
    "initials": "AM",
    "role": "CRAWLER OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-27",
    "sourceId": "B1-301",
    "name": "ANIL YADAV SAHLAD CHAUDHARY",
    "initials": "AY",
    "role": "CRAWLER OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-28",
    "sourceId": "B2-833",
    "name": "ANGREJ SINGH",
    "initials": "AS",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-29",
    "sourceId": "B2-1184",
    "name": "ANOOP PANIKKASSERY GOPI",
    "initials": "AP",
    "role": "MOBILE CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-30",
    "sourceId": "B2-1165",
    "name": "AQIB FAREED CHOUDHARY",
    "initials": "AF",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-31",
    "sourceId": "B2-1061",
    "name": "ARJUN VALIL PRASAD",
    "initials": "AV",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-32",
    "sourceId": "B2-1154",
    "name": "ARVIND CHAUDHAHARI RAMJI",
    "initials": "AC",
    "role": "MOBILE CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-33",
    "sourceId": "B2-492",
    "name": "ASGHAR ALI",
    "initials": "AA",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-34",
    "sourceId": "B2-992",
    "name": "AVINASH KUMAR",
    "initials": "AK",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-35",
    "sourceId": "B2-207",
    "name": "AVTAR SINGH",
    "initials": "AS",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-36",
    "sourceId": "B1-249",
    "name": "BABU RAM YADAV",
    "initials": "BR",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-37",
    "sourceId": "B2-696",
    "name": "BAL BINDER",
    "initials": "BB",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-38",
    "sourceId": "B2-154",
    "name": "BALAN ANILKUMAR",
    "initials": "BA",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-39",
    "sourceId": "B2-1145",
    "name": "BALISTAR YADAV",
    "initials": "BY",
    "role": "CRAWLER CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-40",
    "sourceId": "B2-210",
    "name": "BALJEET SINGH JANG",
    "initials": "BS",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-41",
    "sourceId": "B2-1042",
    "name": "BALJINDER SINGH",
    "initials": "BS",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-42",
    "sourceId": "B2-265",
    "name": "BALJINDER SINGH BALBIR",
    "initials": "BS",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-43",
    "sourceId": "B2-687",
    "name": "BALKAR SINGH",
    "initials": "BS",
    "role": "FORKLIFT OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-44",
    "sourceId": "B2-512",
    "name": "BALWINDER SINGH GIAN",
    "initials": "BS",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-45",
    "sourceId": "B2-903",
    "name": "BAN BIHARI",
    "initials": "BB",
    "role": "FORKLIFT OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-46",
    "sourceId": "B2-1002",
    "name": "BAPPA DIYA LAHA",
    "initials": "BD",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-47",
    "sourceId": "B2-918",
    "name": "BHIMARAJU",
    "initials": "B",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Present",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-48",
    "sourceId": "B2-815",
    "name": "BHOLA KUMAR",
    "initials": "BK",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-49",
    "sourceId": "B2-612",
    "name": "BIJU MOONETHU",
    "initials": "BM",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-50",
    "sourceId": "B2-1227",
    "name": "BIJU BABU BABU",
    "initials": "BB",
    "role": "MOBILE CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-51",
    "sourceId": "B2-819",
    "name": "BIKRAM SINGH",
    "initials": "BS",
    "role": "FORKLIFT OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-52",
    "sourceId": "B2-932",
    "name": "BILIN BABU",
    "initials": "BB",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-53",
    "sourceId": "B2-1205",
    "name": "BINOJ BALAKRISHNANAN",
    "initials": "BB",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-54",
    "sourceId": "B2-888",
    "name": "BIPIN SINGH",
    "initials": "BS",
    "role": "CRAWLER CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-55",
    "sourceId": "B2-462",
    "name": "BIPUL KUMAR",
    "initials": "BK",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-56",
    "sourceId": "B2-945",
    "name": "BIRENDRA GIRI",
    "initials": "BG",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Present",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-57",
    "sourceId": "B2-423",
    "name": "BLESSAN MATHEW",
    "initials": "BM",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-58",
    "sourceId": "B2-427",
    "name": "BOOTA SINGH",
    "initials": "BS",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-59",
    "sourceId": "B1-307",
    "name": "CHANDRA MOHAN PANDEY AYODHYA NATH",
    "initials": "CM",
    "role": "MOBILE CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-60",
    "sourceId": "B2-1076",
    "name": "CHANDRSHEKAR CHAUHAN",
    "initials": "CC",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-61",
    "sourceId": "B2-796",
    "name": "CHANNA SATHIS",
    "initials": "CS",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Present",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-62",
    "sourceId": "B2-743",
    "name": "CHARANJIT SINGH",
    "initials": "CS",
    "role": "FORKLIFT OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-63",
    "sourceId": "B2-731",
    "name": "CHUNNU KUMAR PANDEY",
    "initials": "CK",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-64",
    "sourceId": "B2-954",
    "name": "DAWINDER SINGH",
    "initials": "DS",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-65",
    "sourceId": "B2-703",
    "name": "DAYANAND",
    "initials": "D",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Present",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-66",
    "sourceId": "B2-494",
    "name": "DEENA NATH",
    "initials": "DN",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Present",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-67",
    "sourceId": "B2-1063",
    "name": "DEEPAK A VASI",
    "initials": "DA",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-68",
    "sourceId": "B2-1142",
    "name": "DEEPAK SINGH",
    "initials": "DS",
    "role": "CRAWLER CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-69",
    "sourceId": "B2-778",
    "name": "DHANANJAY KUMAR",
    "initials": "DK",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-70",
    "sourceId": "B2-529",
    "name": "DHARAM SINGH",
    "initials": "DS",
    "role": "BOOM LOADER/FORKLIFT OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-71",
    "sourceId": "B2-1069",
    "name": "DHARAMVEER",
    "initials": "D",
    "role": "FORKLIFT OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-72",
    "sourceId": "B2-589",
    "name": "DHARMENDRA KUMAR VERMA",
    "initials": "DK",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-73",
    "sourceId": "B2-658",
    "name": "DHARMESHKUMAR",
    "initials": "D",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-74",
    "sourceId": "B1-276",
    "name": "DILIP SINGH SHIVANTH SINGH",
    "initials": "DS",
    "role": "MOBILE CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-75",
    "sourceId": "B2-764",
    "name": "DINESH YADAV",
    "initials": "DY",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-76",
    "sourceId": "B2-993",
    "name": "DURG VIJAY YADAV",
    "initials": "DV",
    "role": "CRAWLER OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-77",
    "sourceId": "B2-808",
    "name": "EDUARADO",
    "initials": "E",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-78",
    "sourceId": "B2-596",
    "name": "FARHAN ALI",
    "initials": "FA",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-79",
    "sourceId": "B2-857",
    "name": "FULJIT SINGH",
    "initials": "FS",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-80",
    "sourceId": "B2-281",
    "name": "GANGADHAR D",
    "initials": "GD",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-81",
    "sourceId": "B2-1197",
    "name": "GAURAV JASWANT SINGH",
    "initials": "GJ",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-82",
    "sourceId": "B2-951",
    "name": "GAUTAM PRASAD",
    "initials": "GP",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-83",
    "sourceId": "B2-779",
    "name": "GAUTAM YADAV",
    "initials": "GY",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-84",
    "sourceId": "B2-248",
    "name": "GHULAM NABI",
    "initials": "GN",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-85",
    "sourceId": "B2-753",
    "name": "GOPAL KANDEL",
    "initials": "GK",
    "role": "FORKLIFT OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-86",
    "sourceId": "B2-897",
    "name": "GOVINDA KUMAR",
    "initials": "GK",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-87",
    "sourceId": "B2-757",
    "name": "GURBACHAN",
    "initials": "G",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Off-Site",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-88",
    "sourceId": "B2-468",
    "name": "GURDEEP SINGH",
    "initials": "GS",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-89",
    "sourceId": "B2-585",
    "name": "GURDIAL SINGH DARA SINGH",
    "initials": "GS",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-90",
    "sourceId": "B2-747",
    "name": "GURDIAL SINGH PRITAM SINGH",
    "initials": "GS",
    "role": "FORKLIFT /CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-91",
    "sourceId": "B2-901",
    "name": "GURDIP SINGH",
    "initials": "GS",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-92",
    "sourceId": "B2-156",
    "name": "GURINDER SINGH",
    "initials": "GS",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-93",
    "sourceId": "B2-622",
    "name": "GURJANT SINGH",
    "initials": "GS",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-94",
    "sourceId": "B2-828",
    "name": "GURJEET SINGH",
    "initials": "GS",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-95",
    "sourceId": "B2-955",
    "name": "GURMUKH SINGH",
    "initials": "GS",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-96",
    "sourceId": "B2-956",
    "name": "GURPINDER SINGH",
    "initials": "GS",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-97",
    "sourceId": "B2-1110",
    "name": "GURPREET RADHE KRISHNAN",
    "initials": "GR",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-98",
    "sourceId": "B2-848",
    "name": "GURPREET SINGH",
    "initials": "GS",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-99",
    "sourceId": "B2-776",
    "name": "GURWINDER SINGH",
    "initials": "GS",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-100",
    "sourceId": "B2-415",
    "name": "HAMAYUN NAWAS",
    "initials": "HN",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-101",
    "sourceId": "B2-192",
    "name": "HARCHARAN SINGH GURMEET",
    "initials": "HS",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-102",
    "sourceId": "B2-103",
    "name": "HARDIP SINGH JHUTTY",
    "initials": "HS",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Present",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-103",
    "sourceId": "B2-744",
    "name": "HARINDER",
    "initials": "H",
    "role": "FORKLIFT OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Present",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-104",
    "sourceId": "B2-1085",
    "name": "HARISH SINGH KISHAN SINGH",
    "initials": "HS",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-105",
    "sourceId": "B2-252",
    "name": "HARJINDER SINGH JAGTAR",
    "initials": "HS",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-106",
    "sourceId": "B2-957",
    "name": "HARJIT SINGH",
    "initials": "HS",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-107",
    "sourceId": "B2-996",
    "name": "HARPREET SINGH",
    "initials": "HS",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-108",
    "sourceId": "B2-856",
    "name": "HASRUDDIN KHAN",
    "initials": "HK",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-109",
    "sourceId": "B2-544",
    "name": "HRIDAYANATHAN",
    "initials": "H",
    "role": "CRANE OPERATOR",
    "department": "WORKSHOP AUG 2026",
    "availability": "Present",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-110",
    "sourceId": "B2-752",
    "name": "HUSSAIN AHMED MIRZA",
    "initials": "HA",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-111",
    "sourceId": "B2-1023",
    "name": "IFTIKHAR AHMED",
    "initials": "IA",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-112",
    "sourceId": "B2-172",
    "name": "IQBAL SINGH",
    "initials": "IS",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-113",
    "sourceId": "B2-998",
    "name": "IRFAN KHAN",
    "initials": "IK",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-114",
    "sourceId": "B2-1228",
    "name": "JAI GOVIND YADAV",
    "initials": "JG",
    "role": "FORKLIFT/BOOM LOADER OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-115",
    "sourceId": "B2-786",
    "name": "JAGBIR SINGH",
    "initials": "JS",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-116",
    "sourceId": "B2-229",
    "name": "JAGDEEP SINGH",
    "initials": "JS",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Present",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-117",
    "sourceId": "B2-862",
    "name": "JASKARAN SINGH",
    "initials": "JS",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-118",
    "sourceId": "B2-1074",
    "name": "JITENDRA CHAUHAN",
    "initials": "JC",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-119",
    "sourceId": "B2-766",
    "name": "JOBAN BUTA",
    "initials": "JB",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-120",
    "sourceId": "B2-773",
    "name": "JODHBIR SINGH",
    "initials": "JS",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-121",
    "sourceId": "B2-795",
    "name": "JOGINDER SINGH BACHAN DAS",
    "initials": "JS",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-122",
    "sourceId": "B2-849",
    "name": "JOGINDER SINGH KAKU RAM",
    "initials": "JS",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-123",
    "sourceId": "B2-999",
    "name": "JUNAID ALI",
    "initials": "JA",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-124",
    "sourceId": "B2-905",
    "name": "JUNU RAJ",
    "initials": "JR",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-125",
    "sourceId": "B2-904",
    "name": "KAMALKANT ARYA",
    "initials": "KA",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Present",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-126",
    "sourceId": "B2-1132",
    "name": "KAMLESH KUMAR BAU NATH",
    "initials": "KK",
    "role": "CRAWLER CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-127",
    "sourceId": "B2-948",
    "name": "KANNAN VS",
    "initials": "KV",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Present",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-128",
    "sourceId": "B2-937",
    "name": "KARAN SINGH",
    "initials": "KS",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-129",
    "sourceId": "B2-863",
    "name": "KARMJEET NAHAR",
    "initials": "KN",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-130",
    "sourceId": "B1-104",
    "name": "KHALIL AHAMED",
    "initials": "KA",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-131",
    "sourceId": "B2-567 TO  B2-892",
    "name": "KULDIP KUMAR HARBANS LAL",
    "initials": "KK",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-132",
    "sourceId": "B2-453",
    "name": "KULJEET SINGH",
    "initials": "KS",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-133",
    "sourceId": "B2-1020",
    "name": "KULWINDER SINGH",
    "initials": "KS",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-134",
    "sourceId": "B2-112",
    "name": "KUNHU MUHAMMED PARIKAD",
    "initials": "KM",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Present",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-135",
    "sourceId": "B2-300",
    "name": "LAKHBIR SINGH",
    "initials": "LS",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-136",
    "sourceId": "B2-803",
    "name": "LAKSHITA",
    "initials": "L",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-137",
    "sourceId": "B2-953",
    "name": "LAL BABU YADAV",
    "initials": "LB",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-138",
    "sourceId": "B2-938",
    "name": "LAL BAHADUR",
    "initials": "LB",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-139",
    "sourceId": "B2-981",
    "name": "LALITH NUWAN JAYASEKARA",
    "initials": "LN",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-140",
    "sourceId": "B2-777",
    "name": "LEKSHMAN RUWAN",
    "initials": "LR",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-141",
    "sourceId": "B2-1000",
    "name": "MAHANAMA RANATHUNGA",
    "initials": "MR",
    "role": "CRANE OPERATOR",
    "department": "WORKSHOP AUG 2026",
    "availability": "Present",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-142",
    "sourceId": "B2-894",
    "name": "MANDEEP SINGH NIRMAL SINGH",
    "initials": "MS",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-143",
    "sourceId": "B2-1200",
    "name": "MANDIP SINGH PALWINDER",
    "initials": "MS",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-144",
    "sourceId": "B2-715",
    "name": "MANIKANDAN KAVARA KUNJIMON",
    "initials": "MK",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-145",
    "sourceId": "B2-976",
    "name": "MANJIT SINGH",
    "initials": "MS",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-146",
    "sourceId": "B1 243 TO B2-874",
    "name": "MANJIT SINGH BANTA SINGH",
    "initials": "MS",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-147",
    "sourceId": "B2-1170",
    "name": "MANOJ KUMAR RAM AWATAR",
    "initials": "MK",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-148",
    "sourceId": "B2-806",
    "name": "MANORANJAN",
    "initials": "M",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-149",
    "sourceId": "B2-942",
    "name": "MANSUR ANSARI AINUDIN ANSARI",
    "initials": "MA",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-150",
    "sourceId": "B2-145",
    "name": "MANU SASIDHARAN",
    "initials": "MS",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-151",
    "sourceId": "B2-1216",
    "name": "MARDONA GEORGE",
    "initials": "MG",
    "role": "CRWLER CANE OPERATOR/FL OP",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-152",
    "sourceId": "B2-871",
    "name": "MAQBOOL HASSAN",
    "initials": "MH",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-153",
    "sourceId": "B2-495 TO B1-297",
    "name": "MAQSOOD AHMED",
    "initials": "MA",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "On Leave",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-154",
    "sourceId": "B2-701",
    "name": "MD AFTAB",
    "initials": "MA",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-155",
    "sourceId": "B2-807",
    "name": "MD TANBIR ALI",
    "initials": "MT",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-156",
    "sourceId": "B2-620",
    "name": "MEGHASAN BEHERA",
    "initials": "MB",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-157",
    "sourceId": "B2-657",
    "name": "MERAZ SHAIKH",
    "initials": "MS",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-158",
    "sourceId": "B1-155",
    "name": "MIRZA MUMTAZ BEG",
    "initials": "MM",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-159",
    "sourceId": "B2-639",
    "name": "MOHAMMAD MUNIR UDDIN",
    "initials": "MM",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-160",
    "sourceId": "B2-882",
    "name": "MOHAMMAD ZULFAQAR NABI",
    "initials": "MZ",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-161",
    "sourceId": "B2-605",
    "name": "MOHAMMATHALI MYLAPPURAM",
    "initials": "MM",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-162",
    "sourceId": "B2-1236",
    "name": "MOHAMMED ILYAS UTTUKUZHI",
    "initials": "MI",
    "role": "MOBILE CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-163",
    "sourceId": "B2-663",
    "name": "MOKHTAR ANSARI",
    "initials": "MA",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-164",
    "sourceId": "B2-177",
    "name": "MUHAMED ANSAR",
    "initials": "MA",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-165",
    "sourceId": "B2-681",
    "name": "MUHAMED MUSATH",
    "initials": "MM",
    "role": "FORKLIFT OPERATOR/BOOM LOADER",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-166",
    "sourceId": "B2-878",
    "name": "MUHAMMAD AMMER KHAN",
    "initials": "MA",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-167",
    "sourceId": "B2-745",
    "name": "MUHAMMAD IRFAN",
    "initials": "MI",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Off-Site",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-168",
    "sourceId": "B2-980",
    "name": "MUHAMMAD IRSHAD",
    "initials": "MI",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-169",
    "sourceId": "B1-204",
    "name": "MUHAMMAD QASIM",
    "initials": "MQ",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-170",
    "sourceId": "B2-1123",
    "name": "MUHAMMAD SULEMAN",
    "initials": "MS",
    "role": "CRAWLER CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-171",
    "sourceId": "B2-900",
    "name": "MUHAMMAD SULIMAN",
    "initials": "MS",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-172",
    "sourceId": "B1-206",
    "name": "MUHAMMAD USMAN AFSAL",
    "initials": "MU",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-173",
    "sourceId": "B2-452",
    "name": "MUHAMMAD YOUSUF",
    "initials": "MY",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-174",
    "sourceId": "B2-972",
    "name": "MUHAMMAD ZUBAIR KIANI",
    "initials": "MZ",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-175",
    "sourceId": "B2-968",
    "name": "MUHAMMED EHTISHAM",
    "initials": "ME",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-176",
    "sourceId": "B2-1115",
    "name": "MUHAMMED LATIF IQBAL LIAQAT ALI",
    "initials": "ML",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-177",
    "sourceId": "B2-142",
    "name": "MUHAMMED SHAHABAZ",
    "initials": "MS",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-178",
    "sourceId": "B2-1048",
    "name": "MUKESH KUMAR KUSHWAHA",
    "initials": "MK",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-179",
    "sourceId": "B2-1016",
    "name": "MUKHTAR YADAV",
    "initials": "MY",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-180",
    "sourceId": "B2-836",
    "name": "MUKHTAYAR",
    "initials": "M",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-181",
    "sourceId": "B2-728",
    "name": "MUKTIAR SINGH",
    "initials": "MS",
    "role": "FORKLIFT OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Present",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-182",
    "sourceId": "B2-601",
    "name": "MUZAFFAR AHMAD",
    "initials": "MA",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-183",
    "sourceId": "B1-256",
    "name": "NABIULLAH",
    "initials": "N",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-184",
    "sourceId": "B2-876",
    "name": "NAIM AHMED",
    "initials": "NA",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-185",
    "sourceId": "B2-879",
    "name": "NAIMATULLAH",
    "initials": "N",
    "role": "CRAWLER CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-186",
    "sourceId": "B2-421",
    "name": "NANDHU RAJ",
    "initials": "NR",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-187",
    "sourceId": "B2-534",
    "name": "NARESH KUMAR",
    "initials": "NK",
    "role": "FORKLIFT OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-188",
    "sourceId": "B2-1149",
    "name": "NAVESH VISHWAKARMA",
    "initials": "NV",
    "role": "CRAWLER OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-189",
    "sourceId": "B2-966",
    "name": "NEHAL ALAM",
    "initials": "NA",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-190",
    "sourceId": "B2-454",
    "name": "NELSON FRANCIS",
    "initials": "NF",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-191",
    "sourceId": "B2-870",
    "name": "NIRMAL SINGH",
    "initials": "NS",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-192",
    "sourceId": "B2-1062",
    "name": "NISHANTH GANESHNAN UNNITHAN",
    "initials": "NG",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-193",
    "sourceId": "B2-809",
    "name": "NISHANTHA PERERA",
    "initials": "NP",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-194",
    "sourceId": "B2-1094",
    "name": "NITISH KUMAR YADAV HARERAM YADAV",
    "initials": "NK",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-195",
    "sourceId": "B2-994",
    "name": "PANKAJ KUMAR RAMANANDAN ARYA",
    "initials": "PK",
    "role": "CRAWLER OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-196",
    "sourceId": "B2-884",
    "name": "PANKAJ KUMAR SINGH",
    "initials": "PK",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Off-Site",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-197",
    "sourceId": "B2-647",
    "name": "PARGAT SINGH",
    "initials": "PS",
    "role": "BOOM LOADER OPERATOR,FORKLIFT OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-198",
    "sourceId": "B2-995",
    "name": "PAWAN KUMAR GUPTA",
    "initials": "PK",
    "role": "CRAWLER OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-199",
    "sourceId": "B2-722",
    "name": "PAWAN KUMAR MISHRA",
    "initials": "PK",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-200",
    "sourceId": "B2-727",
    "name": "PIRANJAN KUMAR",
    "initials": "PK",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-201",
    "sourceId": "B2-679",
    "name": "PRABHAT KUMAR",
    "initials": "PK",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-202",
    "sourceId": "B2-127",
    "name": "PRABHIJITH SINGH JASMEL SINGH",
    "initials": "PS",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-203",
    "sourceId": "B2-925",
    "name": "PRADIP KUMAR PRASAD",
    "initials": "PK",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-204",
    "sourceId": "B2-788",
    "name": "PRANAV",
    "initials": "P",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-205",
    "sourceId": "B2-1127",
    "name": "PRASANNA KUMAR S PILLAI",
    "initials": "PK",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-206",
    "sourceId": "B2-1040",
    "name": "PRATHEEP USHA",
    "initials": "PU",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-207",
    "sourceId": "B2-196",
    "name": "PRAVEEN BALAKRISHNAKURUP",
    "initials": "PB",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-208",
    "sourceId": "B2-847",
    "name": "PREM LAL",
    "initials": "PL",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-209",
    "sourceId": "B2-711",
    "name": "PREM SINGH",
    "initials": "PS",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-210",
    "sourceId": "B2-136",
    "name": "PRETHEESH RENESAN",
    "initials": "PR",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-211",
    "sourceId": "B2-1160",
    "name": "QAISER ABBAS NAZAR ABBAS",
    "initials": "QA",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-212",
    "sourceId": "B2-762",
    "name": "RADHEY SYAM YADAV",
    "initials": "RS",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Present",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-213",
    "sourceId": "B2-739",
    "name": "RAHAT ALI",
    "initials": "RA",
    "role": "FORKLIFT OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-214",
    "sourceId": "B2-129",
    "name": "RAHIL RAMACHANDRAN",
    "initials": "RR",
    "role": "NOT INLUDED AS OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-215",
    "sourceId": "B2-1068",
    "name": "RAHUL RADHAKRISHNAN",
    "initials": "RR",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-216",
    "sourceId": "B2-619",
    "name": "RAIES HUSSAIN",
    "initials": "RH",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-217",
    "sourceId": "B2-1179",
    "name": "RAJ KUMAR CHAUDHARI",
    "initials": "RK",
    "role": "CRAWLER OPRATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-218",
    "sourceId": "B2-594",
    "name": "RAJA AYYACHAMY",
    "initials": "RA",
    "role": "CRAWLER OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-219",
    "sourceId": "B2-740",
    "name": "RAJA RAMACHANDRAN",
    "initials": "RR",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-220",
    "sourceId": "B2-1118",
    "name": "RAJA SINGH VINAY SINGH",
    "initials": "RS",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-221",
    "sourceId": "B2-677",
    "name": "RAJESH MEDIKONDA",
    "initials": "RM",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-222",
    "sourceId": "B2-1075",
    "name": "RAJESH PASWAN",
    "initials": "RP",
    "role": "CRAWLER CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-223",
    "sourceId": "B2-988",
    "name": "RAJU PRASAD",
    "initials": "RP",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Present",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-224",
    "sourceId": "B2-816",
    "name": "RAKESH SHARMA",
    "initials": "RS",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-225",
    "sourceId": "B2-780",
    "name": "RAM NARESH YADAV",
    "initials": "RN",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-226",
    "sourceId": "B2-288",
    "name": "RAMANJIT SINGH JASMEL SINGH",
    "initials": "RS",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-227",
    "sourceId": "B2-767",
    "name": "RAMANPREET SINGH",
    "initials": "RS",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-228",
    "sourceId": "B2-587",
    "name": "RAMESH PILLI",
    "initials": "RP",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-229",
    "sourceId": "B2-939",
    "name": "RANJAN YADAV",
    "initials": "RY",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-230",
    "sourceId": "B2-641",
    "name": "RANJAY YADAV",
    "initials": "RY",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-231",
    "sourceId": "B2-772",
    "name": "RANJIT SINGH",
    "initials": "RS",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-232",
    "sourceId": "B2-456",
    "name": "RASHID IQBAL",
    "initials": "RI",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-233",
    "sourceId": "B2-967",
    "name": "RASHPAL SINGH",
    "initials": "RS",
    "role": "FORKLIFT OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-234",
    "sourceId": "B2-1025",
    "name": "RAUSHAN KUMAR",
    "initials": "RK",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-235",
    "sourceId": "B2-962",
    "name": "RAVI SHANKAR YADAV",
    "initials": "RS",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-236",
    "sourceId": "B2-958",
    "name": "RAVINDER SINGH",
    "initials": "RS",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-237",
    "sourceId": "B2-872",
    "name": "REJU RADHAKRISHNAN",
    "initials": "RR",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-238",
    "sourceId": "B2-624",
    "name": "REMESH CHEMANNIL",
    "initials": "RC",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-239",
    "sourceId": "B2-101",
    "name": "RENJITH RAJENDRA KURUP",
    "initials": "RR",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-240",
    "sourceId": "B2-1101",
    "name": "RENJITH RAMESAN",
    "initials": "RR",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-241",
    "sourceId": "B2-1100",
    "name": "RENJITH RAVEENDRAN NAIR",
    "initials": "RR",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-242",
    "sourceId": "B2-708",
    "name": "RENJITH VENUGOPAL PLLAI",
    "initials": "RV",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Present",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-243",
    "sourceId": "B2-912",
    "name": "RENJU REVEEGE",
    "initials": "RR",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-244",
    "sourceId": "B2-794",
    "name": "RESHAM SINGH",
    "initials": "RS",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-245",
    "sourceId": "B2-964",
    "name": "ROHIT KUMAR SINGH",
    "initials": "RK",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-246",
    "sourceId": "B2-583",
    "name": "ROSHAN RAM",
    "initials": "RR",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-247",
    "sourceId": "B2-441",
    "name": "SACHIN RAJAN",
    "initials": "SR",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-248",
    "sourceId": "B2-704",
    "name": "SAFIULLAH KHAN",
    "initials": "SK",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-249",
    "sourceId": "B2-175",
    "name": "SAHEER PARIKKAD",
    "initials": "SP",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-250",
    "sourceId": "B2-946",
    "name": "SAIFULLA KALATHIL",
    "initials": "SK",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-251",
    "sourceId": "B2-442",
    "name": "SAJEEV RAMACHANDRAN",
    "initials": "SR",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-252",
    "sourceId": "B2-375",
    "name": "SAJI KUNJACHAN",
    "initials": "SK",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-253",
    "sourceId": "B2-307",
    "name": "SAJIM ALI SIDDIQUI",
    "initials": "SA",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-254",
    "sourceId": "B2- 917",
    "name": "SAJJAD KHAN",
    "initials": "SK",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-255",
    "sourceId": "B2-928",
    "name": "SAMANTHA AM",
    "initials": "SA",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Off-Site",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-256",
    "sourceId": "B2-947",
    "name": "SAMEER THAYYIL",
    "initials": "ST",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Present",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-257",
    "sourceId": "B2-721",
    "name": "SAMUEL NINYUNG",
    "initials": "SN",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Present",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-258",
    "sourceId": "B2-646",
    "name": "SANAL KUMAR",
    "initials": "SK",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Present",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-259",
    "sourceId": "B2-977",
    "name": "SANDEEP KUMAR YADAV",
    "initials": "SK",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-260",
    "sourceId": "B2-487",
    "name": "SANDEEP SASHMANI YADAV",
    "initials": "SS",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Present",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-261",
    "sourceId": "B2-924",
    "name": "SANJAY GUPTA",
    "initials": "SG",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-262",
    "sourceId": "B2-578",
    "name": "SANJAY KUMAR YADAV LALDHAR YADAV",
    "initials": "SK",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-263",
    "sourceId": "B2-1211",
    "name": "SANTOKH SINGH DHARAM SINGH",
    "initials": "SS",
    "role": "MOBILE CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-264",
    "sourceId": "B2-400",
    "name": "SANTHOSH KUMAR DAS",
    "initials": "SK",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-265",
    "sourceId": "B2-734",
    "name": "SANTHOSH KUMAR SINGH",
    "initials": "SK",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-266",
    "sourceId": "B2-973",
    "name": "SANTOSH GUPTA",
    "initials": "SG",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-267",
    "sourceId": "B2-107",
    "name": "SARATH PRASANNA SASI",
    "initials": "SP",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Present",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-268",
    "sourceId": "B2-959",
    "name": "SARDAR AHMED KHAN",
    "initials": "SA",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-269",
    "sourceId": "B2-910",
    "name": "SAROJ KUMAR GAIN",
    "initials": "SK",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-270",
    "sourceId": "B2-1183",
    "name": "SARWAN SINGH",
    "initials": "SS",
    "role": "CRAWLER OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-271",
    "sourceId": "B2-854",
    "name": "SEYD IBRAMSHA",
    "initials": "SI",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-272",
    "sourceId": "B2-458",
    "name": "SHAH ALAM",
    "initials": "SA",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-273",
    "sourceId": "B2-755",
    "name": "SHAM LAL",
    "initials": "SL",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Present",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-274",
    "sourceId": "B2-935",
    "name": "SHAMSHER SINGH CHARANJIT SINGH",
    "initials": "SS",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-275",
    "sourceId": "B2-895",
    "name": "SHAMSHER SINGH GURBACHAN SINGH",
    "initials": "SS",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-276",
    "sourceId": "B2-754",
    "name": "SHANAWAS",
    "initials": "S",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Off-Site",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-277",
    "sourceId": "B2-710",
    "name": "SHEREEF",
    "initials": "S",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Present",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-278",
    "sourceId": "B2-546",
    "name": "SHIVAM PANDEY",
    "initials": "SP",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-279",
    "sourceId": "B2-732",
    "name": "SHOBIRAM RAMAKRISHNAN",
    "initials": "SR",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Present",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-280",
    "sourceId": "B2-718",
    "name": "SISIRA JAYANTHA",
    "initials": "SJ",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-281",
    "sourceId": "B2-638",
    "name": "SREEKANTH DHARMASEELAN",
    "initials": "SD",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-282",
    "sourceId": "B2-579",
    "name": "SUBASH",
    "initials": "S",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-283",
    "sourceId": "B2-850",
    "name": "SUKH CHAIN",
    "initials": "SC",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-284",
    "sourceId": "B1-250",
    "name": "SUKHDEV SINGH",
    "initials": "SS",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-285",
    "sourceId": "B2-746",
    "name": "SUKHDEV SINGH AMAR CHAND",
    "initials": "SS",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-286",
    "sourceId": "B2-1055",
    "name": "SUKHDEV SINGH BALBIR SINGH",
    "initials": "SS",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-287",
    "sourceId": "B2-537",
    "name": "SUKHDEV SINGH PARAMJIT SINGH",
    "initials": "SS",
    "role": "FORKLIFT OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-288",
    "sourceId": "B2-665",
    "name": "SUKHDEV SINGH SHANKAR RAM",
    "initials": "SS",
    "role": "BOOM LOADER OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-289",
    "sourceId": "B2-465",
    "name": "SUKHJINDER SINGH HARBAJAN SINGH",
    "initials": "SS",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-290",
    "sourceId": "B2-846",
    "name": "SUKHJINDER SINGH SARABJIT SINGH",
    "initials": "SS",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-291",
    "sourceId": "B2-1185",
    "name": "SUKHJIT SINGH TARSEM SINGH",
    "initials": "SS",
    "role": "FORKLIFT OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-292",
    "sourceId": "B2-183",
    "name": "SUKHWINDER SINGH",
    "initials": "SS",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-293",
    "sourceId": "B2-629",
    "name": "SUMANT ANIRUDH",
    "initials": "SA",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-294",
    "sourceId": "B2-1108",
    "name": "SUMEDHA KARUNA PEDIGE",
    "initials": "SK",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Off-Site",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-295",
    "sourceId": "B2-741",
    "name": "SUNIL RAM",
    "initials": "SR",
    "role": "FORKLIFT OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-296",
    "sourceId": "B2-865",
    "name": "SURENDRA KUMAR YADAV",
    "initials": "SK",
    "role": "FOKLIFT/BOOM LOAD OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-297",
    "sourceId": "B1-248",
    "name": "SURESH KUMAR",
    "initials": "SK",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-298",
    "sourceId": "B2-890",
    "name": "SURINDER SINGH RAM SINGH",
    "initials": "SS",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-299",
    "sourceId": "B2-111",
    "name": "SURJIT SINGH SAWINDER SINGH",
    "initials": "SS",
    "role": "CRANE OPERATOR",
    "department": "WORKSHOP AUG 2026",
    "availability": "Present",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-300",
    "sourceId": "B2-1162",
    "name": "SYAM KUMAR SOWDAS SYAMALA",
    "initials": "SK",
    "role": "CRANE OPERATOR/SUP",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-301",
    "sourceId": "B2-670",
    "name": "SYED QASIM",
    "initials": "SQ",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-302",
    "sourceId": "B2-1014",
    "name": "TALIB HUSSAIN",
    "initials": "TH",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-303",
    "sourceId": "B2-960",
    "name": "TANJEET SINGH",
    "initials": "TS",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-304",
    "sourceId": "B2-997",
    "name": "TASAUWAR ALI ANSARI",
    "initials": "TA",
    "role": "CRAWLER OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-305",
    "sourceId": "B2-805",
    "name": "TEJ BAHADUR YADAV",
    "initials": "TB",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-306",
    "sourceId": "B2-861",
    "name": "THIRUPATI SANDEVENI",
    "initials": "TS",
    "role": "FORKLIFT OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-307",
    "sourceId": "B2-944",
    "name": "TORAN BAHADUR BISTA",
    "initials": "TB",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-308",
    "sourceId": "B2-700",
    "name": "TRIBHUVAN",
    "initials": "T",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-309",
    "sourceId": "B2-187",
    "name": "UDAYAN PRABHAKARAN",
    "initials": "UP",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-310",
    "sourceId": "B2-1214",
    "name": "UMAKANTA SAHOO KEDAR SAHOO",
    "initials": "US",
    "role": "CRAWLER CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-311",
    "sourceId": "B2-251",
    "name": "UMAR FAROOQ",
    "initials": "UF",
    "role": "BOOM LOADER OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-312",
    "sourceId": "B2-914",
    "name": "UMESH KUMAR YADAV",
    "initials": "UK",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-313",
    "sourceId": "B2-733",
    "name": "UPENDRA CHAUHAN",
    "initials": "UC",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-314",
    "sourceId": "B2-466",
    "name": "VACHITAR SINGH",
    "initials": "VS",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-315",
    "sourceId": "B2-858",
    "name": "VARINDER SINGH",
    "initials": "VS",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-316",
    "sourceId": "B2-326",
    "name": "VENKATA SWAMY",
    "initials": "VS",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-317",
    "sourceId": "B2-851",
    "name": "VENKATESH GUJJU",
    "initials": "VG",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-318",
    "sourceId": "B1-239 CNGD -B2-1140",
    "name": "VIJAY GHANSHAM",
    "initials": "VG",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-319",
    "sourceId": "B2-800",
    "name": "VIJAY PAL",
    "initials": "VP",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-320",
    "sourceId": "B2-138",
    "name": "VIJU PUTHIYA PURAYIL",
    "initials": "VP",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-321",
    "sourceId": "B1-253",
    "name": "VINAY KUMAR SINGH",
    "initials": "VK",
    "role": "CRALWER CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-322",
    "sourceId": "B2-119",
    "name": "VINEETH VIJAYAN",
    "initials": "VV",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-323",
    "sourceId": "B2-989",
    "name": "VINOD KOPPY BABU",
    "initials": "VK",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Present",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-324",
    "sourceId": "B2-376",
    "name": "VINOY",
    "initials": "V",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-325",
    "sourceId": "B2-1196",
    "name": "VIPIN SINGH ASHOK KUMAR",
    "initials": "VS",
    "role": "CRALWER CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-326",
    "sourceId": "B2-789",
    "name": "VISAKH SAJEEV",
    "initials": "VS",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-327",
    "sourceId": "B2-965",
    "name": "VISHAL KUMAR",
    "initials": "VK",
    "role": "CRANE ASSEMBLING SUPERVISOR",
    "department": "OP AUG 2026",
    "availability": "Present",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-328",
    "sourceId": "B2-769",
    "name": "VISHAL KUMAR SINGH",
    "initials": "VK",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-329",
    "sourceId": "B2-137",
    "name": "VISHNU MOHANAN",
    "initials": "VM",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-330",
    "sourceId": "B2-1206",
    "name": "VISHNU THULASEEDHARAN",
    "initials": "VT",
    "role": "FORKLIFT OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-331",
    "sourceId": "B2-113",
    "name": "VISHNU UDAYAN",
    "initials": "VU",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Present",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-332",
    "sourceId": "B2-751",
    "name": "WILSON ANTONYSAMY",
    "initials": "WA",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Off-Site",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-333",
    "sourceId": "B2- 921",
    "name": "ZIAUL HAQUE KHAN",
    "initials": "ZH",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-334",
    "sourceId": "B2-249",
    "name": "ZOHAIB RASOOL",
    "initials": "ZR",
    "role": "CRANE OPERATOR",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-335",
    "sourceId": "B2-133",
    "name": "ABDUL GAPHOOR",
    "initials": "AG",
    "role": "TRAILOR DRIVER",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-336",
    "sourceId": "B2-798",
    "name": "ADNAN NAZIR",
    "initials": "AN",
    "role": "TRAILOR DRIVER",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-337",
    "sourceId": "B2-664",
    "name": "AJAYKIRAT SINGH",
    "initials": "AS",
    "role": "TRAILOR DRIVER",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-338",
    "sourceId": "B2-1193",
    "name": "AKSHAY ANIL KUMAR",
    "initials": "AA",
    "role": "TRUCK DRIVER",
    "department": "OP AUG 2026",
    "availability": "Present",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-339",
    "sourceId": "B2-1168",
    "name": "AMARJIT SINGH JABARJANG SINGH",
    "initials": "AS",
    "role": "TRUCK DRIVER",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-340",
    "sourceId": "B2-1035",
    "name": "AMMAR AHMED",
    "initials": "AA",
    "role": "TRUCK DRIVER",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-341",
    "sourceId": "B1-279",
    "name": "AMRITPAL SINGH SUKWANT",
    "initials": "AS",
    "role": "HEAVY TRUCK DRIVER",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-342",
    "sourceId": "B2-1034",
    "name": "ARASHDEEP SINGH",
    "initials": "AS",
    "role": "TRUCK DRIVER",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-343",
    "sourceId": "B2-628",
    "name": "BABAR HUSSAIN",
    "initials": "BH",
    "role": "TRAILER DRIVER",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-344",
    "sourceId": "B2-1091",
    "name": "BAIJU THATTAKATH",
    "initials": "BT",
    "role": "TRUCK DRIVER",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-345",
    "sourceId": "B2-318",
    "name": "BALWINDER SINGH",
    "initials": "BS",
    "role": "TRAILER DRIVER",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-346",
    "sourceId": "B2-763",
    "name": "BEANT SINGH",
    "initials": "BS",
    "role": "TRUCK DRIVER",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-347",
    "sourceId": "B2-887",
    "name": "CHAMKAUR SINGH",
    "initials": "CS",
    "role": "TRUCK DRIVER",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-348",
    "sourceId": "B2-397",
    "name": "DIL RAJ SINGH",
    "initials": "DR",
    "role": "TRAILER DRIVER",
    "department": "OP AUG 2026",
    "availability": "Present",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-349",
    "sourceId": "B2-1010",
    "name": "DILPREET SINGH",
    "initials": "DS",
    "role": "TRUCK DRIVER",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-350",
    "sourceId": "B2-1177",
    "name": "GAGANDEEP SINGH",
    "initials": "GS",
    "role": "TRUCK DRIVER",
    "department": "OP AUG 2026",
    "availability": "Present",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-351",
    "sourceId": "B2-1231",
    "name": "GAGANDEEP SINGH PARMINDER SINGH",
    "initials": "GS",
    "role": "TRUCK DRIVER",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-352",
    "sourceId": "B2-688",
    "name": "GHAREEB NAWAS",
    "initials": "GN",
    "role": "TRUCK DRIVER",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-353",
    "sourceId": "B2-1232",
    "name": "GURPREET SINGH AVTAR",
    "initials": "GS",
    "role": "TRUCK DRIVER",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-354",
    "sourceId": "B2-590",
    "name": "GURMEET SINGH BRAR",
    "initials": "GS",
    "role": "TRAILER DRIVER",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-355",
    "sourceId": "B2-1059",
    "name": "GURTEJ SINGH SUKHDEV",
    "initials": "GS",
    "role": "TRUCK DRIVER",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-356",
    "sourceId": "B2-1058",
    "name": "GURVINDER SINGH AMRIK",
    "initials": "GS",
    "role": "TRUCK DRIVER",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-357",
    "sourceId": "B1-294",
    "name": "GURVINDER SINGH GURDEV SINGH",
    "initials": "GS",
    "role": "TRUCK DRIVER",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-358",
    "sourceId": "B2-1233",
    "name": "GURMUKH SINGH DARSHAN SINGH",
    "initials": "GS",
    "role": "TRUCK DRIVER",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-359",
    "sourceId": "B2-831",
    "name": "GURWINDER SINGH",
    "initials": "GS",
    "role": "TRUCK DRIVER",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-360",
    "sourceId": "B2-1169",
    "name": "GUURPAL SINGH PARGAT SINGH",
    "initials": "GS",
    "role": "TRUCK/LOW BED DRIVER",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-361",
    "sourceId": "B2-115",
    "name": "HAKIM ULLAH",
    "initials": "HU",
    "role": "TRUCK DRIVER",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-362",
    "sourceId": "B2-613",
    "name": "HARDEEP SINGH",
    "initials": "HS",
    "role": "TRAILOR DRIVER",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-363",
    "sourceId": "B2-936",
    "name": "HARWINDER SINGH GURMUKH SINGH",
    "initials": "HS",
    "role": "LOWBED DRIVER",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-364",
    "sourceId": "B2-552",
    "name": "HARINDER SINGH HARDIAL SINGH",
    "initials": "HS",
    "role": "TRAILER DRIVER",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-365",
    "sourceId": "B3-134",
    "name": "HARISANKAR",
    "initials": "H",
    "role": "TRAILER DRIVER",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-366",
    "sourceId": "B1-287",
    "name": "HARJEET SINGH SUKHDEV SINGH",
    "initials": "HS",
    "role": "HEAVY TRUCK DRIVER",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-367",
    "sourceId": "B2-952",
    "name": "HARJINDER SINGH BHUPINDER SINGH",
    "initials": "HS",
    "role": "TRUCK DRIVER",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-368",
    "sourceId": "B2-737",
    "name": "HARMANDEEP",
    "initials": "H",
    "role": "TRUCK DRIVER",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-369",
    "sourceId": "B2-1166",
    "name": "HARMEET SINGH GURNEK SINGH",
    "initials": "HS",
    "role": "TRUCK DRIVER",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-370",
    "sourceId": "B2-1077",
    "name": "JAGJEET SINGH DARBARAN SINGH",
    "initials": "JS",
    "role": "TRUCK DRIVER",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-371",
    "sourceId": "B2-662",
    "name": "JAGROOP SINGH",
    "initials": "JS",
    "role": "TRUCK DRIVER",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-372",
    "sourceId": "B2-1186",
    "name": "JAGROOP SINGH HARJINDER SINGH",
    "initials": "JS",
    "role": "TRUCK DRIVER",
    "department": "OP AUG 2026",
    "availability": "Present",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-373",
    "sourceId": "B2-738",
    "name": "JAGWANT SINGH",
    "initials": "JS",
    "role": "TRUCK DRIVER",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-374",
    "sourceId": "B2-1199",
    "name": "JASPREET SINGH KULDEEP SINGH",
    "initials": "JS",
    "role": "HEAVY TRUCK DRIVER",
    "department": "OP AUG 2026",
    "availability": "Present",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-375",
    "sourceId": "B2-761",
    "name": "JASVIR SINGH",
    "initials": "JS",
    "role": "TRUCK DRIVER",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-376",
    "sourceId": "B2-451",
    "name": "JATINDER PAL",
    "initials": "JP",
    "role": "TRAILER DRIVER",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-377",
    "sourceId": "B2-568",
    "name": "JATINDER SINGH",
    "initials": "JS",
    "role": "TRAILER DRIVER",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-378",
    "sourceId": "B2-1174",
    "name": "JATINDER SINGH BALWINDER",
    "initials": "JS",
    "role": "TRUCK DRIVER",
    "department": "OP AUG 2026",
    "availability": "Present",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-379",
    "sourceId": "B2-690",
    "name": "JEEVAN KUMAR",
    "initials": "JK",
    "role": "TRAILER DRIVER",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-380",
    "sourceId": "B2-1078",
    "name": "JOBANJEET SINGH RAJINDER SINGH",
    "initials": "JS",
    "role": "TRUCK DRIVER",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-381",
    "sourceId": "B1-114",
    "name": "JOSE PALLITHAZHATHIL",
    "initials": "JP",
    "role": "TRAILER DRIVER",
    "department": "OP AUG 2026",
    "availability": "Present",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-382",
    "sourceId": "B2-295",
    "name": "KARAN BEER SINGH",
    "initials": "KB",
    "role": "TRUCK DRIVER",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-383",
    "sourceId": "B2-841",
    "name": "KARANJEET",
    "initials": "K",
    "role": "TRAILER DRIVER",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-384",
    "sourceId": "B2-1012",
    "name": "KARAMVIR SINGH",
    "initials": "KS",
    "role": "LOWBED DRIVER",
    "department": "OP AUG 2026",
    "availability": "Present",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-385",
    "sourceId": "B2-1079",
    "name": "KASHIF ALI FARZAND ALI",
    "initials": "KA",
    "role": "TRUCK DRIVER",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-386",
    "sourceId": "B2-360",
    "name": "KASHIF JAVED",
    "initials": "KJ",
    "role": "TRUCK DRIVER",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-387",
    "sourceId": "B2-829",
    "name": "KULDIP SINGH SURJIT SINGH",
    "initials": "KS",
    "role": "TRUCK DRIVER",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-388",
    "sourceId": "B2-1098",
    "name": "LOK BAHADUR SHESTHA",
    "initials": "LB",
    "role": "TRUCK DRIVER",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-389",
    "sourceId": "B2-1053",
    "name": "LOVEPREET SINGH SUKHJIT SINGH",
    "initials": "LS",
    "role": "TRUCK DRIVER",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-390",
    "sourceId": "B2-1109",
    "name": "MAHABIR SINGH GILL GURWINDER",
    "initials": "MS",
    "role": "TRUCK DRIVER",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-391",
    "sourceId": "B2-1070",
    "name": "MALKEET SINGH",
    "initials": "MS",
    "role": "TRUCK DRIVER",
    "department": "OP AUG 2026",
    "availability": "Present",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-392",
    "sourceId": "B2-1015",
    "name": "MANDEEP KUMAR RAJ PAL",
    "initials": "MK",
    "role": "TRUCK DRIVER",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-393",
    "sourceId": "B2-712",
    "name": "MANDEEP SINGH",
    "initials": "MS",
    "role": "TRUCK DRIVER",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-394",
    "sourceId": "B2-697",
    "name": "MANJOT SINGH",
    "initials": "MS",
    "role": "TRUCK DRIVER",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-395",
    "sourceId": "B1-282",
    "name": "MANNAN AKAM MOHAMMAD",
    "initials": "MA",
    "role": "HEAVY TRUCK DRIVER",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-396",
    "sourceId": "B2-321",
    "name": "MANPREET SINGH",
    "initials": "MS",
    "role": "TRUCK DRIVER",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-397",
    "sourceId": "B2-1116",
    "name": "MIRA KHAN SAR DAR KHAN",
    "initials": "MK",
    "role": "TRUCK DRIVER",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-398",
    "sourceId": "B2-1036",
    "name": "MOHAMMAD YASHAB",
    "initials": "MY",
    "role": "TRUCK DRIVER",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-399",
    "sourceId": "B2-502",
    "name": "MOULAK SINGH",
    "initials": "MS",
    "role": "TRUCK DRIVER",
    "department": "OP AUG 2026",
    "availability": "Off-Site",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-400",
    "sourceId": "B2-1124",
    "name": "MUHAMMAD NAEEM",
    "initials": "MN",
    "role": "TRUCK DRIVER",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-401",
    "sourceId": "B1-111",
    "name": "MUHAMMAD SAFDHAR",
    "initials": "MS",
    "role": "TRUCK DRIVER",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-402",
    "sourceId": "B2-1117",
    "name": "MUHAMMED RAZZAQ GHULAM RASOOL",
    "initials": "MR",
    "role": "TRUCK DRIVER",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-403",
    "sourceId": "B2-417",
    "name": "NAVEEN KUMAR",
    "initials": "NK",
    "role": "TRAILER DRIVER",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-404",
    "sourceId": "B1-284",
    "name": "OMKAR SINGH JAGTAR",
    "initials": "OS",
    "role": "HEAVY TRUCK DRIVER",
    "department": "OP AUG 2026",
    "availability": "Present",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-405",
    "sourceId": "B1-242",
    "name": "PALWINDER SINGH",
    "initials": "PS",
    "role": "TRAILOR DRIVER",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-406",
    "sourceId": "B2-592",
    "name": "PARDEEP SINGH",
    "initials": "PS",
    "role": "TRAILER DRIVER",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-407",
    "sourceId": "B2-1153",
    "name": "PARDEEP SINGH GURMUKH SINGH",
    "initials": "PS",
    "role": "TRUCK DRIVER",
    "department": "OP AUG 2026",
    "availability": "Present",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-408",
    "sourceId": "B2-830",
    "name": "PARMDIP SINGH",
    "initials": "PS",
    "role": "TRAILER DRIVER",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-409",
    "sourceId": "B2-709",
    "name": "PAVITTAR SINGH",
    "initials": "PS",
    "role": "TRUCK DRIVER",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-410",
    "sourceId": "B2-1013",
    "name": "PRABHJOT SINGH",
    "initials": "PS",
    "role": "TRUCK DRIVER",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-411",
    "sourceId": "B2-699",
    "name": "PRAVJIT SINGH RAM",
    "initials": "PS",
    "role": "TRUCK DRIVER",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-412",
    "sourceId": "B2-756",
    "name": "RAJBIR SINGH",
    "initials": "RS",
    "role": "TRUCK DRIVER",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-413",
    "sourceId": "B2-705",
    "name": "RAJENDRA SINGH",
    "initials": "RS",
    "role": "TRUCK DRIVER",
    "department": "OP AUG 2026",
    "availability": "Present",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-414",
    "sourceId": "B2-692",
    "name": "RAJIV KUMAR",
    "initials": "RK",
    "role": "TRUCK DRIVER",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-415",
    "sourceId": "B2-1178",
    "name": "RAJKARAN SINGH GURBHEJ SINGH",
    "initials": "RS",
    "role": "TRUCK DRIVER",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-416",
    "sourceId": "B2-597",
    "name": "RANJODH SINGH",
    "initials": "RS",
    "role": "TRUCK DRIVER",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-417",
    "sourceId": "B2-443",
    "name": "RISHU PAUL",
    "initials": "RP",
    "role": "TRAILER DRIVER",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-418",
    "sourceId": "B2-694",
    "name": "SARBJEET SINGH",
    "initials": "SS",
    "role": "TRUCK DRIVER",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-419",
    "sourceId": "B2-173",
    "name": "SARWAN SINGH",
    "initials": "SS",
    "role": "TRUCK DRIVER",
    "department": "OP AUG 2026",
    "availability": "On Leave",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-420",
    "sourceId": "B1-218",
    "name": "SATBIR SINGH",
    "initials": "SS",
    "role": "TRUCK DRIVER",
    "department": "OP AUG 2026",
    "availability": "Present",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-421",
    "sourceId": "B1-133",
    "name": "SAYED MARIFAT",
    "initials": "SM",
    "role": "TRAILER DRIVER",
    "department": "OP AUG 2026",
    "availability": "Present",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-422",
    "sourceId": "B2-559",
    "name": "SAYI SIVASANKARA PILLAI",
    "initials": "SS",
    "role": "TRAILER DRIVER",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-423",
    "sourceId": "B2-199",
    "name": "SHAHID MEHMOOD",
    "initials": "SM",
    "role": "TRUCK DRIVER",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-424",
    "sourceId": "B2-1071",
    "name": "SHARIK ALI",
    "initials": "SA",
    "role": "TRUCK DRIVER",
    "department": "OP AUG 2026",
    "availability": "Present",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-425",
    "sourceId": "B2-1161",
    "name": "SIMRANJIT SINGH",
    "initials": "SS",
    "role": "TRUCK DRIVER",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-426",
    "sourceId": "B2-671",
    "name": "SINGH BAHADUR",
    "initials": "SB",
    "role": "TRUCK DRIVER",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-427",
    "sourceId": "B2-775",
    "name": "SUJAN SAHADEVAN",
    "initials": "SS",
    "role": "TRUCK DRIVER",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-428",
    "sourceId": "B2-1202",
    "name": "SUKCHAIN SINGH GURDEV SINGH",
    "initials": "SS",
    "role": "HEAVY TRUCK DRIVE",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-429",
    "sourceId": "B2-1223",
    "name": "SUKHPREET SINGH",
    "initials": "SS",
    "role": "TRUCK DRIVER",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-430",
    "sourceId": "B2-655",
    "name": "SUKHJOT SINGH",
    "initials": "SS",
    "role": "TRUCK DRIVER",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-431",
    "sourceId": "B1-246",
    "name": "SUKHPAL",
    "initials": "S",
    "role": "TRAILER DRIVER",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-432",
    "sourceId": "B2-425",
    "name": "SULTAN HAYAT KHAN",
    "initials": "SH",
    "role": "TRAILER DRIVER",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-433",
    "sourceId": "B2-1043",
    "name": "SURINDER SINGH",
    "initials": "SS",
    "role": "TRUCK DRIVER",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-434",
    "sourceId": "B2-1080",
    "name": "TAJINDER PAL SINGH",
    "initials": "TP",
    "role": "TRUCK DRIVER",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-435",
    "sourceId": "B2-1203",
    "name": "TAJINDER SINGH NIDHAN SINGH",
    "initials": "TS",
    "role": "HEAVY TRUCK DRIVER",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-436",
    "sourceId": "B2-561",
    "name": "TEJBIR SINGH",
    "initials": "TS",
    "role": "TRAILER DRIVER",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-437",
    "sourceId": "B2-562",
    "name": "USAMA",
    "initials": "U",
    "role": "TRAILER DRIVER",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-438",
    "sourceId": "B2-669",
    "name": "VISHNU VENUGOPAL",
    "initials": "VV",
    "role": "TRAILER DRIVER",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-439",
    "sourceId": "B2-1128",
    "name": "YADWINDER SINGH GIAN SINGH",
    "initials": "YS",
    "role": "TRAILER DRIVER",
    "department": "OP AUG 2026",
    "availability": "Present",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-440",
    "sourceId": "B2-1155",
    "name": "YOUNAS KHAN HAKIM ULLAH",
    "initials": "YK",
    "role": "TRUCK DRIVER",
    "department": "OP AUG 2026",
    "availability": "Present",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-441",
    "sourceId": "B1-283",
    "name": "ZAHID ALI KHAN",
    "initials": "ZA",
    "role": "HEAVY TRUCK DRIVER",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-442",
    "sourceId": "B2-623",
    "name": "ZAHIR SHARIF",
    "initials": "ZS",
    "role": "TRUCK DRIVER",
    "department": "OP AUG 2026",
    "availability": "Present",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-443",
    "sourceId": "B2-693",
    "name": "ZULFIQAR ALI",
    "initials": "ZA",
    "role": "TRAILER DRIVER",
    "department": "OP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-444",
    "sourceId": "B2-527",
    "name": "ABDUL JALEEL",
    "initials": "AJ",
    "role": "Rigger",
    "department": "HELP AUG 2026",
    "availability": "Present",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-445",
    "sourceId": "B2-1192",
    "name": "ABI RENJU KUMAR",
    "initials": "AR",
    "role": "Crane Operator Ass",
    "department": "HELP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-446",
    "sourceId": "B2-950",
    "name": "ABHIJITH LIJU BABITHA",
    "initials": "AL",
    "role": "Crane Operator Ass",
    "department": "HELP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-447",
    "sourceId": "B2-509",
    "name": "ABHILASH UNNI",
    "initials": "AU",
    "role": "Rigger",
    "department": "HELP AUG 2026",
    "availability": "Present",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-448",
    "sourceId": "B2-504",
    "name": "ABHIRAM SUNEEF",
    "initials": "AS",
    "role": "Rigger",
    "department": "HELP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-449",
    "sourceId": "B2-643",
    "name": "ABHISHEK AJIKUMAR",
    "initials": "AA",
    "role": "Rigger",
    "department": "HELP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-450",
    "sourceId": "B3-115",
    "name": "ABHISHEK KUMAR",
    "initials": "AK",
    "role": "Rigger",
    "department": "HELP AUG 2026",
    "availability": "Present",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-451",
    "sourceId": "B2-1032",
    "name": "ABHISHEK KRISHNA",
    "initials": "AK",
    "role": "Crane Operator Ass",
    "department": "HELP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-452",
    "sourceId": "B2-1182",
    "name": "ABHIJITH PRAMOD SHEELA PRAMOD",
    "initials": "AP",
    "role": "Crane Operator Ass",
    "department": "WORKSHOP AUG 2026",
    "availability": "Present",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-453",
    "sourceId": "B2-1157",
    "name": "ABHIJITH RAMESH CHEMANNIL",
    "initials": "AR",
    "role": "Crane Operator Ass",
    "department": "HELP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-454",
    "sourceId": "B2-1106",
    "name": "ABHAYKRISHNA SAJEEV",
    "initials": "AS",
    "role": "Crane Operator Ass",
    "department": "HELP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-455",
    "sourceId": "B2-941",
    "name": "ACHINTH SASIDHARAN NAIR",
    "initials": "AS",
    "role": "Crane Operator Ass",
    "department": "HELP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-456",
    "sourceId": "B2-842",
    "name": "ADERSH SREEKUMAR NAIR",
    "initials": "AS",
    "role": "Rigger",
    "department": "HELP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-457",
    "sourceId": "B2-1019",
    "name": "ADARSH SURESH",
    "initials": "AS",
    "role": "Crane Operator Ass",
    "department": "HELP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-458",
    "sourceId": "B2-1047",
    "name": "ADARSH MOHAN",
    "initials": "AM",
    "role": "Crane Operator Ass",
    "department": "HELP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-459",
    "sourceId": "B2-817",
    "name": "ADITHYAN",
    "initials": "A",
    "role": "Crane Operator Ass",
    "department": "WORKSHOP AUG 2026",
    "availability": "Present",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-460",
    "sourceId": "B2-986",
    "name": "ADUL KRISHNA",
    "initials": "AK",
    "role": "Crane Operator Ass",
    "department": "HELP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-461",
    "sourceId": "B1-227",
    "name": "ADWAITH BIJU",
    "initials": "AB",
    "role": "Rigger",
    "department": "HELP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-462",
    "sourceId": "B2-1167",
    "name": "AJAY MOHAN MOHANANA R",
    "initials": "AM",
    "role": "Crane Operator Ass",
    "department": "HELP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-463",
    "sourceId": "B2-1150",
    "name": "AJEESH MANIKKATH BAKTHVALSALAN",
    "initials": "AM",
    "role": "Crane Operator Ass",
    "department": "HELP AUG 2026",
    "availability": "Present",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-464",
    "sourceId": "B2-588",
    "name": "AKBAR NUT",
    "initials": "AN",
    "role": "Rigger",
    "department": "HELP AUG 2026",
    "availability": "Present",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-465",
    "sourceId": "B2-1066",
    "name": "AKHIL DEV PR",
    "initials": "AD",
    "role": "Crane Operator Ass",
    "department": "HELP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-466",
    "sourceId": "B2-459",
    "name": "AKHIL KOLANTHARA",
    "initials": "AK",
    "role": "Rigger",
    "department": "HELP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-467",
    "sourceId": "B2-899",
    "name": "AKSHAY KARUMATHIL RAVI",
    "initials": "AK",
    "role": "Rigger",
    "department": "HELP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-468",
    "sourceId": "B2-570",
    "name": "AKSHAY MARAYKAPARAMBIL SHIBU",
    "initials": "AM",
    "role": "Rigger",
    "department": "HELP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-469",
    "sourceId": "B2-774",
    "name": "AMAL APPUKUTTAN",
    "initials": "AA",
    "role": "Rigger",
    "department": "HELP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-470",
    "sourceId": "B1-225",
    "name": "AMAL KRISHNAN",
    "initials": "AK",
    "role": "Rigger",
    "department": "HELP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-471",
    "sourceId": "B2-572",
    "name": "AMARNADH BAIJU",
    "initials": "AB",
    "role": "Rigger",
    "department": "HELP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-472",
    "sourceId": "B2-1093",
    "name": "AMBADI D",
    "initials": "AD",
    "role": "Crane Operator Ass",
    "department": "HELP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-473",
    "sourceId": "B2-963",
    "name": "AMRITPAL SINGH",
    "initials": "AS",
    "role": "Crane Operator Ass",
    "department": "HELP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-474",
    "sourceId": "B2-792",
    "name": "AMIT SHARMA",
    "initials": "AS",
    "role": "Rigger",
    "department": "HELP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-475",
    "sourceId": "B2-262",
    "name": "ANANDAKRISHNAN",
    "initials": "A",
    "role": "Rigger",
    "department": "HELP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-476",
    "sourceId": "B2-599",
    "name": "ANANDHAN KOVOTT",
    "initials": "AK",
    "role": "Rigger",
    "department": "HELP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-477",
    "sourceId": "B2-1209",
    "name": "ANANTHU KUMAR ANILKUMAR",
    "initials": "AK",
    "role": "Crane Operator Ass",
    "department": "HELP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-478",
    "sourceId": "B2-1212",
    "name": "ANANDHUMON",
    "initials": "A",
    "role": "Crane Operator Ass",
    "department": "HELP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-479",
    "sourceId": "B2-505",
    "name": "ANANDHU MURALEEDHARAN",
    "initials": "AM",
    "role": "Rigger/Supervisor",
    "department": "HELP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-480",
    "sourceId": "B2-748",
    "name": "ANANTHU SURESH KUMAR KS",
    "initials": "AS",
    "role": "Rigger",
    "department": "HELP AUG 2026",
    "availability": "Off-Site",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-481",
    "sourceId": "B2-823",
    "name": "ANEESH KUNJUKRISHNA",
    "initials": "AK",
    "role": "Rigger",
    "department": "HELP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-482",
    "sourceId": "B2-339",
    "name": "ANIL GUDISE",
    "initials": "AG",
    "role": "Rigger",
    "department": "HELP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-483",
    "sourceId": "B3-135",
    "name": "ANIL KUMAR CHAUHAN",
    "initials": "AK",
    "role": "Rigger",
    "department": "HELP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-484",
    "sourceId": "B2-148",
    "name": "APPANASAMY",
    "initials": "A",
    "role": "Sup/Rigger",
    "department": "HELP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-485",
    "sourceId": "B2-313",
    "name": "ARBIND KUMAR",
    "initials": "AK",
    "role": "Sup/Rigger",
    "department": "HELP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-486",
    "sourceId": "B2-396",
    "name": "AROMAL ANILKUMAR",
    "initials": "AA",
    "role": "Rigger",
    "department": "HELP AUG 2026",
    "availability": "Present",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-487",
    "sourceId": "B2-469",
    "name": "AROMAL SURENDRAN",
    "initials": "AS",
    "role": "Rigger",
    "department": "HELP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-488",
    "sourceId": "B3-113",
    "name": "ASAR AHMAD",
    "initials": "AA",
    "role": "Rigger",
    "department": "HELP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-489",
    "sourceId": "B2-1146-CHANGED TO-B1-272",
    "name": "ASHAFAK ANSARI",
    "initials": "AA",
    "role": "CRAWLER ASSEM RIGGER",
    "department": "HELP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-490",
    "sourceId": "B2-1144",
    "name": "ASHAK SUDHARJI RASEENA",
    "initials": "AS",
    "role": "Crane Operator Ass",
    "department": "HELP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-491",
    "sourceId": "B2-645",
    "name": "ASHWIN PRADEEP",
    "initials": "AP",
    "role": "Rigger",
    "department": "HELP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-492",
    "sourceId": "B2-1114",
    "name": "ASWIN SAJU BINDHU",
    "initials": "AS",
    "role": "Crane Operator Ass",
    "department": "HELP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-493",
    "sourceId": "B2-983",
    "name": "ASWIN VIJAY",
    "initials": "AV",
    "role": "Crane Operator Ass",
    "department": "HELP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-494",
    "sourceId": "B1-226",
    "name": "ASWIN C S",
    "initials": "AC",
    "role": "Rigger",
    "department": "HELP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-495",
    "sourceId": "B2-460",
    "name": "ATHUL KRISHNA",
    "initials": "AK",
    "role": "Rigger",
    "department": "HELP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-496",
    "sourceId": "B2-556",
    "name": "BALJIT SINGH SUKHBIR",
    "initials": "BS",
    "role": "Rigger",
    "department": "HELP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-497",
    "sourceId": "B2-1208",
    "name": "BAJEESHMON ODERI BABU",
    "initials": "BO",
    "role": "Crane Operator Ass",
    "department": "WORKSHOP AUG 2026",
    "availability": "Present",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-498",
    "sourceId": "B2-1039",
    "name": "BALU RAJ RAJENDRA",
    "initials": "BR",
    "role": "Crane Operator Ass",
    "department": "HELP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-499",
    "sourceId": "B3-137",
    "name": "BENJAMIN NIYUM",
    "initials": "BN",
    "role": "Rigger - New",
    "department": "HELP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-500",
    "sourceId": "B2-674",
    "name": "BOVAS BABU",
    "initials": "BB",
    "role": "Rigger",
    "department": "HELP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-501",
    "sourceId": "B2-582",
    "name": "DAROGA SINGH",
    "initials": "DS",
    "role": "Rigger",
    "department": "HELP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-502",
    "sourceId": "B2-770",
    "name": "DURBEJ KUMAR YADAV",
    "initials": "DK",
    "role": "Rigger",
    "department": "HELP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-503",
    "sourceId": "B2-1004",
    "name": "DINESH RAJENDER",
    "initials": "DR",
    "role": "Crane Operator Ass",
    "department": "HELP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-504",
    "sourceId": "B1-224",
    "name": "EMMANUEL WILSON",
    "initials": "EW",
    "role": "Rigger",
    "department": "WORKSHOP AUG 2026",
    "availability": "Present",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-505",
    "sourceId": "B2-1131",
    "name": "EJAJUDDIN ALAM NASARULLAH ALAM",
    "initials": "EA",
    "role": "Crane Operator Ass",
    "department": "HELP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-506",
    "sourceId": "B2-801",
    "name": "GANESH BIJU",
    "initials": "GB",
    "role": "Rigger",
    "department": "HELP AUG 2026",
    "availability": "Off-Site",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-507",
    "sourceId": "B2-632",
    "name": "GANGA KISHAN",
    "initials": "GK",
    "role": "Rigger",
    "department": "HELP AUG 2026",
    "availability": "Present",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-508",
    "sourceId": "B2-608",
    "name": "GANGA SAGAR",
    "initials": "GS",
    "role": "Rigger",
    "department": "HELP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-509",
    "sourceId": "B2-1050",
    "name": "GOPU KRISHNAN GOPALAKRISHNAN",
    "initials": "GK",
    "role": "Crane Operator Ass",
    "department": "HELP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-510",
    "sourceId": "B2-1141",
    "name": "GOKUL RAJ RAJASEKHARAN NAIR",
    "initials": "GR",
    "role": "Crane Operator Ass",
    "department": "HELP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-511",
    "sourceId": "B2-1198",
    "name": "HARI SUSEELAN CHELLAPPAN",
    "initials": "HS",
    "role": "Crane Operator Ass",
    "department": "HELP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-512",
    "sourceId": "B2-1210",
    "name": "HARILAL HARIDAS",
    "initials": "HH",
    "role": "Crane Operator Ass",
    "department": "HELP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-513",
    "sourceId": "B2-470",
    "name": "HARI LAL",
    "initials": "HL",
    "role": "Rigger",
    "department": "HELP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-514",
    "sourceId": "B2-883",
    "name": "HARIKUTTAN",
    "initials": "H",
    "role": "Rigger",
    "department": "HELP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-515",
    "sourceId": "B2-155",
    "name": "HARIRAJ RAJAN PILLAI",
    "initials": "HR",
    "role": "Sup/Rigger",
    "department": "HELP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-516",
    "sourceId": "B2-1084",
    "name": "HARIS NIRAPARAMPIL",
    "initials": "HN",
    "role": "Crane Operator Ass",
    "department": "HELP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-517",
    "sourceId": "B1-214",
    "name": "HARPAL SINGH",
    "initials": "HS",
    "role": "Rigger",
    "department": "WORKSHOP AUG 2026",
    "availability": "Present",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-518",
    "sourceId": "B2-1159",
    "name": "HARPAL SINGH SHIVRAJ SINGH",
    "initials": "HS",
    "role": "Crane Operator Ass",
    "department": "HELP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-519",
    "sourceId": "B2-356",
    "name": "INDAL KUMAR",
    "initials": "IK",
    "role": "Rigger",
    "department": "HELP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-520",
    "sourceId": "B2-627",
    "name": "INTYAZ AHMAD",
    "initials": "IA",
    "role": "Rigger",
    "department": "HELP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-521",
    "sourceId": "B1-230",
    "name": "JAFAR",
    "initials": "J",
    "role": "Rigger",
    "department": "HELP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-522",
    "sourceId": "B2-1089",
    "name": "JAGDISH SINGH BALKAR",
    "initials": "JS",
    "role": "Crawler",
    "department": "HELP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-523",
    "sourceId": "B2-296",
    "name": "JAGJIT YOUSF",
    "initials": "JY",
    "role": "Rigger",
    "department": "HELP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-524",
    "sourceId": "B2-350",
    "name": "JAY PRAKASH",
    "initials": "JP",
    "role": "Rigger",
    "department": "HELP AUG 2026",
    "availability": "Off-Site",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-525",
    "sourceId": "B2-403",
    "name": "KALAMUDDIN NUT",
    "initials": "KN",
    "role": "Rigger",
    "department": "HELP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-526",
    "sourceId": "B2-821",
    "name": "KIRAN KUMAR",
    "initials": "KK",
    "role": "Rigger",
    "department": "HELP AUG 2026",
    "availability": "Present",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-527",
    "sourceId": "B2-832",
    "name": "LOVEPREET",
    "initials": "L",
    "role": "Rigger",
    "department": "HELP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-528",
    "sourceId": "B2-860",
    "name": "MAHESH KOCHUMANI",
    "initials": "MK",
    "role": "Rigger",
    "department": "HELP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-529",
    "sourceId": "B2- 919",
    "name": "MAHESH KUMAR",
    "initials": "MK",
    "role": "Crane Operator Ass",
    "department": "HELP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-530",
    "sourceId": "B2-818",
    "name": "MAHI MADHU",
    "initials": "MM",
    "role": "Crane Operator Ass",
    "department": "HELP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-531",
    "sourceId": "B3-131",
    "name": "MAIKAL MASIH",
    "initials": "MM",
    "role": "Rigger",
    "department": "HELP AUG 2026",
    "availability": "Present",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-532",
    "sourceId": "B2-606",
    "name": "MANNU NUT",
    "initials": "MN",
    "role": "Rigger",
    "department": "HELP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-533",
    "sourceId": "B2-982",
    "name": "MANUJITH MANUKUMAR",
    "initials": "MM",
    "role": "Crane Operator Ass",
    "department": "HELP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-534",
    "sourceId": "B2-650",
    "name": "MANOHARAN UTHAMATHIL",
    "initials": "MU",
    "role": "Rigger/Security",
    "department": "HELP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-535",
    "sourceId": "B2-855",
    "name": "MANOJ MANGALANANDAN",
    "initials": "MM",
    "role": "Rigger",
    "department": "HELP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-536",
    "sourceId": "B2-1086",
    "name": "MD BASIR ALAM BHOLA",
    "initials": "MB",
    "role": "Crawler Sup",
    "department": "HELP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-537",
    "sourceId": "B2-1147",
    "name": "M D ARBAZ",
    "initials": "MD",
    "role": "CRAWLER ASSEM RIGGER",
    "department": "HELP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-538",
    "sourceId": "B2-1009",
    "name": "MELVIN MATHUNNY",
    "initials": "MM",
    "role": "Crane Operator Ass",
    "department": "HELP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-539",
    "sourceId": "B2-1049",
    "name": "MIDHUN MOHAN",
    "initials": "MM",
    "role": "Crane Operator Ass",
    "department": "HELP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-540",
    "sourceId": "B2-1171",
    "name": "MIDHUN MADHU MANJUSHA",
    "initials": "MM",
    "role": "Crane Operator Ass",
    "department": "HELP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-541",
    "sourceId": "B2-352",
    "name": "MOHAMED TAUKIR",
    "initials": "MT",
    "role": "Rigger",
    "department": "HELP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-542",
    "sourceId": "B2-449",
    "name": "MOHAMMED NAZIR",
    "initials": "MN",
    "role": "Rigger",
    "department": "HELP AUG 2026",
    "availability": "Present",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-543",
    "sourceId": "B2-1046",
    "name": "MOHAMMAD PARBEJ ALAM",
    "initials": "MP",
    "role": "Crane Operator Ass",
    "department": "HELP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-544",
    "sourceId": "B2-1204",
    "name": "MOHIT KUMAR PRADEEP KUMART",
    "initials": "MK",
    "role": "Crane Operator Ass",
    "department": "HELP AUG 2026",
    "availability": "Off-Site",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-545",
    "sourceId": "B2-348",
    "name": "MOHITH SANKAR THOTTINGAL SIVASANKARAN THOTTINGAL",
    "initials": "MS",
    "role": "Rigger",
    "department": "WORKSHOP AUG 2026",
    "availability": "Present",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-546",
    "sourceId": "B2-490",
    "name": "MUHAMMAD AZEEM",
    "initials": "MA",
    "role": "Rigger",
    "department": "HELP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-547",
    "sourceId": "B2-1219",
    "name": "MD RAMSHAD CHAKKUTTU",
    "initials": "MR",
    "role": "Rigger",
    "department": "HELP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-548",
    "sourceId": "B2-723",
    "name": "MUHAMMAD DILAWAR KHAN",
    "initials": "MD",
    "role": "Rigger",
    "department": "HELP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-549",
    "sourceId": "B2-530",
    "name": "MUHAMMAD RAFEEK",
    "initials": "MR",
    "role": "Rigger",
    "department": "HELP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-550",
    "sourceId": "B2-498",
    "name": "MUHAMMAD SALEEM",
    "initials": "MS",
    "role": "Rigger",
    "department": "HELP AUG 2026",
    "availability": "Present",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-551",
    "sourceId": "B1-220",
    "name": "MUJEEB RAHIMAN",
    "initials": "MR",
    "role": "Rigger",
    "department": "HELP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-552",
    "sourceId": "B2-354",
    "name": "MUKESH YADAV",
    "initials": "MY",
    "role": "Rigger",
    "department": "HELP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-553",
    "sourceId": "B2-698",
    "name": "MUTHURAMALINGAM",
    "initials": "M",
    "role": "Rigger",
    "department": "HELP AUG 2026",
    "availability": "Present",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-554",
    "sourceId": "B2-827",
    "name": "NAGANATHAN",
    "initials": "N",
    "role": "Rigger",
    "department": "HELP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-555",
    "sourceId": "B2-783",
    "name": "NANDLAL",
    "initials": "N",
    "role": "Rigger",
    "department": "HELP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-556",
    "sourceId": "B2-1158",
    "name": "NASH JOSE MARTIN",
    "initials": "NJ",
    "role": "Crane Operator Ass",
    "department": "HELP AUG 2026",
    "availability": "Off-Site",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-557",
    "sourceId": "B2-637",
    "name": "NIRANJAN VETHOTTIL",
    "initials": "NV",
    "role": "Rigger",
    "department": "HELP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-558",
    "sourceId": "B2-1225",
    "name": "NITHIN MOHAN KUMAR",
    "initials": "NM",
    "role": "RIGGER",
    "department": "WORKSHOP AUG 2026",
    "availability": "Present",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-559",
    "sourceId": "B2-834",
    "name": "OM PRAKASH",
    "initials": "OP",
    "role": "Rigger",
    "department": "HELP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-560",
    "sourceId": "B2-1113",
    "name": "PALMASIH MOHAN MASIH",
    "initials": "PM",
    "role": "Crane Operator Ass",
    "department": "HELP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-561",
    "sourceId": "B2-867",
    "name": "PARAMINDER SINGH",
    "initials": "PS",
    "role": "Rigger",
    "department": "HELP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-562",
    "sourceId": "B2-557",
    "name": "PARTAP SINGH MANGAL SINGH",
    "initials": "PS",
    "role": "Rigger",
    "department": "HELP AUG 2026",
    "availability": "On Leave",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-563",
    "sourceId": "B1-238",
    "name": "PARTAP SINGH SATNAM SINGH",
    "initials": "PS",
    "role": "Rigger - New",
    "department": "HELP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-564",
    "sourceId": "B2-1175",
    "name": "PRANAV PRAKASH RAKHI",
    "initials": "PP",
    "role": "Rigger - New",
    "department": "HELP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-565",
    "sourceId": "B2-1220",
    "name": "PRAKASH PRASAD",
    "initials": "PP",
    "role": "RIGGER",
    "department": "HELP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-566",
    "sourceId": "B2-1030",
    "name": "PREMJITH PRASAD",
    "initials": "PP",
    "role": "Crane Operator Ass",
    "department": "HELP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-567",
    "sourceId": "B2-1119",
    "name": "PRINCE KUMAR GOND",
    "initials": "PK",
    "role": "Rigger",
    "department": "HELP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-568",
    "sourceId": "B2-576",
    "name": "RAGHU ADHI",
    "initials": "RA",
    "role": "Rigger",
    "department": "HELP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-569",
    "sourceId": "B2-839",
    "name": "RAGHU KOMURE",
    "initials": "RK",
    "role": "Rigger",
    "department": "HELP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-570",
    "sourceId": "B2-787",
    "name": "RAHUL KUMAR RAMPREET",
    "initials": "RK",
    "role": "Rigger",
    "department": "HELP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-571",
    "sourceId": "B2-1136",
    "name": "RAHUL KRISHNAN RADHAKEISHNAN",
    "initials": "RK",
    "role": "Crane Operator Ass",
    "department": "HELP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-572",
    "sourceId": "B2-488",
    "name": "RAHUL RAJ KUMAR",
    "initials": "RR",
    "role": "Rigger",
    "department": "HELP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-573",
    "sourceId": "B2-922",
    "name": "RAHUL VENU",
    "initials": "RV",
    "role": "Crane Operator Ass",
    "department": "HELP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-574",
    "sourceId": "B2-749",
    "name": "RAHUL THULASI",
    "initials": "RT",
    "role": "Rigger",
    "department": "HELP AUG 2026",
    "availability": "Present",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-575",
    "sourceId": "B2-1073",
    "name": "RAJU SHARMA",
    "initials": "RS",
    "role": "Crane Operator Ass",
    "department": "HELP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-576",
    "sourceId": "B1-222",
    "name": "RAKESH CHANDRA YADAV",
    "initials": "RC",
    "role": "Rigger",
    "department": "HELP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-577",
    "sourceId": "B2-636",
    "name": "RAKESH KUMAR",
    "initials": "RK",
    "role": "Rigger",
    "department": "HELP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-578",
    "sourceId": "B2-868",
    "name": "RATHEESH RAMANAN",
    "initials": "RR",
    "role": "Rigger",
    "department": "HELP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-579",
    "sourceId": "B2-200",
    "name": "RENJITH GOPINATHAN NAIR",
    "initials": "RG",
    "role": "Rigger/Security",
    "department": "HELP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-580",
    "sourceId": "B2-1065",
    "name": "RITESH KUMAR SINGH",
    "initials": "RK",
    "role": "Crane Operator Ass",
    "department": "HELP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-581",
    "sourceId": "B2-209",
    "name": "RUPESH THOTTUNGAL",
    "initials": "RT",
    "role": "Rigger",
    "department": "HELP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-582",
    "sourceId": "B1-271",
    "name": "SABUMON SOMARAJAN",
    "initials": "SS",
    "role": "CAMP",
    "department": "HELP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-583",
    "sourceId": "B2-825",
    "name": "SABITH THAISSUVALAPPIL SABU",
    "initials": "ST",
    "role": "Rigger",
    "department": "HELP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-584",
    "sourceId": "B2-1176",
    "name": "SACHU CHANDRAN",
    "initials": "SC",
    "role": "Crane Operator Ass",
    "department": "HELP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-585",
    "sourceId": "B2-617",
    "name": "SADDAM HUSSAIN",
    "initials": "SH",
    "role": "Rigger",
    "department": "WORKSHOP AUG 2026",
    "availability": "Present",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-586",
    "sourceId": "B2-1092",
    "name": "SAILAL K A",
    "initials": "SK",
    "role": "Rigger",
    "department": "HELP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-587",
    "sourceId": "B2-1052",
    "name": "SAJEEV VASUDEVAN",
    "initials": "SV",
    "role": "SECURITY",
    "department": "WORKSHOP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-588",
    "sourceId": "B2-533",
    "name": "SAJIN JUSTIN",
    "initials": "SJ",
    "role": "Rigger",
    "department": "HELP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-589",
    "sourceId": "B2-575",
    "name": "SAMBHU HARI",
    "initials": "SH",
    "role": "Rigger",
    "department": "WORKSHOP AUG 2026",
    "availability": "Present",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-590",
    "sourceId": "B2-193",
    "name": "SANDEEP KUMAR SINGH",
    "initials": "SK",
    "role": "Sup/Rigger",
    "department": "HELP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-591",
    "sourceId": "B3-123",
    "name": "SANIL KUMAR",
    "initials": "SK",
    "role": "Rigger",
    "department": "HELP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-592",
    "sourceId": "B2-742",
    "name": "SANJAY KUMAR",
    "initials": "SK",
    "role": "Rigger",
    "department": "HELP AUG 2026",
    "availability": "Off-Site",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-593",
    "sourceId": "B2-813",
    "name": "SANJAY SAHINI",
    "initials": "SS",
    "role": "Rigger",
    "department": "HELP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-594",
    "sourceId": "B2-308",
    "name": "SANJUR ALAM",
    "initials": "SA",
    "role": "Rigger",
    "department": "HELP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-595",
    "sourceId": "B2-651",
    "name": "SANTOSH VERMA",
    "initials": "SV",
    "role": "Rigger",
    "department": "HELP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-596",
    "sourceId": "B2-1135",
    "name": "SANTHOSH YESHODHARAN",
    "initials": "SY",
    "role": "Crane Operator Ass",
    "department": "HELP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-597",
    "sourceId": "B2-1163",
    "name": "SARANG BINUMON",
    "initials": "SB",
    "role": "Crane Operator Ass",
    "department": "HELP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-598",
    "sourceId": "B2-791",
    "name": "SARABJIT SINGH",
    "initials": "SS",
    "role": "Rigger",
    "department": "WORKSHOP AUG 2026",
    "availability": "Present",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-599",
    "sourceId": "B2-666",
    "name": "SARATH SASIDHARAN",
    "initials": "SS",
    "role": "Rigger/Supervisor",
    "department": "HELP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-600",
    "sourceId": "B2-640",
    "name": "SARATH SREENIVAS",
    "initials": "SS",
    "role": "Rigger",
    "department": "HELP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-601",
    "sourceId": "B2-1130",
    "name": "SARAJUDIN ALAM NASARULLAM ALAM",
    "initials": "SA",
    "role": "Crane Operator Ass",
    "department": "HELP AUG 2026",
    "availability": "Present",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-602",
    "sourceId": "B2-940",
    "name": "SATHEESH VASUDEVAN",
    "initials": "SV",
    "role": "Crane Operator Ass",
    "department": "HELP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-603",
    "sourceId": "B2-407",
    "name": "SELVAMANI",
    "initials": "S",
    "role": "Rigger",
    "department": "HELP AUG 2026",
    "availability": "Present",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-604",
    "sourceId": "B1-217",
    "name": "SHAMSUDHEEN",
    "initials": "S",
    "role": "Rigger",
    "department": "HELP AUG 2026",
    "availability": "Present",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-605",
    "sourceId": "B2-131",
    "name": "SHIBU SUDARSANAN",
    "initials": "SS",
    "role": "Rigger",
    "department": "HELP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-606",
    "sourceId": "B2-797",
    "name": "SHINU SABU VARGHESE",
    "initials": "SS",
    "role": "Rigger/Supervisor",
    "department": "HELP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-607",
    "sourceId": "B2-822",
    "name": "SIJITH SASIDHARAN PILLAI",
    "initials": "SS",
    "role": "Rigger",
    "department": "HELP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-608",
    "sourceId": "B2-1188",
    "name": "SIJO JOHN",
    "initials": "SJ",
    "role": "Crane Operator Ass",
    "department": "WORKSHOP AUG 2026",
    "availability": "Present",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-609",
    "sourceId": "B2-802",
    "name": "SIJU SHAJU",
    "initials": "SS",
    "role": "Rigger",
    "department": "HELP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-610",
    "sourceId": "B2-548",
    "name": "SOMNATH SAH",
    "initials": "SS",
    "role": "Rigger",
    "department": "HELP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-611",
    "sourceId": "B2-668",
    "name": "SOORAJ MON",
    "initials": "SM",
    "role": "SKIDDING",
    "department": "HELP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-612",
    "sourceId": "B2-457",
    "name": "SOORAJ SURENDRA PRASAD",
    "initials": "SS",
    "role": "Rigger",
    "department": "HELP AUG 2026",
    "availability": "Present",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-613",
    "sourceId": "B2-675",
    "name": "SREEHARI",
    "initials": "S",
    "role": "Crane Operator Ass",
    "department": "HELP AUG 2026",
    "availability": "Present",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-614",
    "sourceId": "B2-1028",
    "name": "SREEJISHNU SREEKUMAR",
    "initials": "SS",
    "role": "Crane Operator Ass",
    "department": "HELP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-615",
    "sourceId": "B2-1180",
    "name": "SREDHEYAN PANAMKAVIL",
    "initials": "SP",
    "role": "RIGGER",
    "department": "HELP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-616",
    "sourceId": "B2-984",
    "name": "SREEJITH SATHYAN",
    "initials": "SS",
    "role": "Crane Operator Ass",
    "department": "HELP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-617",
    "sourceId": "B2-685",
    "name": "SREEKUMAR BHASKARA",
    "initials": "SB",
    "role": "Rigger",
    "department": "HELP AUG 2026",
    "availability": "Present",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-618",
    "sourceId": "B2-600",
    "name": "SREEKUTTAN",
    "initials": "S",
    "role": "Rigger",
    "department": "HELP AUG 2026",
    "availability": "Present",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-619",
    "sourceId": "B2-1031",
    "name": "SREELAL LALU",
    "initials": "SL",
    "role": "Crane Operator Ass",
    "department": "HELP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-620",
    "sourceId": "B2-536",
    "name": "SREERAJ RAJAN PILLAI",
    "initials": "SR",
    "role": "Rigger",
    "department": "HELP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-621",
    "sourceId": "B2-1195",
    "name": "SREESANTH",
    "initials": "S",
    "role": "Crane Operator Ass",
    "department": "HELP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-622",
    "sourceId": "B2-424",
    "name": "SUBIN",
    "initials": "S",
    "role": "Rigger",
    "department": "HELP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-623",
    "sourceId": "B2-1104",
    "name": "SUDEV KIZHAKKARA SURENDRAN",
    "initials": "SK",
    "role": "Crane Operator Ass",
    "department": "HELP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-624",
    "sourceId": "B2-642",
    "name": "SUKINDRA BABU",
    "initials": "SB",
    "role": "Rigger",
    "department": "HELP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-625",
    "sourceId": "B2-268",
    "name": "SUMESH KRISHNAN",
    "initials": "SK",
    "role": "Rigger",
    "department": "HELP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-626",
    "sourceId": "B2-1148",
    "name": "SUNIL KUMAR LAKHVIR CHAND",
    "initials": "SK",
    "role": "Crane Operator Ass",
    "department": "HELP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-627",
    "sourceId": "B2-804",
    "name": "SURENDRA KUMAR YADAV",
    "initials": "SK",
    "role": "Rigger",
    "department": "HELP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-628",
    "sourceId": "B2-985",
    "name": "SURYAN SUDARSANAN",
    "initials": "SS",
    "role": "Crane Operator Ass",
    "department": "HELP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-629",
    "sourceId": "B2-319",
    "name": "SURESH ALAGU",
    "initials": "SA",
    "role": "Rigger",
    "department": "HELP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-630",
    "sourceId": "B2-1090",
    "name": "TANVIR JUNG BAHADUR",
    "initials": "TJ",
    "role": "Crawler",
    "department": "HELP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-631",
    "sourceId": "B2-630",
    "name": "THARANGA KUMARA",
    "initials": "TK",
    "role": "Rigger",
    "department": "HELP AUG 2026",
    "availability": "Present",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-632",
    "sourceId": "B2-814",
    "name": "THARINDU THUSARA",
    "initials": "TT",
    "role": "Rigger",
    "department": "HELP AUG 2026",
    "availability": "Present",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-633",
    "sourceId": "B2-355",
    "name": "VIJAYA KUMAR JUNGALA",
    "initials": "VK",
    "role": "Rigger",
    "department": "HELP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-634",
    "sourceId": "B2-844",
    "name": "VIJESH VIJAYAN",
    "initials": "VV",
    "role": "Rigger",
    "department": "HELP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-635",
    "sourceId": "B2-1064",
    "name": "VINOD KUMAR GOND",
    "initials": "VK",
    "role": "Crane Operator Ass",
    "department": "HELP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-636",
    "sourceId": "B2-399",
    "name": "VINODKUMAR RAMACHANDRAN",
    "initials": "VR",
    "role": "Rigger",
    "department": "HELP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-637",
    "sourceId": "B2-218",
    "name": "VISAK SURENDRA BABU",
    "initials": "VS",
    "role": "Rigger/Supervisor",
    "department": "HELP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-638",
    "sourceId": "B2-1122",
    "name": "VISHNU THONDIL",
    "initials": "VT",
    "role": "Crane Operator Ass",
    "department": "HELP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-639",
    "sourceId": "B1-228",
    "name": "VISHNU ARJUN",
    "initials": "VA",
    "role": "Rigger",
    "department": "HELP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-640",
    "sourceId": "B2-838",
    "name": "VISHNU BIJU SANDHYA",
    "initials": "VB",
    "role": "Rigger",
    "department": "HELP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-641",
    "sourceId": "B2-1191",
    "name": "VISHNU VIJAYAKUMAR",
    "initials": "VV",
    "role": "Crane Operator Ass",
    "department": "HELP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-642",
    "sourceId": "B2-1173",
    "name": "VISHNU KUMAR VINOD KUMAR",
    "initials": "VK",
    "role": "Crane Operator Ass",
    "department": "HELP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-643",
    "sourceId": "B2-1024",
    "name": "VISHNU GOPALAKRISHNAN",
    "initials": "VG",
    "role": "SKIDDING SUPERVISOR",
    "department": "HELP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-644",
    "sourceId": "B2-147",
    "name": "VISHNU UNNIKRISHNAN",
    "initials": "VU",
    "role": "Rigger",
    "department": "HELP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-645",
    "sourceId": "B2-1187",
    "name": "VIPIN THULASIDHARA KURUP",
    "initials": "VT",
    "role": "Crane Operator Ass",
    "department": "HELP AUG 2026",
    "availability": "Present",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-646",
    "sourceId": "B1-221",
    "name": "YASAR ALI",
    "initials": "YA",
    "role": "Rigger",
    "department": "HELP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-647",
    "sourceId": "B1-292",
    "name": "ABHIMANYU ARJUNAN PILLAI",
    "initials": "AA",
    "role": "SECURITY",
    "department": "WORKSHOP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-648",
    "sourceId": "B2-167",
    "name": "ABHILASH",
    "initials": "A",
    "role": "WELDER",
    "department": "WORKSHOP AUG 2026",
    "availability": "Present",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-649",
    "sourceId": "B2-970",
    "name": "AFAJAL AHAMAD",
    "initials": "AA",
    "role": "AUTO ELECTRICIAN",
    "department": "WORKSHOP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-650",
    "sourceId": "B3-120",
    "name": "AMAL JITH",
    "initials": "AJ",
    "role": "ELECTRICIAN",
    "department": "WORKSHOP AUG 2026",
    "availability": "Present",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-651",
    "sourceId": "B2-864",
    "name": "AMAL NAIR",
    "initials": "AN",
    "role": "TECHNCIAN",
    "department": "WORKSHOP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-652",
    "sourceId": "B2-1102",
    "name": "ANTONY RAJ RACHAHER",
    "initials": "AR",
    "role": "MECHANIC",
    "department": "WORKSHOP AUG 2026",
    "availability": "Present",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-653",
    "sourceId": "B2-625",
    "name": "ANANDHU MURALEEDHARAN",
    "initials": "AM",
    "role": "MECH ASST",
    "department": "WORKSHOP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-654",
    "sourceId": "B2-1213",
    "name": "ANADHU PRASANNA KUMAR",
    "initials": "AP",
    "role": "MECHANIC ASST",
    "department": "WORKSHOP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-655",
    "sourceId": "B2-1111",
    "name": "ANOOP SUDHAKARAN NAIR",
    "initials": "AS",
    "role": "MECHANIC ASST",
    "department": "WORKSHOP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-656",
    "sourceId": "B2-386",
    "name": "ANILKUMAR",
    "initials": "A",
    "role": "MECHANIC",
    "department": "WORKSHOP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-657",
    "sourceId": "B1-182",
    "name": "ANILKUMAR SREEDHARAN",
    "initials": "AS",
    "role": "COOK",
    "department": "WORKSHOP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-658",
    "sourceId": "B2-719",
    "name": "ANISH RAGHAVAN",
    "initials": "AR",
    "role": "MECHANIC",
    "department": "WORKSHOP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-659",
    "sourceId": "B2-781",
    "name": "ANURAJ",
    "initials": "A",
    "role": "MECH ASST",
    "department": "WORKSHOP AUG 2026",
    "availability": "Present",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-660",
    "sourceId": "B2-686",
    "name": "ASOKAN",
    "initials": "A",
    "role": "ELECTRICIAN",
    "department": "WORKSHOP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-661",
    "sourceId": "B1-262",
    "name": "BABU SADANANDAN",
    "initials": "BS",
    "role": "COOK",
    "department": "WORKSHOP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-662",
    "sourceId": "B1-266",
    "name": "BRIJESH KUMAR THAKUR",
    "initials": "BK",
    "role": "KICHEN HELPER",
    "department": "WORKSHOP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-663",
    "sourceId": "B2-691",
    "name": "BINURAJ",
    "initials": "B",
    "role": "MECH ASST",
    "department": "WORKSHOP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-664",
    "sourceId": "B2-793",
    "name": "BINU VIJAYAN",
    "initials": "BV",
    "role": "MECHANIC",
    "department": "WORKSHOP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-665",
    "sourceId": "B2-702",
    "name": "CHANDRA BAHADUR",
    "initials": "CB",
    "role": "SECURITY",
    "department": "WORKSHOP AUG 2026",
    "availability": "Present",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-666",
    "sourceId": "B1-151",
    "name": "CHHOTTELAL SINGH",
    "initials": "CS",
    "role": "HELPER",
    "department": "WORKSHOP AUG 2026",
    "availability": "Present",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-667",
    "sourceId": "B2-132",
    "name": "VINODU DIVAKARAN /DEELU",
    "initials": "VD",
    "role": "WELDER",
    "department": "WORKSHOP AUG 2026",
    "availability": "Present",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-668",
    "sourceId": "B1-232",
    "name": "DEEPAK KUMAR SINGH",
    "initials": "DK",
    "role": "HELPER",
    "department": "WORKSHOP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-669",
    "sourceId": "B1-233",
    "name": "DEV KUMAR",
    "initials": "DK",
    "role": "YARD HELPER",
    "department": "WORKSHOP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-670",
    "sourceId": "B2-1234",
    "name": "DIVIN BILLAVA RAVI BILLAVA UGGAPPA",
    "initials": "DB",
    "role": "ELECTRICIAN",
    "department": "WORKSHOP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-671",
    "sourceId": "B2-716",
    "name": "DIP NARAYAN YADAV",
    "initials": "DN",
    "role": "SECURITY",
    "department": "WORKSHOP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-672",
    "sourceId": "B2-1103",
    "name": "DIBIN SURESH",
    "initials": "DS",
    "role": "MECHANIC",
    "department": "WORKSHOP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-673",
    "sourceId": "B2-991",
    "name": "GANESH SURESH",
    "initials": "GS",
    "role": "TECHNCIAN",
    "department": "WORKSHOP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-674",
    "sourceId": "B1-293",
    "name": "GURPREET SINGH KARNAIL SINGH",
    "initials": "GS",
    "role": "WELDER",
    "department": "WORKSHOP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-675",
    "sourceId": "B2-240",
    "name": "HANSRAJ",
    "initials": "H",
    "role": "HELPER",
    "department": "WORKSHOP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-676",
    "sourceId": "B1-288",
    "name": "HARI THARANATH",
    "initials": "HT",
    "role": "WELDER",
    "department": "WORKSHOP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-677",
    "sourceId": "B2-448",
    "name": "HAREESH SASIDHARAN",
    "initials": "HS",
    "role": "ELECTRICIAN",
    "department": "WORKSHOP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-678",
    "sourceId": "B2-325",
    "name": "IMRAN ALI",
    "initials": "IA",
    "role": "ELECTRICIAN",
    "department": "WORKSHOP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-679",
    "sourceId": "B3-108",
    "name": "IMRAN BEG",
    "initials": "IB",
    "role": "MECH HELPER",
    "department": "WORKSHOP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-680",
    "sourceId": "B1-270",
    "name": "IMBRAN SIRAJ AHMED",
    "initials": "IS",
    "role": "TECHNCIAN",
    "department": "WORKSHOP AUG 2026",
    "availability": "Off-Site",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-681",
    "sourceId": "B2-152",
    "name": "JAGAN ABRAHAM",
    "initials": "JA",
    "role": "MECHANIC",
    "department": "WORKSHOP AUG 2026",
    "availability": "Present",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-682",
    "sourceId": "B2-255",
    "name": "JAYAKRISHNAN",
    "initials": "J",
    "role": "MECHANIC",
    "department": "WORKSHOP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-683",
    "sourceId": "B2-595",
    "name": "JITHU VIJAYAN",
    "initials": "JV",
    "role": "MECHANIC ASST",
    "department": "WORKSHOP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-684",
    "sourceId": "B2-1087",
    "name": "JITENDRA SAH BIKRAMA",
    "initials": "JS",
    "role": "MECHANIC",
    "department": "WORKSHOP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-685",
    "sourceId": "B3-110",
    "name": "KRISHNAKUMAR",
    "initials": "K",
    "role": "PAINTER",
    "department": "WORKSHOP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-686",
    "sourceId": "B1-286",
    "name": "LAKHINDRA KUMAR THAKUR",
    "initials": "LK",
    "role": "KICHEN HELPER",
    "department": "WORKSHOP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-687",
    "sourceId": "B2-920",
    "name": "MANSINGH",
    "initials": "M",
    "role": "SECURITY",
    "department": "WORKSHOP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-688",
    "sourceId": "B2-906",
    "name": "MAHESH PV",
    "initials": "MP",
    "role": "DENTER CUM WELDER",
    "department": "WORKSHOP AUG 2026",
    "availability": "Present",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-689",
    "sourceId": "B2-1008",
    "name": "MAHESH KUMAR MOHANAN UANNITHAN",
    "initials": "MK",
    "role": "WELDER",
    "department": "WORKSHOP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-690",
    "sourceId": "B2-1152",
    "name": "MADAN KUMAR YADAV",
    "initials": "MK",
    "role": "CAR WASH CLEANER",
    "department": "WORKSHOP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-691",
    "sourceId": "B2-1138",
    "name": "MANILAL RAVI PUTHEN KALEECKAL",
    "initials": "MR",
    "role": "MECHANIC ASSI",
    "department": "WORKSHOP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-692",
    "sourceId": "B1-296",
    "name": "MANOJ THULASEEDHARAN",
    "initials": "MT",
    "role": "SECURITY",
    "department": "WORKSHOP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-693",
    "sourceId": "B2-930",
    "name": "MD SHAHZAD ALI",
    "initials": "MS",
    "role": "AUTO ELECTRICIAN",
    "department": "WORKSHOP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-694",
    "sourceId": "B2-1112",
    "name": "MOHAMMED ABDUL RAHMAN",
    "initials": "MA",
    "role": "ELECTRICIAN",
    "department": "WORKSHOP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-695",
    "sourceId": "B2-426",
    "name": "MOHAMMAD RAFIQ",
    "initials": "MR",
    "role": "TYREMAN",
    "department": "WORKSHOP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-696",
    "sourceId": "B1-237",
    "name": "MOHAMAD IMRAN GULAM HUSEN",
    "initials": "MI",
    "role": "PAINTER",
    "department": "WORKSHOP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-697",
    "sourceId": "B1-257",
    "name": "MOHAMMAD ANEES",
    "initials": "MA",
    "role": "MECHANIC",
    "department": "WORKSHOP AUG 2026",
    "availability": "Present",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-698",
    "sourceId": "B2-411",
    "name": "MUHAMED IBRAR",
    "initials": "MI",
    "role": "ELECTRICIAN",
    "department": "WORKSHOP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-699",
    "sourceId": "B1-128",
    "name": "MUHAMMEDKUNHI",
    "initials": "M",
    "role": "COOK",
    "department": "WORKSHOP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-700",
    "sourceId": "B2-869",
    "name": "MD NAJIM",
    "initials": "MN",
    "role": "HELPER",
    "department": "WORKSHOP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-701",
    "sourceId": "B2-1017",
    "name": "MD MEENHAZ ALAM",
    "initials": "MM",
    "role": "AUTO ELECTRICIAN",
    "department": "WORKSHOP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-702",
    "sourceId": "B2-108",
    "name": "CHEEROTH KUMARAN NANDANAN",
    "initials": "CK",
    "role": "MECHANIC",
    "department": "WORKSHOP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-703",
    "sourceId": "B2-368",
    "name": "NAIMULLAH ANSARI",
    "initials": "NA",
    "role": "TYREMAN",
    "department": "WORKSHOP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-704",
    "sourceId": "B2-331",
    "name": "NILESH SURESH",
    "initials": "NS",
    "role": "MECHANIC",
    "department": "WORKSHOP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-705",
    "sourceId": "B2-404",
    "name": "OSMAN",
    "initials": "O",
    "role": "HELPER",
    "department": "WORKSHOP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-706",
    "sourceId": "B2-656",
    "name": "PIYUSH KUMAR",
    "initials": "PK",
    "role": "ELECTRICIAN",
    "department": "WORKSHOP AUG 2026",
    "availability": "Present",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-707",
    "sourceId": "B2-433",
    "name": "PRASAD",
    "initials": "P",
    "role": "MECHANIC",
    "department": "WORKSHOP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-708",
    "sourceId": "B1-188",
    "name": "PRAMOD",
    "initials": "P",
    "role": "WELDER",
    "department": "WORKSHOP AUG 2026",
    "availability": "Present",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-709",
    "sourceId": "B2-1151",
    "name": "PRADEEP KUMAR",
    "initials": "PK",
    "role": "PAINTER",
    "department": "WORKSHOP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-710",
    "sourceId": "B2-1105",
    "name": "RAHUL KIZHAKKOODAN SADANANAN",
    "initials": "RK",
    "role": "MECHANIC ASST",
    "department": "WORKSHOP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-711",
    "sourceId": "B2-1172",
    "name": "RAGESH VASUDEVAN KUNJU",
    "initials": "RV",
    "role": "COOK",
    "department": "WORKSHOP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-712",
    "sourceId": "B2-1044",
    "name": "RAGHU VIRAKANTE CHANDU",
    "initials": "RV",
    "role": "SECURITY",
    "department": "WORKSHOP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-713",
    "sourceId": "B2-121",
    "name": "RAJEEV RAMACHANDRAN",
    "initials": "RR",
    "role": "MECHANIC",
    "department": "WORKSHOP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-714",
    "sourceId": "B2-141",
    "name": "RAJESH",
    "initials": "R",
    "role": "ELECTRICIAN",
    "department": "WORKSHOP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-715",
    "sourceId": "B1-278",
    "name": "RAJENDRA SAYRA NARAYAN",
    "initials": "RS",
    "role": "TYREMAN",
    "department": "WORKSHOP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-716",
    "sourceId": "B2-1222",
    "name": "RAJESH RAJAN",
    "initials": "RR",
    "role": "MECHANIC",
    "department": "WORKSHOP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-717",
    "sourceId": "B1-185",
    "name": "RAJESH SAH",
    "initials": "RS",
    "role": "COOK HELPER",
    "department": "WORKSHOP AUG 2026",
    "availability": "Present",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-718",
    "sourceId": "B1-162",
    "name": "RAM NATH SAH",
    "initials": "RN",
    "role": "HELPER",
    "department": "WORKSHOP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-719",
    "sourceId": "B1-191",
    "name": "REJI JOHN",
    "initials": "RJ",
    "role": "COOK",
    "department": "WORKSHOP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-720",
    "sourceId": "B2-1201",
    "name": "REJIN SUDHAKARAN",
    "initials": "RS",
    "role": "AUTO ELECTRICIAN",
    "department": "WORKSHOP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-721",
    "sourceId": "B2-471",
    "name": "RENJITH RAMACHANDRAN",
    "initials": "RR",
    "role": "ELEC HELPER",
    "department": "WORKSHOP AUG 2026",
    "availability": "Present",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-722",
    "sourceId": "B2-256",
    "name": "RIZWAN",
    "initials": "R",
    "role": "MECHANIC",
    "department": "WORKSHOP AUG 2026",
    "availability": "Present",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-723",
    "sourceId": "B2-160",
    "name": "ROOPESH",
    "initials": "R",
    "role": "ELECTRICIAN",
    "department": "WORKSHOP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-724",
    "sourceId": "B3-117",
    "name": "ROY GEEVARGHESE",
    "initials": "RG",
    "role": "WELDER ASSISTANT",
    "department": "WORKSHOP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-725",
    "sourceId": "B2-908",
    "name": "SABARI KRISHNAN",
    "initials": "SK",
    "role": "TECHNCIAN",
    "department": "WORKSHOP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-726",
    "sourceId": "B1-198",
    "name": "SADURAL HAQE",
    "initials": "SH",
    "role": "PAINTER",
    "department": "WORKSHOP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-727",
    "sourceId": "B2-351",
    "name": "SAJEEV BABY",
    "initials": "SB",
    "role": "HELPER",
    "department": "WORKSHOP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-728",
    "sourceId": "B2-784",
    "name": "SAJEEV SASIDHARAN",
    "initials": "SS",
    "role": "MECHANIC",
    "department": "WORKSHOP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-729",
    "sourceId": "B2-535",
    "name": "SASEENDRAN BALAKRISHNAN",
    "initials": "SB",
    "role": "COOK",
    "department": "WORKSHOP AUG 2026",
    "availability": "Present",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-730",
    "sourceId": "B1-291",
    "name": "SATHYAN ANANDAN",
    "initials": "SA",
    "role": "SECURITY",
    "department": "WORKSHOP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-731",
    "sourceId": "B2-515",
    "name": "SAYANTH CHOLAKKAL",
    "initials": "SC",
    "role": "MECH HELPER",
    "department": "WORKSHOP AUG 2026",
    "availability": "Present",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-732",
    "sourceId": "B2-771",
    "name": "SAYEED AKHTAR ABDUL",
    "initials": "SA",
    "role": "MEC ASS",
    "department": "WORKSHOP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-733",
    "sourceId": "B2-1120",
    "name": "SHALGY KALLINGAL SREENIVASAN",
    "initials": "SK",
    "role": "TYREMAN",
    "department": "WORKSHOP AUG 2026",
    "availability": "Present",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-734",
    "sourceId": "B2-226",
    "name": "SHAN GEORGE",
    "initials": "SG",
    "role": "ELECTRICIAN",
    "department": "WORKSHOP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-735",
    "sourceId": "B2-439",
    "name": "SHAJIN SHAJI",
    "initials": "SS",
    "role": "ELECTRICIAN",
    "department": "WORKSHOP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-736",
    "sourceId": "B2-519",
    "name": "SHIBU GOPINADHAN NAIR",
    "initials": "SG",
    "role": "SECURITY",
    "department": "WORKSHOP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-737",
    "sourceId": "B2-1207",
    "name": "SIBIN SAJEEVLAL",
    "initials": "SS",
    "role": "AUTO ELECTRICIAN",
    "department": "WORKSHOP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-738",
    "sourceId": "B1-213",
    "name": "SINOD SREEDHARAN",
    "initials": "SS",
    "role": "MECHANIC",
    "department": "WORKSHOP AUG 2026",
    "availability": "Present",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-739",
    "sourceId": "B2-270",
    "name": "SREEJITH SREEDHARAN PILLAI",
    "initials": "SS",
    "role": "MECHANIC",
    "department": "WORKSHOP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-740",
    "sourceId": "B2-873",
    "name": "SREERAG VISWAMBHARAN",
    "initials": "SV",
    "role": "SECURITY",
    "department": "WORKSHOP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-741",
    "sourceId": "B2-369",
    "name": "SUDHEESH SUNIL",
    "initials": "SS",
    "role": "HELPER",
    "department": "WORKSHOP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-742",
    "sourceId": "B2-202",
    "name": "SUNIL KUMAR CHELLAPPAN",
    "initials": "SK",
    "role": "MECHANIC",
    "department": "WORKSHOP AUG 2026",
    "availability": "Present",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-743",
    "sourceId": "B3-124",
    "name": "SUNEESH KUMAR",
    "initials": "SK",
    "role": "Rigger - CONVERTED",
    "department": "WORKSHOP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-744",
    "sourceId": "B2-114",
    "name": "SURAJ SUBRAMANIAN",
    "initials": "SS",
    "role": "MECHANIC",
    "department": "WORKSHOP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-745",
    "sourceId": "B2-926",
    "name": "SURESH THELU",
    "initials": "ST",
    "role": "AUTO ELECTRICIAN",
    "department": "WORKSHOP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-746",
    "sourceId": "B2-1189",
    "name": "SURESH DAMODARAN PILLAI",
    "initials": "SD",
    "role": "SECURITY",
    "department": "WORKSHOP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-747",
    "sourceId": "B2-1143",
    "name": "SUJESH SUKUMARAN",
    "initials": "SS",
    "role": "PAINTER",
    "department": "WORKSHOP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-748",
    "sourceId": "B1-261",
    "name": "SYAMKUMAR KANNAN",
    "initials": "SK",
    "role": "KICHEN HELPER",
    "department": "WORKSHOP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-749",
    "sourceId": "B2-1241",
    "name": "TINTU RAJ PUSHPA RAJAN",
    "initials": "TR",
    "role": "ASSISTANT MECHANIC",
    "department": "WORKSHOP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-750",
    "sourceId": "B3-114",
    "name": "UJENDRA SINGH",
    "initials": "US",
    "role": "WELDER",
    "department": "WORKSHOP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-751",
    "sourceId": "B2-835",
    "name": "UNNIMON",
    "initials": "U",
    "role": "AUTO ELECTRICIAN",
    "department": "WORKSHOP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-752",
    "sourceId": "B2-1038",
    "name": "VIGNESH RAMCHANDRAN",
    "initials": "VR",
    "role": "MECHANIC",
    "department": "WORKSHOP AUG 2026",
    "availability": "Present",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-753",
    "sourceId": "B3-111",
    "name": "VIJAYAN CHAMY",
    "initials": "VC",
    "role": "COOK",
    "department": "WORKSHOP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-754",
    "sourceId": "B1-196",
    "name": "VINOD VIJAYA KUMAR",
    "initials": "VV",
    "role": "LV MECHANIC",
    "department": "WORKSHOP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-755",
    "sourceId": "B2-974",
    "name": "VIKASH KUMAR SAH",
    "initials": "VK",
    "role": "CAR WASH",
    "department": "WORKSHOP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-756",
    "sourceId": "B2-264",
    "name": "VIPIN",
    "initials": "V",
    "role": "WELDER",
    "department": "WORKSHOP AUG 2026",
    "availability": "Present",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-757",
    "sourceId": "B2-1156",
    "name": "WANG PENG",
    "initials": "WP",
    "role": "MECHANIC ASSI",
    "department": "WORKSHOP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-758",
    "sourceId": "B1-137",
    "name": "YOUSUF",
    "initials": "Y",
    "role": "HELPER",
    "department": "WORKSHOP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-759",
    "sourceId": "B2-461",
    "name": "ZHOU YANCHAO",
    "initials": "ZY",
    "role": "ELECTRICIAN",
    "department": "WORKSHOP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-760",
    "sourceId": "B2-979",
    "name": "ABDUL GHAFOOR KHAN",
    "initials": "AG",
    "role": "LV DRIVER",
    "department": "WORKSHOP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-761",
    "sourceId": "B2-1029",
    "name": "ABDUL KHADAR",
    "initials": "AK",
    "role": "LV DRIVER",
    "department": "WORKSHOP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-762",
    "sourceId": "B2-539",
    "name": "AKHIL HARI",
    "initials": "AH",
    "role": "LV DRIVER",
    "department": "WORKSHOP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-763",
    "sourceId": "B2-799",
    "name": "AJIT KUMAR",
    "initials": "AK",
    "role": "LV DRIVER",
    "department": "WORKSHOP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-764",
    "sourceId": "B2-263",
    "name": "ARUN KUMAR",
    "initials": "AK",
    "role": "LV DRIVER",
    "department": "WORKSHOP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-765",
    "sourceId": "B2-845",
    "name": "BHOJ",
    "initials": "B",
    "role": "LV DRIVER",
    "department": "WORKSHOP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-766",
    "sourceId": "B2-474",
    "name": "BIBIN BABU",
    "initials": "BB",
    "role": "LV DRIVER",
    "department": "WORKSHOP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-767",
    "sourceId": "B2-673",
    "name": "DAVINDER SINGH",
    "initials": "DS",
    "role": "LV DRIVER",
    "department": "WORKSHOP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-768",
    "sourceId": "B2-118",
    "name": "DHANEESH",
    "initials": "D",
    "role": "LV DRIVER",
    "department": "WORKSHOP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-769",
    "sourceId": "B2-927",
    "name": "GAJENDRA SINGH",
    "initials": "GS",
    "role": "LV DRIVER",
    "department": "WORKSHOP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-770",
    "sourceId": "B1-254",
    "name": "GNANESHWAR JUNGALA NARENDAR JUNGALA",
    "initials": "GJ",
    "role": "LV DRIVER",
    "department": "WORKSHOP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-771",
    "sourceId": "B1-306",
    "name": "GURJOT SINGH SWINDERJIT SINGH",
    "initials": "GS",
    "role": "LV DRIVER",
    "department": "WORKSHOP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-772",
    "sourceId": "B2-1237",
    "name": "GURPREET SINGH",
    "initials": "GS",
    "role": "LV DRIVER",
    "department": "WORKSHOP AUG 2026",
    "availability": "Present",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-773",
    "sourceId": "B3-129",
    "name": "GURPREET SINGH",
    "initials": "GS",
    "role": "LV DRIVER",
    "department": "WORKSHOP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-774",
    "sourceId": "B2-975",
    "name": "GURPREET SINGH SURINDER SINGH",
    "initials": "GS",
    "role": "LV DRIVER",
    "department": "WORKSHOP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-775",
    "sourceId": "B3-116",
    "name": "HARBANS SINGH",
    "initials": "HS",
    "role": "LV DRIVER",
    "department": "WORKSHOP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-776",
    "sourceId": "B2-1164",
    "name": "JAIMAL SINGH BHAGAWAN SING",
    "initials": "JS",
    "role": "LV DRIVER",
    "department": "WORKSHOP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-777",
    "sourceId": "B2-987",
    "name": "LATHEEFA BEEVI NAJEEM",
    "initials": "LB",
    "role": "LV DRIVER",
    "department": "WORKSHOP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-778",
    "sourceId": "B1-210",
    "name": "MAHID",
    "initials": "M",
    "role": "LV DRIVER",
    "department": "WORKSHOP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-779",
    "sourceId": "B2-1239",
    "name": "MANISH KUMAR SHARMA",
    "initials": "MK",
    "role": "LV DRIVER",
    "department": "WORKSHOP AUG 2026",
    "availability": "Present",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-780",
    "sourceId": "B3-109",
    "name": "MATHAI KUTTY",
    "initials": "MK",
    "role": "LV DRIVER",
    "department": "WORKSHOP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-781",
    "sourceId": "B2-896",
    "name": "MOHAN KUMAR",
    "initials": "MK",
    "role": "LV DRIVER",
    "department": "WORKSHOP AUG 2026",
    "availability": "On Leave",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-782",
    "sourceId": "B2-1238",
    "name": "MIDHUN SHAJI BALAN",
    "initials": "MS",
    "role": "LV DRIVER",
    "department": "WORKSHOP AUG 2026",
    "availability": "Present",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-783",
    "sourceId": "B2-978",
    "name": "MUNISH KUMAR YODH RAJ",
    "initials": "MK",
    "role": "LV DRIVER",
    "department": "WORKSHOP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-784",
    "sourceId": "B2-634",
    "name": "NAVEEN VIDIYALA",
    "initials": "NV",
    "role": "LV DRIVER",
    "department": "WORKSHOP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-785",
    "sourceId": "B2-231",
    "name": "PRAMOD GOPALAKRISHNA",
    "initials": "PG",
    "role": "LV DRIVER",
    "department": "WORKSHOP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-786",
    "sourceId": "B1-199",
    "name": "RENDHEER SOMARAJAN",
    "initials": "RS",
    "role": "LV DRIVER",
    "department": "WORKSHOP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-787",
    "sourceId": "B2-542",
    "name": "RENJITH NAIR SADASIVAN",
    "initials": "RN",
    "role": "LV DRIVER",
    "department": "WORKSHOP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-788",
    "sourceId": "B2-990",
    "name": "SAJIMON JAMALUDHEEN",
    "initials": "SJ",
    "role": "LV DRIVER",
    "department": "WORKSHOP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-789",
    "sourceId": "B2-254",
    "name": "SAJITH THULASEEDARAN PILLAI",
    "initials": "ST",
    "role": "LV DRIVER",
    "department": "WORKSHOP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-790",
    "sourceId": "B1-308",
    "name": "SANDEEP JAKKU PAPAIAH JAAKU",
    "initials": "SJ",
    "role": "LV DRIVER",
    "department": "WORKSHOP AUG 2026",
    "availability": "Present",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-791",
    "sourceId": "B2-151",
    "name": "SANTHOSH KUMAR",
    "initials": "SK",
    "role": "LV DRIVER",
    "department": "WORKSHOP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-792",
    "sourceId": "B2-279",
    "name": "SHAJI BALAN UNNITHAN",
    "initials": "SB",
    "role": "LV DRIVER",
    "department": "WORKSHOP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-793",
    "sourceId": "B2-508",
    "name": "SHIJU VAYAKODAN",
    "initials": "SV",
    "role": "LV DRIVER",
    "department": "WORKSHOP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-794",
    "sourceId": "B2 875",
    "name": "SHUBAM KUMAR",
    "initials": "SK",
    "role": "LV DRIVER",
    "department": "WORKSHOP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-795",
    "sourceId": "B1-115",
    "name": "SREEJITH SIVASANKARA",
    "initials": "SS",
    "role": "LV DRIVER",
    "department": "WORKSHOP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-796",
    "sourceId": "B2-507",
    "name": "SUBASH",
    "initials": "S",
    "role": "LV DRIVER",
    "department": "WORKSHOP AUG 2026",
    "availability": "Present",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-797",
    "sourceId": "B1-264",
    "name": "SUBESH SADANANDAN PILLAIN",
    "initials": "SS",
    "role": "LV DRIVER",
    "department": "WORKSHOP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-798",
    "sourceId": "B1-247",
    "name": "SWAMY ABBARAVENI",
    "initials": "SA",
    "role": "LV DRIVER",
    "department": "WORKSHOP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-799",
    "sourceId": "B3-136",
    "name": "TARNJIT SINGH MOHINDER SINGH",
    "initials": "TS",
    "role": "LV DRIVER",
    "department": "WORKSHOP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-800",
    "sourceId": "B2-516",
    "name": "UMMER FAROOQUE",
    "initials": "UF",
    "role": "LV DRIVER",
    "department": "WORKSHOP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-801",
    "sourceId": "B1-302",
    "name": "VIPIN RAJ PUTHIYATHARAYIL",
    "initials": "VR",
    "role": "LV DRIVER",
    "department": "WORKSHOP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-802",
    "sourceId": "B1-126",
    "name": "SAYED MUDASIR ALI",
    "initials": "SM",
    "role": "LV DRIVER",
    "department": "WORKSHOP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-803",
    "sourceId": "B2-1081",
    "name": "WASIM AKRAM MANIR ALAM",
    "initials": "WA",
    "role": "LV DRIVER",
    "department": "WORKSHOP AUG 2026",
    "availability": "Assigned",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-804",
    "sourceId": "B1-297",
    "name": "MAQSOOD AHMED",
    "initials": "MA",
    "role": "CRANE OPERATOR",
    "department": "WORKSHOP AUG 2026",
    "availability": "Present",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-805",
    "sourceId": "B2-837",
    "name": "ABHILASH RAJEEV",
    "initials": "AR",
    "role": "OFFICE STAFF",
    "department": "WORKSHOP AUG 2026",
    "availability": "Present",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-806",
    "sourceId": "B2-1126",
    "name": "ABI AJITH AJITH KUMAR",
    "initials": "AA",
    "role": "MED LEAVE",
    "department": "OFFICE AUG 2026",
    "availability": "Off-Site",
    "cert": "Training register check required",
    "flag": false
  },
  {
    "id": "att-807",
    "sourceId": "B2-714",
    "name": "SUDHEESH MOHAN",
    "initials": "SM",
    "role": "MED LEAVE",
    "department": "OFFICE AUG 2026",
    "availability": "Present",
    "cert": "Training register check required",
    "flag": false
  }
];

// shared/crewAssignmentRoster.ts
var LEGACY_CREW_ASSIGNMENT_ROSTER = [
  { id: "cr-1", sourceId: "legacy-cr-1", name: "Vineeth Vijayan", role: "Crane Operator", availability: "Present", cert: "Valid \xB7 12 Mar 2027", initials: "VV", flag: false, department: "Operational Crew" },
  { id: "cr-2", sourceId: "legacy-cr-2", name: "Anoop Panikashery", role: "Crane Operator", availability: "Assigned", cert: "Valid \xB7 09 Feb 2027", initials: "AP", flag: false, department: "Operational Crew" },
  { id: "cr-3", sourceId: "legacy-cr-3", name: "Vijayakumar", role: "Rigger", availability: "Present", cert: "Renewal due in 16 days", initials: "VK", flag: true, department: "Operational Crew" },
  { id: "cr-4", sourceId: "legacy-cr-4", name: "Amal Krishnan", role: "Rigger", availability: "Present", cert: "Valid \xB7 28 Nov 2026", initials: "AK", flag: false, department: "Operational Crew" },
  { id: "cr-5", sourceId: "legacy-cr-5", name: "Ramesh Babu", role: "Banksman", availability: "On Leave", cert: "Valid \xB7 10 Jan 2027", initials: "RB", flag: false, department: "Operational Crew" },
  { id: "cr-6", sourceId: "legacy-cr-6", name: "Shahid Khan", role: "Site Supervisor", availability: "Off-Site", cert: "Training required", initials: "SK", flag: true, department: "Operational Crew" }
];
var CREW_ASSIGNMENT_ROSTER = [
  ...LEGACY_CREW_ASSIGNMENT_ROSTER,
  ...ATTENDANCE_CREW_ROSTER
];
function isKnownCrewAssignmentMember(id, name) {
  return CREW_ASSIGNMENT_ROSTER.some((employee) => employee.id === id && employee.name === name);
}

// server/routers/operations.ts
import { TRPCError as TRPCError7 } from "@trpc/server";
import { z as z7 } from "zod";

// server/storage.ts
function getForgeConfig() {
  const forgeUrl = ENV.forgeApiUrl;
  const forgeKey = ENV.forgeApiKey;
  if (!forgeUrl || !forgeKey) {
    throw new Error(
      "Storage config missing: set BUILT_IN_FORGE_API_URL and BUILT_IN_FORGE_API_KEY"
    );
  }
  return { forgeUrl: forgeUrl.replace(/\/+$/, ""), forgeKey };
}
function normalizeKey(relKey) {
  return relKey.replace(/^\/+/, "");
}
function appendHashSuffix(relKey) {
  const hash = crypto.randomUUID().replace(/-/g, "").slice(0, 8);
  const lastDot = relKey.lastIndexOf(".");
  if (lastDot === -1) return `${relKey}_${hash}`;
  return `${relKey.slice(0, lastDot)}_${hash}${relKey.slice(lastDot)}`;
}
async function storagePut(relKey, data, contentType = "application/octet-stream") {
  const { forgeUrl, forgeKey } = getForgeConfig();
  const key = appendHashSuffix(normalizeKey(relKey));
  const presignUrl = new URL("v1/storage/presign/put", forgeUrl + "/");
  presignUrl.searchParams.set("path", key);
  const presignResp = await fetch(presignUrl, {
    headers: { Authorization: `Bearer ${forgeKey}` }
  });
  if (!presignResp.ok) {
    const msg = await presignResp.text().catch(() => presignResp.statusText);
    throw new Error(`Storage presign failed (${presignResp.status}): ${msg}`);
  }
  const { url: s3Url } = await presignResp.json();
  if (!s3Url) throw new Error("Forge returned empty presign URL");
  const blob = typeof data === "string" ? new Blob([data], { type: contentType }) : new Blob([data], { type: contentType });
  const uploadResp = await fetch(s3Url, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body: blob
  });
  if (!uploadResp.ok) {
    throw new Error(`Storage upload to S3 failed (${uploadResp.status})`);
  }
  return { key, url: `/manus-storage/${key}` };
}

// server/routers/operations.ts
var lifecycleStageDepartment = {
  "Documentation Supervisor": "sales",
  "Crew Assigned": "documentation",
  "Gear Confirmed": "crew",
  "Docs In Progress": "lifting-gears",
  "All Docs Submitted": "documentation",
  Reviewed: "sales",
  Dispatched: "sales"
};
var teamByDepartment = {
  sales: "Sales",
  documentation: "Documentation",
  hse: "HSE",
  accounts: "Accounts",
  administrator: "Operations Management",
  "lifting-gears": "Operations Management",
  maintenance: "Operations Management",
  crew: "Operations Management",
  hr: "Operations Management",
  transportation: "Operations Management"
};
var operationsRouter = router({
  seed: protectedProcedure.mutation(async () => {
    await seedInitialDataIfNeeded();
    return { success: true };
  }),
  getBookings: protectedProcedure.query(async () => {
    await seedInitialDataIfNeeded();
    return await getAllBookings();
  }),
  getBooking: protectedProcedure.input(z7.object({ id: z7.string() })).query(async ({ input }) => {
    return await getBookingById(input.id);
  }),
  createBooking: protectedProcedure.input(
    z7.object({
      id: z7.string(),
      clientName: z7.string(),
      projectName: z7.string(),
      projectManager: z7.string(),
      lpoReference: z7.string(),
      mobilizationDate: z7.string(),
      offHireDate: z7.string(),
      clientContactName: z7.string(),
      clientEmail: z7.string(),
      clientPhone: z7.string(),
      priority: z7.string(),
      stage: z7.string(),
      craneId: z7.string().optional(),
      crewIds: z7.array(z7.string()).optional(),
      gearIds: z7.array(z7.string()).optional(),
      trailerIds: z7.array(z7.string()).optional()
    })
  ).mutation(async ({ ctx, input }) => {
    requireDepartmentAccess(ctx.user, "sales");
    return await createBooking(input);
  }),
  updateStage: protectedProcedure.input(z7.object({ id: z7.string(), stage: z7.string() })).mutation(async ({ ctx, input }) => {
    requireDepartmentAccess(ctx.user, "sales");
    return await updateBookingStage(input.id, input.stage);
  }),
  advanceBookingStage: protectedProcedure.input(
    z7.object({
      id: z7.string(),
      currentStage: z7.enum(BOOKING_STAGES),
      nextStage: z7.enum(BOOKING_STAGES)
    })
  ).mutation(async ({ ctx, input }) => {
    const currentStage = input.currentStage;
    const nextStage = input.nextStage;
    const department = lifecycleStageDepartment[nextStage];
    if (!department)
      throw new TRPCError7({
        code: "BAD_REQUEST",
        message: "That lifecycle stage has no owning department."
      });
    requireDepartmentAccess(ctx.user, department);
    const booking = await getBookingById(input.id);
    let transition;
    try {
      transition = transitionBooking(
        currentStage,
        nextStage,
        STAGE_ROLES[nextStage]
      );
    } catch (error) {
      throw new TRPCError7({
        code: "BAD_REQUEST",
        message: error instanceof Error ? error.message : "The lifecycle transition is not valid."
      });
    }
    const updated = booking ? await updateBookingStage(input.id, transition.stage) : { id: input.id, stage: transition.stage };
    const timestamp2 = Date.now();
    await Promise.all(
      transition.notifications.map(
        (notification, index) => addNotification({
          id: `lifecycle-${input.id}-${timestamp2}-${index}`,
          userId: null,
          departmentCode: notification.departmentCode ?? department,
          title: notification.title,
          body: `${notification.body} \xB7 ${input.id}`
        })
      )
    );
    return {
      booking: updated,
      stage: transition.stage,
      notifications: transition.notifications
    };
  }),
  completeBookingWorkstream: protectedProcedure.input(
    z7.object({
      id: z7.string(),
      workstream: z7.enum(["maintenance", "hse", "accounts", "hr", "transportation"]),
      stage: z7.enum(BOOKING_STAGES)
    })
  ).mutation(async ({ ctx, input }) => {
    const workstreamDepartment = {
      maintenance: "maintenance",
      hse: "hse",
      accounts: "accounts",
      hr: "hr",
      transportation: "transportation"
    };
    const department = workstreamDepartment[input.workstream];
    requireDepartmentAccess(ctx.user, department);
    await getBookingById(input.id);
    await addNotification({
      id: `workstream-${input.id}-${input.workstream}-${Date.now()}`,
      userId: null,
      departmentCode: "documentation",
      title: `${input.workstream} workstream complete`,
      body: `${department} confirmed its evidence for ${input.id}. Documentation can review the parallel readiness queue.`
    });
    return {
      id: input.id,
      workstream: input.workstream,
      stage: input.stage,
      departmentCode: department
    };
  }),
  updateAssignment: protectedProcedure.input(
    z7.object({
      id: z7.string(),
      craneId: z7.string().optional(),
      crewIds: z7.array(z7.string()).optional(),
      gearIds: z7.array(z7.string()).optional(),
      trailerIds: z7.array(z7.string()).optional()
    })
  ).mutation(async ({ ctx, input }) => {
    requireDepartmentAccess(ctx.user, "documentation");
    return await updateBookingAssignment(input.id, input);
  }),
  getCrewAllocations: protectedProcedure.query(async () => {
    await seedInitialDataIfNeeded();
    return await listBookingCrewAllocations();
  }),
  saveCrewAllocations: protectedProcedure.input(
    z7.object({
      crewId: z7.string(),
      crewName: z7.string().min(1),
      bookingIds: z7.array(z7.string()).max(20)
    })
  ).mutation(async ({ ctx, input }) => {
    requireDepartmentAccess(ctx.user, "crew");
    const crewList = await getAllCrew();
    if (!crewList.some(
      (member) => member.id === input.crewId && member.name === input.crewName
    ) && !isKnownCrewAssignmentMember(input.crewId, input.crewName)) {
      throw new TRPCError7({
        code: "BAD_REQUEST",
        message: "That employee is not in the persisted crew roster."
      });
    }
    for (const bookingId of input.bookingIds) {
      if (!await getBookingById(bookingId)) {
        throw new TRPCError7({
          code: "BAD_REQUEST",
          message: `Booking ${bookingId} is not available for persisted allocation.`
        });
      }
    }
    const allocations = await replaceCrewBookingAllocations({
      ...input,
      assignedBy: ctx.user.id
    });
    return { allocations };
  }),
  getEquipment: protectedProcedure.query(async () => {
    await seedInitialDataIfNeeded();
    return await getAllEquipment();
  }),
  getCrew: protectedProcedure.query(async () => {
    await seedInitialDataIfNeeded();
    return await getAllCrew();
  }),
  getGears: protectedProcedure.query(async () => {
    await seedInitialDataIfNeeded();
    return await getAllLiftingGears();
  }),
  uploadGearDocument: protectedProcedure.input(
    z7.object({
      fileName: z7.string().trim().min(1).max(180),
      contentType: z7.string().trim().max(120).default("application/octet-stream"),
      base64: z7.string().min(1).max(1e7)
    })
  ).mutation(async ({ ctx, input }) => {
    requireDepartmentAccess(ctx.user, "lifting-gears");
    const allowedTypes = /* @__PURE__ */ new Set([
      "application/pdf",
      "image/jpeg",
      "image/png",
      "image/webp",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ]);
    const contentType = allowedTypes.has(input.contentType) ? input.contentType : "application/octet-stream";
    const bytes = Buffer.from(input.base64, "base64");
    if (!bytes.length || bytes.length > 75e5) {
      throw new TRPCError7({
        code: "BAD_REQUEST",
        message: "Each lifting-gear document must be between 1 byte and 7.5 MB."
      });
    }
    const safeName = input.fileName.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/, "") || "gear-document";
    const { key, url } = await storagePut(
      `lifting-gears/${ctx.user.id}/${Date.now()}-${safeName}`,
      bytes,
      contentType
    );
    return {
      key,
      url,
      name: input.fileName,
      contentType,
      size: bytes.length
    };
  }),
  getTrailers: protectedProcedure.query(async () => {
    await seedInitialDataIfNeeded();
    return await getAllTrailers();
  }),
  getDocuments: protectedProcedure.input(z7.object({ bookingId: z7.string() })).query(async ({ input }) => {
    return await getDocumentsForBooking(input.bookingId);
  }),
  upsertDocument: protectedProcedure.input(
    z7.object({
      id: z7.string(),
      bookingId: z7.string(),
      departmentCode: z7.string(),
      name: z7.string(),
      state: z7.string(),
      expiryDate: z7.string().optional(),
      required: z7.number()
    })
  ).mutation(async ({ ctx, input }) => {
    const departmentByDocumentCode = {
      documentation: "documentation",
      hse: "hse",
      crew: "crew",
      accounts: "accounts",
      "lifting-gears": "lifting-gears",
      transportation: "transportation"
    };
    const departmentCode = departmentByDocumentCode[input.departmentCode];
    if (departmentCode) requireDepartmentAccess(ctx.user, departmentCode);
    return await upsertDocument(input);
  }),
  getChat: protectedProcedure.input(z7.object({ bookingId: z7.string() })).query(async ({ input }) => {
    return await getChatForBooking(input.bookingId);
  }),
  addChat: protectedProcedure.input(
    z7.object({
      id: z7.string(),
      bookingId: z7.string(),
      team: z7.string(),
      sender: z7.string(),
      body: z7.string()
    })
  ).mutation(async ({ ctx, input }) => {
    const expectedTeam = ctx.user.role === "admin" ? input.team : teamByDepartment[ctx.user.departmentCode];
    if (ctx.user.role !== "admin" && (!expectedTeam || input.team !== expectedTeam)) {
      throw new TRPCError7({
        code: "FORBIDDEN",
        message: "Your department account cannot post as another team."
      });
    }
    return await addChatMessage({
      ...input,
      team: expectedTeam ?? input.team,
      sender: ctx.user.role === "admin" ? input.sender : ctx.user.name ?? ctx.user.email ?? "Department user"
    });
  }),
  getNotifications: protectedProcedure.input(z7.object({ departmentCode: z7.string().optional() }).optional()).query(async ({ ctx, input }) => {
    if (ctx.user.role !== "admin" && input?.departmentCode && input.departmentCode !== ctx.user.departmentCode) {
      throw new TRPCError7({
        code: "FORBIDDEN",
        message: "Your department account cannot access these notifications."
      });
    }
    return await getNotifications({
      departmentCode: ctx.user.role === "admin" ? input?.departmentCode : ctx.user.departmentCode ?? void 0,
      userId: ctx.user.id
    });
  }),
  addNotification: protectedProcedure.input(
    z7.object({
      id: z7.string(),
      departmentCode: z7.string().refine(isDepartmentCode, "Choose a valid department."),
      title: z7.string(),
      body: z7.string()
    })
  ).mutation(async ({ ctx, input }) => {
    if (ctx.user.role !== "admin")
      requireDepartmentAccess(
        ctx.user,
        input.departmentCode
      );
    return await addNotification(input);
  }),
  clearNotifications: protectedProcedure.input(z7.object({ departmentCode: z7.string().optional() }).optional()).mutation(async ({ ctx, input }) => {
    if (ctx.user.role !== "admin" && input?.departmentCode && input.departmentCode !== ctx.user.departmentCode) {
      throw new TRPCError7({
        code: "FORBIDDEN",
        message: "Your department account cannot clear these notifications."
      });
    }
    await markAllNotificationsRead({
      departmentCode: ctx.user.role === "admin" ? input?.departmentCode : ctx.user.departmentCode ?? void 0,
      userId: ctx.user.id
    });
    return { success: true };
  }),
  requestDispatchBundle: protectedProcedure.input(z7.object({ bookingId: z7.string().min(1) })).mutation(async ({ ctx, input }) => {
    requireDepartmentAccess(ctx.user, "sales");
    const booking = await getBookingById(input.bookingId);
    if (!booking)
      throw new TRPCError7({
        code: "NOT_FOUND",
        message: "The booking dossier could not be found."
      });
    if (booking.stage !== "Reviewed" && booking.stage !== "Dispatched") {
      throw new TRPCError7({
        code: "PRECONDITION_FAILED",
        message: "A dispatch bundle can be generated only after the dossier has been reviewed."
      });
    }
    const docs = await getDocumentsForBooking(input.bookingId);
    const outstanding = docs.filter(
      (document) => document.required === 1 && !["Uploaded", "Approved"].includes(document.state)
    );
    if (outstanding.length) {
      throw new TRPCError7({
        code: "PRECONDITION_FAILED",
        message: "Required documents are still incomplete, so the dispatch bundle is locked."
      });
    }
    await addUserActivity({
      userId: ctx.user.id,
      action: "dispatch_bundle_generated",
      detail: `${ctx.user.name ?? ctx.user.email ?? "Sales"} requested the dispatch PDF bundle for ${input.bookingId}.`
    });
    return { booking, documents: docs };
  })
});

// server/routers/monitoring.ts
import { TRPCError as TRPCError8 } from "@trpc/server";
import { z as z8 } from "zod";

// server/_core/rateLimiter.ts
var buckets = /* @__PURE__ */ new Map();
var CAPACITY = 30;
var REFILL_RATE_PER_SECOND = 5;
function checkTelemetryRateLimit(ipKey = "global-public") {
  const now = Date.now();
  let bucket = buckets.get(ipKey);
  if (!bucket) {
    bucket = { tokens: CAPACITY, lastRefill: now };
    buckets.set(ipKey, bucket);
  } else {
    const elapsedSeconds = (now - bucket.lastRefill) / 1e3;
    bucket.tokens = Math.min(CAPACITY, bucket.tokens + elapsedSeconds * REFILL_RATE_PER_SECOND);
    bucket.lastRefill = now;
  }
  if (bucket.tokens >= 1) {
    bucket.tokens -= 1;
    return true;
  }
  return false;
}

// shared/runtimeMonitoring.ts
function sanitizeRuntimeMessage(input, maxLength = 1e3) {
  return String(input ?? "Unknown runtime error").replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[redacted-email]").replace(/(bearer\s+|token=|password=|authorization:)[^\s&]+/gi, "$1[redacted]").replace(/\s+/g, " ").trim().slice(0, maxLength);
}
function runtimeErrorFingerprint(source, message, path) {
  const value = `${source}|${message}|${path}`;
  let hash = 5381;
  for (let index = 0; index < value.length; index += 1) hash = hash * 33 ^ value.charCodeAt(index);
  return `rt-${(hash >>> 0).toString(16)}`;
}

// server/routers/monitoring.ts
var monitoringRouter = router({
  runtimeErrors: router({
    capture: publicProcedure.input(z8.object({ source: z8.enum(["window.error", "unhandledrejection", "react.boundary"]), message: z8.string().min(1).max(2e3), path: z8.string().max(512) })).mutation(async ({ input, ctx }) => {
      if (!checkTelemetryRateLimit(ctx.user ? `user-${ctx.user.id}` : "public")) {
        throw new TRPCError8({ code: "TOO_MANY_REQUESTS", message: "Telemetry rate limit exceeded. Please try again later." });
      }
      const message = sanitizeRuntimeMessage(input.message);
      const path = sanitizeRuntimeMessage(input.path, 512) || "/";
      return await createRuntimeErrorEvent({ source: input.source, message, path, fingerprint: runtimeErrorFingerprint(input.source, message, path), userId: ctx.user?.id ?? null });
    }),
    list: adminProcedure.input(z8.object({ limit: z8.number().int().min(1).max(250).optional() }).optional()).query(async ({ input }) => await listRuntimeErrorEvents(input?.limit ?? 100))
  }),
  telemetry: router({
    capture: publicProcedure.input(z8.object({ metricName: z8.enum(["LCP", "FID", "CLS", "INP", "TTFB"]), metricValue: z8.string().min(1).max(64), path: z8.string().max(512) })).mutation(async ({ input, ctx }) => {
      if (!checkTelemetryRateLimit(ctx.user ? `user-${ctx.user.id}` : "public")) {
        throw new TRPCError8({ code: "TOO_MANY_REQUESTS", message: "Telemetry rate limit exceeded." });
      }
      const path = sanitizeRuntimeMessage(input.path, 512) || "/";
      return await createTelemetryEvent({ metricName: input.metricName, metricValue: input.metricValue, path, userId: ctx.user?.id ?? null });
    }),
    list: adminProcedure.input(z8.object({ limit: z8.number().int().min(1).max(500).optional() }).optional()).query(async ({ input }) => await listTelemetryEvents(input?.limit ?? 250))
  })
});

// server/routers/misc.ts
import { TRPCError as TRPCError9 } from "@trpc/server";
import { z as z9 } from "zod";
var miscRouter = router({
  filterPresets: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const presets = await listClientFilterPresets(ctx.user.id);
      return presets.map((p) => ({
        ...p,
        tags: JSON.parse(p.tagsJson || "[]")
      }));
    }),
    save: protectedProcedure.input(
      z9.object({
        id: z9.string().trim().max(64).optional(),
        name: z9.string().trim().min(1).max(128),
        category: z9.string().trim().max(128),
        tags: z9.array(z9.string().trim().max(128)),
        search: z9.string().trim().max(255)
      })
    ).mutation(async ({ ctx, input }) => {
      const saved = await saveClientFilterPreset({
        userId: ctx.user.id,
        id: input.id,
        name: input.name,
        category: input.category,
        tags: input.tags,
        search: input.search
      });
      return {
        ...saved,
        tags: JSON.parse(saved?.tagsJson || "[]")
      };
    }),
    delete: protectedProcedure.input(z9.object({ name: z9.string().trim().min(1).max(128) })).mutation(async ({ ctx, input }) => {
      await deleteClientFilterPreset(ctx.user.id, input.name);
      return { success: true };
    })
  }),
  clientFeedback: router({
    submit: publicProcedure.input(
      z9.object({
        bookingId: z9.string().trim().min(1).max(64),
        category: z9.enum(["Bug report", "Improvement", "Other"]),
        message: z9.string().trim().min(10).max(2e3),
        contactEmail: z9.string().trim().email().max(320).optional().or(z9.literal(""))
      })
    ).mutation(async ({ input }) => {
      const booking = await getBookingById(input.bookingId);
      if (!booking)
        throw new TRPCError9({
          code: "NOT_FOUND",
          message: "The associated booking could not be found."
        });
      const feedback = await createClientFeedback({
        bookingId: input.bookingId,
        category: input.category,
        message: input.message,
        contactEmail: input.contactEmail || null
      });
      return { success: true, feedbackId: feedback.id };
    }),
    list: adminProcedure.input(
      z9.object({ limit: z9.number().int().min(1).max(250).optional() }).optional()
    ).query(async ({ input }) => {
      return await listClientFeedback(input?.limit ?? 100);
    }),
    updateStatus: adminProcedure.input(
      z9.object({
        id: z9.string().min(1).max(64),
        status: z9.enum(["Open", "In review", "Resolved"])
      })
    ).mutation(async ({ input }) => {
      const feedback = await updateClientFeedbackStatus(
        input.id,
        input.status
      );
      if (!feedback)
        throw new TRPCError9({
          code: "NOT_FOUND",
          message: "Feedback report not found."
        });
      return feedback;
    })
  })
});

// server/routers.ts
seedInitialDataIfNeeded().catch(console.error);
var appRouter = router({
  system: systemRouter,
  auth: authRouter,
  departments: departmentsRouter,
  documents: documentsRouter,
  rental: rentalRouter,
  salesEnquiries: salesEnquiriesRouter,
  operations: operationsRouter,
  runtimeMonitoring: monitoringRouter.runtimeErrors,
  telemetry: monitoringRouter.telemetry,
  filterPresets: miscRouter.filterPresets,
  clientFeedback: miscRouter.clientFeedback
});

// server/_core/context.ts
async function createContext(opts) {
  let user = null;
  const localUserId = await readLocalSession(opts.req.headers.cookie);
  if (localUserId) {
    const localUser = await getUserById(localUserId);
    if (localUser && localUser.isActive === 1) user = localUser;
  }
  return {
    req: opts.req,
    res: opts.res,
    user
  };
}

// server/_core/app.ts
function createPortalApp() {
  const app = express();
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  registerStorageProxy(app);
  registerOAuthRoutes(app);
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext
    })
  );
  return app;
}

// api/index.ts
var index_default = createPortalApp();
export {
  index_default as default
};
