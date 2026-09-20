'use client';

/**
 * The signal list with tabs and filters.
 *
 * Tabs split the list by category (Dependency, Repeated issue, ...). Two chip
 * rows narrow it further by severity and review status. Every count shown next
 * to a tab or chip is computed from the signals actually held, so a tab never
 * promises results the filters would then hide.
 *
 * Filtering is display only. It never changes a signal, its status or its
 * evidence; it decides which already-validated signals are visible.
 */

import { useMemo, useState } from 'react';
import type { ValidatedSignal } from '@/lib/ai/schemas';
import { SignalCard, STATUS_LABELS, formatCategory } from './signal-card';
import { CATEGORY_HELP, SEVERITY_HELP, STATUS_HELP } from '@/components/ui/explanations';
import { Button, Notice, Tooltip, cx } from '@/components/ui/primitives';

/** Sentinel for "no filter on this dimension". */
const ALL = 'ALL';

const SEVERITY_ORDER = ['HIGH', 'MEDIUM', 'LOW'] as const;
const STATUS_ORDER = ['NEW', 'INVESTIGATE', 'CONFIRMED', 'DISMISSED'] as const;

/** One selectable tab. */
function TabButton({
  label,
  count,
  isActive,
  help,
  onSelect,
}: {
  label: string;
  count: number;
  isActive: boolean;
  help?: string;
  onSelect: () => void;
}) {
  const button = (
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
  );
  return help ? <Tooltip text={help}>{button}</Tooltip> : button;
}

/** One selectable filter chip. */
function Chip({
  label,
  count,
  isActive,
  help,
  onSelect,
}: {
  label: string;
  count: number;
  isActive: boolean;
  help?: string;
  onSelect: () => void;
}) {
  const chip = (
    <button
      type="button"
      aria-pressed={isActive}
      onClick={onSelect}
      className={cx(
        'rounded-full border px-3 py-1 text-xs font-semibold transition',
        isActive
          ? 'border-[var(--color-accent)] bg-[var(--color-accent-soft)] text-[var(--color-accent)]'
          : 'border-[var(--color-border-strong)] bg-[var(--color-surface)] text-[var(--color-ink-muted)] hover:bg-[var(--color-surface-sunken)]',
      )}
    >
      {label} <span className="tabular-nums opacity-70">{count}</span>
    </button>
  );
  return help ? <Tooltip text={help}>{chip}</Tooltip> : chip;
}

export function SignalList({ signals }: { signals: readonly ValidatedSignal[] }) {
  const [category, setCategory] = useState<string>(ALL);
  const [severity, setSeverity] = useState<string>(ALL);
  const [status, setStatus] = useState<string>(ALL);

  /** Categories that actually occur, in first-seen order. */
  const categories = useMemo(
    () => Array.from(new Set(signals.map((signal) => signal.category))),
    [signals],
  );

  /**
   * Counts for a tab or chip respect the OTHER active filters, so the number on
   * a control is exactly how many signals clicking it would show.
   */
  function countWhere(overrides: { category?: string; severity?: string; status?: string }): number {
    const wanted = { category, severity, status, ...overrides };
    return signals.filter(
      (signal) =>
        (wanted.category === ALL || signal.category === wanted.category) &&
        (wanted.severity === ALL || signal.severity === wanted.severity) &&
        (wanted.status === ALL || signal.status === wanted.status),
    ).length;
  }

  const visibleSignals = signals.filter(
    (signal) =>
      (category === ALL || signal.category === category) &&
      (severity === ALL || signal.severity === severity) &&
      (status === ALL || signal.status === status),
  );

  const isFiltered = category !== ALL || severity !== ALL || status !== ALL;

  function clearFilters() {
    setCategory(ALL);
    setSeverity(ALL);
    setStatus(ALL);
  }

  return (
    <div className="space-y-4">
      <div role="tablist" aria-label="Signal category" className="flex flex-wrap gap-2">
        <TabButton
          label="All"
          count={countWhere({ category: ALL })}
          isActive={category === ALL}
          help="Every signal from the latest analysis, whatever its category."
          onSelect={() => setCategory(ALL)}
        />
        {categories.map((value) => (
          <TabButton
            key={value}
            label={formatCategory(value)}
            count={countWhere({ category: value })}
            isActive={category === value}
            help={CATEGORY_HELP[value]}
            onSelect={() => setCategory(value)}
          />
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-[var(--color-ink-subtle)]">
            Severity
          </span>
          <Chip
            label="Any"
            count={countWhere({ severity: ALL })}
            isActive={severity === ALL}
            onSelect={() => setSeverity(ALL)}
          />
          {SEVERITY_ORDER.map((value) => (
            <Chip
              key={value}
              label={value.charAt(0) + value.slice(1).toLowerCase()}
              count={countWhere({ severity: value })}
              isActive={severity === value}
              help={SEVERITY_HELP[value]}
              onSelect={() => setSeverity(value)}
            />
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-[var(--color-ink-subtle)]">
            Review status
          </span>
          <Chip
            label="Any"
            count={countWhere({ status: ALL })}
            isActive={status === ALL}
            onSelect={() => setStatus(ALL)}
          />
          {STATUS_ORDER.map((value) => (
            <Chip
              key={value}
              label={STATUS_LABELS[value] ?? value}
              count={countWhere({ status: value })}
              isActive={status === value}
              help={STATUS_HELP[value]}
              onSelect={() => setStatus(value)}
            />
          ))}
        </div>

        {isFiltered ? (
          <Button variant="ghost" onClick={clearFilters}>
            Clear filters
          </Button>
        ) : null}
      </div>

      <p className="text-sm text-[var(--color-ink-muted)]" aria-live="polite">
        Showing {visibleSignals.length} of {signals.length} signal{signals.length === 1 ? '' : 's'}
      </p>

      {visibleSignals.length === 0 ? (
        <Notice title="No signals match these filters">
          Nothing in the latest analysis fits this combination. Clear the filters to see every
          signal again.
        </Notice>
      ) : (
        <div className="grid gap-4">
          {visibleSignals.map((signal) => (
            <SignalCard key={signal.id} signal={signal} />
          ))}
        </div>
      )}
    </div>
  );
}
