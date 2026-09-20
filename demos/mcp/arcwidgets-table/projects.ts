export type DbStatus = "Active" | "Idle" | "Locked";

export type DbRow = {
  id: string;
  schema: string;
  name: string;
  type: string;
  rows: number;
  size: string;
  status: DbStatus;
};

export type TablePayload = {
  title: string;
  subtitle: string;
  packageVersion: string;
  tables: DbRow[];
};

export const PACKAGE_VERSION = "0.1.0-alpha.5";

// Fictional records. No database client or external service is used by this example.
export const SAMPLE_DATA: DbRow[] = [
  { id: "tbl-users", schema: "public", name: "users", type: "Table", rows: 1204, size: "4.2 MB", status: "Active" },
  { id: "tbl-orders", schema: "public", name: "orders", type: "Table", rows: 43012, size: "128.0 MB", status: "Active" },
  { id: "tbl-products", schema: "public", name: "products", type: "Table", rows: 890, size: "1.1 MB", status: "Idle" },
  { id: "vw-revenue", schema: "public", name: "monthly_revenue", type: "View", rows: 0, size: "0.0 MB", status: "Idle" },
  { id: "tbl-sessions", schema: "auth", name: "sessions", type: "Table", rows: 52, size: "0.4 MB", status: "Active" },
  { id: "tbl-audit", schema: "auth", name: "audit_log", type: "Table", rows: 12301, size: "45.0 MB", status: "Locked" },
  { id: "tbl-identities", schema: "auth", name: "identities", type: "Table", rows: 104, size: "0.8 MB", status: "Active" },
  { id: "tbl-objects", schema: "storage", name: "objects", type: "Table", rows: 4019, size: "12.5 MB", status: "Idle" },
  { id: "tbl-buckets", schema: "storage", name: "buckets", type: "Table", rows: 4, size: "0.1 MB", status: "Idle" },
];

export function buildPayload(): TablePayload {
  return {
    title: "Database Explorer",
    subtitle: "Fictional schema · read-only MCP example",
    packageVersion: PACKAGE_VERSION,
    tables: SAMPLE_DATA,
  };
}

export function parsePayload(value: unknown): TablePayload | null {
  if (!value || typeof value !== "object") return null;
  const payload = value as Partial<TablePayload>;
  if (typeof payload.title !== "string" || typeof payload.subtitle !== "string" ||
      typeof payload.packageVersion !== "string" || !Array.isArray(payload.tables) || payload.tables.length > 100) return null;
  if (!payload.tables.every((row: unknown) => {
    if (!row || typeof row !== "object") return false;
    const item = row as Partial<DbRow>;
    return [item.id, item.schema, item.name, item.type, item.size].every(field => typeof field === "string" && field.length <= 200) &&
      Number.isSafeInteger(item.rows) && (item.rows as number) >= 0 &&
      ["Active", "Idle", "Locked"].includes(item.status as string);
  })) return null;
  return payload as TablePayload;
}

export function summarizePayload(payload: TablePayload): string {
  return `${payload.title} (${payload.packageVersion})\n${payload.subtitle}`;
}
