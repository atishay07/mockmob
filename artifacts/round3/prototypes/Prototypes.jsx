'use client';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { fixtureFeed } from '../arena/previewFixtures';
import Desk from './Desk';
import Focus from './Focus';
import Chapters from './Chapters';
import { ThemeToggle } from '@/components/ThemeToggle';
import '@/app/(app)/arena.css';
import './picker.css';
import './studio.css';
const NAMES = ['Desk', 'Focus', 'Chapters'];
const VARIANTS = [Desk, Focus, Chapters];
export default function Prototypes({ initial }) {
  const [selected, setSelected] = useState(initial);
  const [subject, setSubject] = useState('accountancy');
  const [difficulty, setDifficulty] = useState('');
  const picker = useRef(null); const highlight = useRef(null);
  const select = (value) => { setSelected(value); const url = new URL(location.href); url.searchParams.set('v', value + 1); history.replaceState(null, '', url); };
  useLayoutEffect(() => {
    const move = () => { const item = picker.current?.querySelector('[data-active]'); if (item) { highlight.current.style.width = `${item.offsetWidth}px`; highlight.current.style.transform = `translateX(${item.offsetLeft}px)`; } };
    move(); const frame = requestAnimationFrame(() => picker.current?.setAttribute('data-ready', '')); window.addEventListener('resize', move); return () => { cancelAnimationFrame(frame); window.removeEventListener('resize', move); };
  }, [selected]);
  useEffect(() => { const key = (event) => { if (event.altKey || event.metaKey || event.ctrlKey || /^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName) || event.target.isContentEditable) return; const n = Number(event.key); if (n >= 1 && n <= 3) select(n - 1); else if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') { event.preventDefault(); select((selected + (event.key === 'ArrowRight' ? 1 : 2)) % 3); } }; document.addEventListener('keydown', key); return () => document.removeEventListener('keydown', key); }, [selected]);
  const questions = fixtureFeed(subject).slice(0,8).filter((question) => !difficulty || question.difficulty === difficulty);
  const Variant = VARIANTS[selected];
  return <main className="app-shell studio"><ThemeToggle /><p>Isolated development exploration · original illustrative questions · local interactions only</p><header><small>Explore · three ways to study</small><h1>One question. One useful step.</h1><p>Layout and interaction comparison. Desk has been selected under the owner’s explicit creative delegation.</p></header><form className="studio-filters" onSubmit={(event) => event.preventDefault()}><label>Subject<select value={subject} onChange={(event) => setSubject(event.target.value)}><option value="accountancy">Accountancy</option><option value="economics">Economics</option><option value="business_studies">Business Studies</option><option value="english">English</option></select></label><label>Difficulty<select value={difficulty} onChange={(event) => setDifficulty(event.target.value)}><option value="">All levels</option><option>easy</option><option>medium</option><option>hard</option></select></label></form><Variant key={`${selected}-${subject}-${difficulty}`} questions={questions} /><nav ref={picker} className="proto-picker" aria-label="Prototype variants"><span ref={highlight} className="proto-picker-highlight" aria-hidden="true" />{NAMES.map((name,index) => <button key={name} className="proto-picker-item" data-active={index === selected ? '' : undefined} aria-current={index === selected ? 'true' : undefined} onClick={() => select(index)}>{name}</button>)}</nav></main>;
}
