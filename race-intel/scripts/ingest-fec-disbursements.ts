/**
 * Ingest Schedule B disbursements for all principal committees.
 * Target: https://api.open.fec.gov/v1/schedules/schedule_b/
 * Last verified: 2026-05-24
 *
 * Usage: npx tsx scripts/ingest-fec-disbursements.ts
 */
import 'dotenv/config'
import { db } from '../db'
import { committees, disbursements } from '../db/schema'
import PQueue from 'p-queue'

const FEC_BASE = 'https://api.open.fec.gov/v1'
const API_KEY = process.env.FEC_API_KEY!
const queue = new PQueue({ concurrency: 2, interval: 1000, intervalCap: 2 })

async function fetchFec(path: string, params: Record<string, string | number> = {}): Promise<any> {
  const url = new URL(`${FEC_BASE}${path}`)
  url.searchParams.set('api_key', API_KEY)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v))
  const res = await fetch(url.toString())
  if (!res.ok) throw new Error(`FEC ${res.status} ${url}`)
  return res.json()
}

async function ingestCommitteeDisbursements(committeeId: string, dbCommitteeId: string) {
  let lastIndex: string | null = null
  let page = 0

  while (true) {
    const params: Record<string, string | number> = {
      committee_id: committeeId,
      two_year_transaction_period: 2026,
      per_page: 100,
      sort: '-disbursement_date',
    }
    if (lastIndex) params['last_index'] = lastIndex

    const data = await queue.add(() => fetchFec('/schedules/schedule_b/', params)) as any
    const results: any[] = data.results ?? []
    if (results.length === 0) break

    await db.insert(disbursements).values(
      results.map((d: any) => ({
        committeeId: dbCommitteeId,
        payeeName: d.recipient_name ?? 'UNKNOWN',
        amount: d.disbursement_amount?.toString() ?? '0',
        date: d.disbursement_date ? new Date(d.disbursement_date) : null,
        purpose: d.disbursement_description,
      }))
    ).onConflictDoNothing()

    page++
    console.log(`  ${committeeId}: page ${page}, ${results.length} rows`)
    if (results.length < 100) break
    lastIndex = data.pagination?.last_indexes?.last_index
    if (!lastIndex) break
  }
}

async function run() {
  if (!API_KEY) throw new Error('FEC_API_KEY not set')

  const allCommittees = await db.query.committees.findMany()
  console.log(`Processing ${allCommittees.length} committees...`)

  for (const comm of allCommittees) {
    try {
      await ingestCommitteeDisbursements(comm.fecId, comm.id)
    } catch (err: any) {
      console.error(`Error for committee ${comm.fecId}: ${err.message}`)
    }
  }

  console.log('Done.')
}

run().catch(console.error)
