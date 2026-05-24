# Race Intel

Political race intelligence platform for federal and governor races (2026 cycle). Built for vendor prospecting at political digital agencies, mail shops, polling firms, and consultants.

---

## Setup (copy-paste, top to bottom)

### Prerequisites
- Node.js 18+
- A [Neon](https://neon.tech) free-tier PostgreSQL project
- API keys for FEC (`api.data.gov`), Congress.gov (`api.congress.gov/sign-up`), and Anthropic (`console.anthropic.com`)

### 1. Clone and install

```bash
git clone <your-repo-url>
cd race-intel
npm install
```

### 2. Configure environment

```bash
cp .env.example .env.local
```

Open `.env.local` and fill in your values:

```
FEC_API_KEY=your_api_data_gov_key
CONGRESS_API_KEY=your_congress_api_key
ANTHROPIC_API_KEY=your_anthropic_api_key
DATABASE_URL=postgresql://user:pass@host/dbname?sslmode=require
```

### 3. Create the database schema

```bash
npm run db:migrate
```

### 4. Seed reference data

```bash
npm run seed:vendors    # loads 75 known political vendors
npm run seed:sources    # loads 31 news sources for the considering pipeline
```

### 5. Ingest federal candidates and incumbents

Run these in order (each takes a few minutes):

```bash
npm run ingest:candidates     # all 2026 Senate + House candidates from FEC
npm run ingest:congress       # current incumbents from Congress.gov
npm run ingest:financials     # cash on hand + totals per committee
npm run ingest:disbursements  # Schedule B (vendor intelligence goldmine)
```

### 6. Start the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Build phases

| Phase | Description | Status |
|---|---|---|
| 0 | Scaffold: Next.js + DB + UI shell | Done |
| 1 | Federal candidate ingestion | Scripts ready — run locally |
| 2 | Vendor team intelligence | Pending |
| 3 | Race ratings (Cook/Sabato/Inside) | Pending |
| 4 | Governor race coverage | Pending |
| 5 | Map + list views | Pending |
| 6 | Race detail page | Pending |
| 7 | Considering pipeline (LLM) | Pending |
| 8 | Polish + demo data | Pending |

---

## Key URLs (local dev)

| URL | Description |
|---|---|
| `/map` | US map — click state to race list |
| `/races` | Filterable race list + CSV export |
| `/races/[id]` | Race detail page |
| `/admin/considering` | LLM extraction review queue |
| `/admin/vendors` | Known vendors CRUD + unmatched queue |
| `/admin/candidates/new` | Manual candidate entry (governors) |

---

## Data sources

| Source | What it provides | Key |
|---|---|---|
| FEC API (`api.open.fec.gov`) | Candidates, financials, Schedule B | `FEC_API_KEY` from api.data.gov |
| Congress.gov API | Current Senators + Representatives | `CONGRESS_API_KEY` |
| Wikidata SPARQL | Sitting Governors | None required |
| Cook / Sabato / Inside Elections | Race ratings (scraped weekly) | None |
| 31 RSS/HTML news sources | Considering candidate signals | None |

---

## Vendor matching notes

- **WinRed** and **Anedot** are flagged as `platform_processor` and will NOT appear as a candidate's "fundraising firm" in the vendor team view.
- Short aliases like `TAG`, `NFS`, `POS`, `SMS` are match-restricted to full-string only to prevent false positives.
- Unmatched payees over $10K/cycle are flagged at `/admin/vendors` for manual enrichment.

---

## Budget notes

- Neon free tier: 0.5 GB storage, 1 compute unit — sufficient for prototype
- Vercel hobby: free
- Anthropic: Haiku for bulk extraction (~$0.25/1M tokens). Expect under $20/month at prototype scale.
- FEC API: free, rate-limited. Scripts use p-queue at 2 req/sec.
