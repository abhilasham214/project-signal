/** Shown for an unknown project id, an unknown signal id, or a bad URL. */

import Link from 'next/link';
import { Card, CardBody } from '@/components/ui/primitives';

export default function NotFound() {
  return (
    <Card>
      <CardBody>
        <h1 className="text-lg font-semibold tracking-tight">Not found</h1>
        <p className="mt-2 text-sm leading-relaxed text-[var(--color-ink-muted)]">
          That page could not be found. If you followed a link to a signal, the analysis it belonged
          to may have been replaced by a more recent run.
        </p>
        <div className="mt-4 flex gap-3">
          <Link
            href="/projects"
            className="inline-flex items-center rounded-lg border border-[var(--color-border-strong)] px-3 py-1.5 text-sm font-medium"
          >
            Back to projects
          </Link>
        </div>
      </CardBody>
    </Card>
  );
}
