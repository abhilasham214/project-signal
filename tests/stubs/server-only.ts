/**
 * Test stub for the `server-only` package.
 *
 * `server-only` throws when imported outside a React Server Component, which
 * would make `lib/ai/gemini.ts` unimportable from Vitest. Aliasing it to this
 * empty module lets the isolation tests import the payload builder.
 *
 * Importing that module does NOT create a client or make a request: the
 * GeminiProvider constructor is what reads the API key, and no test ever
 * constructs one. See tests/provider-safety.test.ts.
 */

export {};
