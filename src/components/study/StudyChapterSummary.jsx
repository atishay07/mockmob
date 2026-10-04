"use client";
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {Printer,ArrowLeft} from 'lucide-react';
import {apiGet} from '@/lib/fetcher';
import {ReadingBlock} from './StudyBlocks';
import {subjectName} from './studyCopy';
import './study.css';

export default function StudyChapterSummary({subject,chapter}) {
  const [data,setData]=useState(null),[error,setError]=useState(false);
  useEffect(()=>{let alive=true;apiGet(`/api/study/summary?${new URLSearchParams({subject,chapter})}`).then(d=>{if(alive)setData(d);}).catch(()=>{if(alive)setError(true);});return()=>{alive=false;};},[subject,chapter]);
  return <div className="sx sx-summary"><Link className="sx-back" href={`/learn?subject=${subject}`}><ArrowLeft size={16} aria-hidden="true" />Back to Learn</Link>
    <h1>{chapter || 'Chapter summary'}</h1><p className="sx-lede">{subjectName(subject)} · Published lessons in one place.</p>
    {error ? <p className="sx-alert" role="alert">This summary could not be loaded. Return to Learn and open a published chapter.</p> : !data ? <p role="status">Preparing your summary…</p> : <>
      <p className="sx-small">This covers {data.units.length} published {data.units.length===1?'lesson':'lessons'}, not the complete chapter. Reading a summary does not mark a lesson or scored check as complete.</p>
      <button type="button" className="sx-secondary sx-summary__print" onClick={()=>window.print()}><Printer size={18} aria-hidden="true" />Print or save as PDF</button>
      <div className="sx-chapter-print">{data.units.map(unit=><section className="sx-summary__unit" key={unit.id}><h2>{unit.title}</h2><Link className="sx-link sx-summary__lesson" href={`/learn/${unit.id}`}>Learn and recall this concept</Link>
        {unit.blocks.map(block=><section key={block.id}><h3>{block.title}</h3><ReadingBlock block={block} /></section>)}
        <p className="sx-small">Version {unit.version} · {unit.sourceRefs.map(r=>r.label).join(' · ')}</p></section>)}</div>
    </>}
  </div>;
}
