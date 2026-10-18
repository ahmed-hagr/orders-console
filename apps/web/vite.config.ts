import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    // Same origin for the browser, so the SameSite=Strict session cookie is sent.
    proxy: { "/api": "http://localhost:4000" },
  },
});
