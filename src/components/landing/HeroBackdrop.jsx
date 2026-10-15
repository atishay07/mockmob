// The hero's ground: only the Night Arena hairline grid, faint and masked to the top of the hero, fading into the
// page. No washes, no drifting lights, no dot matrix and no pointer-lit layer: the words carry the hero. Pure CSS,
// so it costs no script and renders in the server HTML.
export function HeroBackdrop() {
  return (
    <div className="lp-bg" aria-hidden="true">
      <div className="lp-bg__grid" />
      <div className="lp-bg__fade" />
    </div>
  );
}
