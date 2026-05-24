'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import type { RaceSummary } from '@/lib/queries'
import {
  formatCurrency,
  formatDate,
  officeName,
  stateName,
  ratingBadgeClass,
} from '@/lib/format'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'

function bestRating(race: RaceSummary): string | null {
  return race.cookRating ?? race.sabatoRating ?? race.insideRating ?? null
}

const COMPETITIVE = new Set([
  'Toss Up', 'Toss-Up', 'Pure Toss-Up',
  'Lean R', 'Lean D', 'Leans R', 'Leans D',
  'Toss-Up R', 'Toss-Up D',
])

type SortKey = 'state' | 'office' | 'rating' | 'rCash' | 'dCash' | 'candidates'

function csvExport(races: RaceSummary[]) {
  const headers = [
    'State', 'Abbr', 'Office', 'District', 'Seat Class', 'Open Seat',
    'Total Candidates', 'R', 'D',
    'Cook Rating', 'Sabato Rating', 'Inside Rating',
    'Top R Cash', 'Top D Cash', 'Primary Date', 'General Date',
  ]
  const rows = races.map(r => [
    stateName(r.state), r.state, officeName(r.office),
    r.district ?? '', r.seatClass ?? '',
    r.isOpenSeat ? 'Yes' : 'No',
    r.totalCandidates, r.rCount, r.dCount,
    r.cookRating ?? '', r.sabatoRating ?? '', r.insideRating ?? '',
    r.topRCash ?? '', r.topDCash ?? '',
    r.primaryDate ? new Date(r.primaryDate).toLocaleDateString() : '',
    r.generalDate ? new Date(r.generalDate).toLocaleDateString() : '',
  ])
  const csv = [headers, ...rows]
    .map(row => row.map(v => `"${v}"`).join(','))
    .join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'race-intel-2026.csv'
  a.click()
  URL.revokeObjectURL(url)
}

