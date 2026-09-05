// Pure coordination rules for the Documentation Supervisor Console (PRD v3.0 §11).
// Side-effect free: safe for import by both client and server.

export type ConsoleCrewBucket =
  | "Operators"
  | "Riggers"
  | "Supervisors"
  | "Banksmen"
  | "Other";

export type TrainingFlagStatus = "OPEN" | "ACKNOWLEDGED" | "RESOLVED";

export type TrainingFlag = {
  id: string;
  bookingId: string;
  crewId: string;
  crewName: string;
  flagType: string;
  note: string;
  raisedBy: string;
  createdAt: string;
  status: TrainingFlagStatus;
};

export type CertLevel = "valid" | "expiring" | "expired" | "missing";

export type CertStatus = {
  level: CertLevel;
  detail: string;
};

export type CraneOption = {
  name: string;
  spec: string;
  status: "Available" | "Assigned" | "Maintenance";
  inspection: string;
};

export type TrailerOption = {
  id: string;
  plate: string;
  trailerType: "Flatbed" | "Lowboy" | "Extendable";
  status: "Available" | "Assigned" | "Off-Site";
  registrationExpiry: string;
};

export const TRAINING_FLAG_TYPES = [
  "Certificate renewal needed",
  "Site-required training missing",
  "Skill assessment",
  "Other",
] as const;

export const CRANE_OPTIONS: CraneOption[] = [
  {
    name: "200T Mobile Crane · B-205",
    spec: "LTM 1200 · 200T capacity",
    status: "Available",
    inspection: "Inspection valid · 15 Jan 2027",
  },
  {
    name: "250T Mobile Crane · B-213",
    spec: "LTM 1250 · 250T capacity",
    status: "Assigned",
    inspection: "Inspection valid · 06 Nov 2026",
  },
  {
    name: "350T Mobile Crane · B-217",
    spec: "LTM 1350 · 350T capacity",
    status: "Available",
    inspection: "Inspection valid · 23 Oct 2026",
  },
  {
    name: "100T Lattice Crane · B-140",
    spec: "LR 1100 · 100T capacity",
    status: "Available",
    inspection: "Inspection valid · 02 Sep 2026",
  },
  {
    name: "500T Mobile Crane · B-301",
    spec: "LTM 1500 · 500T capacity",
    status: "Maintenance",
    inspection: "Inspection expired · 18 Jul 2026",
  },
];

export const TRAILER_OPTIONS: TrailerOption[] = [
  {
    id: "tr-1",
    plate: "DXB T-4471",
    trailerType: "Lowboy",
    status: "Available",
    registrationExpiry: "12 Feb 2027",
  },
  {
    id: "tr-2",
    plate: "DXB T-8890",
    trailerType: "Flatbed",
    status: "Available",
    registrationExpiry: "30 Nov 2026",
  },
  {
    id: "tr-3",
    plate: "AUH T-2210",
    trailerType: "Extendable",
    status: "Assigned",
    registrationExpiry: "09 Jan 2027",
  },
  {
    id: "tr-4",
    plate: "DXB T-1104",
    trailerType: "Flatbed",
    status: "Available",
    registrationExpiry: "Expired · 22 Jul 2026",
  },
];

const MONTHS: Record<string, number> = {
  jan: 0,
  feb: 1,
  mar: 2,
  apr: 3,
  may: 4,
  jun: 5,
  jul: 6,
  aug: 7,
  sep: 8,
  oct: 9,
  nov: 10,
  dec: 11,
};

/** Parse fixture-style dates such as "12 Mar 2027" or "28 Sep 2026". */
export function parseFixtureDate(value: string): Date | null {
  const match = value.match(/(\d{1,2})\s+([A-Za-z]{3,9})\s+(\d{4})/);
  if (!match) return null;
  const month = MONTHS[match[2].slice(0, 3).toLowerCase()];
  if (month === undefined) return null;
  const date = new Date(Number(match[3]), month, Number(match[1]));
  return Number.isNaN(date.getTime()) ? null : date;
}

export function daysUntil(date: Date, nowMs: number): number {
  return Math.ceil((date.getTime() - nowMs) / 86_400_000);
}

function levelForDate(date: Date, nowMs: number): CertLevel {
  const days = daysUntil(date, nowMs);
  if (days < 0) return "expired";
  if (days <= 20) return "expiring";
  return "valid";
}

/**
 * Interpret crew certificate strings from the roster fixtures:
 * "Valid · 12 Mar 2027", "Renewal due in 16 days", "Training required".
 */
