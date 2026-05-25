/**
 * Ingest Schedule B disbursements for all principal committees.
 * Target: https://api.open.fec.gov/v1/schedules/schedule_b/
 * Last verified: 2026-05-24
 *
 * Fetches bulk disbursements for 2026 across all our committees.
 * Uses cursor-based pagination and stays under 1,000 req/hour FEC limit.
 *
 * Usage: npx tsx scripts/ingest-fec-disbursements.ts
 */
import 'dotenv/config'
import { db } from '../db'
import { committees, disbursements, knownVendors, candidateVendors } from '../db/schema'
import { eq, sql } from 'drizzle-orm'
import PQueue from 'p-queue'

const FEC_BASE = 'https://api.open.fec.gov/v1'
const API_KEY = process.env.FEC_API_KEY!

// 1 req/5s = 720/hour, safely under 1000/hour
const queue = new PQueue({ concurrency: 1, interval: 5000, intervalCap: 1 })

async function fetchFec(path: string, params: Record<string, string | number> = {}, retries = 8): Promise<any> {
  const url = new URL(`${FEC_BASE}${path}`)
  url.searchParams.set('api_key', API_KEY)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v))

  for (let attempt = 0; attempt <= retries; attempt++) {
    const res = await fetch(url.toString())
    if (res.status === 429 || res.status === 403) {
      const wait = 10 * 60 * 1000
      console.log(`Rate limited (${res.status}) attempt ${attempt + 1}, waiting 10 min...`)
      await new Promise(r => setTimeout(r, wait))
      continue
    }
    if (!res.ok) throw new Error(`FEC ${res.status} ${url}`)
    const data = await res.json()
    if (data?.error?.code === 'OVER_RATE_LIMIT') {
      console.log(`OVER_RATE_LIMIT attempt ${attempt + 1}, waiting 10 min...`)
      await new Promise(r => setTimeout(r, 10 * 60 * 1000))
      continue
    }
    return data
  }
  throw new Error(`Rate limit persists after ${retries} retries`)
}

// Normalize payee names for vendor matching
function normalizeName(name: string): string {
  return name.toUpperCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, ' ').replace(/\s+/g, ' ').trim()
}

