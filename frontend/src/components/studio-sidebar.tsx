import { ChevronDown } from "lucide-react";
import { FigmaIcon } from "@/components/ui/figma-icon";
import type { FigmaIconName } from "@/assets/icons";

export type StudioSection = "home" | "assets" | "workflows" | "pricing" | "profile";

const navigation: Array<{
  id: StudioSection;
  label: string;
  icon: FigmaIconName;
  activeIcon: FigmaIconName;
}> = [
  { id: "home", label: "首页", icon: "home", activeIcon: "home-fill" },
  { id: "assets", label: "资产库", icon: "folder", activeIcon: "folder-fill" },
  { id: "workflows", label: "工作流", icon: "workflow", activeIcon: "workflow-fill" },
  { id: "pricing", label: "价目表", icon: "list", activeIcon: "list-fill" },
  { id: "profile", label: "个人中心", icon: "profile", activeIcon: "profile-fill" },
];

interface StudioSidebarProps {
  activeSection: StudioSection;
  onNavigate: (section: StudioSection) => void;
}

/** 工作台一级导航，负责页面切换与底部辅助入口。 */
export function StudioSidebar({ activeSection, onNavigate }: StudioSidebarProps) {
  return (
    <aside className="flex w-[214px] shrink-0 flex-col px-2.5 pb-4 pt-2">
      <nav className="space-y-1" aria-label="工作台导航">
        {navigation.map((item) => {
          const active = item.id === activeSection;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onNavigate(item.id)}
              aria-current={active ? "page" : undefined}
              className={`ck-nav-item flex h-10 w-full items-center gap-3 rounded px-2 transition ${active ? "is-active" : ""}`}
            >
              <FigmaIcon
                name={active ? item.activeIcon : item.icon}
                size={item.id === "assets" && active ? 20 : 16}
                className="ck-nav-icon"
              />
              {item.label}
            </button>
          );
        })}
      </nav>

      <div className="ck-sidebar-meta mt-auto space-y-3 px-1">
        <div className="flex items-center gap-2">
          联系我们：
          <span className="ck-sidebar-contact grid size-7 place-items-center rounded-full border">
            ?
          </span>
          <span className="ck-sidebar-contact grid size-7 place-items-center rounded-full border">
            @
          </span>
        </div>
        <button type="button" className="ck-sidebar-language flex items-center gap-1">
          简体中文 <ChevronDown size={11} />
        </button>
      </div>
    </aside>
  );
}
