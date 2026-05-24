import { STATE_NAMES } from '@/lib/format'
import { createManualCandidate } from './actions'
import Link from 'next/link'

export default function NewCandidatePage() {
  const states = Object.entries(STATE_NAMES).sort(([, a], [, b]) =>
    a.localeCompare(b)
  )

  return (
    <div className="max-w-lg space-y-6">
      <div>
        <div className="text-sm text-muted-foreground mb-1">
          <Link href="/races" className="hover:underline">
            Races
          </Link>{' '}
          / Add Candidate
        </div>
        <h1 className="text-2xl font-bold">Add Candidate Manually</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          For governor races, special elections, or any candidate not in FEC data.
        </p>
      </div>

      <form action={createManualCandidate} className="space-y-5">
        <div className="grid grid-cols-2 gap-4">
          {/* Office */}
          <div className="space-y-1.5">
            <label htmlFor="office" className="text-sm font-medium">
              Office <span className="text-destructive">*</span>
            </label>
            <select
              id="office"
              name="office"
              required
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="">Select…</option>
              <option value="governor">Governor</option>
              <option value="senate">Senate</option>
              <option value="house">House</option>
            </select>
          </div>

          {/* State */}
          <div className="space-y-1.5">
            <label htmlFor="state" className="text-sm font-medium">
              State <span className="text-destructive">*</span>
            </label>
            <select
              id="state"
              name="state"
              required
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="">Select…</option>
              {states.map(([abbr, name]) => (
                <option key={abbr} value={abbr}>
                  {name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Full name */}
        <div className="space-y-1.5">
          <label htmlFor="fullName" className="text-sm font-medium">
            Full Name <span className="text-destructive">*</span>
          </label>
          <input
            id="fullName"
            name="fullName"
            type="text"
            required
            placeholder="e.g. Jane Smith"
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          {/* Party */}
          <div className="space-y-1.5">
            <label htmlFor="party" className="text-sm font-medium">
              Party <span className="text-destructive">*</span>
            </label>
            <select
              id="party"
              name="party"
              required
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="">Select…</option>
              <option value="R">Republican (R)</option>
              <option value="D">Democrat (D)</option>
              <option value="I">Independent (I)</option>
              <option value="L">Libertarian (L)</option>
              <option value="G">Green (G)</option>
            </select>
          </div>

          {/* Status */}
          <div className="space-y-1.5">
            <label htmlFor="status" className="text-sm font-medium">
              Status
            </label>
            <select
              id="status"
              name="status"
              defaultValue="declared"
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="declared">Declared</option>
              <option value="incumbent">Incumbent</option>
              <option value="considering">Considering</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {/* District (House only) */}
          <div className="space-y-1.5">
            <label htmlFor="district" className="text-sm font-medium">
              District{' '}
              <span className="text-muted-foreground font-normal text-xs">(House only)</span>
            </label>
            <input
              id="district"
              name="district"
              type="text"
              placeholder="e.g. 3"
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>

          {/* Seat class (Senate only) */}
          <div className="space-y-1.5">
            <label htmlFor="seatClass" className="text-sm font-medium">
              Seat Class{' '}
              <span className="text-muted-foreground font-normal text-xs">(Senate only)</span>
            </label>
            <select
              id="seatClass"
              name="seatClass"
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="">—</option>
              <option value="I">Class I</option>
              <option value="II">Class II</option>
              <option value="III">Class III</option>
            </select>
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            className="inline-flex items-center justify-center rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium shadow hover:bg-primary/90 transition-colors"
          >
            Add Candidate
          </button>
          <Link
            href="/races"
            className="inline-flex items-center justify-center rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted transition-colors"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  )
}
