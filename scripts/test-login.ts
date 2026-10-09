import { config } from 'dotenv';
config({ path: '.env.local' });
config();

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } }
);

// Test sign in with a student account
const { data, error } = await supabase.auth.signInWithPassword({
  email: 'mmokeira@kabarak.ac.ke',
  password: 'KabusTest2026!'
});

if (error) {
  console.error('Student login failed:', error.message);
} else {
  console.log('✅ Student login works:', data.user.email, '| role:', data.user.user_metadata?.requested_role);
}

// Test sign in with a lecturer
const { data: data2, error: error2 } = await supabase.auth.signInWithPassword({
  email: 'tthangari@kabarak.ac.ke',
  password: 'KabusTest2026!'
});

if (error2) {
  console.error('Lecturer login failed:', error2.message);
} else {
  console.log('✅ Lecturer login works:', data2.user.email, '| role:', data2.user.user_metadata?.requested_role);
}

// Test sign in with dean
const { data: data3, error: error3 } = await supabase.auth.signInWithPassword({
  email: 'ikumilu@kabarak.ac.ke',
  password: 'KabusTest2026!'
});

if (error3) {
  console.error('Dean login failed:', error3.message);
} else {
  console.log('✅ Dean login works:', data3.user.email, '| role:', data3.user.user_metadata?.requested_role);
}