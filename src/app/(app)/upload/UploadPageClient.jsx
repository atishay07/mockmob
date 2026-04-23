"use client";

import React, { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { apiPost } from '@/lib/fetcher';
import { UploadForm } from '@/components/feed/UploadForm';

/**
 * Upload page — Phase 1
 * Tabs:
 *   • Single: production-grade UploadForm
 *   • Bulk:   JSON array import
 */
export default function UploadPageClient() {
  const [tab, setTab] = useState('single');
  const [bulkRaw, setBulkRaw] = useState('');
  const [bulkReport, setBulkReport] = useState(null);
  const [bulkError, setBulkError] = useState(null);
  const [bulkOk, setBulkOk] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // ---------- bulk helpers ----------
  function validateBulk(arr) {
    if (!Array.isArray(arr)) return { ok: [], errors: ['Root JSON must be an array'] };
    const okItems = [], errors = [];
    arr.forEach((q, idx) => {
      const e = [];
      if (typeof q.subject !== 'string') e.push('subject missing');
      if (typeof q.chapter !== 'string') e.push('chapter missing');
      if (typeof q.body !== 'string' && typeof q.question !== 'string') e.push('body missing');
      if (!Array.isArray(q.options) || q.options.length < 2) e.push('options must be array ≥2');
      if (!q.correct_answer && !Number.isInteger(q.correctIndex)) e.push('correct_answer missing');
      if (e.length) errors.push(`Row ${idx}: ${e.join(', ')}`);
      else okItems.push(q);
    });
    return { ok: okItems, errors };
  }

  const handleBulkSubmit = async () => {
    setBulkError(null); setBulkOk(null); setBulkReport(null);
    let parsed;
    try { parsed = JSON.parse(bulkRaw); }
    catch { setBulkError('Invalid JSON — check syntax and try again'); return; }

    const { ok: valid, errors } = validateBulk(parsed);
    if (!valid.length) {
      setBulkError(`Nothing valid to submit (${errors.length} error(s))`);
      setBulkReport({ submitted: 0, errors });
      return;
    }

    setSubmitting(true);
    let submitted = 0;
    const submitErrors = [...errors];
    for (const q of valid) {
      try {
        await apiPost('/api/questions/upload', {
          subject:        q.subject,
          chapter:        q.chapter,
          body:           q.body ?? q.question,
          options:        q.options,
          correct_answer: q.correct_answer ?? (q.options?.[q.correctIndex]?.key ?? String(q.correctIndex)),
          explanation:    q.explanation ?? null,
          difficulty:     q.difficulty ?? 'medium',
          tags:           q.tags ?? [],
        });
        submitted++;
      } catch (e) {
        submitErrors.push(`${(q.body ?? q.question)?.slice(0, 50)}… — ${e.message}`);
      }
    }
    setSubmitting(false);
    setBulkReport({ submitted, errors: submitErrors });
    if (submitted > 0) setBulkOk(`${submitted} question(s) sent to moderation ✓`);
  };

  return (
    <div>
      {/* ── Tab switcher ── */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '32px' }}>
        {['single', 'bulk'].map(t => (
          <button
            key={t}
            className={`count-btn ${tab === t ? 'active' : ''}`}
            style={{ width: 'auto', padding: '0 20px', height: '40px' }}
            onClick={() => setTab(t)}
          >
            {t === 'single' ? 'Single' : 'Bulk (JSON)'}
          </button>
        ))}
      </div>

      {/* ── Single Tab ── */}
      {tab === 'single' && <UploadForm />}

      {/* ── Bulk Tab ── */}
      {tab === 'bulk' && (
        <div style={{ maxWidth: '640px', margin: '0 auto' }}>
          <div style={{ marginBottom: '24px' }}>
            <div className="eyebrow" style={{ marginBottom: '8px' }}>// BULK IMPORT</div>
            <h1 className="display-md">
              Bulk <span className="text-volt" style={{ fontStyle: 'italic' }}>Upload</span>
            </h1>
            <p style={{ color: '#71717a', fontSize: '13px', marginTop: '6px' }}>
              Paste a JSON array. Each item needs{' '}
              {['subject', 'chapter', 'body', 'options[]', 'correct_answer'].map((f, i, arr) => (
                <span key={f}><code style={{ color: 'var(--volt)' }}>{f}</code>{i < arr.length - 1 ? ', ' : '.'}</span>
              ))}
            </p>
          </div>

          <div className="glass" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Schema example */}
            <pre style={{
              fontSize: '11px', color: '#52525b',
              background: 'rgba(0,0,0,0.3)',
              border: '1px solid rgba(255,255,255,0.05)',
              padding: '12px', borderRadius: '8px', overflow: 'auto',
              fontFamily: 'monospace', lineHeight: '1.6',
            }}>{`[
  {
    "subject": "cuet_gt",
    "chapter": "Quantitative Aptitude",
    "body": "What is 15% of 200?",
    "options": [
      {"key":"A","text":"25"},
      {"key":"B","text":"30"},
      {"key":"C","text":"35"},
      {"key":"D","text":"40"}
    ],
    "correct_answer": "B",
    "difficulty": "easy",
    "tags": ["percentage"]
  }
]`}</pre>

            <textarea
              rows={12}
              className="textarea"
              placeholder="[ { ... }, { ... } ]"
              value={bulkRaw}
              onChange={e => setBulkRaw(e.target.value)}
              style={{ resize: 'vertical', fontFamily: 'monospace', fontSize: '12px' }}
            />

            {bulkError && (
              <p style={{ color: '#f87171', fontSize: '13px' }}>⚠ {bulkError}</p>
            )}
            {bulkOk && (
              <p style={{ color: '#4ade80', fontSize: '13px' }}>✓ {bulkOk}</p>
            )}
            {bulkReport && (
              <div style={{
                fontSize: '13px', color: '#a1a1aa',
                borderTop: '1px solid rgba(255,255,255,0.06)',
                paddingTop: '12px',
              }}>
                <div>Submitted: <strong style={{ color: 'var(--volt)' }}>{bulkReport.submitted}</strong></div>
                {bulkReport.errors.length > 0 && (
                  <>
                    <div style={{ color: '#f87171', marginTop: '8px' }}>Errors ({bulkReport.errors.length}):</div>
                    <ul style={{ paddingLeft: '20px', marginTop: '4px', fontSize: '12px', color: '#71717a' }}>
                      {bulkReport.errors.slice(0, 20).map((e, i) => <li key={i}>{e}</li>)}
                      {bulkReport.errors.length > 20 && (
                        <li>…and {bulkReport.errors.length - 20} more</li>
                      )}
                    </ul>
                  </>
                )}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <Button
                variant="outline"
                onClick={() => { setBulkRaw(''); setBulkReport(null); setBulkError(null); setBulkOk(null); }}
              >
                Clear
              </Button>
              <Button
                variant="volt"
                onClick={handleBulkSubmit}
                disabled={submitting || !bulkRaw.trim()}
              >
                {submitting ? 'Submitting…' : 'Validate & Submit'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
