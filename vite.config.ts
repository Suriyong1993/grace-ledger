import { defineConfig } from "vite";

// Split the vendor libraries out of the main chunk: @supabase/supabase-js
// dominates the bundle, and keeping it (plus decimal/zod) in separate chunks
// improves cache reuse across app-code releases and keeps every chunk below
// the 500 kB warning threshold.
export default defineConfig({
  // Allow the app to be served through proxied preview hosts (e.g. *.e2b.app).
  // Without this, Vite rejects requests whose Host header it does not recognise.
  server: {
    host: true,
    allowedHosts: true,
    hmr: {
      // The preview terminates TLS on port 443, so the websocket must go there.
      clientPort: 443,
      protocol: "wss",
    },
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
