import Link from 'next/link';
import { ArrowUpRight, MapPin } from 'lucide-react';

const COLLEGES = [
  { name: 'SRCC', detail: 'A commerce ambition', position: '0% 0%', course: 'b-com-hons' },
  { name: 'Hindu College', detail: 'Find your field', position: '100% 0%', course: 'b-a-hons-economics' },
  { name: 'Hansraj College', detail: 'Your North Campus chapter', position: '0% 100%', course: 'b-com-hons' },
  { name: 'St. Stephen’s', detail: 'A new perspective', position: '100% 100%', course: 'b-a-hons-english' },
];

export function CollegeDestinations() {
  return (
    <div className="lp-colleges" id="college-destinations">
      <div className="lp-colleges__intro">
        <div><MapPin size={17} aria-hidden="true" /><h3>Give your preparation a destination.</h3></div>
        <p>Explore DU programmes and past cutoffs.</p>
      </div>
      <div className="lp-colleges__grid">
        {COLLEGES.map((college) => (
          <Link className="lp-college" href={`/cuet-cutoff-calculator?course=${college.course}`} key={college.name}>
            <span className="lp-college__art" style={{ backgroundPosition: college.position }} aria-hidden="true" />
            <span className="lp-college__copy"><strong>{college.name}</strong><span>{college.detail}</span></span>
            <ArrowUpRight size={18} aria-hidden="true" />
          </Link>
        ))}
      </div>
      <p className="lp-colleges__note">Campus-inspired illustrations. Explore course cutoffs in the calculator; admission depends on eligibility and allocation.</p>
    </div>
  );
}
