import * as React from 'react';
import { SubjectIcon } from '@/components/ui/Glyph';
import { BRAND_FLAGS } from '@/../data/brand_flags.mjs';
import { subjectArt, subjectArtSrc, subjectArtSrcSet } from '@/../data/subject_art.mjs';
import { LIFE, objectStage } from './ObjectLifeModel.mjs';
import { ObjectLife } from './ObjectLife';
import './subject-object.css';

// A subject's photo-real, lamp-lit 3D object (the app's own renders), the website's one way to show a subject.
//
//   <SubjectObject id="accountancy" size={72} />                 a 72 px square tile mark, a still picture
//   <SubjectObject id={subject.internalId} size={168} lit />     a hero object: alive, with its lamp glow
//   <SubjectObject id="economics" size={184} flight />           flies to the same object on the next page
//
// The box is square and laid out before the file decodes, so nothing shifts. The object is centred and never
// cropped, it stands on the app's two-ellipse contact shadow under its foot, and the right srcset file is
// picked for the drawn width, so it stays sharp on 1x to 3x screens. Below 32 px an object turns to mush, so
// small marks (list rows, chips) keep the line icon, as does a subject the art does not know (never a wrong
// object). Decorative by default, because the subject's name is printed beside it; pass `label` to name it.
//
// Life (the app's ObjectLife, src/components/brand/ObjectLife.jsx): at 96 px and up, or with `life`, the
// object floats on a 7.2 s breath in its own phase, leans toward the mouse, a finger and the scroll, catches
// one band of the lamp's light while it leans, and answers a tap with a spring, a tick and a sparkle.
// `sizes` overrides the drawn width when CSS resizes the box (the landing shelf shrinks on phones), so a phone
// does not fetch the desktop file. `life={false}` keeps a large object still. `flight` names it for the view
// transition to the same object on the next page (one per page: put it on the object the student taps, and on
// the one it lands on).
// Everything stays behind BRAND_FLAGS.subjectArt, and reduced motion keeps the still picture.

const MIN_OBJECT_PX = 32;
const ViewTransition = React.ViewTransition;
const pct = (n) => `${Math.round(n * 100) / 100}%`;
const ellipse = (e) => ({ left: pct(e.cx - e.rx), top: pct(e.cy - e.ry), width: pct(e.rx * 2), height: pct(e.ry * 2) });

export function SubjectObject({
  id,
  size = 72,
  framed = true,
  lit = false,
  label,
  priority = false,
  showArt = BRAND_FLAGS.subjectArt,
  life,
  flight = false,
  amplitude = LIFE.tapAmplitude,
  parallax = 0,
  sizes,
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
  const stage = objectStage(art, { framed });
  const { box } = stage;
  const alive = life ?? size >= LIFE.minSize;
  // The file is drawn at box.width percent of the tile; ask for that many CSS px (the browser multiplies by DPR).
  const drawn = Math.max(1, Math.ceil((size * box.width) / 100));
  const fallback = subjectArtSrc(art, art.widths.find((w) => w >= drawn * 2) || art.width);
  const place = { left: pct(box.x), top: pct(box.y), width: pct(box.width), height: pct(box.height) };
  const name = label || null;
  const img = (
    // A plain img with a hand-made srcset: the sizes already exist, so no image optimiser is spent.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      className="subj-obj__img"
      src={fallback}
      srcSet={subjectArtSrcSet(art)}
      sizes={sizes || `${drawn}px`}
      width={art.width}
      height={art.height}
      alt=""
      loading={priority ? 'eager' : 'lazy'}
      fetchPriority={priority ? 'high' : undefined}
      decoding="async"
      draggable={false}
      style={place}
    />
  );
  const object = (
    <span
      className={['subj-obj', lit && 'subj-obj--lit', alive && 'subj-obj--alive', className].filter(Boolean).join(' ')}
      style={{
        '--obj-size': `${size}px`,
        '--obj-phase': art.phase,
        '--obj-foot': `${pct(stage.foot.x)} ${pct(stage.foot.y)}`,
        '--obj-centre': `${pct(stage.centre.x)} ${pct(stage.centre.y)}`,
        ...style,
      }}
      data-subject={art.name}
      data-framed={framed ? '' : undefined}
      role={name ? 'img' : undefined}
      aria-label={name ? `${name}: ${art.object}` : undefined}
      aria-hidden={name ? undefined : 'true'}
    >
      {lit ? <span className="subj-obj__light" aria-hidden="true" /> : null}
      <span className="subj-obj__shadow" aria-hidden="true">
        <span className="subj-obj__occl" style={ellipse(stage.occlusion)} />
        <span className="subj-obj__contact" style={ellipse(stage.contact)} />
      </span>
      {alive ? (
        <span className="subj-obj__float" aria-hidden="true">
          <span className="subj-obj__tilt">
            <span className="subj-obj__react">
              {img}
              {/* The lamp's light, stopping above the foot. ObjectLife masks it with the file the picture
                  loaded, so it falls only on the object's own pixels and costs no second download. */}
              <span className="subj-obj__sheen" style={{ ...place, clipPath: `inset(0 0 ${pct(stage.lightStop)} 0)` }} />
            </span>
          </span>
        </span>
      ) : img}
      {alive || flight || parallax > 0 ? (
        <ObjectLife name={art.name} framed={framed} flight={Boolean(flight)} amplitude={amplitude} parallax={parallax} />
      ) : null}
    </span>
  );
  if (!flight || !ViewTransition) return object;
  // One name per object: the same subject on the next page takes it over and the browser flies it there.
  return (
    <ViewTransition name={`subj-${art.name}`} share="subj-flight" default="none">
      {object}
    </ViewTransition>
  );
}

export default SubjectObject;
