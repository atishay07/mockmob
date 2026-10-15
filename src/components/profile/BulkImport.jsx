"use client";

// Many questions at once: a JSON list, checked here before anything is sent, then sent one by one to the
// same upload route as the form. Each question goes through the same checks as a single one, and a count
// is said only for questions the server accepted. Kept behind a labelled disclosure: most students write one.
import { useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { apiPost } from '@/lib/fetcher';
import { BULK_FIELDS, bulkPayload, bulkSentLine, validateBulk } from './youModel.mjs';
import './you.css';

const EXAMPLE = `[
  {
    "subject": "accountancy",
    "chapter": "Partnership Fundamentals",
    "body": "Goodwill brought in by an incoming partner is shared by the old partners in:",
    "options": [
      { "key": "A", "text": "New ratio" },
      { "key": "B", "text": "Old ratio" },
      { "key": "C", "text": "Sacrificing ratio" },
      { "key": "D", "text": "Equal ratio" }
    ],
    "correct_answer": "C",
    "explanation": "The old partners give up shares, so they are paid in the ratio they sacrifice.",
    "difficulty": "medium"
  }
]`;
const SHOWN_PROBLEMS = 20;

export default function BulkImport({ onSent = null }) {
  const [raw, setRaw] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null); // { sent, problems }
  const lock = useRef(false);

  async function submit() {
    if (lock.current) return;
    let parsed;
    try { parsed = JSON.parse(raw); } catch {
      setResult({ sent: 0, problems: ['That is not valid JSON. Check the brackets and commas, then try again.'] });
      return;
    }
    const { ok, errors } = validateBulk(parsed);
    if (!ok.length) { setResult({ sent: 0, problems: errors }); return; }
    lock.current = true;
    setBusy(true);
    setResult(null);
    let sent = 0;
    const problems = [...errors];
    for (const q of ok) {
      try {
        await apiPost('/api/questions/upload', bulkPayload(q));
        sent += 1;
      } catch (error) {
        const why = error?.kind === 'network' ? 'We could not reach MockMob.' : error?.message || 'The server did not accept it.';
        problems.push(`"${String(q.body ?? q.question).slice(0, 50)}" was not sent. ${why}`);
      }
    }
    lock.current = false;
    setBusy(false);
    setResult({ sent, problems });
    if (sent > 0) onSent?.(sent);
  }

  const clear = () => { setRaw(''); setResult(null); };

  return (
    <details className="you-bulk">
      <summary>Many questions at once<ChevronDown size={18} strokeWidth={1.75} aria-hidden="true" /></summary>
      <div className="you-bulk__body">
        <p>Paste a JSON list. Each question needs {BULK_FIELDS.join(', ')}. Every question goes through the same checks as one written above.</p>
        <pre className="you-code" tabIndex={0} aria-label="Example of one question in the list">{EXAMPLE}</pre>
        <label htmlFor="you-bulk-json" className="you-field__help">Your questions as JSON</label>
        <textarea id="you-bulk-json" className="textarea" rows={10} spellCheck={false} value={raw} disabled={busy} onChange={(event) => setRaw(event.target.value)} placeholder="[ { ... }, { ... } ]" />
        <div role="status">
          {result?.sent > 0 ? <p className="you-note" data-tone="ok">{bulkSentLine(result.sent)}</p> : null}
        </div>
        {result?.problems.length ? (
          <div role="alert" className="you-bulk__problems">
            <p className="you-note" data-tone="err">{result.sent > 0 ? 'Some questions were not sent.' : 'Nothing was sent.'}</p>
            <ul>
              {result.problems.slice(0, SHOWN_PROBLEMS).map((line, index) => <li key={index}>{line}</li>)}
              {result.problems.length > SHOWN_PROBLEMS ? <li>and {result.problems.length - SHOWN_PROBLEMS} more</li> : null}
            </ul>
          </div>
        ) : null}
        <div className="you-bulk__keys">
          <button type="button" className="you-key" disabled={busy || !raw} onClick={clear}>Clear</button>
          <button type="button" className="you-key" disabled={busy || !raw.trim()} onClick={submit}>{busy ? 'Submitting' : 'Check and submit'}</button>
        </div>
      </div>
    </details>
  );
}
