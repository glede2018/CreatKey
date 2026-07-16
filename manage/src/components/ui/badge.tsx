import type { HTMLAttributes } from "react";

export function Badge({ className = "", ...props }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={`inline-flex items-center rounded-full border border-white/10 bg-white/[.06] px-2 py-0.5 text-[11px] text-zinc-400 ${className}`}
      {...props}
    />
  );
}
