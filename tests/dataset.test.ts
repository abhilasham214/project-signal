/**
 * Dataset integrity.
 *
 * The dataset is the foundation of every other guarantee: evidence validation
 * is only meaningful if record ids are unique and stable. These tests fail
 * loudly if someone edits `data/projects.json` and breaks that.
 */

import { describe, expect, it } from 'vitest';
import projectsJson from '@/data/projects.json';
import evaluationJson from '@/data/evaluation.json';
import { RECORD_KINDS, getProject, listProjects } from '@/lib/projects';
import type { Project } from '@/lib/types/project';

const dataset = projectsJson as unknown as { projects: Project[] };

describe('dataset structure', () => {
  it('parses as valid JSON with a projects array', () => {
    expect(Array.isArray(dataset.projects)).toBe(true);
  });

  it('contains exactly 5 projects', () => {
    expect(dataset.projects).toHaveLength(5);
  });

  it('uses unique project ids', () => {
    const ids = dataset.projects.map((project) => project.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('gives every project the required header fields', () => {
    for (const project of dataset.projects) {
      expect(project.id).toMatch(/^P\d{3}$/);
      expect(project.name.length).toBeGreaterThan(0);
      expect(project.type.length).toBeGreaterThan(0);
      expect(project.location.length).toBeGreaterThan(0);
      expect(project.status.length).toBeGreaterThan(0);
      expect(project.description.length).toBeGreaterThan(0);
      expect(project.plannedCompletion).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(project.currentCompletion).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it('gives every project all eight record collections', () => {
    for (const project of dataset.projects) {
      for (const kind of RECORD_KINDS) {
        expect(Array.isArray(project[kind.collection])).toBe(true);
      }
    }
  });
});

describe('record ids', () => {
  it('are unique across the ENTIRE dataset, not just within a project', () => {
    // why globally unique: it makes cross-project evidence structurally
    // impossible to resolve, rather than merely unlikely to collide.
    const seen = new Set<string>();
    const duplicates: string[] = [];

    for (const project of dataset.projects) {
      for (const kind of RECORD_KINDS) {
        for (const record of project[kind.collection]) {
          if (seen.has(record.id)) duplicates.push(record.id);
          seen.add(record.id);
        }
      }
    }

    expect(duplicates).toEqual([]);
  });

  it('are prefixed with the id of the project that owns them', () => {
    for (const project of dataset.projects) {
      for (const kind of RECORD_KINDS) {
        for (const record of project[kind.collection]) {
          expect(record.id.startsWith(`${project.id}-`)).toBe(true);
        }
      }
    }
  });

  it('follow the documented per-kind id convention', () => {
    const expectedPattern: Record<string, RegExp> = {
      meetings: /^P\d{3}-M\d{3}$/,
      siteReports: /^P\d{3}-SR\d{3}$/,
      issues: /^P\d{3}-I\d{3}$/,
      decisions: /^P\d{3}-D\d{3}$/,
      changes: /^P\d{3}-C\d{3}$/,
      dependencies: /^P\d{3}-DEP\d{3}$/,
      contractorUpdates: /^P\d{3}-CU\d{3}$/,
      consultantUpdates: /^P\d{3}-CO\d{3}$/,
    };

    for (const project of dataset.projects) {
      for (const kind of RECORD_KINDS) {
        const pattern = expectedPattern[kind.collection];
        for (const record of project[kind.collection]) {
          expect(record.id).toMatch(pattern!);
        }
      }
    }
  });
});

describe('record content', () => {
  it('gives every dated record an ISO date', () => {
    for (const project of dataset.projects) {
      for (const kind of RECORD_KINDS) {
        if (kind.collection === 'dependencies') continue; // states a rule, not an event
        for (const record of project[kind.collection]) {
          expect(record).toHaveProperty('date');
          expect((record as { date: string }).date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        }
      }
    }
  });

  it('gives every record non-empty body text the assistant can read', () => {
    for (const project of dataset.projects) {
      for (const kind of RECORD_KINDS) {
        for (const record of project[kind.collection]) {
          const read = kind as unknown as { toBody: (r: unknown) => string };
          expect(read.toBody(record).trim().length).toBeGreaterThan(20);
        }
      }
    }
  });

  it('closes every closed issue with a date, and leaves open issues without one', () => {
    for (const project of dataset.projects) {
      for (const issue of project.issues) {
        expect(['Open', 'Closed']).toContain(issue.status);
        if (issue.status === 'Closed') {
          expect(issue.closedDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        } else {
          expect(issue.closedDate).toBeUndefined();
        }
      }
    }
  });

  it('never encodes the answer with a risk or expected-signal field', () => {
    // why: the prototype claim is that relationships are discovered by reading
    // across records. A field naming the finding would make that circular.
    const forbidden = ['risk', 'expectedSignal', 'isProblem', 'signal', 'category', 'severity'];
    const serialised = JSON.stringify(dataset);

    for (const field of forbidden) {
      expect(serialised).not.toContain(`"${field}":`);
    }
  });
});

describe('repository accessors', () => {
  it('lists five summaries with record counts and no record arrays', () => {
    const summaries = listProjects();
    expect(summaries).toHaveLength(5);

    for (const summary of summaries) {
      expect(summary.recordCount).toBeGreaterThan(0);
      expect(summary).not.toHaveProperty('meetings');
      expect(summary).not.toHaveProperty('issues');
    }
  });

  it('returns null for an unknown project id rather than throwing', () => {
    expect(getProject('P999')).toBeNull();
    expect(getProject('')).toBeNull();
  });
});

describe('evaluation dataset', () => {
  const evaluation = evaluationJson as unknown as {
    projects: Array<{ projectId: string; expectedSignals: Array<{ keyEvidence: string[] }> }>;
  };

  it('has an entry for every project', () => {
    const projectIds = dataset.projects.map((project) => project.id).sort();
    const evaluationIds = evaluation.projects.map((entry) => entry.projectId).sort();
    expect(evaluationIds).toEqual(projectIds);
  });

  it('only cites evidence ids that exist in the project they belong to', () => {
    // An answer key citing a record that does not exist would make every
    // evaluation result meaningless.
    for (const entry of evaluation.projects) {
      const project = getProject(entry.projectId);
      expect(project).not.toBeNull();

      const validIds = new Set(
        RECORD_KINDS.flatMap((kind) => project![kind.collection].map((record) => record.id)),
      );

      for (const expected of entry.expectedSignals) {
        for (const sourceId of expected.keyEvidence) {
          expect(validIds.has(sourceId)).toBe(true);
        }
      }
    }
  });
});
