'use client';

// Section 5 of /home-next: the Mistake Lab, rebuilt for clarity (spec section 5 and Revision 2; owner LK360: "the weak part
// is the mistake lab thing"). One example mock in FOUR beats in the same frame as section 3 (AutoFrame: the same rows, the
// same autoplay rules): the score, where the lost marks went, the answers changed, and what to do next. Each beat is ONE
// large figure with its one sentence, and one small picture of where the figure comes from. No panels of sub-figures, no
// legends. Every figure is labStory.mjs's (homeNextCopy LAB_NEXT, LAB_EXAMPLE), so it agrees with the See screen above it and
// with the live home's Lab. "Example" stays on the frame's title bar.
import { Check, Minus, X } from 'lucide-react';
import { LandingActions } from '@/components/LandingActions';
import { signed } from '../landing/labStory.mjs';
import AutoFrame from './AutoFrame';
import { LAB_EXAMPLE, LAB_NEXT } from './homeNextCopy.mjs';

const d = (ms) => ({ '--d': `${ms}ms` });
const MARK = { right: Check, wrong: X, blank: Minus };
const VERDICT = { right: 'right', wrong: 'wrong', blank: 'left blank' };

// Beat 1: the ten questions of the mock, as the result page's question strip shows them.
function ScorePicture() {
  return (
    <ol className="hn-beat__qs" aria-label={`The ten questions: ${LAB_EXAMPLE.rows.map((r) => `${r.n} ${VERDICT[r.verdict]}`).join(', ')}`}>
      {LAB_EXAMPLE.rows.map((r, i) => {
        const Icon = MARK[r.verdict];
        return (
          <li key={r.n} data-verdict={r.verdict} data-s style={d(260 + i * 60)} aria-hidden="true">
            <span><Icon size={15} strokeWidth={3} /></span>
            <small>Q{r.n}</small>
          </li>
        );
      })}
    </ol>
  );
}

// Beat 2: every lost mark as one bar, split by chapter (a chapter that lost none is not on it).
function WherePicture() {
  const lost = LAB_EXAMPLE.chapters.filter((c) => c.lost > 0);
  return (
    <div className="hn-beat__split">
      <div className="hn-beat__bar" aria-hidden="true">
        {lost.map((c, i) => <span key={c.chapter} style={{ flexGrow: c.lost }}><i data-worst={i === 0 ? 'true' : undefined} data-s="bar" style={d(280 + i * 220)} /></span>)}
      </div>
      <ul className="hn-beat__keys">
        {lost.map((c, i) => (
          <li key={c.chapter} data-worst={i === 0 ? 'true' : undefined} data-s style={{ flexGrow: c.lost, ...d(460 + i * 220) }}>
            <b>{c.lost}</b><span>{c.chapter}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// Beat 3: the three answers changed, each from its first pick to its last, with the marks it won or cost.
function ChangesPicture() {
  return (
    <ol className="hn-beat__changes">
      {LAB_EXAMPLE.changes.map((c, i) => (
        <li key={c.n} data-tone={c.net < 0 ? 'bad' : 'good'} data-s style={d(260 + i * 160)}>
          <span className="hn-beat__q">Q{c.n}</span>
          <span className="hn-beat__swap">
            <b data-verdict={c.fromVerdict}>{c.from}</b>
            <i aria-hidden="true" />
            <b data-verdict={c.toVerdict}>{c.to}</b>
          </span>
          <span className="hn-beat__was">{c.fromVerdict === 'right' ? 'Right, then changed' : 'Wrong, then fixed'}</span>
          <em>{signed(c.net)}</em>
        </li>
      ))}
    </ol>
  );
}

// Beat 4: the set the Lab hands you next, as its "Do these next" card shows it.
function NextPicture() {
  return (
    <div className="hn-beat__plan" data-s style={d(260)}>
      <span className="hn-beat__plan-n" aria-hidden="true">1</span>
      <span className="hn-beat__plan-text"><b>{LAB_EXAMPLE.plan.label}</b><small>{LAB_EXAMPLE.plan.reason}</small></span>
      <span className="hn-beat__plan-go" aria-hidden="true">Set up</span>
    </div>
  );
}

const PICTURES = { score: ScorePicture, where: WherePicture, changes: ChangesPicture, next: NextPicture };

export default function LabBeats() {
  return (
    <AutoFrame
      id="hn-lab"
      className="hn-lab"
      label="The Mistake Lab, in four steps"
      items={LAB_NEXT.beats}
      path="mockmob.in/result"
      tag={LAB_NEXT.example}
      capTitle={false}
      mark={(_, i) => <span className="hn-tab__n" aria-hidden="true">{i + 1}</span>}
      screen={(beat) => {
        const Picture = PICTURES[beat.id];
        return (
          <div className="hn-beat" data-beat={beat.id}>
            <p className="hn-beat__paper">{LAB_NEXT.paper}</p>
            <p className="hn-beat__figure" data-s style={d(40)}><b>{beat.figure}</b><span>{beat.unit}</span></p>
            <Picture />
          </div>
        );
      }}
      after={(
        <div className="hn-after hn-lab__after">
          <p>{LAB_NEXT.after}</p>
          <LandingActions mode="primary" />
        </div>
      )}
    />
  );
}
