// The hero's texture: the page's own paper grain (round 5, owner 6 Nov 2026). Round 4 (LK117/LK120: "some sort of texture
// ... in the background, like we had previously ... in black mode the black space is even more significant") drew an OMR
// answer-sheet bubble field here; the owner called it "very weird" and asked for it to be replaced, while the dark space
// should still not feel empty. The brand's material is paper ("Daylight Page, Night Exam", DESIGN.md), so the texture is
// the paper's own tooth: a fine, static grain, a few levels light and dark around the ground so it adds depth without
// lifting the ground into a patch, strongest around the desk where the lamp would fall and fading toward the words, the
// edges and the hero's foot (brand-texture.css). Not a pattern: no grid, dots, bubbles, glow, gradient wash or glass.
// Neutral in both themes (never volt), stronger in Night; it does not move; hidden from assistive technology. Two pre-drawn
// noise tiles (one SVG feTurbulence image each, rasterised once by the browser), no live filter, no image file.
//
//   <BrandTexture variant="hero" />   behind the home hero (its section is the positioned, isolated parent)

import '@/app/brand-texture.css';

export function BrandTexture({ variant = 'hero' }) {
  return <div className={`mm-texture mm-texture--${variant}`} aria-hidden="true" />;
}

export default BrandTexture;
