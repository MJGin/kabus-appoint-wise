#!/usr/bin/env tsx
/**
 * Seed script to populate database from PDF requirements
 * Run with: npx tsx scripts/seed-from-pdf.ts
 */

import { config } from 'dotenv';
config({ path: '.env.local' }); // Load .env.local file
config(); // Load .env file

import { createClient } from '@supabase/supabase-js';

function isNewSupabaseApiKey(value: string): boolean {
  return value.startsWith('sb_publishable_') || value.startsWith('sb_secret_');
}

function createSupabaseFetch(supabaseKey: string): typeof fetch {
  return (input, init) => {
    const headers = new Headers(
      typeof Request !== 'undefined' && input instanceof Request ? input.headers : undefined,
    );
    if (init?.headers) {
      new Headers(init.headers).forEach((value, key) => headers.set(key, value));
    }
    if (isNewSupabaseApiKey(supabaseKey) && headers.get('Authorization') === `Bearer ${supabaseKey}`) {
      headers.delete('Authorization');
    }
    headers.set('apikey', supabaseKey);
    return fetch(input, { ...init, headers });
  };
}

function createSupabaseAdminClient() {
  const SUPABASE_URL = process.env['SUPABASE_URL'] || process.env['VITE_SUPABASE_URL'];
  const SUPABASE_SERVICE_ROLE_KEY = process.env['SUPABASE_SERVICE_ROLE_KEY'];

  if (!SUPABASE_URL) {
    throw new Error('Missing SUPABASE_URL or VITE_SUPABASE_URL');
  }
  if (!SUPABASE_SERVICE_ROLE_KEY) {
    console.warn('⚠️  SUPABASE_SERVICE_ROLE_KEY not set - admin operations will fail');
    console.warn('   Get it from Lovable Dashboard → Project → Settings → Database → Service Role Key');
    console.warn('   Add to .env.local or export before running script');
  }

  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    global: { fetch: createSupabaseFetch(SUPABASE_SERVICE_ROLE_KEY) },
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
}

const supabaseAdmin = createSupabaseAdminClient();

// --- Data from PDF ---

const students = [
  { fullName: 'Mathenge Melissa Mokeira', regNumber: 'LAW/M/1043/05/26', email: 'mmokeira@kabarak.ac.ke' },
  { fullName: 'Njuguna Luthuli Ndirangu', regNumber: 'LAW/M/1371/05/26', email: 'njugunal@kabarak.ac.ke' },
  { fullName: 'Blessing Sirtuy', regNumber: 'LAW/M/1096/05/26', email: 'chepchumbab@kabarak.ac.ke' },
  { fullName: "Ndung'u Terryann Njoki", regNumber: 'LAW/M/1321/05/26', email: "ndung'u@kabarak.ac.ke" },
  { fullName: 'Toroitich Eli', regNumber: 'LAW/M/1448/05/26', email: 'elikiprotich@kabarak.ac.ke' },
];

const adminStaff = [
  { email: 'ikumilu@kabarak.ac.ke', fullName: 'Alma Zawadi', role: 'dean' as const, approvedRole: 'dean' as const },
  { email: 'lboli@kabarak.ac.ke', fullName: 'Lawrent Meja', role: 'administrator' as const, approvedRole: null }, // administrator not in approved_staff check constraint
  { email: 'rwahome@kabarak.ac.ke', fullName: 'Ryan Richards', role: 'it_support' as const, approvedRole: 'it_support' as const },
];

const staffMembers = [
  { fullName: 'Terry Thangari', email: 'tthangari@kabarak.ac.ke', subject: 'Data science For lawyers', availableDay: 1, availableBlock: 'block_3' }, // Monday 2-5
  { fullName: 'Cynthia Mercy', email: 'cgitonga@kabarak.ac.ke', subject: 'Bill Of Rights', availableDay: 2, availableBlock: 'block_1' }, // Tuesday 8-11
  { fullName: 'Phyllis Ojode', email: 'pojode@kabarak.ac.ke', subject: 'Criminal Law', availableDay: 5, availableBlock: 'block_3' }, // Friday 2-5
  { fullName: 'Chepchirchir Tukai', email: 'chepchirchirtukai@kabarak.ac.ke', subject: 'Law and Society', availableDay: 4, availableBlock: 'block_3' }, // Thursday 2-5
  { fullName: 'Koech Chebet Mitchelle', email: 'koechc@kabarak.ac.ke', subject: 'Legal systems and Methods', availableDay: 3, availableBlock: 'block_3' }, // Wednesday 2-5
];

