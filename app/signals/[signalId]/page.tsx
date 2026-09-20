/**
 * Signal detail page.
 *
 * The page is split into two visually distinct halves, and the split is the
 * point of the product:
 *
 *   AI SIGNAL    — what the assistant proposed, and the verified records it
 *                  rests on. Read-only.
 *   HUMAN REVIEW — what a person decides about it. The only mutable part.
 *
 * Evidence shown here is read from the dataset by id, not taken from the model
 * output. If the assistant described a record inaccurately, what appears below
 * is still the record actual content.
 */

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getSignal } from '@/lib/store';
import { getProject } from '@/lib/projects';
import { ReviewPanel } from '@/components/signals/review-panel';
import { STATUS_LABELS, formatCategory } from '@/components/signals/signal-card';
import {
  Badge,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  Notice,
  SectionLabel,
  SourceId,
  toneForLevel,
} from '@/components/ui/primitives';

/** Formats an ISO date as e.g. "04 Jun 2026". */
function formatDate(isoDate: string): string {
  return new Date(`${isoDate}T00:00:00Z`).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export default async function SignalDetailPage({
  params,
}: {
  params: Promise<{ signalId: string }>;
}) {
  const { signalId } = await params;

  const found = await getSignal(signalId);
  // why 404 rather than an error: an unknown signal id means the store has no
  // such signal — typically a stale link, or a run that was replaced.
  if (!found) notFound();

  const { signal, review } = found;
  const project = getProject(signal.projectId);

  return (
    <div className="space-y-8">
      <div>
        <Link
          href={`/dashboard/${signal.projectId}`}
          className="text-sm text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]"
        >
          ← {project ? project.name : signal.projectId}
        </Link>
      </div>

      {/* ------------------------------------------------------- AI SIGNAL */}
      <section>
        <SectionLabel>AI signal</SectionLabel>

        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Badge tone="accent">{formatCategory(signal.category)}</Badge>
          <Badge tone={toneForLevel(signal.severity)}>{signal.severity} severity</Badge>
          <Badge tone="outline">{signal.confidence} confidence</Badge>
          <Badge tone={signal.status === 'NEW' ? 'neutral' : 'accent'}>
            {STATUS_LABELS[signal.status] ?? signal.status}
          </Badge>
        </div>

        <h1 className="mt-3 text-xl font-semibold leading-snug tracking-tight">{signal.title}</h1>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>What the records show</CardTitle>
            </CardHeader>
            <CardBody>
              <p className="text-sm leading-relaxed text-[var(--color-ink-muted)]">
                {signal.description}
              </p>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Why this was surfaced</CardTitle>
            </CardHeader>
            <CardBody>
              <p className="text-sm leading-relaxed text-[var(--color-ink-muted)]">
                {signal.reason}
              </p>
            </CardBody>
          </Card>
        </div>

        <div className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Recommended review</CardTitle>
            </CardHeader>
            <CardBody>
              <p className="text-sm leading-relaxed text-[var(--color-ink-muted)]">
                {signal.recommendedReview}
              </p>
              <p className="mt-3 text-xs text-[var(--color-ink-subtle)]">
                This is a suggestion for a human to consider. No action has been taken, and nothing
                in this project has been changed.
              </p>
            </CardBody>
          </Card>
        </div>
      </section>

      {/* -------------------------------------------------------- EVIDENCE */}
      <section>
        <SectionLabel>Supporting evidence</SectionLabel>
        <p className="mt-1 text-xs text-[var(--color-ink-subtle)]">
          {signal.evidence.length} record{signal.evidence.length === 1 ? '' : 's'} from{' '}
          {signal.projectId}, verified against the project and shown with their original content.
        </p>

        <div className="mt-3 grid gap-3">
          {signal.evidence.map((evidence) => (
            <Card key={evidence.sourceId}>
              <CardBody>
                <div className="flex flex-wrap items-center gap-2">
                  <SourceId>{evidence.sourceId}</SourceId>
                  {evidence.date ? (
                    <span className="text-xs tabular-nums text-[var(--color-ink-subtle)]">
                      {formatDate(evidence.date)}
                    </span>
                  ) : null}
                  <span className="text-xs text-[var(--color-ink-subtle)]">{evidence.kindLabel}</span>
                </div>

                <h3 className="mt-2 text-sm font-semibold leading-snug">{evidence.title}</h3>

                {evidence.participants.length > 0 ? (
                  <p className="mt-1 text-xs text-[var(--color-ink-subtle)]">
                    {evidence.participants.join(' · ')}
                  </p>
                ) : null}

                <p className="mt-2 text-sm leading-relaxed text-[var(--color-ink-muted)]">
                  {evidence.content}
                </p>
              </CardBody>
            </Card>
          ))}
        </div>

        {signal.rejectedEvidence.length > 0 ? (
          <div className="mt-3">
            <Notice tone="warning" title="Rejected citations">
              <p>
                The assistant also cited{' '}
                {signal.rejectedEvidence.map((rejected) => rejected.sourceId).join(', ')}. These
                could not be verified against {signal.projectId} and were rejected, so their content
                is not shown.
              </p>
            </Notice>
          </div>
        ) : null}
      </section>

      {/* ----------------------------------------------------- HUMAN REVIEW */}
      <section>
        <div className="rounded-xl border-2 border-dashed border-[var(--color-border-strong)] p-5">
          <SectionLabel>Human review</SectionLabel>
          <p className="mt-1 text-xs text-[var(--color-ink-subtle)]">
            The assistant cannot set this. The decision and the note below are yours.
          </p>

          <div className="mt-4">
            <ReviewPanel
              signalId={signal.id}
              currentStatus={signal.status}
              existingReview={review}
            />
          </div>
        </div>
      </section>
    </div>
  );
}
