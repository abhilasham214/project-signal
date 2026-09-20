/** Public surface of the projects module. */
export {
  findRecordInProject,
  findRecordOfType,
  getProject,
  getRecordCount,
  listProjectIds,
  listProjects,
} from './repository';
export {
  RECORD_KINDS,
  SOURCE_TYPES,
  getRecordKind,
  toDisplayableRecord,
  type DisplayableRecord,
  type RecordKind,
  type SourceType,
} from './record-kinds';
