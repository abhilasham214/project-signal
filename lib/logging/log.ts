/**
 * Structured server-side logging.
 *
 * Every line is `[project-signal] {json}` on stdout/stderr. why JSON: Vercel's
 * runtime logs are searchable by text, and one flat object per event means you
 * can search `"event":"gemini.call.failed"` or `"requestId":"..."` and get
 * exactly the lines you want, in order, without guessing at free-form prose.
 *
 * WHAT MUST NEVER BE LOGGED
 *   - GEMINI_API_KEY, in any form. `redactSecrets` strips it from every string
 *     that passes through here, because provider error text is third-party
 *     text and might echo a request.
 *   - Prompt or record text. Log sizes and ids, not content. The records are
 *     synthetic today, but the habit must survive the day they are not.
 *
 * Server-only by convention: nothing under `components/` may import this.
 */

type LogLevel = 'info' | 'warn' | 'error';

/** Flat key/value context attached to an event. Values must be JSON-safe. */
export type LogFields = Record<string, unknown>;

/**
 * Removes the configured Gemini key from text about to be logged.
 *
 * @returns the text unchanged when no key is configured.
 */
export function redactSecrets(text: string): string {
  const apiKey = (process.env.GEMINI_API_KEY ?? '').trim();
  return apiKey === '' ? text : text.split(apiKey).join('[redacted]');
}

/**
 * Reduces any thrown value to loggable fields.
 *
 * Captures the class name, message, HTTP-ish status and `cause` chain, which is
 * where the Google SDK and Node's fetch put the real reason (`ENOTFOUND`,
 * `UND_ERR_CONNECT_TIMEOUT`, and so on). Stack traces are included only for
 * errors that are not one of ours, because those are the ones nobody has seen
 * before.
 */
export function describeError(error: unknown): LogFields {
  if (!(error instanceof Error)) return { errorMessage: redactSecrets(String(error)) };

  const fields: LogFields = {
    errorName: error.name,
    errorMessage: redactSecrets(error.message),
  };

  const withStatus = error as Error & { status?: unknown; code?: unknown; cause?: unknown };
  if (withStatus.status !== undefined) fields.errorStatus = withStatus.status;
  if (withStatus.code !== undefined) fields.errorCode = withStatus.code;

  if (withStatus.cause instanceof Error) {
    const cause = withStatus.cause as Error & { code?: unknown };
    fields.causeName = cause.name;
    fields.causeMessage = redactSecrets(cause.message);
    if (cause.code !== undefined) fields.causeCode = cause.code;
  }

  // why: our own typed errors are already self-explanatory; a stack is noise.
  if (!('userMessage' in error) && error.stack) fields.stack = redactSecrets(error.stack);

  return fields;
}

/**
 * Emits one structured log line.
 *
 * Never throws. why: a logging failure must not turn a working request into a
 * failed one.
 */
export function logEvent(level: LogLevel, event: string, fields: LogFields = {}): void {
  try {
    const line = `[project-signal] ${JSON.stringify({ event, ...fields })}`;
    if (level === 'error') console.error(line);
    else if (level === 'warn') console.warn(line);
    else console.log(line);
  } catch {
    // Unserialisable field (circular structure). Fall back to the event name.
    console.error(`[project-signal] {"event":"${event}","logError":"unserialisable fields"}`);
  }
}

/** Returns a function giving milliseconds elapsed since this call. */
export function startTimer(): () => number {
  const startedAt = performance.now();
  return () => Math.round(performance.now() - startedAt);
}

/**
 * Builds the identifiers that tie one request's log lines together.
 *
 * `requestId` is ours and appears on every line for the request. `vercelId` is
 * Vercel's `x-vercel-id`, which matches the platform's own request log entry,
 * so a line here can be joined to the function invocation it ran in.
 */
export function describeRequest(request: Request, route: string): LogFields {
  return {
    route,
    requestId: crypto.randomUUID(),
    vercelId: request.headers.get('x-vercel-id') ?? undefined,
  };
}

/**
 * The deployment facts that most often explain "works locally, fails on
 * Vercel". Booleans and names only — never the key itself.
 */
export function describeRuntime(): LogFields {
  return {
    aiProvider: (process.env.AI_PROVIDER ?? '').trim() || 'mock (unset)',
    geminiKeyPresent: (process.env.GEMINI_API_KEY ?? '').trim() !== '',
    geminiModel: (process.env.GEMINI_MODEL ?? '').trim() || 'default',
    nodeVersion: process.version,
    vercelEnv: process.env.VERCEL_ENV ?? 'not-vercel',
    vercelRegion: process.env.VERCEL_REGION ?? undefined,
  };
}
