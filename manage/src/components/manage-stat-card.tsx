import type { LucideIcon } from "lucide-react";

/** 运营指标卡片属性。 */
interface ManageStatCardProps {
  label: string;
  value: string;
  hint: string;
  icon: LucideIcon;
  tone?: "blue" | "green" | "amber" | "violet";
}

const tones = {
  blue: "bg-blue-500/10 text-blue-400",
  green: "bg-emerald-500/10 text-emerald-400",
  amber: "bg-amber-500/10 text-amber-400",
  violet: "bg-violet-500/10 text-violet-400",
};

export function ManageStatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "blue",
}: ManageStatCardProps) {
  return (
    <article className="rounded-2xl border border-white/[.07] bg-[#151515] p-5 shadow-[0_16px_44px_rgba(0,0,0,.16)]">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-zinc-500">{label}</p>
          <p className="mt-3 text-2xl font-semibold tracking-tight text-white">{value}</p>
        </div>
        <span className={`grid size-10 place-items-center rounded-xl ${tones[tone]}`}>
          <Icon size={19} strokeWidth={1.8} />
        </span>
      </div>
      <p className="mt-4 text-[11px] text-zinc-600">{hint}</p>
    </article>
  );
}
