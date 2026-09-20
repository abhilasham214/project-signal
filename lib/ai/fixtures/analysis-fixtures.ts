/**
 * Deterministic analysis fixtures for demo and test mode.
 *
 * READ THIS BEFORE CHANGING ANYTHING HERE.
 *
 * These fixtures are keyed by project id, and that is the ONLY place in the
 * codebase where a project id selects an outcome. It is confined to the mock
 * provider on purpose. The Gemini path (`lib/ai/gemini.ts`) contains no
 * per-project branching at all — it sends the selected project to the model
 * and processes whatever comes back. If per-project logic ever appears in the
 * Gemini path, the prototype stops demonstrating anything.
 *
 * These are RAW fixtures: they stand in for unvalidated model output and go
 * through exactly the same Zod parsing and evidence validation as a real
 * Gemini response. Nothing here bypasses a guard.
 *
 * Two fixtures deliberately cite records that cannot be verified:
 *
 *   - P001 cites `P001-SR999`, an id that does not exist. That signal keeps
 *     its valid citations and shows the bad one as rejected.
 *   - P002 contains a signal citing only `P001-M001` and `P001-I002` — real
 *     ids, but from a DIFFERENT project. That signal is discarded entirely.
 *
 * why fake a hallucination: it lets a reviewer see the evidence guard working
 * in demo mode, without having to wait for a real model to invent a citation.
 */

import type { RawAnalysisResult } from '../schemas';

/**
 * Fixture analysis output per project id.
 *
 * P005 returns no signals. That is not an oversight — it is the point of that
 * project. Its one concerning issue was investigated, corrected and confirmed
 * resolved, so an assistant reading the dates correctly has nothing active to
 * raise.
 */