const DEFAULT_PASSWORD = 'KabusTest2026!';

async function hashPassword(password: string): Promise<string> {
  // Note: In production, Supabase handles password hashing via auth.signUp
  // This is just for reference
  return password;
}

async function createAuthUser(email: string, password: string, metadata: Record<string, unknown>) {
  // First check if user already exists
  const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
  const existingUser = existingUsers.users.find(u => u.email === email);
  if (existingUser) {
    console.log(`    User already exists: ${existingUser.id}`);
    // Update user metadata if needed
    await supabaseAdmin.auth.admin.updateUserById(existingUser.id, {
      user_metadata: metadata,
      password: password,
    });
    return existingUser;
  }

  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: metadata,
  });
  if (error) throw error;
  return data.user;
}

async function upsertProfile(userId: string, profile: {
  full_name: string;
  email: string | null;
  reg_number: string | null;
  title: string | null;
  department: string | null;
}) {
  const { error } = await supabaseAdmin.from('profiles').upsert({
    id: userId,
    full_name: profile.full_name,
    email: profile.email,
    reg_number: profile.reg_number,
    title: profile.title,
    department: profile.department,
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
}

async function upsertUserRole(userId: string, role: 'student' | 'lecturer' | 'dean' | 'administrator' | 'it_support') {
  const { error } = await supabaseAdmin.from('user_roles').upsert({
    user_id: userId,
    role,
  }, { onConflict: 'user_id,role' });
  if (error) {
    // Ignore duplicate key errors
    if (error.code !== '23505') throw error;
  }
}

async function upsertApprovedStaff(email: string, role: 'dean' | 'administrator' | 'it_support' | 'lecturer') {
  const { error } = await supabaseAdmin.from('approved_staff').upsert({
    email,
    role,
  }, { onConflict: 'email' });
  if (error) {
    // Ignore duplicate key errors
    if (error.code !== '23505') throw error;
  }
}

async function getOrCreateSemester() {
  // Get active semester
  const { data: semester } = await supabaseAdmin
    .from('semesters')
    .select('id')
    .eq('is_active', true)
    .maybeSingle();

  if (semester) return semester.id;

  // Create a default semester
  const { data: newSemester, error } = await supabaseAdmin
    .from('semesters')
    .insert({
      name: '2025/2026 Academic Year',
      start_date: '2025-09-01',
      exam_start_date: '2026-04-01',
      end_date: '2026-07-31',
      is_active: true,
    })
    .select('id')
    .single();

  if (error) throw error;
  return newSemester.id;
}

async function upsertTimetableSlot(lecturerId: string, dayOfWeek: number, block: 'block_1' | 'block_2' | 'block_3', unitCode: string, unitName: string) {
  const semesterId = await getOrCreateSemester();

  // First try to find existing slot
  const { data: existing } = await supabaseAdmin
    .from('timetable_slots')
    .select('id')
    .eq('lecturer_id', lecturerId)
    .eq('semester_id', semesterId)
    .eq('day_of_week', dayOfWeek)
    .eq('block', block)
    .maybeSingle();

  if (existing) {
    // Update existing
    const { error } = await supabaseAdmin
      .from('timetable_slots')
      .update({
        unit_code: unitCode,
        unit_name: unitName,
        year_group: 5,
      })
      .eq('id', existing.id);
    if (error) throw error;
  } else {
    // Insert new
    const { error } = await supabaseAdmin.from('timetable_slots').insert({
      lecturer_id: lecturerId,
      semester_id: semesterId,
      day_of_week: dayOfWeek,
      block,
      unit_code: unitCode,
      unit_name: unitName,
      year_group: 5,
    });
    if (error) throw error;
  }
}

async function main() {
  console.log('🌱 Starting database seed from PDF data...\n');

  // 1. Create student accounts
  console.log('📚 Creating student accounts...');
  for (const student of students) {
    try {
      console.log(`  Creating: ${student.fullName} (${student.regNumber})`);
      const user = await createAuthUser(student.email, DEFAULT_PASSWORD, {
        full_name: student.fullName,
        reg_number: student.regNumber,
        requested_role: 'student',
      });
      await upsertProfile(user.id, {
        full_name: student.fullName,
        email: student.email,
        reg_number: student.regNumber,
        title: null,
        department: 'School of Law',
      });
      await upsertUserRole(user.id, 'student');
      console.log(`    ✅ Created student: ${user.id}`);
    } catch (e) {
      console.error(`    ❌ Failed:`, JSON.stringify(e, null, 2));
    }
  }

  // 2. Create admin accounts (dean, administrator, it_support)
  console.log('\n👑 Creating admin accounts...');
  for (const admin of adminStaff) {
    try {
      console.log(`  Creating: ${admin.fullName} (${admin.role})`);
      const user = await createAuthUser(admin.email, DEFAULT_PASSWORD, {
        full_name: admin.fullName,
        reg_number: null,
        requested_role: admin.role,
      });
      await upsertProfile(user.id, {
        full_name: admin.fullName,
        email: admin.email,
        reg_number: null,
        title: admin.role.charAt(0).toUpperCase() + admin.role.slice(1),
        department: 'Administration',
      });
      await upsertUserRole(user.id, admin.role);
      // Only add to approved_staff if approvedRole is set (administrator is not in check constraint)
      if (admin.approvedRole) {
        await upsertApprovedStaff(admin.email, admin.approvedRole);
      }
      console.log(`    ✅ Created ${admin.role}: ${user.id}`);
    } catch (e) {
      console.error(`    ❌ Failed:`, JSON.stringify(e, null, 2));
    }
  }

  // 3. Create staff accounts (lecturers) - pre-create profiles, they activate on signup
  console.log('\n👨‍🏫 Creating staff profiles (lecturers)...');
  for (const staff of staffMembers) {
    try {
      console.log(`  Creating profile for: ${staff.fullName} (${staff.subject})`);

      // Check if user already exists
      const { data: existingUser } = await supabaseAdmin.auth.admin.listUsers();
      const userExists = existingUser.users.find(u => u.email === staff.email);

      let userId: string;
      if (userExists) {
        userId = userExists.id;
        console.log(`    User exists: ${userId}`);
      } else {
        const user = await createAuthUser(staff.email, DEFAULT_PASSWORD, {
          full_name: staff.fullName,
          reg_number: null,
          requested_role: 'lecturer',
        });
        userId = user.id;
        await upsertUserRole(user.id, 'lecturer');
        console.log(`    ✅ Created user: ${userId}`);
      }

      await upsertProfile(userId, {
        full_name: staff.fullName,
        email: staff.email,
        reg_number: null,
        title: 'Lecturer',
        department: 'School of Law',
      });
      await upsertApprovedStaff(staff.email, 'lecturer');

      // Add timetable slot for their availability
      await upsertTimetableSlot(userId, staff.availableDay, staff.availableBlock, 'UNIT', staff.subject);
      console.log(`    ✅ Added timetable: Day ${staff.availableDay}, ${staff.availableBlock}`);
    } catch (e) {
      console.error(`    ❌ Failed:`, JSON.stringify(e, null, 2));
    }
  }

  // 4. Delete the specific account mentioned in PDF
  console.log('\n🗑️  Deleting Nkarichias account (LAW/M/1178/05/26)...');
  try {
    const { data: users } = await supabaseAdmin.auth.admin.listUsers();
    const nkarichia = users.users.find(u =>
      u.user_metadata?.reg_number === 'LAW/M/1178/05/26' ||
      u.email === 'nkarichia@kabarak.ac.ke'
    );
    if (nkarichia) {
      await supabaseAdmin.auth.admin.deleteUser(nkarichia.id);
      console.log(`    ✅ Deleted: ${nkarichia.id}`);
    } else {
      console.log(`    ℹ️  Account not found`);
    }
  } catch (e) {
    console.error(`    ❌ Failed: ${e}`);
  }

  console.log('\n✨ Seed complete!');
  console.log('\n📋 Summary:');
  console.log(`  - ${students.length} student accounts`);
  console.log(`  - ${adminStaff.length} admin accounts (dean, administrator, IT)`);
  console.log(`  - ${staffMembers.length} lecturer profiles with timetable slots`);
  console.log('\n🔑 Default password for all accounts:', DEFAULT_PASSWORD);
  console.log('   (Users can reset via "Forgot password" on first login)');
}

main().catch(console.error);