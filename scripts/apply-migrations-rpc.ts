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

async function main() {
  console.log('Applying combined migrations via RPC...');

  try {
    const { data, error } = await supabase.rpc('exec_sql', { sql });
    if (error) {
      console.error('RPC error:', error.message);
    } else {
      console.log('Migrations applied successfully!');
      console.log(data);
    }
  } catch (e) {
    console.error('Error:', e.message);
  }
}

main().catch(e => console.error(e));