export default function RacesClient({
  races,
  initialState,
  initialOffice,
}: {
  races: RaceSummary[]
  initialState?: string
  initialOffice?: string
}) {
  const [search, setSearch] = useState('')
  const [officeFilter, setOfficeFilter] = useState(initialOffice ?? 'all')
  const [stateFilter, setStateFilter] = useState(initialState ?? 'all')
  const [competitiveOnly, setCompetitiveOnly] = useState(false)
  const [sortKey, setSortKey] = useState<SortKey>('state')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  const states = useMemo(
    () => Array.from(new Set(races.map(r => r.state))).sort(),
    [races]
  )

  const filtered = useMemo(() => {
    let result = races

    if (search.trim()) {
      const q = search.trim().toLowerCase()
      result = result.filter(
        r =>
          stateName(r.state).toLowerCase().includes(q) ||
          r.state.toLowerCase().includes(q) ||
          officeName(r.office).toLowerCase().includes(q) ||
          (r.district ?? '').toLowerCase().includes(q)
      )
    }

    if (officeFilter !== 'all') result = result.filter(r => r.office === officeFilter)
    if (stateFilter !== 'all') result = result.filter(r => r.state === stateFilter)
    if (competitiveOnly) {
      result = result.filter(r => {
        const rating = bestRating(r)
        return rating && COMPETITIVE.has(rating)
      })
    }

    return [...result].sort((a, b) => {
      let av: string | number, bv: string | number
      switch (sortKey) {
        case 'state':      av = a.state;              bv = b.state;              break
        case 'office':     av = a.office;             bv = b.office;             break
        case 'rating':     av = bestRating(a) ?? 'zzz'; bv = bestRating(b) ?? 'zzz'; break
        case 'rCash':      av = a.topRCash ?? -1;     bv = b.topRCash ?? -1;     break
        case 'dCash':      av = a.topDCash ?? -1;     bv = b.topDCash ?? -1;     break
        case 'candidates': av = a.totalCandidates;    bv = b.totalCandidates;    break
        default:           av = a.state;              bv = b.state
      }
      if (av < bv) return sortDir === 'asc' ? -1 : 1
      if (av > bv) return sortDir === 'asc' ? 1 : -1
      return 0
    })
  }, [races, search, officeFilter, stateFilter, competitiveOnly, sortKey, sortDir])

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortKey(key); setSortDir('asc') }
  }

  function SortIndicator({ col }: { col: SortKey }) {
    if (sortKey !== col) return <span className="text-muted-foreground/30 ml-0.5">↕</span>
    return <span className="ml-0.5">{sortDir === 'asc' ? '↑' : '↓'}</span>
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">2026 Races</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {filtered.length} of {races.length} races
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => csvExport(filtered)}>
          Export CSV
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <Input
          placeholder="Search state or office…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-52"
        />
        <Select value={officeFilter} onValueChange={setOfficeFilter}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Office" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Offices</SelectItem>
            <SelectItem value="senate">Senate</SelectItem>
            <SelectItem value="house">House</SelectItem>
            <SelectItem value="governor">Governor</SelectItem>
          </SelectContent>
        </Select>
        <Select value={stateFilter} onValueChange={setStateFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="State" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All States</SelectItem>
            {states.map(s => (
              <SelectItem key={s} value={s}>
                {stateName(s)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <label className="flex items-center gap-2 text-sm cursor-pointer select-none ml-1">
          <input
            type="checkbox"
            checked={competitiveOnly}
            onChange={e => setCompetitiveOnly(e.target.checked)}
            className="rounded border-input"
          />
          Competitive only
        </label>
      </div>

      {/* Table */}
      {races.length === 0 ? (
        <div className="h-64 rounded-xl border border-dashed flex items-center justify-center text-center text-sm text-muted-foreground">
          <div>
            <p className="font-medium">No races loaded yet</p>
            <p className="mt-1">
              Run{' '}
              <code className="px-1 py-0.5 bg-muted rounded text-xs">
                npm run ingest:candidates
              </code>{' '}
              to populate
            </p>
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="h-32 flex items-center justify-center text-muted-foreground text-sm">
          No races match your filters
        </div>
      ) : (
        <div className="rounded-lg border overflow-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 border-b text-xs uppercase tracking-wide">
              <tr>
                <th
                  className="text-left px-3 py-2.5 font-medium cursor-pointer whitespace-nowrap"
                  onClick={() => toggleSort('state')}
                >
                  State <SortIndicator col="state" />
                </th>
                <th
                  className="text-left px-3 py-2.5 font-medium cursor-pointer"
                  onClick={() => toggleSort('office')}
                >
                  Office <SortIndicator col="office" />
                </th>
                <th className="text-left px-3 py-2.5 font-medium">Dist.</th>
                <th
                  className="text-center px-3 py-2.5 font-medium cursor-pointer"
                  onClick={() => toggleSort('candidates')}
                >
                  R / D <SortIndicator col="candidates" />
                </th>
                <th
                  className="text-left px-3 py-2.5 font-medium cursor-pointer"
                  onClick={() => toggleSort('rating')}
                >
                  Rating <SortIndicator col="rating" />
                </th>
                <th
                  className="text-right px-3 py-2.5 font-medium cursor-pointer"
                  onClick={() => toggleSort('rCash')}
                >
                  R Cash <SortIndicator col="rCash" />
                </th>
                <th
                  className="text-right px-3 py-2.5 font-medium cursor-pointer"
                  onClick={() => toggleSort('dCash')}
                >
                  D Cash <SortIndicator col="dCash" />
                </th>
                <th className="text-left px-3 py-2.5 font-medium">General</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map(race => {
                const rating = bestRating(race)
                return (
                  <tr key={race.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-3 py-2 font-medium whitespace-nowrap">
                      <Link
                        href={`/races/${race.id}`}
                        className="text-primary hover:underline"
                      >
                        {stateName(race.state)}
                      </Link>
                      {race.isOpenSeat && (
                        <span className="ml-1.5 text-xs text-muted-foreground font-normal">
                          open
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {officeName(race.office)}
                      {race.seatClass && (
                        <span className="text-muted-foreground ml-1 text-xs">
                          Cl.{race.seatClass}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground text-xs">
                      {race.district ?? '—'}
                    </td>
                    <td className="px-3 py-2 text-center whitespace-nowrap">
                      <span className="text-red-700 font-medium">{race.rCount}R</span>
                      <span className="text-muted-foreground mx-1">/</span>
                      <span className="text-blue-700 font-medium">{race.dCount}D</span>
                    </td>
                    <td className="px-3 py-2">
                      {rating ? (
                        <span
                          className={`inline-flex px-1.5 py-0.5 rounded text-xs font-medium border ${ratingBadgeClass(rating)}`}
                        >
                          {rating}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-xs">
                      {formatCurrency(race.topRCash)}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-xs">
                      {formatCurrency(race.topDCash)}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground whitespace-nowrap text-xs">
                      {formatDate(race.generalDate)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
