/**
 * UI primitives.
 *
 * Small, unstyled-by-default building blocks following shadcn naming so the
 * pages read familiarly, but written directly against the design tokens in
 * `app/globals.css` rather than pulled from a component library. why: this
 * prototype needs six primitives, not a dependency tree, and the restrained
 * enterprise look is easier to hold consistent when the styles are here.
 *
 * Everything in this file is presentational. No data fetching, no state that
 * outlives a render, nothing that knows what a signal is.
 */

import type { ReactNode } from 'react';

/** Joins class names, dropping falsy entries. */
export function cx(...classNames: Array<string | false | null | undefined>): string {
  return classNames.filter(Boolean).join(' ');
}

/* ------------------------------------------------------------------ Card */

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div
      className={cx(
        'rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-card)]',
        className,
      )}
    >
      {children}
    </div>
  );
}

export function CardHeader({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={cx('border-b border-[var(--color-border)] px-6 py-5', className)}>{children}</div>
  );
}

export function CardTitle({ className, children }: { className?: string; children: ReactNode }) {
  return <h2 className={cx('text-base font-semibold tracking-tight', className)}>{children}</h2>;
}

export function CardBody({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cx('px-6 py-5', className)}>{children}</div>;
}

/* --------------------------------------------------------------- Tooltip */

/**
 * Hover and keyboard-focus explanation for anything that needs one.
 *
 * Pure CSS, so it works in server components with no JavaScript. why not the
 * native `title` attribute: it is slow to appear, unstyled, ignores touch and
 * keyboard, and cannot wrap long text. This shows on hover AND on focus, so
 * keyboard users get the same explanation.
 *
 * `align` picks which edge the bubble hangs from, so a tooltip near the right
 * edge of the page does not run off-screen.
 */
export function Tooltip({
  text,
  align = 'start',
  className,
  children,
}: {
  text: string;
  align?: 'start' | 'end';
  className?: string;
  children: ReactNode;
}) {
  return (
    <span className={cx('group/tip relative inline-flex cursor-help', className)} tabIndex={0}>
      {children}
      <span
        role="tooltip"
        className={cx(
          'pointer-events-none invisible absolute top-full z-30 mt-2 w-64 rounded-lg bg-[var(--color-ink)] px-3 py-2',
          'text-left text-xs font-normal normal-case leading-snug tracking-normal text-white opacity-0 shadow-lg transition-opacity',
          'group-hover/tip:visible group-hover/tip:opacity-100 group-focus/tip:visible group-focus/tip:opacity-100',
          align === 'end' ? 'right-0' : 'left-0',
        )}
      >
        {text}
      </span>
    </span>
  );
}

/* ----------------------------------------------------------------- Badge */

type BadgeTone = 'neutral' | 'accent' | 'high' | 'medium' | 'low' | 'outline';

const BADGE_TONES: Record<BadgeTone, string> = {
  neutral:
    'bg-[var(--color-surface-sunken)] text-[var(--color-ink-muted)] border-[var(--color-border)]',
  accent: 'bg-[var(--color-accent-soft)] text-[var(--color-accent)] border-[var(--color-accent-border)]',
  high: 'bg-[var(--color-severity-high-soft)] text-[var(--color-severity-high)] border-current/25',
  medium:
    'bg-[var(--color-severity-medium-soft)] text-[var(--color-severity-medium)] border-current/25',
  low: 'bg-[var(--color-severity-low-soft)] text-[var(--color-severity-low)] border-current/25',
  outline: 'bg-transparent text-[var(--color-ink-subtle)] border-[var(--color-border-strong)]',
};

