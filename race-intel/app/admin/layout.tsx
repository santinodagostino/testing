import Link from 'next/link'

const ADMIN_LINKS = [
  { href: '/admin/considering', label: 'Considering Queue' },
  { href: '/admin/vendors', label: 'Vendors' },
  { href: '/admin/candidates/new', label: 'Add Candidate' },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-8">
      <aside className="w-44 shrink-0 space-y-1 pt-1">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3 px-2">
          Admin
        </p>
        {ADMIN_LINKS.map(({ href, label }) => (
          <Link
            key={href}
            href={href}
            className="block px-2 py-1.5 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
          >
            {label}
          </Link>
        ))}
      </aside>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  )
}
