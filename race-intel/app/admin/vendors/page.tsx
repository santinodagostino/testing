import { db } from '@/db'
import { knownVendors, disbursements } from '@/db/schema'
import { isNull, desc, sql } from 'drizzle-orm'
import { vendorCategoryLabel, formatCurrency } from '@/lib/format'

export const dynamic = 'force-dynamic'

export default async function VendorsAdminPage() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let vendors: any[] = [], unmatched: any[] = []
  try {
  ;[vendors, unmatched] = await Promise.all([
    db
      .select()
      .from(knownVendors)
      .orderBy(knownVendors.category, knownVendors.canonicalName),

    db
      .select({
        payeeName: disbursements.payeeName,
        total: sql<string>`sum(${disbursements.amount})`,
        count: sql<string>`count(*)`,
      })
      .from(disbursements)
      .where(isNull(disbursements.vendorId))
      .groupBy(disbursements.payeeName)
      .having(sql`sum(${disbursements.amount}) > 10000`)
      .orderBy(desc(sql`sum(${disbursements.amount})`))
      .limit(50),
  ])
  } catch { /* DB unavailable — show empty state */ }

  const byCategory = vendors.reduce<Record<string, typeof vendors>>(
    (acc, v) => {
      const cat = v.category
      if (!acc[cat]) acc[cat] = []
      acc[cat].push(v)
      return acc
    },
    {}
  )

  const sideColor: Record<string, string> = {
    R: 'bg-red-100 text-red-800',
    D: 'bg-blue-100 text-blue-800',
    bipartisan: 'bg-purple-100 text-purple-800',
    unknown: 'bg-muted text-muted-foreground',
  }

  return (
    <div className="space-y-8 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold">Vendors</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {vendors.length} known vendors · {unmatched.length} unmatched payees over $10K
        </p>
      </div>

      {/* Unmatched queue */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">
          Unmatched Payees
          <span className="text-muted-foreground font-normal text-sm ml-2">
            (over $10K, no vendor match)
          </span>
        </h2>
        {unmatched.length === 0 ? (
          <div className="rounded-xl border border-dashed h-32 flex items-center justify-center text-sm text-muted-foreground">
            {vendors.length === 0
              ? 'Run npm run seed:vendors then npm run ingest:disbursements'
              : 'No unmatched payees over $10K — great coverage!'}
          </div>
        ) : (
          <div className="rounded-lg border overflow-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 border-b text-xs uppercase tracking-wide">
                <tr>
                  <th className="text-left px-3 py-2.5 font-medium">Payee Name</th>
                  <th className="text-right px-3 py-2.5 font-medium">Total ($)</th>
                  <th className="text-right px-3 py-2.5 font-medium">Disbursements</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {unmatched.map(row => (
                  <tr key={row.payeeName} className="hover:bg-muted/20">
                    <td className="px-3 py-2 font-medium">{row.payeeName}</td>
                    <td className="px-3 py-2 text-right font-mono text-xs">
                      {formatCurrency(parseFloat(row.total))}
                    </td>
                    <td className="px-3 py-2 text-right text-muted-foreground">
                      {row.count}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Known vendors by category */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Known Vendors</h2>
        {vendors.length === 0 ? (
          <div className="rounded-xl border border-dashed h-32 flex items-center justify-center text-sm text-muted-foreground">
            No vendors seeded — run{' '}
            <code className="mx-1 px-1 bg-muted rounded text-xs">npm run seed:vendors</code>
          </div>
        ) : (
          Object.entries(byCategory)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([category, catVendors]) => (
              <div key={category} className="space-y-2">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  {vendorCategoryLabel(category)}{' '}
                  <span className="font-normal">({catVendors.length})</span>
                </h3>
                <div className="flex flex-wrap gap-2">
                  {catVendors.map(v => (
                    <div
                      key={v.id}
                      className="rounded-lg border px-3 py-1.5 text-sm flex items-center gap-2"
                    >
                      <span className="font-medium">{v.canonicalName}</span>
                      <span
                        className={`text-xs px-1.5 py-0.5 rounded font-medium ${sideColor[v.side] ?? sideColor.unknown}`}
                      >
                        {v.side}
                      </span>
                      {v.isPlatformProcessor && (
                        <span className="text-xs text-muted-foreground">platform</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))
        )}
      </section>
    </div>
  )
}
