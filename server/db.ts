import { desc, eq, isNotNull } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { nanoid } from "nanoid";
import { 
  InsertUser, users, bookings, equipment, crew, liftingGears, trailers, documents, chatMessages, notifications
} from "../drizzle/schema";
import { ENV } from './_core/env';

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
      role: user.role ?? (user.openId === ENV.ownerOpenId ? 'admin' : 'user'),
      lastSignedIn: user.lastSignedIn ?? new Date(),
    };

    await db.insert(users).values(values).onDuplicateKeyUpdate({
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
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
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
  const result = await db.select().from(users).where(eq(users.localEmail, localEmail)).limit(1);
  return result[0];
}

export async function countLocalUsers() {
  const db = await getDb();
  if (!db) return 0;
  const result = await db.select().from(users).where(isNotNull(users.localEmail));
  return result.length;
}

export async function listLocalUsers() {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(users).where(isNotNull(users.localEmail)).orderBy(desc(users.createdAt));
}

export async function createLocalUser(input: {
  name: string;
  email: string;
  passwordHash: string;
  departmentCode: string;
  role: "admin" | "user";
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
  await db.update(users).set({ lastSignedIn: new Date() }).where(eq(users.id, id));
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
  const res = await db.select().from(bookings).where(eq(bookings.id, id)).limit(1);
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

export async function updateBookingAssignment(id: string, updates: { craneId?: string; crewIds?: string[]; gearIds?: string[]; trailerIds?: string[] }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(bookings).set(updates).where(eq(bookings.id, id));
  return await getBookingById(id);
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
  return await db.select().from(documents).where(eq(documents.bookingId, bookingId));
}

export async function upsertDocument(data: { id: string; bookingId: string; departmentCode: string; name: string; state: string; expiryDate?: string; required: number }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(documents).values(data).onDuplicateKeyUpdate({
    set: { state: data.state, expiryDate: data.expiryDate, name: data.name }
  });
  return data;
}

export async function getChatForBooking(bookingId: string) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(chatMessages).where(eq(chatMessages.bookingId, bookingId)).orderBy(chatMessages.createdAt);
}

export async function addChatMessage(data: { id: string; bookingId: string; team: string; sender: string; body: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(chatMessages).values(data);
  return data;
}

export async function getNotifications(departmentCode?: string) {
  const db = await getDb();
  if (!db) return [];
  if (departmentCode) {
    return await db.select().from(notifications).where(eq(notifications.departmentCode, departmentCode)).orderBy(desc(notifications.createdAt));
  }
  return await db.select().from(notifications).orderBy(desc(notifications.createdAt));
}

export async function addNotification(data: { id: string; departmentCode: string; title: string; body: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(notifications).values(data);
  return data;
}

export async function seedInitialDataIfNeeded() {
  const db = await getDb();
  if (!db) return;

  const eqList = await db.select().from(equipment).limit(1);
  if (eqList.length === 0) {
    const initialEquipment = [
      { id: "eq-1", assetCode: "B-205", name: "50T Mobile Crane · DEMAG", capacityTons: 50, status: "Available", inspectionExpiry: "2027-03-15", type: "Mobile Crane", registration: "60312" },
      { id: "eq-2", assetCode: "B-210", name: "35T Mobile Crane · PPM", capacityTons: 35, status: "Available", inspectionExpiry: "2027-06-20", type: "Mobile Crane", registration: "98274" },
      { id: "eq-3", assetCode: "B-213", name: "250T Mobile Crane · LTM", capacityTons: 250, status: "Assigned", inspectionExpiry: "2027-01-10", type: "Mobile Crane", registration: "92080" },
      { id: "eq-4", assetCode: "B-217", name: "350T Mobile Crane · LTM", capacityTons: 350, status: "Available", inspectionExpiry: "2027-09-01", type: "Mobile Crane", registration: "95095" },
      { id: "eq-5", assetCode: "B-218", name: "100T Lattice Crane", capacityTons: 100, status: "Available", inspectionExpiry: "2026-12-05", type: "Lattice Crane", registration: "71597" },
      { id: "eq-6", assetCode: "B-220", name: "50T Mobile Crane · SANY", capacityTons: 50, status: "Available", inspectionExpiry: "2027-04-12", type: "Mobile Crane", registration: "69009" },
      { id: "eq-7", assetCode: "B-221", name: "500T Mobile Crane · LTM", capacityTons: 500, status: "Available", inspectionExpiry: "2027-08-30", type: "Mobile Crane", registration: "63309" },
      { id: "eq-8", assetCode: "B-222", name: "130T Mobile Crane · LTM", capacityTons: 130, status: "Available", inspectionExpiry: "2027-05-18", type: "Mobile Crane", registration: "88999" },
      { id: "eq-9", assetCode: "B-224", name: "75T Mobile Crane · SANY", capacityTons: 75, status: "Available", inspectionExpiry: "2027-02-28", type: "Mobile Crane", registration: "65577" },
    ];
    for (const item of initialEquipment) {
      await db.insert(equipment).values(item).onDuplicateKeyUpdate({ set: item });
    }
  }

  const crewList = await db.select().from(crew).limit(1);
  if (crewList.length === 0) {
    const initialCrew = [
      { id: "cr-1", name: "Vineeth Vijayan", designation: "Crane Operator", availability: "Present", certificateExpiry: "2027-05-10", trainingRequired: 0 },
      { id: "cr-2", name: "Anoop Panikashery", designation: "Crane Operator", availability: "Assigned", certificateExpiry: "2026-11-15", trainingRequired: 0 },
      { id: "cr-3", name: "Vijayakumar", designation: "Rigger", availability: "Present", certificateExpiry: "2027-08-20", trainingRequired: 0 },
      { id: "cr-4", name: "Amal Krishnan", designation: "Rigger", availability: "Present", certificateExpiry: "2027-01-30", trainingRequired: 0 },
      { id: "cr-5", name: "ABDUL JALEEL", designation: "Rigger", availability: "Present", certificateExpiry: "2027-04-11", trainingRequired: 0 },
      { id: "cr-6", name: "ABI RENJU KUMAR", designation: "Crane Operator Assistant", availability: "Present", certificateExpiry: "2027-06-01", trainingRequired: 0 },
      { id: "cr-7", name: "ABHILASH UNNI", designation: "Rigger", availability: "Present", certificateExpiry: "2027-07-15", trainingRequired: 0 },
      { id: "cr-8", name: "ABHIRAM SUNEEF", designation: "Rigger", availability: "Present", certificateExpiry: "2027-03-22", trainingRequired: 0 },
      { id: "cr-9", name: "ABHISHEK KRISHNA", designation: "Crane Operator Assistant", availability: "Present", certificateExpiry: "2027-09-09", trainingRequired: 0 },
      { id: "cr-10", name: "ADERSH SREEKUMAR NAIR", designation: "Rigger", availability: "On Leave", certificateExpiry: "2027-02-14", trainingRequired: 1 },
      { id: "cr-11", name: "AMAL APPUKUTTAN", designation: "Rigger", availability: "Present", certificateExpiry: "2027-10-05", trainingRequired: 0 },
      { id: "cr-12", name: "AMARNADH BAIJU", designation: "Rigger", availability: "Off-Site", certificateExpiry: "2027-04-04", trainingRequired: 0 },
    ];
    for (const item of initialCrew) {
      await db.insert(crew).values(item).onDuplicateKeyUpdate({ set: item });
    }
  }

  const gearList = await db.select().from(liftingGears).limit(1);
  if (gearList.length === 0) {
    const initialGears = [
      { id: "g-1", name: "Heavy Shackle 50T Set", gearType: "Shackle", swlTons: 50, inspectionExpiry: "2027-06-01" },
      { id: "g-2", name: "Wire Rope Sling 20m", gearType: "Sling", swlTons: 25, inspectionExpiry: "2026-10-15" },
      { id: "g-3", name: "Spreader Beam 100T", gearType: "Spreader beam", swlTons: 100, inspectionExpiry: "2027-12-31" },
      { id: "g-4", name: "Webbing Sling 10T", gearType: "Sling", swlTons: 10, inspectionExpiry: "2027-03-30" },
    ];
    for (const item of initialGears) {
      await db.insert(liftingGears).values(item).onDuplicateKeyUpdate({ set: item });
    }
  }

  const trailerList = await db.select().from(trailers).limit(1);
  if (trailerList.length === 0) {
    const initialTrailers = [
      { id: "tr-1", plateNumber: "AD-55102", trailerType: "Flatbed", status: "Available" },
      { id: "tr-2", plateNumber: "DXB-8819", trailerType: "Lowboy", status: "Assigned" },
      { id: "tr-3", plateNumber: "SHJ-3341", trailerType: "Extendable", status: "Available" },
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
        { id: `${b.id}-d1`, bookingId: b.id, departmentCode: "DOC", name: "Client LPO & Contract", state: "Approved", required: 1 },
        { id: `${b.id}-d2`, bookingId: b.id, departmentCode: "HSE", name: "Third Party Crane Inspection", state: "Uploaded", required: 1 },
        { id: `${b.id}-d3`, bookingId: b.id, departmentCode: "LG", name: "Rigging Study & SWL Certification", state: "Required", required: 1 },
        { id: `${b.id}-d4`, bookingId: b.id, departmentCode: "CRW", name: "Operator Medical & License Verification", state: "Approved", required: 1 },
        { id: `${b.id}-d5`, bookingId: b.id, departmentCode: "ACC", name: "Advance Payment Receipt", state: "Uploaded", required: 1 },
      ];
      for (const d of docs) {
        await db.insert(documents).values(d).onDuplicateKeyUpdate({ set: d });
      }
    }
  }
}
