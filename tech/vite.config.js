import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// Served from Frappe Cloud at https://lcscales.v.frappe.cloud/tech —
// same pattern as the existing /schedule dispatch board SPA. The JS/CSS
// bundle is committed into beveren_fsm/beveren_fsm/public/tech/ (Frappe
// serves anything under an app's public/ folder at /assets/<app>/...).
// The HTML shell, service worker, and manifest are instead served as
// literal www/ files — see www/tech.py, www/tech/sw.js, www/tech/manifest.json
// in this project's server/ folder — because a service worker's default
// scope is the directory it's served from, and /assets/... won't cover
// the /tech/ scope the manifest's start_url needs.
export default defineConfig({
  base: '/assets/beveren_fsm/tech/',
  plugins: [
    react(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.js',
      injectManifest: {
        globPatterns: ['**/*.{js,css}'],
      },
      manifest: false, // manifest.json is hand-maintained in public/ and served from www/tech/
      devOptions: { enabled: true },
    }),
  ],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        // Fixed, non-hashed names so www/tech.html can reference them
        // without reading a manifest. Fine for an internal tool with a
        // controlled release cadence; re-deploy = new content, same URL.
        entryFileNames: 'tech.js',
        chunkFileNames: 'tech-[name].js',
        assetFileNames: (info) => (info.name?.endsWith('.css') ? 'tech.css' : '[name][extname]'),
      },
    },
  },
  server: {
    proxy: {
      // Local dev against a real Frappe Cloud site — set LCS_DEV_SITE
      // before running `yarn dev`, e.g. https://lcscales.v.frappe.cloud
      '/api': process.env.LCS_DEV_SITE || 'http://dev.localhost:8000',
    },
  },
});
