import { useApp, useHostStyles } from "@modelcontextprotocol/ext-apps/react";
import {
  ArcWidgetBadge,
  ArcWidgetIcon,
  ArcWidgetKpiBar,
  ArcWidgetProgressBar,
  ArcWidgetTable,
  type ArcWidgetTableData,
  type ArcWidgetTableRow,
} from "@arcrider/arcwidgets-react";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import {
  buildPayload,
  parsePayload,
  type DbRow,
  type DbStatus,
  type TablePayload,
} from "../projects";

const STATUS_LOOK: Record<
  DbStatus,
  { fontColor: string; backgroundColor: string }
> = {
  Active: { fontColor: "#15803D", backgroundColor: "#DCFCE7" },
  Idle: { fontColor: "#52525B", backgroundColor: "#F4F4F5" },
  Locked: { fontColor: "#991B1B", backgroundColor: "#FFE4E6" },
};

const STATUS_LOOK_DARK: Record<
  DbStatus,
  { fontColor: string; backgroundColor: string }
> = {
  Active: { fontColor: "#86EFAC", backgroundColor: "#14532D" },
  Idle: { fontColor: "#A1A1AA", backgroundColor: "#27272A" },
  Locked: { fontColor: "#FDA4AF", backgroundColor: "#4C0519" },
};

const SCHEMA_THEME = {
  public: {
    light: { bg: "#E8F1FF", ink: "#2563EB", track: "#BFDBFE" },
    dark: { bg: "#152033", ink: "#93C5FD", track: "#1E3A5F" },
  },
  auth: {
    light: { bg: "#FFF4E8", ink: "#C2410C", track: "#FED7AA" },
    dark: { bg: "#24180E", ink: "#FDBA74", track: "#4A2E12" },
  },
  storage: {
    light: { bg: "#E8F8EF", ink: "#15803D", track: "#BBF7D0" },
    dark: { bg: "#122018", ink: "#86EFAC", track: "#14532D" },
  },
} as const;

type Theme = "light" | "dark";
type SchemaName = keyof typeof SCHEMA_THEME;

function StatusBadge({ status, theme }: { status: DbStatus; theme: Theme }) {
  const look = (theme === "dark" ? STATUS_LOOK_DARK : STATUS_LOOK)[status];
  return (
    <ArcWidgetBadge
      data={{
        value: status,
        fontColor: look.fontColor,
        backgroundColor: look.backgroundColor,
        borderColor: look.backgroundColor,
        borderRadius: "0px",
        fontSize: "10px",
        fontWeight: "600",
        paddingX: "8px",
        paddingY: "3px",
      }}
    />
  );
}

function parseMb(size: string): number {
  const value = Number.parseFloat(size);
  if (Number.isNaN(value)) return 0;
  return size.includes("GB") ? value * 1024 : value;
}

function formatMb(mb: number): string {
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
  return `${mb.toFixed(1)} MB`;
}

function groupBySchema(rows: DbRow[]) {
  const groups = new Map<string, DbRow[]>();
  for (const row of rows) {
    const list = groups.get(row.schema) ?? [];
    list.push(row);
    groups.set(row.schema, list);
  }
  return [...groups.entries()];
}

function leafRow(
  row: DbRow,
  selectedIds: Set<string>,
  toggleSelection: (id: string) => void,
  theme: Theme,
  accent: string,
): ArcWidgetTableRow {
  return {
    id: row.id,
    clickable: false,
    rowHeight: "36px",
    rowPaddingY: "4px",
    rowColor: selectedIds.has(row.id)
      ? theme === "dark"
        ? "#27272A"
        : "#F4F4F5"
      : "",
    columns: [
      {
        width: "auto",
        clickable: true,
        value: (
          <div className="flex-row">
            <input
              className="table-check"
              type="checkbox"
              checked={selectedIds.has(row.id)}
              onChange={() => toggleSelection(row.id)}
              onClick={(event) => event.stopPropagation()}
              style={{ "--check-color": accent } as CSSProperties}
            />
            <span className="cell-name cell-name--child">{row.name}</span>
          </div>
        ),
        sort: { value: row.name },
      },
      {
        value: <span className="cell-name cell-name--child">{row.type}</span>,
        width: "100px",
      },
      { value: <StatusBadge status={row.status} theme={theme} />, width: "100px" },
      {
        value: <span className="cell-num cell-num--child">{row.rows.toLocaleString()}</span>,
        width: "80px",
        align: "right",
        sort: { value: row.rows },
      },
      {
        value: <span className="cell-num cell-num--child">{row.size}</span>,
        width: "110px",
        align: "right",
      },
    ],
  };
}

