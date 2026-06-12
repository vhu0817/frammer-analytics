import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  TrendingUp,
  BarChart3,
  Filter,
  Table2,
  Bot,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

const NAV_ITEMS = [
  { id: "executive", label: "Executive", icon: LayoutDashboard },
  { id: "trends",    label: "Trends",    icon: TrendingUp },
  { id: "analysis",  label: "Analysis",  icon: BarChart3 },
  { id: "funnel",    label: "Funnel",    icon: Filter },
  { id: "explorer",  label: "Explorer",  icon: Table2 },
];

export default function Sidebar({ activeTab, onTabChange, onAtlasToggle }) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 z-40 flex h-screen flex-col border-r border-sidebar-border bg-sidebar transition-all duration-300",
        collapsed ? "w-16" : "w-56"
      )}
    >
      {/* logo area */}
      <div className="flex h-14 items-center gap-2 border-b border-sidebar-border px-4">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-sm">
          F
        </div>
        {!collapsed && (
          <span className="text-sm font-semibold text-sidebar-foreground truncate">
            Frammer Analytics
          </span>
        )}
      </div>

      {/* nav links */}
      <nav className="flex-1 space-y-1 px-2 py-3">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              id={`nav-${item.id}`}
              onClick={() => onTabChange(item.id)}
              className={cn(
                "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-sidebar-accent text-sidebar-primary"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
              )}
            >
              <Icon className="size-4 shrink-0" />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </button>
          );
        })}
      </nav>

      {/* atlas agent button */}
      <div className="border-t border-sidebar-border px-2 py-3">
        <button
          id="nav-atlas"
          onClick={onAtlasToggle}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground transition-colors"
        >
          <Bot className="size-4 shrink-0" />
          {!collapsed && <span>ATLAS Agent</span>}
        </button>
      </div>

      {/* collapse toggle */}
      <div className="border-t border-sidebar-border p-2">
        <button
          id="sidebar-toggle"
          onClick={() => setCollapsed((c) => !c)}
          className="flex w-full items-center justify-center rounded-lg p-2 text-sidebar-foreground/50 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground transition-colors"
        >
          {collapsed ? <ChevronRight className="size-4" /> : <ChevronLeft className="size-4" />}
        </button>
      </div>
    </aside>
  );
}
