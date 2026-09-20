'use client';

/**
 * Project-scoped assistant.
 *
 * The `projectId` prop is fixed by the dashboard route and is sent with every
 * request. There is no project picker in this component and no way for a
 * conversation to change which project it is about — if you want to ask about
 * a different project, you open that project dashboard, which starts a
 * different conversation.
 *
 * Citations returned by the server have already been resolved against this
 * project. Anything the assistant claimed that did not resolve was dropped
 * before it reached here, so every id shown below is real.
 */

import { useRef, useState } from 'react';
import type { ChatMessage, ValidatedChatResult } from '@/lib/ai/schemas';
import { Button, Card, CardBody, CardHeader, CardTitle, Notice, SourceId } from '@/components/ui/primitives';

/** A turn in the visible transcript, with any resolved citations attached. */
interface TranscriptEntry {
  role: 'user' | 'assistant';
  content: string;
  citations?: ValidatedChatResult['citations'];
}

/** Starter questions, offered so the first interaction is not a blank box. */
const SUGGESTED_QUESTIONS = [
  'What decisions are still unresolved?',
  'What issues have appeared repeatedly?',
  'Were any previously reported issues resolved?',
  'Which project records seem connected?',
  'What information appears to be missing?',
  'What changed recently?',
];

export function ProjectChat({ projectId }: { projectId: string }) {
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [draft, setDraft] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  async function send(question: string) {
    const trimmed = question.trim();
    if (trimmed === '' || isSending) return;

    const nextTranscript: TranscriptEntry[] = [...transcript, { role: 'user', content: trimmed }];
    setTranscript(nextTranscript);
    setDraft('');
    setIsSending(true);
    setErrorMessage(null);

    // Only role and content go to the server; citations are display state.
    const messages: ChatMessage[] = nextTranscript.map((entry) => ({
      role: entry.role,
      content: entry.content,
    }));

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, messages }),
      });

      const payload = (await response.json()) as { result?: ValidatedChatResult; error?: string };

      if (!response.ok || !payload.result) {
        setErrorMessage(payload.error ?? 'The assistant could not answer that question.');
        return;
      }

      setTranscript((current) => [
        ...current,
        {
          role: 'assistant',
          content: payload.result!.answer,
          citations: payload.result!.citations,
        },
      ]);
    } catch {
      setErrorMessage('The request could not be sent. Check your connection and retry.');
    } finally {
      setIsSending(false);
      inputRef.current?.focus();
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Ask about this project</CardTitle>
        <p className="mt-1 text-xs font-normal text-[var(--color-ink-subtle)]">
          The assistant sees only {projectId}'s records. It answers from those records, or says
          that they do not cover the question.
        </p>
      </CardHeader>

      <CardBody className="space-y-4">
        {transcript.length === 0 ? (
          <div>
            <p className="text-xs text-[var(--color-ink-subtle)]">Try one of these:</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {SUGGESTED_QUESTIONS.map((question) => (
                <button
                  key={question}
                  type="button"
                  onClick={() => send(question)}
                  disabled={isSending}
                  className="rounded-lg border border-[var(--color-border-strong)] px-3 py-1.5 text-left text-sm text-[var(--color-ink-muted)] hover:bg-[var(--color-surface-sunken)] disabled:opacity-50"
                >
                  {question}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {transcript.length > 0 ? (
          <div className="space-y-4">
            {transcript.map((entry, index) => (
              <div key={`${entry.role}-${index}`}>
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-ink-subtle)]">
                  {entry.role === 'user' ? 'You' : 'Assistant'}
                </p>
                <p className="prose-plain mt-1 text-sm leading-relaxed text-[var(--color-ink-muted)]">
                  {entry.content}
                </p>

                {entry.citations && entry.citations.length > 0 ? (
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <span className="text-xs text-[var(--color-ink-subtle)]">Verified sources:</span>
                    {entry.citations.map((citation) => (
                      <SourceId key={citation.sourceId}>{citation.sourceId}</SourceId>
                    ))}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        ) : null}

        {isSending ? (
          <p className="text-sm text-[var(--color-ink-subtle)]">
            Reading this project's records…
          </p>
        ) : null}

        {errorMessage ? <Notice tone="error">{errorMessage}</Notice> : null}

        <form
          onSubmit={(event) => {
            event.preventDefault();
            void send(draft);
          }}
          className="space-y-2"
        >
          <label htmlFor="chat-input" className="sr-only">
            Ask a question about this project
          </label>
          <textarea
            id="chat-input"
            ref={inputRef}
            rows={2}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              // Enter sends; Shift+Enter starts a new line.
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                void send(draft);
              }
            }}
            placeholder="Ask a question about this project…"
            className="w-full resize-y rounded-lg border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-ink)] placeholder:text-[var(--color-ink-subtle)]"
          />
          <div className="flex justify-end">
            <Button type="submit" variant="primary" disabled={isSending || draft.trim() === ''}>
              {isSending ? 'Asking…' : 'Ask'}
            </Button>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}
