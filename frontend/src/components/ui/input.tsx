import * as React from "react";
import { cn } from "@/lib/utils";
/** 统一黑色主题样式并支持 ref 透传的输入框。 */
export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, ...props }, ref) => (
  <input
    ref={ref}
    className={cn("ck-input h-10 w-full rounded-lg border px-3 outline-none", className)}
    {...props}
  />
));
Input.displayName = "Input";
