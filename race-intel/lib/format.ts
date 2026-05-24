export function formatCurrency(amount: number | null): string {
  if (amount === null || amount === 0) return '—'
  if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(1)}M`
  if (amount >= 1_000) return `$${Math.round(amount / 1_000)}K`
  return `$${Math.round(amount)}`
}

export function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function officeName(office: string): string {
  const map: Record<string, string> = {
    senate: 'Senate',
    house: 'House',
    governor: 'Governor',
  }
  return map[office] ?? office
}

export function statusLabel(status: string): string {
  const map: Record<string, string> = {
    incumbent: 'Incumbent',
    declared: 'Declared',
    considering: 'Considering',
    withdrawn: 'Withdrawn',
  }
  return map[status] ?? status
}

export const STATE_NAMES: Record<string, string> = {
  AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California',
  CO: 'Colorado', CT: 'Connecticut', DE: 'Delaware', DC: 'D.C.', FL: 'Florida',
  GA: 'Georgia', HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois', IN: 'Indiana',
  IA: 'Iowa', KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine',
  MD: 'Maryland', MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota',
  MS: 'Mississippi', MO: 'Missouri', MT: 'Montana', NE: 'Nebraska', NV: 'Nevada',
  NH: 'New Hampshire', NJ: 'New Jersey', NM: 'New Mexico', NY: 'New York',
  NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio', OK: 'Oklahoma',
  OR: 'Oregon', PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina',
  SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont',
  VA: 'Virginia', WA: 'Washington', WV: 'West Virginia', WI: 'Wisconsin',
  WY: 'Wyoming',
}

export const ABBR_BY_STATE_NAME: Record<string, string> = Object.fromEntries(
  Object.entries(STATE_NAMES).map(([abbr, name]) => [name, abbr])
)

export function stateName(abbr: string): string {
  return STATE_NAMES[abbr] ?? abbr
}

const COMPETITIVE_RATINGS = new Set([
  'Toss Up', 'Toss-Up', 'Pure Toss-Up',
  'Lean R', 'Lean D', 'Leans R', 'Leans D',
  'Toss-Up R', 'Toss-Up D',
])

const LIKELY_RATINGS = new Set(['Likely R', 'Likely D'])

export function ratingTier(rating: string | null): 'competitive' | 'likely' | 'solid' | null {
  if (!rating) return null
  if (COMPETITIVE_RATINGS.has(rating)) return 'competitive'
  if (LIKELY_RATINGS.has(rating)) return 'likely'
  return 'solid'
}

export function ratingBadgeClass(rating: string | null): string {
  const tier = ratingTier(rating)
  if (tier === 'competitive') return 'bg-yellow-100 text-yellow-800 border-yellow-200'
  if (tier === 'likely') return 'bg-sky-50 text-sky-700 border-sky-100'
  return 'bg-muted text-muted-foreground border-border'
}

export function partyBadgeClass(party: string | null): string {
  if (party === 'R') return 'bg-red-100 text-red-800'
  if (party === 'D') return 'bg-blue-100 text-blue-800'
  return 'bg-gray-100 text-gray-700'
}

export const PRIORITY_VENDOR_CATEGORIES = [
  'digital', 'mail', 'polling', 'media_buying', 'general_consulting',
  'fundraising', 'tv_production', 'comms', 'data', 'field',
]

export const VENDOR_CATEGORY_LABELS: Record<string, string> = {
  digital: 'Digital',
  mail: 'Mail',
  polling: 'Polling',
  general_consulting: 'Consulting',
  comms: 'Comms',
  fundraising: 'Fundraising',
  tv_production: 'TV Production',
  research: 'Research',
  compliance: 'Compliance',
  legal: 'Legal',
  media_buying: 'Media Buying',
  data: 'Data',
  field: 'Field',
  platform_processor: 'Platform',
}

export function vendorCategoryLabel(category: string): string {
  return VENDOR_CATEGORY_LABELS[category] ?? category
}

export function raterLabel(rater: string): string {
  const map: Record<string, string> = {
    cook: 'Cook',
    sabato: "Sabato's Crystal Ball",
    inside: 'Inside Elections',
    '270towin': '270toWin',
  }
  return map[rater] ?? rater
}
