/**
 * MockAIProvider — deterministic stand-in for Gemini.
 *
 * This provider exists so that tests, browser verification, CI, local
 * development and the public demo all run with ZERO Gemini API calls and zero
 * token spend. It is the default provider.
 *
 * What it is allowed to do: return predefined deterministic output.
 * What it must never do: appear in, or leak logic into, the Gemini path.
 *
 * Its output is deliberately RAW and unvalidated. It goes through the same Zod
 * parsing and the same evidence validation as a real Gemini response, so the
 * pipeline the tests exercise is the pipeline production uses. Some fixtures
 * cite unverifiable records on purpose — see `fixtures/analysis-fixtures.ts`.
 *
 * The chat side is not a per-project script. It reads the records of whichever
 * project it is handed and assembles an answer from them, so it behaves
 * sensibly on all five projects using one piece of generic logic.
 */

import { ANALYSIS_FIXTURES } from './fixtures/analysis-fixtures';
import type { AIProvider, ProviderName } from './provider';
import type { ChatMessage, ProviderAnalysisOutput, RawChatResult } from './schemas';
import type { Project } from '@/lib/types/project';

/** A question intent the mock chat can recognise. */
type ChatIntent =
  | 'UNRESOLVED_DECISIONS'
  | 'REPEATED_ISSUES'
  | 'RESOLVED_ITEMS'
  | 'RECENT_CHANGES'
  | 'DEPENDENCIES'
  | 'MISSING_INFORMATION'
  | 'OVERVIEW';

/** Keyword sets that map a question to an intent, tried in this order. */
const INTENT_KEYWORDS: ReadonlyArray<{ intent: ChatIntent; keywords: readonly string[] }> = [
  { intent: 'RESOLVED_ITEMS', keywords: ['resolved', 'closed', 'fixed', 'previously reported'] },
  { intent: 'REPEATED_ISSUES', keywords: ['repeat', 'recurring', 'again', 'more than once', 'pattern'] },
  { intent: 'UNRESOLVED_DECISIONS', keywords: ['unresolved', 'decision', 'pending', 'undecided', 'outstanding'] },
  { intent: 'MISSING_INFORMATION', keywords: ['missing', 'absent', 'not recorded', 'gap', 'incomplete'] },
  { intent: 'RECENT_CHANGES', keywords: ['change', 'changed', 'variation', 'revised', 'recently'] },
  { intent: 'DEPENDENCIES', keywords: ['depend', 'connected', 'related', 'blocked', 'waiting', 'holding', 'why'] },
];

/**
 * Classifies a question into one of the intents above.
 *
 * @returns the first intent whose keywords appear, or `OVERVIEW` when nothing
 *          matches. why a default rather than an apology: an unmatched
 *          question still deserves a useful, evidence-backed answer.
 */
function classifyQuestion(question: string): ChatIntent {
  const normalised = question.toLowerCase();
  for (const { intent, keywords } of INTENT_KEYWORDS) {
    if (keywords.some((keyword) => normalised.includes(keyword))) return intent;
  }
  return 'OVERVIEW';
}

/** Joins record ids into readable prose, e.g. "P001-M001, P001-M002 and P001-I001". */
function listIds(ids: readonly string[]): string {
  if (ids.length === 0) return 'none';
  if (ids.length === 1) return ids[0] as string;
  return `${ids.slice(0, -1).join(', ')} and ${ids[ids.length - 1]}`;
}

