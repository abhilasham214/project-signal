'use client';

/**
 * The evaluation page's human-review filter and per-project breakdown.
 *
 * Each AI signal listed here carries its review status as a tag, and the tabs
 * at the top narrow every project to signals with a chosen human decision
 * (Confirmed, Investigating, Dismissed, Not reviewed).
 *
 * Two kinds of entry are deliberately NOT filterable by status, and are hidden
 * while a status filter is active:
 *
 *   - Missed expected signals: no AI signal exists, so there is nothing a
 *     person could have reviewed.
 *   - Expected absences: they describe topics the AI correctly did not raise.
 *
 * The page says so when it hides them, so a shorter list is never a mystery.
 *
 * Filtering is display only. It changes no score and no review.
 */

import Link from 'next/link';
import { useState } from 'react';
import type { ProjectEvaluation } from '@/lib/evaluation/match';
import type { ValidatedSignal } from '@/lib/ai/schemas';
import { STATUS_LABELS, formatCategory } from '@/components/signals/signal-card';
import {
  CATEGORY_HELP,
  EVALUATION_HELP,
  STATUS_HELP,
} from '@/components/ui/explanations';
import {
  Badge,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  Notice,
  SectionLabel,
  SourceId,
  Tooltip,
  cx,
} from '@/components/ui/primitives';

/** Sentinel for "no status filter". */
const ALL = 'ALL';

/** Filter order. NEW is presented as "Not reviewed", which is what it means. */
const FILTERS = ['CONFIRMED', 'INVESTIGATE', 'DISMISSED', 'NEW'] as const;

/** Tab label for a status filter. */
function labelForFilter(value: string): string {
  if (value === 'NEW') return 'Not reviewed';
  return STATUS_LABELS[value] ?? value;
}

/** Badge tone for a review status. */
function toneForStatus(status: string): 'low' | 'accent' | 'high' | 'neutral' {
  if (status === 'CONFIRMED') return 'low';
  if (status === 'INVESTIGATE') return 'accent';
  if (status === 'DISMISSED') return 'high';
  return 'neutral';
}

/** The review-status tag shown beside each AI signal. */
function StatusTag({ status }: { status: string }) {
  return (
    <Badge tone={toneForStatus(status)} title={STATUS_HELP[status]}>
      {labelForFilter(status)}
    </Badge>
  );
}

/** One filter tab. */
function FilterTab({
  label,
  count,
  isActive,
  help,
  onSelect,
}: {
  label: string;
  count: number;
  isActive: boolean;
  help: string;
  onSelect: () => void;
}) {
  return (
    <Tooltip text={help}>
      <button
        type="button"
        role="tab"
        aria-selected={isActive}
        onClick={onSelect}
        className={cx(
          'inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition',
          isActive
            ? 'bg-[var(--color-accent)] text-white shadow-sm'
            : 'bg-[var(--color-surface)] text-[var(--color-ink-muted)] ring-1 ring-inset ring-[var(--color-border-strong)] hover:bg-[var(--color-surface-sunken)]',
        )}
      >
        {label}
        <span
          className={cx(
            'rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums',
            isActive ? 'bg-white/25 text-white' : 'bg-[var(--color-surface-sunken)] text-[var(--color-ink-muted)]',
          )}
        >
          {count}
        </span>
      </button>
    </Tooltip>
  );
}

