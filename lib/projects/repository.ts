/**
 * Project repository — the only module that reads `data/projects.json`.
 *
 * Every other part of the application asks for a project by id and receives
 * that project alone. Nothing hands out the full dataset, because the
 * application's central isolation guarantee is that one analysis or one chat
 * turn can only ever see one project.
 */

import datasetJson from '@/data/projects.json';
import type { Project, ProjectRecord, ProjectSummary } from '@/lib/types/project';
import { RECORD_KINDS, getRecordKind, type RecordKind } from './record-kinds';

/**
 * The parsed dataset, held module-level so the JSON is read once per process.
 *
 * why a cast: the JSON is checked structurally by the dataset test suite
 * (tests/dataset.test.ts) rather than at runtime on every request. A malformed
 * dataset is a build-time defect, not a user-facing error path.
 */
const DATASET = datasetJson as unknown as { projects: Project[] };

/** Index from project id to project, built once. */
const PROJECTS_BY_ID = new Map<string, Project>(
  DATASET.projects.map((project) => [project.id, project]),
);

/** Counts every record across all eight collections of one project. */
function countRecords(project: Project): number {
  return RECORD_KINDS.reduce((total, kind) => total + project[kind.collection].length, 0);
}

/**
 * Lists every project as a card-level summary, without records.
 *
 * @returns summaries in dataset order, for the projects listing page.
 */
export function listProjects(): ProjectSummary[] {
  return DATASET.projects.map((project) => {
    const {
      meetings: _meetings,
      siteReports: _siteReports,
      issues: _issues,
      decisions: _decisions,
      changes: _changes,
      dependencies: _dependencies,
      contractorUpdates: _contractorUpdates,
      consultantUpdates: _consultantUpdates,
      ...summary
    } = project;
    return { ...summary, recordCount: countRecords(project) };
  });
}

/** Every project id in the dataset, used for route generation and validation. */
export function listProjectIds(): string[] {
  return DATASET.projects.map((project) => project.id);
}

/**
 * Fetches one project and all of its records.
 *
 * @param projectId the project to load
 * @returns the project, or `null` when the id is not in the dataset. Callers
 *          turn `null` into a 404 or a validation error; this never throws so
 *          that a bad id in a URL cannot surface as a stack trace.
 */
export function getProject(projectId: string): Project | null {
  return PROJECTS_BY_ID.get(projectId) ?? null;
}

/** How many records one project holds, across all eight collections. */
export function getRecordCount(project: Project): number {
  return countRecords(project);
}

/**
 * Finds a single record inside one project by its id.
 *
 * Lookup is scoped to the project passed in, never to the dataset. why: this
 * function backs evidence resolution, and an id from a different project must
 * come back as "not found" rather than silently resolving.
 *
 * @returns the record with the kind it belongs to, or `null` if this project
 *          contains no record with that id.
 */
export function findRecordInProject(
  project: Project,
  recordId: string,
): { record: ProjectRecord; kind: RecordKind } | null {
  for (const kind of RECORD_KINDS) {
    const record = project[kind.collection].find((candidate) => candidate.id === recordId);
    if (record) return { record, kind };
  }
  return null;
}

/**
 * Finds a record in one project, additionally requiring a declared sourceType.
 *
 * @param declaredSourceType the `sourceType` the citation claimed
 * @returns the record and kind when the id exists in this project AND the
 *          declared sourceType matches where it actually lives; `null`
 *          otherwise. A mismatch is treated as a failed citation rather than
 *          quietly corrected, so the provider's claim is never papered over.
 */
export function findRecordOfType(
  project: Project,
  recordId: string,
  declaredSourceType: string,
): { record: ProjectRecord; kind: RecordKind } | null {
  const kind = getRecordKind(declaredSourceType);
  if (!kind) return null;

  const record = project[kind.collection].find((candidate) => candidate.id === recordId);
  return record ? { record, kind } : null;
}
