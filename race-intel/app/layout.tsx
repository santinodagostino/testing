import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Race Intel",
  description: "Federal race intelligence for political vendors",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-background font-sans antialiased">
        <header className="border-b bg-white sticky top-0 z-50">
          <div className="max-w-screen-2xl mx-auto px-6 h-14 flex items-center gap-8">
            <Link href="/map" className="font-bold text-lg tracking-tight text-primary">
              Race Intel
            </Link>
            <nav className="flex items-center gap-6 text-sm font-medium">
              <Link href="/map" className="text-muted-foreground hover:text-foreground transition-colors">
                Map
              </Link>
              <Link href="/races" className="text-muted-foreground hover:text-foreground transition-colors">
                Races
              </Link>
              <Link href="/admin/considering" className="text-muted-foreground hover:text-foreground transition-colors">
                Admin
              </Link>
            </nav>
          </div>
        </header>
        <main className="max-w-screen-2xl mx-auto px-6 py-6">
          {children}
        </main>
      </body>
    </html>
  );
}
