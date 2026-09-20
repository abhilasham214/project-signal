/**
 * Application header.
 *
 * Carries the AI mode indicator, which must be visible on every page. why:
 * during development and during review, the single most important question
 * about any output on screen is whether it came from a real model or from
 * deterministic fixtures. That answer should never require digging.
 */

import Link from 'next/link';
import { describeAIMode } from '@/lib/ai/mode';
import { Badge } from './primitives';

/** Top navigation and the AI provider indicator. */
export function SiteHeader() {
  const mode = describeAIMode();

  return (
    <header className="sticky top-0 z-10 border-b border-[var(--color-border)] bg-[var(--color-surface)]/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-4">
        <Link href="/" className="text-lg font-bold tracking-tight text-[var(--color-accent)]">
          Project Signal
        </Link>

        <nav className="flex items-center gap-2 text-sm font-medium text-[var(--color-ink-muted)]">
          <Link href="/projects" className="rounded-lg px-3 py-1.5 hover:bg-[var(--color-surface-sunken)] hover:text-[var(--color-ink)]">
            Projects
          </Link>
          <Link href="/evaluation" className="rounded-lg px-3 py-1.5 hover:bg-[var(--color-surface-sunken)] hover:text-[var(--color-ink)]">
            Evaluation
          </Link>
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-[var(--color-ink-subtle)]">AI Provider:</span>
          <Badge
            tone={mode.misconfigured ? 'high' : mode.isLive ? 'accent' : 'neutral'}
            title={
              mode.isLive
                ? 'Requests go to the Gemini API.'
                : 'Deterministic fixtures. No AI provider calls are made.'
            }
          >
            {mode.label}
          </Badge>
        </div>
      </div>
    </header>
  );
}
