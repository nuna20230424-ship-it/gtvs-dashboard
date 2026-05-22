// 보고 윈도우(KST 09:00 기준) 시각 계산 헬퍼
import "server-only";

// 가장 최근 KST 09:00 의 naive ISO ("YYYY-MM-DDT09:00:00").
// version_history.changed_at 이 KST 로컬 naive 포맷이라 lex 비교가 그대로 통한다.
// 현재 KST < 09:00 이면 어제 09:00, 그 외 오늘 09:00.
export function reportingWindowStartIso(): string {
  // 'sv-SE' locale 은 ISO 형식("YYYY-MM-DD HH:MM:SS")으로 출력
  const fmt = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const [datePart, timePart] = fmt.format(new Date()).split(" ");
  const hour = Number(timePart.slice(0, 2));
  if (hour >= 9) {
    return `${datePart}T09:00:00`;
  }
  // 어제 09:00 — Date 산술은 UTC 로 해도 결과 날짜 부분은 동일
  const [y, m, d] = datePart.split("-").map(Number);
  const prev = new Date(Date.UTC(y, m - 1, d));
  prev.setUTCDate(prev.getUTCDate() - 1);
  const py = prev.getUTCFullYear();
  const pm = String(prev.getUTCMonth() + 1).padStart(2, "0");
  const pd = String(prev.getUTCDate()).padStart(2, "0");
  return `${py}-${pm}-${pd}T09:00:00`;
}
