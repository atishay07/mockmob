import RecoveryOverview from '@/components/RecoveryOverview';
import RhythmCard from '@/components/RhythmCard';
// The page header (inside RecoveryOverview) leads; arena.css places the weekly rhythm right under it.
export default function Progress(){return <div className="student-page student-page--progress"><RhythmCard/><RecoveryOverview view="progress"/></div>;}