function buildTableData(
  rows: DbRow[],
  selectedIds: Set<string>,
  toggleSelection: (id: string) => void,
  theme: Theme,
): ArcWidgetTableData & { uniqueListId: string } {
  const dark = theme === "dark";
  const line = dark ? "#2A3A4E" : "#E4E4E7";

  return {
    uniqueListId: `mcp-db-nested-${theme}-v5`,
    height: "360px",
    collapsible: {
      enabled: true,
      expandColumn: 0,
      indentColumn: 0,
      indentSize: "32px",
    } as ArcWidgetTableData["collapsible"] & { indentSize: string },
    rowHoverAction: {
      hoverActive: true,
      backgroundColor: dark ? "#16202A" : "#FAFAFA",
    },
    scrollBar: {
      showScrollBar: true,
      height: "6px",
      backgroundColor: dark ? "#1A2430" : "#F4F4F5",
      handle: { backgroundColor: dark ? "#6B8499" : "#A1A1AA", borderRadius: "0px" },
    },
    header: {
      showHeader: true,
      height: "32px",
      backgroundColor: dark ? "#121820" : "#FAFAFA",
      fontColor: dark ? "#9AADC0" : "#71717A",
      fontSize: "11px",
      columns: [
        { title: "Name", width: "auto" },
        { title: "Type", width: "100px" },
        { title: "Status", width: "100px" },
        { title: "Rows", width: "80px", align: "right" },
        { title: "Size", width: "110px", align: "right" },
      ],
    },
    styles: {
      backgroundColor: dark ? "#0B1016" : "#FFFFFF",
      fontColor: dark ? "#9AADC0" : "#52525B",
      borderRadius: "0px",
      borders: {
        color: line,
        width: "1px",
        outer: { color: line, width: "1px" },
        columns: false,
        rows: { color: line, width: "1px" },
      },
    },
    table: groupBySchema(rows).map(([schema, children]) => {
      const look = SCHEMA_THEME[schema as SchemaName]?.[theme] ?? {
        bg: dark ? "#16202A" : "#F4F4F5",
        ink: dark ? "#E4E4E7" : "#3F3F46",
        track: dark ? "#1A2430" : "#E4E4E7",
      };
      const totalRows = children.reduce((sum, child) => sum + child.rows, 0);
      const totalMb = children.reduce((sum, child) => sum + parseMb(child.size), 0);
      const active = children.filter((child) => child.status === "Active").length;
      return {
        id: `schema-${schema}`,
        clickable: true,
        rowHeight: "36px",
        rowPaddingY: "4px",
        rowColor: look.bg,
        columns: [
          {
            width: "auto",
            color: look.ink,
            value: (
              <span className="cell-name cell-name--parent" style={{ color: look.ink }}>
                {schema}
              </span>
            ),
            sort: { value: schema },
          },
          {
            color: look.ink,
            value: (
              <span className="cell-name cell-name--parent-meta" style={{ color: look.ink }}>
                {children.length} objects
              </span>
            ),
            width: "100px",
          },
          {
            width: "100px",
            value: (
              <ArcWidgetProgressBar
                data={{
                  valueProgress: active,
                  valueTotal: children.length,
                  width: "72px",
                  height: "6px",
                  progressColor: look.ink,
                  backgroundColor: look.track,
                  borderRadius: "0px",
                }}
              />
            ),
          },
          {
            color: look.ink,
            value: (
              <span className="cell-num" style={{ color: look.ink }}>
                {totalRows.toLocaleString()}
              </span>
            ),
            width: "80px",
            align: "right",
            sort: { value: totalRows },
          },
          {
            width: "110px",
            align: "right",
            color: look.ink,
            value: (
              <span className="size-sum">
                <ArcWidgetIcon
                  data={{
                    name: "sigma",
                    iconSet: "phosphor",
                    style: "regular",
                    iconSize: "12px",
                    color: look.ink,
                  }}
                />
                <span className="cell-num" style={{ color: look.ink }}>
                  {formatMb(totalMb)}
                </span>
              </span>
            ),
          },
        ],
        items: children.map((child) =>
          leafRow(child, selectedIds, toggleSelection, theme, look.ink),
        ),
      };
    }),
    footer: {
      showFooter: true,
      showActionButton: false,
      height: "58px",
      backgroundColor: dark ? "#121820" : "#FAFAFA",
      leftSideContent: (
        <span className="table-footer__count">
          {selectedIds.size === 0
            ? "No objects selected"
            : `${selectedIds.size} object${selectedIds.size === 1 ? "" : "s"} selected`}
        </span>
      ),
    },
    emptyTable: { title: "No data", value: "The query returned 0 rows." },
  };
}

