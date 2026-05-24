'use client'

import { useState, useMemo } from 'react'
import { ComposableMap, Geographies, Geography } from 'react-simple-maps'
import Link from 'next/link'
import type { RaceSummary } from '@/lib/queries'
import {
  stateName,
  officeName,
  formatCurrency,
  ratingBadgeClass,
  ABBR_BY_STATE_NAME,
} from '@/lib/format'

const GEO_URL = 'https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json'

const COMPETITIVE = new Set([
  'Toss Up', 'Toss-Up', 'Pure Toss-Up',
  'Lean R', 'Lean D', 'Leans R', 'Leans D',
  'Toss-Up R', 'Toss-Up D',
])

function bestRating(races: RaceSummary[]): string | null {
  for (const r of races) {
    const rating = r.cookRating ?? r.sabatoRating ?? r.insideRating
    if (rating && COMPETITIVE.has(rating)) return rating
  }
  return races[0]?.cookRating ?? races[0]?.sabatoRating ?? races[0]?.insideRating ?? null
}

type StateInfo = {
  abbr: string
  senate: boolean
  governor: boolean
  houseCount: number
  totalCandidates: number
  rCount: number
  dCount: number
  topRCash: number | null
  topDCash: number | null
  topRating: string | null
  races: RaceSummary[]
}

function stateColor(info: StateInfo | undefined): string {
  if (!info) return '#E5E7EB'
  if (info.senate && info.governor) return '#1d4ed8'
  if (info.senate) return '#3b82f6'
  if (info.governor) return '#8b5cf6'
  return '#bfdbfe'
}

function stateStroke(info: StateInfo | undefined, hovered: boolean): string {
  if (hovered) return '#1e293b'
  return '#FFFFFF'
}

