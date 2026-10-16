// The marking line: one sentence at the foot of the exam comparator, at lede size (never a display statement, so it
// never competes with the section headings). The hero's small print already gives the size of the practice bank
// (HeroLive), so this line carries the one fact the comparator needs in plain words: every question is marked the way
// CUET marks it. No figure here is a count, so it needs no loading and can never disagree with the hero.
export function LiveStatsBand() {
  return (
    <p className="lp-proofline">
      Every question here is marked the way CUET marks it: <b>+5</b> for a right answer, <b>−1</b> for a wrong one and <b>0</b> for a blank.
    </p>
  );
}
