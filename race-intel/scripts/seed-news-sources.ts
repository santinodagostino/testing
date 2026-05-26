/**
 * Seed sources table from data/seed-news-sources.json.
 * Usage: npx tsx scripts/seed-news-sources.ts
 */
import 'dotenv/config'
import { db } from '../db'
import { sources } from '../db/schema'
import sourceData from '../data/seed-news-sources.json'

async function run() {
  console.log(`Seeding ${sourceData.length} news sources...`)
  let done = 0

  for (const s of sourceData as any[]) {
    try {
      await db.insert(sources).values({
        name: s.name,
        type: s.type,
        url: s.url,
        pollingCadenceHours: s.polling_cadence_hours,
        category: s.category,
        state: s.state,
        notes: s.notes,
      }).onConflictDoUpdate({
        target: sources.url as any,
        set: { pollingCadenceHours: s.polling_cadence_hours, notes: s.notes },
      })
      done++
    } catch (err: any) {
      console.error(`Error seeding ${s.name}: ${err.message}`)
    }
  }

  console.log(`Done. Seeded ${done}/${sourceData.length} sources.`)
}

run().catch(console.error)
