# Project Signal

**AI-Assisted Construction Project Intelligence** — an internal prototype.

Built for an AI Practice Consultant assignment at M Moser Associates, from the
Construction Manager's perspective.

---

## The problem

> Project information is scattered across drawings, models, specifications, meetings,
> messages and site reports. We often recognise problems too late. Could AI help us see
> emerging problems earlier?

A meeting note saying an approval is still outstanding is unremarkable. A site report
saying a crew stood down is unremarkable. A contractor email asking for a date is
unremarkable. Read together, in order, they describe a work front that has been stopped
for three weeks.

Nobody misses this because they are careless. They miss it because the three records live
in three different places and nobody reads them side by side.

## What this prototype does

Project Signal asks an AI to read one project's records and propose **signals** — things
that may warrant review — each citing the specific records it relied on. The application
then verifies every citation against that project before anything is displayed. A human
confirms, dismisses, or marks it for investigation.

> **The LLM proposes evidence-backed signals. The application verifies the evidence.
> The human makes the decision.**

The AI does not decide anything. It does not predict delays, assign responsibility,
change a schedule or close an issue. It points at records and explains why it read them
together.

## Architecture

```
                        PROJECT SIGNAL
                              │
                      Selected Project  ← exactly one, always
                              │
                   ┌──────────┴──────────┐
                   ↓                     ↓
             AI Analysis             Project Chat
                   ↓                     ↓
            Gemini | Mock          Gemini | Mock
                   ↓
          Structured JSON signals
                   ↓
             Zod validation        ← per signal; bad ones discarded, not repaired
                   ↓
          Evidence validation      ← every cited id resolved in THIS project
                   ↓                  NO EVIDENCE = NO SIGNAL
             Human review          ← NEW / CONFIRMED / DISMISSED / INVESTIGATE
                   ↓
            Final decision         ← always a person
```

Layout:

```
app/            Routes: home, projects, dashboard, signal detail, evaluation, API
components/     UI: dashboard, signals, chat, primitives
lib/ai/         provider · gemini · mock · analyzer · chat · prompts · schemas · errors
lib/projects/   The only reader of data/projects.json
lib/validation/ Evidence validation — the trust boundary
lib/store/      File-backed runs and human reviews (.data/, gitignored)
lib/evaluation/ The only reader of data/evaluation.json
data/           projects.json (5 projects, 156 records) · evaluation.json (answer key)
tests/          113 Vitest tests, mock provider only
docs/           DATA_MODEL · AI_DESIGN · EVALUATION · MANUAL_GEMINI_TESTING
```

## How to run

No API key is required. The prototype runs fully in demo mode out of the box.

```bash
npm install
npm run dev
```

Open <http://localhost:3000>. The header shows **AI Provider: Demo Mode**.

## How to use it

1. **Select a project** from `/projects`. Five synthetic projects.
2. **Analyze** on the dashboard. Signals appear with their evidence.
3. **Open a signal** to see the full explanation and the actual record text behind each
   citation.
4. **Confirm, Investigate or Dismiss**, with a note. Your decision persists.
5. **Ask about this project** in the chat panel. It sees only the selected project.
6. **Evaluation** at `/evaluation` compares what the AI found against the answer key.

## Mock mode (the default)

`MockAIProvider` returns deterministic fixtures. It exists so tests, browser checks, CI,
local development and the public demo all cost **zero Gemini tokens**.

The mock returns *raw, unvalidated* output and goes through the same Zod parsing and the
same evidence validation as a real Gemini response — so what you see in demo mode is the
real pipeline, not a shortcut around it.

Two fixtures deliberately cite records that cannot be verified, so you can watch the
evidence guard work without waiting for a model to hallucinate:

- **P001** cites `P001-SR999`, which does not exist. The signal survives on its valid
  citations, and the card reports that one citation was rejected.
- **P002** contains a signal citing only `P001-M001` and `P001-I002` — real records, from
  a different project. That signal is **discarded entirely** and the dashboard says why.

## Gemini setup

```bash
cp .env.example .env.local
```

```env
AI_PROVIDER=gemini
GEMINI_API_KEY=your_key_here
GEMINI_MODEL=gemini-2.5-flash
```

Restart the dev server. The header changes to **AI Provider: Gemini**.

The key is read server-side only and is never sent to the browser or displayed. If
`AI_PROVIDER=gemini` is set without a key, the application reports a configuration error
— **it does not quietly fall back to the mock**, because showing you fixture output while
you believe you are seeing Gemini would be the worst possible bug in a product about
honesty.

See **[docs/MANUAL_GEMINI_TESTING.md](docs/MANUAL_GEMINI_TESTING.md)** for a step-by-step
manual test script.

## Tests

```bash
npm test        # 113 tests
npm run typecheck
npm run build
```

Every test runs against the mock provider. `vitest.config.ts` forces `AI_PROVIDER=mock`,
overriding any `.env.local`, so the suite is structurally incapable of spending tokens.
Tests write to `.data-test/`, never your real store.

Coverage: dataset integrity, AI schema acceptance and rejection, evidence validation
(including cross-project rejection), project isolation, chat isolation, answer-key
isolation, human review persistence across re-analysis, evaluation matching, and provider
safety.

## Evaluation

`/evaluation` compares stored analysis runs against `data/evaluation.json`. A signal
counts as matched when it shares **both** the category **and at least one cited record**
with the expectation — matching on evidence rather than wording, so it measures whether
the same records were read together rather than whether the same phrasing was produced.

The answer key is never sent to a model. See
**[docs/EVALUATION.md](docs/EVALUATION.md)**.

## Limitations

Stated plainly, because the alternative is overclaiming:

- **Five synthetic projects prove nothing about production accuracy.** The dataset was
  written alongside the prompt. The evaluation checks the pipeline behaves as intended;
  it is not a benchmark.
- **The dataset is already clean structured JSON.** Real project information arrives as
  PDFs, emails, models and photographs. Ingestion is the hard part and is out of scope
  here.
- **Persistence is a JSON file**, suitable for a prototype and nothing else. No
  concurrency control, no migrations, no multi-user semantics.
- **No authentication or permissions.** Every visitor sees every project and can record a
  review as anybody.
- **Whole-project prompting.** Each project fits comfortably in a context window. A real
  project would need retrieval, and that changes the evidence-validation story.
- **Chat has no memory between sessions** and does not use analysis results.
- **Evidence validation proves a cited record exists and is quoted accurately. It does
  not prove the reasoning about it is sound.** That is exactly why a human reviews it.

## Recommended production improvements

1. Ingestion from real sources, preserving a stable id and a link back to the original.
2. Retrieval over whole-project prompting once record counts grow, with citation
   validation kept at the same strictness.
3. A real datastore with an append-only audit trail of who decided what and when.
4. Authentication, project-level permissions, and review attribution to named people.
5. A larger evaluation set written by people other than the prompt author, with
   inter-rater agreement on what counts as a signal worth surfacing.
6. Signal lifecycle — recurrence, supersession, and closing a signal when later records
   resolve it.
7. Monitoring of rejected-citation rates as a live hallucination signal.
8. Human-in-the-loop feedback captured as evaluation data rather than discarded.

---

All project information in this repository is synthetic. AI outputs are suggestions for
human review, not project decisions.
