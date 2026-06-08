import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    // 0.0.0.0 so the container is reachable from the host machine
    host: "0.0.0.0",
    port: 5173,
    // proxy api calls to the backend container during dev,
    // so we don't run into CORS issues from the browser
    proxy: {
      "/api": {
        target: "http://api:8000",
        changeOrigin: true,
      },
    },
  },
});
