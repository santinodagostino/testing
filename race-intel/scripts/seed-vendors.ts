/**
 * Seed known_vendors table from data/seed-known-vendors.json.
 * Usage: npx tsx scripts/seed-vendors.ts
 */
import 'dotenv/config'
import { db } from '../db'
import { knownVendors } from '../db/schema'
import vendorData from '../data/seed-known-vendors.json'

const PLATFORM_PROCESSORS = new Set(['WinRed', 'Anedot'])

async function run() {
  console.log(`Seeding ${vendorData.length} vendors...`)
  let done = 0

  for (const v of vendorData as any[]) {
    const primaryCategory = v.categories[0]
    const isPlatform = PLATFORM_PROCESSORS.has(v.canonical_name)

    try {
      await db.insert(knownVendors).values({
        canonicalName: v.canonical_name,
        aliases: v.aliases,
        category: isPlatform ? 'platform_processor' : primaryCategory,
        side: v.side ?? 'unknown',
        isPlatformProcessor: isPlatform,
        notes: v.notes,
      }).onConflictDoUpdate({
        target: knownVendors.canonicalName,
        set: {
          aliases: v.aliases,
          notes: v.notes,
        },
      })
      done++
    } catch (err: any) {
      console.error(`Error seeding ${v.canonical_name}: ${err.message}`)
    }
  }

  console.log(`Done. Seeded ${done}/${vendorData.length} vendors.`)
}

run().catch(console.error)
