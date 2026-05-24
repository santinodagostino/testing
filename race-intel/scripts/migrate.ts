/**
 * Apply pending Drizzle migrations to Neon.
 * Usage: npx tsx scripts/migrate.ts
 */
import 'dotenv/config'
import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import { migrate } from 'drizzle-orm/neon-http/migrator'
import * as schema from '../db/schema'

async function run() {
  const sql = neon(process.env.DATABASE_URL!)
  const db = drizzle(sql, { schema })

  console.log('Running migrations...')
  await migrate(db, { migrationsFolder: './db/migrations' })
  console.log('Migrations complete.')
}

run().catch(console.error)
