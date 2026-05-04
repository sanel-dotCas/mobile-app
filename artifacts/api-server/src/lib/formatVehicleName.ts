/**
 * Returns the vehicle display name in canonical "Year Make Model" format.
 * Parts that are null/undefined/empty are omitted, so the result is always
 * a clean space-joined string (e.g. "2021 Honda Accord").
 */
export function formatVehicleName(
  vehicle: { year?: string | number | null; make?: string | null; model?: string | null } | null | undefined
): string {
  if (!vehicle) return "Unknown";
  return [vehicle.year, vehicle.make, vehicle.model]
    .filter((p): p is string | number => p !== null && p !== undefined && p !== "")
    .join(" ") || "Unknown";
}
