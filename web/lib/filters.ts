// URL searchParams → 필터/페이지네이션 객체 변환 (서버 컴포넌트와 향후 API Route 공통)
import type {
  RecordsFilter,
  HistoryFilter,
  Pagination,
} from "@/lib/queries";

// 페이지에서 넘기는 좁은 인터페이스도 받을 수 있도록 unknown 으로 받고 내부에서 안전하게 처리
function getParam(sp: unknown, key: string): string | undefined {
  if (sp instanceof URLSearchParams) {
    return sp.get(key) ?? undefined;
  }
  if (sp && typeof sp === "object") {
    const v = (sp as Record<string, unknown>)[key];
    if (typeof v === "string") return v;
    if (Array.isArray(v) && typeof v[0] === "string") return v[0];
  }
  return undefined;
}

export function parseRecordsFilters(sp: unknown): RecordsFilter {
  return {
    track: getParam(sp, "track"),
    device: getParam(sp, "device"),
    package: getParam(sp, "package"),
    status: getParam(sp, "status"),
    from: getParam(sp, "from"),
    to: getParam(sp, "to"),
  };
}

export function parseHistoryFilters(sp: unknown): HistoryFilter {
  return {
    track: getParam(sp, "track"),
    device: getParam(sp, "device"),
    package: getParam(sp, "package"),
    source: getParam(sp, "source"),
    from: getParam(sp, "from"),
    to: getParam(sp, "to"),
  };
}

export function parsePagination(
  sp: unknown,
  pageSize: number
): Pagination {
  const raw = getParam(sp, "page");
  const page = Math.max(1, Number(raw ?? "1") || 1);
  return { offset: (page - 1) * pageSize, limit: pageSize };
}
