import { getRacesSummary } from '@/lib/queries'
import RacesClient from './races-client'

export const dynamic = 'force-dynamic'

export default async function RacesPage({
  searchParams,
}: {
  searchParams: { state?: string; office?: string }
}) {
  const races = await getRacesSummary(2026)
  return (
    <RacesClient
      races={races}
      initialState={searchParams.state}
      initialOffice={searchParams.office}
    />
  )
}
