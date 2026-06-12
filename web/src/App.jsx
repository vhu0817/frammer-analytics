import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import useAuthStore from "@/stores/authStore";
import DashboardLayout from "@/components/layout/DashboardLayout";
import Login from "@/pages/Login";
import ExecutiveSummary from "@/pages/ExecutiveSummary";

// wrapper that redirects to /login if there's no token
function ProtectedRoute({ children }) {
  const token = useAuthStore((s) => s.token);
  if (!token) return <Navigate to="/login" replace />;
  return children;
}

// placeholder for tabs we haven't built yet (phases 6.2–6.5)
function PlaceholderPage({ title, description }) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        <p className="text-sm text-muted-foreground mt-1">{description}</p>
      </div>
      <div className="glass-card flex h-64 items-center justify-center">
        <p className="text-muted-foreground text-sm">📊 Charts coming soon</p>
      </div>
    </div>
  );
}

// routes each sidebar tab to the right page
function DashboardContent({ activeTab }) {
  switch (activeTab) {
    case "executive":
      return <ExecutiveSummary />;
    case "trends":
      return <PlaceholderPage title="Usage & Trends" description="Time series with granularity toggle" />;
    case "analysis":
      return <PlaceholderPage title="Analysis" description="Pivot tables, leaderboards, and drilldowns" />;
    case "funnel":
      return <PlaceholderPage title="Publishing Funnel" description="Upload → process → publish conversion" />;
    case "explorer":
      return <PlaceholderPage title="Video Explorer" description="Searchable, sortable, exportable video list" />;
    default:
      return <ExecutiveSummary />;
  }
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
