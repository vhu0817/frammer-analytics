import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

export default defineConfig({
  plugins: [tailwindcss(), react()],
  resolve: {
    // the "@" alias lets us write `import Sidebar from "@/components/Sidebar"`
    // instead of relative paths like `../../components/Sidebar`
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    // 0.0.0.0 so the container is reachable from the host machine
    host: "0.0.0.0",
    port: 5173,
    // proxy api calls to the backend container during dev,
    // so we don't run into CORS issues from the browser
    proxy: {
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: true,
      },
    },
  },
});
