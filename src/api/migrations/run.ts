#!/usr/bin/env node
/**
 * Run Migrations
 *
 * Execute SQL migrations on PostgreSQL database
 */

import { Pool } from 'pg';
import { readFileSync } from 'fs';
import { join } from 'path';

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/chamai';

async function runMigrations() {
  console.log('🔄 Running Cham.ai migrations...');

  const pool = new Pool({ connectionString: DATABASE_URL });

  try {
    // Read migration file
    const migrationFile = join(__dirname, '001_initial_schema.sql');
    const sql = readFileSync(migrationFile, 'utf8');

    console.log(`📄 Executing migration: ${migrationFile}`);

    // Execute migration
    await pool.query(sql);

    console.log('✅ Migration completed successfully!');

    // Verify tables
    const result = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `);

    console.log('\n📊 Tables created:');
    result.rows.forEach((row: any) => {
      console.log(`  - ${row.table_name}`);
    });

    console.log('\n🎉 Database ready!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigrations();
