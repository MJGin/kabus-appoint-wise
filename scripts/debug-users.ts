import { config } from 'dotenv';
config({ path: '.env.local' });
config();

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } }
);

const { data: users, error } = await supabase.auth.admin.listUsers();
if (error) { console.error(error); process.exit(1); }

console.log('Total users:', users.users.length);
users.users.forEach(u => {
  console.log(`- ${u.email} | ${u.id} | confirmed: ${u.email_confirmed_at} | metadata: ${JSON.stringify(u.user_metadata)}`);
});

// Also check profiles
const { data: profiles } = await supabase.from('profiles').select('*');
console.log('\nProfiles:', profiles?.length);
profiles?.forEach(p => console.log(`  - ${p.id} | ${p.full_name} | ${p.email} | ${p.reg_number}`));

// Check user_roles
const { data: roles } = await supabase.from('user_roles').select('*');
console.log('\nUser Roles:', roles?.length);
roles?.forEach(r => console.log(`  - ${r.user_id} | ${r.role}`));

// Check approved_staff
const { data: approved } = await supabase.from('approved_staff').select('*');
console.log('\nApproved Staff:', approved?.length);
approved?.forEach(a => console.log(`  - ${a.email} | ${a.role}`));