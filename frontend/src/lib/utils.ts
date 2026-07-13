import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** 合并条件类名，并消除冲突的 Tailwind CSS 工具类。 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
