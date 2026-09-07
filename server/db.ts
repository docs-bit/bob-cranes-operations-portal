import {
  and,
  desc,
  eq,
  gte,
  isNotNull,
  isNull,
  lt,
  lte,
  or,
  type SQL,
} from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { nanoid } from "nanoid";
import {
  InsertUser,
  users,
  userActivityLogs,
  clientFeedback,
  systemSettings,
  runtimeErrorEvents,
  telemetryEvents,
  bookings,
  bookingCrewAllocations,
  trainingFlags,
  equipment,
  crew,
  liftingGears,
  trailers,
  documents,
  chatMessages,
  notifications,
  departments,
  departmentDashboards,
  departmentWorkflowTemplates,
  rentalEnquiries,
  rentalEnquiryEvents,
  documentTaxonomyCategories,
  documentTaxonomyTags,
  persistedDocumentMetadata,
  clientFilterPresets,
  clientPortalTokens,
  revokedSessions,
  passwordResets,
  bookingAdditionalRequirements,
  scheduledBookings,
  trainings,
  trainingAttendees,
  employeeCertificates,
  attendance,
  dispatches,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
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

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) return;

  try {
    const values: InsertUser = {
      openId: user.openId,
      name: user.name ?? null,
      email: user.email ?? null,
      loginMethod: user.loginMethod ?? null,
      role: user.role ?? (user.openId === ENV.ownerOpenId ? "admin" : "user"),
      lastSignedIn: user.lastSignedIn ?? new Date(),
    };

    await db
      .insert(users)
      .values(values)
      .onDuplicateKeyUpdate({
        set: {
          name: values.name,
          email: values.email,
          loginMethod: values.loginMethod,
          lastSignedIn: values.lastSignedIn,
        },
      });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(users)
    .where(eq(users.openId, openId))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getUserById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return result[0];
}

export async function getUserByLocalEmail(localEmail: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(users)
    .where(eq(users.localEmail, localEmail))
    .limit(1);
  return result[0];
}

export async function countLocalUsers() {
  const db = await getDb();
  if (!db) return 0;
  const result = await db
    .select()
    .from(users)
    .where(isNotNull(users.localEmail));
  return result.length;
}

export async function listLocalUsers() {
  const db = await getDb();
  if (!db) return [];
  return await db
    .select()
    .from(users)
    .where(isNotNull(users.localEmail))
    .orderBy(desc(users.createdAt));
}

export async function createLocalUser(input: {
  name: string;
  email: string;
  passwordHash: string;
  departmentCode: string;
  role: "admin" | "supervisor" | "user";
  supervisorId?: number | null;
  mustChangePassword?: number | null;
}) {
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
    mustChangePassword: input.mustChangePassword ?? 0,
    lastSignedIn: new Date(),
  });

  const user = await getUserByLocalEmail(input.email);
  if (!user) throw new Error("Account was created but could not be retrieved.");
  return user;
}

export async function setLocalUserPassword(id: number, passwordHash: string) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable for password change.");
  await db
    .update(users)
    .set({
      passwordHash,
      mustChangePassword: 0,
      credentialsRevokedAt: new Date(),
    })
    .where(eq(users.id, id));
  return await getUserById(id);
}

export async function createPasswordReset(input: {
  id: string;
  userId: number;
  tokenHash: string;
  expiresAt: Date;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(passwordResets).values(input);
  const rows = await db
    .select()
    .from(passwordResets)
    .where(eq(passwordResets.id, input.id));
  return rows[0];
}

export async function getPasswordResetByHash(tokenHash: string) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db
    .select()
    .from(passwordResets)
    .where(eq(passwordResets.tokenHash, tokenHash))
    .limit(1);
  return rows[0];
}

export async function markPasswordResetUsed(id: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .update(passwordResets)
    .set({ usedAt: new Date() })
    .where(eq(passwordResets.id, id));
}

export async function listAdditionalRequirements(bookingId: string) {
  const db = await getDb();
  if (!db) return [];
  return await db
    .select()
    .from(bookingAdditionalRequirements)
    .where(eq(bookingAdditionalRequirements.bookingId, bookingId))
    .orderBy(bookingAdditionalRequirements.createdAt);
}

export async function addAdditionalRequirement(data: {
  id: string;
  bookingId: string;
  docName: string;
  source: string;
  addedBy?: number | null;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(bookingAdditionalRequirements).values({
    ...data,
    addedBy: data.addedBy ?? null,
    isRemoved: 0,
  });
  const rows = await db
    .select()
    .from(bookingAdditionalRequirements)
    .where(eq(bookingAdditionalRequirements.id, data.id));
  return rows[0];
}

export async function removeAdditionalRequirement(
  id: string,
  removalReason: string
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .update(bookingAdditionalRequirements)
    .set({ isRemoved: 1, removalReason })
    .where(eq(bookingAdditionalRequirements.id, id));
}

export async function updateBookingHandoffNotes(id: string, notes: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .update(bookings)
    .set({ handoffNotes: notes })
    .where(eq(bookings.id, id));
  return await getBookingById(id);
}

export async function listScheduledBookings() {
  const db = await getDb();
  if (!db) return [];
  return await db
    .select()
    .from(scheduledBookings)
    .orderBy(scheduledBookings.date);
}

export async function createScheduledBooking(data: {
  id: string;
  title: string;
  clientName?: string | null;
  date: string;
  durationDays?: number | null;
  requiredRoles?: string[] | null;
  craneType?: string | null;
  notes?: string | null;
  colorTag?: string | null;
  createdBy?: number | null;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(scheduledBookings).values({
    id: data.id,
    title: data.title,
    clientName: data.clientName ?? null,
    date: data.date,
    durationDays: data.durationDays ?? 1,
    requiredRoles: data.requiredRoles ?? [],
    craneType: data.craneType ?? null,
    notes: data.notes ?? null,
    colorTag: data.colorTag ?? "blue",
    createdBy: data.createdBy ?? null,
  });
  const rows = await db
    .select()
    .from(scheduledBookings)
    .where(eq(scheduledBookings.id, data.id));
  return rows[0];
}

export async function deleteScheduledBooking(id: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(scheduledBookings).where(eq(scheduledBookings.id, id));
}

export async function listTrainings() {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(trainings).orderBy(trainings.startsAt);
}

export async function createTraining(data: {
  id: string;
  title: string;
  trainer: string;
  startsAt: string;
  durationMins?: number | null;
  location?: string | null;
  notes?: string | null;
  certificateIssued?: number | null;
  validityMonths?: number | null;
  attendees?: string[] | null;
  createdBy?: number | null;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(trainings).values({
    id: data.id,
    title: data.title,
    trainer: data.trainer,
    startsAt: data.startsAt,
    durationMins: data.durationMins ?? null,
    location: data.location ?? null,
    notes: data.notes ?? null,
    certificateIssued: data.certificateIssued ?? 0,
    validityMonths: data.validityMonths ?? null,
    createdBy: data.createdBy ?? null,
  });
  for (const employeeName of data.attendees ?? []) {
    await db.insert(trainingAttendees).values({
      trainingId: data.id,
      employeeName,
    });
  }
  const rows = await db
    .select()
    .from(trainings)
    .where(eq(trainings.id, data.id));
  return rows[0];
}

export async function listTrainingAttendees(trainingId: string) {
  const db = await getDb();
  if (!db) return [];
  return await db
    .select()
    .from(trainingAttendees)
    .where(eq(trainingAttendees.trainingId, trainingId));
}

export async function issueTrainingCertificates(trainingId: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const training = (
    await db.select().from(trainings).where(eq(trainings.id, trainingId))
  )[0];
  if (!training) throw new Error("Training not found.");
  if (training.certificateIssued !== 1 || !training.validityMonths)
    throw new Error("This training does not issue certificates.");
  const attendees = await listTrainingAttendees(trainingId);
  const issuedAt = new Date().toISOString().slice(0, 10);
  const expires = new Date();
  expires.setMonth(expires.getMonth() + training.validityMonths);
  const expiresAt = expires.toISOString().slice(0, 10);
  let count = 0;
  for (const attendee of attendees) {
    await db.insert(employeeCertificates).values({
      id: `cert-${trainingId}-${count}-${Date.now()}`,
      employeeName: attendee.employeeName,
      trainingTitle: training.title,
      issuedAt,
      expiresAt,
    });
    count += 1;
  }
  return { count, expiresAt };
}

export async function listEmployeeCertificates() {
  const db = await getDb();
  if (!db) return [];
  return await db
    .select()
    .from(employeeCertificates)
    .orderBy(desc(employeeCertificates.expiresAt));
}

export async function revokeSession(jti: string, expiresAt: Date) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .insert(revokedSessions)
    .values({ jti, expiresAt })
    .onDuplicateKeyUpdate({ set: { expiresAt } });
}

export async function isSessionRevoked(jti: string) {
  const db = await getDb();
  if (!db) return false;
  const rows = await db
    .select()
    .from(revokedSessions)
    .where(eq(revokedSessions.jti, jti))
    .limit(1);
  if (!rows[0]) return false;
  if (new Date(rows[0].expiresAt).getTime() <= Date.now()) {
    await db.delete(revokedSessions).where(eq(revokedSessions.jti, jti));
    return false;
  }
  return true;
}

export async function updateUserLastSignedIn(id: number) {
  const db = await getDb();
  if (!db) return;
  await db
    .update(users)
    .set({ lastSignedIn: new Date() })
    .where(eq(users.id, id));
}

export async function updateLocalUser(
  id: number,
  input: {
    name: string;
    email: string;
    departmentCode: string;
    role: "admin" | "supervisor" | "user";
    supervisorId?: number | null;
    passwordHash?: string;
  }
) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable for account update.");
  await db
    .update(users)
    .set({
      name: input.name,
      email: input.email,
      localEmail: input.email,
      departmentCode: input.departmentCode,
      supervisorId: input.supervisorId ?? null,
      role: input.role,
      ...(input.passwordHash ? { passwordHash: input.passwordHash } : {}),
    })
    .where(eq(users.id, id));
  return await getUserById(id);
}

export async function updateUserProfileContactDetails(
  id: number,
  input: { companyName: string | null; phone: string | null }
) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable for profile update.");
  await db
    .update(users)
    .set({ companyName: input.companyName, phone: input.phone })
    .where(eq(users.id, id));
  return await getUserById(id);
}

