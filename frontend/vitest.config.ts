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
  },
  resolve: {
    alias: {
      "#": path.resolve(__dirname, "src"),
      "@": path.resolve(__dirname, "src"),
    },
  },
});
