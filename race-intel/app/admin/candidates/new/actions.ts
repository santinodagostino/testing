'use server'

import { db } from '@/db'
import { races, candidates } from '@/db/schema'
import { eq, and, isNull } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

export async function createManualCandidate(formData: FormData) {
  const office = formData.get('office') as 'senate' | 'house' | 'governor'
  const state = (formData.get('state') as string)?.toUpperCase().trim()
  const district = (formData.get('district') as string)?.trim() || null
  const fullName = (formData.get('fullName') as string)?.trim()
  const party = (formData.get('party') as string)?.toUpperCase().trim()
  const status =
    (formData.get('status') as 'declared' | 'considering' | 'incumbent') ?? 'declared'
  const seatClass = (formData.get('seatClass') as string)?.trim() || null

  if (!office || !state || !fullName || !party) {
    throw new Error('Missing required fields')
  }

  // Find or create the race
  const districtCondition = district
    ? eq(races.district, district)
    : isNull(races.district)

  const existing = await db
    .select({ id: races.id })
    .from(races)
    .where(
      and(eq(races.cycle, 2026), eq(races.office, office), eq(races.state, state), districtCondition)
    )
    .limit(1)

  let raceId: string

  if (existing.length > 0) {
    raceId = existing[0].id
  } else {
    const [newRace] = await db
      .insert(races)
      .values({ cycle: 2026, office, state, district, seatClass })
      .returning({ id: races.id })
    raceId = newRace.id
  }

  await db.insert(candidates).values({
    fullName,
    party,
    state,
    office,
    district,
    raceId,
    status,
    source: 'manual',
  })

  revalidatePath('/races')
  redirect('/races')
}
