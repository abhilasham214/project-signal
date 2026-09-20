/**
 * Typed errors for the AI layer.
 *
 * Every failure mode gets its own class rather than a bare `throw new Error`.
 * why: the API routes turn these into specific, honest messages for the user
 * ("no API key is configured" reads very differently from "the model returned
 * something we could not parse"), and at 3am the class name alone tells you
 * which half of the pipeline broke.
 *
 * `userMessage` is what may be shown in the browser. It never contains a stack
 * trace, a key, a prompt, or a raw provider payload.
 */

import { describeError, logEvent, type LogFields } from '@/lib/logging/log';

/** Base class so a route can catch every AI failure in one place. */
export class AIProviderError extends Error {
  /** Safe to display to the user. */
  readonly userMessage: string;
  /** Maps to an HTTP status in the API routes. */
  readonly httpStatus: number;

  constructor(message: string, userMessage: string, httpStatus: number) {
    super(message);
    this.name = new.target.name;
    this.userMessage = userMessage;
    this.httpStatus = httpStatus;
  }
}

/** AI_PROVIDER names something other than `mock` or `gemini`. */
export class UnknownProviderError extends AIProviderError {
  constructor(requested: string) {
    super(
      `AI_PROVIDER is set to "${requested}", which is not a known provider.`,
      'The configured AI provider is not recognised. Set AI_PROVIDER to "mock" or "gemini".',
      500,
    );
  }
}

/**
 * AI_PROVIDER=gemini but GEMINI_API_KEY is absent.
 *
 * This is deliberately fatal. There is no fall back to the mock provider,
 * because silently answering with fixtures when the user asked for Gemini
 * would make the prototype lie about what it just did.
 */
export class MissingApiKeyError extends AIProviderError {
  constructor() {
    super(
      'AI_PROVIDER=gemini but GEMINI_API_KEY is not set.',
      'Gemini mode is selected but no API key is configured. Add GEMINI_API_KEY to .env.local, or set AI_PROVIDER=mock to use demo mode.',
      500,
    );
  }
}

/** The Gemini call exceeded the request timeout. */
export class ProviderTimeoutError extends AIProviderError {
  constructor(timeoutMs: number) {
    super(
      `Gemini did not respond within ${timeoutMs}ms.`,
      'The AI provider did not respond in time. Please try again.',
      504,
    );
  }
}

/** The Gemini API rejected the request or failed. */
export class ProviderRequestError extends AIProviderError {
  /** The HTTP status Google returned, when there was one (401, 404, 429...). */
  readonly upstreamStatus?: number;

  constructor(detail: string, upstreamStatus?: number, options?: { cause?: unknown }) {
    super(
      `Gemini request failed: ${detail}`,
      'The AI provider could not complete this request. Please try again.',
      502,
    );
    this.upstreamStatus = upstreamStatus;
    // why: keeps the SDK/network error reachable so `describeError` can log
    // its code (ENOTFOUND, timeouts) instead of only the flattened message.
    if (options?.cause !== undefined) this.cause = options.cause;
  }
}

/**
 * A response came back but was not usable.
 *
 * Covers an empty body, text that is not JSON, and JSON that does not match
 * the expected schema. All three mean the same thing to a user: nothing
 * trustworthy arrived.
 */
export class InvalidProviderResponseError extends AIProviderError {
  constructor(detail: string) {
    super(
      `Provider returned an unusable response: ${detail}`,
      'The AI provider returned a response that could not be read. No signals were produced.',
      502,
    );
  }
}

/** The requested project id is not in the dataset. */
export class UnknownProjectError extends AIProviderError {
  constructor(projectId: string) {
    super(
      `No project with id "${projectId}" exists in the dataset.`,
      'That project could not be found.',
      404,
    );
  }
}

/**
 * Narrows an unknown thrown value to something a route can respond with.
 *
 * Every failure is logged here, server-side, with its full detail. why: the
 * browser only ever receives the generic `userMessage`, so without this log the
 * real reason (bad key, quota, unknown model) would be invisible to whoever is
 * debugging.
 *
 * @param context fields identifying the request, so this line joins the rest
 *        of that request's log lines.
 * @returns the error itself when it is already an `AIProviderError`, otherwise
 *          a generic 500 that reveals nothing about internals.
 */
export function toAIProviderError(error: unknown, context: LogFields = {}): AIProviderError {
  const typed = error instanceof AIProviderError;
  logEvent('error', typed ? 'ai.request.failed' : 'ai.request.unexpected_error', {
    ...context,
    httpStatus: typed ? error.httpStatus : 500,
    upstreamStatus: error instanceof ProviderRequestError ? error.upstreamStatus : undefined,
    ...describeError(error),
  });

  if (typed) return error;
  return new AIProviderError(
    error instanceof Error ? error.message : String(error),
    'Something went wrong while processing this request.',
    500,
  );
}