/** Builds the answer and citation list for one intent, from real records. */
function answerForIntent(project: Project, intent: ChatIntent): RawChatResult {
  switch (intent) {
    case 'UNRESOLVED_DECISIONS': {
      const pending = project.decisions.filter((decision) => decision.status === 'Pending');
      if (pending.length === 0) {
        return {
          answer:
            'The available records do not show any decision still outstanding on this project. Every decision record is marked as agreed.',
          citedSourceIds: project.decisions.map((decision) => decision.id),
        };
      }
      const lines = pending.map((decision) => `- ${decision.topic} (${decision.id}), owner ${decision.owner}, raised ${decision.date}.`);
      return {
        answer: `The records show ${pending.length} decision(s) still recorded as pending:\n${lines.join('\n')}\n\nThis is what the decision records state. Whether any of them is now settled outside these records is not something the available information can confirm.`,
        citedSourceIds: pending.map((decision) => decision.id),
      };
    }

    case 'REPEATED_ISSUES': {
      // Group issues by discipline; more than one in a discipline is the
      // closest thing to recurrence that can be read without interpretation.
      const byDiscipline = new Map<string, string[]>();
      for (const issue of project.issues) {
        const existing = byDiscipline.get(issue.discipline) ?? [];
        existing.push(issue.id);
        byDiscipline.set(issue.discipline, existing);
      }
      const repeated = [...byDiscipline.entries()].filter(([, ids]) => ids.length > 1);

      if (repeated.length === 0) {
        return {
          answer:
            'The issue records do not show more than one issue raised in any single discipline, so no recurring pattern is visible in the available information.',
          citedSourceIds: project.issues.map((issue) => issue.id),
        };
      }

      const lines = repeated.map(([discipline, ids]) => `- ${discipline}: ${ids.length} issues recorded (${listIds(ids)}).`);
      const citedSourceIds = repeated.flatMap(([, ids]) => ids);
      return {
        answer: `Reading the issue log by discipline, the following areas have more than one recorded issue:\n${lines.join('\n')}\n\nThat several issues share a discipline is a fact of the records. Whether they share a cause is an interpretation you may want to check against the individual descriptions.`,
        citedSourceIds,
      };
    }

    case 'RESOLVED_ITEMS': {
      const closed = project.issues.filter((issue) => issue.status === 'Closed');
      if (closed.length === 0) {
        return {
          answer: 'The available records do not show any issue marked as closed on this project.',
          citedSourceIds: project.issues.map((issue) => issue.id),
        };
      }
      const lines = closed.map((issue) => `- ${issue.title} (${issue.id}), raised ${issue.date}, closed ${issue.closedDate ?? 'date not recorded'}.`);
      return {
        answer: `${closed.length} issue(s) are recorded as closed:\n${lines.join('\n')}\n\nThese appear resolved in the records. Nothing later reopens them in the available information.`,
        citedSourceIds: closed.map((issue) => issue.id),
      };
    }

    case 'RECENT_CHANGES': {
      const changes = [...project.changes].sort((first, second) => second.date.localeCompare(first.date));
      if (changes.length === 0) {
        return {
          answer: 'The available records do not contain any change entries for this project.',
          citedSourceIds: [],
        };
      }
      const lines = changes.map((change) => `- ${change.date}: ${change.title} (${change.id}), origin ${change.origin}.`);
      return {
        answer: `The change records, most recent first:\n${lines.join('\n')}\n\nThese are the changes the records capture. Any effect on the programme would need to be read against the programme records rather than inferred from these entries alone.`,
        citedSourceIds: changes.map((change) => change.id),
      };
    }

    case 'DEPENDENCIES': {
      if (project.dependencies.length === 0) {
        return {
          answer: 'The available records do not contain any stated dependency for this project.',
          citedSourceIds: [],
        };
      }
      const lines = project.dependencies.map((dependency) => `- ${dependency.predecessor} precedes ${dependency.successor} (${dependency.id}). ${dependency.note}`);
      const openIssueIds = project.issues.filter((issue) => issue.status === 'Open').map((issue) => issue.id);
      return {
        answer: `The recorded dependencies on this project are:\n${lines.join('\n')}\n\n${
          openIssueIds.length > 0
            ? `Open issues that may relate to these sequences: ${listIds(openIssueIds)}. Reading them alongside the dependency notes may show where a sequence is currently held.`
            : 'No open issues are recorded against these sequences.'
        }`,
        citedSourceIds: [...project.dependencies.map((dependency) => dependency.id), ...openIssueIds],
      };
    }

    case 'MISSING_INFORMATION': {
      const openIssues = project.issues.filter((issue) => issue.status === 'Open');
      const pendingDecisions = project.decisions.filter((decision) => decision.status === 'Pending');
      if (openIssues.length === 0 && pendingDecisions.length === 0) {
        return {
          answer:
            'Nothing in the available records points to an expected item that is absent. All issues are recorded as closed and all decisions as agreed.',
          citedSourceIds: [],
        };
      }
      return {
        answer: `Reading for items the records raise but do not close out:\n- Open issues: ${listIds(openIssues.map((issue) => issue.id))}\n- Pending decisions: ${listIds(pendingDecisions.map((decision) => decision.id))}\n\nThese are items the records leave open rather than confirmed absences. Whether the underlying information exists outside these records is not something the available information can tell you.`,
        citedSourceIds: [...openIssues.map((issue) => issue.id), ...pendingDecisions.map((decision) => decision.id)],
      };
    }

    case 'OVERVIEW':
    default: {
      const openIssues = project.issues.filter((issue) => issue.status === 'Open');
      const pendingDecisions = project.decisions.filter((decision) => decision.status === 'Pending');
      const latestMeeting = [...project.meetings].sort((first, second) => second.date.localeCompare(first.date))[0];
      const latestReport = [...project.siteReports].sort((first, second) => second.date.localeCompare(first.date))[0];

      const citedSourceIds = [
        ...openIssues.map((issue) => issue.id),
        ...pendingDecisions.map((decision) => decision.id),
        ...(latestMeeting ? [latestMeeting.id] : []),
        ...(latestReport ? [latestReport.id] : []),
      ];

      return {
        answer: `Here is what the available records show for ${project.name}.\n\n- Open issues: ${openIssues.length} (${listIds(openIssues.map((issue) => issue.id))})\n- Pending decisions: ${pendingDecisions.length} (${listIds(pendingDecisions.map((decision) => decision.id))})\n- Most recent meeting: ${latestMeeting ? `${latestMeeting.title} on ${latestMeeting.date} (${latestMeeting.id})` : 'none recorded'}\n- Most recent site report: ${latestReport ? `${latestReport.area} on ${latestReport.date} (${latestReport.id})` : 'none recorded'}\n\nYou can ask about unresolved decisions, repeated issues, dependencies, recent changes, or which items were previously resolved.`,
        citedSourceIds,
      };
    }
  }
}

