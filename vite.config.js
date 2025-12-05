import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
    minify: 'terser',
    rollupOptions: {
      output: {
        manualChunks: {
          three: ['three'],
          'cannon-es': ['cannon-es'] // Add cannon-es to manual chunks
        }
      }
    }
  },
  optimizeDeps: {
    include: ['cannon-es'] // Ensure cannon-es is pre-bundled
  },
  server: {
    port: 3000,
    open: true
  }
});