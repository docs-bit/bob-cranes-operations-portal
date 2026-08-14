import type { FleetVehicle } from "./vehicleFleetData";

export type VehicleRegistrationStatus = "Expired" | "Expiring soon" | "Valid" | "Unknown";

export function parseMulkiyaExpiry(value: string): Date | null {
  const match = value.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return null;
  const [, day, month, year] = match;
  const parsed = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function vehicleRegistrationStatus(expiry: string, asOf = new Date()): VehicleRegistrationStatus {
  const expiryDate = parseMulkiyaExpiry(expiry);
  if (!expiryDate) return "Unknown";
  const start = Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth(), asOf.getUTCDate());
  const daysUntilExpiry = Math.floor((expiryDate.getTime() - start) / 86_400_000);
  if (daysUntilExpiry < 0) return "Expired";
  if (daysUntilExpiry <= 60) return "Expiring soon";
  return "Valid";
}

export function filterVehicleFleet(
  vehicles: FleetVehicle[],
  search: string,
  type: string,
  status: VehicleRegistrationStatus | "All",
  asOf = new Date(),
): FleetVehicle[] {
  const query = search.trim().toLowerCase();
  return vehicles.filter((vehicle) => {
    const matchesQuery = !query || [vehicle.fleetCode, vehicle.registrationNumber, vehicle.fleetName, vehicle.vehicleModel, vehicle.chassisNumber]
      .some((value) => value.toLowerCase().includes(query));
    const matchesType = type === "All" || vehicle.fleetName === type;
    const matchesStatus = status === "All" || vehicleRegistrationStatus(vehicle.mulkiyaExpiry, asOf) === status;
    return matchesQuery && matchesType && matchesStatus;
  });
}
