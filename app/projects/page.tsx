/**
 * Project selection page.
 *
 * Renders card-level summaries only. The full record sets stay on the server —
 * `listProjects` deliberately omits them, so choosing a project never ships
 * 150 records to the browser.
 */

import Link from 'next/link';
import { listProjects } from '@/lib/projects';
import { Badge, Card, CardBody } from '@/components/ui/primitives';

/** Formats an ISO date as e.g. "30 Nov 2026". */
function formatDate(isoDate: string): string {
  return new Date(`${isoDate}T00:00:00Z`).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export default function ProjectsPage() {
  const projects = listProjects();

  return (
    <div className="space-y-6">
      <header className="max-w-3xl">
        <h1 className="text-xl font-semibold tracking-tight">Projects</h1>
        <p className="mt-1 text-sm text-[var(--color-ink-muted)]">
          Five synthetic construction projects. Select one to open its dashboard, inspect its
          records and run an analysis. Each analysis sees only the project you select.
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        {projects.map((project) => {
          const isBehind = project.currentCompletion !== project.plannedCompletion;

          return (
            <Link key={project.id} href={`/dashboard/${project.id}`} className="group block">
              <Card className="h-full transition-colors group-hover:border-[var(--color-border-strong)]">
                <CardBody className="flex h-full flex-col">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="text-sm font-semibold tracking-tight">{project.name}</h2>
                      <p className="mt-1 text-xs text-[var(--color-ink-subtle)]">
                        {project.id} · {project.type} · {project.location}
                      </p>
                    </div>
                    <Badge tone="outline">{project.status}</Badge>
                  </div>

                  <p className="mt-3 flex-1 text-sm leading-relaxed text-[var(--color-ink-muted)]">
                    {project.description}
                  </p>

                  <dl className="mt-4 grid grid-cols-3 gap-3 border-t border-[var(--color-border)] pt-3 text-xs">
                    <div>
                      <dt className="text-[var(--color-ink-subtle)]">Planned</dt>
                      <dd className="mt-0.5 font-medium tabular-nums">
                        {formatDate(project.plannedCompletion)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[var(--color-ink-subtle)]">Current</dt>
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
                </CardBody>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
