/**
 * Project-scoped chat orchestration.
 *
 * The isolation rule for chat is the same as for analysis and is enforced the
 * same way: a project id is resolved to exactly ONE project, and that project
 * is the only thing handed to the provider. When P001 is selected, P002 to
 * P005 are not loaded, not serialised and not reachable.
 *
 * Kept separate from `analyzer.ts` on purpose. Analysis performs a structured
 * sweep and its output is a reviewable artefact; chat answers one question and
 * its output is prose. They use different prompts and they fail differently.
 */

import { getProvider } from './provider';
import { UnknownProjectError } from './errors';
import type { ChatMessage, ValidatedChatResult } from './schemas';
import { getProject } from '@/lib/projects';
import { validateChatCitations } from '@/lib/validation/evidence';
import { logEvent, startTimer, type LogFields } from '@/lib/logging/log';

/**
 * Answers one question about one project.
 *
 * @param projectId the selected project, and the only project the provider
 *        will see
 * @param messages the conversation so far, oldest first
 * @returns the answer with its citations resolved to real records from this
 *          project. Citations that do not resolve are dropped rather than
 *          shown — see `validateChatCitations` for why the answer survives.
 * @param context request identifiers to attach to every log line
 * @throws {UnknownProjectError} when the id is not in the dataset
 * @throws {AIProviderError} subclasses on provider misconfiguration or failure
 */
export async function runProjectChat(
  projectId: string,
  messages: readonly ChatMessage[],
  context: LogFields = {},
): Promise<ValidatedChatResult> {
  const elapsedMs = startTimer();
  const project = getProject(projectId);
  if (!project) {
    logEvent('warn', 'chat.unknown_project', { ...context, projectId });
    throw new UnknownProjectError(projectId);
  }

  const provider = await getProvider();
  // why counts, not text: the question is user input and is not logged.
  logEvent('info', 'chat.started', {
    ...context,
    projectId,
    provider: provider.name,
    messageCount: messages.length,
  });

  // Only `project` crosses this line.
  const raw = await provider.chatAboutProject(project, messages);

  const citations = validateChatCitations(project, raw.citedSourceIds);

  const droppedCitations = raw.citedSourceIds.length - citations.length;
  if (droppedCitations > 0) {
    logEvent('warn', 'chat.citations_dropped', {
      ...context,
      projectId,
      droppedCount: droppedCitations,
      claimedCount: raw.citedSourceIds.length,
    });
  }

  logEvent('info', 'chat.completed', {
    ...context,
    projectId,
    provider: provider.name,
    citationCount: citations.length,
    answerChars: raw.answer.length,
    durationMs: elapsedMs(),
  });
  return { answer: raw.answer, citations };
}
