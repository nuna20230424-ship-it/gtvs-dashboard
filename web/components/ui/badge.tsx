// 라벨용 작은 뱃지 컴포넌트
import * as React from "react";

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {}

export function Badge({ className = "", ...props }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${className}`}
      {...props}
    />
  );
}
