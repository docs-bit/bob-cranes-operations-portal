import "dotenv/config";
import { drizzle } from "drizzle-orm/mysql2";
import { eq } from "drizzle-orm";
import { hashPassword } from "../server/localAuth";
import {
  auditLogs,
  bookingCrewAllocations,
  bookings,
  chatMessages,
  clientFeedback,
  crew,
  departments,
  departmentDashboards,
  documents,
  equipment,
  liftingGears,
  notifications,
  rentalEnquiries,
  rentalEnquiryEvents,
  systemSettings,
  telemetryEvents,
  trailers,
  userActivityLogs,
  users,
} from "../drizzle/schema";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required to seed the sample database.");

const db = drizzle(databaseUrl);
const now = new Date();
const demoPassword = process.env.SAMPLE_DB_PASSWORD ?? "Demo123!";

async function seed() {
  const passwordHash = await hashPassword(demoPassword);

  await db.transaction(async (tx) => {
    await tx.insert(departments).values([
      { code: "SALES", name: "Sales", active: 1 },
      { code: "OPS", name: "Operations", active: 1 },
      { code: "HSE", name: "Health, Safety & Environment", active: 1 },
      { code: "DOC", name: "Documentation", active: 1 },
      { code: "ACCOUNTS", name: "Accounts", active: 1 },
      { code: "GEAR", name: "Lifting Gears", active: 1 },
      { code: "TRAILERS", name: "Trailers & Transport", active: 1 },
    ]).onDuplicateKeyUpdate({ set: { name: departments.name, active: departments.active } });

    await tx.insert(users).values([
      { openId: "sample-admin", name: "Amina Rahman", email: "amina.rahman@bobcranes.example", localEmail: "admin@bobcranes.demo", passwordHash, departmentCode: "OPS", role: "admin", loginMethod: "password", companyName: "BOB Cranes", phone: "+971 50 555 0101", isActive: 1, lastSignedIn: now },
      { openId: "sample-sales", name: "Daniel Mensah", email: "daniel.mensah@bobcranes.example", localEmail: "sales@bobcranes.demo", passwordHash, departmentCode: "SALES", role: "supervisor", loginMethod: "password", companyName: "BOB Cranes", phone: "+971 50 555 0102", isActive: 1, lastSignedIn: now },
      { openId: "sample-hse", name: "Leila Haddad", email: "leila.haddad@bobcranes.example", localEmail: "hse@bobcranes.demo", passwordHash, departmentCode: "HSE", role: "supervisor", loginMethod: "password", companyName: "BOB Cranes", phone: "+971 50 555 0103", isActive: 1, lastSignedIn: now },
      { openId: "sample-ops", name: "Joseph Okafor", email: "joseph.okafor@bobcranes.example", localEmail: "operations@bobcranes.demo", passwordHash, departmentCode: "OPS", role: "user", loginMethod: "password", companyName: "BOB Cranes", phone: "+971 50 555 0104", isActive: 1, lastSignedIn: now },
    ]).onDuplicateKeyUpdate({ set: { name: users.name, passwordHash, departmentCode: users.departmentCode, role: users.role, isActive: 1, lastSignedIn: now } });

    const adminRows = await tx.select({ id: users.id, openId: users.openId }).from(users).where(eq(users.openId, "sample-admin"));
    const adminId = adminRows[0]?.id ?? null;
    if (!adminId) throw new Error("Unable to resolve sample admin user.");

    await tx.insert(equipment).values([
      { id: "crane-tt-001", assetCode: "BOB-CR-001", name: "Liebherr LTM 1120-4.1", capacityTons: 120, status: "Available", inspectionExpiry: "2026-12-18", type: "Mobile Crane", registration: "DXB-C 1201" },
      { id: "crane-tt-002", assetCode: "BOB-CR-002", name: "Tadano GR-1000XL", capacityTons: 100, status: "On Hire", inspectionExpiry: "2026-10-05", type: "Rough Terrain Crane", registration: "DXB-C 1002" },
      { id: "crane-tt-003", assetCode: "BOB-CR-003", name: "Grove GMK6300L", capacityTons: 300, status: "Maintenance", inspectionExpiry: "2027-01-22", type: "All Terrain Crane", registration: "DXB-C 3003" },
      { id: "crane-tt-004", assetCode: "BOB-CR-004", name: "Kobelco CKE2500G", capacityTons: 250, status: "Available", inspectionExpiry: "2026-11-30", type: "Crawler Crane", registration: "DXB-C 2504" },
    ]).onDuplicateKeyUpdate({ set: { name: equipment.name, capacityTons: equipment.capacityTons, status: equipment.status, inspectionExpiry: equipment.inspectionExpiry, type: equipment.type, registration: equipment.registration } });

    await tx.insert(crew).values([
      { id: "crew-001", name: "Musa Al-Hassan", designation: "Crane Operator", availability: "Present", certificateExpiry: "2027-03-14", trainingRequired: 0 },
      { id: "crew-002", name: "Ravi Kumar", designation: "Rigger", availability: "Present", certificateExpiry: "2026-09-28", trainingRequired: 0 },
      { id: "crew-003", name: "Sarah Njeri", designation: "Banksman", availability: "Assigned", certificateExpiry: "2026-12-11", trainingRequired: 0 },
      { id: "crew-004", name: "Omar Suleiman", designation: "Site Supervisor", availability: "Present", certificateExpiry: "2026-08-31", trainingRequired: 1 },
      { id: "crew-005", name: "Peter Mwangi", designation: "Crane Operator", availability: "Leave", certificateExpiry: "2027-02-19", trainingRequired: 0 },
      { id: "crew-006", name: "Nadia Bello", designation: "Rigger", availability: "Present", certificateExpiry: "2026-10-17", trainingRequired: 0 },
    ]).onDuplicateKeyUpdate({ set: { name: crew.name, designation: crew.designation, availability: crew.availability, certificateExpiry: crew.certificateExpiry, trainingRequired: crew.trainingRequired } });

    await tx.insert(liftingGears).values([
      { id: "gear-001", name: "32T Web Sling Set", gearType: "Web Sling", swlTons: 32, inspectionExpiry: "2026-12-20" },
      { id: "gear-002", name: "25T Bow Shackle Set", gearType: "Shackle", swlTons: 25, inspectionExpiry: "2026-10-09" },
      { id: "gear-003", name: "50T Spreader Beam", gearType: "Spreader Beam", swlTons: 50, inspectionExpiry: "2026-08-12" },
      { id: "gear-004", name: "10T Chain Block Set", gearType: "Chain Block", swlTons: 10, inspectionExpiry: "2027-01-18" },
    ]).onDuplicateKeyUpdate({ set: { name: liftingGears.name, gearType: liftingGears.gearType, swlTons: liftingGears.swlTons, inspectionExpiry: liftingGears.inspectionExpiry } });

    await tx.insert(trailers).values([
      { id: "trailer-001", plateNumber: "DXB-T 4812", trailerType: "Extendable Flatbed", status: "Available" },
      { id: "trailer-002", plateNumber: "DXB-T 4813", trailerType: "Low Loader", status: "On Hire" },
      { id: "trailer-003", plateNumber: "DXB-T 4814", trailerType: "Flatbed", status: "Available" },
    ]).onDuplicateKeyUpdate({ set: { plateNumber: trailers.plateNumber, trailerType: trailers.trailerType, status: trailers.status } });

    await tx.insert(bookings).values([
      { id: "BK-2026-001", clientName: "Gulf Petrochem Services", projectName: "Jebel Ali Tank Farm Expansion", projectManager: "Mariam Al-Suwaidi", lpoReference: "GPS-LPO-7842", mobilizationDate: "2026-08-28", offHireDate: "2026-09-12", clientContactName: "Hassan Qureshi", clientEmail: "hassan.qureshi@gulfpetrochem.example", clientPhone: "+971 55 220 1101", priority: "High", stage: "HSE Clearance", craneId: "crane-tt-002", crewIds: ["crew-003", "crew-004"], gearIds: ["gear-001", "gear-002"], trailerIds: ["trailer-002"] },
      { id: "BK-2026-002", clientName: "Emirates Infrastructure JV", projectName: "Al Quoz Flyover Package B", projectManager: "Thomas Reed", lpoReference: "EIJV-LPO-2281", mobilizationDate: "2026-09-03", offHireDate: "2026-10-22", clientContactName: "Khalid Al-Mansoori", clientEmail: "khalid@eijv.example", clientPhone: "+971 52 410 2240", priority: "Standard", stage: "Created by Salesperson", craneId: "crane-tt-001", crewIds: ["crew-001", "crew-002"], gearIds: ["gear-001", "gear-004"], trailerIds: ["trailer-001"] },
      { id: "BK-2026-003", clientName: "Red Sea Offshore Logistics", projectName: "Mussafah Heavy Lift Campaign", projectManager: "Noura Fadel", lpoReference: "RSOL-PO-1190", mobilizationDate: "2026-08-24", offHireDate: "2026-08-30", clientContactName: "Victor Mensah", clientEmail: "victor@rsol.example", clientPhone: "+971 50 771 4432", priority: "Urgent", stage: "Operations Review", craneId: "crane-tt-004", crewIds: ["crew-001", "crew-006"], gearIds: ["gear-002", "gear-004"], trailerIds: ["trailer-003"] },
      { id: "BK-2026-004", clientName: "Atlas Renewables", projectName: "Solar Plant Phase 4", projectManager: "Elena Petrova", lpoReference: "ATLAS-PO-4407", mobilizationDate: "2026-09-15", offHireDate: "2026-11-15", clientContactName: "Yousef Karim", clientEmail: "yousef@atlasrenewables.example", clientPhone: "+971 56 333 9021", priority: "Standard", stage: "Completed", craneId: "crane-tt-001", crewIds: ["crew-002", "crew-004"], gearIds: ["gear-001", "gear-004"], trailerIds: ["trailer-001"] },
    ]).onDuplicateKeyUpdate({ set: { clientName: bookings.clientName, projectName: bookings.projectName, stage: bookings.stage, priority: bookings.priority, craneId: bookings.craneId, crewIds: bookings.crewIds, gearIds: bookings.gearIds, trailerIds: bookings.trailerIds, updatedAt: now } });

    await tx.insert(bookingCrewAllocations).values([
      { bookingId: "BK-2026-001", crewId: "crew-003", crewName: "Sarah Njeri", assignedBy: adminId },
      { bookingId: "BK-2026-001", crewId: "crew-004", crewName: "Omar Suleiman", assignedBy: adminId },
      { bookingId: "BK-2026-002", crewId: "crew-001", crewName: "Musa Al-Hassan", assignedBy: adminId },
      { bookingId: "BK-2026-002", crewId: "crew-002", crewName: "Ravi Kumar", assignedBy: adminId },
      { bookingId: "BK-2026-003", crewId: "crew-001", crewName: "Musa Al-Hassan", assignedBy: adminId },
      { bookingId: "BK-2026-003", crewId: "crew-006", crewName: "Nadia Bello", assignedBy: adminId },
    ]);

    await tx.insert(documents).values([
      { id: "doc-001", bookingId: "BK-2026-001", departmentCode: "HSE", name: "Lift Plan & Method Statement", state: "In review", expiryDate: "2026-09-12", required: 1 },
      { id: "doc-002", bookingId: "BK-2026-001", departmentCode: "GEAR", name: "Lifting Gear Certificates", state: "Approved", expiryDate: "2026-12-20", required: 1 },
      { id: "doc-003", bookingId: "BK-2026-001", departmentCode: "DOC", name: "Operator Competency Cards", state: "Required", expiryDate: null, required: 1 },
      { id: "doc-004", bookingId: "BK-2026-002", departmentCode: "SALES", name: "Signed LPO", state: "Uploaded", expiryDate: null, required: 1 },
      { id: "doc-005", bookingId: "BK-2026-002", departmentCode: "ACCOUNTS", name: "Credit Approval", state: "Required", expiryDate: null, required: 1 },
      { id: "doc-006", bookingId: "BK-2026-003", departmentCode: "OPS", name: "Site Access Pack", state: "Approved", expiryDate: "2026-08-30", required: 1 },
    ]).onDuplicateKeyUpdate({ set: { state: documents.state, expiryDate: documents.expiryDate, name: documents.name } });

    await tx.insert(chatMessages).values([
      { id: "chat-001", bookingId: "BK-2026-001", team: "HSE", sender: "Leila Haddad", body: "Please upload the final exclusion-zone sketch before clearance.", createdAt: now },
      { id: "chat-002", bookingId: "BK-2026-001", team: "Operations", sender: "Joseph Okafor", body: "Crane and trailer allocation is held for the mobilization window.", createdAt: now },
      { id: "chat-003", bookingId: "BK-2026-003", team: "Client", sender: "Victor Mensah", body: "Gate pass details will be shared by 16:00 today.", createdAt: now },
    ]).onDuplicateKeyUpdate({ set: { body: chatMessages.body, team: chatMessages.team, sender: chatMessages.sender } });

    await tx.insert(notifications).values([
      { id: 1, userId: adminId, departmentCode: "HSE", title: "Certificate review due", body: "One crew certificate expires within 14 days.", read: 0 },
      { id: 2, userId: adminId, departmentCode: "OPS", title: "Urgent mobilization", body: "BK-2026-003 requires operations review before mobilization.", read: 0 },
      { id: 3, userId: adminId, departmentCode: "GEAR", title: "Inspection exception", body: "Gear-003 has an expired inspection date and is blocked from assignment.", read: 0 },
    ]).onDuplicateKeyUpdate({ set: { title: notifications.title, body: notifications.body, read: 0 } });

    await tx.insert(rentalEnquiries).values([
      { id: "ENQ-2026-001", contactName: "Mina Joseph", companyName: "Northstar Industrial", email: "mina@northstar.example", phone: "+971 55 112 8811", projectLocation: "Dubai Industrial City", equipmentInterest: "250T Crawler Crane", rentalDuration: "6 weeks", liftDetails: "Factory roof truss installation; night lifts required.", status: "New", assignedToUserId: adminId },
      { id: "ENQ-2026-002", contactName: "Faisal Khan", companyName: "Metroline Contracting", email: "faisal@metroline.example", phone: "+971 52 883 4410", projectLocation: "Sharjah", equipmentInterest: "100T Rough Terrain Crane", rentalDuration: "12 days", liftDetails: "Bridge beam placement with restricted access.", status: "In review", assignedToUserId: adminId },
    ]).onDuplicateKeyUpdate({ set: { status: rentalEnquiries.status, assignedToUserId: rentalEnquiries.assignedToUserId, liftDetails: rentalEnquiries.liftDetails } });

    await tx.insert(rentalEnquiryEvents).values([
      { id: "ENQ-EVENT-001", rentalEnquiryId: "ENQ-2026-001", actorUserId: adminId, eventType: "created", summary: "New rental enquiry received from Northstar Industrial.", createdAt: now },
      { id: "ENQ-EVENT-002", rentalEnquiryId: "ENQ-2026-002", actorUserId: adminId, eventType: "assigned", summary: "Enquiry assigned to Operations for availability review.", createdAt: now },
    ]).onDuplicateKeyUpdate({ set: { summary: rentalEnquiryEvents.summary, eventType: rentalEnquiryEvents.eventType } });

    await tx.insert(systemSettings).values([
      { key: "activity_log_retention_days", value: "365", updatedBy: adminId },
      { key: "dashboard_greeting_template", value: "Welcome back, {name}", updatedBy: adminId },
    ]).onDuplicateKeyUpdate({ set: { value: systemSettings.value, updatedBy: adminId } });

    await tx.insert(clientFeedback).values([
      { id: "feedback-sample-001", bookingId: "BK-2026-001", category: "Documentation", message: "Client requested a single downloadable compliance bundle.", contactEmail: "hassan.qureshi@gulfpetrochem.example", status: "Open" },
      { id: "feedback-sample-002", bookingId: "BK-2026-004", category: "Service", message: "Mobilization was completed ahead of the planned window.", contactEmail: "yousef@atlasrenewables.example", status: "Resolved" },
    ]).onDuplicateKeyUpdate({ set: { message: clientFeedback.message, status: clientFeedback.status, category: clientFeedback.category } });

    await tx.insert(userActivityLogs).values([
      { userId: adminId, action: "sample_data_loaded", detail: "Sample operations dataset initialized for the portal." },
      { userId: adminId, action: "booking_reviewed", detail: "Reviewed BK-2026-003 operations readiness." },
      { userId: adminId, action: "crew_assignment_updated", detail: "Assigned Musa Al-Hassan and Nadia Bello to BK-2026-003." },
    ]);

    await tx.insert(telemetryEvents).values([
      { id: "tel-sample-001", metricName: "LCP", metricValue: "1.8", path: "/overview", userId: adminId },
      { id: "tel-sample-002", metricName: "CLS", metricValue: "0.04", path: "/overview", userId: adminId },
      { id: "tel-sample-003", metricName: "FID", metricValue: "42", path: "/bookings", userId: adminId },
    ]).onDuplicateKeyUpdate({ set: { metricValue: telemetryEvents.metricValue, path: telemetryEvents.path } });

    await tx.insert(auditLogs).values([
      { id: "audit-sample-001", actor: "Amina Rahman", action: "sample_database_initialized", details: "Demo records loaded for BOB Cranes Operations Portal." },
      { id: "audit-sample-002", actor: "Amina Rahman", action: "booking_created", details: "Created sample booking BK-2026-001." },
    ]).onDuplicateKeyUpdate({ set: { details: auditLogs.details, action: auditLogs.action } });

    await tx.insert(departmentDashboards).values([
      { departmentCode: "OPS", description: "Live mobilization, crew, crane, and transport readiness.", accent: "red", icon: "Truck", dashboardConfig: { cards: ["activeBookings", "crewAvailability", "fleetStatus", "urgentActions"] }, createdBy: adminId },
      { departmentCode: "HSE", description: "Compliance, certificates, and safety clearance tracking.", accent: "green", icon: "ShieldCheck", dashboardConfig: { cards: ["openClearances", "expiringCertificates", "incidentLog"] }, createdBy: adminId },
    ]).onDuplicateKeyUpdate({ set: { description: departmentDashboards.description, accent: departmentDashboards.accent, icon: departmentDashboards.icon, dashboardConfig: departmentDashboards.dashboardConfig, updatedAt: now } });
  });

  console.log(`Sample database seeded successfully. Demo login: admin@bobcranes.demo / ${demoPassword}`);
}

seed().catch((error) => {
  console.error("Sample database seed failed:", error);
  process.exitCode = 1;
});
