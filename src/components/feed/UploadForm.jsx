"use client";
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { uploadQuestion } from '@/lib/services/questionService';
import { Icon } from '@/components/ui/Icons';

const DIFFICULTIES = ['easy', 'medium', 'hard'];
const MIN_OPTIONS = 2;
const MAX_OPTIONS = 5;

function Label({ children, required }) {
  return (
    <label style={{
      display: 'block', marginBottom: '6px',
      fontSize: '12px', fontWeight: 600,
      fontFamily: 'var(--font-mono)', letterSpacing: '0.15em',
      textTransform: 'uppercase', color: '#a1a1aa',
    }}>
      {children} {required && <span style={{ color: '#f87171' }}>*</span>}
    </label>
  );
}

function Field({ label, required, error, children }) {
  return (
    <div style={{ marginBottom: '20px' }}>
      <Label required={required}>{label}</Label>
      {children}
      {error && (
        <p style={{ color: '#f87171', fontSize: '11px', marginTop: '4px' }}>{error}</p>
      )}
    </div>
  );
}

const BLANK_FORM = {
  subject: '',
  chapter: '',
  body: '',
  difficulty: 'medium',
  correct_answer: '',
  explanation: '',
  tags: '',
};

export function UploadForm() {
  const [form, setForm]         = useState(BLANK_FORM);
  const [options, setOptions]   = useState([
    { key: 'A', text: '' },
    { key: 'B', text: '' },
    { key: 'C', text: '' },
    { key: 'D', text: '' },
  ]);
  const [errors, setErrors]     = useState({});
  const [status, setStatus]     = useState('idle'); // idle | loading | success | error
  const [apiMessage, setApiMessage] = useState('');
  const [warnings, setWarnings] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [chapters, setChapters] = useState([]);
  const textareaRef             = useRef(null);

  // Load subjects
  useEffect(() => {
    fetch('/api/subjects').then(r => r.json()).then(setSubjects).catch(console.error);
  }, []);

  // Load chapters when subject changes
  useEffect(() => {
    if (!form.subject) {
      const id = window.setTimeout(() => setChapters([]), 0);
      return () => window.clearTimeout(id);
    }
    fetch(`/api/chapters?subject=${encodeURIComponent(form.subject)}`)
      .then(r => r.json())
      .then(setChapters)
      .catch(() => setChapters([]));
  }, [form.subject]);

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = ta.scrollHeight + 'px';
  }, [form.body]);

  const set = useCallback((key, value) => {
    setForm(f => ({ ...f, [key]: value }));
    setErrors(e => ({ ...e, [key]: undefined }));
  }, []);

  const setOption = useCallback((idx, text) => {
    setOptions(prev => prev.map((o, i) => i === idx ? { ...o, text } : o));
  }, []);

  const addOption = () => {
    if (options.length >= MAX_OPTIONS) return;
    const letters = 'ABCDE';
    setOptions(prev => [...prev, { key: letters[prev.length], text: '' }]);
  };

  const removeOption = (idx) => {
    if (options.length <= MIN_OPTIONS) return;
    setOptions(prev => {
      const next = prev.filter((_, i) => i !== idx)
        .map((o, i) => ({ ...o, key: 'ABCDE'[i] }));
      // If correct_answer was the removed option, clear it
      if (form.correct_answer === prev[idx].key) {
        setForm(f => ({ ...f, correct_answer: '' }));
      }
      return next;
    });
  };

  // ── Validation ──
  const validate = () => {
    const e = {};
    if (!form.subject.trim()) e.subject = 'Subject is required';
    if (!form.chapter.trim()) e.chapter = 'Chapter is required';
    if (!form.body.trim() || form.body.trim().length < 10)
      e.body = 'Question must be at least 10 characters';
    const filled = options.filter(o => o.text.trim());
    if (filled.length < MIN_OPTIONS)
      e.options = `At least ${MIN_OPTIONS} options are required`;
    if (!form.correct_answer)
      e.correct_answer = 'Mark the correct answer';
    return e;
  };

  // ── Submit ──
  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }

    setStatus('loading');
    setWarnings([]);
    setApiMessage('');

    const payload = {
      subject:        form.subject.trim(),
      chapter:        form.chapter.trim(),
      body:           form.body.trim(),
      options:        options.filter(o => o.text.trim()),
      correct_answer: form.correct_answer,
      explanation:    form.explanation.trim() || null,
      difficulty:     form.difficulty,
      tags:           form.tags.split(',').map(t => t.trim()).filter(Boolean),
    };

    try {
      const res = await uploadQuestion(payload);
      setStatus('success');
      setApiMessage(`Question submitted! ID: ${res.question_id}`);
      if (res.rule_violations?.length) {
        setWarnings(res.rule_violations.map(v => v.message));
      }
      // Reset form
      setForm(BLANK_FORM);
      setOptions([
        { key: 'A', text: '' }, { key: 'B', text: '' },
        { key: 'C', text: '' }, { key: 'D', text: '' },
      ]);
      setErrors({});
    } catch (err) {
      setStatus('error');
      if (err.data?.rule_violations?.length) {
        setErrors({ global: err.data.rule_violations.map(v => v.message).join(' · ') });
      } else {
        setApiMessage(err.message ?? 'Upload failed');
      }
    }
  };

  const isLoading = status === 'loading';

  return (
    <div style={{ maxWidth: '640px', margin: '0 auto', width: '100%' }}>
      {/* ── Header ── */}
      <div style={{ marginBottom: '32px' }}>
        <div className="eyebrow" style={{ marginBottom: '8px' }}>{'// CONTRIBUTE'}</div>
        <h1 className="display-md">
          Upload a <span className="text-volt" style={{ fontStyle: 'italic' }}>Question</span>
        </h1>
        <p style={{ color: '#71717a', fontSize: '13px', marginTop: '6px' }}>
          Peer-reviewed questions power the mob. Submit yours and earn credits once it passes moderation.
        </p>
      </div>

      {/* ── Credit incentive banner ── */}
      <div className="glass" style={{
        padding: '12px 16px', marginBottom: '28px', display: 'flex',
        alignItems: 'center', gap: '12px',
        borderColor: 'rgba(210,240,0,0.2)', background: 'rgba(210,240,0,0.02)',
      }}>
        <Icon name="spark" style={{ color: 'var(--volt)', width: '18px', height: '18px' }} />
        <span style={{ fontSize: '13px', color: '#a1a1aa' }}>
          Earn <strong style={{ color: 'var(--volt)' }}>+15 credits</strong> on submit.{' '}
          <strong style={{ color: 'var(--volt)' }}>+30 more</strong> when your question goes live.
        </span>
      </div>

      <form onSubmit={handleSubmit} noValidate>
        {/* ── Subject ── */}
        <Field label="Subject" required error={errors.subject}>
          {subjects.length > 0 ? (
            <select
              className="select"
              value={form.subject}
              onChange={e => { set('subject', e.target.value); set('chapter', ''); }}
              disabled={isLoading}
            >
              <option value="">Select subject…</option>
              {subjects.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          ) : (
            <input
              className="input"
              value={form.subject}
              onChange={e => set('subject', e.target.value)}
              placeholder="e.g. General Test"
              disabled={isLoading}
            />
          )}
        </Field>

        {/* ── Chapter ── */}
        <Field label="Chapter" required error={errors.chapter}>
          {chapters.length > 0 ? (
            <select
              className="select"
              value={form.chapter}
              onChange={e => set('chapter', e.target.value)}
              disabled={isLoading}
            >
              <option value="">Select chapter…</option>
              {chapters.map(c => (
                <option key={c.id ?? c.name} value={c.name}>{c.name}</option>
              ))}
            </select>
          ) : (
            <input
              className="input"
              value={form.chapter}
              onChange={e => set('chapter', e.target.value)}
              placeholder="e.g. Quantitative Aptitude"
              disabled={isLoading}
            />
          )}
        </Field>

        {/* ── Question Body ── */}
        <Field label="Question" required error={errors.body}>
          <textarea
            ref={textareaRef}
            className="textarea"
            value={form.body}
            onChange={e => set('body', e.target.value)}
            placeholder="Type your question here… Be clear and concise."
            rows={3}
            disabled={isLoading}
            style={{ resize: 'none', overflow: 'hidden', lineHeight: '1.6' }}
          />
        </Field>

        {/* ── Options ── */}
        <Field label="Options" required error={errors.options}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {options.map((opt, idx) => (
              <div key={opt.key} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <button
                  type="button"
                  style={{
                  width: '44px', height: '44px', borderRadius: '8px', flexShrink: 0,
                  background: form.correct_answer === opt.key ? 'var(--volt)' : 'rgba(255,255,255,0.05)',
                  color: form.correct_answer === opt.key ? '#000' : '#71717a',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '12px',
                  cursor: 'pointer', transition: 'all 0.15s ease',
                  border: '1px solid rgba(255,255,255,0.08)',
                }}
                  title={`Mark ${opt.key} as correct`}
                  aria-label={`Mark option ${opt.key} as the correct answer`}
                  aria-pressed={form.correct_answer === opt.key}
                  onClick={() => !isLoading && set('correct_answer', opt.key)}
                  disabled={isLoading}
                >
                  {opt.key}
                </button>
                <input
                  className="input"
                  value={opt.text}
                  onChange={e => setOption(idx, e.target.value)}
                  placeholder={`Option ${opt.key}`}
                  disabled={isLoading}
                  style={{ flex: 1 }}
                />
                {options.length > MIN_OPTIONS && (
                  <button
                    type="button"
                    onClick={() => removeOption(idx)}
                    disabled={isLoading}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: '#52525b', padding: '4px', flexShrink: 0,
                    }}
                    aria-label={`Remove option ${opt.key}`}
                  >
                    <Icon name="x" style={{ width: '14px', height: '14px' }} />
                  </button>
                )}
              </div>
            ))}
          </div>

          <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            {options.length < MAX_OPTIONS && (
              <button
                type="button"
                onClick={addOption}
                disabled={isLoading}
                className="btn-ghost"
                style={{ fontSize: '12px' }}
              >
                + Add option
              </button>
            )}
            <span style={{ color: '#52525b', fontSize: '11px', fontFamily: 'var(--font-mono)' }}>
              Click a letter to mark correct answer
            </span>
          </div>
          {errors.correct_answer && (
            <p style={{ color: '#f87171', fontSize: '11px', marginTop: '6px' }}>{errors.correct_answer}</p>
          )}
        </Field>

        {/* ── Difficulty + Tags ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
          <div>
            <Label>Difficulty</Label>
            <div style={{ display: 'flex', gap: '6px' }}>
              {DIFFICULTIES.map(d => {
                const colors = { easy: '#4ade80', medium: '#fbbf24', hard: '#f87171' };
                return (
                  <button
                    key={d}
                    type="button"
                    disabled={isLoading}
                    onClick={() => set('difficulty', d)}
                    style={{
                      flex: 1, padding: '8px 4px', borderRadius: '8px', border: 'none', cursor: 'pointer',
                      fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: '10px',
                      letterSpacing: '0.1em', textTransform: 'uppercase', transition: 'all 0.15s ease',
                      background: form.difficulty === d
                        ? `rgba(${colors[d] === '#4ade80' ? '74,222,128' : colors[d] === '#fbbf24' ? '251,191,36' : '248,113,113'},0.15)`
                        : 'rgba(255,255,255,0.03)',
                      color: form.difficulty === d ? colors[d] : '#52525b',
                      borderColor: form.difficulty === d ? colors[d] : 'transparent',
                      boxShadow: form.difficulty === d ? `0 0 0 1px ${colors[d]}40` : 'none',
                    }}
                  >
                    {d}
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <Label>Tags</Label>
            <input
              className="input"
              value={form.tags}
              onChange={e => set('tags', e.target.value)}
              placeholder="ratio, speed, time"
              disabled={isLoading}
            />
          </div>
        </div>

        {/* ── Explanation ── */}
        <Field label="Explanation (recommended)">
          <textarea
            className="textarea"
            value={form.explanation}
            onChange={e => set('explanation', e.target.value)}
            placeholder="Why is this the correct answer? Help the community learn."
            rows={2}
            disabled={isLoading}
            style={{ resize: 'vertical' }}
          />
        </Field>

        {/* ── Global error ── */}
        {errors.global && (
          <div style={{
            padding: '12px 16px', marginBottom: '20px',
            background: 'rgba(248,113,113,0.08)',
            border: '1px solid rgba(248,113,113,0.3)',
            borderRadius: '8px', color: '#f87171', fontSize: '13px',
          }}>
            {errors.global}
          </div>
        )}

        {/* ── Success / Warning ── */}
        {status === 'success' && (
          <div style={{
            padding: '12px 16px', marginBottom: '20px',
            background: 'rgba(74,222,128,0.08)',
            border: '1px solid rgba(74,222,128,0.3)',
            borderRadius: '8px', fontSize: '13px',
          }}>
            <div style={{ color: '#4ade80', fontWeight: 600 }}>✓ {apiMessage}</div>
            {warnings.map((w, i) => (
              <div key={i} style={{ color: '#fbbf24', marginTop: '6px', fontSize: '12px' }}>⚠ {w}</div>
            ))}
          </div>
        )}
        {status === 'error' && apiMessage && (
          <div style={{
            padding: '12px 16px', marginBottom: '20px',
            background: 'rgba(248,113,113,0.08)',
            border: '1px solid rgba(248,113,113,0.3)',
            borderRadius: '8px', color: '#f87171', fontSize: '13px',
          }}>
            ✗ {apiMessage}
          </div>
        )}

        {/* ── Submit ── */}
        <button
          type="submit"
          className="btn-volt lg"
          disabled={isLoading}
          style={{ width: '100%', justifyContent: 'center', position: 'relative' }}
        >
          {isLoading ? (
            <>
              <Icon name="radar" style={{ width: '16px', height: '16px', animation: 'spin 1s linear infinite' }} />
              Submitting…
            </>
          ) : (
            <>
              <Icon name="upload" style={{ width: '16px', height: '16px' }} />
              Submit for Review
            </>
          )}
        </button>
        <p style={{ textAlign: 'center', color: '#52525b', fontSize: '11px', marginTop: '12px', fontFamily: 'var(--font-mono)' }}>
          All questions go through community moderation before going live.
        </p>
      </form>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