/**
 * The deterministic provider used in demo mode and every automated test.
 *
 * Makes no network calls of any kind.
 */
export class MockAIProvider implements AIProvider {
  readonly name: ProviderName = 'mock';

  /**
   * Returns the fixture analysis for the supplied project.
   *
   * @returns the fixture for that project id, or an empty signal list for a
   *          project with no fixture. why empty rather than throw: a dataset
   *          could gain a sixth project before a fixture is written for it, and
   *          "no signals were identified" is an honest demo outcome.
   */
  async analyzeProject(project: Project): Promise<ProviderAnalysisOutput> {
    return ANALYSIS_FIXTURES[project.id] ?? { signals: [] };
  }

  /**
   * Answers a question using only the supplied project records.
   *
   * @param messages the conversation so far; only the latest user message
   *        drives the answer, which keeps the mock deterministic.
   */
  async chatAboutProject(project: Project, messages: readonly ChatMessage[]): Promise<RawChatResult> {
    const latestUserMessage = [...messages].reverse().find((message) => message.role === 'user');
    if (!latestUserMessage) {
      return {
        answer: 'Ask a question about this project and I will answer from its records.',
        citedSourceIds: [],
      };
    }

    const intent = classifyQuestion(latestUserMessage.content);
    return answerForIntent(project, intent);
  }
}
