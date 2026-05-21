import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  build: {
    sourcemap: false,          // Never expose source maps in production
    minify: 'terser',          // Stronger minification obfuscates logic
    terserOptions: mode === 'production' ? {
      compress: {
        // Keep console.error for debugging - remove once crash is fixed
        pure_funcs: ['console.log', 'console.info', 'console.warn', 'console.debug'],
        drop_debugger: true,
      },
    } : {},
    rollupOptions: {
      output: {
        // Randomise chunk names so attackers can't map bundle structure
        chunkFileNames: 'assets/[hash].js',
        entryFileNames: 'assets/[hash].js',
        assetFileNames: 'assets/[hash][extname]',
      },
    },
  },
}))