export const ANALYSIS_FIXTURES: Readonly<Record<string, RawAnalysisResult>> = {
  P001: {
    signals: [
      {
        category: 'DEPENDENCY',
        title: 'Outstanding HVAC ductwork approval appears to be affecting ceiling works on Levels 7 to 9',
        description:
          'Ductwork shop drawings for Levels 7 to 9 were issued for review on 29 May 2026 and the records do not show them returned. A stated dependency sequences ceiling grid installation after approved duct setting-out, and site reports from 16 June onwards record no ceiling or ductwork activity on those levels while partitions there are complete.',
        reason:
          'The issue log, the dependency register, three consecutive site reports and a contractor update were read together. Each describes the same holding point from a different side: the approval is outstanding, the sequence requires it, the work has not started, and the trade says it cannot start.',
        severity: 'HIGH',
        confidence: 'HIGH',
        recommendedReview:
          'You may wish to confirm with the services consultant when the Levels 7 to 9 ductwork submission can be returned, and check what holding work remains available to the ceiling trade in the meantime.',
        evidence: [
          { sourceType: 'issue', sourceId: 'P001-I001' },
          { sourceType: 'dependency', sourceId: 'P001-DEP001' },
          { sourceType: 'siteReport', sourceId: 'P001-SR002' },
          { sourceType: 'siteReport', sourceId: 'P001-SR003' },
          { sourceType: 'contractorUpdate', sourceId: 'P001-CU001' },
          // Deliberately unverifiable. See the module header.
          { sourceType: 'siteReport', sourceId: 'P001-SR999' },
        ],
      },
      {
        category: 'UNRESOLVED_DECISION',
        title: 'Level 8 duct and sprinkler clash resolution method has not been selected',
        description:
          'Two resolution options for the Level 8 clash were reviewed at a workshop on 18 June 2026 and both were modelled and presented on 25 June 2026. The decision record remains pending, and the fire services engineer states no instruction has been given on either option.',
        reason:
          'The decision record, the workshop note and two consultant updates describe the same open choice across three weeks without any record of a selection being made.',
        severity: 'HIGH',
        confidence: 'HIGH',
        recommendedReview:
          'It may warrant review whether the design team can be asked to accept the reduced ceiling height, or whether the sprinkler reroute should be instructed, so that the ductwork drawings can be returned.',
        evidence: [
          { sourceType: 'decision', sourceId: 'P001-D001' },
          { sourceType: 'meeting', sourceId: 'P001-M003' },
          { sourceType: 'consultantUpdate', sourceId: 'P001-CO002' },
          { sourceType: 'consultantUpdate', sourceId: 'P001-CO003' },
        ],
      },
      {
        category: 'SCHEDULE_WARNING',
        title: 'Contractor has given notice of crew release on 20 July 2026',
        description:
          'The main contractor has issued formal notice that the ceiling and drywall crew will be released from site on 20 July 2026 unless approved ductwork setting-out is received, and states that re-mobilisation would be subject to availability. An earlier update records the crew already held for eleven days on holding work.',
        reason:
          'A contractor notice, an earlier contractor update and a meeting note were read together with the site report showing the Level 5 snagging used as holding work is now substantially exhausted.',
        severity: 'MEDIUM',
        confidence: 'MEDIUM',
        recommendedReview:
          'You may wish to check what re-mobilisation would involve if the crew is released, and whether the outstanding approval can be resolved before that date.',
        evidence: [
          { sourceType: 'contractorUpdate', sourceId: 'P001-CU003' },
          { sourceType: 'contractorUpdate', sourceId: 'P001-CU002' },
          { sourceType: 'meeting', sourceId: 'P001-M005' },
          { sourceType: 'siteReport', sourceId: 'P001-SR005' },
        ],
      },
      {
        category: 'DEPENDENCY',
        title: 'Material storage on Level 6 is recorded as at capacity',
        description:
          'Ceiling grid, ceiling tile and ductwork material for Levels 7 to 9 has accumulated in the Level 6 holding area because installation has not started. Site reports describe the area becoming congested and then reaching capacity, with further deliveries held at the supplier.',
        reason:
          'Two site reports and an issue record describe the same accumulation over three weeks, connected to the same stalled installation sequence.',
        severity: 'LOW',
        confidence: 'MEDIUM',
        recommendedReview:
          'It may be useful to confirm whether held deliveries need rescheduling, and whether alternative storage is required if the holding period extends.',
        evidence: [
          { sourceType: 'issue', sourceId: 'P001-I003' },
          { sourceType: 'siteReport', sourceId: 'P001-SR003' },
          { sourceType: 'siteReport', sourceId: 'P001-SR004' },
        ],
      },
    ],
  },

  P002: {
    signals: [
      {
        category: 'REPEATED_ISSUE',
        title: 'Washroom core flood tests have failed at the same threshold detail on three floors',
        description:
          'Flood tests failed on Level 3 in March 2026, Level 5 in May 2026 and Level 8 in July 2026. Each failure was at the door threshold on the corridor side, and each was traced to the membrane upstand terminating below the detailed height. All three were reworked and subsequently passed.',
        reason:
          'Three separate issue records, spread across five months, describe the same failure at the same detail. A quality assurance update read alongside them confirms the pattern rather than treating each as isolated.',
        severity: 'HIGH',
        confidence: 'HIGH',
        recommendedReview:
          'With Levels 9 and 11 still to be waterproofed, it may warrant review how the threshold detail is briefed to each gang before work starts on the remaining cores.',
        evidence: [
          { sourceType: 'issue', sourceId: 'P002-I001' },
          { sourceType: 'issue', sourceId: 'P002-I002' },
          { sourceType: 'issue', sourceId: 'P002-I003' },
          { sourceType: 'consultantUpdate', sourceId: 'P002-CO003' },
        ],
      },
      {
        category: 'MISSING_INFORMATION',
        title: 'Pre-tiling membrane hold point does not appear in the inspection and test plan',
        description:
          'A hold point requiring inspection of the membrane upstand before tiling was proposed on 18 June 2026 and agreed in principle. The records do not show the inspection and test plan being revised to include it. A September site report notes no such hold point exists for the Level 9 or Level 11 cores, which are scheduled under the current plan.',
        reason:
          'An open issue, a site report from three months later and a quality assurance update all state the same absence, and the Level 8 failure record notes no pre-tiling inspection was carried out.',
        severity: 'MEDIUM',
        confidence: 'HIGH',
        recommendedReview:
          'You may wish to confirm whether the inspection and test plan has been revised before the Level 9 core is waterproofed on 7 September.',
        evidence: [
          { sourceType: 'issue', sourceId: 'P002-I004' },
          { sourceType: 'siteReport', sourceId: 'P002-SR007' },
          { sourceType: 'consultantUpdate', sourceId: 'P002-CO003' },
        ],
      },
      {
        category: 'UNRESOLVED_DECISION',
        title: 'Method statement for upstand termination remains in draft',
        description:
          'A written method statement covering membrane upstand termination was requested on 23 July 2026 before any further core is waterproofed. A draft was received on 13 August 2026 and the decision record remains pending. The subcontractor has asked whether to wait for approval before starting the Level 9 core.',
        reason:
          'A pending decision record, a meeting note and a direct contractor question were read together. The contractor question dated 2 September shows the matter was still unresolved at the point work was due to mobilise.',
        severity: 'MEDIUM',
        confidence: 'HIGH',
        recommendedReview:
          'It may warrant review whether the draft method statement can be returned before Level 9 waterproofing begins, and what the subcontractor should do in the meantime.',
        evidence: [
          { sourceType: 'decision', sourceId: 'P002-D002' },
          { sourceType: 'contractorUpdate', sourceId: 'P002-CU004' },
          { sourceType: 'meeting', sourceId: 'P002-M006' },
        ],
      },
      {
        category: 'INCONSISTENCY',
        title: 'Unverifiable cross-project citation example',
        description:
          'This fixture signal exists to demonstrate the evidence guard. Every record it cites belongs to a different project, so none of them can be verified against this project and the signal is discarded before it can be displayed.',
        reason:
          'Included so that the discarded-signal path is visible in demo mode without waiting for a real model to invent a citation.',
        severity: 'LOW',
        confidence: 'LOW',
        recommendedReview: 'This signal should never appear in the interface.',
        evidence: [
          { sourceType: 'meeting', sourceId: 'P001-M001' },
          { sourceType: 'issue', sourceId: 'P001-I002' },
        ],
      },
    ],
  },

  P003: {
    signals: [
      {
        category: 'UNRESOLVED_DECISION',
        title: 'Entrance facade panel material has been under selection since April 2026',
        description:
          'Three panel options were presented on 23 April 2026, sampled on 14 May 2026 and costed in full on 12 August 2026. The client capital review did not confirm a facade allowance and no response to the cost comparison is recorded. The decision remains pending after five months.',
        reason:
          'A pending decision record and four meeting notes across five months describe the same choice being deferred at each meeting, with the reason for deferral changing but the outcome not.',
        severity: 'HIGH',
        confidence: 'HIGH',
        recommendedReview:
          'It may warrant review what specifically is now needed to reach a selection, given the cost comparison requested in July was issued in August.',
        evidence: [
          { sourceType: 'decision', sourceId: 'P003-D001' },
          { sourceType: 'meeting', sourceId: 'P003-M001' },
          { sourceType: 'meeting', sourceId: 'P003-M004' },
          { sourceType: 'meeting', sourceId: 'P003-M005' },
        ],
      },
      {
        category: 'DEPENDENCY',
        title: 'Three separate work packages are recorded as held by the panel material selection',
        description:
          'The secondary steel package cannot be released because design loading varies by around 40 percent between options. Reception floor setting-out is held because the threshold line depends on carrier system depth. The reception ceiling package is held at approximately 80 percent pending the facade head condition.',
        reason:
          'Three open issues raised by different people in different months all trace back to the same unresolved selection, and a dependency record states the sequencing relationship directly.',
        severity: 'HIGH',
        confidence: 'HIGH',
        recommendedReview:
          'You may wish to review whether any of these three packages can be progressed independently, for example by confirming the threshold line separately from the panel selection.',
        evidence: [
          { sourceType: 'dependency', sourceId: 'P003-DEP001' },
          { sourceType: 'issue', sourceId: 'P003-I001' },
          { sourceType: 'issue', sourceId: 'P003-I002' },
          { sourceType: 'issue', sourceId: 'P003-I003' },
        ],
      },
      {
        category: 'SCHEDULE_WARNING',
        title: 'Reserved fabrication capacity is recorded as lapsing on 30 September 2026',
        description:
          'The contractor states that the secondary steel subcontractor holds October fabrication capacity informally and will release it if no order is placed by 30 September 2026. The facade installation window in the programme opens on 2 November 2026, and stated panel lead times range from 10 to 18 weeks from order.',
        reason:
          'A contractor update, a dependency note and a consultant lead-time statement were read together against the installation window recorded in an earlier meeting.',
        severity: 'HIGH',
        confidence: 'MEDIUM',
        recommendedReview:
          'It may warrant review whether the fabrication slot can be held beyond 30 September, and what the practical latest order date is for each remaining option.',
        evidence: [
          { sourceType: 'contractorUpdate', sourceId: 'P003-CU002' },
          { sourceType: 'dependency', sourceId: 'P003-DEP002' },
          { sourceType: 'consultantUpdate', sourceId: 'P003-CO001' },
        ],
      },
      {
        category: 'DEPENDENCY',
        title: 'Stored reception floor finishes are recorded as occupying space allocated to another delivery',
        description:
          'Reception floor finishes have been stored on Level 1 since 25 August 2026 because they cannot be set out. The contractor notes that this area was allocated to Level 1 joinery arriving in early October and asks for an alternative arrangement or a deferred delivery.',
        reason:
          'A site report and a contractor update three weeks apart describe the same storage consequence of the held setting-out, now colliding with a separate planned delivery.',
        severity: 'LOW',
        confidence: 'MEDIUM',
        recommendedReview:
          'You may wish to confirm whether the joinery delivery should be deferred or alternative storage arranged.',
        evidence: [
          { sourceType: 'siteReport', sourceId: 'P003-SR005' },
          { sourceType: 'contractorUpdate', sourceId: 'P003-CU003' },
        ],
      },
    ],
  },

  P004: {
    signals: [
      {
        category: 'CHANGE',
        title: 'Three separate changes have been recorded against the same delivery period',
        description:
          'A lighting fixture substitution was instructed in May 2026 after the specified product was discontinued, extending lead time from 11 to 16 weeks. Four enclosed meeting rooms were added on Level 2 in July 2026, two days after partition works commenced. The raised access floor delivery moved from 31 August to 21 September 2026.',
        reason:
          'Three change records from different origins — procurement, client request and supply chain — were read together because each is cited in the same programme revision.',
        severity: 'MEDIUM',
        confidence: 'HIGH',
        recommendedReview:
          'It may be useful to review whether the combined effect of these three changes has been valued together rather than separately.',
        evidence: [
          { sourceType: 'change', sourceId: 'P004-C001' },
          { sourceType: 'change', sourceId: 'P004-C002' },
          { sourceType: 'change', sourceId: 'P004-C003' },
        ],
      },
      {
        category: 'SCHEDULE_WARNING',
        title: 'Practical completion has been revised and no float is reported on the second fix sequence',
        description:
          'Practical completion moved from 29 January 2027 to 19 February 2027, with the lighting substitution, the Level 2 variation and the raised floor delay recorded as contributing items. The contractor states no float remains on the Levels 1 and 2 second fix sequence and that holding work will be exhausted within two weeks.',
        reason:
          'A change record, a contractor update and the programme review meeting note describe the same revision from three angles, and a site report confirms trades were on holding activities at the time.',
        severity: 'HIGH',
        confidence: 'HIGH',
        recommendedReview:
          'You may wish to review what holding work remains available and whether the raised floor delivery date of 28 September is firm.',
        evidence: [
          { sourceType: 'change', sourceId: 'P004-C004' },
          { sourceType: 'contractorUpdate', sourceId: 'P004-CU003' },
          { sourceType: 'meeting', sourceId: 'P004-M006' },
          { sourceType: 'siteReport', sourceId: 'P004-SR005' },
        ],
      },
      {
        category: 'UNRESOLVED_DECISION',
        title: 'No decision recorded on the reduced commissioning window',
        description:
          'The revised programme retains three weeks for commissioning and client witness testing against four weeks in the baseline. The decision on whether to recover that week was raised on 17 September 2026 and remains pending. The broadcast presentation space requires witness testing within that window.',
        reason:
          'A pending decision record, an open issue raised by the client representative and a dependency record all concern the same reduced window, and the contractor has flagged it separately.',
        severity: 'MEDIUM',
        confidence: 'MEDIUM',
        recommendedReview:
          'It may warrant review what duration the witness testing of the presentation space actually requires, before the shortened window is accepted.',
        evidence: [
          { sourceType: 'decision', sourceId: 'P004-D003' },
          { sourceType: 'issue', sourceId: 'P004-I004' },
          { sourceType: 'dependency', sourceId: 'P004-DEP004' },
          { sourceType: 'contractorUpdate', sourceId: 'P004-CU004' },
        ],
      },
      {
        category: 'CHANGE',
        title: 'Abortive partition work recorded on Level 2 remains unvalued',
        description:
          'Around 18 linear metres of stud erected on Level 2 required removal after the meeting room instruction arrived two days into partition works. The cost manager records that the variation including abortive work is still being valued, and that no valuation has been prepared for any time-related cost arising from the revised completion date.',
        reason:
          'An open issue, a site report from the day of the instruction and a cost management update were read together, the last of which is the most recent and still describes both valuations as outstanding.',
        severity: 'LOW',
        confidence: 'MEDIUM',
        recommendedReview:
          'You may wish to confirm when the variation valuation is expected and whether time-related cost is being assessed alongside it.',
        evidence: [
          { sourceType: 'issue', sourceId: 'P004-I002' },
          { sourceType: 'siteReport', sourceId: 'P004-SR001' },
          { sourceType: 'consultantUpdate', sourceId: 'P004-CO003' },
        ],
      },
    ],
  },

  // No signals. The Level 2 moisture issue and the quiet room acoustic
  // shortfall were both explicitly resolved and confirmed by later records, so
  // neither is an active signal. This drives the empty state in the UI.
  P005: { signals: [] },
};
