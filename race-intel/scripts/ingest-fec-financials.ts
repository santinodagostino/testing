/**
 * Ingest FEC financial totals for all 2026 principal committees.
 * Target: https://api.open.fec.gov/v1/candidate/{id}/totals/?cycle=2026
 * Last verified: 2026-05-24
 *
 * Usage: npx tsx scripts/ingest-fec-financials.ts
 */
import 'dotenv/config'
import { db } from '../db'
import { candidates, committees, financials } from '../db/schema'
import { isNotNull } from 'drizzle-orm'
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

async function run() {
  if (!API_KEY) throw new Error('FEC_API_KEY not set')

  const allCandidates = await db.query.candidates.findMany({
    where: isNotNull(candidates.fecId),
  })

  console.log(`Processing ${allCandidates.length} candidates...`)
  let done = 0

  for (const cand of allCandidates) {
    await queue.add(async () => {
      try {
        // Get committees for this candidate
        const commData = await fetchFec(`/candidate/${cand.fecId}/committees/`, { cycle: 2026 })
        const principalComm = (commData.results ?? []).find((c: any) => c.designation === 'P')
        if (!principalComm) return

        // Upsert committee
        const [comm] = await db.insert(committees).values({
          fecId: principalComm.committee_id,
          candidateId: cand.id,
          committeeType: principalComm.committee_type,
          treasurerName: principalComm.treasurer_name,
          address: [
            principalComm.street_1,
            principalComm.city,
            principalComm.state,
            principalComm.zip,
          ].filter(Boolean).join(', '),
        }).onConflictDoUpdate({
          target: committees.fecId as any,
          set: { candidateId: cand.id, updatedAt: new Date() },
        }).returning()

        // Get totals
        const totalsData = await fetchFec(`/candidate/${cand.fecId}/totals/`, { cycle: 2026 })
        const totals = totalsData.results?.[0]
        if (!totals) return

        const burnRate = totals.total_receipts > 0
          ? totals.total_disbursements / totals.total_receipts
          : null

        await db.insert(financials).values({
          committeeId: comm.id,
          cashOnHand: totals.cash_on_hand_end_period?.toString(),
          totalReceipts: totals.receipts?.toString(),
          totalDisbursements: totals.disbursements?.toString(),
          burnRate: burnRate?.toFixed(4),
          debt: totals.debts_owed_by_committee?.toString(),
        })
      } catch (err: any) {
        console.error(`Error for ${cand.fecId}: ${err.message}`)
      }
    })

    done++
    if (done % 50 === 0) console.log(`${done}/${allCandidates.length}`)
  }

  await queue.onIdle()
  console.log('Done.')
}

run().catch(console.error)
