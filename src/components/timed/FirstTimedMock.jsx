"use client";
// One honest line and one key for a student with no timed paper yet (data/first_timed_mock.js). Presentational: the
// prompt comes from useFirstTimedMock, so every surface says the same words and shows nothing when there is no prompt.
// The key is a link to the practice setup with the full mock chosen; the setup states its price before anything starts.
import Link from 'next/link';
import './first-timed-mock.css';

export default function FirstTimedMock({ prompt, className = '' }) {
  if (!prompt?.line || !prompt.key?.href) return null;
  return (
    <div className={`ftm${className ? ` ${className}` : ''}`} data-surface={prompt.surface} data-variant={prompt.variant}>
      <p className="ftm-line">{prompt.line}</p>
      <Link className="ftm-key" href={prompt.key.href}>{prompt.key.label}</Link>
    </div>
  );
}
