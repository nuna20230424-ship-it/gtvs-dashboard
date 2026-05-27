// records / version_history 행을 .xlsx Buffer 로 변환하는 유틸 (exceljs)
import "server-only";
import ExcelJS from "exceljs";
import type {
  UpdateRecordRow,
  VersionHistoryRow,
} from "@/lib/queries";

interface ColumnDef<T> {
  header: string;
  key: keyof T | string;
  width: number;
  formatter?: (row: T) => string | number | null | undefined;
}

const RECORDS_COLUMNS: ColumnDef<UpdateRecordRow>[] = [
  { header: "ID", key: "id", width: 8 },
  { header: "체크 시각", key: "checked_at", width: 22 },
  { header: "단말", key: "device", width: 18 },
  { header: "트랙", key: "track", width: 12 },
  { header: "패키지", key: "package", width: 32 },
  { header: "앱 이름", key: "app_name", width: 22 },
  { header: "Ref", key: "ref", width: 14 },
  { header: "상태", key: "status", width: 12 },
  { header: "이전 버전", key: "version_before", width: 18 },
  { header: "현재 버전", key: "version_after", width: 18 },
  { header: "에러", key: "error", width: 40 },
];

const HISTORY_COLUMNS: ColumnDef<VersionHistoryRow>[] = [
  { header: "ID", key: "id", width: 8 },
  { header: "변경 시각", key: "changed_at", width: 22 },
  { header: "단말", key: "device", width: 18 },
  { header: "트랙", key: "track", width: 12 },
  { header: "패키지", key: "package", width: 32 },
  { header: "앱 이름", key: "app_name", width: 22 },
  { header: "이전 버전", key: "version_before", width: 18 },
  { header: "현재 버전", key: "version_after", width: 18 },
  { header: "Source", key: "source", width: 12 },
];

async function buildWorkbook<T extends Record<string, unknown>>(
  sheetName: string,
  columns: ColumnDef<T>[],
  rows: T[]
): Promise<Uint8Array> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "GTVS Dashboard";
  wb.created = new Date();
  const sheet = wb.addWorksheet(sheetName);

  sheet.columns = columns.map((c) => ({
    header: c.header,
    key: String(c.key),
    width: c.width,
  }));

  // 헤더 스타일
  sheet.getRow(1).font = { bold: true };
  sheet.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFF3F4F6" },
  };

  for (const row of rows) {
    const flat: Record<string, unknown> = {};
    for (const c of columns) {
      flat[String(c.key)] = c.formatter
        ? c.formatter(row)
        : (row as Record<string, unknown>)[String(c.key)];
    }
    sheet.addRow(flat);
  }

  // NextResponse가 받는 BodyInit (ArrayBufferView)에 호환되도록 Uint8Array로 정규화
  const buf = (await wb.xlsx.writeBuffer()) as ArrayBuffer | Uint8Array;
  return buf instanceof Uint8Array ? buf : new Uint8Array(buf);
}

export function recordsToXlsx(rows: UpdateRecordRow[]): Promise<Uint8Array> {
  return buildWorkbook("Records", RECORDS_COLUMNS, rows as never[]);
}

export function historyToXlsx(rows: VersionHistoryRow[]): Promise<Uint8Array> {
  return buildWorkbook("Version History", HISTORY_COLUMNS, rows as never[]);
}

// Records 신규 템플릿(beta/production) → xlsx. 컬럼 구조는 화면 테이블과 동일
import type { TemplateResult } from "@/lib/template";

