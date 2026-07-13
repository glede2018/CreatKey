import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const variants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-white text-black hover:bg-zinc-200",
        secondary: "border border-white/10 bg-white/[.06] text-zinc-100 hover:bg-white/10",
        ghost: "text-zinc-400 hover:bg-white/[.06] hover:text-white",
        destructive: "bg-red-500/15 text-red-300 hover:bg-red-500/25",
      },
      size: { default: "h-10 px-4", sm: "h-8 rounded-md px-3 text-xs", icon: "size-9 p-0" },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof variants> {}
/** 支持视觉变体和尺寸变体的基础按钮。 */
export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button ref={ref} className={cn(variants({ variant, size }), className)} {...props} />
  ),
);
Button.displayName = "Button";
