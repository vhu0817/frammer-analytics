import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import useAuthStore from "@/stores/authStore";
import DashboardLayout from "@/components/layout/DashboardLayout";
import ErrorBoundary from "@/components/ui/ErrorBoundary";
import { ToastContainer } from "@/components/ui/Toast";
import Login from "@/pages/Login";
import ExecutiveSummary from "@/pages/ExecutiveSummary";
import UsageTrends from "@/pages/UsageTrends";
import Analysis from "@/pages/Analysis";
import PublishingFunnel from "@/pages/PublishingFunnel";
import VideoExplorer from "@/pages/VideoExplorer";
import DataQuality from "@/pages/DataQuality";

// wrapper that redirects to /login if there's no token
function ProtectedRoute({ children }) {
  const token = useAuthStore((s) => s.token);
  if (!token) return <Navigate to="/login" replace />;
  return children;
}



// routes each sidebar tab to the right page
// each page is wrapped in its own ErrorBoundary so one crash
// doesn't affect the rest of the dashboard
function DashboardContent({ activeTab }) {
  switch (activeTab) {
    case "executive":
      return <ErrorBoundary key="executive"><ExecutiveSummary /></ErrorBoundary>;
    case "trends":
      return <ErrorBoundary key="trends"><UsageTrends /></ErrorBoundary>;
    case "analysis":
      return <ErrorBoundary key="analysis"><Analysis /></ErrorBoundary>;
    case "funnel":
      return <ErrorBoundary key="funnel"><PublishingFunnel /></ErrorBoundary>;
    case "explorer":
      return <ErrorBoundary key="explorer"><VideoExplorer /></ErrorBoundary>;
    case "quality":
      return <ErrorBoundary key="quality"><DataQuality /></ErrorBoundary>;
    default:
      return <ErrorBoundary key="executive"><ExecutiveSummary /></ErrorBoundary>;
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
      <ToastContainer />
    </BrowserRouter>
  );
}
