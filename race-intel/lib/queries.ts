import { db } from '@/db'
import {
  races,
  candidates,
  committees,
  financials as financialsTable,
  raceRatings,
  candidateVendors,
  knownVendors,
  consideringCandidates,
} from '@/db/schema'
import { eq, inArray, desc, and } from 'drizzle-orm'

// ─── Races List ────────────────────────────────────────────────────────────────

export type RaceSummary = {
  id: string
  office: string
  state: string
  district: string | null
  seatClass: string | null
  isOpenSeat: boolean
  primaryDate: string | null
  generalDate: string | null
  totalCandidates: number
  rCount: number
  dCount: number
  cookRating: string | null
  sabatoRating: string | null
  insideRating: string | null
  topRCash: number | null
  topDCash: number | null
}

export async function getRacesSummary(cycle = 2026): Promise<RaceSummary[]> {
  try {
  const raceList = await db
    .select()
    .from(races)
    .where(eq(races.cycle, cycle))
    .orderBy(races.state, races.office, races.district)

  if (!raceList.length) return []

  const raceIds = raceList.map(r => r.id)

  const [candidateList, ratingList] = await Promise.all([
    db
      .select({
        id: candidates.id,
        raceId: candidates.raceId,
        party: candidates.party,
        status: candidates.status,
      })
      .from(candidates)
      .where(inArray(candidates.raceId, raceIds)),

    db
      .select({
        raceId: raceRatings.raceId,
        rater: raceRatings.rater,
        rating: raceRatings.rating,
        capturedAt: raceRatings.capturedAt,
      })
      .from(raceRatings)
      .where(inArray(raceRatings.raceId, raceIds))
      .orderBy(desc(raceRatings.capturedAt)),
  ])

  const candidateIds = candidateList.map(c => c.id)
  const cashByCandidate: Record<string, number> = {}

  if (candidateIds.length > 0) {
    const committeeList = await db
      .select({ id: committees.id, candidateId: committees.candidateId })
      .from(committees)
      .where(inArray(committees.candidateId, candidateIds))

    if (committeeList.length > 0) {
      const committeeIds = committeeList.map(c => c.id)
      const financialList = await db
        .select({
          committeeId: financialsTable.committeeId,
          cashOnHand: financialsTable.cashOnHand,
          reportPeriodEnd: financialsTable.reportPeriodEnd,
        })
        .from(financialsTable)
        .where(inArray(financialsTable.committeeId, committeeIds))
        .orderBy(desc(financialsTable.reportPeriodEnd))

      const seenCommittees = new Set<string>()
      for (const f of financialList) {
        if (f.committeeId && !seenCommittees.has(f.committeeId)) {
          seenCommittees.add(f.committeeId)
          const comm = committeeList.find(c => c.id === f.committeeId)
          if (comm?.candidateId && f.cashOnHand) {
            cashByCandidate[comm.candidateId] = parseFloat(f.cashOnHand)
          }
        }
      }
    }
  }

  return raceList.map(race => {
    const raceCands = candidateList.filter(c => c.raceId === race.id)
    const rCands = raceCands.filter(c => c.party === 'R')
    const dCands = raceCands.filter(c => c.party === 'D')

    const latestRatings: Record<string, string> = {}
    const seen = new Set<string>()
    for (const r of ratingList) {
      if (r.raceId === race.id && r.rater && !seen.has(r.rater)) {
        latestRatings[r.rater] = r.rating
        seen.add(r.rater)
      }
    }

    const topRCash =
      rCands.length > 0
        ? Math.max(...rCands.map(c => cashByCandidate[c.id] ?? 0)) || null
        : null
    const topDCash =
      dCands.length > 0
        ? Math.max(...dCands.map(c => cashByCandidate[c.id] ?? 0)) || null
        : null

    return {
      id: race.id,
      office: race.office,
      state: race.state,
      district: race.district,
      seatClass: race.seatClass,
      isOpenSeat: race.isOpenSeat ?? false,
      primaryDate: race.primaryDate?.toISOString() ?? null,
      generalDate: race.generalDate?.toISOString() ?? null,
      totalCandidates: raceCands.length,
      rCount: rCands.length,
      dCount: dCands.length,
      cookRating: latestRatings['cook'] ?? null,
      sabatoRating: latestRatings['sabato'] ?? null,
      insideRating: latestRatings['inside'] ?? null,
      topRCash,
      topDCash,
    }
  })
  } catch {
    return []
  }
}

// ─── Race Detail ───────────────────────────────────────────────────────────────

export type VendorEntry = {
  vendorId: string
  vendorName: string | null
  category: string
  totalSpentCycle: number | null
  side: string | null
  isPlatformProcessor: boolean | null
}

export type CandidateDetail = {
  id: string
  fecId: string | null
  fullName: string
  party: string | null
  status: string
  photoUrl: string | null
  bioguideId: string | null
  cashOnHand: number | null
  totalReceipts: number | null
  totalDisbursements: number | null
  burnRate: number | null
  debt: number | null
  reportPeriodEnd: string | null
  vendors: VendorEntry[]
}

export type RaceDetail = {
  id: string
  cycle: number
  office: string
  state: string
  district: string | null
  seatClass: string | null
  isOpenSeat: boolean
  primaryDate: string | null
  generalDate: string | null
  candidates: CandidateDetail[]
  ratings: { rater: string; rating: string; capturedAt: string }[]
  consideringCandidates: {
    id: string
    name: string
    signalStrength: number
    quote: string | null
    sourceUrl: string | null
    sourcePublication: string | null
    extractedAt: string | null
  }[]
}

