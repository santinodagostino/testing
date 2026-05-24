import { getRacesSummary } from '@/lib/queries'
import MapView from './map-view'

export const dynamic = 'force-dynamic'

export default async function MapPage() {
  const races = await getRacesSummary(2026)
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">2026 Race Map</h1>
      <MapView races={races} />
    </div>
  )
}
