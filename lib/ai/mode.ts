/**
 * The AI mode indicator shown in the application header.
 *
 * Kept separate from `provider.ts` because this is presentation: it must never
 * throw, since a misconfigured AI_PROVIDER should surface as a visible warning
 * in the header rather than a crashed layout on every page.
 *
 * It reports configuration, not activity. It never reveals the API key.
 */

import { getProviderName, getProviderLabel } from './provider';

/** What the header renders. */
export interface AIMode {
  label: string;
  /** True when real Gemini calls are configured to happen. */
  isLive: boolean;
  /** Set when AI_PROVIDER holds a value that is not recognised. */
  misconfigured: boolean;
}

/**
 * Describes the configured AI mode.
 *
 * @returns the mode, defaulting to a flagged demo mode when AI_PROVIDER holds
 *          an unrecognised value. why not throw: the header renders on every
 *          page, and a typo in an env var should be reported, not fatal.
 */
export function describeAIMode(): AIMode {
  try {
    const name = getProviderName();
    return { label: getProviderLabel(name), isLive: name === 'gemini', misconfigured: false };
  } catch {
    return { label: 'Not configured', isLive: false, misconfigured: true };
  }
}