export function Badge({
  tone = 'neutral',
  className,
  title,
  tooltipAlign,
  children,
}: {
  tone?: BadgeTone;
  className?: string;
  /** Hover explanation of what this label means. Shown as a tooltip. */
  title?: string;
  /** Which edge the tooltip hangs from; use `end` near the right of the page. */
  tooltipAlign?: 'start' | 'end';
  children: ReactNode;
}) {
  const badge = (
    <span
      className={cx(
        'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide',
        BADGE_TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
  return title ? (
    <Tooltip text={title} align={tooltipAlign}>
      {badge}
    </Tooltip>
  ) : (
    badge
  );
}

/** Maps a HIGH/MEDIUM/LOW value to its badge tone. */
export function toneForLevel(level: string): BadgeTone {
  if (level === 'HIGH') return 'high';
  if (level === 'MEDIUM') return 'medium';
  return 'low';
}

/* ---------------------------------------------------------------- Button */

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary:
    'bg-[var(--color-accent)] text-white border-transparent shadow-sm hover:opacity-90',
  secondary:
    'bg-[var(--color-surface)] text-[var(--color-ink)] border-[var(--color-border-strong)] hover:bg-[var(--color-surface-raised)]',
  ghost:
    'bg-transparent text-[var(--color-ink-muted)] border-transparent hover:bg-[var(--color-surface-sunken)]',
  danger:
    'bg-[var(--color-surface)] text-[var(--color-severity-high)] border-current/40 hover:bg-[var(--color-severity-high-soft)]',
};

export function Button({
  variant = 'secondary',
  className,
  type = 'button',
  disabled,
  onClick,
  children,
  ...rest
}: {
  variant?: ButtonVariant;
  className?: string;
  type?: 'button' | 'submit';
  disabled?: boolean;
  onClick?: () => void;
  children: ReactNode;
} & { 'aria-label'?: string; 'aria-pressed'?: boolean; title?: string }) {
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={cx(
        'inline-flex items-center justify-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition',
        'disabled:cursor-not-allowed disabled:opacity-50',
        BUTTON_VARIANTS[variant],
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

/* ------------------------------------------------------------------ Misc */

/** Small uppercase heading used above stat groups and sections. */
export function SectionLabel({ children, info }: { children: ReactNode; info?: string }) {
  const label = (
    <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-ink-subtle)]">
      {children}
    </p>
  );
  return info ? <Tooltip text={info}>{label}</Tooltip> : label;
}

/**
 * A labelled figure in the project overview strip.
 *
 * `info` explains the label on hover; a dotted underline signals that it can be
 * hovered. `infoAlign` mirrors the tooltip for stats at the right edge.
 */
export function Stat({
  label,
  value,
  hint,
  info,
  infoAlign,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  info?: string;
  infoAlign?: 'start' | 'end';
}) {
  const labelText = (
    <p
      className={cx(
        'text-xs font-medium uppercase tracking-wide text-[var(--color-ink-subtle)]',
        info && 'underline decoration-dotted underline-offset-4',
      )}
    >
      {label}
    </p>
  );
  return (
    <div>
      {info ? (
        <Tooltip text={info} align={infoAlign}>
          {labelText}
        </Tooltip>
      ) : (
        labelText
      )}
      <p className="mt-1 text-xl font-semibold tabular-nums">{value}</p>
      {hint ? <p className="text-xs text-[var(--color-ink-subtle)]">{hint}</p> : null}
    </div>
  );
}

/** A record id rendered so it is recognisable as a citation handle. */
export function SourceId({ children }: { children: ReactNode }) {
  return (
    <code className="rounded bg-[var(--color-surface-sunken)] px-1.5 py-0.5 font-mono text-xs text-[var(--color-ink-muted)]">
      {children}
    </code>
  );
}

type NoticeTone = 'info' | 'warning' | 'error';

const NOTICE_TONES: Record<NoticeTone, string> = {
  info: 'border-[var(--color-accent-border)] bg-[var(--color-accent-soft)] text-[var(--color-ink)]',
  warning:
    'border-current/25 bg-[var(--color-severity-medium-soft)] text-[var(--color-severity-medium)]',
  error: 'border-current/25 bg-[var(--color-severity-high-soft)] text-[var(--color-severity-high)]',
};

/** Inline message block for empty states, errors and standing caveats. */
export function Notice({
  tone = 'info',
  title,
  children,
}: {
  tone?: NoticeTone;
  title?: string;
  children: ReactNode;
}) {
  return (
    <div className={cx('rounded-xl border px-5 py-4 text-sm', NOTICE_TONES[tone])}>
      {title ? <p className="mb-1 font-semibold">{title}</p> : null}
      <div className="leading-relaxed">{children}</div>
    </div>
  );
}

/** Placeholder block shown while content loads. */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cx('animate-pulse rounded bg-[var(--color-surface-sunken)]', className)}
      aria-hidden="true"
    />
  );
}
