/**
 * Ingest Schedule B disbursements for our known vendors.
 * Target: https://api.open.fec.gov/v1/schedules/schedule_b/
 *
 * Queries by recipient_name for each of our 73 known vendors — far fewer
 * API calls than querying 2,325 committees individually.
 *
 * Usage: npx tsx scripts/ingest-fec-disbursements.ts
 */
import 'dotenv/config'
import { db } from '../db'
import { committees, disbursements, knownVendors, candidateVendors } from '../db/schema'
import { sql } from 'drizzle-orm'
import PQueue from 'p-queue'

const FEC_BASE = 'https://api.open.fec.gov/v1'
const API_KEY = process.env.FEC_API_KEY!

// 1 req/5s = 720/hour, safely under 1000/hour
const queue = new PQueue({ concurrency: 1, interval: 5000, intervalCap: 1 })

async function fetchPage(params: URLSearchParams, retries = 8): Promise<any> {
  const url = new URL(`${FEC_BASE}/schedules/schedule_b/`)
  params.set('api_key', API_KEY)
  url.search = params.toString()

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url.toString())
      if (res.status === 429 || res.status === 403) {
        console.log(`Rate limited (${res.status}) attempt ${attempt + 1}, waiting 10 min...`)
        await new Promise(r => setTimeout(r, 10 * 60 * 1000))
        continue
      }
      if (!res.ok) throw new Error(`FEC ${res.status}`)
      const data = await res.json()
      if (data?.error?.code === 'OVER_RATE_LIMIT') {
        console.log(`OVER_RATE_LIMIT attempt ${attempt + 1}, waiting 10 min...`)
        await new Promise(r => setTimeout(r, 10 * 60 * 1000))
        continue
      }
      return data
    } catch (err: any) {
      if (err.message?.startsWith('FEC ')) throw err
      const wait = Math.min(5000 * 2 ** attempt, 60000)
      console.log(`Network error attempt ${attempt + 1}: ${err.message}, retrying in ${wait / 1000}s...`)
      await new Promise(r => setTimeout(r, wait))
    }
  }
  throw new Error(`FEC request failed after ${retries} retries`)
}

async function run() {
  if (!API_KEY) throw new Error('FEC_API_KEY not set')

  const allCommittees = await db.select().from(committees)
  if (allCommittees.length === 0) {
    console.log('No committees found. Run ingest:financials first.')
    return
  }
  // fecId → db committee row
  const commByFecId = new Map(allCommittees.map(c => [c.fecId, c]))

  const vendors = await db.select().from(knownVendors)
  console.log(`Querying disbursements for ${vendors.length} vendors across ${allCommittees.length} committees...`)

  let totalInserted = 0
  let vendorsDone = 0

  for (const vendor of vendors) {
    const names = [vendor.canonicalName, ...(vendor.aliases ?? [])]
    vendorsDone++

    for (const name of names) {
      let lastIndex: string | null = null
      let lastDisbursementDate: string | null = null
      let vendorPages = 0

      while (true) {
        const params = new URLSearchParams()
        params.set('two_year_transaction_period', '2026')
        params.set('per_page', '100')
        params.set('sort', '-disbursement_date')
        params.set('recipient_name', name)
        if (lastIndex) params.set('last_index', lastIndex)
        if (lastDisbursementDate) params.set('last_disbursement_date', lastDisbursementDate)

        const data = await queue.add(() => fetchPage(params)) as any
        const results: any[] = data.results ?? []
        if (results.length === 0) break

        const rows = results
          .map((d: any) => {
            const comm = commByFecId.get(d.committee_id)
            if (!comm) return null
            return {
              committeeId: comm.id,
              payeeName: d.recipient_name ?? name,
              amount: d.disbursement_amount?.toString() ?? '0',
              date: d.disbursement_date ? new Date(d.disbursement_date) : null,
              purpose: d.disbursement_description,
              vendorId: vendor.id,
              category: vendor.category,
            }
          })
          .filter(Boolean) as any[]

        if (rows.length > 0) {
          await db.insert(disbursements).values(rows).onConflictDoNothing()
          totalInserted += rows.length
        }

        vendorPages++
        if (results.length < 100) break
        lastIndex = data.pagination?.last_indexes?.last_index
        lastDisbursementDate = data.pagination?.last_indexes?.last_disbursement_date
        if (!lastIndex) break
      }

      if (vendorPages > 0) {
        console.log(`  ${name}: ${vendorPages} pages`)
      }
    }
    console.log(`[${vendorsDone}/${vendors.length}] ${vendor.canonicalName} — total so far: ${totalInserted}`)
  }

  console.log(`\nTotal disbursements inserted: ${totalInserted}`)

  // --- Populate candidateVendors from matched disbursements ---
  console.log('\nAggregating candidate vendors...')
  const commToCand = new Map(allCommittees.map(c => [c.id, c.candidateId]))

  const matchedDisbs = await db.select().from(disbursements)
    .where(sql`${disbursements.vendorId} IS NOT NULL`)

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
  console.log(`Inserted ${cvInserted} candidate-vendor relationships`)
  console.log('Done.')
}

run().catch(console.error)
