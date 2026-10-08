import { config } from 'dotenv';
config({ path: '.env.local' });
config();

import { readFileSync } from 'fs';
import pg from 'pg';

const pool = new pg.Pool({
  connectionString: 'postgresql://postgres:VY3rJ2MPKnMPGY39@db.hhdgddhwocltokcqfauh.supabase.co:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

const sql = readFileSync('combined-migrations.sql', 'utf-8');

async function main() {
  console.log('Applying combined migrations...');

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