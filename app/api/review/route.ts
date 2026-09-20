/**
 * POST /api/review
 *
 * Records a human decision on a signal.
 *
 * Note what this route does NOT import: no provider, no analyzer, no chat.
 * The human review path never touches the AI layer. That separation is the
 * product claim made structural — an AI code path has no way to write a review
 * status, because it cannot reach the function that sets one.
 */

import { NextResponse } from 'next/server';
import { ReviewRequestSchema } from '@/lib/ai/schemas';
import { getSignal, saveReview } from '@/lib/store';
import { describeRequest, logEvent } from '@/lib/logging/log';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const context = describeRequest(request, '/api/review');

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    logEvent('warn', 'request.rejected', { ...context, reason: 'body was not valid JSON' });
    return NextResponse.json({ error: 'The request body was not valid JSON.' }, { status: 400 });
  }

  const parsed = ReviewRequestSchema.safeParse(body);
  if (!parsed.success) {
    logEvent('warn', 'request.rejected', { ...context, reason: 'body failed schema validation' });
    return NextResponse.json(
      { error: 'A valid signalId and review status are required.' },
      { status: 400 },
    );
  }

  // why check the signal exists: a review keyed to an unknown signal id would
  // sit in the store forever, attached to nothing and visible nowhere.
  const existing = await getSignal(parsed.data.signalId);
  if (!existing) {
    // why a likely cause: on a host with no persistent disk the run this signal
    // belonged to may simply be gone. See `store.write_failed` earlier in the log.
    logEvent('warn', 'review.signal_not_found', { ...context, signalId: parsed.data.signalId });
    return NextResponse.json({ error: 'That signal could not be found.' }, { status: 404 });
  }

  const review = await saveReview(parsed.data.signalId, parsed.data.status, parsed.data.note);
  // why no note: it is the reviewer's own free text.
  logEvent('info', 'review.saved', {
    ...context,
    signalId: parsed.data.signalId,
    status: parsed.data.status,
  });
  return NextResponse.json({ review });
}
