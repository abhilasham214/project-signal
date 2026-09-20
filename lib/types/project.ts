/**
 * Domain types for the synthetic construction project dataset.
 *
 * These describe `data/projects.json` and nothing else. They are the shape of
 * the *source material* a construction manager already has — deliberately kept
 * free of any AI concept, so the dataset stays readable on its own terms.
 *
 * Note: no field anywhere here marks a record as risky, problematic or
 * noteworthy. why: the prototype's whole claim is that the model discovers
 * relationships by reading across records. A `risk: true` field would make the
 * demonstration circular.
 */

/** A dated note from a project meeting. */
export interface MeetingRecord {
  id: string;
  date: string;
  title: string;
  attendees: string[];
  notes: string;
}

/** A dated observation made on site by a supervisor. */
export interface SiteReportRecord {
  id: string;
  date: string;
  reportedBy: string;
  area: string;
  observations: string;
}

/** An entry in the project issue log. `status` mirrors a real issue register. */
export interface IssueRecord {
  id: string;
  date: string;
  title: string;
  raisedBy: string;
  discipline: string;
  description: string;
  status: 'Open' | 'Closed';
  /** Present only when the issue was closed. */
  closedDate?: string;
}

/** A project decision, either settled or still outstanding. */
export interface DecisionRecord {
  id: string;
  date: string;
  topic: string;
  description: string;
  owner: string;
  status: 'Pending' | 'Agreed';
  /** Present only when the decision was agreed. */
  agreedDate?: string;
}

/** An instructed change to scope, product, delivery or programme. */
export interface ChangeRecord {
  id: string;
  date: string;
  title: string;
  description: string;
  origin: string;
}

/** A stated sequencing relationship between two activities. */
export interface DependencyRecord {
  id: string;
  description: string;
  predecessor: string;
  successor: string;
  note: string;
}

/** A written update from a contractor. */
export interface ContractorUpdateRecord {
  id: string;
  date: string;
  contractor: string;
  trade: string;
  update: string;
}

/** A written update from a consultant. */
export interface ConsultantUpdateRecord {
  id: string;
  date: string;
  consultant: string;
  discipline: string;
  update: string;
}

/** Any one of the eight record types, as stored in a project. */
export type ProjectRecord =
  | MeetingRecord
  | SiteReportRecord
  | IssueRecord
  | DecisionRecord
  | ChangeRecord
  | DependencyRecord
  | ContractorUpdateRecord
  | ConsultantUpdateRecord;

/** A single synthetic construction project and all of its records. */
export interface Project {
  id: string;
  name: string;
  type: string;
  location: string;
  client: string;
  status: string;
  description: string;
  plannedCompletion: string;
  currentCompletion: string;
  meetings: MeetingRecord[];
  siteReports: SiteReportRecord[];
  issues: IssueRecord[];
  decisions: DecisionRecord[];
  changes: ChangeRecord[];
  dependencies: DependencyRecord[];
  contractorUpdates: ContractorUpdateRecord[];
  consultantUpdates: ConsultantUpdateRecord[];
}

/**
 * The card-level view of a project, without its records.
 *
 * Used by the projects listing so the list page never has to load or ship
 * 150-odd records to the browser just to render five cards.
 */
export type ProjectSummary = Omit<
  Project,
  | 'meetings'
  | 'siteReports'
  | 'issues'
  | 'decisions'
  | 'changes'
  | 'dependencies'
  | 'contractorUpdates'
  | 'consultantUpdates'
> & { recordCount: number };
