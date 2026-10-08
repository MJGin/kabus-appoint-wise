import { config } from 'dotenv';
config({ path: '.env.local' });
config();

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } }
);

const lecturerEmails = [
  'tthangari@kabarak.ac.ke',
  'cgitonga@kabarak.ac.ke',
  'pojode@kabarak.ac.ke',
  'chepchirchirtukai@kabarak.ac.ke',
  'koechc@kabarak.ac.ke'
];

async function main() {
  console.log('🔧 Fixing missing lecturer roles...\n');

  // Get all users
  const { data: users } = await supabase.auth.admin.listUsers();
  const lecturerUsers = users.users.filter(u => lecturerEmails.includes(u.email));

  for (const user of lecturerUsers) {
    // Check if role already exists
    const { data: existingRole } = await supabase
      .from('user_roles')
      .select('*')
      .eq('user_id', user.id)
      .eq('role', 'lecturer')
      .maybeSingle();

    if (existingRole) {
      console.log(`✅ ${user.email} already has lecturer role`);
    } else {
      const { error } = await supabase
        .from('user_roles')
        .insert({ user_id: user.id, role: 'lecturer' });

      if (error) {
        console.error(`❌ Failed for ${user.email}:`, error.message);
      } else {
        console.log(`✅ Added lecturer role for ${user.email}`);
      }
    }
  }

  // Verify
  const { data: roles } = await supabase.from('user_roles').select('*');
  console.log('\n📋 Total user_roles now:', roles?.length);
  roles?.forEach(r => console.log(`  - ${r.user_id} | ${r.role}`));
}

main().catch(console.error);