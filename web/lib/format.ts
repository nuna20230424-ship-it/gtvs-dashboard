// 날짜 포맷팅 및 상태/소스 뱃지 스타일 유틸
import { format } from "date-fns";

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  try {
    return format(new Date(value), "yyyy-MM-dd HH:mm:ss");
  } catch {
    return value;
  }
}

export function statusBadgeClass(status: string | null | undefined): string {
  switch (status) {
    case "updated":
      return "bg-green-100 text-green-800 border-green-200";
    case "up_to_date":
      return "bg-gray-100 text-gray-700 border-gray-200";
    case "error":
      return "bg-red-100 text-red-800 border-red-200";
    default:
      return "bg-gray-100 text-gray-700 border-gray-200";
  }
}

export function trackBadgeClass(track: string | null | undefined): string {
  return track === "beta"
    ? "bg-amber-100 text-amber-800 border-amber-200"
    : "bg-blue-100 text-blue-800 border-blue-200";
}

export function sourceBadgeClass(source: string | null | undefined): string {
  return source === "manual"
    ? "bg-purple-100 text-purple-800 border-purple-200"
    : "bg-sky-100 text-sky-800 border-sky-200";
}
