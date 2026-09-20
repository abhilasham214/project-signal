# Manual Gemini testing

Real Gemini is tested **by you, manually**. Nothing in this repository calls the Gemini
API automatically — not the tests, not the build, not page rendering, not CI.

This document is the script for doing it deliberately.

---

## Before you start

Every Gemini call in this guide spends tokens from your account. An analysis sends one
project's records (roughly 27–34 records); a chat turn sends the same records plus the
conversation. Analysing all five projects and asking a few questions is a modest but
non-zero cost.

---

## Step 1 · Create `.env.local`

```bash
cp .env.example .env.local
```

Edit `.env.local`:

```env
AI_PROVIDER=gemini
GEMINI_API_KEY=your_key_here
GEMINI_MODEL=gemini-2.5-flash
```

`.env.local` is gitignored. The key is read server-side only and is never sent to the
browser or shown in the interface.

## Step 2 · Start the application

```bash
npm run dev
```

**Confirm the switch took effect before doing anything else.** The header on every page
shows the active provider:

```
AI Provider:  GEMINI
```

If it still says **DEMO MODE**, the environment change has not been picked up — stop and
restart the dev server. Everything below would otherwise be fixtures.

If you set `AI_PROVIDER=gemini` without a key, the application reports a configuration
error when you analyse. It does **not** fall back to demo mode.

## Step 3 · Open a project

Go to <http://localhost:3000/projects> and choose one. **P001 · Riverside Commercial
Tower** is the clearest first test: its records describe an approval holding up downstream
work, spread across an issue, a dependency, several site reports and contractor updates.

Before analysing, it is worth scrolling to **Project records** and reading a few. Knowing
the source material is what lets you judge the output.

## Step 4 · Click **Analyze project**

The request goes to `POST /api/analyze` with only `{ "projectId": "P001" }`. The server
loads that project alone, sends it with the global analysis prompt, and validates
whatever comes back.

Expect a few seconds. A 45-second timeout applies.

## Step 5 · Check the output

Work through these deliberately — this is the actual test.

**Signals**
- Are they things a construction manager would care about, or restatements of single
  records? The value is in connections across records.
- Does each one identify a situation rather than summarise a document?

**Categories**
- Is the category right for the finding? A recurring defect should be `REPEATED_ISSUE`,
  not `CHANGE`.

**Evidence** — the important one
- Open a signal. Every cited record is shown with its **real content**, read from the
  dataset by id.
- Cross-check two or three citations against the **Project records** tab. Does the record
  actually support the claim, or was it cited because it mentions a keyword?
- The model cannot fake this text. It supplies an id; the server fetches the content.

**Confidence and severity**
- Is confidence proportional to evidence? A signal resting on one record claiming HIGH
  confidence is a problem.

**Hallucination behaviour** — what to look for
- A yellow note on a signal card: *"N cited records could not be verified against this
  project and are not shown."* The model invented or misattributed an id and the guard
  caught it.
- A **Validation** panel below the signals listing discarded signals. These cited nothing
  verifiable and were dropped entirely.
- Occasional rejections are normal and are the system working. Frequent rejections
  suggest the prompt needs tightening.
- **You should never see a citation that does not resolve to a real record.** If you do,
  that is a genuine bug — the guard is in `lib/validation/evidence.ts`.

**Language**
- It should say "may warrant review", "the records do not show", "appears to be".
- It should **not** predict delays, assign blame, or instruct anyone to act. Flag any
  output that does; that is a prompt failure worth knowing about.

**The temporal test — analyse P005**

This is the most informative single check. P005 has a moisture problem that looks serious
in June and is explicitly resolved by August: repaired, dried, retested twice, accepted,
installed, re-inspected clean at four weeks.

- **Good:** no signals, or only genuinely open items such as the outstanding cafe joinery
  survey.
- **Bad:** a signal about screed moisture or the quiet room acoustics. Every record it
  cites will be real and quoted correctly — the citations are not the failure, the date
  reading is. Evidence validation cannot catch this, which is exactly why P005 is in the
  dataset.

## Step 6 · Use the project chat

Scroll to **Ask about this project**. Only the selected project's records are sent.

Suggested questions:

```
What unresolved decisions exist in this project?

Which issues appear repeatedly?

What evidence supports the HVAC dependency?

Were any previously reported issues resolved?

What information appears to be missing?

Which records are connected to this signal?
```

What to check:

- **Citations.** Answers list *Verified sources* — ids resolved against this project.
  Unresolvable ids are dropped before display.
- **Honesty.** Ask something the records do not cover, e.g. *"What is the contract value?"*
  A good answer says the available records do not cover it. A bad answer invents a figure.
- **Isolation.** On P001, ask *"What is happening on the Harbourfront project?"* It should
  not know — those records were never sent.
- **Temporal reasoning.** On P005, ask *"Were any previously reported issues resolved?"*
  It should describe them as closed, not ongoing.

## Step 7 · Human review

Open a signal, choose **Confirm**, **Investigate** or **Dismiss**, add a note, and
**Save review**.

- The status updates and persists across a restart.
- Re-run **Re-analyze project**. If Gemini re-discovers the same signal over the same
  records, your decision is still attached — signal ids are derived from content, not
  generated randomly.

## Step 8 · Return to demo mode

When you are finished, edit `.env.local`:

```env
AI_PROVIDER=mock
```

Or delete `.env.local` entirely — the application defaults to demo mode with no
configuration at all.

Restart the dev server and confirm the header reads **DEMO MODE**. From that point no
further tokens can be spent.

To clear stored analyses and reviews:

```bash
rm -rf .data
```

---

## Troubleshooting

| Symptom | Cause |
|---|---|
| Header says DEMO MODE | `.env.local` not picked up — restart the dev server |
| "Gemini mode is selected but no API key is configured" | `GEMINI_API_KEY` missing or empty. Deliberately fatal; there is no silent fallback |
| "The AI provider did not respond in time" | 45-second timeout exceeded. Retry |
| "The AI provider returned a response that could not be read" | Output was not valid JSON or did not match the schema. Logged server-side with a `[project-signal]` prefix |
| "The configured AI provider is not recognised" | `AI_PROVIDER` is not `mock` or `gemini` |
| No signals at all | Legitimate on P005. On P001–P004, check the server log for discarded-signal warnings |

Server-side logs are prefixed `[project-signal]`, so they can be separated from Next.js
output:

```bash
npm run dev 2>&1 | grep project-signal
```
