import { useState, useEffect } from "react";
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
  Menu,
  X,
} from "lucide-react";

const NAV_ITEMS = [
  { id: "executive", label: "Executive", icon: LayoutDashboard },
  { id: "trends",    label: "Trends",    icon: TrendingUp },
  { id: "analysis",  label: "Analysis",  icon: BarChart3 },
  { id: "funnel",    label: "Funnel",    icon: Filter },
  { id: "explorer",  label: "Explorer",  icon: Table2 },
];

export default function Sidebar({ activeTab, onTabChange, onAtlasToggle, collapsed, onCollapsedChange }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  // close mobile drawer on window resize above md
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) setMobileOpen(false);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // close mobile drawer when a tab is selected
  const handleTabClick = (tabId) => {
    onTabChange(tabId);
    setMobileOpen(false);
  };

  return (
    <>
      {/* ── Mobile hamburger button (visible < md) ── */}
      <button
        id="mobile-menu-btn"
        onClick={() => setMobileOpen(true)}
        className="fixed left-3 top-3 z-50 flex size-9 items-center justify-center rounded-lg bg-sidebar text-sidebar-foreground border border-sidebar-border md:hidden"
        aria-label="Open menu"
      >
        <Menu className="size-5" />
      </button>

      {/* ── Mobile backdrop ── */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px] md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* ── Sidebar ── */}
      <aside
        className={cn(
          "fixed left-0 top-0 z-50 flex h-screen flex-col border-r border-sidebar-border bg-sidebar transition-all duration-300",
          // desktop: collapsed or expanded
          collapsed ? "md:w-16" : "md:w-56",
          // mobile: off-screen by default, slides in when mobileOpen
          mobileOpen ? "w-56 translate-x-0" : "-translate-x-full md:translate-x-0"
        )}
      >
        {/* logo area */}
        <div className="flex h-14 items-center gap-2 border-b border-sidebar-border px-4">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-sm">
            F
          </div>
          {(!collapsed || mobileOpen) && (
            <span className={cn(
              "text-sm font-semibold text-sidebar-foreground truncate",
              collapsed && !mobileOpen && "md:hidden"
            )}>
              Frammer Analytics
            </span>
          )}

          {/* close button on mobile */}
          {mobileOpen && (
            <button
              onClick={() => setMobileOpen(false)}
              className="ml-auto rounded-lg p-1 text-sidebar-foreground/50 hover:text-sidebar-foreground md:hidden"
            >
              <X className="size-4" />
            </button>
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
                onClick={() => handleTabClick(item.id)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-primary"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                )}
              >
                <Icon className="size-4 shrink-0" />
                {(!collapsed || mobileOpen) && (
                  <span className={cn("truncate", collapsed && !mobileOpen && "md:hidden")}>
                    {item.label}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* atlas agent button */}
        <div className="border-t border-sidebar-border px-2 py-3">
          <button
            id="nav-atlas"
            onClick={() => { onAtlasToggle(); setMobileOpen(false); }}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground transition-colors"
          >
            <Bot className="size-4 shrink-0" />
            {(!collapsed || mobileOpen) && (
              <span className={cn(collapsed && !mobileOpen && "md:hidden")}>
                ATLAS Agent
              </span>
            )}
          </button>
        </div>

        {/* collapse toggle — hidden on mobile (there's the hamburger instead) */}
        <div className="border-t border-sidebar-border p-2 hidden md:block">
          <button
            id="sidebar-toggle"
            onClick={() => onCollapsedChange(!collapsed)}
            className="flex w-full items-center justify-center rounded-lg p-2 text-sidebar-foreground/50 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground transition-colors"
          >
            {collapsed ? <ChevronRight className="size-4" /> : <ChevronLeft className="size-4" />}
          </button>
        </div>
      </aside>
    </>
  );
}
