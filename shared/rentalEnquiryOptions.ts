export const RENTAL_EQUIPMENT_TYPES = [
  "Mobile crane",
  "Crawler crane",
  "Rough-terrain crane",
  "Transport and trailers",
  "Lifting gear and rigging",
  "Managed lifting service",
] as const;

export const RENTAL_DURATION_OPTIONS = [
  "One day",
  "2–7 days",
  "1–4 weeks",
  "1–3 months",
  "More than 3 months",
  "To be confirmed",
] as const;

export type RentalEquipmentType = (typeof RENTAL_EQUIPMENT_TYPES)[number];
export type RentalDuration = (typeof RENTAL_DURATION_OPTIONS)[number];