export async function setLocalUserActive(id: number, isActive: number) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable for account status update.");
  await db.update(users).set({ isActive }).where(eq(users.id, id));
  return await getUserById(id);
}

export async function addUserActivity(input: {
  userId: number;
  action: string;
  detail: string;
}) {
  const db = await getDb();
  if (!db) return;
  await db.insert(userActivityLogs).values(input);
}

export type ActivityLogFilters = {
  limit?: number;
  departmentCode?: string | null;
  from?: Date;
  to?: Date;
};

export async function listRecentUserActivity({
  limit = 40,
  departmentCode,
  from,
  to,
}: ActivityLogFilters = {}) {
  const db = await getDb();
  if (!db) return [];
  const query = db
    .select({
      id: userActivityLogs.id,
      userId: userActivityLogs.userId,
      userName: users.name,
      userEmail: users.localEmail,
      departmentCode: users.departmentCode,
      action: userActivityLogs.action,
      detail: userActivityLogs.detail,
      createdAt: userActivityLogs.createdAt,
    })
    .from(userActivityLogs)
    .leftJoin(users, eq(userActivityLogs.userId, users.id));
  const filters = [
    departmentCode ? eq(users.departmentCode, departmentCode) : undefined,
    from ? gte(userActivityLogs.createdAt, from) : undefined,
    to ? lte(userActivityLogs.createdAt, to) : undefined,
  ].filter((filter): filter is SQL => Boolean(filter));
  return await query
    .where(filters.length ? and(...filters) : undefined)
    .orderBy(desc(userActivityLogs.createdAt))
    .limit(Math.min(Math.max(limit, 1), 250));
}

export async function getActivityRetentionDays() {
  const db = await getDb();
  if (!db) return 365;
  const result = await db
    .select()
    .from(systemSettings)
    .where(eq(systemSettings.key, "activity_log_retention_days"))
    .limit(1);
  const value = Number(result[0]?.value);
  return [30, 90, 180, 365, 730].includes(value) ? value : 365;
}

export async function setActivityRetentionDays(
  days: number,
  updatedBy: number
) {
  const db = await getDb();
  if (!db)
    throw new Error("Database is unavailable for activity retention settings.");
  await db
    .insert(systemSettings)
    .values({
      key: "activity_log_retention_days",
      value: String(days),
      updatedBy,
    })
    .onDuplicateKeyUpdate({
      set: { value: String(days), updatedBy },
    });
  return await getActivityRetentionDays();
}

export async function getDashboardGreetingTemplate() {
  const db = await getDb();
  if (!db) return "Hello, {name}";
  const result = await db
    .select()
    .from(systemSettings)
    .where(eq(systemSettings.key, "dashboard_greeting_template"))
    .limit(1);
  const template = result[0]?.value?.trim();
  return template?.includes("{name}") ? template : "Hello, {name}";
}

export async function setDashboardGreetingTemplate(template: string, updatedBy: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable for dashboard greeting settings.");
  await db
    .insert(systemSettings)
    .values({
      key: "dashboard_greeting_template",
      value: template,
      updatedBy,
    })
    .onDuplicateKeyUpdate({
      set: { value: template, updatedBy },
    });
  return await getDashboardGreetingTemplate();
}

export async function purgeUserActivityBefore(cutoff: Date) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable for activity retention.");
  const expired = await db
    .select({ id: userActivityLogs.id })
    .from(userActivityLogs)
    .where(lt(userActivityLogs.createdAt, cutoff));
  if (expired.length)
    await db
      .delete(userActivityLogs)
      .where(lt(userActivityLogs.createdAt, cutoff));
  return expired.length;
}

export async function createClientFeedback(input: {
  bookingId: string;
  category: string;
  message: string;
  contactEmail?: string | null;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable for client feedback.");
  const id = `feedback-${nanoid(16)}`;
  await db.insert(clientFeedback).values({
    id,
    bookingId: input.bookingId,
    category: input.category,
    message: input.message,
    contactEmail: input.contactEmail ?? null,
    status: "Open",
  });
  return { id };
}

export async function listClientFeedback(limit = 100) {
  const db = await getDb();
  if (!db) return [];
  return await db
    .select()
    .from(clientFeedback)
    .orderBy(desc(clientFeedback.createdAt))
    .limit(Math.min(Math.max(limit, 1), 250));
}

export async function updateClientFeedbackStatus(
  id: string,
  status: "Open" | "In review" | "Resolved"
) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable for client feedback.");
  await db
    .update(clientFeedback)
    .set({ status })
    .where(eq(clientFeedback.id, id));
  const result = await db
    .select()
    .from(clientFeedback)
    .where(eq(clientFeedback.id, id))
    .limit(1);
  return result[0];
}

export async function createRuntimeErrorEvent(input: {
  source: string;
  message: string;
  path: string;
  fingerprint: string;
  userId?: number | null;
}) {
  const db = await getDb();
  if (!db) return { id: null };
  const id = `runtime-${nanoid(16)}`;
  await db.insert(runtimeErrorEvents).values({
    id,
    source: input.source,
    message: input.message,
    path: input.path,
    fingerprint: input.fingerprint,
    userId: input.userId ?? null,
  });
  return { id };
}

export async function listRuntimeErrorEvents(limit = 100) {
  const db = await getDb();
  if (!db) return [];
  return await db
    .select()
    .from(runtimeErrorEvents)
    .orderBy(desc(runtimeErrorEvents.createdAt))
    .limit(Math.min(Math.max(limit, 1), 250));
}

