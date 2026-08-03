import fs from 'fs';
import path from 'path';

const migrationsDir = 'supabase/migrations';
const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql'));

for (const file of files) {
  const filePath = path.join(migrationsDir, file);
  let sql = fs.readFileSync(filePath, 'utf8');

  // Add DROP POLICY IF EXISTS before CREATE POLICY
  sql = sql.replace(/^CREATE POLICY ([^\n]+) ON ([^\n\s]+)/gm, (match, policyName, tableName) => {
    return `DROP POLICY IF EXISTS ${policyName} ON ${tableName};\nCREATE POLICY ${policyName} ON ${tableName}`;
  });

  // Add DROP TRIGGER IF EXISTS before CREATE TRIGGER
  sql = sql.replace(/^CREATE TRIGGER ([^\n\s]+) BEFORE UPDATE ON ([^\n\s]+)/gm, (match, triggerName, tableName) => {
    return `DROP TRIGGER IF EXISTS ${triggerName} ON ${tableName};\nCREATE TRIGGER ${triggerName} BEFORE UPDATE ON ${tableName}`;
  });

  fs.writeFileSync(filePath, sql);
  console.log(`Updated ${file}`);
}
