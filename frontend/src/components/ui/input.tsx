import * as React from "react";
import { cn } from "@/lib/utils";
/** 统一黑色主题样式并支持 ref 透传的输入框。 */
export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, ...props }, ref) => (
  <input
    ref={ref}
    className={cn(
      "h-10 w-full rounded-lg border border-white/10 bg-black/40 px-3 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-white/25 focus:ring-2 focus:ring-white/[.06]",
      className,
    )}
    {...props}
  />
));
Input.displayName = "Input";
