/**
 * Home page.
 *
 * Three jobs, in this order: state the problem, explain how to use the
 * prototype, and be explicit about what the AI does not do. The last of those
 * is not a disclaimer bolted on at the end — it is part of the product claim,
 * so it gets equal visual weight to the rest of the page.
 */

import Link from 'next/link';
import { Badge, Card, CardBody, CardHeader, CardTitle, Notice, SectionLabel } from '@/components/ui/primitives';

/** The six steps of the prototype workflow, as shown in "How it works". */
const WORKFLOW_STEPS = [
  {
    number: '01',
    title: 'Select a project',
    body: 'Choose one of the five synthetic construction projects.',
  },
  {
    number: '02',
    title: 'Analyze',
    body: "Ask the assistant to analyse the selected project's available information.",
  },
  {
    number: '03',
    title: 'Review signals',
    body: 'Potential emerging signals are surfaced with supporting evidence.',
  },
  {
    number: '04',
    title: 'Investigate',
    body: 'Open the underlying project records to understand why a signal was surfaced.',
  },
  {
    number: '05',
    title: 'Ask questions',
    body: 'Use the project assistant to ask questions about the selected project.',
  },
  {
    number: '06',
    title: 'Human review',
    body: 'Confirm, dismiss, or mark a signal for investigation. The decision stays yours.',
  },
];

const AI_DOES = [
  'Connects information across project records',
  'Identifies recurring patterns',
  'Surfaces unresolved items',
  'Highlights dependencies',
  'Points you toward supporting evidence',
  "Answers questions about the selected project's information",
];

const AI_DOES_NOT = [
  'Make project decisions',
  'Assign responsibility',
  'Guarantee future outcomes',
  'Modify schedules',
  'Close issues',
  'Contact project participants',
];

export default function HomePage() {
  return (
    <div className="space-y-10">
      {/* Problem statement */}
      <section className="max-w-3xl">
        <Badge tone="outline">Internal prototype</Badge>
        <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">Project Signal</h1>
        <p className="mt-1 text-base text-[var(--color-ink-muted)]">
          AI-Assisted Construction Project Intelligence
        </p>

        <div className="mt-5 space-y-3 text-sm leading-relaxed text-[var(--color-ink-muted)]">
          <p>
            Construction information is often distributed across meeting notes, site reports, issue
            logs, decisions, contractor updates and other project records. Individually each record
            is unremarkable. Read together, they sometimes describe something that deserves
            attention.
          </p>
          <p>
            Project Signal explores how AI can help connect these fragmented signals and surface
            information that may deserve attention earlier — always with the underlying records
            attached, so a construction manager can judge for themselves.
          </p>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Link
            href="/projects"
            className="inline-flex items-center rounded-lg border border-transparent bg-[var(--color-accent)] px-5 py-2.5 shadow-sm hover:opacity-90 text-sm font-medium text-white"
          >
            Select a project
          </Link>
          <Link
            href="/evaluation"
            className="inline-flex items-center rounded-lg border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-5 py-2.5 hover:bg-[var(--color-surface-raised)] text-sm font-medium"
          >
            View evaluation
          </Link>
        </div>
      </section>

      {/* The operating principle, stated plainly. */}
      <section>
        <Card>
          <CardBody className="grid gap-4 sm:grid-cols-3">
            {[
              { step: 'The AI proposes', body: 'Evidence-backed signals, each citing project records by id.' },
              { step: 'The application verifies', body: 'Every cited record is checked against the selected project. Unverifiable citations are rejected.' },
              { step: 'The human decides', body: 'Confirm, dismiss or investigate. No AI output changes the project.' },
            ].map((item) => (
              <div key={item.step}>
                <SectionLabel>{item.step}</SectionLabel>
                <p className="mt-2 text-sm leading-relaxed text-[var(--color-ink-muted)]">{item.body}</p>
              </div>
            ))}
          </CardBody>
        </Card>
      </section>

      {/* How it works */}
      <section>
        <h2 className="text-lg font-semibold tracking-tight">How it works</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {WORKFLOW_STEPS.map((step) => (
            <Card key={step.number}>
              <CardBody>
                <p className="font-mono text-sm font-semibold text-[var(--color-accent)]">{step.number}</p>
                <h3 className="mt-2 text-base font-semibold">{step.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-[var(--color-ink-muted)]">{step.body}</p>
              </CardBody>
            </Card>
          ))}
        </div>

        <div className="mt-4">
          <Notice title="Important">
            This prototype uses synthetic project data. AI outputs are suggestions for human review,
            not project decisions.
          </Notice>
        </div>
      </section>

      {/* Capabilities and limits, given equal weight */}
      <section className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>What AI does</CardTitle>
          </CardHeader>
          <CardBody>
            <ul className="space-y-2 text-sm text-[var(--color-ink-muted)]">
              {AI_DOES.map((item) => (
                <li key={item} className="flex gap-2">
                  <span aria-hidden="true" className="text-[var(--color-severity-low)]">
                    +
                  </span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>What AI does not do</CardTitle>
          </CardHeader>
          <CardBody>
            <ul className="space-y-2 text-sm text-[var(--color-ink-muted)]">
              {AI_DOES_NOT.map((item) => (
                <li key={item} className="flex gap-2">
                  <span aria-hidden="true" className="text-[var(--color-severity-high)]">
                    &minus;
                  </span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      </section>
    </div>
  );
}
