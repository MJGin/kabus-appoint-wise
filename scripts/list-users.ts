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
  const { data } = await supabase.auth.admin.listUsers();
  data.users.forEach(u => console.log(u.email, '|', u.user_metadata?.requested_role));
}

main().catch(console.error);