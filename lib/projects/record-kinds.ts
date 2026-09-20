/**
 * The registry of the eight record kinds.
 *
 * Single source of truth for: which array on a Project holds a kind, what the
 * AI calls it in an evidence citation (`sourceType`), how it is labelled in the
 * UI, and how one record is reduced to a title and body for display.
 *
 * why a registry: the record kinds are enumerated in at least five places
 * (prompt payload, evidence resolution, dashboard tabs, evidence rendering,
 * record counting). Listing them once means adding a ninth kind is one edit
 * here, not a hunt through the codebase at 3am.
 */

import type {
  ChangeRecord,
  ConsultantUpdateRecord,
  ContractorUpdateRecord,
  DecisionRecord,
  DependencyRecord,
  IssueRecord,
  MeetingRecord,
  Project,
  ProjectRecord,
  SiteReportRecord,
} from '@/lib/types/project';

/** The `sourceType` value an AI provider must use when citing a record. */
export type SourceType =
  | 'meeting'
  | 'siteReport'
  | 'issue'
  | 'decision'
  | 'change'
  | 'dependency'
  | 'contractorUpdate'
  | 'consultantUpdate';

/** How one record kind is stored, named and displayed. */
export interface RecordKind {
  /** The value used in evidence citations. */
  sourceType: SourceType;
  /** The key of the array on a Project that holds records of this kind. */
  collection: keyof Pick<
    Project,
    | 'meetings'
    | 'siteReports'
    | 'issues'
    | 'decisions'
    | 'changes'
    | 'dependencies'
    | 'contractorUpdates'
    | 'consultantUpdates'
  >;
  /** Plural label shown on dashboard tabs. */
  label: string;
  /** Singular label shown on an evidence card. */
  singularLabel: string;
  /** Reduces a record of this kind to a display headline. */
  toTitle: (record: never) => string;
  /** Reduces a record of this kind to its display body text. */
  toBody: (record: never) => string;
  /** The people involved, where the kind has any. Empty array otherwise. */
  toParticipants: (record: never) => string[];
  /** The record's date, or null for kinds that carry none (dependencies). */
  toDate: (record: never) => string | null;
}

/**
 * All eight record kinds, in the order they appear as dashboard tabs.
 *
 * The `as never` casts on the accessor signatures let each entry be written
 * against its own concrete record type while the array stays a single
 * homogeneous list. Callers go through {@link getRecordKind}, which restores
 * the safe `ProjectRecord` surface.
 */
export const RECORD_KINDS: readonly RecordKind[] = [
  {
    sourceType: 'meeting',
    collection: 'meetings',
    label: 'Meetings',
    singularLabel: 'Meeting',
    toTitle: (r: MeetingRecord) => r.title,
    toBody: (r: MeetingRecord) => r.notes,
    toParticipants: (r: MeetingRecord) => r.attendees,
    toDate: (r: MeetingRecord) => r.date,
  },
  {
    sourceType: 'siteReport',
    collection: 'siteReports',
    label: 'Site Reports',
    singularLabel: 'Site report',
    toTitle: (r: SiteReportRecord) => r.area,
    toBody: (r: SiteReportRecord) => r.observations,
    toParticipants: (r: SiteReportRecord) => [r.reportedBy],
    toDate: (r: SiteReportRecord) => r.date,
  },
  {
    sourceType: 'issue',
    collection: 'issues',
    label: 'Issues',
    singularLabel: 'Issue',
    toTitle: (r: IssueRecord) => r.title,
    toBody: (r: IssueRecord) => r.description,
    toParticipants: (r: IssueRecord) => [r.raisedBy],
    toDate: (r: IssueRecord) => r.date,
  },
  {
    sourceType: 'decision',
    collection: 'decisions',
    label: 'Decisions',
    singularLabel: 'Decision',
    toTitle: (r: DecisionRecord) => r.topic,
    toBody: (r: DecisionRecord) => r.description,
    toParticipants: (r: DecisionRecord) => [r.owner],
    toDate: (r: DecisionRecord) => r.date,
  },
  {
    sourceType: 'change',
    collection: 'changes',
    label: 'Changes',
    singularLabel: 'Change',
    toTitle: (r: ChangeRecord) => r.title,
    toBody: (r: ChangeRecord) => r.description,
    toParticipants: () => [],
    toDate: (r: ChangeRecord) => r.date,
  },
  {
    sourceType: 'dependency',
    collection: 'dependencies',
    label: 'Dependencies',
    singularLabel: 'Dependency',
    toTitle: (r: DependencyRecord) => `${r.predecessor} \u2192 ${r.successor}`,
    toBody: (r: DependencyRecord) => `${r.description} ${r.note}`,
    toParticipants: () => [],
    // why null: a dependency states a sequencing rule, not an event on a date.
    toDate: () => null,
  },
  {
    sourceType: 'contractorUpdate',
    collection: 'contractorUpdates',
    label: 'Contractor Updates',
    singularLabel: 'Contractor update',
    toTitle: (r: ContractorUpdateRecord) => `${r.contractor} \u00b7 ${r.trade}`,
    toBody: (r: ContractorUpdateRecord) => r.update,
    toParticipants: (r: ContractorUpdateRecord) => [r.contractor],
    toDate: (r: ContractorUpdateRecord) => r.date,
  },
  {
    sourceType: 'consultantUpdate',
    collection: 'consultantUpdates',
    label: 'Consultant Updates',
    singularLabel: 'Consultant update',
    toTitle: (r: ConsultantUpdateRecord) => `${r.consultant} \u00b7 ${r.discipline}`,
    toBody: (r: ConsultantUpdateRecord) => r.update,
    toParticipants: (r: ConsultantUpdateRecord) => [r.consultant],
    toDate: (r: ConsultantUpdateRecord) => r.date,
  },
] as const;

/** Every valid `sourceType` value, for schema validation and prompt text. */
export const SOURCE_TYPES: readonly SourceType[] = RECORD_KINDS.map((kind) => kind.sourceType);

/**
 * Looks up a record kind by its `sourceType`.
 *
 * @returns the kind, or `undefined` if the sourceType is not one of the eight.
 *          An unknown sourceType means a provider invented one, so callers
 *          treat `undefined` as a rejection rather than an error to throw.
 */
export function getRecordKind(sourceType: string): RecordKind | undefined {
  return RECORD_KINDS.find((kind) => kind.sourceType === sourceType);
}

/** A record paired with the kind it belongs to, ready for display. */
export interface DisplayableRecord {
  id: string;
  sourceType: SourceType;
  kindLabel: string;
  title: string;
  body: string;
  participants: string[];
  date: string | null;
}

/**
 * Converts a raw record into the flat shape the UI and evidence cards render.
 *
 * @param kind the registry entry describing how to read this record
 * @param record the record itself, which must belong to that kind
 */
export function toDisplayableRecord(kind: RecordKind, record: ProjectRecord): DisplayableRecord {
  const read = kind as unknown as {
    toTitle: (r: ProjectRecord) => string;
    toBody: (r: ProjectRecord) => string;
    toParticipants: (r: ProjectRecord) => string[];
    toDate: (r: ProjectRecord) => string | null;
  };
  return {
    id: record.id,
    sourceType: kind.sourceType,
    kindLabel: kind.singularLabel,
    title: read.toTitle(record),
    body: read.toBody(record),
    participants: read.toParticipants(record),
    date: read.toDate(record),
  };
}
