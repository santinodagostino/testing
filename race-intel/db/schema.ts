import { pgTable, text, integer, decimal, boolean, timestamp, pgEnum, uuid, varchar } from 'drizzle-orm/pg-core'

export const officeEnum = pgEnum('office', ['senate', 'house', 'governor'])
export const candidateStatusEnum = pgEnum('candidate_status', ['declared', 'considering', 'withdrawn', 'incumbent'])
export const sourceEnum = pgEnum('source', ['fec', 'manual', 'scrape'])
export const sideEnum = pgEnum('side', ['R', 'D', 'bipartisan', 'unknown'])
export const raterEnum = pgEnum('rater', ['cook', 'sabato', 'inside', '270towin'])
export const consideringStatusEnum = pgEnum('considering_status', ['pending_review', 'published', 'rejected'])
export const sourceTypeEnum = pgEnum('source_type', ['rss', 'html', 'api'])
export const vendorCategoryEnum = pgEnum('vendor_category', [
  'digital', 'mail', 'polling', 'general_consulting', 'comms',
  'fundraising', 'tv_production', 'research', 'compliance', 'legal',
  'media_buying', 'data', 'field', 'platform_processor'
])

export const races = pgTable('races', {
  id: uuid('id').primaryKey().defaultRandom(),
  cycle: integer('cycle').notNull(),
  office: officeEnum('office').notNull(),
  state: varchar('state', { length: 2 }).notNull(),
  district: varchar('district', { length: 10 }),
  seatClass: varchar('seat_class', { length: 5 }),
  incumbentCandidateId: uuid('incumbent_candidate_id'),
  isOpenSeat: boolean('is_open_seat').default(false),
  primaryDate: timestamp('primary_date'),
  generalDate: timestamp('general_date'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
})

export const candidates = pgTable('candidates', {
  id: uuid('id').primaryKey().defaultRandom(),
  fecId: varchar('fec_id', { length: 20 }).unique(),
  fullName: text('full_name').notNull(),
  party: varchar('party', { length: 10 }),
  state: varchar('state', { length: 2 }).notNull(),
  office: officeEnum('office').notNull(),
  district: varchar('district', { length: 10 }),
  raceId: uuid('race_id').references(() => races.id),
  status: candidateStatusEnum('status').notNull().default('declared'),
  photoUrl: text('photo_url'),
  bioguideId: varchar('bioguide_id', { length: 20 }).unique(),
  source: sourceEnum('source').notNull().default('fec'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
})

export const committees = pgTable('committees', {
  id: uuid('id').primaryKey().defaultRandom(),
  fecId: varchar('fec_id', { length: 20 }).notNull().unique(),
  candidateId: uuid('candidate_id').references(() => candidates.id),
  committeeType: varchar('committee_type', { length: 10 }),
  treasurerName: text('treasurer_name'),
  address: text('address'),
  phone: varchar('phone', { length: 30 }),
  emailPublic: text('email_public'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
})

export const financials = pgTable('financials', {
  id: uuid('id').primaryKey().defaultRandom(),
  committeeId: uuid('committee_id').references(() => committees.id),
  reportPeriodEnd: timestamp('report_period_end'),
  cashOnHand: decimal('cash_on_hand', { precision: 15, scale: 2 }),
  totalReceipts: decimal('total_receipts', { precision: 15, scale: 2 }),
  totalDisbursements: decimal('total_disbursements', { precision: 15, scale: 2 }),
  burnRate: decimal('burn_rate', { precision: 8, scale: 4 }),
  debt: decimal('debt', { precision: 15, scale: 2 }),
  createdAt: timestamp('created_at').defaultNow(),
})

export const disbursements = pgTable('disbursements', {
  id: uuid('id').primaryKey().defaultRandom(),
  committeeId: uuid('committee_id').references(() => committees.id),
  payeeName: text('payee_name').notNull(),
  amount: decimal('amount', { precision: 15, scale: 2 }).notNull(),
  date: timestamp('date'),
  purpose: text('purpose'),
  category: vendorCategoryEnum('category'),
  vendorId: uuid('vendor_id'),
  createdAt: timestamp('created_at').defaultNow(),
})

export const knownVendors = pgTable('known_vendors', {
  id: uuid('id').primaryKey().defaultRandom(),
  canonicalName: text('canonical_name').notNull().unique(),
  aliases: text('aliases').array(),
  category: vendorCategoryEnum('category').notNull(),
  side: sideEnum('side').notNull().default('unknown'),
  isPlatformProcessor: boolean('is_platform_processor').default(false),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow(),
})

export const candidateVendors = pgTable('candidate_vendors', {
  id: uuid('id').primaryKey().defaultRandom(),
  candidateId: uuid('candidate_id').references(() => candidates.id),
  vendorId: uuid('vendor_id').references(() => knownVendors.id),
  category: vendorCategoryEnum('category').notNull(),
  totalSpentCycle: decimal('total_spent_cycle', { precision: 15, scale: 2 }),
  firstPayment: timestamp('first_payment'),
  lastPayment: timestamp('last_payment'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
})

export const raceRatings = pgTable('race_ratings', {
  id: uuid('id').primaryKey().defaultRandom(),
  raceId: uuid('race_id').references(() => races.id),
  rater: raterEnum('rater').notNull(),
  rating: varchar('rating', { length: 50 }).notNull(),
  capturedAt: timestamp('captured_at').defaultNow(),
})

export const consideringCandidates = pgTable('considering_candidates', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  office: officeEnum('office').notNull(),
  state: varchar('state', { length: 2 }).notNull(),
  district: varchar('district', { length: 10 }),
  signalStrength: integer('signal_strength').notNull(),
  quote: text('quote'),
  sourceUrl: text('source_url'),
  sourcePublication: text('source_publication'),
  extractedAt: timestamp('extracted_at').defaultNow(),
  status: consideringStatusEnum('status').notNull().default('pending_review'),
  reviewerNotes: text('reviewer_notes'),
  raceId: uuid('race_id').references(() => races.id),
})

export const staffMentions = pgTable('staff_mentions', {
  id: uuid('id').primaryKey().defaultRandom(),
  candidateId: uuid('candidate_id').references(() => candidates.id),
  personName: text('person_name').notNull(),
  role: text('role'),
  sourceUrl: text('source_url'),
  extractedAt: timestamp('extracted_at').defaultNow(),
  status: varchar('status', { length: 20 }).default('pending'),
})

export const sources = pgTable('sources', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  type: sourceTypeEnum('type').notNull(),
  url: text('url').notNull().unique(),
  lastPolled: timestamp('last_polled'),
  pollingCadenceHours: integer('polling_cadence_hours').default(24),
  category: varchar('category', { length: 30 }),
  state: varchar('state', { length: 2 }),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow(),
})

export const ingestedArticles = pgTable('ingested_articles', {
  id: uuid('id').primaryKey().defaultRandom(),
  sourceId: uuid('source_id').references(() => sources.id),
  url: text('url').notNull().unique(),
  title: text('title'),
  bodyText: text('body_text'),
  publishedAt: timestamp('published_at'),
  fetchedAt: timestamp('fetched_at').defaultNow(),
  processedAt: timestamp('processed_at'),
})
