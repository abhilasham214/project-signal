'use client';

/**
 * Human review controls.
 *
 * This is where the workflow ends and the only place a signal status changes.
 * The AI cannot reach this panel, and nothing in the AI layer can write what
 * it saves — `POST /api/review` imports no provider at all.
 *
 * The selected status is held locally until Save is pressed, so a mis-click on
 * Dismiss is not immediately final.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { HumanReview, ReviewStatus } from '@/lib/ai/schemas';
import { Button, Notice } from '@/components/ui/primitives';

/** The three decisions a reviewer can record, with what each one means. */
const REVIEW_ACTIONS: ReadonlyArray<{ status: ReviewStatus; label: string; hint: string }> = [
  { status: 'CONFIRMED', label: 'Confirm', hint: 'This is worth attention.' },
  { status: 'INVESTIGATE', label: 'Investigate', hint: 'Needs more information first.' },
  { status: 'DISMISSED', label: 'Dismiss', hint: 'Not something to act on.' },
];

export function ReviewPanel({
  signalId,
  currentStatus,
  existingReview,
}: {
  signalId: string;
  currentStatus: ReviewStatus;
  existingReview: HumanReview | null;
}) {
  const router = useRouter();
  const [selectedStatus, setSelectedStatus] = useState<ReviewStatus>(currentStatus);
  const [note, setNote] = useState(existingReview?.note ?? '');
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(existingReview?.reviewedAt ?? null);

  async function saveReview() {
    setIsSaving(true);
    setErrorMessage(null);

    try {
      const response = await fetch('/api/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signalId, status: selectedStatus, note }),
      });

      const payload = (await response.json()) as { review?: HumanReview; error?: string };

      if (!response.ok || !payload.review) {
        setErrorMessage(payload.error ?? 'The review could not be saved.');
        return;
      }

      setSavedAt(payload.review.reviewedAt);
      // Re-render the server component so the status badge above updates too.
      router.refresh();
    } catch {
      setErrorMessage('The review could not be sent. Check your connection and retry.');
    } finally {
      setIsSaving(false);
    }
  }

  const hasUnsavedChanges =
    selectedStatus !== currentStatus || note !== (existingReview?.note ?? '');

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-medium">Decision</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {REVIEW_ACTIONS.map((action) => {
            const isSelected = selectedStatus === action.status;
            return (
              <Button
                key={action.status}
                variant={isSelected ? 'primary' : action.status === 'DISMISSED' ? 'danger' : 'secondary'}
                onClick={() => setSelectedStatus(action.status)}
                aria-pressed={isSelected}
                title={action.hint}
              >
                {action.label}
              </Button>
            );
          })}
        </div>
        <p className="mt-2 text-xs text-[var(--color-ink-subtle)]">
          {REVIEW_ACTIONS.find((action) => action.status === selectedStatus)?.hint ??
            'No decision has been recorded yet.'}
        </p>
      </div>

      <div>
        <label htmlFor="review-note" className="text-sm font-medium">
          Review note
        </label>
        <textarea
          id="review-note"
          rows={3}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="For example: waiting for consultant response before deciding next action."
          className="mt-2 w-full resize-y rounded-lg border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-ink)] placeholder:text-[var(--color-ink-subtle)]"
        />
      </div>

      {errorMessage ? <Notice tone="error">{errorMessage}</Notice> : null}

      <div className="flex flex-wrap items-center gap-3">
        <Button variant="primary" onClick={saveReview} disabled={isSaving || !hasUnsavedChanges}>
          {isSaving ? 'Saving…' : 'Save review'}
        </Button>

        {savedAt && !hasUnsavedChanges ? (
          <p className="text-xs text-[var(--color-ink-subtle)]">
            Saved {new Date(savedAt).toLocaleString('en-GB')}
          </p>
        ) : null}
        {hasUnsavedChanges ? (
          <p className="text-xs text-[var(--color-severity-medium)]">Unsaved changes</p>
        ) : null}
      </div>
    </div>
  );
}
