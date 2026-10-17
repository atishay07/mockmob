import Link from 'next/link';
import RecoveryOverview from '@/components/RecoveryOverview';
import './progress.css';
// RecoveryOverview renders the header, the week (RhythmCard) with the next step under it, then the record, in reading order.
// Your standing lives under Progress (COMMUNITY-1018): the sidebar links it right below Progress, and this closing section links it
// from the page, in the same section pattern as the record above it.
export default function Progress(){return <div className="student-page student-page--progress"><RecoveryOverview view="progress"/><section className="rv-sec" aria-labelledby="pg-standing"><div className="rv-sec__head"><h2 id="pg-standing">Your standing</h2><span>Among MockMob students</span></div><div className="rv-empty"><p>Where your recorded mocks place you, and what moves you up. <Link className="pr-link" href="/leaderboard">Open your standing</Link></p></div></section></div>;}
