'use client'

import { useState, useTransition } from 'react'
import { stateName, officeName, formatDate } from '@/lib/format'
import { reviewConsideringCandidate } from './actions'
import { Button } from '@/components/ui/button'

type Item = {
  id: string
  name: string
  office: string
  state: string
  district: string | null
  signalStrength: number
  quote: string | null
  sourceUrl: string | null
  sourcePublication: string | null
  extractedAt: string | null
  status: string
  reviewerNotes: string | null
  raceId: string | null
}

const STATUS_TABS = ['pending_review', 'published', 'rejected'] as const

export default function ConsideringQueue({ items }: { items: Item[] }) {
  const [tab, setTab] = useState<typeof STATUS_TABS[number]>('pending_review')
  const [isPending, startTransition] = useTransition()

  const filtered = items.filter(i => i.status === tab)

  function review(id: string, status: 'published' | 'rejected') {
    startTransition(() => reviewConsideringCandidate(id, status))
  }

  const tabLabel: Record<string, string> = {
    pending_review: `Pending (${items.filter(i => i.status === 'pending_review').length})`,
    published: `Published (${items.filter(i => i.status === 'published').length})`,
    rejected: `Rejected (${items.filter(i => i.status === 'rejected').length})`,
  }

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="flex gap-1 border-b">
        {STATUS_TABS.map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === t
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {tabLabel[t]}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="h-48 rounded-xl border border-dashed flex items-center justify-center text-sm text-muted-foreground">
          {tab === 'pending_review'
            ? 'No items pending review — run the ingestion pipeline to populate'
            : `No ${tab.replace('_', ' ')} items`}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(item => (
            <ItemCard
              key={item.id}
              item={item}
              onReview={review}
              isPending={isPending}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function ItemCard({
  item,
  onReview,
  isPending,
}: {
  item: Item
  onReview: (id: string, status: 'published' | 'rejected') => void
  isPending: boolean
}) {
  const signals = Array.from({ length: 5 }, (_, i) => i < item.signalStrength)

  return (
    <div className="rounded-xl border p-4 space-y-3">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-lg">{item.name}</span>
            <span className="text-sm text-muted-foreground">
              {officeName(item.office)} · {stateName(item.state)}
              {item.district && ` – ${item.district}`}
            </span>
          </div>

          {/* Signal strength */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground">Signal:</span>
            <span className="flex gap-0.5">
              {signals.map((filled, i) => (
                <span
                  key={i}
                  className={`inline-block w-2.5 h-2.5 rounded-sm ${
                    filled ? 'bg-yellow-400' : 'bg-muted'
                  }`}
                />
              ))}
            </span>
            <span className="text-xs text-muted-foreground">{item.signalStrength}/5</span>
          </div>
        </div>

        {item.status === 'pending_review' && (
          <div className="flex gap-2 shrink-0">
            <Button
              size="sm"
              variant="outline"
              className="text-green-700 border-green-300 hover:bg-green-50"
              onClick={() => onReview(item.id, 'published')}
              disabled={isPending}
            >
              Publish
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="text-muted-foreground"
              onClick={() => onReview(item.id, 'rejected')}
              disabled={isPending}
            >
              Reject
            </Button>
          </div>
        )}

        {item.status === 'published' && (
          <span className="text-xs px-2 py-0.5 rounded bg-green-100 text-green-800 font-medium shrink-0">
            Published
          </span>
        )}

        {item.status === 'rejected' && (
          <span className="text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground shrink-0">
            Rejected
          </span>
        )}
      </div>

      {item.quote && (
        <blockquote className="text-sm text-muted-foreground italic border-l-2 pl-3">
          &ldquo;{item.quote}&rdquo;
        </blockquote>
      )}

      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        {item.sourcePublication && <span>{item.sourcePublication}</span>}
        {item.extractedAt && <span>{formatDate(item.extractedAt)}</span>}
        {item.reviewerNotes && (
          <span className="text-foreground">Note: {item.reviewerNotes}</span>
        )}
      </div>
    </div>
  )
}
