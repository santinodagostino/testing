/**
 * Seed 2026 primary and general election dates for federal races.
 * General election: November 3, 2026 (all states)
 * Primary dates vary by state.
 *
 * Usage: npx tsx scripts/seed-race-dates.ts
 */
import 'dotenv/config'
import { db } from '../db'
import { races } from '../db/schema'
import { eq, and, isNull } from 'drizzle-orm'

const GENERAL_DATE = new Date('2026-11-03T12:00:00Z')

// Primary dates by state (2026)
const STATE_PRIMARIES: Record<string, string> = {
  IL: '2026-03-17',
  TX: '2026-03-03',
  OH: '2026-05-05',
  IN: '2026-05-05',
  NC: '2026-05-05',
  WV: '2026-05-12',
  OR: '2026-05-19',
  AR: '2026-05-19',
  KY: '2026-05-19',
  ID: '2026-05-19',
  PA: '2026-05-19',
  GA: '2026-05-19',
  AL: '2026-05-19',
  CA: '2026-06-02',
  NJ: '2026-06-02',
  IA: '2026-06-02',
  NM: '2026-06-02',
  MT: '2026-06-02',
  SD: '2026-06-02',
  ND: '2026-06-02',
  MS: '2026-06-02',
  VA: '2026-06-09',
  SC: '2026-06-09',
  ME: '2026-06-09',
  NV: '2026-06-09',
  ND2: '2026-06-09',
  MI: '2026-08-04',
  KS: '2026-08-04',
  MO: '2026-08-04',
  AZ: '2026-08-04',
  MN: '2026-08-11',
  WI: '2026-08-11',
  CT: '2026-08-11',
  VT: '2026-08-11',
  CO: '2026-06-23',
  OK: '2026-06-23',
  UT: '2026-06-23',
  NH: '2026-09-08',
  MA: '2026-09-08',
  NY: '2026-09-08',
  RI: '2026-09-08',
  DE: '2026-09-08',
  MD: '2026-09-08',
  WA: '2026-08-04',
  FL: '2026-08-18',
  HI: '2026-08-08',
  AK: '2026-08-18',
  LA: '2026-11-03',
  WY: '2026-08-18',
  NE: '2026-05-12',
  TN: '2026-08-06',
  IA2: '2026-06-02',
}

async function run() {
  const allRaces = await db.select().from(races).where(eq(races.cycle, 2026))
  console.log(`Setting dates for ${allRaces.length} races...`)
  let updated = 0

  for (const race of allRaces) {
    const primaryStr = STATE_PRIMARIES[race.state]
    if (!primaryStr) continue

    const primaryDate = new Date(primaryStr + 'T12:00:00Z')

    await db.update(races)
      .set({
        generalDate: GENERAL_DATE,
        primaryDate,
      })
      .where(eq(races.id, race.id))
    updated++
  }

  console.log(`Updated ${updated} races with primary + general dates.`)
}

run().catch(console.error)
