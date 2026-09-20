/**
 * POST /api/analyze
 *
 * Runs an analysis for one project and returns the validated result.
 *
 * This is one of only two routes that can reach an AI provider, and it does so
 * only in response to an explicit user action. why that matters: nothing calls
 * a provider during render, during build, or during static generation, so
 * `next build` and page loads cannot spend tokens.
 */

import { NextResponse } from 'next/server';
import { runAnalysis } from '@/lib/ai/analyzer';
import { AnalyzeRequestSchema } from '@/lib/ai/schemas';
import { toAIProviderError } from '@/lib/ai/errors';
import { describeRequest, logEvent, startTimer } from '@/lib/logging/log';

/** why force-dynamic: an analysis is an action with a side effect, never cached. */
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const context = describeRequest(request, '/api/analyze');
  const elapsedMs = startTimer();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    logEvent('warn', 'request.rejected', { ...context, reason: 'body was not valid JSON' });
    return NextResponse.json({ error: 'The request body was not valid JSON.' }, { status: 400 });
  }

  const parsed = AnalyzeRequestSchema.safeParse(body);
  if (!parsed.success) {
    logEvent('warn', 'request.rejected', { ...context, reason: 'body failed schema validation' });
    return NextResponse.json({ error: 'A valid projectId is required.' }, { status: 400 });
  }

  try {
    const run = await runAnalysis(parsed.data.projectId, context);
    logEvent('info', 'request.completed', { ...context, status: 200, durationMs: elapsedMs() });
    return NextResponse.json({ run });
  } catch (error) {
    // Typed errors carry a message that is safe to display. Anything else is
    // reduced to a generic 500 so no stack trace reaches the browser.
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
