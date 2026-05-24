import { db } from '@/db'
import { consideringCandidates, races } from '@/db/schema'
import { eq, desc, inArray } from 'drizzle-orm'
import { stateName, officeName } from '@/lib/format'
import ConsideringQueue from './considering-queue'

export const dynamic = 'force-dynamic'

export default async function ConsideringAdminPage() {
  let pending: any[] = [], published: any[] = [], rejected: any[] = []
  try {
  ;[pending, published, rejected] = await Promise.all([
    db
      .select()
      .from(consideringCandidates)
      .where(eq(consideringCandidates.status, 'pending_review'))
      .orderBy(desc(consideringCandidates.signalStrength), desc(consideringCandidates.extractedAt)),

    db
      .select()
      .from(consideringCandidates)
      .where(eq(consideringCandidates.status, 'published'))
      .orderBy(desc(consideringCandidates.extractedAt))
      .limit(20),

    db
      .select()
      .from(consideringCandidates)
      .where(eq(consideringCandidates.status, 'rejected'))
      .orderBy(desc(consideringCandidates.extractedAt))
      .limit(10),
  ])
  } catch { /* DB unavailable — show empty state */ }

  const items = [...pending, ...published, ...rejected].map(c => ({
    id: c.id,
    name: c.name,
    office: c.office,
    state: c.state,
    district: c.district,
    signalStrength: c.signalStrength,
    quote: c.quote,
    sourceUrl: c.sourceUrl,
    sourcePublication: c.sourcePublication,
    extractedAt: c.extractedAt?.toISOString() ?? null,
    status: c.status,
    reviewerNotes: c.reviewerNotes,
    raceId: c.raceId,
  }))

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Considering Candidates</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            LLM-extracted signals — review before publishing to race pages
          </p>
        </div>
        <div className="flex gap-4 text-sm text-center">
          <div>
            <p className="text-2xl font-bold text-yellow-600">{pending.length}</p>
            <p className="text-muted-foreground">pending</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-green-600">{published.length}</p>
            <p className="text-muted-foreground">published</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-muted-foreground">{rejected.length}</p>
            <p className="text-muted-foreground">rejected</p>
          </div>
        </div>
      </div>

      <ConsideringQueue items={items} />
    </div>
  )
}
