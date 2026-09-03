import { defineConfig } from "vite";

// Split the vendor libraries out of the main chunk: @supabase/supabase-js
// dominates the bundle, and keeping it (plus decimal/zod) in separate chunks
// improves cache reuse across app-code releases and keeps every chunk below
// the 500 kB warning threshold.
export default defineConfig({
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
