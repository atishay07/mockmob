import RecoveryOverview from '@/components/RecoveryOverview';
import './progress.css';
// RecoveryOverview renders the header, the week (RhythmCard) with the next step under it, then the record, in reading order.
export default function Progress(){return <div className="student-page student-page--progress"><RecoveryOverview view="progress"/></div>;}
