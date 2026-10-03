"use client";
import { useState } from 'react';
import { ArrowRight, RotateCcw, Check, Minus } from 'lucide-react';

const moments=[{time:'00:42',title:'First answer',option:'B',outcome:'Correct',marks:5},
 {time:'03:18',title:'Revisited question',option:'D',outcome:'Incorrect',marks:-1}];
export default function RecoveryPreview() {
  const [position,setPosition]=useState(0);
  const current=moments[position];
  return <figure className="recovery-preview" id="recovery-example" tabIndex={-1}>
    <div className="recovery-preview__bar"><span>Score Recovery Lab</span><span className="recovery-preview__badge">Interactive example</span></div>
    <div className="recovery-preview__body">
      <div className="recovery-preview__question"><span>Question 04</span><span>Answer decisions</span></div>
      <h2>What changed when you came back?</h2>
      <div className="recovery-preview__track" aria-label="Example decision timeline">
        {moments.map((moment,i)=><button key={moment.time} type="button" aria-pressed={position===i} onClick={()=>setPosition(i)}>
          <span className="recovery-preview__dot">{i===0 ? <Check size={18}/> : <RotateCcw size={18}/>}</span>
          <span>{moment.time}</span><strong>{moment.title}</strong>
        </button>)}
      </div>
      <div className="recovery-preview__decision" aria-live="polite">
        <span className="recovery-preview__option">{current.option}</span><div><strong>{current.outcome}</strong><span>{current.title}</span></div>
        <b data-negative={current.marks<0}>{current.marks>0?'+':''}{current.marks}<small>marks</small></b>
      </div>
      <p className="recovery-preview__insight">{position===0 ? 'Your first answer earned five marks. Select the revisit to see its effect.' : 'This change cost six marks: +5 became −1. The reason still needs your interpretation.'}</p>
      <div className="recovery-preview__next"><Minus size={18}/><p><strong>A next move, not a verdict.</strong><span>Try a two-pass strategy on fresh questions.</span></p><ArrowRight size={20}/></div>
    </div>
    <figcaption>Illustrative replay. These values are an example, not your score or predicted recoverable marks.</figcaption>
  </figure>;
}
