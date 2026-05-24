/**
 * Ingest 2026 federal candidates from FEC API.
 * Target: https://api.open.fec.gov/v1/candidates/search?cycle=2026&candidate_status=C
 * Last verified: 2026-05-24
 *
 * Usage: npx tsx scripts/ingest-fec-candidates.ts
 */
import 'dotenv/config'
import { db } from '../db'
import { candidates, races } from '../db/schema'
import { eq, and } from 'drizzle-orm'
import PQueue from 'p-queue'

const FEC_BASE = 'https://api.open.fec.gov/v1'
const API_KEY = process.env.FEC_API_KEY!
const CYCLE = 2026

const queue = new PQueue({ concurrency: 2, interval: 1000, intervalCap: 2 })

async function fetchFecPage(path: string, params: Record<string, string | number>): Promise<any> {
  const url = new URL(`${FEC_BASE}${path}`)
  url.searchParams.set('api_key', API_KEY)
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, String(v))
  }
  const res = await fetch(url.toString())
  if (!res.ok) throw new Error(`FEC API error ${res.status}: ${url}`)
  return res.json()
}

async function upsertRace(office: 'senate' | 'house' | 'governor', state: string, district?: string) {
  const existing = await db.query.races.findFirst({
    where: and(
      eq(races.cycle, CYCLE),
      eq(races.office, office),
      eq(races.state, state),
      district ? eq(races.district, district) : undefined as any,
    ),
  })
  if (existing) return existing.id

  const [row] = await db.insert(races).values({
    cycle: CYCLE,
    office,
    state,
    district,
  }).returning({ id: races.id })
  return row.id
}

async function run() {
  if (!API_KEY) throw new Error('FEC_API_KEY not set')

  let page = 1
  let total = Infinity
  let ingested = 0

  while (ingested < total) {
    const data = await queue.add(() =>
      fetchFecPage('/candidates/search', {
        cycle: CYCLE,
        candidate_status: 'C',
        per_page: 100,
        page,
      })
    ) as any

    total = data.pagination.count
    const results: any[] = data.results ?? []
    if (results.length === 0) break

    for (const c of results) {
      const office = c.office === 'S' ? 'senate' : c.office === 'H' ? 'house' : null
      if (!office) continue

      const state = c.state ?? c.election_districts?.[0]
      if (!state) continue

      const district = office === 'house' ? (c.district ?? c.election_districts?.[0]) : undefined
      const raceId = await upsertRace(office, state, district)

      await db.insert(candidates).values({
        fecId: c.candidate_id,
        fullName: c.name,
        party: c.party,
        state,
        office,
        district,
        raceId,
        status: 'declared',
        source: 'fec',
      }).onConflictDoUpdate({
        target: candidates.fecId,
        set: {
          fullName: c.name,
          party: c.party,
          updatedAt: new Date(),
        },
      }).catch(() => {})
    }

    ingested += results.length
    console.log(`Ingested ${ingested}/${total} candidates (page ${page})`)
    page++
    if (results.length < 100) break
  }

  console.log('Done. Total ingested:', ingested)
}

run().catch(console.error)