export async function createTelemetryEvent(input: {
  metricName: string;
  metricValue: string;
  path: string;
  userId?: number | null;
}) {
  const db = await getDb();
  if (!db) return { id: null };
  const id = `tel-${nanoid(16)}`;
  await db.insert(telemetryEvents).values({
    id,
    metricName: input.metricName,
    metricValue: input.metricValue,
    path: input.path,
    userId: input.userId ?? null,
  });
  return { id };
}

export async function listTelemetryEvents(limit = 250) {
  const db = await getDb();
  if (!db) return [];
  return await db
    .select()
    .from(telemetryEvents)
    .orderBy(desc(telemetryEvents.createdAt))
    .limit(Math.min(Math.max(limit, 1), 500));
}

// ---- Bookings & Operations Queries ----

export async function getAllBookings() {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(bookings).orderBy(desc(bookings.createdAt));
}

export async function getBookingById(id: string) {
  const db = await getDb();
  if (!db) return undefined;
  const res = await db
    .select()
    .from(bookings)
    .where(eq(bookings.id, id))
    .limit(1);
  return res[0];
}

export async function createBooking(data: {
  id: string;
  clientName: string;
  projectName: string;
  projectManager: string;
  lpoReference: string;
  mobilizationDate: string;
  offHireDate: string;
  clientContactName: string;
  clientEmail: string;
  clientPhone: string;
  priority: string;
  stage: string;
  craneId?: string;
  crewIds?: string[];
  gearIds?: string[];
  trailerIds?: string[];
}) {
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
    trailerIds: data.trailerIds ?? [],
  });
  return await getBookingById(data.id);
}

export async function updateBookingStage(id: string, stage: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(bookings).set({ stage }).where(eq(bookings.id, id));
  return await getBookingById(id);
}

export async function updateBookingAssignment(
  id: string,
  updates: {
    craneId?: string;
    crewIds?: string[];
    gearIds?: string[];
    trailerIds?: string[];
  }
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(bookings).set(updates).where(eq(bookings.id, id));
  return await getBookingById(id);
}

export async function listBookingCrewAllocations() {
  const db = await getDb();
  if (!db) return [];
  return await db
    .select()
    .from(bookingCrewAllocations)
    .orderBy(desc(bookingCrewAllocations.createdAt));
}

