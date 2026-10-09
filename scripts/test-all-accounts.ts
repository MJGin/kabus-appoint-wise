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
  // Test admin (administrator)
  const { data: admin, error: adminErr } = await supabase.auth.signInWithPassword({
    email: 'lboli@kabarak.ac.ke',
    password: 'KabusTest2026!'
  });
  console.log(adminErr ? '❌ Admin: ' + adminErr.message : '✅ Admin works: ' + admin.user.email + ' | ' + admin.user.user_metadata?.requested_role);

  // Test IT support
  const { data: it, error: itErr } = await supabase.auth.signInWithPassword({
    email: 'rwahome@kabarak.ac.ke',
    password: 'KabusTest2026!'
  });
  console.log(itErr ? '❌ IT: ' + itErr.message : '✅ IT works: ' + it.user.email + ' | ' + it.user.user_metadata?.requested_role);

  // Test remaining students
  const students = ['njugunal@kabarak.ac.ke', 'chepchumbab@kabarak.ac.ke', "ndung'u@kabarak.ac.ke", 'elikiprotich@kabarak.ac.ke'];
  for (const email of students) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password: 'KabusTest2026!' });
    console.log(error ? '❌ ' + email + ': ' + error.message : '✅ ' + email);
  }

  // Test remaining lecturers
  const lecturers = ['cgitonga@kabarak.ac.ke', 'pojode@kabarak.ac.ke', 'chepchirchirtukai@kabarak.ac.ke', 'koechc@kabarak.ac.ke'];
  for (const email of lecturers) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password: 'KabusTest2026!' });
    console.log(error ? '❌ ' + email + ': ' + error.message : '✅ ' + email);
  }
}

main().catch(console.error);