// 1초 간격으로 갱신되는 현재 시각 표시 — 초기값은 서버 렌더 시각이어서 hydration 무난
"use client";

import * as React from "react";

interface LiveClockProps {
  initialIso: string; // 서버에서 new Date().toISOString() 으로 넘김
  className?: string;
}

function format(iso: string): string {
  try {
    return new Date(iso).toLocaleString("ko-KR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
  } catch {
    return iso;
  }
}

export function LiveClock({ initialIso, className }: LiveClockProps) {
  const [now, setNow] = React.useState(initialIso);
  React.useEffect(() => {
    const id = setInterval(() => setNow(new Date().toISOString()), 1000);
    return () => clearInterval(id);
  }, []);
  return <span className={className}>{format(now)}</span>;
}