export async function replaceCrewBookingAllocations(input: {
  bookingIds: string[];
  crewId: string;
  crewName: string;
  assignedBy?: number | null;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .delete(bookingCrewAllocations)
    .where(eq(bookingCrewAllocations.crewId, input.crewId));
  if (input.bookingIds.length > 0) {
    await db.insert(bookingCrewAllocations).values(
      input.bookingIds.map(bookingId => ({
        bookingId,
        crewId: input.crewId,
        crewName: input.crewName,
        assignedBy: input.assignedBy ?? null,
      }))
    );
  }
  return await listBookingCrewAllocations();
}

export async function listTrainingFlags(bookingId: string) {
  const db = await getDb();
  if (!db) return [];
  return await db
    .select()
    .from(trainingFlags)
    .where(eq(trainingFlags.bookingId, bookingId))
    .orderBy(desc(trainingFlags.createdAt));
}

export async function listAllTrainingFlags(limit = 100) {
  const db = await getDb();
  if (!db) return [];
  return await db
    .select()
    .from(trainingFlags)
    .orderBy(desc(trainingFlags.createdAt))
    .limit(Math.min(Math.max(limit, 1), 250));
}

export async function getAttendanceForDate(date: string) {
  const db = await getDb();
  if (!db) return [];
  return await db
    .select()
    .from(attendance)
    .where(eq(attendance.date, date))
    .orderBy(attendance.employeeName);
}

export async function saveAttendanceDay(
  date: string,
  rows: Array<{
    employeeName: string;
    status: string;
    checkIn?: string | null;
    checkOut?: string | null;
    note?: string | null;
  }>,
  markedBy?: number | null
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  for (const row of rows) {
    await db
      .insert(attendance)
      .values({
        employeeName: row.employeeName,
        date,
        status: row.status,
        checkIn: row.checkIn ?? null,
        checkOut: row.checkOut ?? null,
        note: row.note ?? null,
        markedBy: markedBy ?? null,
      })
      .onDuplicateKeyUpdate({
        set: {
          status: row.status,
          checkIn: row.checkIn ?? null,
          checkOut: row.checkOut ?? null,
          note: row.note ?? null,
          markedBy: markedBy ?? null,
        },
      });
  }
  return await getAttendanceForDate(date);
}

export type IntegrationSettings = {
  driveRootFolder: string;
  smtpHost: string;
  smtpPort: string;
  smtpFromName: string;
  smtpFromEmail: string;
};

const INTEGRATION_DEFAULTS: IntegrationSettings = {
  driveRootFolder: "",
  smtpHost: "",
  smtpPort: "587",
  smtpFromName: "BOB Cranes",
  smtpFromEmail: "",
};

export async function getIntegrationSettings(): Promise<IntegrationSettings> {
  const db = await getDb();
  if (!db) return { ...INTEGRATION_DEFAULTS };
  const keys = [
    "integration_drive_root_folder",
    "integration_smtp_host",
    "integration_smtp_port",
    "integration_smtp_from_name",
    "integration_smtp_from_email",
  ] as const;
  const rows = await db
    .select()
    .from(systemSettings)
    .where(
      or(
        eq(systemSettings.key, keys[0]),
        eq(systemSettings.key, keys[1]),
        eq(systemSettings.key, keys[2]),
        eq(systemSettings.key, keys[3]),
        eq(systemSettings.key, keys[4])
      )
    );
  const byKey = new Map(rows.map(row => [row.key, row.value]));
  return {
    driveRootFolder: byKey.get(keys[0]) ?? INTEGRATION_DEFAULTS.driveRootFolder,
    smtpHost: byKey.get(keys[1]) ?? INTEGRATION_DEFAULTS.smtpHost,
    smtpPort: byKey.get(keys[2]) ?? INTEGRATION_DEFAULTS.smtpPort,
    smtpFromName: byKey.get(keys[3]) ?? INTEGRATION_DEFAULTS.smtpFromName,
    smtpFromEmail: byKey.get(keys[4]) ?? INTEGRATION_DEFAULTS.smtpFromEmail,
  };
}

export async function saveIntegrationSettings(
  input: IntegrationSettings,
  updatedBy: number
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const entries: Array<[string, string]> = [
    ["integration_drive_root_folder", input.driveRootFolder],
    ["integration_smtp_host", input.smtpHost],
    ["integration_smtp_port", input.smtpPort],
    ["integration_smtp_from_name", input.smtpFromName],
    ["integration_smtp_from_email", input.smtpFromEmail],
  ];
  for (const [key, value] of entries) {
    await db
      .insert(systemSettings)
      .values({ key, value, updatedBy })
      .onDuplicateKeyUpdate({ set: { value, updatedBy } });
  }
  return await getIntegrationSettings();
}

export async function createTrainingFlag(data: {
  id: string;
  bookingId: string;
  crewId: string;
  crewName: string;
  flagType: string;
  note: string;
  raisedBy: string;
  raisedByUserId?: number | null;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(trainingFlags).values({
    ...data,
    raisedByUserId: data.raisedByUserId ?? null,
    status: "OPEN",
  });
  const rows = await db
    .select()
    .from(trainingFlags)
    .where(eq(trainingFlags.id, data.id));
  return rows[0];
}

export async function updateTrainingFlagStatus(
  id: string,
  status: "ACKNOWLEDGED" | "RESOLVED",
  resolvedBy?: string | null
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const current = await db
    .select()
    .from(trainingFlags)
    .where(eq(trainingFlags.id, id));
  if (!current[0]) throw new Error("Training flag not found.");
  await db
    .update(trainingFlags)
    .set({
      status,
      resolvedBy: status === "RESOLVED" ? (resolvedBy ?? null) : null,
      resolvedAt: status === "RESOLVED" ? new Date() : null,
    })
    .where(eq(trainingFlags.id, id));
  const rows = await db
    .select()
    .from(trainingFlags)
    .where(eq(trainingFlags.id, id));
  return rows[0];
}

export async function getAllEquipment() {
  const fallbackEquipment = [
    { id: "eq-demo-1", assetCode: "B-205", name: "50T Mobile Crane · DEMAG", capacityTons: 50, status: "Available", inspectionExpiry: "2027-03-15", type: "Mobile Crane", registration: "60312" },
    { id: "eq-demo-2", assetCode: "B-210", name: "35T Mobile Crane · PPM", capacityTons: 35, status: "Available", inspectionExpiry: "2027-06-20", type: "Mobile Crane", registration: "98274" },
  ];
  const db = await getDb();
  if (!db) return fallbackEquipment;
  const rows = await db
    .select()
    .from(equipment)
    .where(eq(equipment.active, 1));
  return rows.length > 0 ? rows : fallbackEquipment;
}

export async function listAllEquipment() {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(equipment).orderBy(equipment.assetCode);
}

export async function createEquipmentAsset(data: {
  id: string;
  assetCode: string;
  name: string;
  capacityTons: number;
  status?: string | null;
  inspectionExpiry: string;
  type?: string | null;
  registration?: string | null;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(equipment).values({
    id: data.id,
    assetCode: data.assetCode,
    name: data.name,
    capacityTons: data.capacityTons,
    status: data.status ?? "Available",
    inspectionExpiry: data.inspectionExpiry,
    type: data.type ?? "Mobile Crane",
    registration: data.registration ?? null,
    active: 1,
  });
  const rows = await db
    .select()
    .from(equipment)
    .where(eq(equipment.id, data.id));
  return rows[0];
}

export async function updateEquipmentAsset(
  id: string,
  patch: Partial<{
    name: string;
    capacityTons: number;
    status: string;
    inspectionExpiry: string;
    type: string;
    registration: string | null;
  }>
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(equipment).set(patch).where(eq(equipment.id, id));
  const rows = await db.select().from(equipment).where(eq(equipment.id, id));
  return rows[0];
}

export async function deleteEquipmentAsset(id: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const asset = (
    await db.select().from(equipment).where(eq(equipment.id, id))
  )[0];
  if (!asset) throw new Error("Asset not found.");
  const bookings = await getAllBookings();
  const referenced = bookings.some(
    booking =>
      booking.craneId === asset.id ||
      booking.craneId === asset.assetCode ||
      booking.craneId === asset.name
  );
  if (referenced) {
    await db
      .update(equipment)
      .set({ active: 0 })
      .where(eq(equipment.id, id));
    return { deactivated: true as const };
  }
  await db.delete(equipment).where(eq(equipment.id, id));
  return { deactivated: false as const };
}

export async function getAllCrew() {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(crew);
}

export async function getAllLiftingGears() {
  const db = await getDb();
  if (!db) return [];
  return await db
    .select()
    .from(liftingGears)
    .where(eq(liftingGears.active, 1));
}

export async function listAllLiftingGears() {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(liftingGears).orderBy(liftingGears.name);
}

export async function createLiftingGear(data: {
  id: string;
  name: string;
  gearType?: string | null;
  swlTons: number;
  inspectionExpiry: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(liftingGears).values({
    id: data.id,
    name: data.name,
    gearType: data.gearType ?? "Shackle",
    swlTons: data.swlTons,
    inspectionExpiry: data.inspectionExpiry,
    active: 1,
  });
  const rows = await db
    .select()
    .from(liftingGears)
    .where(eq(liftingGears.id, data.id));
  return rows[0];
}

export async function updateLiftingGear(
  id: string,
  patch: Partial<{
    name: string;
    gearType: string;
    swlTons: number;
    inspectionExpiry: string;
  }>
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(liftingGears).set(patch).where(eq(liftingGears.id, id));
  const rows = await db
    .select()
    .from(liftingGears)
    .where(eq(liftingGears.id, id));
  return rows[0];
}

export async function deleteLiftingGear(id: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const gear = (
    await db.select().from(liftingGears).where(eq(liftingGears.id, id))
  )[0];
  if (!gear) throw new Error("Gear not found.");
  const bookings = await getAllBookings();
  const referenced = bookings.some(booking => {
    const ids = booking.gearIds;
    return (
      (Array.isArray(ids) && ids.includes(id)) ||
      (Array.isArray(ids) && ids.includes(gear.name))
    );
  });
  if (referenced) {
    await db
      .update(liftingGears)
      .set({ active: 0 })
      .where(eq(liftingGears.id, id));
    return { deactivated: true as const };
  }
  await db.delete(liftingGears).where(eq(liftingGears.id, id));
  return { deactivated: false as const };
}

export async function getAllTrailers() {
  const db = await getDb();
  if (!db) return [];
  return await db
    .select()
    .from(trailers)
    .where(eq(trailers.active, 1));
}

export async function listAllTrailers() {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(trailers).orderBy(trailers.plateNumber);
}

export async function createTrailer(data: {
  id: string;
  plateNumber: string;
  trailerType?: string | null;
  status?: string | null;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(trailers).values({
    id: data.id,
    plateNumber: data.plateNumber,
    trailerType: data.trailerType ?? "Flatbed",
    status: data.status ?? "Available",
    active: 1,
  });
  const rows = await db
    .select()
    .from(trailers)
    .where(eq(trailers.id, data.id));
  return rows[0];
}

export async function updateTrailer(
  id: string,
  patch: Partial<{ plateNumber: string; trailerType: string; status: string }>
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(trailers).set(patch).where(eq(trailers.id, id));
  const rows = await db
    .select()
    .from(trailers)
    .where(eq(trailers.id, id));
  return rows[0];
}

export async function deleteTrailer(id: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const trailer = (
    await db.select().from(trailers).where(eq(trailers.id, id))
  )[0];
  if (!trailer) throw new Error("Trailer not found.");
  const bookings = await getAllBookings();
  const referenced = bookings.some(booking => {
    const ids = booking.trailerIds;
    return Array.isArray(ids) && ids.includes(id);
  });
  if (referenced) {
    await db.update(trailers).set({ active: 0 }).where(eq(trailers.id, id));
    return { deactivated: true as const };
  }
  await db.delete(trailers).where(eq(trailers.id, id));
  return { deactivated: false as const };
}

export async function getDocumentsForBooking(bookingId: string) {
  const db = await getDb();
  if (!db) return [];
  return await db
    .select()
    .from(documents)
    .where(eq(documents.bookingId, bookingId));
}

export async function upsertDocument(data: {
  id: string;
  bookingId: string;
  departmentCode: string;
  name: string;
  state: string;
  expiryDate?: string;
  required: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .insert(documents)
    .values(data)
    .onDuplicateKeyUpdate({
      set: { state: data.state, expiryDate: data.expiryDate, name: data.name },
    });
  return data;
}

export async function getChatForBooking(bookingId: string) {
  const db = await getDb();
  if (!db) return [];
  return await db
    .select()
    .from(chatMessages)
    .where(eq(chatMessages.bookingId, bookingId))
    .orderBy(chatMessages.createdAt);
}

export async function addChatMessage(data: {
  id: string;
  bookingId: string;
  team: string;
  sender: string;
  body: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(chatMessages).values(data);
  return data;
}

export async function getNotifications(filters?: {
  departmentCode?: string;
  userId?: number;
}) {
  const db = await getDb();
  if (!db) return [];
  const { departmentCode, userId } = filters ?? {};
  if (userId !== undefined && departmentCode) {
    return await db
      .select()
      .from(notifications)
      .where(
        or(
          eq(notifications.userId, userId),
          and(
            isNull(notifications.userId),
            eq(notifications.departmentCode, departmentCode)
          )
        )
      )
      .orderBy(desc(notifications.createdAt));
  }
  if (userId !== undefined) {
    return await db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, userId))
      .orderBy(desc(notifications.createdAt));
  }
  if (departmentCode) {
    return await db
      .select()
      .from(notifications)
      .where(eq(notifications.departmentCode, departmentCode))
      .orderBy(desc(notifications.createdAt));
  }
  return await db
    .select()
    .from(notifications)
    .orderBy(desc(notifications.createdAt));
}

export async function addNotification(data: {
  id: string;
  userId?: number | null;
  departmentCode: string;
  title: string;
  body: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(notifications).values(data);
  return data;
}

export async function markAllNotificationsRead(filters?: {
  departmentCode?: string;
  userId?: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const { departmentCode, userId } = filters ?? {};
  if (userId !== undefined && departmentCode) {
    await db
      .update(notifications)
      .set({ read: 1 })
      .where(
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
  if (userId !== undefined) {
    await db
      .update(notifications)
      .set({ read: 1 })
      .where(eq(notifications.userId, userId));
    return;
  }
  if (departmentCode) {
    await db
      .update(notifications)
      .set({ read: 1 })
      .where(eq(notifications.departmentCode, departmentCode));
    return;
  }
  await db.update(notifications).set({ read: 1 });
}

export type ProvisionedDepartmentDashboard = {
  code: string;
  name: string;
  active: number;
  description: string;
  accent: string;
  icon: string;
  dashboardConfig: unknown;
  createdBy: number;
  createdAt: Date;
  updatedAt: Date;
};

export async function listProvisionedDepartmentDashboards(options: {
  includeArchived?: boolean;
} = {}): Promise<ProvisionedDepartmentDashboard[]> {
  const db = await getDb();
  if (!db) return [];
  const query = db
    .select({
      code: departments.code,
      name: departments.name,
      active: departments.active,
      description: departmentDashboards.description,
      accent: departmentDashboards.accent,
      icon: departmentDashboards.icon,
      dashboardConfig: departmentDashboards.dashboardConfig,
      createdBy: departmentDashboards.createdBy,
      createdAt: departmentDashboards.createdAt,
      updatedAt: departmentDashboards.updatedAt,
    })
    .from(departments)
    .innerJoin(
      departmentDashboards,
      eq(departments.code, departmentDashboards.departmentCode)
    );
  return await (options.includeArchived
    ? query.orderBy(departments.name)
    : query.where(eq(departments.active, 1)).orderBy(departments.name));
}

export async function getProvisionedDepartmentDashboard(code: string): Promise<
  ProvisionedDepartmentDashboard | undefined
> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select({
      code: departments.code,
      name: departments.name,
      active: departments.active,
      description: departmentDashboards.description,
      accent: departmentDashboards.accent,
      icon: departmentDashboards.icon,
      dashboardConfig: departmentDashboards.dashboardConfig,
      createdBy: departmentDashboards.createdBy,
      createdAt: departmentDashboards.createdAt,
      updatedAt: departmentDashboards.updatedAt,
    })
    .from(departments)
    .innerJoin(
      departmentDashboards,
      eq(departments.code, departmentDashboards.departmentCode)
    )
    .where(eq(departments.code, code))
    .limit(1);
  return result[0];
}

export async function createProvisionedDepartmentDashboard(input: {
  code: string;
  name: string;
  description: string;
  accent: string;
  icon: string;
  dashboardConfig: Record<string, unknown>;
  createdBy: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const existing = await db
    .select({ code: departments.code })
    .from(departments)
    .where(eq(departments.code, input.code))
    .limit(1);
  if (existing[0]) throw new Error("A department already uses this code.");
  await db.transaction(async transaction => {
    await transaction.insert(departments).values({
      code: input.code,
      name: input.name,
      active: 1,
    });
    await transaction.insert(departmentDashboards).values({
      departmentCode: input.code,
      description: input.description,
      accent: input.accent,
      icon: input.icon,
      dashboardConfig: input.dashboardConfig,
      createdBy: input.createdBy,
    });
  });
  const created = await getProvisionedDepartmentDashboard(input.code);
  if (!created) throw new Error("Department dashboard could not be provisioned.");
  return created;
}

export async function updateProvisionedDepartmentDashboardConfig(input: {
  code: string;
  description: string;
  dashboardConfig: Record<string, unknown>;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .update(departmentDashboards)
    .set({
      description: input.description,
      dashboardConfig: input.dashboardConfig,
    })
    .where(eq(departmentDashboards.departmentCode, input.code));
  const updated = await getProvisionedDepartmentDashboard(input.code);
  if (!updated) throw new Error("Department dashboard could not be updated.");
  return updated;
}

export async function setProvisionedDepartmentActive(input: {
  code: string;
  active: boolean;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .update(departments)
    .set({ active: input.active ? 1 : 0 })
    .where(eq(departments.code, input.code));
  const updated = await getProvisionedDepartmentDashboard(input.code);
  if (!updated) throw new Error("Department dashboard could not be updated.");
  return updated;
}

export type DepartmentWorkflowTemplate = {
  id: string;
  departmentCode: string;
  name: string;
  description: string;
  checklist: unknown;
  active: number;
  createdBy: number;
  createdAt: Date;
  updatedAt: Date;
};

export async function listDepartmentWorkflowTemplates(input: {
  departmentCode: string;
  includeArchived?: boolean;
}): Promise<DepartmentWorkflowTemplate[]> {
  const db = await getDb();
  if (!db) return [];
  const query = db
    .select()
    .from(departmentWorkflowTemplates)
    .where(eq(departmentWorkflowTemplates.departmentCode, input.departmentCode));
  const rows = await query.orderBy(desc(departmentWorkflowTemplates.updatedAt));
  return input.includeArchived ? rows : rows.filter(template => template.active === 1);
}

export async function createDepartmentWorkflowTemplate(input: {
  departmentCode: string;
  name: string;
  description: string;
  checklist: Array<Record<string, unknown>>;
  createdBy: number;
}) {
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
    createdBy: input.createdBy,
  });
  const [template] = await db
    .select()
    .from(departmentWorkflowTemplates)
    .where(eq(departmentWorkflowTemplates.id, id))
    .limit(1);
  if (!template) throw new Error("Workflow template could not be created.");
  return template;
}

export async function updateDepartmentWorkflowTemplate(input: {
  id: string;
  name: string;
  description: string;
  checklist: Array<Record<string, unknown>>;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .update(departmentWorkflowTemplates)
    .set({
      name: input.name,
      description: input.description,
      checklist: input.checklist,
    })
    .where(eq(departmentWorkflowTemplates.id, input.id));
  const [template] = await db
    .select()
    .from(departmentWorkflowTemplates)
    .where(eq(departmentWorkflowTemplates.id, input.id))
    .limit(1);
  if (!template) throw new Error("Workflow template could not be updated.");
  return template;
}

export async function setDepartmentWorkflowTemplateActive(input: {
  id: string;
  active: boolean;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .update(departmentWorkflowTemplates)
    .set({ active: input.active ? 1 : 0 })
    .where(eq(departmentWorkflowTemplates.id, input.id));
  const [template] = await db
    .select()
    .from(departmentWorkflowTemplates)
    .where(eq(departmentWorkflowTemplates.id, input.id))
    .limit(1);
  if (!template) throw new Error("Workflow template could not be updated.");
  return template;
}

export async function createRentalEnquiry(input: {
  contactName: string;
  companyName: string;
  email: string;
  phone: string;
  projectLocation: string;
  equipmentInterest: string;
  rentalDuration: string;
  liftDetails: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const id = `rental-enquiry-${nanoid(14)}`;
  await db.insert(rentalEnquiries).values({ id, ...input, status: "New" });
  return { id, status: "New" as const };
}

export async function listRentalEnquiries(filters?: { status?: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const status = filters?.status;
  if (status && status !== "all") {
    return await db
      .select()
      .from(rentalEnquiries)
      .where(eq(rentalEnquiries.status, status))
      .orderBy(desc(rentalEnquiries.updatedAt));
  }
  return await db.select().from(rentalEnquiries).orderBy(desc(rentalEnquiries.updatedAt));
}

export async function getRentalEnquiryById(id: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [enquiry] = await db
    .select()
    .from(rentalEnquiries)
    .where(eq(rentalEnquiries.id, id))
    .limit(1);
  return enquiry;
}

export async function updateRentalEnquirySalesContext(input: {
  id: string;
  status?: string;
  assignedToUserId?: number | null;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const values: { status?: string; assignedToUserId?: number | null } = {};
  if (input.status !== undefined) values.status = input.status;
  if (input.assignedToUserId !== undefined) values.assignedToUserId = input.assignedToUserId;
  await db.update(rentalEnquiries).set(values).where(eq(rentalEnquiries.id, input.id));
  return await getRentalEnquiryById(input.id);
}

export async function markRentalEnquiryConverted(input: { id: string; bookingId: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .update(rentalEnquiries)
    .set({ status: "Converted", convertedBookingId: input.bookingId })
    .where(eq(rentalEnquiries.id, input.id));
  return await getRentalEnquiryById(input.id);
}

export type SalesEnquirySlaConfig = {
  warningHours: number;
  criticalHours: number;
};

const DEFAULT_SALES_ENQUIRY_SLA: SalesEnquirySlaConfig = {
  warningHours: 4,
  criticalHours: 24,
};

export async function getSalesEnquirySlaConfig(): Promise<SalesEnquirySlaConfig> {
  const db = await getDb();
  if (!db) return DEFAULT_SALES_ENQUIRY_SLA;
  const rows = await db
    .select()
    .from(systemSettings)
    .where(or(eq(systemSettings.key, "sales_enquiry_sla_warning_hours"), eq(systemSettings.key, "sales_enquiry_sla_critical_hours")));
  const warningHours = Number(rows.find(row => row.key === "sales_enquiry_sla_warning_hours")?.value);
  const criticalHours = Number(rows.find(row => row.key === "sales_enquiry_sla_critical_hours")?.value);
  if (!Number.isFinite(warningHours) || !Number.isFinite(criticalHours) || warningHours < 1 || criticalHours <= warningHours) return DEFAULT_SALES_ENQUIRY_SLA;
  return { warningHours, criticalHours };
}

export async function setSalesEnquirySlaConfig(config: SalesEnquirySlaConfig, updatedBy: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable for Sales SLA settings.");
  await db.insert(systemSettings).values([
    { key: "sales_enquiry_sla_warning_hours", value: String(config.warningHours), updatedBy },
    { key: "sales_enquiry_sla_critical_hours", value: String(config.criticalHours), updatedBy },
  ]).onDuplicateKeyUpdate({ set: { value: String(config.warningHours), updatedBy } });
  await db.update(systemSettings).set({ value: String(config.criticalHours), updatedBy }).where(eq(systemSettings.key, "sales_enquiry_sla_critical_hours"));
  return await getSalesEnquirySlaConfig();
}

export async function createRentalEnquiryEvent(input: {
  rentalEnquiryId: string;
  actorUserId: number;
  eventType: string;
  summary: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available for enquiry audit event.");
  const id = `rental-enquiry-event-${nanoid(14)}`;
  await db.insert(rentalEnquiryEvents).values({ id, ...input });
  return await getRentalEnquiryEventById(id);
}

export async function getRentalEnquiryEventById(id: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available for enquiry audit event.");
  const [event] = await db.select().from(rentalEnquiryEvents).where(eq(rentalEnquiryEvents.id, id)).limit(1);
  return event;
}

export async function listRentalEnquiryEvents(rentalEnquiryId: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available for enquiry audit events.");
  return await db.select().from(rentalEnquiryEvents).where(eq(rentalEnquiryEvents.rentalEnquiryId, rentalEnquiryId)).orderBy(desc(rentalEnquiryEvents.createdAt));
}

export async function seedInitialDataIfNeeded() {
  const db = await getDb();
  if (!db) return;

  const eqList = await db.select().from(equipment).limit(1);
  if (eqList.length === 0) {
    const initialEquipment = [
      {
        id: "eq-1",
        assetCode: "B-205",
        name: "50T Mobile Crane · DEMAG",
        capacityTons: 50,
        status: "Available",
        inspectionExpiry: "2027-03-15",
        type: "Mobile Crane",
        registration: "60312",
      },
      {
        id: "eq-2",
        assetCode: "B-210",
        name: "35T Mobile Crane · PPM",
        capacityTons: 35,
        status: "Available",
        inspectionExpiry: "2027-06-20",
        type: "Mobile Crane",
        registration: "98274",
      },
      {
        id: "eq-3",
        assetCode: "B-213",
        name: "250T Mobile Crane · LTM",
        capacityTons: 250,
        status: "Assigned",
        inspectionExpiry: "2027-01-10",
        type: "Mobile Crane",
        registration: "92080",
      },
      {
        id: "eq-4",
        assetCode: "B-217",
        name: "350T Mobile Crane · LTM",
        capacityTons: 350,
        status: "Available",
        inspectionExpiry: "2027-09-01",
        type: "Mobile Crane",
        registration: "95095",
      },
      {
        id: "eq-5",
        assetCode: "B-218",
        name: "100T Lattice Crane",
        capacityTons: 100,
        status: "Available",
        inspectionExpiry: "2026-12-05",
        type: "Lattice Crane",
        registration: "71597",
      },
      {
        id: "eq-6",
        assetCode: "B-220",
        name: "50T Mobile Crane · SANY",
        capacityTons: 50,
        status: "Available",
        inspectionExpiry: "2027-04-12",
        type: "Mobile Crane",
        registration: "69009",
      },
      {
        id: "eq-7",
        assetCode: "B-221",
        name: "500T Mobile Crane · LTM",
        capacityTons: 500,
        status: "Available",
        inspectionExpiry: "2027-08-30",
        type: "Mobile Crane",
        registration: "63309",
      },
      {
        id: "eq-8",
        assetCode: "B-222",
        name: "130T Mobile Crane · LTM",
        capacityTons: 130,
        status: "Available",
        inspectionExpiry: "2027-05-18",
        type: "Mobile Crane",
        registration: "88999",
      },
      {
        id: "eq-9",
        assetCode: "B-224",
        name: "75T Mobile Crane · SANY",
        capacityTons: 75,
        status: "Available",
        inspectionExpiry: "2027-02-28",
        type: "Mobile Crane",
        registration: "65577",
      },
    ];
    for (const item of initialEquipment) {
      await db
        .insert(equipment)
        .values(item)
        .onDuplicateKeyUpdate({ set: item });
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
        trainingRequired: 0,
      },
      {
        id: "cr-2",
        name: "Anoop Panikashery",
        designation: "Crane Operator",
        availability: "Assigned",
        certificateExpiry: "2026-11-15",
        trainingRequired: 0,
      },
      {
        id: "cr-3",
        name: "Vijayakumar",
        designation: "Rigger",
        availability: "Present",
        certificateExpiry: "2027-08-20",
        trainingRequired: 0,
      },
      {
        id: "cr-4",
        name: "Amal Krishnan",
        designation: "Rigger",
        availability: "Present",
        certificateExpiry: "2027-01-30",
        trainingRequired: 0,
      },
      {
        id: "cr-5",
        name: "ABDUL JALEEL",
        designation: "Rigger",
        availability: "Present",
        certificateExpiry: "2027-04-11",
        trainingRequired: 0,
      },
      {
        id: "cr-6",
        name: "ABI RENJU KUMAR",
        designation: "Crane Operator Assistant",
        availability: "Present",
        certificateExpiry: "2027-06-01",
        trainingRequired: 0,
      },
      {
        id: "cr-7",
        name: "ABHILASH UNNI",
        designation: "Rigger",
        availability: "Present",
        certificateExpiry: "2027-07-15",
        trainingRequired: 0,
      },
      {
        id: "cr-8",
        name: "ABHIRAM SUNEEF",
        designation: "Rigger",
        availability: "Present",
        certificateExpiry: "2027-03-22",
        trainingRequired: 0,
      },
      {
        id: "cr-9",
        name: "ABHISHEK KRISHNA",
        designation: "Crane Operator Assistant",
        availability: "Present",
        certificateExpiry: "2027-09-09",
        trainingRequired: 0,
      },
      {
        id: "cr-10",
        name: "ADERSH SREEKUMAR NAIR",
        designation: "Rigger",
        availability: "On Leave",
        certificateExpiry: "2027-02-14",
        trainingRequired: 1,
      },
      {
        id: "cr-11",
        name: "AMAL APPUKUTTAN",
        designation: "Rigger",
        availability: "Present",
        certificateExpiry: "2027-10-05",
        trainingRequired: 0,
      },
      {
        id: "cr-12",
        name: "AMARNADH BAIJU",
        designation: "Rigger",
        availability: "Off-Site",
        certificateExpiry: "2027-04-04",
        trainingRequired: 0,
      },
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
        inspectionExpiry: "2027-06-01",
      },
      {
        id: "g-2",
        name: "Wire Rope Sling 20m",
        gearType: "Sling",
        swlTons: 25,
        inspectionExpiry: "2026-10-15",
      },
      {
        id: "g-3",
        name: "Spreader Beam 100T",
        gearType: "Spreader beam",
        swlTons: 100,
        inspectionExpiry: "2027-12-31",
      },
      {
        id: "g-4",
        name: "Webbing Sling 10T",
        gearType: "Sling",
        swlTons: 10,
        inspectionExpiry: "2027-03-30",
      },
    ];
    for (const item of initialGears) {
      await db
        .insert(liftingGears)
        .values(item)
        .onDuplicateKeyUpdate({ set: item });
    }
  }

  const trailerList = await db.select().from(trailers).limit(1);
  if (trailerList.length === 0) {
    const initialTrailers = [
      {
        id: "tr-1",
        plateNumber: "AD-55102",
        trailerType: "Flatbed",
        status: "Available",
      },
      {
        id: "tr-2",
        plateNumber: "DXB-8819",
        trailerType: "Lowboy",
        status: "Assigned",
      },
      {
        id: "tr-3",
        plateNumber: "SHJ-3341",
        trailerType: "Extendable",
        status: "Available",
      },
    ];
    for (const item of initialTrailers) {
      await db
        .insert(trailers)
        .values(item)
        .onDuplicateKeyUpdate({ set: item });
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
        trailerIds: ["tr-1"],
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
        trailerIds: ["tr-2"],
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
        trailerIds: [],
      },
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
          required: 1,
        },
        {
          id: `${b.id}-d2`,
          bookingId: b.id,
          departmentCode: "hse",
          name: "Third Party Crane Inspection",
          state: "Uploaded",
          required: 1,
        },
        {
          id: `${b.id}-d3`,
          bookingId: b.id,
          departmentCode: "lifting-gears",
          name: "Rigging Study & SWL Certification",
          state: "Required",
          required: 1,
        },
        {
          id: `${b.id}-d4`,
          bookingId: b.id,
          departmentCode: "crew",
          name: "Operator Medical & License Verification",
          state: "Approved",
          required: 1,
        },
        {
          id: `${b.id}-d5`,
          bookingId: b.id,
          departmentCode: "accounts",
          name: "Advance Payment Receipt",
          state: "Uploaded",
          required: 1,
        },
      ];
      for (const d of docs) {
        await db.insert(documents).values(d).onDuplicateKeyUpdate({ set: d });
      }
    }
  }

  const allocationList = await db
    .select()
    .from(bookingCrewAllocations)
    .limit(1);
  if (allocationList.length === 0) {
    await db.insert(bookingCrewAllocations).values([
      {
        bookingId: "BOB-59116",
        crewId: "cr-1",
        crewName: "Vineeth Vijayan",
        assignedBy: null,
      },
      {
        bookingId: "BOB-59116",
        crewId: "cr-2",
        crewName: "Anoop Panikashery",
        assignedBy: null,
      },
      {
        bookingId: "BOB-59116",
        crewId: "cr-3",
        crewName: "Vijayakumar",
        assignedBy: null,
      },
      {
        bookingId: "BOB-59116",
        crewId: "cr-4",
        crewName: "Amal Krishnan",
        assignedBy: null,
      },
    ]);
  }
}

export type PersistedDocumentMetadataInput = {
  id: string;
  bookingId: string;
  name: string;
  departmentCode: string;
  state: string;
  category?: string | null;
  tags?: string[];
  fileName?: string | null;
  fileType?: string | null;
  fileSize?: number | null;
  storageKey?: string | null;
  uploadedBy?: number | null;
};

function normalizeTags(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((tag): tag is string => typeof tag === "string").map(tag => tag.trim()).filter(Boolean);
}

export async function listDocumentTaxonomy() {
  const db = await getDb();
  if (!db) return { categories: [], tags: [] };
  const [categories, tags] = await Promise.all([
    db.select().from(documentTaxonomyCategories).orderBy(documentTaxonomyCategories.name),
    db.select().from(documentTaxonomyTags).orderBy(documentTaxonomyTags.name),
  ]);
  return { categories, tags };
}

export async function createDocumentCategory(input: { name: string; description?: string | null; createdBy?: number | null }) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable for document category creation.");
  await db.insert(documentTaxonomyCategories).values({
    name: input.name,
    description: input.description ?? null,
    createdBy: input.createdBy ?? null,
  });
  const result = await db.select().from(documentTaxonomyCategories).where(eq(documentTaxonomyCategories.name, input.name)).limit(1);
  return result[0];
}

export async function updateDocumentCategory(input: { id: number; name: string; description?: string | null }) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable for document category update.");
  await db.update(documentTaxonomyCategories).set({ name: input.name, description: input.description ?? null }).where(eq(documentTaxonomyCategories.id, input.id));
  const result = await db.select().from(documentTaxonomyCategories).where(eq(documentTaxonomyCategories.id, input.id)).limit(1);
  return result[0];
}

export async function deleteDocumentCategory(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable for document category deletion.");
  await db.delete(documentTaxonomyCategories).where(eq(documentTaxonomyCategories.id, id));
  return { success: true };
}

export async function createDocumentTag(input: { name: string; categoryId?: number | null; createdBy?: number | null }) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable for document tag creation.");
  await db.insert(documentTaxonomyTags).values({
    name: input.name,
    categoryId: input.categoryId ?? null,
    createdBy: input.createdBy ?? null,
  });
  const result = await db.select().from(documentTaxonomyTags).where(eq(documentTaxonomyTags.name, input.name)).limit(1);
  return result[0];
}

export async function updateDocumentTag(input: { id: number; name: string; categoryId?: number | null }) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable for document tag update.");
  await db.update(documentTaxonomyTags).set({ name: input.name, categoryId: input.categoryId ?? null }).where(eq(documentTaxonomyTags.id, input.id));
  const result = await db.select().from(documentTaxonomyTags).where(eq(documentTaxonomyTags.id, input.id)).limit(1);
  return result[0];
}

export async function deleteDocumentTag(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable for document tag deletion.");
  await db.delete(documentTaxonomyTags).where(eq(documentTaxonomyTags.id, id));
  return { success: true };
}

export async function listPersistedDocumentMetadata(bookingId: string) {
  const db = await getDb();
  if (!db) return [];
  const records = await db
    .select()
    .from(persistedDocumentMetadata)
    .where(eq(persistedDocumentMetadata.bookingId, bookingId));
  return records.map(record => ({
    ...record,
    tags: normalizeTags(record.tagsJson),
  }));
}

export async function upsertPersistedDocumentMetadata(input: PersistedDocumentMetadataInput) {
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
    storageKey: input.storageKey ?? null,
    uploadedBy: input.uploadedBy ?? null,
  };
  await db
    .insert(persistedDocumentMetadata)
    .values(values)
    .onDuplicateKeyUpdate({
      set: {
        state: values.state,
        category: values.category,
        tagsJson: values.tagsJson,
        fileName: values.fileName,
        fileType: values.fileType,
        fileSize: values.fileSize,
        storageKey: values.storageKey,
        uploadedBy: values.uploadedBy,
      },
    });
  const result = await db.select().from(persistedDocumentMetadata).where(eq(persistedDocumentMetadata.id, input.id)).limit(1);
  return {
    ...result[0],
    tags: normalizeTags(result[0].tagsJson),
  };
}

export async function seedDocumentTaxonomy() {
  const db = await getDb();
  if (!db) return;
  const defaults = [
    { name: "Safety & HSE", description: "Safety plans, approvals, and site controls." },
    { name: "Commercial", description: "LPOs, licenses, and commercial documentation." },
    { name: "Crew & Competency", description: "Crew certificates, training, and competency records." },
    { name: "Access & Permits", description: "Site access passes and permits." },
    { name: "Transport & Delivery", description: "Delivery notes and transport records." },
    { name: "Other", description: "Other client-submitted documents." },
  ];
  for (const category of defaults) {
    await db.insert(documentTaxonomyCategories).values(category).onDuplicateKeyUpdate({ set: { description: category.description } });
  }
}

export async function deletePersistedDocumentMetadata(id: string) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable for document metadata deletion.");
  await db.delete(persistedDocumentMetadata).where(eq(persistedDocumentMetadata.id, id));
  return { success: true };
}

export async function listClientFilterPresets(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(clientFilterPresets)
    .where(eq(clientFilterPresets.userId, userId))
    .orderBy(desc(clientFilterPresets.updatedAt));
}

export async function saveClientFilterPreset(input: {
  userId: number;
  id?: string;
  name: string;
  category: string;
  tags: string[];
  search: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const id = input.id ?? `preset-${nanoid(12)}`;
  const tagsJson = JSON.stringify(input.tags);
  const [existing] = await db
    .select()
    .from(clientFilterPresets)
    .where(and(eq(clientFilterPresets.userId, input.userId), eq(clientFilterPresets.name, input.name)))
    .limit(1);

  if (existing && !input.id) {
    await db
      .update(clientFilterPresets)
      .set({
        category: input.category,
        tagsJson,
        search: input.search,
        updatedAt: new Date(),
      })
      .where(eq(clientFilterPresets.id, existing.id));
    const [updated] = await db
      .select()
      .from(clientFilterPresets)
      .where(eq(clientFilterPresets.id, existing.id))
      .limit(1);
    return updated;
  }

  await db
    .insert(clientFilterPresets)
    .values({
      id,
      userId: input.userId,
      name: input.name,
      category: input.category,
      tagsJson,
      search: input.search,
    })
    .onDuplicateKeyUpdate({
      set: {
        category: input.category,
        tagsJson,
        search: input.search,
      },
    });

  const [saved] = await db
    .select()
    .from(clientFilterPresets)
    .where(eq(clientFilterPresets.id, id))
    .limit(1);
  return saved;
}

export async function deleteClientFilterPreset(userId: number, name: string) {
  const db = await getDb();
  if (!db) return;
  await db
    .delete(clientFilterPresets)
    .where(and(eq(clientFilterPresets.userId, userId), eq(clientFilterPresets.name, name)));
}

export async function createDispatchRecord(data: {
  id: string;
  bookingId: string;
  dispatchedBy?: number | null;
  sentToEmail: string;
  subject: string;
  summary: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(dispatches).values({
    ...data,
    dispatchedBy: data.dispatchedBy ?? null,
    status: "Recorded",
  });
  const rows = await db
    .select()
    .from(dispatches)
    .where(eq(dispatches.id, data.id));
  return rows[0];
}

export async function getExpiryCheckLastRun() {
  const db = await getDb();
  if (!db) return null;
  const result = await db
    .select()
    .from(systemSettings)
    .where(eq(systemSettings.key, "expiry_check_last_run"))
    .limit(1);
  return result[0]?.value ?? null;
}

export async function runCertificateExpiryCheck(nowMs: number = Date.now()) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const { findExpiringDatedItems } = await import(
    "../shared/notificationAndExpiryRules"
  );
  const crew = await getAllCrew();
  const gears = await getAllLiftingGears();
  const assets = await getAllEquipment();
  const hits = findExpiringDatedItems(
    [
      ...crew.map(member => ({
        key: `crew-${member.id}`,
        label: `Crew certificate · ${member.name}`,
        expiry: member.certificateExpiry,
        ownerDepartment: "crew",
      })),
      ...gears.map(gear => ({
        key: `gear-${gear.id}`,
        label: `Lifting gear inspection · ${gear.name}`,
        expiry: gear.inspectionExpiry,
        ownerDepartment: "lifting-gears",
      })),
      ...assets.map(asset => ({
        key: `asset-${asset.id}`,
        label: `Equipment inspection · ${asset.name}`,
        expiry: asset.inspectionExpiry,
        ownerDepartment: "maintenance",
      })),
    ],
    nowMs,
    20
  );
  const today = new Date(nowMs).toISOString().slice(0, 10);
  let alerts = 0;
  for (const hit of hits) {
    const title =
      hit.status === "expired"
        ? `Certificate expired · ${hit.label}`
        : `Certificate expiring in ${hit.daysLeft}d · ${hit.label}`;
    const body = `${hit.label} expires ${hit.expiry}. Owner department: ${hit.ownerDepartment}.`;
    await addNotification({
      id: `expiry-${hit.key}-${today}`,
      userId: null,
      departmentCode: "hse",
      title,
      body,
    });
    if (hit.ownerDepartment !== "hse") {
      await addNotification({
        id: `expiry-${hit.key}-${today}-owner`,
        userId: null,
        departmentCode: hit.ownerDepartment,
        title,
        body,
      });
    }
    alerts += 1;
  }
  await db
    .insert(systemSettings)
    .values({ key: "expiry_check_last_run", value: today, updatedBy: null })
    .onDuplicateKeyUpdate({ set: { value: today, updatedBy: null } });
  return { ran: true, alerts, checkedAt: today };
}

export async function runCertificateExpiryCheckIfStale(
  nowMs: number = Date.now()
) {
  const lastRun = await getExpiryCheckLastRun();
  const today = new Date(nowMs).toISOString().slice(0, 10);
  if (lastRun === today) return { ran: false, alerts: 0, checkedAt: lastRun };
  return await runCertificateExpiryCheck(nowMs);
}

export async function createPortalToken(data: {
  id: string;
  tokenHash: string;
  bookingId: string;
  clientName: string;
  projectName: string;
  mobDate: string;
  offHireDate: string;
  priority: string;
  createdBy?: number | null;
  expiresAt: Date;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(clientPortalTokens).values({
    ...data,
    createdBy: data.createdBy ?? null,
  });
  const rows = await db
    .select()
    .from(clientPortalTokens)
    .where(eq(clientPortalTokens.id, data.id));
  return rows[0];
}

export async function getPortalTokenByHash(tokenHash: string) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db
    .select()
    .from(clientPortalTokens)
    .where(eq(clientPortalTokens.tokenHash, tokenHash))
    .limit(1);
  return rows[0];
}

export async function listPortalTokens(bookingId: string) {
  const db = await getDb();
  if (!db) return [];
  return await db
    .select({
      id: clientPortalTokens.id,
      bookingId: clientPortalTokens.bookingId,
      createdBy: clientPortalTokens.createdBy,
      expiresAt: clientPortalTokens.expiresAt,
      revokedAt: clientPortalTokens.revokedAt,
      createdAt: clientPortalTokens.createdAt,
    })
    .from(clientPortalTokens)
    .where(eq(clientPortalTokens.bookingId, bookingId))
    .orderBy(desc(clientPortalTokens.createdAt));
}

export async function revokePortalTokensForBooking(bookingId: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .update(clientPortalTokens)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(clientPortalTokens.bookingId, bookingId),
        isNull(clientPortalTokens.revokedAt)
      )
    );
  return await listPortalTokens(bookingId);
}
