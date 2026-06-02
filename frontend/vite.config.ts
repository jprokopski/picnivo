import { defineConfig } from 'vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(async ({ mode }) => {
  const plugins = []

  if (mode === 'development') {
    const { devtools } = await import('@tanstack/devtools-vite')
    plugins.push(devtools())
  } else {
    const { cloudflare } = await import('@cloudflare/vite-plugin')
    plugins.push(cloudflare({ viteEnvironment: { name: 'ssr' } }))
  }

  plugins.push(tailwindcss(), tanstackStart(), viteReact())

  return {
    resolve: { tsconfigPaths: true },
    plugins,
  }
})