export function TableApp() {
  const fallback = useMemo(() => buildPayload(), []);
  const [payload, setPayload] = useState<TablePayload>(fallback);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [theme, setTheme] = useState<Theme>("dark");

  const { app, error } = useApp({
    appInfo: { name: "arcWidgets Table", version: "0.1.0" },
    capabilities: {},
    autoResize: true,
    onAppCreated: (instance) => {
      instance.ontoolresult = (result) => {
        const data = parsePayload(result.structuredContent);
        if (data) setPayload(data);
      };
    },
  });

  useHostStyles(app, app?.getHostContext());
  const standalone = window.parent === window;

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
  }, [theme]);

  const toggleSelection = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const tableData = useMemo(
    () => buildTableData(payload.tables, selectedIds, toggleSelection, theme),
    [payload.tables, selectedIds, theme],
  );

  const totalRows = payload.tables.reduce((sum, row) => sum + row.rows, 0);
  const totalMb = payload.tables.reduce((sum, row) => sum + parseMb(row.size), 0);
  const kpiValue = theme === "dark" ? "#F4F4F5" : "#18181B";
  const kpiBorder = theme === "dark" ? "#2A3A4E" : "#E4E4E7";
  const kpiBg = theme === "dark" ? "#121820" : "#FAFAFA";

  return (
    <main className="table-app" data-theme={theme}>
      <header className="table-app__header">
        <div>
          <p className="table-app__eyebrow">MCP App · Sample data</p>
          <h1 className="table-app__title">{payload.title}</h1>
        </div>
        <div className="table-app__header-right">
          <p className="table-app__meta">{payload.subtitle}</p>
          <div className="theme-switch" role="group" aria-label="Color theme">
            <button
              type="button"
              className={theme === "light" ? "is-active" : ""}
              aria-pressed={theme === "light"}
              onClick={() => setTheme("light")}
            >
              <ArcWidgetIcon
                data={{
                  name: "sun",
                  iconSet: "phosphor",
                  style: theme === "light" ? "fill" : "regular",
                  iconSize: "14px",
                  color: theme === "light" ? "#18181B" : "#A1A1AA",
                }}
              />
              <span>Light</span>
            </button>
            <button
              type="button"
              className={theme === "dark" ? "is-active" : ""}
              aria-pressed={theme === "dark"}
              onClick={() => setTheme("dark")}
            >
              <ArcWidgetIcon
                data={{
                  name: "moon",
                  iconSet: "phosphor",
                  style: theme === "dark" ? "fill" : "regular",
                  iconSize: "14px",
                  color: theme === "dark" ? "#F4F4F5" : "#71717A",
                }}
              />
              <span>Dark</span>
            </button>
          </div>
        </div>
      </header>

      <div className="table-app__kpis">
        <ArcWidgetKpiBar
          data={{
            settings: {
              height: "72px",
              fontSizeLabel: "10px",
              fontSizeValue: "18px",
              colorLabel: theme === "dark" ? "#9AADC0" : "#71717A",
              borderColor: kpiBorder,
              backgroundColor: kpiBg,
            },
            cards: [
              {
                card: 1,
                title: "Total Rows",
                value: totalRows.toLocaleString(),
                settings: {
                  fontSizeLabel: "10px",
                  fontSizeValue: "18px",
                  colorValue: kpiValue,
                  borderColor: kpiBorder,
                  backgroundColor: kpiBg,
                },
              },
              {
                card: 2,
                title: "Total Size",
                value: formatMb(totalMb),
                settings: {
                  fontSizeLabel: "10px",
                  fontSizeValue: "18px",
                  colorValue: kpiValue,
                  borderColor: kpiBorder,
                  backgroundColor: kpiBg,
                },
              },
              {
                card: 3,
                title: "Objects",
                value: String(payload.tables.length),
                settings: {
                  fontSizeLabel: "10px",
                  fontSizeValue: "18px",
                  colorValue: theme === "dark" ? "#86EFAC" : "#15803D",
                  borderColor: kpiBorder,
                  backgroundColor: kpiBg,
                },
              },
            ],
          }}
        />
      </div>

      <div className="table-app__stage">
        <ArcWidgetTable
          key={tableData.uniqueListId}
          id="mcp-db-nested-v4"
          data={tableData}
        />
      </div>

      {!standalone && error ? (
        <p className="table-app__error">{error.message}</p>
      ) : null}
    </main>
  );
}
