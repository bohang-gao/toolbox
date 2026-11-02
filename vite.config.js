import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// GitHub Pages 部署在 /<repo>/ 子路径下；本地开发与 preview 使用根路径。
const isPages = process.env.GH_PAGES === '1'

export default defineConfig({
  plugins: [vue()],
  base: isPages ? '/imgtool-clone/' : '/',
  server: { host: true, port: 5173 },
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 1200
  }
})
