#!/usr/bin/env tsx
/**
 * Combine all Supabase migrations into a single SQL file for manual execution
 * Run with: npx tsx scripts/apply-migrations.ts
 * Then copy the output to Supabase Dashboard → SQL Editor and run it
 */

import { config } from 'dotenv';
config({ path: '.env.local' });
config();

import { readFileSync, readdirSync, writeFileSync } from 'fs';
import { join } from 'path';

async function main() {
  console.log('📦 Combining all Supabase migrations...\n');

  const migrationsDir = join(process.cwd(), 'supabase', 'migrations');
  const files = readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort(); // Apply in order

  let combinedSql = '-- ===========================================\n';
  combinedSql += '-- COMBINED SUPABASE MIGRATIONS FOR KABUS-APPOINT-WISE\n';
  combinedSql += `-- Generated: ${new Date().toISOString()}\n`;
  combinedSql += '-- ===========================================\n\n';

  for (const file of files) {
    const filePath = join(migrationsDir, file);
    const sql = readFileSync(filePath, 'utf-8');
    combinedSql += `-- ===========================================\n`;
    combinedSql += `-- MIGRATION: ${file}\n`;
    combinedSql += `-- ===========================================\n\n`;
    combinedSql += sql;
    combinedSql += '\n\n';
  }

  const outputPath = join(process.cwd(), 'combined-migrations.sql');
  writeFileSync(outputPath, combinedSql);

  console.log(`✅ Combined SQL written to: ${outputPath}`);
  console.log('\n📋 Next steps:');
  console.log('1. Open Supabase Dashboard: https://supabase.com/dashboard/project/hhdgddhwocltokcqfauh');
  console.log('2. Go to SQL Editor');
  console.log('3. Copy the contents of combined-migrations.sql');
  console.log('4. Paste and click "Run"');
  console.log('\n⚠️  This will create all tables, functions, triggers, and policies needed for the app.');
}

main().catch(console.error);