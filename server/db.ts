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
  bookings,
  bookingCrewAllocations,
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
    lastSignedIn: new Date(),
  });

  const user = await getUserByLocalEmail(input.email);
  if (!user) throw new Error("Account was created but could not be retrieved.");
  return user;
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

export async function getAllEquipment() {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(equipment);
}

export async function getAllCrew() {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(crew);
}

export async function getAllLiftingGears() {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(liftingGears);
}

export async function getAllTrailers() {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(trailers);
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
  liftDetails: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const id = `rental-enquiry-${nanoid(14)}`;
  await db.insert(rentalEnquiries).values({ id, ...input, status: "New" });
  return { id, status: "New" as const };
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
          departmentCode: "DOC",
          name: "Client LPO & Contract",
          state: "Approved",
          required: 1,
        },
        {
          id: `${b.id}-d2`,
          bookingId: b.id,
          departmentCode: "HSE",
          name: "Third Party Crane Inspection",
          state: "Uploaded",
          required: 1,
        },
        {
          id: `${b.id}-d3`,
          bookingId: b.id,
          departmentCode: "LG",
          name: "Rigging Study & SWL Certification",
          state: "Required",
          required: 1,
        },
        {
          id: `${b.id}-d4`,
          bookingId: b.id,
          departmentCode: "CRW",
          name: "Operator Medical & License Verification",
          state: "Approved",
          required: 1,
        },
        {
          id: `${b.id}-d5`,
          bookingId: b.id,
          departmentCode: "ACC",
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
