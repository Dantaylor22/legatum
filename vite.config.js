import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  build: {
    sourcemap: false,          // Never expose source maps in production
    minify: 'terser',          // Stronger minification obfuscates logic
    rollupOptions: {
      output: {
        // Randomise chunk names so attackers can't map bundle structure
        chunkFileNames: 'assets/[hash].js',
        entryFileNames: 'assets/[hash].js',
        assetFileNames: 'assets/[hash][extname]',
      },
    },
  },
  // Strip console.log in production
  esbuild: mode === 'production' ? { drop: ['console', 'debugger'] } : {},
}))
