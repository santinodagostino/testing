import { db } from '@/db'
import { races, candidates, committees, financials, raceRatings } from '@/db/schema'
import { eq, count, sql, desc } from 'drizzle-orm'
import Link from 'next/link'
import { formatCurrency, officeName, stateName, ratingBadgeClass } from '@/lib/format'

export const dynamic = 'force-dynamic'

const COMPETITIVE = new Set([
  'Toss Up', 'Toss-Up', 'Pure Toss-Up',
  'Lean R', 'Lean D', 'Leans R', 'Leans D',
])

export default async function HomePage() {
  let stats = { races: 0, candidates: 0, committees: 0, financials: 0 }
  let topRatings: any[] = []
  let topCash: any[] = []

  try {
    const [raceCount, candidateCount, committeeCount, financialCount] = await Promise.all([
      db.select({ n: count() }).from(races).where(eq(races.cycle, 2026)),
      db.select({ n: count() }).from(candidates),
      db.select({ n: count() }).from(committees),
      db.select({ n: count() }).from(financials),
    ])

    stats = {
      races: raceCount[0].n,
      candidates: candidateCount[0].n,
      committees: committeeCount[0].n,
      financials: financialCount[0].n,
    }

    topRatings = await db
      .select({
        raceId: raceRatings.raceId,
        rating: raceRatings.rating,
        state: races.state,
        office: races.office,
        district: races.district,
      })
      .from(raceRatings)
      .innerJoin(races, eq(raceRatings.raceId, races.id))
      .where(eq(raceRatings.rater, 'cook'))
      .orderBy(desc(raceRatings.capturedAt))
      .limit(50)

    topCash = await db.execute(sql`
      SELECT c.id, c.full_name, c.party, c.state, c.office, c.district,
             c.race_id,
             f.cash_on_hand, f.total_receipts
      FROM candidates c
      JOIN committees cm ON cm.candidate_id = c.id
      JOIN financials f ON f.committee_id = cm.id
      WHERE c.office IN ('senate', 'house')
      ORDER BY f.cash_on_hand DESC NULLS LAST
      LIMIT 10
    `)
  } catch {}

  const competitiveRaces = topRatings
    .filter(r => COMPETITIVE.has(r.rating))
    .slice(0, 12)

  const hasCash = (topCash as any[]).length > 0

  return (
    <div className="space-y-8 max-w-6xl">
      <div>
        <h1 className="text-3xl font-bold">2026 Race Intelligence</h1>
        <p className="text-muted-foreground mt-1">
          Federal and gubernatorial races · Political vendor prospecting
        </p>
      </div>

      {/* Quick nav */}
      <div className="flex gap-3">
        <Link
          href="/map"
          className="flex-1 max-w-xs rounded-xl border p-4 hover:bg-muted/30 transition-colors group"
        >
          <div className="text-2xl mb-1">🗺</div>
          <p className="font-semibold group-hover:underline">Map View</p>
          <p className="text-sm text-muted-foreground">Interactive US choropleth</p>
        </Link>
        <Link
          href="/races"
          className="flex-1 max-w-xs rounded-xl border p-4 hover:bg-muted/30 transition-colors group"
        >
          <div className="text-2xl mb-1">📋</div>
          <p className="font-semibold group-hover:underline">All Races</p>
          <p className="text-sm text-muted-foreground">Filter, sort, export CSV</p>
        </Link>
        <Link
          href="/admin/vendors"
          className="flex-1 max-w-xs rounded-xl border p-4 hover:bg-muted/30 transition-colors group"
        >
          <div className="text-2xl mb-1">🏢</div>
          <p className="font-semibold group-hover:underline">Vendors</p>
          <p className="text-sm text-muted-foreground">Known vendors & unmatched payees</p>
        </Link>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Races (2026)', value: stats.races.toLocaleString() },
          { label: 'Candidates', value: stats.candidates.toLocaleString() },
          { label: 'Committees', value: stats.committees.toLocaleString() },
          { label: 'Financials', value: stats.financials.toLocaleString() },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-xl border p-4">
            <p className="text-2xl font-bold font-mono">{value}</p>
            <p className="text-sm text-muted-foreground">{label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Competitive Senate/Gov races */}
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">
            Competitive Races
            <span className="text-muted-foreground font-normal text-sm ml-2">
              Cook Toss-Up / Lean
            </span>
          </h2>
          {competitiveRaces.length === 0 ? (
            <div className="rounded-xl border border-dashed h-32 flex items-center justify-center text-sm text-muted-foreground">
              Run{' '}
              <code className="mx-1 px-1 bg-muted rounded text-xs">npm run seed:ratings</code>{' '}
              to populate
            </div>
          ) : (
            <div className="rounded-lg border divide-y">
              {competitiveRaces.map(r => (
                <Link
                  key={r.raceId}
                  href={`/races/${r.raceId}`}
                  className="flex items-center justify-between px-3 py-2.5 hover:bg-muted/20 transition-colors text-sm"
                >
                  <span className="font-medium">
                    {stateName(r.state)} {officeName(r.office)}
                    {r.district ? ` – ${r.district}` : ''}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded text-xs font-medium border ${ratingBadgeClass(r.rating)}`}
                  >
                    {r.rating}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* Top cash on hand */}
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">
            Top Cash on Hand
            <span className="text-muted-foreground font-normal text-sm ml-2">
              Senate + House
            </span>
          </h2>
          {!hasCash ? (
            <div className="rounded-xl border border-dashed h-32 flex items-center justify-center text-sm text-muted-foreground">
              Run{' '}
              <code className="mx-1 px-1 bg-muted rounded text-xs">npm run ingest:financials</code>{' '}
              to populate
            </div>
          ) : (
            <div className="rounded-lg border divide-y">
              {(topCash as any[]).map((c, i) => (
                <Link
                  key={c.id}
                  href={c.race_id ? `/races/${c.race_id}` : '/races'}
                  className="flex items-center gap-3 px-3 py-2.5 hover:bg-muted/20 transition-colors text-sm"
                >
                  <span className="text-muted-foreground w-4 text-right shrink-0">{i + 1}</span>
                  <span
                    className={`w-5 h-5 rounded-sm text-xs font-bold flex items-center justify-center shrink-0 ${
                      c.party === 'R' ? 'bg-red-100 text-red-700' :
                      c.party === 'D' ? 'bg-blue-100 text-blue-700' : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {c.party ?? '?'}
                  </span>
                  <span className="flex-1 font-medium truncate">{c.full_name}</span>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {c.state} {c.office === 'senate' ? 'Sen' : `H-${c.district ?? '?'}`}
                  </span>
                  <span className="font-mono text-xs shrink-0">
                    {formatCurrency(parseFloat(c.cash_on_hand ?? '0'))}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
