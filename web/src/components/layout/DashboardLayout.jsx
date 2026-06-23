import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import Sidebar from "./Sidebar";
import Header from "./Header";
import AtlasChat from "@/components/agent/AtlasChat";

export default function DashboardLayout({ children, user, onLogout }) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("executive");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [atlasOpen, setAtlasOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const handleTabChange = (tab) => setActiveTab(tab);
  const handleAtlasToggle = () => setAtlasOpen((prev) => !prev);

  const handleLogout = () => {
    onLogout();
    navigate("/login");
  };

  return (
    <div className="min-h-screen bg-background">
      <Sidebar
        activeTab={activeTab}
        onTabChange={handleTabChange}
        onAtlasToggle={handleAtlasToggle}
        collapsed={sidebarCollapsed}
        onCollapsedChange={setSidebarCollapsed}
      />

      <Header
        user={user}
        onLogout={handleLogout}
        sidebarCollapsed={sidebarCollapsed}
        filtersOpen={filtersOpen}
        onFiltersToggle={() => setFiltersOpen((v) => !v)}
      />

      {/* main content area — pushes down when filter bar is open */}
      {/* on mobile: no left padding (sidebar is an overlay), just top padding for header */}
      <main
        className={cn(
          "transition-all duration-300",
          // desktop sidebar padding
          sidebarCollapsed ? "md:pl-16" : "md:pl-56",
          // mobile: no sidebar padding, but add left padding for hamburger
          "pl-0",
          filtersOpen ? "pt-[7.5rem]" : "pt-14"
        )}
      >
        <div className="p-4 md:p-6">
          {/* support both render-prop and regular children */}
          {typeof children === "function" ? children(activeTab) : children}
        </div>
      </main>

      {/* ATLAS AI chat panel — slides in from the right */}
      <AtlasChat isOpen={atlasOpen} onClose={() => setAtlasOpen(false)} />
    </div>
  );
}
