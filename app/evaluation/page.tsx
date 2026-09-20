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

import Link from 'next/link';
import { listProjects } from '@/lib/projects';
import { listRuns } from '@/lib/store';
import { evaluateProject, summariseEvaluations } from '@/lib/evaluation';
import { formatCategory } from '@/components/signals/signal-card';
import { CATEGORY_HELP, EVALUATION_HELP } from '@/components/ui/explanations';
import {
  Badge,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  Notice,
  SectionLabel,
  SourceId,
  Stat,
} from '@/components/ui/primitives';

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

        <Card className="mt-3">
          <CardBody className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Stat label="Human confirmed" value={summary.humanConfirmed} info={EVALUATION_HELP.humanConfirmed} />
            <Stat label="Human investigating" value={summary.humanInvestigating} info={EVALUATION_HELP.humanInvestigating} />
            <Stat label="Human dismissed" value={summary.humanDismissed} info={EVALUATION_HELP.humanDismissed} infoAlign="end" />
          </CardBody>
        </Card>
      </section>

      {summary.projectsAnalyzed === 0 ? (
        <Notice>
          No project has been analysed yet, so there is nothing to compare. Open a project and
          select <strong>Analyze project</strong> first.
        </Notice>
      ) : null}

      <section className="space-y-4">
        <SectionLabel info="The same marking, one project at a time.">By project</SectionLabel>

        {evaluations.map((evaluation) => {
          const project = projects.find((candidate) => candidate.id === evaluation.projectId);

          return (
            <Card key={evaluation.projectId}>
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <CardTitle>
                    <Link href={`/dashboard/${evaluation.projectId}`} className="hover:underline">
                      {evaluation.projectId} · {project?.name}
                    </Link>
                  </CardTitle>
                  {evaluation.analyzed ? (
                    <div className="flex flex-wrap gap-1.5">
                      <Badge tone="low" title={EVALUATION_HELP.matched} tooltipAlign="end">
                        {evaluation.matches.length} matched
                      </Badge>
                      {evaluation.missed.length > 0 ? (
                        <Badge tone="medium" title={EVALUATION_HELP.missed} tooltipAlign="end">
                          {evaluation.missed.length} missed
                        </Badge>
                      ) : null}
                      {evaluation.potentialFalsePositives.length > 0 ? (
                        <Badge tone="outline" title={EVALUATION_HELP.unmatched} tooltipAlign="end">
                          {evaluation.potentialFalsePositives.length} unmatched
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

                {evaluation.matches.length > 0 ? (
                  <div>
                    <p className="text-sm font-medium">Matched</p>
                    <ul className="mt-2 space-y-2">
                      {evaluation.matches.map((match) => (
                        <li
                          key={match.actual.id}
                          className="border-l-2 border-[var(--color-severity-low)] pl-3"
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge tone="accent" title={CATEGORY_HELP[match.expected.category]}>
                              {formatCategory(match.expected.category)}
                            </Badge>
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

                {evaluation.missed.length > 0 ? (
                  <div>
                    <p className="text-sm font-medium">Missed expected signals</p>
                    <ul className="mt-2 space-y-2">
                      {evaluation.missed.map((expected) => (
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

                {evaluation.potentialFalsePositives.length > 0 ? (
                  <div>
                    <p className="text-sm font-medium">Unmatched AI signals</p>
                    <p className="mt-0.5 text-xs text-[var(--color-ink-subtle)]">
                      These matched no expectation. That may mean a false positive, or it may mean
                      the assistant found something the answer key did not anticipate — which is why
                      they are listed for review rather than scored as errors.
                    </p>
                    <ul className="mt-2 space-y-2">
                      {evaluation.potentialFalsePositives.map((signal) => (
                        <li key={signal.id} className="border-l-2 border-[var(--color-border-strong)] pl-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge tone="outline" title={CATEGORY_HELP[signal.category]}>
                              {formatCategory(signal.category)}
                            </Badge>
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

                {evaluation.absences.length > 0 ? (
                  <div>
                    <p className="text-sm font-medium">Items expected to stay absent</p>
                    <ul className="mt-2 space-y-2">
                      {evaluation.absences.map((entry) => (
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
    </div>
  );
}
