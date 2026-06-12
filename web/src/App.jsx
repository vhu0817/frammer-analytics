import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import useAuthStore from "@/stores/authStore";
import DashboardLayout from "@/components/layout/DashboardLayout";
import Login from "@/pages/Login";

// wrapper that redirects to /login if there's no token
function ProtectedRoute({ children }) {
  const token = useAuthStore((s) => s.token);
  if (!token) return <Navigate to="/login" replace />;
  return children;
}

// placeholder pages — real implementations come in phase 6
function PlaceholderPage({ title, description }) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        <p className="text-sm text-muted-foreground mt-1">{description}</p>
      </div>
      <div className="glass-card flex h-64 items-center justify-center">
        <p className="text-muted-foreground text-sm">Charts coming in Phase 6</p>
      </div>
    </div>
  );
}

// main dashboard content — switches based on active tab from sidebar
function DashboardContent({ activeTab }) {
  const PAGES = {
    executive: { title: "Executive Summary", description: "KPIs, sparklines, and anomaly alerts" },
    trends:    { title: "Usage & Trends", description: "Time series with granularity toggle" },
    analysis:  { title: "Analysis", description: "Pivot tables, leaderboards, and drilldowns" },
    funnel:    { title: "Publishing Funnel", description: "Upload → process → publish conversion" },
    explorer:  { title: "Video Explorer", description: "Searchable, sortable, exportable video list" },
  };

  const page = PAGES[activeTab] || PAGES.executive;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{page.title}</h1>
        <p className="text-sm text-muted-foreground mt-1">{page.description}</p>
      </div>

      {/* sample KPI cards — only on executive tab */}
      {activeTab === "executive" && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "Videos Uploaded", value: "14,130", change: "+5.7%" },
            { label: "Processing Rate", value: "85.1%", change: "+0.3%" },
            { label: "Publish Rate",    value: "55.2%", change: "+1.2%" },
            { label: "Total Duration",  value: "2,973h", change: "+4.8%" },
          ].map((kpi) => (
            <div key={kpi.label} className="glass-card-hover p-5">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                {kpi.label}
              </p>
              <p className="mt-2 text-2xl font-bold text-foreground">{kpi.value}</p>
              <p className="mt-1 text-xs text-chart-2">{kpi.change} vs prev period</p>
            </div>
          ))}
        </div>
      )}

      <div className="glass-card flex h-64 items-center justify-center">
        <p className="text-muted-foreground text-sm">📊 Charts coming in Phase 6</p>
      </div>
    </div>
  );
}

export default function App() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/*"
          element={
            <ProtectedRoute>
              <DashboardLayout user={user} onLogout={logout}>
                {(activeTab) => <DashboardContent activeTab={activeTab} />}
              </DashboardLayout>
            </ProtectedRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}
