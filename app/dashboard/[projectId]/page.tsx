/**
 * Project dashboard — the main product surface.
 *
 * A server component. It resolves the project id to ONE project, reads any
 * stored analysis run, and hands both to client components. The dataset is
 * never exposed to the browser: only this project's records are serialised into
 * the page.
 *
 * Note that no AI provider is called here. Rendering this page, including
 * during `next build`, cannot spend a token — analysis happens only when the
 * user presses the button, via `POST /api/analyze`.
 */

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { RECORD_KINDS, getProject, getRecordCount, toDisplayableRecord } from '@/lib/projects';
import { getRun } from '@/lib/store';
import { AnalysisPanel } from '@/components/dashboard/analysis-panel';
import { ProjectChat } from '@/components/chat/project-chat';
import { RecordsTabs, type RecordGroup } from '@/components/dashboard/records-tabs';
import { OVERVIEW_HELP } from '@/components/ui/explanations';
import { Badge, Card, CardBody, SectionLabel, Stat } from '@/components/ui/primitives';

/**
 * Rendered per request, never prerendered.
 *
 * why: this page reads the stored analysis run, which changes when the user
 * presses Analyze. Static generation would freeze a build-time snapshot, so a
 * reload after analysing would show "not analysed yet" again.
 *
 * This does NOT make the page call an AI provider — analysis happens only in
 * POST /api/analyze. Rendering reads the store and the dataset, nothing else.
 */
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

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;

  const project = getProject(projectId);
  if (!project) notFound();

  const run = await getRun(project.id);

  // Flatten each record collection once, on the server, so the client
  // component never needs to know the eight record shapes.
  const recordGroups: RecordGroup[] = RECORD_KINDS.map((kind) => ({
    label: kind.label,
    sourceType: kind.sourceType,
    records: project[kind.collection].map((record) => toDisplayableRecord(kind, record)),
  }));

  const highSeverityCount = run?.signals.filter((signal) => signal.severity === 'HIGH').length ?? 0;
  const isBehind = project.currentCompletion !== project.plannedCompletion;

  return (
    <div className="space-y-8">
      <div>
        <Link href="/projects" className="text-sm text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]">
          ← Projects
        </Link>
      </div>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{project.name}</h1>
          <p className="mt-1 text-sm text-[var(--color-ink-subtle)]">
            {project.id} · {project.type} · {project.location}
          </p>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[var(--color-ink-muted)]">
            {project.description}
          </p>
        </div>
        <Badge tone="outline" title="The project's current phase, taken from the project record." tooltipAlign="end">
          Status: {project.status}
        </Badge>
      </header>

      <section>
        <SectionLabel>Project overview</SectionLabel>
        <Card className="mt-2">
          <CardBody className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            <Stat
              label="Planned completion"
              value={formatDate(project.plannedCompletion)}
              info={OVERVIEW_HELP.planned}
            />
            <Stat
              label="Current completion"
              info={OVERVIEW_HELP.current}
              value={
                <span className={isBehind ? 'text-[var(--color-severity-medium)]' : undefined}>
                  {formatDate(project.currentCompletion)}
                </span>
              }
              hint={isBehind ? 'Differs from planned' : 'Matches planned'}
            />
            <Stat label="Records" value={getRecordCount(project)} info={OVERVIEW_HELP.records} />
            <Stat
              label="AI signals"
              info={OVERVIEW_HELP.aiSignals}
              value={run ? run.signals.length : '—'}
              hint={run ? undefined : 'Not analysed'}
            />
            <Stat
              label="High severity"
              info={OVERVIEW_HELP.highSeverity}
              infoAlign="end"
              value={run ? highSeverityCount : '—'}
              hint={run ? undefined : 'Not analysed'}
            />
          </CardBody>
        </Card>
      </section>

      <AnalysisPanel projectId={project.id} initialRun={run} />

      <ProjectChat projectId={project.id} />

      <RecordsTabs groups={recordGroups} />
    </div>
  );
}