export default function MapView({ races }: { races: RaceSummary[] }) {
  const [hoveredState, setHoveredState] = useState<string | null>(null)

  const byState = useMemo(() => {
    const map: Record<string, StateInfo> = {}
    for (const race of races) {
      if (!map[race.state]) {
        map[race.state] = {
          abbr: race.state,
          senate: false,
          governor: false,
          houseCount: 0,
          totalCandidates: 0,
          rCount: 0,
          dCount: 0,
          topRCash: null,
          topDCash: null,
          topRating: null,
          races: [],
        }
      }
      const s = map[race.state]
      s.races.push(race)
      s.totalCandidates += race.totalCandidates
      s.rCount += race.rCount
      s.dCount += race.dCount
      if (race.office === 'senate') s.senate = true
      if (race.office === 'governor') s.governor = true
      if (race.office === 'house') s.houseCount++
      if (race.topRCash !== null)
        s.topRCash = Math.max(s.topRCash ?? 0, race.topRCash)
      if (race.topDCash !== null)
        s.topDCash = Math.max(s.topDCash ?? 0, race.topDCash)
    }
    for (const abbr of Object.keys(map)) {
      map[abbr].topRating = bestRating(map[abbr].races)
    }
    return map
  }, [races])

  const selected = hoveredState ? byState[hoveredState] : null

  const hasData = races.length > 0

  return (
    <div className="space-y-4">
      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground items-center">
        <span className="font-medium text-foreground text-sm">Race types:</span>
        {[
          { color: '#1d4ed8', label: 'Senate + Governor' },
          { color: '#3b82f6', label: 'Senate' },
          { color: '#8b5cf6', label: 'Governor' },
          { color: '#bfdbfe', label: 'House only' },
          { color: '#E5E7EB', label: 'No data' },
        ].map(({ color, label }) => (
          <span key={label} className="flex items-center gap-1.5">
            <span
              className="inline-block w-3 h-3 rounded-sm border border-white/50 shadow-sm"
              style={{ background: color }}
            />
            {label}
          </span>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Map */}
        <div className="lg:col-span-2 rounded-xl border bg-slate-50 overflow-hidden">
          {!hasData ? (
            <div className="h-[440px] flex items-center justify-center text-muted-foreground text-sm text-center">
              <div>
                <p className="font-medium">No race data yet</p>
                <p className="mt-1 text-xs">
                  Run{' '}
                  <code className="px-1 py-0.5 bg-muted rounded">
                    npm run ingest:candidates
                  </code>{' '}
                  to populate
                </p>
              </div>
            </div>
          ) : (
            <ComposableMap
              projection="geoAlbersUsa"
              className="w-full h-[440px]"
            >
              <Geographies geography={GEO_URL}>
                {({ geographies }) =>
                  geographies.map(geo => {
                    const abbr = ABBR_BY_STATE_NAME[geo.properties.name]
                    const info = abbr ? byState[abbr] : undefined
                    const hovered = abbr === hoveredState
                    return (
                      <Geography
                        key={geo.rsmKey}
                        geography={geo}
                        fill={stateColor(info)}
                        stroke={stateStroke(info, hovered)}
                        strokeWidth={hovered ? 1.5 : 0.5}
                        style={{
                          default: { outline: 'none', cursor: info ? 'pointer' : 'default' },
                          hover: { outline: 'none' },
                          pressed: { outline: 'none' },
                        }}
                        onMouseEnter={() => abbr && setHoveredState(abbr)}
                        onMouseLeave={() => setHoveredState(null)}
                      />
                    )
                  })
                }
              </Geographies>
            </ComposableMap>
          )}
        </div>

        {/* State panel */}
        <div className="rounded-xl border p-4 min-h-[200px]">
          {!selected ? (
            <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
              {hasData ? 'Hover a state to see details' : 'No data loaded'}
            </div>
          ) : (
            <StatePanel info={selected} />
          )}
        </div>
      </div>

      {/* State grid summary */}
      {hasData && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
          {Object.values(byState)
            .sort((a, b) => a.abbr.localeCompare(b.abbr))
            .map(info => (
              <Link
                key={info.abbr}
                href={`/races?state=${info.abbr}`}
                className="rounded-lg border p-2 text-xs hover:bg-muted/40 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm">{info.abbr}</span>
                  <span className="flex gap-0.5">
                    {info.senate && (
                      <span
                        title="Senate"
                        className="inline-block w-2 h-2 rounded-full bg-blue-500"
                      />
                    )}
                    {info.governor && (
                      <span
                        title="Governor"
                        className="inline-block w-2 h-2 rounded-full bg-purple-500"
                      />
                    )}
                  </span>
                </div>
                <div className="text-muted-foreground mt-0.5">
                  {info.races.length} race{info.races.length !== 1 ? 's' : ''}
                </div>
              </Link>
            ))}
        </div>
      )}
    </div>
  )
}

function StatePanel({ info }: { info: StateInfo }) {
  const rating = info.topRating
  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-xl font-bold">{stateName(info.abbr)}</h2>
        <div className="flex gap-1.5 mt-1 flex-wrap">
          {info.senate && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 font-medium">
              Senate
            </span>
          )}
          {info.governor && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-purple-100 text-purple-800 font-medium">
              Governor
            </span>
          )}
          {info.houseCount > 0 && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
              {info.houseCount} House seat{info.houseCount !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>

      {rating && (
        <div>
          <p className="text-xs text-muted-foreground mb-1">Top rating</p>
          <span
            className={`inline-flex px-2 py-0.5 rounded text-xs font-medium border ${ratingBadgeClass(rating)}`}
          >
            {rating}
          </span>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 text-sm">
        <div>
          <p className="text-xs text-muted-foreground">R candidates</p>
          <p className="font-medium text-red-700">{info.rCount}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">D candidates</p>
          <p className="font-medium text-blue-700">{info.dCount}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Top R cash</p>
          <p className="font-medium font-mono text-xs">{formatCurrency(info.topRCash)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Top D cash</p>
          <p className="font-medium font-mono text-xs">{formatCurrency(info.topDCash)}</p>
        </div>
      </div>

      <div className="space-y-1 pt-1 border-t">
        <p className="text-xs text-muted-foreground font-medium">Races</p>
        {info.races.map(race => (
          <Link
            key={race.id}
            href={`/races/${race.id}`}
            className="flex items-center justify-between text-xs hover:underline py-0.5"
          >
            <span>
              {officeName(race.office)}
              {race.district && ` – ${race.district}`}
              {race.seatClass && ` (Cl.${race.seatClass})`}
            </span>
            <span className="text-muted-foreground">→</span>
          </Link>
        ))}
      </div>
    </div>
  )
}
