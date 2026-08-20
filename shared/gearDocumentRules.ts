export type GearComplianceStatus = "Compliant" | "Expired";

export function isValidGearDocumentPeriod(validFrom: string, validUntil: string) {
  if (!validFrom || !validUntil) return false;
  return validUntil >= validFrom;
}

export function gearDocumentStatus(validUntil: string, today = new Date()) : GearComplianceStatus {
  const validityEnd = new Date(`${validUntil}T23:59:59`);
  if (Number.isNaN(validityEnd.getTime())) return "Expired";
  return validityEnd.getTime() < today.getTime() ? "Expired" : "Compliant";
}

export function canSelectGearForBooking(status: GearComplianceStatus) {
  return status === "Compliant";
}

export function formatGearValidityDate(value: string) {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(date);
}
