'use server'

import { db } from '@/db'
import { consideringCandidates } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'

export async function reviewConsideringCandidate(
  id: string,
  status: 'published' | 'rejected',
  notes?: string
) {
  await db
    .update(consideringCandidates)
    .set({ status, reviewerNotes: notes?.trim() || null })
    .where(eq(consideringCandidates.id, id))

  revalidatePath('/admin/considering')
}
