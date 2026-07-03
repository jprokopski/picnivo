import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReactSwc from "@vitejs/plugin-react-swc";
import tailwindcss from "@tailwindcss/vite";
import { lingui } from "@lingui/vite-plugin";
import { devtools } from "@tanstack/devtools-vite";

export default defineConfig(async ({ mode }) => {
  // Must stay first: this plugin strips TanStackDevtools imports/JSX from
  // the production build (removeDevtoolsOnBuild defaults to true).
  const plugins = [devtools()];

  if (mode !== "development") {
    const { cloudflare } = await import("@cloudflare/vite-plugin");
    plugins.push(cloudflare({ viteEnvironment: { name: "ssr" } }));
  }

  plugins.push(
    tailwindcss(),
    tanstackStart(),
    viteReactSwc({
      plugins: [["@lingui/swc-plugin", {}]],
    }),
    lingui(),
  );

  return {
    resolve: { tsconfigPaths: true },
    plugins,
  };
});
