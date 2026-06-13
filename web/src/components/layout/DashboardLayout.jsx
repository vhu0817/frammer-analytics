import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import Sidebar from "./Sidebar";
import Header from "./Header";

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
      />

      <Header
        user={user}
        onLogout={handleLogout}
        sidebarCollapsed={sidebarCollapsed}
        filtersOpen={filtersOpen}
        onFiltersToggle={() => setFiltersOpen((v) => !v)}
      />

      {/* main content area — pushes down when filter bar is open */}
      <main
        className={cn(
          "transition-all duration-300",
          sidebarCollapsed ? "pl-16" : "pl-56",
          filtersOpen ? "pt-[7.5rem]" : "pt-14"
        )}
      >
        <div className="p-6">
          {/* support both render-prop and regular children */}
          {typeof children === "function" ? children(activeTab) : children}
        </div>
      </main>
    </div>
  );
}
