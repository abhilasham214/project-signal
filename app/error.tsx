'use client';

/**
 * Route-level error boundary.
 *
 * Shows a plain message and a retry. why no stack trace or error text: the
 * underlying message may contain internal detail, and a construction manager
 * can do nothing useful with it. The real error is logged server-side with the
 * [project-signal] prefix.
 */

import { Button, Card, CardBody } from '@/components/ui/primitives';

export default function ErrorBoundary({ reset }: { error: Error; reset: () => void }) {
  return (
    <Card>
      <CardBody>
        <h1 className="text-lg font-semibold tracking-tight">Something went wrong</h1>
        <p className="mt-2 text-sm leading-relaxed text-[var(--color-ink-muted)]">
          This page could not be displayed. No project information has been changed.
        </p>
        <div className="mt-4">
          <Button variant="primary" onClick={reset}>
            Try again
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}
