const fs = require('fs');
const file = 'supabase/migrations/001_init_schema.sql';
let lines = fs.readFileSync(file, 'utf8').split('\n');
let out = [];

for (let line of lines) {
  let matchPolicy = line.match(/^CREATE POLICY ([\w_]+) ON ([\w_]+)/);
  if (matchPolicy) {
    out.push(`DROP POLICY IF EXISTS ${matchPolicy[1]} ON ${matchPolicy[2]};`);
  }
  let matchTrigger = line.match(/^CREATE TRIGGER ([\w_]+) BEFORE UPDATE ON ([\w_]+)/);
  if (matchTrigger) {
    out.push(`DROP TRIGGER IF EXISTS ${matchTrigger[1]} ON ${matchTrigger[2]};`);
  }
  out.push(line);
}

fs.writeFileSync(file, out.join('\n'));
console.log('Successfully updated 001_init_schema.sql');
