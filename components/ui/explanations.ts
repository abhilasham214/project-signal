/**
 * Plain-language explanations shown when a user hovers a label.
 *
 * One file so every place that shows a tag (dashboard, signal page, evaluation)
 * explains it identically. why: the same word explained two ways on two pages is
 * how a reviewer stops trusting either.
 *
 * Wording follows the product rule: the AI "may warrant review", it never
 * predicts. Nothing here may claim a signal is a confirmed problem.
 */

/** What each signal category means. Keys match `SIGNAL_CATEGORIES`. */
export const CATEGORY_HELP: Record<string, string> = {
  DEPENDENCY: 'One activity or approval appears to be affecting another.',
  REPEATED_ISSUE: 'A similar problem shows up more than once over time.',
  UNRESOLVED_DECISION: 'A choice was raised but the records never show it being settled.',
  CHANGE: 'Scope, product, delivery or programme appears to have moved.',
  SCHEDULE_WARNING: 'Taken together, the records suggest timing may warrant review.',
  MISSING_INFORMATION: 'An expected record, approval or response is absent.',
  INCONSISTENCY: 'Two or more records disagree with each other.',
};

/** What severity means. It is attention, not predicted impact. */
export const SEVERITY_HELP: Record<string, string> = {
  HIGH: 'May warrant prompt attention. This is how much review it may deserve, not a prediction of delay or cost.',
  MEDIUM: 'May warrant review when convenient. Not a prediction of delay or cost.',
  LOW: 'Worth a look, but the records suggest limited urgency. Not a prediction of impact.',
};

/** What confidence means. It is about the evidence, not about the outcome. */
export const CONFIDENCE_HELP: Record<string, string> = {
  HIGH: 'Several records point the same way.',
  MEDIUM: 'The records support this, but not from many angles.',
  LOW: 'A single record hints at this. Read the evidence before relying on it.',
};

/** What each review status means. Only a person can move a signal off New. */
export const STATUS_HELP: Record<string, string> = {
  NEW: 'Nobody has reviewed this signal yet.',
  CONFIRMED: 'A reviewer decided this is worth attention.',
  INVESTIGATE: 'A reviewer wants more information before deciding.',
  DISMISSED: 'A reviewer decided this is not something to act on.',
};

/** The three decision buttons, with a fuller explanation than a one-line hint. */
export const DECISION_HELP: Record<string, string> = {
  CONFIRMED:
    'Confirm: you agree this is worth attention. It stays on the project as a confirmed signal.',
  INVESTIGATE:
    'Investigate: you cannot decide yet. Use it while you wait for a consultant reply or another record.',
  DISMISSED:
    'Dismiss: you do not think this needs action. The signal is kept, marked dismissed, so the decision is traceable.',
};

/** Evaluation summary figures. */
export const EVALUATION_HELP = {
  projectsAnalysed: 'How many of the projects have had an analysis run and saved.',
  expected: 'Problems the answer key says a careful reader should notice. The AI never sees this key.',
  matched:
    'Expected problems the AI found. A match needs the same category and at least one shared cited record.',
  missed:
    'Expected problems no AI signal matched. Projects that are not analysed yet count every expectation as missed.',
  unmatched:
    'AI signals that match nothing in the key. They may be false alarms or real findings the key did not anticipate, so they are listed for you to judge, not scored as errors.',
  absences:
    'Topics that were already resolved and must NOT be raised as active. This counts how many the AI correctly left alone.',
  humanConfirmed: 'Signals a person marked Confirmed.',
  humanInvestigating: 'Signals a person marked Investigate.',
  humanDismissed: 'Signals a person marked Dismissed.',
} as const;

/** Project overview figures on the dashboard. */
export const OVERVIEW_HELP = {
  planned: 'The completion date in the original programme.',
  current: 'The completion date in the latest records. Amber means it differs from planned.',
  records: 'Meetings, site reports, issues, decisions and other records held for this project.',
  aiSignals: 'How many verified potential signals the last analysis produced.',
  highSeverity: 'Signals that may warrant prompt attention. Not a prediction of delay.',
} as const;
