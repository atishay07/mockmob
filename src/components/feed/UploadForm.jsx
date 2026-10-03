"use client";

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { uploadQuestion } from '@/lib/services/questionService';
import ArenaHead from '@/components/arena/ArenaHead';
import { ErrorState } from '@/components/ui/Skeleton';
import { chapterGroups } from '@/../data/explore_feed';
import { contributionErrors, removeContributionOption } from '@/../data/contribution_ui';

const BLANK = { subject: '', chapter: '', body: '', correct_answer: '', explanation: '', difficulty: 'medium', tags: '' };
const initialOptions = () => 'ABCD'.split('').map((key) => ({ key, text: '' }));

function Field({ name, label, error, children }) {
  return <div className="con-field"><label htmlFor={`con-${name}`}>{label}</label>{children}{error && <p id={`con-${name}-error`} className="con-error" role="alert">{error}</p>}</div>;
}

export function UploadForm() {
  const [form, setForm] = useState(BLANK);
  const [options, setOptions] = useState(initialOptions);
  const [subjects, setSubjects] = useState([]);
  const [chapters, setChapters] = useState([]);
  const [catalogState, setCatalogState] = useState('loading');
  const [chapterState, setChapterState] = useState('idle');
  const [retry, setRetry] = useState(0);
  const [errors, setErrors] = useState({});
  const [state, setState] = useState('idle');
  const [message, setMessage] = useState('');
  const [warnings, setWarnings] = useState([]);
  const submitLock = useRef(false);
  const formNode = useRef(null);
  const busy = state === 'loading';

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/subjects', { signal: controller.signal }).then(async (response) => {
      const data = await response.json();
      if (!response.ok || !Array.isArray(data)) throw new Error('catalog_unavailable');
      setSubjects(data.filter((subject) => subject.practice !== 'merged' && !subject.mergedInto));
      setCatalogState('ready');
    }).catch((error) => { if (error.name !== 'AbortError') setCatalogState('error'); });
    return () => controller.abort();
  }, [retry]);
  useEffect(() => {
    if (!form.subject) return;
    const controller = new AbortController();
    fetch(`/api/chapters?subject=${encodeURIComponent(form.subject)}`, { signal: controller.signal }).then(async (response) => {
      const data = await response.json();
      if (!response.ok) throw new Error('chapters_unavailable');
      setChapters(chapterGroups(data));
      setChapterState('ready');
    }).catch((error) => { if (error.name !== 'AbortError') setChapterState('error'); });
    return () => controller.abort();
  }, [form.subject, retry]);

  function set(key, value) {
    setForm((current) => ({ ...current, [key]: value, ...(key === 'subject' ? { chapter: '' } : {}) }));
    setErrors((current) => ({ ...current, [key]: undefined }));
    if (key === 'subject') { setChapters([]); setChapterState(value ? 'loading' : 'idle'); }
  }
  function remove(index) {
    const next = removeContributionOption(options, form.correct_answer, index);
    setOptions(next.options);
    set('correct_answer', next.correctKey);
  }
  async function submit(event) {
    event.preventDefault();
    if (submitLock.current) return;
    const nextErrors = contributionErrors(form, options);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) { requestAnimationFrame(() => formNode.current?.querySelector('[aria-invalid="true"]')?.focus()); return; }
    submitLock.current = true;
    setState('loading'); setMessage(''); setWarnings([]);
    try {
      const result = await uploadQuestion({ ...form, body: form.body.trim(), options: options.filter((option) => option.text.trim()).map((option) => ({ ...option, text: option.text.trim() })), explanation: form.explanation.trim() || null, tags: form.tags.split(',').map((tag) => tag.trim()).filter(Boolean) });
      setState('success');
      setMessage(result.warning ? 'Saved, but checks could not start yet. Track it in My uploads.' : 'Saved for checks. It is not live in practice yet.');
      setWarnings((result.rule_violations || []).map((violation) => violation.message));
      setForm(BLANK); setOptions(initialOptions()); setChapters([]);
    } catch (error) {
      setState('error');
      setMessage(error.data?.rule_violations?.map((violation) => violation.message).join(' · ') || error.message || 'This did not submit. Your draft is still here.');
    } finally { submitLock.current = false; }
  }
  const props = (name) => ({ id: `con-${name}`, disabled: busy, value: form[name], onChange: (event) => set(name, event.target.value), 'aria-invalid': Boolean(errors[name]), 'aria-describedby': errors[name] ? `con-${name}-error` : undefined });

  return <div className="con-page student-page student-page--upload">
    <ArenaHead eyebrow="Contribute" title="A good question helps the next person." lede="Write an original question with a clear answer and reasoning. It stays out of practice until its checks pass." />
    <p className="con-note">No credit reward is promised for a submission. <Link href="/my-uploads">Track your uploads ↗</Link></p>
    {catalogState === 'error' && <ErrorState message="Subjects did not load. Your draft is still here." onRetry={() => setRetry((count) => count + 1)} />}
    <form ref={formNode} onSubmit={submit} className="con-form" noValidate>
      <div className="con-pair">
        <Field name="subject" label="Subject" error={errors.subject}><select className="select" {...props('subject')} disabled={busy || catalogState !== 'ready'}><option value="">{catalogState === 'loading' ? 'Loading subjects…' : 'Choose a subject'}</option>{subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}</select></Field>
        <Field name="chapter" label="Chapter" error={errors.chapter}><select className="select" {...props('chapter')} disabled={busy || chapterState !== 'ready'}><option value="">{chapterState === 'loading' ? 'Loading chapters…' : 'Choose a chapter'}</option>{chapters.map((group) => <optgroup key={group.name} label={group.name}>{group.chapters.map((chapter) => <option key={chapter.id || chapter.name} value={chapter.name}>{chapter.name}</option>)}</optgroup>)}</select></Field>
      </div>
      {chapterState === 'error' && <ErrorState title="Chapters did not load" message="Retry to choose a chapter. Your question text is safe here." onRetry={() => setRetry((count) => count + 1)} />}
      <Field name="body" label="Question" error={errors.body}><textarea className="textarea" {...props('body')} rows={4} placeholder="Write the full question. Include the facts needed to solve it." /></Field>
      <fieldset className="con-options"><legend>Options · tap a letter to mark the correct answer</legend>{options.map((option, index) => <div key={option.key} className="con-option"><button type="button" className="con-key" disabled={busy} aria-label={`Mark option ${option.key} as correct`} aria-pressed={form.correct_answer === option.key} onClick={() => set('correct_answer', option.key)}>{option.key}</button><input className="input" value={option.text} disabled={busy} aria-label={`Option ${option.key}`} onChange={(event) => setOptions((current) => current.map((entry, i) => i === index ? { ...entry, text: event.target.value } : entry))} placeholder={`Option ${option.key}`} />{options.length > 2 && <button type="button" className="con-remove" disabled={busy} onClick={() => remove(index)} aria-label={`Remove option ${option.key}`}>×</button>}</div>)}{(errors.options || errors.correct_answer) && <p className="con-error" role="alert">{errors.options || errors.correct_answer}</p>}{options.length < 5 && <button type="button" className="ex-action" disabled={busy} onClick={() => setOptions((current) => [...current, { key: 'ABCDE'[current.length], text: '' }])}>Add option</button>}</fieldset>
      <div className="con-pair"><Field name="difficulty" label="Difficulty"><select className="select" {...props('difficulty')}><option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option></select></Field><Field name="tags" label="Tags (optional)"><input className="input" {...props('tags')} placeholder="ratio, partnership" /></Field></div>
      <Field name="explanation" label="Reasoning (recommended)"><textarea className="textarea" {...props('explanation')} rows={4} placeholder="Explain the rule, show the working and name your source where possible." /></Field>
      {message && <div className="con-message" data-state={state} role={state === 'error' ? 'alert' : 'status'}><b>{message}</b>{warnings.map((warning, index) => <p key={index}>{warning}</p>)}</div>}
      <button type="submit" className="btn-volt lg" disabled={busy || catalogState !== 'ready'}>{busy ? 'Submitting…' : 'Submit for checks'}</button>
      <p className="con-fine">Uncertain questions stay held. Submission does not mean publication.</p>
    </form>
  </div>;
}
