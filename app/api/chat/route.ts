/**
 * POST /api/chat
 *
 * Answers one question about one project.
 *
 * The projectId in the body is the ONLY project the provider will see. There
 * is no route, parameter or body field through which a second project could be
 * requested in the same call.
 */

import { NextResponse } from 'next/server';
import { runProjectChat } from '@/lib/ai/chat';
import { ChatRequestSchema } from '@/lib/ai/schemas';
import { toAIProviderError } from '@/lib/ai/errors';
import { describeRequest, logEvent, startTimer } from '@/lib/logging/log';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const context = describeRequest(request, '/api/chat');
  const elapsedMs = startTimer();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    logEvent('warn', 'request.rejected', { ...context, reason: 'body was not valid JSON' });
    return NextResponse.json({ error: 'The request body was not valid JSON.' }, { status: 400 });
  }

  const parsed = ChatRequestSchema.safeParse(body);
  if (!parsed.success) {
    logEvent('warn', 'request.rejected', { ...context, reason: 'body failed schema validation' });
    return NextResponse.json(
      { error: 'A valid projectId and at least one message are required.' },
      { status: 400 },
    );
  }

  try {
    const result = await runProjectChat(parsed.data.projectId, parsed.data.messages, context);
    logEvent('info', 'request.completed', { ...context, status: 200, durationMs: elapsedMs() });
    return NextResponse.json({ result });
  } catch (error) {
    const providerError = toAIProviderError(error, context);
    logEvent('error', 'request.failed', {
      ...context,
      status: providerError.httpStatus,
      durationMs: elapsedMs(),
    });
    return NextResponse.json(
      { error: providerError.userMessage },
      { status: providerError.httpStatus },
    );
  }
}