export function certStatus(cert: string, nowMs: number = Date.now()): CertStatus {
  const normalized = cert.trim();
  if (/training required/i.test(normalized)) {
    return { level: "missing", detail: "No valid certificate on record" };
  }
  if (/expired/i.test(normalized) && !/valid/i.test(normalized)) {
    const date = parseFixtureDate(normalized);
    return {
      level: "expired",
      detail: date ? `Expired ${date.toDateString()}` : "Certificate expired",
    };
  }
  const renewal = normalized.match(/renewal due in (\d+)\s*days?/i);
  if (renewal) {
    const days = Number(renewal[1]);
    return {
      level: days <= 0 ? "expired" : "expiring",
      detail:
        days <= 0 ? "Renewal overdue" : `Renewal due in ${days} day${days === 1 ? "" : "s"}`,
    };
  }
  const date = parseFixtureDate(normalized);
  if (!date) return { level: "missing", detail: "Expiry date unknown" };
  const level = levelForDate(date, nowMs);
  return {
    level,
    detail:
      level === "expired"
        ? `Expired ${date.toDateString()}`
        : level === "expiring"
          ? `Expiring ${date.toDateString()}`
          : `Valid · ${date.toDateString()}`,
  };
}

/** Interpret crane inspection strings such as "Inspection valid · 15 Jan 2027". */
export function inspectionStatus(
  label: string,
  nowMs: number = Date.now()
): CertStatus {
  const normalized = label.trim();
  if (/expired/i.test(normalized) && !/valid/i.test(normalized)) {
    return { level: "expired", detail: "Inspection expired" };
  }
  const date = parseFixtureDate(normalized);
  if (!date) return { level: "missing", detail: "Inspection date unknown" };
  const level = levelForDate(date, nowMs);
  return {
    level,
    detail:
      level === "expired"
        ? `Inspection expired ${date.toDateString()}`
        : level === "expiring"
          ? `Inspection expiring ${date.toDateString()}`
          : `Inspection valid · ${date.toDateString()}`,
  };
}

/** Registration strings such as "12 Feb 2027" or "Expired · 22 Jul 2026". */
export function registrationStatus(
  label: string,
  nowMs: number = Date.now()
): CertStatus {
  return inspectionStatus(label.replace("Registration", "Inspection"), nowMs);
}

export function roleBucket(role: string): ConsoleCrewBucket {
  const normalized = role.toLowerCase();
  if (normalized.includes("operator")) return "Operators";
  if (normalized.includes("rigger")) return "Riggers";
  if (normalized.includes("supervisor")) return "Supervisors";
  if (normalized.includes("banksman") || normalized.includes("banksmen"))
    return "Banksmen";
  return "Other";
}

export type ConsoleSelection = {
  craneName: string | null;
  craneBlocked: boolean;
  crewByBucket: Record<Exclude<ConsoleCrewBucket, "Other">, number>;
  extraCrew: number;
  gearCount: number;
  trailerCount: number;
  trailerRequired: boolean;
  expiredItems: string[];
};

export type ConsoleReadiness = {
  ready: boolean;
  blockers: string[];
};

/**
 * PRD §11.10 Confirm Coordination gate: crane selected and unblocked,
 * ≥1 operator / rigger / supervisor / banksman, ≥1 lifting gear,
 * ≥1 trailer when required, and no expired certificates in the selection.
 */
export function consoleReadiness(selection: ConsoleSelection): ConsoleReadiness {
  const blockers: string[] = [];
  if (!selection.craneName) blockers.push("Select a crane with a valid inspection certificate.");
  if (selection.craneBlocked)
    blockers.push("The selected crane has an expired inspection certificate.");
  if (selection.crewByBucket.Operators < 1)
    blockers.push("Assign at least one crane operator.");
  if (selection.crewByBucket.Riggers < 1)
    blockers.push("Assign at least one rigger.");
  if (selection.crewByBucket.Supervisors < 1)
    blockers.push("Assign at least one site supervisor.");
  if (selection.crewByBucket.Banksmen < 1)
    blockers.push("Assign at least one banksman.");
  if (selection.gearCount < 1)
    blockers.push("Select at least one lifting gear with a valid inspection.");
  if (selection.trailerRequired && selection.trailerCount < 1)
    blockers.push("Select at least one trailer with a valid registration.");
  for (const item of selection.expiredItems) {
    blockers.push(`${item} has an expired certificate and cannot stay in the selection.`);
  }
  return { ready: blockers.length === 0, blockers };
}

export function nextFlagId(existing: TrainingFlag[]): string {
  return `tflag-${existing.length + 1}-${Date.now()}`;
}

export type TrainingFlagAction = "acknowledge" | "resolve";

/**
 * Persisted training-flag lifecycle: OPEN → ACKNOWLEDGED → RESOLVED.
 * HSE may resolve directly from OPEN once training is scheduled or the
 * certificate is renewed. Anything else is rejected.
 */
export function transitionTrainingFlagStatus(
  current: TrainingFlagStatus,
  action: TrainingFlagAction
): "ACKNOWLEDGED" | "RESOLVED" {
  if (action === "acknowledge") {
    if (current !== "OPEN")
      throw new Error(`Only an OPEN flag can be acknowledged (was ${current}).`);
    return "ACKNOWLEDGED";
  }
  if (current === "RESOLVED")
    throw new Error("This flag is already resolved.");
  return "RESOLVED";
}
