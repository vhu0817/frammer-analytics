import { User, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";

const ROLE_BADGES = {
  website_admin: { label: "Admin", className: "bg-chart-1/20 text-chart-1" },
  client_admin:  { label: "Client", className: "bg-chart-2/20 text-chart-2" },
  user:          { label: "Editor", className: "bg-chart-4/20 text-chart-4" },
};

export default function Header({ user, onLogout, sidebarCollapsed }) {
  const role = user?.role || "user";
  const badge = ROLE_BADGES[role] || ROLE_BADGES.user;

  return (
    <header
      className={cn(
        "fixed top-0 right-0 z-30 flex h-14 items-center justify-between border-b border-border bg-background/80 backdrop-blur-md px-6 transition-all duration-300",
        sidebarCollapsed ? "left-16" : "left-56"
      )}
    >
      {/* left: page context */}
      <div className="flex items-center gap-3">
        <h2 className="text-sm font-medium text-muted-foreground">
          Dashboard
        </h2>
      </div>

      {/* right: user info */}
      <div className="flex items-center gap-3">
        {/* role badge */}
        <span className={cn("rounded-md px-2 py-0.5 text-xs font-medium", badge.className)}>
          {badge.label}
        </span>

        {/* user avatar + name */}
        <div className="flex items-center gap-2">
          <div className="flex size-7 items-center justify-center rounded-full bg-muted">
            <User className="size-3.5 text-muted-foreground" />
          </div>
          <span className="hidden text-sm text-foreground sm:inline-block">
            {user?.email || "user@frammer.com"}
          </span>
        </div>

        {/* logout */}
        <button
          id="logout-btn"
          onClick={onLogout}
          className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          <LogOut className="size-3.5" />
          <span className="hidden sm:inline">Logout</span>
        </button>
      </div>
    </header>
  );
}
