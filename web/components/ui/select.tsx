// 기본 네이티브 select 래퍼
import * as React from "react";

export const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(({ className = "", children, ...props }, ref) => {
  return (
    <select
      ref={ref}
      className={`flex h-9 w-full rounded-md border border-gray-300 bg-white px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-1 disabled:opacity-50 ${className}`}
      {...props}
    >
      {children}
    </select>
  );
});
Select.displayName = "Select";
