import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { FREE_TOOLS } from '@/lib/navigation';

// Free DU tools (web IA plan 4.2, section 4): the Cutoff calculator and the Combo planner side by
// side, no sign-up. College names open the calculator on that course. The ladder, college art and
// the Pro aside moved to the calculator page (IA8).
const CUTOFF = FREE_TOOLS.find((t) => t.id === 'cutoff');
const COMBO = FREE_TOOLS.find((t) => t.id === 'combinations');

// The course slugs the calculator already accepts in ?course= (the old landing college tiles).
const COLLEGES = [
  { name: 'SRCC', course: 'b-com-hons', label: 'B.Com (Hons)' },
  { name: 'Hindu College', course: 'b-a-hons-economics', label: 'B.A. (Hons) Economics' },
  { name: 'Hansraj College', course: 'b-com-hons', label: 'B.Com (Hons)' },
  { name: 'St. Stephen’s College', course: 'b-a-hons-english', label: 'B.A. (Hons) English' },
];

export function FreeTools() {
  return (
    <div className="lp-tools">
      <div className="lp-tool lp-tool--main">
        <h3 className="lp-h3">{CUTOFF.label}</h3>
        <p>{CUTOFF.detail}. Tick your subjects, pick your category and compare college by college.</p>
        <ul className="lp-tool__colleges" aria-label="Start from a college">
          {COLLEGES.map((c) => (
            <li key={c.name}>
              <Link href={`${CUTOFF.href}?course=${c.course}`}><b>{c.name}</b><span>{c.label}</span><ArrowUpRight size={16} aria-hidden="true" /></Link>
            </li>
          ))}
        </ul>
        <Link href={CUTOFF.href} className="mm-btn mm-btn--secondary">Open the cutoff calculator</Link>
      </div>
      <div className="lp-tool">
        <h3 className="lp-h3">{COMBO.label}</h3>
        <p>{COMBO.detail}. Choose your DU goals and the subjects you can take, then compare five-paper combinations against the published rules.</p>
        <Link href={COMBO.href} className="mm-btn mm-btn--secondary">Plan my subjects</Link>
      </div>
    </div>
  );
}
