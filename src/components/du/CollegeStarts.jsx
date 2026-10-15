// "Start from a college": four plain links that open the calculator on a programme (web IA plan 4.2
// and 4.3: the college tiles leave the home page and become a way into the calculator). They are
// ordinary anchors on purpose: the calculator reads ?course once when it loads, so a full page load
// is what puts the programme on screen. No illustrations, no taglines: the name and the programme.
const COLLEGES = [
  { name: 'SRCC', programme: 'B.Com. (Hons.)', course: 'b-com-hons' },
  { name: 'Hindu College', programme: 'Economics (Hons.)', course: 'b-a-hons-economics' },
  { name: 'Hansraj College', programme: 'B.Com. (Hons.)', course: 'b-com-hons' },
  { name: 'St. Stephen’s College', programme: 'English (Hons.)', course: 'b-a-hons-english' },
];

export function CollegeStarts() {
  return (
    <ul className="du-starts" aria-label="Start from a college">
      {COLLEGES.map((college) => (
        <li key={college.name}>
          <a href={`/cuet-cutoff-calculator?course=${college.course}`}>
            <strong>{college.name}</strong>
            <span>{college.programme}</span>
          </a>
        </li>
      ))}
    </ul>
  );
}
