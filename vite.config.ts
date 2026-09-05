import { defineConfig } from "vite";

export default defineConfig({
  server: {
    host: true,
    port: 5500,
    strictPort: true,
    allowedHosts: true,
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          supabase: ["@supabase/supabase-js"],
          vendor: ["decimal.js", "zod"],
        },
      },
    },
  },
});
