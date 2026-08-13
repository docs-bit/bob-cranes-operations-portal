export type ActivityExportRow = {
  id: number;
  userId: number;
  userName: string | null;
  userEmail: string | null;
  departmentCode: string | null;
  action: string;
  detail: string;
  createdAt: Date | string | null;
};

const csvCell = (value: string | number | null | undefined) => {
  const text = value == null ? "" : String(value);
  return `"${text.replaceAll('"', '""')}"`;
};

export function activityToCsv(rows: ActivityExportRow[]) {
  const header = ["Event ID", "User ID", "User name", "Email", "Department", "Action", "Detail", "Created at"];
  const values = rows.map((row) => [
    row.id,
    row.userId,
    row.userName,
    row.userEmail,
    row.departmentCode,
    row.action,
    row.detail,
    row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt,
  ]);
  return [header, ...values].map((row) => row.map(csvCell).join(",")).join("\r\n");
}
