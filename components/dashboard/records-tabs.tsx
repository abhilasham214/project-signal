'use client';

/**
 * The project record browser.
 *
 * Exists so a construction manager can read the source material without the AI
 * in the way. Every record the assistant can cite is visible here, under its
 * own id — which is what makes an evidence citation checkable rather than
 * something to be taken on trust.
 *
 * Records arrive pre-flattened by the server (see `toDisplayableRecord`), so
 * this component knows nothing about the eight record shapes.
 */

import { useState } from 'react';
import type { DisplayableRecord } from '@/lib/projects';
import { Card, CardBody, SourceId, cx } from '@/components/ui/primitives';

/** One tab: a record kind and its records. */
export interface RecordGroup {
  label: string;
  sourceType: string;
  records: DisplayableRecord[];
}

/** Formats an ISO date as e.g. "04 Jun 2026". */
function formatDate(isoDate: string): string {
  return new Date(`${isoDate}T00:00:00Z`).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export function RecordsTabs({ groups }: { groups: RecordGroup[] }) {
  const [activeSourceType, setActiveSourceType] = useState(groups[0]?.sourceType ?? '');
  const activeGroup = groups.find((group) => group.sourceType === activeSourceType) ?? groups[0];

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">Project records</h2>
        <p className="mt-0.5 text-xs text-[var(--color-ink-subtle)]">
          The source information for this project. Every record carries the id the assistant uses
          when citing it.
        </p>
      </div>

      <div
        role="tablist"
        aria-label="Project record types"
        className="flex flex-wrap gap-1 border-b border-[var(--color-border)]"
      >
        {groups.map((group) => {
          const isActive = group.sourceType === activeGroup?.sourceType;
          return (
            <button
              key={group.sourceType}
              role="tab"
              type="button"
              aria-selected={isActive}
              onClick={() => setActiveSourceType(group.sourceType)}
              className={cx(
                '-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'border-[var(--color-accent)] text-[var(--color-ink)]'
                  : 'border-transparent text-[var(--color-ink-subtle)] hover:text-[var(--color-ink-muted)]',
              )}
            >
              {group.label}
              <span className="ml-1.5 text-xs tabular-nums text-[var(--color-ink-subtle)]">
                {group.records.length}
              </span>
            </button>
          );
        })}
      </div>

      <div role="tabpanel" className="grid gap-3">
        {activeGroup?.records.map((record) => (
          <Card key={record.id}>
            <CardBody>
              <div className="flex flex-wrap items-center gap-2">
                <SourceId>{record.id}</SourceId>
                {record.date ? (
                  <span className="text-xs tabular-nums text-[var(--color-ink-subtle)]">
                    {formatDate(record.date)}
                  </span>
                ) : null}
                <span className="text-xs text-[var(--color-ink-subtle)]">{record.kindLabel}</span>
              </div>

              <h3 className="mt-2 text-sm font-semibold leading-snug">{record.title}</h3>

              {record.participants.length > 0 ? (
                <p className="mt-1 text-xs text-[var(--color-ink-subtle)]">
                  {record.participants.join(' · ')}
                </p>
              ) : null}

              <p className="mt-2 text-sm leading-relaxed text-[var(--color-ink-muted)]">
                {record.body}
              </p>
            </CardBody>
          </Card>
        ))}

        {activeGroup && activeGroup.records.length === 0 ? (
          <p className="py-6 text-sm text-[var(--color-ink-subtle)]">
            No {activeGroup.label.toLowerCase()} are recorded for this project.
          </p>
        ) : null}
      </div>
    </section>
  );
}
