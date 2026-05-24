/**
 * Seed 2026 competitive race ratings from Cook Political Report.
 * Source: https://www.cookpolitical.com/ratings/senate-race-ratings
 * Last updated: May 2026
 *
 * Usage: npx tsx scripts/seed-race-ratings.ts
 */
import 'dotenv/config'
import { db } from '../db'
import { races, raceRatings } from '../db/schema'
import { eq, and, isNull } from 'drizzle-orm'

// Cook Political Report 2026 ratings (Senate + Governor)
// Format: [state, office, district?, cook_rating, sabato_rating?]
const RATINGS: Array<{
  state: string
  office: 'senate' | 'house' | 'governor'
  district?: string
  cook: string
  sabato?: string
}> = [
  // Senate — competitive races
  { state: 'AK', office: 'senate', cook: 'Likely R',           sabato: 'Likely Republican' },
  { state: 'AL', office: 'senate', cook: 'Solid R' },
  { state: 'AR', office: 'senate', cook: 'Solid R' },
  { state: 'CO', office: 'senate', cook: 'Likely D',           sabato: 'Likely Democrat' },
  { state: 'GA', office: 'senate', cook: 'Toss Up',            sabato: 'Toss-Up' },
  { state: 'IA', office: 'senate', cook: 'Solid R' },
  { state: 'ID', office: 'senate', cook: 'Solid R' },
  { state: 'IL', office: 'senate', cook: 'Solid D' },
  { state: 'KS', office: 'senate', cook: 'Solid R' },
  { state: 'KY', office: 'senate', cook: 'Solid R' },
  { state: 'LA', office: 'senate', cook: 'Solid R' },
  { state: 'ME', office: 'senate', cook: 'Likely D',           sabato: 'Likely Democrat' },
  { state: 'MI', office: 'senate', cook: 'Toss Up',            sabato: 'Toss-Up' },
  { state: 'MN', office: 'senate', cook: 'Likely D',           sabato: 'Likely Democrat' },
  { state: 'MS', office: 'senate', cook: 'Solid R' },
  { state: 'MT', office: 'senate', cook: 'Toss Up',            sabato: 'Leans Republican' },
  { state: 'NC', office: 'senate', cook: 'Toss Up',            sabato: 'Toss-Up' },
  { state: 'NE', office: 'senate', cook: 'Solid R' },
  { state: 'NH', office: 'senate', cook: 'Toss Up',            sabato: 'Toss-Up' },
  { state: 'NJ', office: 'senate', cook: 'Likely D',           sabato: 'Leans Democrat' },
  { state: 'NM', office: 'senate', cook: 'Likely D' },
  { state: 'OK', office: 'senate', cook: 'Solid R' },
  { state: 'OR', office: 'senate', cook: 'Likely D' },
  { state: 'RI', office: 'senate', cook: 'Solid D' },
  { state: 'SC', office: 'senate', cook: 'Solid R' },
  { state: 'SD', office: 'senate', cook: 'Solid R' },
  { state: 'TN', office: 'senate', cook: 'Solid R' },
  { state: 'TX', office: 'senate', cook: 'Likely R',           sabato: 'Likely Republican' },
  { state: 'VA', office: 'senate', cook: 'Likely D',           sabato: 'Likely Democrat' },
  { state: 'WV', office: 'senate', cook: 'Lean R',             sabato: 'Leans Republican' },
  { state: 'WY', office: 'senate', cook: 'Solid R' },
  // Governor — competitive races
  { state: 'FL', office: 'governor', cook: 'Likely R' },
  { state: 'GA', office: 'governor', cook: 'Likely R' },
  { state: 'IL', office: 'governor', cook: 'Likely D' },
  { state: 'MD', office: 'governor', cook: 'Likely D' },
  { state: 'MA', office: 'governor', cook: 'Likely D' },
  { state: 'MI', office: 'governor', cook: 'Toss Up',          sabato: 'Toss-Up' },
  { state: 'MN', office: 'governor', cook: 'Lean D' },
  { state: 'NV', office: 'governor', cook: 'Toss Up',          sabato: 'Toss-Up' },
  { state: 'NH', office: 'governor', cook: 'Toss Up',          sabato: 'Toss-Up' },
  { state: 'NY', office: 'governor', cook: 'Solid D' },
  { state: 'OH', office: 'governor', cook: 'Lean R',           sabato: 'Leans Republican' },
  { state: 'OR', office: 'governor', cook: 'Likely D' },
  { state: 'PA', office: 'governor', cook: 'Toss Up',          sabato: 'Toss-Up' },
  { state: 'TX', office: 'governor', cook: 'Likely R' },
  { state: 'WI', office: 'governor', cook: 'Toss Up',          sabato: 'Toss-Up' },
]

async function run() {
  let seeded = 0

  for (const r of RATINGS) {
    const race = await db.query.races.findFirst({
      where: and(
        eq(races.cycle, 2026),
        eq(races.office, r.office),
        eq(races.state, r.state),
        r.district ? eq(races.district, r.district) : isNull(races.district),
      ),
    })

    if (!race) {
      console.log(`No race found for ${r.state} ${r.office}`)
      continue
    }

    await db.insert(raceRatings).values({ raceId: race.id, rater: 'cook', rating: r.cook }).onConflictDoNothing()
    seeded++

    if (r.sabato) {
      await db.insert(raceRatings).values({ raceId: race.id, rater: 'sabato', rating: r.sabato }).onConflictDoNothing()
      seeded++
    }
  }

  console.log(`Seeded ${seeded} ratings for ${RATINGS.length} races`)
}

run().catch(console.error)
