import { config } from 'dotenv';
config({ path: '.env.local' });
config();

import { readFileSync } from 'fs';
import pg from 'pg';

const pool = new pg.Pool({
  connectionString: 'postgresql://postgres:VY3rJ2MPKnMPGY39@db.hhdgddhwocltokcqfauh.supabase.co:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

const sql = readFileSync('supabase/migrations/20261008000000_notifications.sql', 'utf-8');

async function main() {
  console.log('Applying notifications migration...');

  try {
    await pool.query(sql);
    console.log('Migrations applied successfully!');
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    await pool.end();
  }
}

main().catch(e => console.error(e));