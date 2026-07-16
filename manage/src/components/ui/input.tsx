import { forwardRef, type InputHTMLAttributes } from "react";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className = "", ...props }, ref) => (
    <input
      ref={ref}
      className={`h-10 w-full rounded-lg border border-white/10 bg-black/40 px-3 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-white/25 focus:ring-2 focus:ring-white/[.06] ${className}`}
      {...props}
    />
  ),
);
Input.displayName = "Input";
