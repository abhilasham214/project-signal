/** Root layout: header, page frame and the standing synthetic-data footer. */

import type { Metadata } from 'next';
import { SiteHeader } from '@/components/ui/site-header';
import './globals.css';

export const metadata: Metadata = {
  title: 'Project Signal',
  description: 'AI-Assisted Construction Project Intelligence — internal prototype',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        <SiteHeader />
        <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
        <footer className="mx-auto max-w-6xl px-4 pb-10 pt-4">
          <p className="border-t border-[var(--color-border)] pt-4 text-xs text-[var(--color-ink-subtle)]">
            Project Signal is an internal prototype. All project information shown is synthetic. AI
            outputs are suggestions for human review, not project decisions.
          </p>
        </footer>
      </body>
    </html>
  );
}
