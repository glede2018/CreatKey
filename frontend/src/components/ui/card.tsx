import * as React from "react";
import { cn } from "@/lib/utils";
/** 统一黑色主题边框与背景的内容卡片。 */
export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("ck-card rounded-xl border", className)} {...props} />;
}
