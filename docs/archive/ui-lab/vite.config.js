// Minimal Vite config for the UI Lab preview server.
// Served separately from the app (port 5501) so the lab never ships in the
// production bundle: `npm run build` only compiles the root index.html.
import { defineConfig } from "vite";

export default defineConfig({
  server: {
    host: true,
    allowedHosts: true,
    hmr: { clientPort: 443, protocol: "wss" },
  },
});
