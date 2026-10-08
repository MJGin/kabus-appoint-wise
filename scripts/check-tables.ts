import { config } from 'dotenv';
config({ path: '.env.local' });
config();

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } }
);

async function main() {
  console.log('Checking existing tables...\n');

  const tables = ['profiles', 'user_roles', 'approved_staff', 'semesters', 'timetable_slots', 'students', 'lecturers', 'units', 'appointments', 'notifications'];

  for (const table of tables) {
    const { data, error } = await supabase.from(table).select('*').limit(1);
    if (error) {
      console.log(`❌ ${table}: ${error.message}`);
    } else {
      console.log(`✅ ${table}: exists (${data.length} rows)`);
    }
  }
}

main().catch(console.error);