export async function getRaceDetail(id: string): Promise<RaceDetail | null> {
  try {
  const [race] = await db.select().from(races).where(eq(races.id, id))
  if (!race) return null

  const candidateList = await db
    .select()
    .from(candidates)
    .where(eq(candidates.raceId, id))

  const candidateIds = candidateList.map(c => c.id)

  const [committeeList, ratingList, consideringList] = await Promise.all([
    candidateIds.length
      ? db
          .select()
          .from(committees)
          .where(inArray(committees.candidateId, candidateIds))
      : Promise.resolve([]),

    db
      .select()
      .from(raceRatings)
      .where(eq(raceRatings.raceId, id))
      .orderBy(desc(raceRatings.capturedAt)),

    db
      .select()
      .from(consideringCandidates)
      .where(
        and(
          eq(consideringCandidates.raceId, id),
          eq(consideringCandidates.status, 'published')
        )
      ),
  ])

  const committeeIds = committeeList.map(c => c.id)

  const [financialList, vendorRelList] = await Promise.all([
    committeeIds.length
      ? db
          .select()
          .from(financialsTable)
          .where(inArray(financialsTable.committeeId, committeeIds))
          .orderBy(desc(financialsTable.reportPeriodEnd))
      : Promise.resolve([]),

    candidateIds.length
      ? db
          .select({
            candidateId: candidateVendors.candidateId,
            vendorId: candidateVendors.vendorId,
            category: candidateVendors.category,
            totalSpentCycle: candidateVendors.totalSpentCycle,
            vendorName: knownVendors.canonicalName,
            vendorSide: knownVendors.side,
            isPlatformProcessor: knownVendors.isPlatformProcessor,
          })
          .from(candidateVendors)
          .leftJoin(knownVendors, eq(candidateVendors.vendorId, knownVendors.id))
          .where(inArray(candidateVendors.candidateId, candidateIds))
          .orderBy(desc(candidateVendors.totalSpentCycle))
      : Promise.resolve([]),
  ])

  const latestFinancialByCommittee: Record<string, (typeof financialList)[0]> = {}
  for (const f of financialList) {
    if (f.committeeId && !latestFinancialByCommittee[f.committeeId]) {
      latestFinancialByCommittee[f.committeeId] = f
    }
  }

  const latestFinancialByCandidate: Record<string, (typeof financialList)[0]> = {}
  for (const comm of committeeList) {
    if (comm.candidateId && latestFinancialByCommittee[comm.id]) {
      latestFinancialByCandidate[comm.candidateId] = latestFinancialByCommittee[comm.id]
    }
  }

  const statusOrder: Record<string, number> = {
    incumbent: 0,
    declared: 1,
    considering: 2,
    withdrawn: 3,
  }
  const partyOrder: Record<string, number> = { R: 0, D: 1 }

  const candidateDetails: CandidateDetail[] = candidateList
    .sort((a, b) => {
      const sd = (statusOrder[a.status] ?? 9) - (statusOrder[b.status] ?? 9)
      if (sd !== 0) return sd
      return (partyOrder[a.party ?? ''] ?? 9) - (partyOrder[b.party ?? ''] ?? 9)
    })
    .map(c => {
      const fin = latestFinancialByCandidate[c.id]
      const vendors: VendorEntry[] = vendorRelList
        .filter(v => v.candidateId === c.id && !v.isPlatformProcessor)
        .map(v => ({
          vendorId: v.vendorId ?? '',
          vendorName: v.vendorName,
          category: v.category,
          totalSpentCycle: v.totalSpentCycle ? parseFloat(v.totalSpentCycle) : null,
          side: v.vendorSide,
          isPlatformProcessor: v.isPlatformProcessor,
        }))

      return {
        id: c.id,
        fecId: c.fecId,
        fullName: c.fullName,
        party: c.party,
        status: c.status,
        photoUrl: c.photoUrl,
        bioguideId: c.bioguideId,
        cashOnHand: fin?.cashOnHand ? parseFloat(fin.cashOnHand) : null,
        totalReceipts: fin?.totalReceipts ? parseFloat(fin.totalReceipts) : null,
        totalDisbursements: fin?.totalDisbursements ? parseFloat(fin.totalDisbursements) : null,
        burnRate: fin?.burnRate ? parseFloat(fin.burnRate) : null,
        debt: fin?.debt ? parseFloat(fin.debt) : null,
        reportPeriodEnd: fin?.reportPeriodEnd?.toISOString() ?? null,
        vendors,
      }
    })

  const latestRatings: RaceDetail['ratings'] = []
  const seenRaters = new Set<string>()
  for (const r of ratingList) {
    if (!seenRaters.has(r.rater)) {
      latestRatings.push({
        rater: r.rater,
        rating: r.rating,
        capturedAt: r.capturedAt?.toISOString() ?? '',
      })
      seenRaters.add(r.rater)
    }
  }

  return {
    id: race.id,
    cycle: race.cycle,
    office: race.office,
    state: race.state,
    district: race.district,
    seatClass: race.seatClass,
    isOpenSeat: race.isOpenSeat ?? false,
    primaryDate: race.primaryDate?.toISOString() ?? null,
    generalDate: race.generalDate?.toISOString() ?? null,
    candidates: candidateDetails,
    ratings: latestRatings,
    consideringCandidates: consideringList.map(c => ({
      id: c.id,
      name: c.name,
      signalStrength: c.signalStrength,
      quote: c.quote,
      sourceUrl: c.sourceUrl,
      sourcePublication: c.sourcePublication,
      extractedAt: c.extractedAt?.toISOString() ?? null,
    })),
  }
  } catch {
    return null
  }
}
