// supabase/functions/_shared/cors.ts
// Shared CORS headers for all Edge Functions
// Restrict to production origin in production, fallback for dev

const ALLOWED_ORIGINS = [
  Deno.env.get('APP_URL') ?? 'http://localhost:8080',
  'http://localhost:8080',  // Vite dev (current)
  'http://localhost:5173',  // Vite dev (legacy)
  'http://localhost:3000',  // TanStack dev
];

function getOrigin(req?: Request): string {
  if (req) {
    const origin = req.headers.get('origin');
    if (origin && ALLOWED_ORIGINS.some((o) => origin.startsWith(o))) {
      return origin;
    }
  }
  return ALLOWED_ORIGINS[0];
}

export function corsHeaders(req?: Request): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': getOrigin(req),
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
    'Access-Control-Max-Age': '86400',
  };
}