export async function templateToXlsx(t: TemplateResult): Promise<Uint8Array> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "GTVS Dashboard";
  wb.created = new Date();
  const sheet = wb.addWorksheet(t.track === "beta" ? "Beta Records" : "Production Records");

  // 트랙별 메타 컬럼
  const metaHeaders =
    t.track === "beta"
      ? ["App Name", "Package", "Opt-In", "Ref", "Latest version", "Last update", "Age (days)"]
      : ["App Name", "Package Name", "Ref", "Latest version", "Last Update", "Rollout Status"];

  // 단말별 3개 서브 컬럼 — 단말명 prefix
  const deviceSubHeaders: string[] = [];
  for (const d of t.devices) {
    deviceSubHeaders.push(
      `${d.name} 이전버전`,
      `${d.name} 현재버전`,
      `${d.name} 상태`
    );
  }

  const headers = [...metaHeaders, ...deviceSubHeaders];
  sheet.addRow(headers);
  sheet.getRow(1).font = { bold: true };
  sheet.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFF3F4F6" },
  };

  for (const r of t.rows) {
    const p = r.package;
    const metaCells =
      t.track === "beta"
        ? [
            p.app_name,
            p.package,
            p.opt_in ?? "",
            p.ref ?? "",
            r.latest_version ?? "",
            r.last_update ? r.last_update.slice(0, 10) : "",
            r.age_days ?? "",
          ]
        : [
            p.app_name,
            p.package,
            p.ref ?? "",
            r.latest_version ?? "",
            r.last_update ? r.last_update.slice(0, 16).replace("T", " ") : "",
            p.rollout_status ?? "",
          ];

    const deviceCells: (string | number)[] = [];
    for (const d of t.devices) {
      const cell = r.per_device.get(d.name);
      deviceCells.push(
        cell?.previous_version ?? "",
        cell?.current_version ?? "",
        cell?.status ?? ""
      );
    }

    sheet.addRow([...metaCells, ...deviceCells]);
  }

  // 컬럼 너비 대충
  sheet.getColumn(1).width = 28; // App Name
  sheet.getColumn(2).width = 38; // Package
  for (let i = 3; i <= headers.length; i++) {
    sheet.getColumn(i).width = 18;
  }

  const buf = (await wb.xlsx.writeBuffer()) as ArrayBuffer | Uint8Array;
  return buf instanceof Uint8Array ? buf : new Uint8Array(buf);
}

// Overview 행=패키지 × 열=단말 매트릭스 → xlsx. 셀 = "version_after\nstatus\nchecked_at"
export interface OverviewMatrixInput {
  devices: Array<{ name: string; track: string; model: string | null }>;
  packages: Array<{ package: string; app_name: string }>;
  latestByKey: Map<string, { version_after: string | null; status: string; checked_at: string }>;
}

export async function overviewMatrixToXlsx(
  input: OverviewMatrixInput
): Promise<Uint8Array> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "GTVS Dashboard";
  wb.created = new Date();
  const sheet = wb.addWorksheet("Overview");

  // 헤더 2줄: (1) 단말명, (2) track + 모델명
  const headerRow1: (string | null)[] = ["패키지 \\ 단말"];
  const headerRow2: (string | null)[] = [""];
  for (const d of input.devices) {
    headerRow1.push(d.name);
    headerRow2.push(`[${d.track}] ${d.model ?? ""}`.trim());
  }
  sheet.addRow(headerRow1);
  sheet.addRow(headerRow2);
  sheet.getRow(1).font = { bold: true };
  sheet.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFF3F4F6" },
  };
  sheet.getRow(2).font = { italic: true };

  for (const p of input.packages) {
    const row: (string | null)[] = [`${p.app_name} (${p.package})`];
    for (const d of input.devices) {
      const rec = input.latestByKey.get(`${d.name}::${p.package}`);
      if (!rec) {
        row.push("—");
      } else {
        row.push(
          `${rec.version_after ?? "—"}\n${rec.status}\n${rec.checked_at}`
        );
      }
    }
    sheet.addRow(row);
  }

  sheet.getColumn(1).width = 42;
  for (let i = 2; i <= input.devices.length + 1; i++) {
    sheet.getColumn(i).width = 28;
    sheet.getColumn(i).alignment = { wrapText: true, vertical: "top" };
  }

  const buf = (await wb.xlsx.writeBuffer()) as ArrayBuffer | Uint8Array;
  return buf instanceof Uint8Array ? buf : new Uint8Array(buf);
}

// 다운로드 파일명 규칙 — records_2026-05-20T09-30-00.xlsx
export function buildExportFilename(prefix: string): string {
  const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  return `${prefix}_${ts}.xlsx`;
}
