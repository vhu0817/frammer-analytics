import axios from "axios";

// central axios instance — all API calls go through this
const api = axios.create({
  // in Docker: vite proxies /api → http://api:8000
  // locally: vite proxies /api → http://localhost:8000
  // either way, we just use relative URLs here
  baseURL: import.meta.env.VITE_API_URL || "",
  headers: { "Content-Type": "application/json" },
});

// ── request interceptor: auto-attach JWT ──
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("frammer_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ── response interceptor: handle 401 → redirect to login ──
// but NOT for auth endpoints themselves — those errors should be shown to the user
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const isAuthEndpoint = error.config?.url?.startsWith("/api/auth/");
    if (error.response?.status === 401 && !isAuthEndpoint) {
      // token expired or invalid — clear everything and redirect
      localStorage.removeItem("frammer_token");
      localStorage.removeItem("frammer_user");
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);

export default api;