async function run() {
  if (!API_KEY) throw new Error('FEC_API_KEY not set')

  const allCommittees = await db.select().from(committees)
  if (allCommittees.length === 0) {
    console.log('No committees found. Run ingest:financials first.')
    return
  }
  console.log(`Processing ${allCommittees.length} committees...`)

  const committeeIds = allCommittees.map(c => c.fecId)
  const commMap = new Map(allCommittees.map(c => [c.fecId, c.id]))
  let totalInserted = 0
  let pageGlobal = 0

  // 2,325 IDs in one URL causes HTTP 431; batch to stay under limit
  const BATCH_SIZE = 50
  for (let batchStart = 0; batchStart < committeeIds.length; batchStart += BATCH_SIZE) {
    const batchIds = committeeIds.slice(batchStart, batchStart + BATCH_SIZE)
    let lastIndex: string | null = null
    let lastDisbursementDate: string | null = null
    const batchNum = Math.floor(batchStart / BATCH_SIZE) + 1
    const totalBatches = Math.ceil(committeeIds.length / BATCH_SIZE)
    console.log(`Batch ${batchNum}/${totalBatches} (${batchIds.length} committees)`)

    while (true) {
      const urlParams = new URLSearchParams()
      urlParams.set('api_key', API_KEY)
      urlParams.set('two_year_transaction_period', '2026')
      urlParams.set('per_page', '100')
      urlParams.set('sort', '-disbursement_date')
      for (const id of batchIds) urlParams.append('committee_id[]', id)
      if (lastIndex) urlParams.set('last_index', lastIndex)
      if (lastDisbursementDate) urlParams.set('last_disbursement_date', lastDisbursementDate)

      const url = new URL(`${FEC_BASE}/schedules/schedule_b/`)
      url.search = urlParams.toString()

      const data = await queue.add(async () => {
        for (let attempt = 0; attempt <= 8; attempt++) {
          try {
            const res = await fetch(url.toString())
            if (res.status === 429 || res.status === 403) {
              console.log(`Rate limited attempt ${attempt + 1}, waiting 10 min...`)
              await new Promise(r => setTimeout(r, 10 * 60 * 1000))
              continue
            }
            if (!res.ok) throw new Error(`FEC ${res.status}`)
            const d = await res.json()
            if (d?.error?.code === 'OVER_RATE_LIMIT') {
              console.log(`OVER_RATE_LIMIT attempt ${attempt + 1}, waiting 10 min...`)
              await new Promise(r => setTimeout(r, 10 * 60 * 1000))
              continue
            }
            return d
          } catch (err: any) {
            if (err.message?.startsWith('FEC ')) throw err
            const wait = Math.min(5000 * 2 ** attempt, 60000)
            console.log(`Network error attempt ${attempt + 1}: ${err.message}, retrying in ${wait / 1000}s...`)
            await new Promise(r => setTimeout(r, wait))
          }
        }
        throw new Error('Rate limit persists')
      }) as any

      const results: any[] = data.results ?? []
      if (results.length === 0) break

      const rows = results
        .map((d: any) => {
          const dbCommId = commMap.get(d.committee_id)
          if (!dbCommId) return null
          return {
            committeeId: dbCommId,
            payeeName: d.recipient_name ?? 'UNKNOWN',
            amount: d.disbursement_amount?.toString() ?? '0',
            date: d.disbursement_date ? new Date(d.disbursement_date) : null,
            purpose: d.disbursement_description,
          }
        })
        .filter(Boolean) as any[]

      if (rows.length > 0) {
        await db.insert(disbursements).values(rows).onConflictDoNothing()
        totalInserted += rows.length
      }

      pageGlobal++
      if (pageGlobal % 10 === 0) {
        console.log(`  Page ${pageGlobal}: +${rows.length} (total: ${totalInserted})`)
      }

      if (results.length < 100) break
      lastIndex = data.pagination?.last_indexes?.last_index
      lastDisbursementDate = data.pagination?.last_indexes?.last_disbursement_date
      if (!lastIndex) break
    }
  }

  console.log(`\nTotal disbursements inserted: ${totalInserted}`)

  // --- Vendor matching ---
  console.log('\nMatching vendors...')
  const vendors = await db.select().from(knownVendors)
  const allDisbursements = await db.select().from(disbursements)

  let matched = 0
  for (const v of vendors) {
    const names = [v.canonicalName, ...(v.aliases ?? [])].map(normalizeName)
    const matches = allDisbursements.filter(d =>
      names.includes(normalizeName(d.payeeName))
    )
    if (matches.length === 0) continue

    for (const d of matches) {
      await db.update(disbursements)
        .set({ vendorId: v.id, category: v.category })
        .where(eq(disbursements.id, d.id))
    }
    matched += matches.length
  }
  console.log(`Matched ${matched} disbursements to known vendors`)

  // --- Populate candidateVendors from matched disbursements ---
  console.log('\nAggregating candidate vendors...')
  const commToCand = new Map(allCommittees.map(c => [c.id, c.candidateId]))

  const matchedDisbs = await db.select().from(disbursements)
    .where(sql`${disbursements.vendorId} IS NOT NULL`)

  // Group by (candidateId, vendorId)
  type Key = string
  const agg = new Map<Key, { candidateId: string; vendorId: string; category: string; total: number; first: Date | null; last: Date | null }>()

  for (const d of matchedDisbs) {
    const candidateId = commToCand.get(d.committeeId ?? '')
    if (!candidateId || !d.vendorId || !d.category) continue
    const key = `${candidateId}::${d.vendorId}`
    if (!agg.has(key)) {
      agg.set(key, { candidateId, vendorId: d.vendorId, category: d.category, total: 0, first: null, last: null })
    }
    const row = agg.get(key)!
    row.total += parseFloat(d.amount)
    const dt = d.date
    if (dt) {
      if (!row.first || dt < row.first) row.first = dt
      if (!row.last || dt > row.last) row.last = dt
    }
  }

  let cvInserted = 0
  for (const row of Array.from(agg.values())) {
    await db.insert(candidateVendors).values({
      candidateId: row.candidateId,
      vendorId: row.vendorId,
      category: row.category as typeof candidateVendors.$inferInsert['category'],
      totalSpentCycle: row.total.toFixed(2),
      firstPayment: row.first,
      lastPayment: row.last,
    }).onConflictDoNothing()
    cvInserted++
  }
  console.log(`Inserted/updated ${cvInserted} candidate-vendor relationships`)
  console.log('Done.')
}

run().catch(console.error)
