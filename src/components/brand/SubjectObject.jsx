import React from 'react';
import { SubjectIcon } from '@/components/ui/Glyph';
import { BRAND_FLAGS } from '@/../data/brand_flags.mjs';
import { artBox, subjectArt, subjectArtSrc, subjectArtSrcSet } from '@/../data/subject_art.mjs';

// A subject's photo-real, lamp-lit 3D object (the app's own renders), the website's one way to show a subject.
//
//   <SubjectObject id="accountancy" size={72} />          a 72 px square tile mark
//   <SubjectObject id={subject.internalId} size={120} lit />  a larger hero object with its lamp glow
//
// The box is square and laid out before the file decodes, so nothing shifts. The object is centred and never
// cropped, its contact shadow sits under its foot (the app's measurements), and the right srcset file is
// picked for the drawn width, so it stays sharp on 1x to 3x screens. Below 32 px an object turns to mush, so
// small marks (list rows, chips) keep the line icon, as does a subject the art does not know (never a wrong
// object). Decorative by default, because the subject's name is printed beside it; pass `label` to name it.
//
// Motion (src/app/brand.css): the object settles in once on first paint, and lifts a little while its tile
// (any ancestor with .subj-obj-host) is hovered or focused. Transform and opacity only; none when the student
// or the device asks for reduced motion.

const MIN_OBJECT_PX = 32;

export function SubjectObject({
  id,
  size = 72,
  framed = true,
  lit = false,
  label,
  priority = false,
  showArt = BRAND_FLAGS.subjectArt,
  className = '',
  style,
}) {
  const art = showArt && size >= MIN_OBJECT_PX ? subjectArt(id) : null;
  if (!art) {
    const glyph = Math.max(14, Math.min(28, Math.round(size * 0.42)));
    return (
      <span className={`subj-obj subj-obj--glyph ${className}`.trim()} style={{ '--obj-size': `${size}px`, ...style }} data-subject={id || undefined}>
        <SubjectIcon id={id} size={glyph} />
      </span>
    );
  }
  const box = artBox(art, 100, { framed });
  const pct = (n) => `${Math.round(n * 100) / 100}%`;
  // The file is drawn at box.width percent of the tile; ask for that many CSS px (the browser multiplies by DPR).
  const drawn = Math.max(1, Math.ceil((size * box.width) / 100));
  const name = label || null;
  return (
    <span
      className={`subj-obj ${lit ? 'subj-obj--lit' : ''} ${className}`.replace(/\s+/g, ' ').trim()}
      style={{ '--obj-size': `${size}px`, ...style }}
      data-subject={art.name}
      role={name ? 'img' : undefined}
      aria-label={name ? `${name}: ${art.object}` : undefined}
      aria-hidden={name ? undefined : 'true'}
    >
      {lit ? <span className="subj-obj__light" aria-hidden="true" /> : null}
      <span
        className="subj-obj__shadow"
        aria-hidden="true"
        style={{ left: pct(box.shadow.x), top: pct(box.shadow.y), width: pct(box.shadow.width) }}
      />
      {/* A plain img with a hand-made srcset: the sizes already exist, so no image optimiser is spent. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        className="subj-obj__img"
        src={subjectArtSrc(art, art.widths.find((w) => w >= drawn * 2) || art.width)}
        srcSet={subjectArtSrcSet(art)}
        sizes={`${drawn}px`}
        width={art.width}
        height={art.height}
        alt=""
        loading={priority ? 'eager' : 'lazy'}
        fetchPriority={priority ? 'high' : undefined}
        decoding="async"
        draggable={false}
        style={{ left: pct(box.x), top: pct(box.y), width: pct(box.width), height: pct(box.height) }}
      />
    </span>
  );
}

export default SubjectObject;
