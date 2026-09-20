/**
 * Summary card for one signal, as listed on the dashboard.
 *
 * Presentational only. It receives an already-validated signal, so everything
 * it renders has had its evidence checked — there is no path by which this
 * component could display an unverified citation.
 */

import Link from 'next/link';
import type { ValidatedSignal } from '@/lib/ai/schemas';
import { CATEGORY_HELP, CONFIDENCE_HELP, SEVERITY_HELP, STATUS_HELP } from '@/components/ui/explanations';
import { Badge, Card, CardBody, SourceId, toneForLevel } from '@/components/ui/primitives';

/** Human-readable labels for the review statuses. */
export const STATUS_LABELS: Record<string, string> = {
  NEW: 'New',
  CONFIRMED: 'Confirmed',
  DISMISSED: 'Dismissed',
  INVESTIGATE: 'Investigating',
};

/** Turns DEPENDENCY into "Dependency", REPEATED_ISSUE into "Repeated issue". */
export function formatCategory(category: string): string {
  const words = category.toLowerCase().replace(/_/g, ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** Badge tone for a review status. Only CONFIRMED and DISMISSED are emphasised. */
function toneForStatus(status: string): 'accent' | 'low' | 'neutral' {
  if (status === 'CONFIRMED') return 'low';
  if (status === 'INVESTIGATE') return 'accent';
  return 'neutral';
}

export function SignalCard({ signal }: { signal: ValidatedSignal }) {
  return (
    <Card>
      <CardBody>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="accent" title={CATEGORY_HELP[signal.category]}>
            {formatCategory(signal.category)}
          </Badge>
          <Badge tone={toneForLevel(signal.severity)} title={SEVERITY_HELP[signal.severity]}>
            {signal.severity} severity
          </Badge>
          <Badge tone="outline" title={CONFIDENCE_HELP[signal.confidence]}>
            {signal.confidence} confidence
          </Badge>
          <Badge tone={toneForStatus(signal.status)} title={STATUS_HELP[signal.status]}>
            {STATUS_LABELS[signal.status] ?? signal.status}
          </Badge>
        </div>

        <h3 className="mt-3 text-sm font-semibold leading-snug">{signal.title}</h3>
        <p className="mt-1.5 text-sm leading-relaxed text-[var(--color-ink-muted)]">
          {signal.description}
        </p>

        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-[var(--color-ink-subtle)]">
            Evidence ({signal.evidence.length}):
          </span>
          {signal.evidence.slice(0, 5).map((evidence) => (
            <SourceId key={evidence.sourceId}>{evidence.sourceId}</SourceId>
          ))}
          {signal.evidence.length > 5 ? (
            <span className="text-xs text-[var(--color-ink-subtle)]">
              +{signal.evidence.length - 5} more
            </span>
          ) : null}
        </div>

        {signal.rejectedEvidence.length > 0 ? (
          <p className="mt-2 text-xs text-[var(--color-severity-medium)]">
            {signal.rejectedEvidence.length === 1
              ? '1 cited record could not be verified against this project and is not shown.'
              : `${signal.rejectedEvidence.length} cited records could not be verified against this project and are not shown.`}
          </p>
        ) : null}

        <div className="mt-4">
          <Link
            href={`/signals/${signal.id}`}
            className="inline-flex items-center rounded-lg border border-[var(--color-border-strong)] px-3 py-1.5 text-sm font-medium"
          >
            View signal
          </Link>
        </div>
      </CardBody>
    </Card>
  );
}
