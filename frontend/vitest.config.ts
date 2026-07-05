import path from "path";
import { defineConfig, configDefaults } from "vitest/config";
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
    // E2E specs (tests/e2e/*.spec.ts) are Playwright, not Vitest — exclude
    // them so `vitest related` (pre-commit) never tries to run test() here.
    exclude: [...configDefaults.exclude, "tests/e2e/**"],
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
