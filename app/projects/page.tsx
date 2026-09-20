/**
 * Project selection page.
 *
 * A list, one row per project, showing at a glance which projects have been
 * analysed, when, and what came out. Rows carry summaries only — `listProjects`
 * deliberately omits the full record sets, so choosing a project never ships
 * 150 records to the browser.
 *
 * Reads saved runs from the store, so it is dynamic: a static page would freeze
 * a build-time snapshot and keep saying "Not analysed" after an analysis.
 */

import Link from 'next/link';
import { listProjects } from '@/lib/projects';
import { listRuns } from '@/lib/store';
import type { AnalysisRun } from '@/lib/ai/schemas';
import { Badge, Card, Tooltip } from '@/components/ui/primitives';

export const dynamic = 'force-dynamic';

/** Formats an ISO date as e.g. "30 Nov 2026". */
function formatDate(isoDate: string): string {
  return new Date(`${isoDate}T00:00:00Z`).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

/** Formats an analysis timestamp as e.g. "20 Sep 2026, 15:04". */
function formatTimestamp(isoTimestamp: string): string {
  return new Date(isoTimestamp).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** How many of a run's signals a person has already decided on. */
function countReviewed(run: AnalysisRun): number {
  return run.signals.filter((signal) => signal.status !== 'NEW').length;
}

export default async function ProjectsPage() {
  const projects = listProjects();
  const runs = await listRuns();
  const runsByProject = new Map(runs.map((run) => [run.projectId, run]));

  const analysedCount = projects.filter((project) => runsByProject.has(project.id)).length;

  return (
    <div className="space-y-6">
      <header className="max-w-3xl">
        <h1 className="text-2xl font-bold tracking-tight">Projects</h1>
        <p className="mt-2 text-base leading-relaxed text-[var(--color-ink-muted)]">
          Five synthetic construction projects. Select one to open its dashboard, inspect its
          records and run an analysis. Each analysis sees only the project you select.
        </p>
        <p className="mt-3 text-sm font-medium text-[var(--color-ink-muted)]">
          {analysedCount} of {projects.length} projects analysed
        </p>
      </header>

      <Card>
        <ul className="divide-y divide-[var(--color-border)]">
          {projects.map((project) => {
            const run = runsByProject.get(project.id);
            const isBehind = project.currentCompletion !== project.plannedCompletion;
            const highSeverityCount = run?.signals.filter((signal) => signal.severity === 'HIGH').length ?? 0;

            return (
              <li key={project.id} className="first:*:rounded-t-2xl last:*:rounded-b-2xl">
                <Link
                  href={`/dashboard/${project.id}`}
                  className="grid gap-4 px-6 py-5 transition-colors hover:bg-[var(--color-surface-raised)] lg:grid-cols-[minmax(0,2fr)_minmax(0,1.2fr)_minmax(0,1fr)] lg:items-center"
                >
                  {/* Identity */}
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-base font-semibold tracking-tight">{project.name}</h2>
                      <Badge
                        tone="outline"
                        title="The project's current phase, taken from the project record."
                      >
                        {project.status}
                      </Badge>
                    </div>
                    <p className="mt-1 text-sm text-[var(--color-ink-subtle)]">
                      {project.id} · {project.type} · {project.location}
                    </p>
                    <p className="mt-2 text-sm leading-relaxed text-[var(--color-ink-muted)]">
                      {project.description}
                    </p>
                  </div>

                  {/* Analysis state and when it last changed */}
                  <div>
                    {run ? (
                      <Badge
                        tone="low"
                        title="An analysis has been run and saved for this project. Open it to see the signals."
                      >
                        ✓ Analysed
                      </Badge>
                    ) : (
                      <Badge
                        tone="medium"
                        title="No analysis has been run for this project yet. Open it and choose Analyze project."
                      >
                        Not analysed
                      </Badge>
                    )}

                    {run ? (
                      <>
                        <p className="mt-2 text-sm text-[var(--color-ink-muted)]">
                          <span className="font-medium">Last updated</span>{' '}
                          {formatTimestamp(run.analyzedAt)}
                        </p>
                        <p className="mt-0.5 text-sm text-[var(--color-ink-subtle)]">
                          {run.provider === 'gemini' ? 'Gemini' : 'Demo mode'} ·{' '}
                          {run.signals.length} signal{run.signals.length === 1 ? '' : 's'}
                          {highSeverityCount > 0 ? ` · ${highSeverityCount} high severity` : ''}
                          {run.signals.length > 0
                            ? ` · ${countReviewed(run)}/${run.signals.length} reviewed`
                            : ''}
                        </p>
                      </>
                    ) : (
                      <p className="mt-2 text-sm text-[var(--color-ink-subtle)]">
                        Never analysed
                      </p>
                    )}
                  </div>

                  {/* Programme dates */}
                  <dl className="grid grid-cols-3 gap-3 text-sm">
                    <div>
                      <dt className="text-[var(--color-ink-subtle)]">Planned</dt>
                      <dd className="mt-0.5 font-medium tabular-nums">
                        {formatDate(project.plannedCompletion)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[var(--color-ink-subtle)]">
                        {isBehind ? (
                          <Tooltip
                            text="The latest records give a different completion date from the original programme."
                            align="end"
                          >
                            <span className="underline decoration-dotted underline-offset-4">Current</span>
                          </Tooltip>
                        ) : (
                          'Current'
                        )}
                      </dt>
                      <dd
                        className={
                          isBehind
                            ? 'mt-0.5 font-medium tabular-nums text-[var(--color-severity-medium)]'
                            : 'mt-0.5 font-medium tabular-nums'
                        }
                      >
                        {formatDate(project.currentCompletion)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[var(--color-ink-subtle)]">Records</dt>
                      <dd className="mt-0.5 font-medium tabular-nums">{project.recordCount}</dd>
                    </div>
                  </dl>
                </Link>
              </li>
            );
          })}
        </ul>
      </Card>
    </div>
  );
}
