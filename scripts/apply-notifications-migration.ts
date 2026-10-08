import { config } from 'dotenv';
config({ path: '.env.local' });
config();
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } }
);

const sql = readFileSync('supabase/migrations/20261008000000_notifications.sql', 'utf-8');
const statements = sql.split(';').map(s => s.trim()).filter(s => s.length > 0 && !s.startsWith('--'));
console.log('Statements:', statements.length);

for (let i = 0; i < statements.length; i++) {
  const stmt = statements[i];
  if (!stmt) continue;
  try {
    const response = await fetch(process.env.SUPABASE_URL + '/rest/v1/rpc/exec_sql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY!,
        'Authorization': 'Bearer ' + process.env.SUPABASE_SERVICE_ROLE_KEY!,
      },
      body: JSON.stringify({ sql: stmt + ';' })
    });
    const result = await response.json();
    if (result.error) {
      console.log('❌ [' + (i+1) + '/' + statements.length + '] ' + stmt.substring(0, 60) + '...');
      console.log('   Error: ' + (result.error.message || result.error));
    } else {
      console.log('✅ [' + (i+1) + '/' + statements.length + '] ' + stmt.substring(0, 60) + '...');
    }
  } catch (e) {
    console.log('❌ [' + (i+1) + '/' + statements.length + '] Exception: ' + e);
  }
}