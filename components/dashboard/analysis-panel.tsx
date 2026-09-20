'use client';

/**
 * The Analyze Project control and the resulting signal list.
 *
 * Holds the only client-side state on the dashboard: whether an analysis is
 * running, what it returned, and what went wrong if it failed.
 *
 * Two things this component is careful about:
 *
 *   - The analysing message describes what the request is actually doing
 *     (reading the project records). It does not animate through invented
 *     stages to look busy, because claiming work that is not happening is the
 *     same class of dishonesty the rest of the product is built to avoid.
 *
 *   - An empty result is rendered as "no signals were identified from the
 *     available information", never as "there are no risks". The prototype
 *     cannot know the second thing.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { AnalysisRun } from '@/lib/ai/schemas';
import { SignalCard } from '@/components/signals/signal-card';
import { Badge, Button, Card, CardBody, Notice, Skeleton } from '@/components/ui/primitives';

/** Formats an ISO timestamp for the "last analysed" line. */
function formatTimestamp(isoTimestamp: string): string {
  return new Date(isoTimestamp).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function AnalysisPanel({
  projectId,
  initialRun,
}: {
  projectId: string;
  /** The stored run, so a reload shows previous results without re-analysing. */
  initialRun: AnalysisRun | null;
}) {
  const router = useRouter();
  const [run, setRun] = useState<AnalysisRun | null>(initialRun);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function analyze() {
    setIsAnalyzing(true);
    setErrorMessage(null);

    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId }),
      });

      const payload = (await response.json()) as { run?: AnalysisRun; error?: string };

      if (!response.ok) {
        setErrorMessage(payload.error ?? 'The analysis could not be completed.');
        return;
      }
      if (!payload.run) {
        setErrorMessage('The analysis returned no result.');
        return;
      }
      setRun(payload.run);
      // why refresh: the overview strip above (AI signals, high severity) is
      // rendered on the server. Without this it would keep saying "Not
      // analysed" while the signals it is counting are listed directly below.
      router.refresh();
    } catch {
      // why a generic message: a network failure carries nothing worth showing,
      // and the raw error text is not useful to a construction manager.
      setErrorMessage('The analysis request could not be sent. Check your connection and retry.');
    } finally {
      setIsAnalyzing(false);
    }
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Potential signals</h2>
          <p className="mt-0.5 text-xs text-[var(--color-ink-subtle)]">
            {run
              ? `Last analysed ${formatTimestamp(run.analyzedAt)} using the ${
                  run.provider === 'gemini' ? 'Gemini' : 'demo'
                } provider.`
              : 'This project has not been analysed yet.'}
          </p>
        </div>

        <Button variant="primary" onClick={analyze} disabled={isAnalyzing}>
          {isAnalyzing ? 'Analyzing…' : run ? 'Re-analyze project' : 'Analyze project'}
        </Button>
      </div>

      {errorMessage ? (
        <Notice tone="error" title="Analysis failed">
          {errorMessage}
        </Notice>
      ) : null}

      {isAnalyzing ? (
        <Card>
          <CardBody>
            <p className="text-sm font-medium">Analyzing project information…</p>
            <p className="mt-1 text-sm text-[var(--color-ink-muted)]">
              Reviewing meetings, site reports, issues, decisions, changes, dependencies and
              contractor and consultant updates for this project.
            </p>
            <div className="mt-4 space-y-2">
              <Skeleton className="h-3 w-3/4" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-5/6" />
            </div>
          </CardBody>
        </Card>
      ) : null}

      {!isAnalyzing && run && run.signals.length === 0 ? (
        <Notice title="No potential signals were identified">
          No potential signals were identified from the available project information. This means
          nothing in these records could be supported with evidence — it does not mean the project
          is without risk.
        </Notice>
      ) : null}

      {!isAnalyzing && run && run.signals.length > 0 ? (
        <div className="grid gap-4">
          {run.signals.map((signal) => (
            <SignalCard key={signal.id} signal={signal} />
          ))}
        </div>
      ) : null}

      {/* Rejections are surfaced, not swallowed. A reviewer should be able to
          see the evidence guard doing its job. */}
      {!isAnalyzing && run && run.discarded.length > 0 ? (
        <Card>
          <CardBody>
            <div className="flex items-center gap-2">
              <Badge tone="medium">Validation</Badge>
              <p className="text-sm font-medium">
                {run.discarded.length} proposed signal
                {run.discarded.length === 1 ? ' was' : 's were'} discarded before display
              </p>
            </div>
            <ul className="mt-3 space-y-2 text-sm text-[var(--color-ink-muted)]">
              {run.discarded.map((discarded, index) => (
                <li key={`${discarded.title}-${index}`} className="border-l-2 border-[var(--color-border-strong)] pl-3">
                  <p className="font-medium text-[var(--color-ink)]">{discarded.title}</p>
                  <p className="mt-0.5 text-xs">
                    {discarded.reason === 'NO_VALID_EVIDENCE'
                      ? 'Evidence could not be verified'
                      : 'Did not match the required schema'}
                    : {discarded.detail}
                  </p>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      ) : null}

      {!isAnalyzing && !run && !errorMessage ? (
        <Notice>
          Select <strong>Analyze project</strong> to ask the assistant to read this project's records
          and propose signals. Every signal it proposes will cite records from this project, and
          those citations are verified before anything is shown.
        </Notice>
      ) : null}
    </section>
  );
}