export function EvaluationBoard({
  evaluations,
  projectNames,
}: {
  evaluations: readonly ProjectEvaluation[];
  /** Project id to display name. */
  projectNames: Readonly<Record<string, string>>;
}) {
  const [filter, setFilter] = useState<string>(ALL);
  const isFiltering = filter !== ALL;

  /** Every AI signal across all projects; matched plus unmatched is the full set. */
  const allSignals: ValidatedSignal[] = evaluations.flatMap((evaluation) => [
    ...evaluation.matches.map((match) => match.actual),
    ...evaluation.potentialFalsePositives,
  ]);

  function countStatus(status: string): number {
    return allSignals.filter((signal) => signal.status === status).length;
  }

  const passesFilter = (signal: ValidatedSignal) => !isFiltering || signal.status === filter;

  const filterHelp: Record<string, string> = {
    CONFIRMED: EVALUATION_HELP.humanConfirmed,
    INVESTIGATE: EVALUATION_HELP.humanInvestigating,
    DISMISSED: EVALUATION_HELP.humanDismissed,
    NEW: 'Signals nobody has made a decision on yet.',
  };

  return (
    <>
      <section>
        <SectionLabel info="Filter every project below by the decision a person recorded on each AI signal.">
          Human review
        </SectionLabel>
        <div role="tablist" aria-label="Human review status" className="mt-2 flex flex-wrap gap-2">
          <FilterTab
            label="All signals"
            count={allSignals.length}
            isActive={!isFiltering}
            help="Every AI signal, whatever its review status. Also shows missed items and expected absences."
            onSelect={() => setFilter(ALL)}
          />
          {FILTERS.map((value) => (
            <FilterTab
              key={value}
              label={labelForFilter(value)}
              count={countStatus(value)}
              isActive={filter === value}
              help={filterHelp[value] ?? ''}
              onSelect={() => setFilter(value)}
            />
          ))}
        </div>

        {isFiltering ? (
          <p className="mt-3 text-sm text-[var(--color-ink-muted)]" aria-live="polite">
            Showing only AI signals marked <strong>{labelForFilter(filter)}</strong>. Missed
            expected signals and expected absences are hidden, because they have no AI signal for a
            person to review.
          </p>
        ) : null}
      </section>

      <section className="space-y-4">
        <SectionLabel info="The same marking, one project at a time.">By project</SectionLabel>

        {evaluations.map((evaluation) => {
          const matches = evaluation.matches.filter((match) => passesFilter(match.actual));
          const unmatched = evaluation.potentialFalsePositives.filter(passesFilter);
          const missed = isFiltering ? [] : evaluation.missed;
          const absences = isFiltering ? [] : evaluation.absences;
          const hasNothingToShow =
            isFiltering && evaluation.analyzed && matches.length === 0 && unmatched.length === 0;

          return (
            <Card key={evaluation.projectId}>
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <CardTitle>
                    <Link href={`/dashboard/${evaluation.projectId}`} className="hover:underline">
                      {evaluation.projectId} · {projectNames[evaluation.projectId]}
                    </Link>
                  </CardTitle>
                  {evaluation.analyzed ? (
                    <div className="flex flex-wrap gap-1.5">
                      <Badge tone="low" title={EVALUATION_HELP.matched} tooltipAlign="end">
                        {matches.length} matched
                      </Badge>
                      {missed.length > 0 ? (
                        <Badge tone="medium" title={EVALUATION_HELP.missed} tooltipAlign="end">
                          {missed.length} missed
                        </Badge>
                      ) : null}
                      {unmatched.length > 0 ? (
                        <Badge tone="outline" title={EVALUATION_HELP.unmatched} tooltipAlign="end">
                          {unmatched.length} unmatched
                        </Badge>
                      ) : null}
                    </div>
                  ) : (
                    <Badge
                      tone="outline"
                      title="No analysis has been run for this project yet, so nothing can be matched or missed."
                      tooltipAlign="end"
                    >
                      Not analysed
                    </Badge>
                  )}
                </div>
              </CardHeader>

              <CardBody className="space-y-4">
                {!evaluation.analyzed ? (
                  <p className="text-sm text-[var(--color-ink-subtle)]">
                    This project has not been analysed, so its expected signals are neither matched
                    nor missed.
                  </p>
                ) : null}

                {hasNothingToShow ? (
                  <Notice>
                    No signals in this project are marked <strong>{labelForFilter(filter)}</strong>.
                  </Notice>
                ) : null}

                {matches.length > 0 ? (
                  <div>
                    <p className="text-sm font-medium">Matched</p>
                    <ul className="mt-2 space-y-2">
                      {matches.map((match) => (
                        <li
                          key={match.actual.id}
                          className="border-l-2 border-[var(--color-severity-low)] pl-3"
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge tone="accent" title={CATEGORY_HELP[match.expected.category]}>
                              {formatCategory(match.expected.category)}
                            </Badge>
                            <StatusTag status={match.actual.status} />
                            <Link
                              href={`/signals/${match.actual.id}`}
                              className="text-sm font-medium hover:underline"
                            >
                              {match.actual.title}
                            </Link>
                          </div>
                          <p className="mt-1 text-xs text-[var(--color-ink-subtle)]">
                            Expected: {match.expected.description}
                          </p>
                          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                            <span className="text-xs text-[var(--color-ink-subtle)]">
                              Shared evidence:
                            </span>
                            {match.sharedEvidence.map((sourceId) => (
                              <SourceId key={sourceId}>{sourceId}</SourceId>
                            ))}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {missed.length > 0 ? (
                  <div>
                    <p className="text-sm font-medium">Missed expected signals</p>
                    <ul className="mt-2 space-y-2">
                      {missed.map((expected) => (
                        <li
                          key={`${expected.category}-${expected.description}`}
                          className="border-l-2 border-[var(--color-severity-medium)] pl-3"
                        >
                          <Badge tone="medium" title={CATEGORY_HELP[expected.category]}>
                            {formatCategory(expected.category)}
                          </Badge>
                          <p className="mt-1 text-sm text-[var(--color-ink-muted)]">
                            {expected.description}
                          </p>
                          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                            <span className="text-xs text-[var(--color-ink-subtle)]">
                              Key evidence:
                            </span>
                            {expected.keyEvidence.map((sourceId) => (
                              <SourceId key={sourceId}>{sourceId}</SourceId>
                            ))}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {unmatched.length > 0 ? (
                  <div>
                    <p className="text-sm font-medium">Unmatched AI signals</p>
                    <p className="mt-0.5 text-xs text-[var(--color-ink-subtle)]">
                      These matched no expectation. That may mean a false positive, or it may mean
                      the assistant found something the answer key did not anticipate — which is why
                      they are listed for review rather than scored as errors.
                    </p>
                    <ul className="mt-2 space-y-2">
                      {unmatched.map((signal) => (
                        <li key={signal.id} className="border-l-2 border-[var(--color-border-strong)] pl-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge tone="outline" title={CATEGORY_HELP[signal.category]}>
                              {formatCategory(signal.category)}
                            </Badge>
                            <StatusTag status={signal.status} />
                            <Link
                              href={`/signals/${signal.id}`}
                              className="text-sm font-medium hover:underline"
                            >
                              {signal.title}
                            </Link>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {absences.length > 0 ? (
                  <div>
                    <p className="text-sm font-medium">Items expected to stay absent</p>
                    <ul className="mt-2 space-y-2">
                      {absences.map((entry) => (
                        <li
                          key={entry.absence.topic}
                          className={
                            entry.respected
                              ? 'border-l-2 border-[var(--color-severity-low)] pl-3'
                              : 'border-l-2 border-[var(--color-severity-high)] pl-3'
                          }
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge
                              tone={entry.respected ? 'low' : 'high'}
                              title={
                                entry.respected
                                  ? 'This topic was already resolved and the AI correctly did not raise it as active.'
                                  : 'The AI raised a topic the records show was already resolved. This is a failure.'
                              }
                            >
                              {entry.respected ? 'Respected' : 'Surfaced'}
                            </Badge>
                            <span className="text-sm font-medium">{entry.absence.topic}</span>
                          </div>
                          <p className="mt-1 text-xs text-[var(--color-ink-subtle)]">
                            {entry.absence.reason}
                          </p>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </CardBody>
            </Card>
          );
        })}
      </section>
    </>
  );
}
