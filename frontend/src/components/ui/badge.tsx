import * as React from "react";
import { cn } from "@/lib/utils";
/** shadcn 风格的轻量状态徽标。 */
export function Badge({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn("ck-badge inline-flex items-center rounded-full border px-2 py-0.5", className)}
      {...props}
    />
  );
}
