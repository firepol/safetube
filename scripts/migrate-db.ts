#!/usr/bin/env tsx
/**
 * Manual database migration script
 * Run with: yarn tsx scripts/migrate-db.ts
 */

import DatabaseService from '../src/main/services/DatabaseService';
import SimpleSchemaManager from '../src/main/database/SimpleSchemaManager';
import path from 'path';

async function migrateDatabase() {
  console.log('🔧 Starting database migration...\n');

  // Initialize database service
  const dbPath = path.join(process.cwd(), 'safetube.db');
  console.log(`Database path: ${dbPath}\n`);

  const dbService = DatabaseService.getInstance();
  await dbService.initialize({ path: dbPath });

  // Check current schema
  console.log('📋 Checking current schema...');
  const tableInfo = await dbService.all<{ name: string; type: string }>(`
    PRAGMA table_info(sources)
  `);

  console.log('\nCurrent sources table columns:');
  tableInfo.forEach(col => console.log(`  - ${col.name}: ${col.type}`));

  // Run migration
  console.log('\n🚀 Running schema migration...');
  const schemaManager = new SimpleSchemaManager(dbService);
  await schemaManager.initializePhase1Schema();

  // Verify new schema
  console.log('\n✅ Verifying updated schema...');
  const newTableInfo = await dbService.all<{ name: string; type: string }>(`
    PRAGMA table_info(sources)
  `);

  console.log('\nUpdated sources table columns:');
  newTableInfo.forEach(col => console.log(`  - ${col.name}: ${col.type}`));

  // Check if migration was successful
  const hasPosition = newTableInfo.some(col => col.name === 'position' && col.type === 'INTEGER');
  const hasSortPreference = newTableInfo.some(col => col.name === 'sort_preference');
  const hasOldSortOrder = newTableInfo.some(col => col.name === 'sort_order');

  if (hasPosition && hasSortPreference && !hasOldSortOrder) {
    console.log('\n✅ Migration successful!');
    console.log('   - Added: position (INTEGER)');
    console.log('   - Added: sort_preference (TEXT)');
    console.log('   - Removed: sort_order (TEXT)');
  } else {
    console.log('\n⚠️  Migration incomplete. Current state:');
    console.log(`   - position: ${hasPosition ? '✅' : '❌'}`);
    console.log(`   - sort_preference: ${hasSortPreference ? '✅' : '❌'}`);
    console.log(`   - sort_order removed: ${!hasOldSortOrder ? '✅' : '❌'}`);
  }

  // Close database
  await dbService.close();
  console.log('\n🏁 Done!\n');
}

// Run migration
migrateDatabase().catch(error => {
  console.error('❌ Migration failed:', error);
  process.exit(1);
});
