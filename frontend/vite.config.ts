import { defineConfig } from 'vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReactSwc from '@vitejs/plugin-react-swc'
import tailwindcss from '@tailwindcss/vite'
import { lingui } from '@lingui/vite-plugin'

export default defineConfig(async ({ mode }) => {
  const plugins = []

  if (mode === 'development') {
    const { devtools } = await import('@tanstack/devtools-vite')
    plugins.push(devtools())
  } else {
    const { cloudflare } = await import('@cloudflare/vite-plugin')
    plugins.push(cloudflare({ viteEnvironment: { name: 'ssr' } }))
  }

  plugins.push(
    tailwindcss(),
    tanstackStart(),
    viteReactSwc({
      plugins: [['@lingui/swc-plugin', {}]],
    }),
    lingui(),
  )

  return {
    resolve: { tsconfigPaths: true },
    plugins,
  }
})
