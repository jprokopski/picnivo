import path from "path";
import { defineConfig } from "vitest/config";
import viteReactSwc from "@vitejs/plugin-react-swc";
import { lingui } from "@lingui/vite-plugin";

export default defineConfig({
  plugins: [
    viteReactSwc({
      plugins: [["@lingui/swc-plugin", {}]],
    }),
    lingui(),
  ],
  test: {
    environment: "jsdom",
    globals: false,
    env: {
      VITE_SUPABASE_URL: "http://localhost:54321",
      VITE_SUPABASE_ANON_KEY: "test-anon-key",
      VITE_API_URL: "http://localhost:5000",
    },
  },
  resolve: {
    alias: {
      "#": path.resolve(__dirname, "src"),
      "@": path.resolve(__dirname, "src"),
    },
  },
});
