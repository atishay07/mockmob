"use client";
// "Play your paper back" on Today, once (owner D29, 18 Oct 4:10 am IST). After a fresh submission this card takes the lead's
// place for one visit: the paper's reel, the result's own engine (src/components/result/PaperReel.jsx, data/replay.js), one
// volt key to play it and one tap on "Not now". Once it has been on screen for an attempt it is never shown for that attempt
// again (src/lib/today/paperReel.mjs keeps the last 20 attempt ids in localStorage), and the Up next card returns.
// The card is the Up next card's shape (same anatomy, one volt key, the subject's object), so the page does not jump. The
// paper loads through the page's cached read (the same one Last paper uses); a paper that cannot be read or has nothing to
// play hands the lead straight back, and says nothing about it.
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Play } from 'lucide-react';
import COPY from '@/../data/mistake_lab.copy.json';
import { fill } from '@/../data/paper_trace';
import { SubjectObject } from '@/components/brand/SubjectObject';
import PaperReel from '@/components/result/PaperReel';
import { useWalletSummary } from '@/components/useWalletSummary';
import { markReelSeen, reelActHref, reelFor } from '@/lib/today/paperReel.mjs';

const W = COPY.replay.reel;

function storage() {
  try { return window.localStorage; } catch { return null; }
}

/** `paper`: the newest paper's summary row. `loadAttempt(id)`: the page's cached paper read. `onDone(why)`: the card is finished. */
export default function TodayReel({ paper, loadAttempt, subjectName = (id) => id, user = null, onDone }) {
  const router = useRouter();
  const [hour] = useState(() => new Date().getHours());
  const wallet = useWalletSummary(user?.id, { reuseFresh: true });
  const aiCredits = wallet.wallet?.known ? wallet.wallet.total : null;
  const practiceCredits = user ? user.creditBalance ?? null : null;
  const isPremium = Boolean(user?.isPremium);
  const [read, setRead] = useState({ id: null, attempt: null });
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    loadAttempt(paper.id)
      .then((attempt) => { if (alive) setRead({ id: paper.id, attempt }); })
      .catch(() => { if (alive) onDone?.('error'); });
    return () => { alive = false; };
    // The read is keyed on the paper; onDone is the page's own callback.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paper.id, loadAttempt]);

  const reel = useMemo(
    () => (read.id === paper.id && read.attempt ? reelFor(read.attempt, { hour, aiCredits, practiceCredits, isPremium, subjectName }) : null),
    // subjectName is a stable module function on the page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [read, paper.id, hour, aiCredits, practiceCredits, isPremium],
  );
  const loaded = read.id === paper.id && Boolean(read.attempt);

  // Nothing to play (a paper with nothing answered): never shown, and not tried again for this attempt.
  useEffect(() => {
    if (loaded && !reel) { markReelSeen(storage(), paper.id); onDone?.('none'); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, reel, paper.id]);
  // Once it is on screen it has been seen: a reload or a return never shows it again for this attempt.
  const showing = Boolean(reel);
  useEffect(() => {
    if (showing) markReelSeen(storage(), paper.id);
  }, [showing, paper.id]);

  if (!reel) {
    return (
      <section className="tm tm--wait tm--reel" aria-busy="true" aria-label="Loading your paper">
        <span className="tm__sk tm__sk--a" /><span className="tm__sk tm__sk--b" /><span className="tm__sk tm__sk--d" /><span className="tm__sk tm__sk--key" />
      </section>
    );
  }

  const title = fill(W.open, { s: reel.seconds });
  const marks = Number.isFinite(Number(paper.marks)) && Number(paper.maxMarks) > 0 ? { got: Number(paper.marks), of: Number(paper.maxMarks) } : null;
  const close = () => { setOpen(false); onDone?.('played'); };

  return (
    <section className="tm tm--reel" data-move="reel" aria-labelledby="tr-title">
      <div className="tm__body">
        <div className="tm__top">
          <div className="tm__head">
            <p className="tm__over">Your paper{paper.subject ? `, ${subjectName(paper.subject)}` : ''}</p>
            <h2 id="tr-title" className="tm__title">{title}</h2>
          </div>
          {paper.subject ? <span className="tm__art" aria-hidden="true"><SubjectObject id={paper.subject} size={112} lit life framed={false} /></span> : null}
        </div>
        {marks ? <p className="tm__value"><span><b>{marks.got}</b> of {marks.of} marks</span></p> : null}
        <p className="tm__why">{W.openLine}</p>
        <button type="button" className="tm__key" data-page-primary aria-haspopup="dialog" onClick={() => setOpen(true)}>
          <Play size={18} strokeWidth={2} aria-hidden="true" />{W.openButton}<span className="tm__key-len">{reel.seconds} s</span>
        </button>
      </div>
      <div className="tm__more tm__more--reel"><button type="button" onClick={() => onDone?.('later')}>Not now</button></div>
      {open ? <PaperReel script={reel.script} onClose={close} onAct={(act) => { setOpen(false); router.push(reelActHref(paper.id, act)); }} /> : null}
    </section>
  );
}
