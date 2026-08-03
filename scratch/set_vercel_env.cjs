const { execSync } = require('child_process');

const envs = {
  'VITE_SUPABASE_URL': 'https://xowlhdeizszxxrvuyqdq.supabase.co',
  'SUPABASE_URL': 'https://xowlhdeizszxxrvuyqdq.supabase.co',
  'VITE_SUPABASE_ANON_KEY': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhvd2xoZGVpenN6eHhydnV5cWRxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ5OTAwNzUsImV4cCI6MjEwMDU2NjA3NX0.-gxmE4Sh8wRh0VVP_12ubfOETXlxyd6VbSbbvEN20iI',
  'SUPABASE_SERVICE_ROLE_KEY': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhvd2xoZGVpenN6eHhydnV5cWRxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NDk5MDA3NSwiZXhwIjoyMTAwNTY2MDc1fQ.ubKp_hoEXdgYpZnn4kkCegF7TmgWQGlb_VZ903qzDLQ',
  'JWT_SECRET': 'super_secret_jwt_signing_key_for_test_environment_2026_grace_ledger_v2'
};

for (const [key, val] of Object.entries(envs)) {
  try {
    execSync(`npx vercel env rm ${key} production --yes`, { stdio: 'ignore' });
  } catch (e) {}
  execSync(`npx vercel env add ${key} production`, { input: val, stdio: ['pipe', 'inherit', 'inherit'] });
  console.log(`Successfully set ${key}`);
}
