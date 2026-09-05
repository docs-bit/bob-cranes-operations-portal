// Pure dossier date helpers for the Sales wizard and booking validation.
// Side-effect free: safe for import by both client and server.

const MONTHS_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** "2026-08-11" -> "11 Aug 2026". Returns "" when unparseable. */
export function formatDossierDate(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!match) return "";
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return "";
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  )
    return "";
  return `${day} ${MONTHS_SHORT[month - 1]} ${year}`;
}

/** Accepts "2026-08-11" and "11 Aug 2026". Returns null when unparseable. */
export function parseDossierDate(value: string): Date | null {
  const text = value.trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (iso) {
    const date = new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
    return Number.isNaN(date.getTime()) ? null : date;
  }
  const display = /^(\d{1,2})\s+([A-Za-z]{3,9})\s+(\d{4})$/.exec(text);
  if (display) {
    const month = MONTHS_SHORT.findIndex(
      (name) => name.toLowerCase() === display[2].slice(0, 3).toLowerCase()
    );
    if (month === -1) return null;
    const date = new Date(Number(display[3]), month, Number(display[1]));
    return Number.isNaN(date.getTime()) ? null : date;
  }
  return null;
}

export type DossierFieldErrors = {
  client?: string;
  email?: string;
  mob?: string;
  offHire?: string;
};

/** Field-level errors for the Sales intake form. Empty object = valid. */
export function validateDossierInput(input: {
  client: string;
  email: string;
  mob: string;
  offHire: string;
}): DossierFieldErrors {
  const errors: DossierFieldErrors = {};
  if (!input.client.trim()) errors.client = "Client name is required.";
  if (!EMAIL_PATTERN.test(input.email.trim()))
    errors.email = "Enter a valid work email.";
  const mob = parseDossierDate(input.mob);
  const offHire = parseDossierDate(input.offHire);
  if (!mob) errors.mob = "Enter a valid mobilization date.";
  if (!offHire) errors.offHire = "Enter a valid off-hire date.";
  if (mob && offHire && offHire.getTime() <= mob.getTime())
    errors.offHire = "Off-hire must be after mobilization.";
  return errors;
}
