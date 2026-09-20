# Data model

## Files

| File | Purpose | Read by |
|---|---|---|
| `data/projects.json` | The synthetic dataset: 5 projects, 156 records | `lib/projects/repository.ts`, and nothing else |
| `data/evaluation.json` | The answer key | `lib/evaluation/match.ts`, and nothing else |

The separation is deliberate and enforced by tests. The dataset is what the AI sees; the
answer key is what the AI must never see.

## Project schema

```ts
interface Project {
  id: string;                 // "P001"
  name: string;
  type: string;               // "Commercial Office Fit-Out"
  location: string;
  client: string;
  status: string;             // "Construction"
  description: string;
  plannedCompletion: string;  // ISO date — the baseline
  currentCompletion: string;  // ISO date — current forecast

  meetings: MeetingRecord[];
  siteReports: SiteReportRecord[];
  issues: IssueRecord[];
  decisions: DecisionRecord[];
  changes: ChangeRecord[];
  dependencies: DependencyRecord[];
  contractorUpdates: ContractorUpdateRecord[];
  consultantUpdates: ConsultantUpdateRecord[];
}
```

`plannedCompletion` and `currentCompletion` are separate fields so drift is visible
without being labelled as a problem. The dashboard renders a divergence in amber; it does
not call it a delay.

## Record types

Eight kinds, each modelled on a document a construction manager actually receives.

| Kind | `sourceType` | Id pattern | Distinctive fields |
|---|---|---|---|
| Meeting | `meeting` | `P001-M001` | `title`, `attendees[]`, `notes` |
| Site report | `siteReport` | `P001-SR001` | `reportedBy`, `area`, `observations` |
| Issue | `issue` | `P001-I001` | `title`, `raisedBy`, `discipline`, `status`, `closedDate?` |
| Decision | `decision` | `P001-D001` | `topic`, `owner`, `status`, `agreedDate?` |
| Change | `change` | `P001-C001` | `title`, `origin` |
| Dependency | `dependency` | `P001-DEP001` | `predecessor`, `successor`, `note` |
| Contractor update | `contractorUpdate` | `P001-CU001` | `contractor`, `trade`, `update` |
| Consultant update | `consultantUpdate` | `P001-CO001` | `consultant`, `discipline`, `update` |

Every record carries a `date` except dependencies, which state a sequencing rule rather
than an event.

`status` on issues (`Open`/`Closed`) and decisions (`Pending`/`Agreed`) is not an answer
key — every real issue register and decision log has these columns. What the dataset never
does is label a record as risky or noteworthy.

## Stable ids

Ids are **globally unique across the whole dataset**, achieved by prefixing each record
with its owning project: `P001-M001`, not `M001`.

This matters more than it looks. It makes cross-project evidence *structurally*
impossible to resolve rather than merely unlikely to collide. When the model analysing
P002 cites `P001-M001`, lookup is scoped to P002's collections, that id is not there, and
the citation is rejected. If ids were bare (`M001` in every project), a cross-project
citation could silently resolve to the wrong record.

`tests/dataset.test.ts` asserts global uniqueness, the per-kind id pattern, and the
project prefix.

## The registry

`lib/projects/record-kinds.ts` is the single source of truth mapping each kind to its
collection, its `sourceType`, its UI labels, and how to reduce it to a title and body.

The eight kinds would otherwise be enumerated in at least five places — the prompt
payload, evidence resolution, dashboard tabs, evidence rendering, record counting. One
registry means adding a ninth kind is one edit, not a hunt.

`toDisplayableRecord` flattens any record into `{ id, sourceType, kindLabel, title, body,
participants, date }`. The UI and the evidence cards consume only that shape, so no
component knows about the eight underlying structures.

## Relationships — and why none are encoded

There is **no** `relatedRecords` field, no `blocks` pointer, no `causedBy` link.

The relationships that matter are in the prose and the dates. An approval is outstanding
in an issue record; a dependency record states that ceiling works follow that approval; a
site report three weeks later records no ceiling activity; a contractor update asks for a
date. Four records, four authors, four formats, one situation.

Encoding the link would make the demonstration circular — the model would be reading a
graph somebody already built rather than discovering it. `tests/dataset.test.ts` asserts
that no `risk`, `expectedSignal`, `isProblem`, `signal`, `category` or `severity` field
appears anywhere in the dataset.

## Synthetic dataset design

Five projects, each built to require a different kind of cross-record reading.

**P001 · Riverside Commercial Tower** (Bengaluru, 27 records) — *dependency.*
HVAC drawings issued for review and never returned; a stated dependency putting ceiling
works after approved duct setting-out; consecutive site reports recording no activity; a
contractor escalating to a crew-release notice. A clash found during review is itself an
unresolved decision, which is why the approval has not come back. Requires following a
chain, not spotting a keyword.

**P002 · Harbourfront Workplace Refurbishment** (Hong Kong, 33 records) — *recurrence.*
The same waterproofing threshold detail fails on Level 3 in March, Level 5 in May and
Level 8 in July. Each was reworked and closed, so any single record looks handled. Only
the pattern is the finding — and a hold point agreed in June was never added to the
inspection plan, while two more cores remain to be done. Tests whether closed issues can
still be read as a trend.

**P003 · Marina Bay Regional Headquarters** (Singapore, 30 records) — *unresolved decision.*
A facade panel material has been under selection since April across five meetings, each
deferring for a different reason. Three separate work packages are held by it. Tests
whether an absence — a decision that keeps not being made — can be surfaced.

**P004 · Clerkenwell Studio Campus** (London, 34 records) — *change and schedule.*
Three unrelated changes (a discontinued light fitting, a late client instruction, a
shipping delay) converge on one revised completion date and a commissioning window
quietly cut from four weeks to three. Tests aggregation across unrelated origins.

**P005 · Lower Parel Innovation Hub** (Mumbai, 32 records) — *the control.*
A genuinely alarming moisture problem: readings far over specification, flooring halted,
a leaking pipe found. Then it is repaired, dried, retested twice, accepted, installed,
and re-inspected four weeks later with no defects. A second acoustic issue follows the
same arc.

P005 is the most important project in the dataset. A system that pattern-matches on
alarming language will surface it. A system that reads dates will not. It is the only
project whose expected result is **no signals**.

## Counts

| Project | Records | Scenario |
|---|---|---|
| P001 | 27 | Dependency, unresolved decision, schedule warning |
| P002 | 33 | Repeated issue, missing information |
| P003 | 30 | Unresolved decision, dependency, schedule warning |
| P004 | 34 | Change, schedule warning, unresolved decision |
| P005 | 32 | Healthy — resolved issues must stay resolved |
| **Total** | **156** | |
