import { creatorInitials, featuredCreators, followersFigure, rankedReels } from '@/lib/social';

// The hero's proof line (round 11, 10 Nov 2026): a student who came from a reel half-trusts us, and the first key had no
// proof near it. The proof the page owns is its creators section (#on-instagram), so this is one quiet link to it, under the
// hero's three ways in: the featured creators as three small overlapping marks, each the first letter of the name on the
// section's covers (a 24 px mark holds one letter cleanly; the section ships no photos, so neither does this), biggest
// audience first, then "Featured by CUET creators with N followers", where N is the section's own "Combined followers"
// figure (src/lib/social.js followersFigure, the one function both read, so they never disagree; nothing is typed here).
// Below a 348 px column (phones of 375 px and under) the words sit on two short lines beside the marks, "Featured by CUET
// creators" over "199K+ followers" ("with" not shown; r10-hero.css, Round 11), so the figure never appears without its
// unit and never drops; screen readers always get the whole sentence. A same-page shortcut (data-page-jump, pageJump.mjs):
// the page glides to the section and focus lands on its heading. Round 4's loose fact line under the keys was removed for
// lying around; this is one designed element: no border, no pill, no icon but the marks. Server-drawn, no state.
export function HeroProof() {
  const creators = featuredCreators(rankedReels());
  if (!creators.length) return null;
  const figure = followersFigure(creators);
  const sentence = figure ? `Featured by CUET creators with ${figure} followers. See the reels.` : 'Featured by CUET creators. See the reels.';
  return (
    <a href="#on-instagram" className="lp-featured" data-page-jump="" aria-label={sentence}>
      <span className="lp-featured__marks" aria-hidden="true">
        {creators.slice(0, 3).map((creator) => (
          <span key={creator.handle} className="lp-featured__mark">{creatorInitials(creator.creator, 1)}</span>
        ))}
      </span>
      <span className="lp-featured__words">
        Featured by CUET creators
        {figure ? <span className="lp-featured__more"><span className="lp-featured__with"> with </span><b className="lp-featured__fig">{figure}</b> followers</span> : null}
      </span>
    </a>
  );
}
