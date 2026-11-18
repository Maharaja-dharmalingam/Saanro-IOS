import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  build: {
    // Capacitor requires a flat dist/ output (no base-relative paths)
    outDir: 'dist',
    emptyOutDir: true,
    // Inline small assets so Capacitor WebView loads them without extra requests
    assetsInlineLimit: 4096,
  },
});
