import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getRaceDetail } from '@/lib/queries'
import type { CandidateDetail } from '@/lib/queries'
import {
  formatCurrency,
  formatDate,
  officeName,
  stateName,
  statusLabel,
  ratingBadgeClass,
  partyBadgeClass,
  raterLabel,
  vendorCategoryLabel,
  PRIORITY_VENDOR_CATEGORIES,
} from '@/lib/format'
import { Badge } from '@/components/ui/badge'

export const dynamic = 'force-dynamic'

export default async function RaceDetailPage({
  params,
}: {
  params: { id: string }
}) {
  const race = await getRaceDetail(params.id)
  if (!race) notFound()

  const raceTitle = [
    stateName(race.state),
    officeName(race.office),
    race.district ? `– Dist. ${race.district}` : '',
    race.seatClass ? `(Class ${race.seatClass})` : '',
    race.cycle,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className="space-y-8 max-w-5xl">
      {/* Breadcrumb */}
      <div className="text-sm text-muted-foreground">
        <Link href="/races" className="hover:underline">
          Races
        </Link>{' '}
        / {stateName(race.state)} {officeName(race.office)}
      </div>

      {/* Header */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-3xl font-bold">{raceTitle}</h1>
          {race.isOpenSeat && (
            <Badge variant="secondary" className="text-xs">
              Open Seat
            </Badge>
          )}
        </div>

        {/* Dates */}
        <div className="flex gap-6 text-sm text-muted-foreground">
          {race.primaryDate && (
            <span>
              Primary:{' '}
              <span className="text-foreground font-medium">
                {formatDate(race.primaryDate)}
              </span>
            </span>
          )}
          {race.generalDate && (
            <span>
              General:{' '}
              <span className="text-foreground font-medium">
                {formatDate(race.generalDate)}
              </span>
            </span>
          )}
        </div>

        {/* Ratings */}
        {race.ratings.length > 0 && (
          <div className="flex flex-wrap gap-3 items-center pt-1">
            {race.ratings.map(r => (
              <div key={r.rater} className="flex items-center gap-1.5 text-sm">
                <span className="text-muted-foreground text-xs">{raterLabel(r.rater)}</span>
                <span
                  className={`px-2 py-0.5 rounded text-xs font-medium border ${ratingBadgeClass(r.rating)}`}
                >
                  {r.rating}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Candidates */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">
          Candidates
          <span className="text-muted-foreground font-normal text-sm ml-2">
            ({race.candidates.length})
          </span>
        </h2>

        {race.candidates.length === 0 ? (
          <p className="text-muted-foreground text-sm">No candidates loaded for this race.</p>
        ) : (
          <div className="space-y-4">
            {race.candidates.map(c => (
              <CandidateCard key={c.id} candidate={c} />
            ))}
          </div>
        )}
      </section>

      {/* Considering candidates */}
      {race.consideringCandidates.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Considering Running</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {race.consideringCandidates.map(c => (
              <div key={c.id} className="rounded-lg border p-3 text-sm space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{c.name}</span>
                  <span className="text-xs text-muted-foreground">
                    Signal: {c.signalStrength}/5
                  </span>
                </div>
                {c.quote && (
                  <p className="text-muted-foreground italic text-xs line-clamp-2">
                    "{c.quote}"
                  </p>
                )}
                {c.sourcePublication && (
                  <p className="text-xs text-muted-foreground">
                    via {c.sourcePublication}
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

function CandidateCard({ candidate: c }: { candidate: CandidateDetail }) {
  const hasFin = c.cashOnHand !== null || c.totalReceipts !== null
  const burnPct =
    c.burnRate !== null ? `${(c.burnRate * 100).toFixed(0)}%` : null

  const vendorsByCategory = PRIORITY_VENDOR_CATEGORIES.reduce<
    Record<string, typeof c.vendors>
  >((acc, cat) => {
    const vs = c.vendors.filter(v => v.category === cat)
    if (vs.length > 0) acc[cat] = vs
    return acc
  }, {})

  return (
    <div className="rounded-xl border p-4 space-y-4">
      {/* Candidate header */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xl font-bold">{c.fullName}</span>
            {c.party && (
              <span
                className={`px-1.5 py-0.5 rounded text-xs font-bold ${partyBadgeClass(c.party)}`}
              >
                {c.party}
              </span>
            )}
            <span className="px-1.5 py-0.5 rounded text-xs bg-muted text-muted-foreground">
              {statusLabel(c.status)}
            </span>
          </div>
          {c.fecId && (
            <p className="text-xs text-muted-foreground">FEC: {c.fecId}</p>
          )}
        </div>

        {/* Cash on hand callout */}
        {c.cashOnHand !== null && (
          <div className="text-right shrink-0">
            <p className="text-2xl font-bold font-mono">
              {formatCurrency(c.cashOnHand)}
            </p>
            <p className="text-xs text-muted-foreground">cash on hand</p>
            {c.reportPeriodEnd && (
              <p className="text-xs text-muted-foreground">
                as of {formatDate(c.reportPeriodEnd)}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Financial row */}
      {hasFin && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 bg-muted/30 rounded-lg text-sm">
          <FinStat label="Total Raised" value={formatCurrency(c.totalReceipts)} />
          <FinStat label="Total Spent" value={formatCurrency(c.totalDisbursements)} />
          <FinStat label="Burn Rate" value={burnPct ?? '—'} />
          <FinStat label="Debt" value={formatCurrency(c.debt)} />
        </div>
      )}

      {/* Vendor team */}
      {Object.keys(vendorsByCategory).length > 0 && (
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
            Vendor Team
          </p>
          <div className="flex flex-wrap gap-2">
            {Object.entries(vendorsByCategory).map(([cat, vendors]) =>
              vendors.map(v => (
                <VendorChip
                  key={v.vendorId}
                  name={v.vendorName ?? 'Unknown'}
                  category={cat}
                  spent={v.totalSpentCycle}
                  side={v.side}
                />
              ))
            )}
          </div>
        </div>
      )}

      {/* No vendor data note */}
      {c.vendors.length === 0 && hasFin && (
        <p className="text-xs text-muted-foreground">
          No matched vendors yet — run{' '}
          <code className="px-1 bg-muted rounded">npm run ingest:disbursements</code>
        </p>
      )}
    </div>
  )
}

function FinStat({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium font-mono text-sm">{value ?? '—'}</p>
    </div>
  )
}

function VendorChip({
  name,
  category,
  spent,
  side,
}: {
  name: string
  category: string
  spent: number | null
  side: string | null
}) {
  const sideColor =
    side === 'R'
      ? 'border-red-200 bg-red-50'
      : side === 'D'
      ? 'border-blue-200 bg-blue-50'
      : 'border-border bg-muted/50'

  return (
    <div
      className={`flex items-center gap-1.5 px-2 py-1 rounded-md border text-xs ${sideColor}`}
    >
      <span className="font-medium">{name}</span>
      <span className="text-muted-foreground">·</span>
      <span className="text-muted-foreground">{vendorCategoryLabel(category)}</span>
      {spent !== null && spent > 0 && (
        <>
          <span className="text-muted-foreground">·</span>
          <span className="font-mono text-muted-foreground">{formatCurrency(spent)}</span>
        </>
      )}
    </div>
  )
}
