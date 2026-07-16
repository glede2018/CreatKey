import type { CSSProperties, HTMLAttributes } from "react";
import { figmaIcons, type FigmaIconName } from "@/assets/icons";
import { cn } from "@/lib/utils";

interface FigmaIconProps extends HTMLAttributes<HTMLSpanElement> {
  name: FigmaIconName;
  size?: number;
  label?: string;
}

/** 使用 CSS mask 渲染 Figma SVG，使图标颜色自动继承 currentColor。 */
export function FigmaIcon({ name, size = 16, label, className, style, ...props }: FigmaIconProps) {
  const iconUrl = figmaIcons[name];
  const maskStyle: CSSProperties = {
    width: size,
    height: size,
    maskImage: `url("${iconUrl}")`,
    maskPosition: "center",
    maskRepeat: "no-repeat",
    maskSize: "contain",
    WebkitMaskImage: `url("${iconUrl}")`,
    WebkitMaskPosition: "center",
    WebkitMaskRepeat: "no-repeat",
    WebkitMaskSize: "contain",
    ...style,
  };

  return (
    <span
      aria-hidden={label ? undefined : true}
      aria-label={label}
      role={label ? "img" : undefined}
      className={cn("ck-figma-icon inline-block shrink-0", className)}
      style={maskStyle}
      {...props}
    />
  );
}
