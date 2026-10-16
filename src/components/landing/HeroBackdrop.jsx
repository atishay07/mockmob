// The hero's ground: the plain page. The faint hairline grid that used to sit behind the hero was ambient
// decoration (type first, nothing ambient), so it is gone; only the fade into the page below stays. No washes,
// no drifting lights, no dot matrix and no pointer-lit layer: the words carry the hero. Pure CSS, no script.
export function HeroBackdrop() {
  return (
    <div className="lp-bg" aria-hidden="true">
      <div className="lp-bg__fade" />
    </div>
  );
}
