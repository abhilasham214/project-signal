# Evaluation

## What is being evaluated

Whether the pipeline surfaces the things a careful reader of the records would notice,
and — equally — whether it leaves alone the things that were resolved.

This is a prototype evaluation on synthetic data. It is not a measure of production
accuracy. See [Limitations](#limitations) before quoting any number from it.

## The evaluation dataset

`data/evaluation.json` holds, per project:

```json
{
  "projectId": "P001",
  "expectedSignals": [
    {
      "category": "DEPENDENCY",
      "description": "Outstanding HVAC ductwork approval for Levels 7 to 9 is affecting downstream ceiling grid and duct installation on those levels.",
      "keyEvidence": ["P001-I001", "P001-DEP001", "P001-SR002", "P001-CU001"]
    }
  ]
}
```

P005 additionally carries `expectedAbsences`: topics that must **not** be surfaced,
with the records proving they were resolved.

```json
{
  "topic": "Level 2 screed moisture",
  "reason": "Investigated, cause repaired, two consecutive surveys within specification, substrate accepted, flooring installed and accepted with no defects, confirmed again at four weeks.",
  "resolutionEvidence": ["P005-I001", "P005-SR004", "P005-SR005", "P005-CO002", "P005-CU005"]
}
```

Twelve expected signals across P001–P004, and two expected absences on P005.

## The answer key never reaches a model

`data/evaluation.json` is imported by `lib/evaluation/match.ts` and by nothing else.
Nothing in `lib/ai` imports it, directly or transitively. Evaluation runs strictly
*after* an analysis has completed, reading results already stored.

`tests/isolation.test.ts` asserts that no expected-signal description and no
expected-absence reason appears in any prompt payload for any of the five projects, and
that neither global prompt contains answer-key text.

## Matching logic

A signal matches an expectation when **both** hold:

1. the **categories are identical**, and
2. **at least one cited record is common** to the AI signal and the expectation's
   `keyEvidence`.

Matching deliberately ignores wording. A model that writes "HVAC approval is holding
ceiling works" and a key that says "HVAC approval is affecting downstream installation"
describe the same finding; scoring on text would measure phrasing, not reasoning.

Condition 2 is what makes the result meaningful. Category alone would reward guessing
"DEPENDENCY" on a project that plainly has dependencies. Requiring a shared record checks
the signal was reached by reading the same source material.

Each AI signal can satisfy **at most one** expectation, so one broad signal cannot be
counted as covering three separate expectations. Where several signals match the same
expectation, the one sharing the most evidence is taken.

## What is reported

| Output | Meaning |
|---|---|
| **Matched** | Expectation met by a signal sharing category and evidence |
| **Missed** | Expectation no signal matched |
| **Unmatched AI signals** | Signals matching no expectation |
| **Absences respected** | Resolved topics correctly left alone |
| **Human confirmed / investigating / dismissed** | Review decisions recorded |

An unanalysed project reports every expectation as missed — the honest reading of "we
have not looked yet".

### "Unmatched" is not "wrong"

Unmatched signals are listed for review, never scored as errors. A signal can be
unmatched because it is a false positive, or because it found something real that the
answer key did not anticipate. The prototype cannot tell those apart, so it does not
pretend to. Calling the column "potential false positives" and then counting them as
errors would be exactly the overclaiming this product is built to avoid.

In demo mode P002 produces one unmatched signal of the second kind: a low-severity
storage-congestion observation that is well-evidenced but simply not in the key.

### Absences carry equal weight

A system that surfaces P005's resolved moisture issue has failed, even though every
record it would cite is real and quoted accurately. Evidence validation cannot catch
that — the citations are genuine; the temporal reading is wrong. Only the absence check
catches it, which is why P005 exists.

## Reading the page

`/evaluation` shows a summary row and a per-project breakdown with matched, missed,
unmatched and absence results, each linking to the underlying signal or naming the key
evidence. Projects that have not been analysed say so rather than scoring zero.

## Limitations

State these alongside any figure from this page.

1. **Five synthetic projects cannot establish accuracy.** The sample is far too small for
   any rate computed from it to be stable.
2. **The dataset and the prompt were written by the same author.** The records were
   constructed knowing what the prompt asks for. That is close to the definition of an
   optimistic evaluation.
3. **The key encodes one reading.** "What a careful reader should notice" was decided by
   one person without inter-rater agreement. A quantity surveyor and a site manager would
   likely write different keys.
4. **Evidence overlap is a proxy for correct reasoning, not proof of it.** A signal can
   cite the right records and draw a poor conclusion, and it will still match.
5. **The records are clean, complete and consistent.** Real project information is none
   of those. No contradictory dates, no missing weeks, no ambiguous attachments.
6. **Demo-mode results measure the fixtures, not a model.** Any evaluation run in demo
   mode is a pipeline check. Only `AI_PROVIDER=gemini` produces a result that says
   anything about model behaviour.

## What it is legitimately good for

- Confirming the pipeline holds end to end: analysis, validation, persistence, review.
- Confirming the evidence guard rejects unverifiable and cross-project citations.
- Confirming resolved items stay unsurfaced (the P005 control).
- Comparing prompt revisions against a fixed reference while iterating.
- Showing a reviewer what an evaluation harness for this problem would look like at
  scale.

It does not show that the approach is reliable, and this page says so on its face.
