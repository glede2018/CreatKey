import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const variants = cva(
  "ck-button inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg transition-all focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "ck-button-primary",
        secondary: "ck-button-secondary border",
        ghost: "ck-button-ghost",
        destructive: "ck-button-danger",
      },
      size: { default: "h-10 px-4", sm: "ck-button-sm h-8 rounded-md px-3", icon: "size-9 p-0" },
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
