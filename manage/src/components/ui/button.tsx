import type { ButtonHTMLAttributes } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "secondary" | "ghost";
  size?: "default" | "sm" | "icon";
}

const variants = {
  default: "bg-white text-black hover:bg-zinc-200",
  secondary: "border border-white/10 bg-white/[.06] text-zinc-100 hover:bg-white/10",
  ghost: "text-zinc-400 hover:bg-white/[.06] hover:text-white",
};
const sizes = {
  default: "h-10 px-4",
  sm: "h-8 rounded-md px-3 text-xs",
  icon: "size-9 p-0",
};

export function Button({
  className = "",
  variant = "default",
  size = "default",
  ...props
}: ButtonProps) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 disabled:pointer-events-none disabled:opacity-50 ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    />
  );
}
