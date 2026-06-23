import { useState, useEffect } from "react";
import { User, LogOut, SlidersHorizontal, X, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import useFilterStore from "@/stores/filterStore";
import api from "@/lib/api";

const ROLE_BADGES = {
  website_admin: { label: "Admin", className: "bg-chart-1/20 text-chart-1" },
  client_admin:  { label: "Client", className: "bg-chart-2/20 text-chart-2" },
  user:          { label: "Editor", className: "bg-chart-4/20 text-chart-4" },
};

export default function Header({ user, onLogout, sidebarCollapsed, filtersOpen, onFiltersToggle }) {
  const role = user?.role || "user";
  const badge = ROLE_BADGES[role] || ROLE_BADGES.user;

  const [filterOptions, setFilterOptions] = useState(null);

  // current filter state
  const clientId = useFilterStore((s) => s.clientId);
  const channelId = useFilterStore((s) => s.channelId);
  const platformId = useFilterStore((s) => s.platformId);
  const setFilters = useFilterStore((s) => s.setFilters);
  const resetFilters = useFilterStore((s) => s.resetFilters);

  const hasActiveFilters = clientId || channelId || platformId;

  // load filter options once
  useEffect(() => {
    const loadOptions = async () => {
      try {
        const res = await api.get("/api/filters/options");
        setFilterOptions(res.data);
      } catch (err) {
        console.error("Failed to load filter options", err);
      }
    };
    loadOptions();
  }, []);

  // filter the channels to only show those belonging to the selected client
  const filteredChannels = filterOptions?.channels?.filter(
    (ch) => !clientId || ch.client_id === Number(clientId)
  ) || [];

  return (
    <>
      <header
        className={cn(
          "fixed top-0 right-0 z-30 flex h-14 items-center justify-between border-b border-border bg-background/80 backdrop-blur-md px-4 md:px-6 transition-all duration-300",
          // on mobile: full width (sidebar is overlay), leave room for hamburger
          "left-0",
          // on desktop: offset by sidebar width
          sidebarCollapsed ? "md:left-16" : "md:left-56"
        )}
      >
        {/* left: page context + filter toggle */}
        <div className="flex items-center gap-3 ml-10 md:ml-0">
          <h2 className="text-sm font-medium text-muted-foreground hidden sm:block">
            Dashboard
          </h2>

          {/* filter toggle button */}
          <button
            id="filter-toggle"
            onClick={onFiltersToggle}
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition-colors",
              filtersOpen || hasActiveFilters
                ? "bg-primary/15 text-primary"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <SlidersHorizontal className="size-3.5" />
            <span className="hidden sm:inline">Filters</span>
            {hasActiveFilters && (
              <span className="flex size-4 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground font-bold">
                {[clientId, channelId, platformId].filter(Boolean).length}
              </span>
            )}
          </button>
        </div>

        {/* right: user info */}
        <div className="flex items-center gap-2 md:gap-3">
          {/* role badge */}
          <span className={cn("rounded-md px-2 py-0.5 text-xs font-medium", badge.className)}>
            {badge.label}
          </span>

          {/* user avatar + name */}
          <div className="flex items-center gap-2">
            <div className="flex size-7 items-center justify-center rounded-full bg-muted">
              <User className="size-3.5 text-muted-foreground" />
            </div>
            <span className="hidden text-sm text-foreground lg:inline-block">
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

      {/* filter bar below header — fixed, pushes content via DashboardLayout padding */}
      <div
        className={cn(
          "fixed right-0 z-20 border-b border-border bg-background/95 backdrop-blur-md overflow-hidden transition-all duration-300",
          "left-0",
          sidebarCollapsed ? "md:left-16" : "md:left-56",
          filtersOpen ? "top-14 opacity-100" : "top-14 h-0 opacity-0"
        )}
      >
        {/* responsive filter layout: stack vertically on mobile, horizontal on desktop */}
        <div className={cn(
          "flex items-center gap-3 px-4 md:px-6",
          filtersOpen ? "py-2 md:h-12 md:py-0 flex-wrap md:flex-nowrap" : ""
        )}>
          {/* client filter */}
          <FilterSelect
            id="filter-client"
            label="Client"
            value={clientId || ""}
            onChange={(v) => {
              // reset channel if changing client
              setFilters({ clientId: v || null, channelId: null });
            }}
            options={filterOptions?.clients?.map((c) => ({
              value: c.id,
              label: c.name,
            })) || []}
          />

          {/* channel filter */}
          <FilterSelect
            id="filter-channel"
            label="Channel"
            value={channelId || ""}
            onChange={(v) => setFilters({ channelId: v || null })}
            options={filteredChannels.map((c) => ({
              value: c.id,
              label: c.name,
            }))}
          />

          {/* platform filter */}
          <FilterSelect
            id="filter-platform"
            label="Platform"
            value={platformId || ""}
            onChange={(v) => setFilters({ platformId: v || null })}
            options={filterOptions?.platforms?.map((p) => ({
              value: p.id,
              label: p.name,
            })) || []}
          />

          {/* reset button */}
          {hasActiveFilters && (
            <button
              id="filter-reset"
              onClick={resetFilters}
              className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-chart-3 hover:bg-chart-3/10 transition-colors"
            >
              <RotateCcw className="size-3" />
              Reset
            </button>
          )}
        </div>
      </div>
    </>
  );
}

// reusable filter dropdown
function FilterSelect({ id, label, value, onChange, options }) {
  return (
    <div className="flex items-center gap-1.5">
      <label htmlFor={id} className="text-xs text-muted-foreground whitespace-nowrap">
        {label}:
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
        className={cn(
          "rounded-md border border-border bg-muted/30 px-2 py-1 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-ring/30 max-w-[140px] md:max-w-[160px] transition-colors",
          value ? "text-foreground" : "text-muted-foreground"
        )}
      >
        <option value="">All</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}
