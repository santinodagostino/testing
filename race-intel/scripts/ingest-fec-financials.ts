/**
 * Ingest FEC financial totals using bulk endpoints (far fewer API calls).
 * - /committees/?cycle=2026            → all committees (~25 pages)
 * - /candidates/totals/?cycle=2026     → all totals (~25 pages)
 *
 * Usage: npx tsx scripts/ingest-fec-financials.ts
 */
import 'dotenv/config'
import { db } from '../db'
import { candidates, committees, financials } from '../db/schema'
import { inArray } from 'drizzle-orm'
import PQueue from 'p-queue'

const FEC_BASE = 'https://api.open.fec.gov/v1'
const API_KEY = process.env.FEC_API_KEY!

// Stay safely under 1,000 req/hour: 1 req/5s = 720/hour
const queue = new PQueue({ concurrency: 1, interval: 5000, intervalCap: 1 })

async function fetchPage(path: string, params: Record<string, string | number>, retries = 8): Promise<any> {
  const url = new URL(`${FEC_BASE}${path}`)
  url.searchParams.set('api_key', API_KEY)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v))

  for (let attempt = 0; attempt <= retries; attempt++) {
    const res = await fetch(url.toString())
    if (res.status === 429 || res.status === 403) {
      // Wait 10 min on rate limit — FEC limit resets hourly
      const wait = 10 * 60 * 1000
      console.log(`Rate limited (${res.status}) attempt ${attempt + 1}/${retries + 1}, waiting 10 min...`)
      await new Promise(r => setTimeout(r, wait))
      continue
    }
    if (!res.ok) throw new Error(`FEC ${res.status} ${url}`)
    const data = await res.json()
    if (data?.error?.code === 'OVER_RATE_LIMIT') {
      const wait = 10 * 60 * 1000
      console.log(`OVER_RATE_LIMIT attempt ${attempt + 1}/${retries + 1}, waiting 10 min...`)
      await new Promise(r => setTimeout(r, wait))
      continue
    }
    return data
  }
  throw new Error(`FEC rate limit persists after ${retries} retries`)
}

async function fetchAllPages(path: string, extraParams: Record<string, string | number> = {}): Promise<any[]> {
  let page = 1
  let total = Infinity
  const results: any[] = []

  while (results.length < total) {
    const data = await queue.add(() =>
      fetchPage(path, { per_page: 100, page, ...extraParams })
    ) as any
    total = data.pagination?.count ?? 0
    const batch = data.results ?? []
    results.push(...batch)
    console.log(`  ${path} page ${page}: ${results.length}/${total}`)
    page++
    if (batch.length < 100) break
  }
  return results
}

async function run() {
  if (!API_KEY) throw new Error('FEC_API_KEY not set')

  // Fetch all known FEC IDs from our candidates table
  const allCandidates = await db.select({
    id: candidates.id,
    fecId: candidates.fecId,
  }).from(candidates)

  const fecIdToDbId = new Map(allCandidates.map(c => [c.fecId!, c.id]))
  console.log(`Loaded ${fecIdToDbId.size} candidates from DB`)

  // --- Step 1: Bulk-fetch principal committees for 2026 cycle ---
  console.log('\nFetching principal committees...')
  // designation=P: principal committees only; no committee_type filter needed
  const allComms = await fetchAllPages('/committees/', {
    cycle: 2026,
    designation: 'P',
  })
  console.log(`Fetched ${allComms.length} principal committees`)

  // Upsert committees that match our candidates
  let commUpserted = 0
  for (const c of allComms) {
    const candidateIds: string[] = c.candidate_ids ?? []
    const matchedDbId = candidateIds.map(id => fecIdToDbId.get(id)).find(Boolean)
    if (!matchedDbId) continue

    await db.insert(committees).values({
      fecId: c.committee_id,
      candidateId: matchedDbId,
      committeeType: c.committee_type,
      treasurerName: c.treasurer_name,
      address: [c.street_1, c.city, c.state, c.zip].filter(Boolean).join(', '),
    }).onConflictDoUpdate({
      target: committees.fecId,
      set: { candidateId: matchedDbId, updatedAt: new Date() },
    })
    commUpserted++
  }
  console.log(`Upserted ${commUpserted} committees`)

  // --- Step 2: Bulk-fetch candidate totals for 2026 cycle ---
  console.log('\nFetching candidate totals...')
  const allTotals = await fetchAllPages('/candidates/totals/', {
    cycle: 2026,
    election_full: 'false',
  })
  console.log(`Fetched ${allTotals.length} totals`)

  // Load committees we just upserted
  const dbComms = await db.select().from(committees)
  const fecCommIdToComm = new Map(dbComms.map(c => [c.fecId, c]))

  let finUpserted = 0
  for (const t of allTotals) {
    const comm = fecCommIdToComm.get(t.committee_id)
    if (!comm) continue

    const burnRate = t.receipts > 0 ? t.disbursements / t.receipts : null

    await db.insert(financials).values({
      committeeId: comm.id,
      cashOnHand: t.cash_on_hand_end_period?.toString(),
      totalReceipts: t.receipts?.toString(),
      totalDisbursements: t.disbursements?.toString(),
      burnRate: burnRate?.toFixed(4),
      debt: t.debts_owed_by_committee?.toString(),
    }).onConflictDoNothing()
    finUpserted++
  }
  console.log(`\nInserted ${finUpserted} financial records`)
  console.log('Done.')
}

run().catch(console.error)
