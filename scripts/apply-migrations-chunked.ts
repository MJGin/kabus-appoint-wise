import { config } from 'dotenv';
config({ path: '.env.local' });
config();

import { readFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } }
);

const sql = readFileSync('combined-migrations.sql', 'utf-8');

// Split by semicolon (naive but works for most cases)
const statements = sql
  .split(';')
  .map(s => s.trim())
  .filter(s => s.length > 0 && !s.startsWith('--'));

async function main() {
  console.log(`Applying ${statements.length} SQL statements...\n`);

  let success = 0;
  let failed = 0;

  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i];
    if (!stmt) continue;

    try {
      const { error } = await supabase.rpc('exec_sql', { sql: stmt + ';' });
      if (error) {
        // Try direct REST API call
        const response = await fetch(`${process.env.SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY!,
            'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY!}`,
          },
          body: JSON.stringify({ sql: stmt + ';' })
        });
        const result = await response.json();
        if (result.error) {
          failed++;
          console.log(`❌ [${i+1}/${statements.length}] ${stmt.substring(0, 60)}...`);
          console.log(`   Error: ${result.error.message || result.error}`);
        } else {
          success++;
          console.log(`✅ [${i+1}/${statements.length}] ${stmt.substring(0, 60)}...`);
        }
      } else {
        success++;
        console.log(`✅ [${i+1}/${statements.length}] ${stmt.substring(0, 60)}...`);
      }
    } catch (e) {
      failed++;
      console.log(`❌ [${i+1}/${statements.length}] ${stmt.substring(0, 60)}...`);
      console.log(`   Error: ${e.message}`);
    }
  }

  console.log(`\nDone: ${success} success, ${failed} failed`);
}

main().catch(console.error);