export const BOOKING_STAGES = [
  "Created by Salesperson",
  "Documentation Supervisor",
  "Crew Assigned",
  "Gear Confirmed",
  "Docs In Progress",
  "All Docs Submitted",
  "Reviewed",
  "Dispatched",
] as const;

export type BookingStage = (typeof BOOKING_STAGES)[number];
export type PriorityTier = "Standard" | "High" | "Critical";
export type Availability = "Present" | "On Leave" | "Assigned" | "Off-Site";
export type DocumentState = "Required" | "Uploaded" | "Approved" | "Revision Required";

export type DepartmentCode = "SAL" | "DOC" | "LG" | "MNT" | "CRW" | "HSE" | "ACC" | "HR" | "TRN" | "ADM";
export type Department = { code: DepartmentCode; name: string; active: boolean };
export type CraneAsset = { id: string; assetCode: string; name: string; capacityTons: number; status: "Available" | "Assigned" | "Maintenance"; inspectionExpiry: string };
export type CrewMember = { id: string; name: string; designation: string; availability: Availability; certificateExpiry: string; trainingRequired: boolean };
export type LiftingGear = { id: string; name: string; gearType: "Shackle" | "Sling" | "Spreader beam" | "Hook"; swlTons: number; inspectionExpiry: string };
export type TrailerAsset = { id: string; plateNumber: string; trailerType: "Flatbed" | "Lowboy" | "Extendable"; status: "Available" | "Assigned" | "Off-Site" };
export type DocumentItem = { id: string; departmentCode: DepartmentCode; name: string; state: DocumentState; expiryDate?: string; required: boolean };
export type ChatMessage = { id: string; team: "Documentation" | "HSE" | "Sales" | "Accounts" | "Operations Management"; sender: string; body: string; createdAt: string };
export type Notification = { id: string; departmentCode: DepartmentCode; title: string; body: string; read: boolean; createdAt: string };
export type BookingDossier = { id: string; clientName: string; projectName: string; projectManager: string; lpoReference: string; mobilizationDate: string; offHireDate: string; clientContactName: string; clientEmail: string; clientPhone: string; priority: PriorityTier; stage: BookingStage; craneId?: string; crewIds: string[]; gearIds: string[]; trailerIds: string[]; documents: DocumentItem[]; chat: ChatMessage[]; notifications: Notification[] };

export const DEPARTMENTS: Department[] = [
  { code: "SAL", name: "Sales & Client Relations", active: true },
  { code: "DOC", name: "Documentation & Permits", active: true },
  { code: "LG", name: "Lifting Gears / Engineering", active: true },
  { code: "MNT", name: "Maintenance", active: true },
  { code: "CRW", name: "Crew / Workmen Assignment", active: true },
  { code: "HSE", name: "HSE / Safety", active: true },
  { code: "ACC", name: "Accounts", active: true },
  { code: "HR", name: "HR", active: true },
  { code: "TRN", name: "Transportation", active: true },
  { code: "ADM", name: "Administrator / Super Admin", active: true },
];

export const STAGE_ROLES: Record<BookingStage, string> = {
  "Created by Salesperson": "Salesperson",
  "Documentation Supervisor": "Documentation Supervisor",
  "Crew Assigned": "Crew Assignment",
  "Gear Confirmed": "Lifting Gears",
  "Docs In Progress": "Department users",
  "All Docs Submitted": "Documentation",
  Reviewed: "Salesperson",
  Dispatched: "Documentation",
};

export function canAdvanceStage(current: BookingStage, next: BookingStage, actorRole: string) {
  const currentIndex = BOOKING_STAGES.indexOf(current);
  const nextIndex = BOOKING_STAGES.indexOf(next);
  return nextIndex === currentIndex + 1 && STAGE_ROLES[next] === actorRole;
}

export function revisionReversionStage(department: "Documentation" | "HSE" | "Sales" | "Accounts" | "Operations Management") {
  return department === "Sales" ? "Reviewed" : "Docs In Progress" as BookingStage;
}

export type LifecycleNotification = { departmentCode: DepartmentCode; title: string; body: string };

export function transitionBooking(current: BookingStage, next: BookingStage, actorRole: string) {
  if (!canAdvanceStage(current, next, actorRole)) {
    throw new Error(`Role ${actorRole} cannot advance ${current} to ${next}`);
  }
  const notifications: LifecycleNotification[] = [
    { departmentCode: "SAL", title: `Booking moved to ${next}`, body: `The dossier is now owned by ${STAGE_ROLES[next]}.` },
    { departmentCode: "DOC", title: `Booking ${next}`, body: "Documentation Supervisor coordination queue updated." },
  ];
  if (next === "Docs In Progress") {
    notifications.push(...DEPARTMENTS.filter((department) => department.code !== "ADM").map((department) => ({ departmentCode: department.code, title: "New booking action", body: "A new dossier requires your department documents." })));
  }
  return { stage: next, notifications };
}

export function revertBooking(current: BookingStage, target: "Docs In Progress" | "Reviewed", departmentCode: DepartmentCode) {
  const currentIndex = BOOKING_STAGES.indexOf(current);
  const targetIndex = BOOKING_STAGES.indexOf(target);
  if (targetIndex >= currentIndex) throw new Error(`Cannot revert ${current} to ${target}`);
  return {
    stage: target,
    notifications: [
      { departmentCode, title: "Revision required", body: `A document review moved the dossier back to ${target}.` },
      { departmentCode: "DOC" as DepartmentCode, title: "Dossier status reverted", body: `Coordinate the next action for ${target}.` },
    ] satisfies LifecycleNotification[],
  };
}

export function isGearSelectionBlocked(inspectionExpiry: Date, mobilization: Date) {
  return inspectionExpiry.getTime() < mobilization.getTime();
}

export function documentCompletion(documents: DocumentItem[]) {
  const required = documents.filter((item) => item.required);
  if (!required.length) return 100;
  const complete = required.filter((item) => item.state === "Uploaded" || item.state === "Approved").length;
  return Math.round((complete / required.length) * 100);
}

export function departmentCompletion(documents: DocumentItem[], departmentCode: DepartmentCode) {
  return documentCompletion(documents.filter((item) => item.departmentCode === departmentCode));
}

export function canDispatch(stage: BookingStage, allDepartmentsComplete: boolean, hasRevisionFlags: boolean) {
  return stage === "Reviewed" && allDepartmentsComplete && !hasRevisionFlags;
}
