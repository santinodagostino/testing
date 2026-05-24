/**
 * Ingest current Senators + Representatives from Congress.gov API.
 * Target: https://api.congress.gov/v3/member
 * Last verified: 2026-05-24
 *
 * Usage: npx tsx scripts/ingest-congress-members.ts
 */
import 'dotenv/config'
import { db } from '../db'
import { candidates, races } from '../db/schema'
import { eq, and } from 'drizzle-orm'
import PQueue from 'p-queue'

const BASE = 'https://api.congress.gov/v3'
const API_KEY = process.env.CONGRESS_API_KEY!
const queue = new PQueue({ concurrency: 2, interval: 1000, intervalCap: 2 })

async function fetchPage(path: string, params: Record<string, string | number> = {}): Promise<any> {
  const url = new URL(`${BASE}${path}`)
  url.searchParams.set('api_key', API_KEY)
  url.searchParams.set('format', 'json')
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v))
  const res = await fetch(url.toString())
  if (!res.ok) throw new Error(`Congress API ${res.status}: ${url}`)
  return res.json()
}

async function run() {
  if (!API_KEY) throw new Error('CONGRESS_API_KEY not set')

  let offset = 0
  const limit = 250
  let total = Infinity
  let ingested = 0

  while (ingested < total) {
    const data = await queue.add(() =>
      fetchPage('/member', { limit, offset, currentMember: 'true' })
    ) as any

    total = data.pagination?.count ?? 0
    const members: any[] = data.members ?? []
    if (members.length === 0) break

    for (const m of members) {
      const chamber = m.terms?.item?.[0]?.chamber ?? m.chamber
      const office = chamber?.includes('Senate') ? 'senate' : 'house'
      const state = m.state
      if (!state) continue

      const district = office === 'house' ? m.district?.toString() : undefined

      // Find or create the 2026 race
      let raceId: string | undefined
      const existingRace = await db.query.races.findFirst({
        where: and(
          eq(races.cycle, 2026),
          eq(races.office, office),
          eq(races.state, state),
          district ? eq(races.district, district) : undefined as any,
        ),
      })

      if (existingRace) {
        raceId = existingRace.id
      } else {
        const [newRace] = await db.insert(races).values({
          cycle: 2026, office, state, district,
        }).returning({ id: races.id })
        raceId = newRace.id
      }

      // Upsert candidate as incumbent
      await db.insert(candidates).values({
        fullName: m.name,
        party: m.partyName === 'Republican' ? 'R' : m.partyName === 'Democrat' ? 'D' : m.partyName,
        state,
        office,
        district,
        raceId,
        status: 'incumbent',
        bioguideId: m.bioguideId,
        source: 'fec',
      }).onConflictDoUpdate({
        target: candidates.bioguideId,
        set: { status: 'incumbent', raceId, updatedAt: new Date() },
      }).catch(() => {})
    }

    ingested += members.length
    console.log(`Ingested ${ingested}/${total} members`)
    offset += limit
    if (members.length < limit) break
  }

  console.log('Done.')
}

run().catch(console.error)
