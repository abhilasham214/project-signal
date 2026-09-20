/**
 * Evaluation page.
 *
 * Compares stored analysis runs against the synthetic answer key. The key is
 * read here, after the fact — it never reaches a provider.
 *
 * The framing matters as much as the numbers. Five synthetic projects written
 * by the same person who wrote the prompt cannot measure production accuracy,
 * and this page says so rather than implying otherwise with a percentage.
 */

import { listProjects } from '@/lib/projects';
import { listRuns } from '@/lib/store';
import { evaluateProject, summariseEvaluations } from '@/lib/evaluation';
import { EvaluationBoard } from '@/components/evaluation/evaluation-board';
import { EVALUATION_HELP } from '@/components/ui/explanations';
import { Card, CardBody, Notice, SectionLabel, Stat } from '@/components/ui/primitives';

export const dynamic = 'force-dynamic';

export default async function EvaluationPage() {
  const projects = listProjects();
  const runs = await listRuns();
  const runsByProject = new Map(runs.map((run) => [run.projectId, run]));

  const evaluations = projects.map((project) =>
    evaluateProject(project.id, runsByProject.get(project.id) ?? null),
  );
  const summary = summariseEvaluations(evaluations);

  return (
    <div className="space-y-8">
      <header className="max-w-3xl">
        <h1 className="text-xl font-semibold tracking-tight">
          Prototype evaluation using synthetic project data
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-[var(--color-ink-muted)]">
          Each synthetic project has an expected-signal entry describing what a careful reader
          should notice. A signal counts as matched when it shares both the category and at least
          one cited record with the expectation — matching on evidence rather than wording, so this
          measures whether the same records were read together, not whether the same phrasing was
          produced.
        </p>
      </header>

      <Notice tone="warning" title="What these numbers are not">
        This is a prototype evaluation on five synthetic projects written alongside the prompt. It
        does not establish production accuracy, and five projects cannot show that the approach is
        reliable. Treat it as a check that the pipeline behaves as intended, not as a benchmark.
      </Notice>

      <section>
        <SectionLabel info="Totals across all five projects, marked against the hidden answer key.">Summary</SectionLabel>
        <Card className="mt-2">
          <CardBody className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            <Stat
              label="Projects analysed"
              value={`${summary.projectsAnalyzed}/${summary.projectsTotal}`}
              info={EVALUATION_HELP.projectsAnalysed}
            />
            <Stat label="Expected signals" value={summary.expectedTotal} info={EVALUATION_HELP.expected} />
            <Stat label="Matched" value={summary.matchedTotal} info={EVALUATION_HELP.matched} />
            <Stat label="Missed" value={summary.missedTotal} info={EVALUATION_HELP.missed} />
            <Stat
              label="Unmatched AI signals"
              value={summary.potentialFalsePositiveTotal}
              hint="Not proven errors"
              info={EVALUATION_HELP.unmatched}
              infoAlign="end"
            />
            <Stat
              label="Absences respected"
              value={`${summary.absencesRespected}/${summary.absencesTotal}`}
              hint="Resolved items left alone"
              info={EVALUATION_HELP.absences}
              infoAlign="end"
            />
          </CardBody>
        </Card>
      </section>

      {summary.projectsAnalyzed === 0 ? (
        <Notice>
          No project has been analysed yet, so there is nothing to compare. Open a project and
          select <strong>Analyze project</strong> first.
        </Notice>
      ) : null}

      <EvaluationBoard
        evaluations={evaluations}
        projectNames={Object.fromEntries(projects.map((project) => [project.id, project.name]))}
      />
    </div>
  );
}
