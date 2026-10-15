// The app's photo-real, lamp-lit 3D subject objects, on the website (owner's yes at Gate A, 15 Oct 2026).
//
// One object per subject, the same files as the app: public/art/subjects/obj-<name>.webp is a byte copy of
// wt-phase2/flutter_app/assets/art/obj-<name>.webp (at most 1024 px on the long side, never enlarged), and
// obj-<name>-512.webp / obj-<name>-256.webp are LANCZOS reductions for srcset. They come from
// mockmob-next/tmp/feature-wave-1015/masters/I2/web (make_web_art.py), which reads the sizes and feet below
// from the app's lib/core/art/object_art.dart, so the two platforms cannot disagree. A regenerated object is
// copied there once and both platforms update.
//
// Rules from the app: never cropped (the object sits wholly inside the tile's margin), the contact shadow
// sits under the object's foot (never under an empty corner), one object per subject, and a subject the art
// does not know keeps its line icon, never a wrong object.

export const SUBJECT_ART_DIR = '/art/subjects';
export const SUBJECT_ART_APP_SOURCE = 'wt-phase2/flutter_app/assets/art';

// name, intrinsic width and height of the full file, foot centre and width (fractions of the width), the
// ground line (fraction of the height), the srcset widths that exist, and the alt text (what the object is).
const render = (name, width, height, footX, footWidth, ground, widths, object) => Object.freeze({
  name,
  file: `obj-${name}.webp`,
  src: `${SUBJECT_ART_DIR}/obj-${name}.webp`,
  width,
  height,
  footX,
  footWidth,
  ground,
  widths: Object.freeze(widths),
  object,
});

export const SUBJECT_RENDERS = Object.freeze({
  accountancy: render('accountancy', 1024, 666, 0.54, 0.8, 0.92, [256, 512, 1024], 'A desk calculator on a ledger page'),
  business: render('business', 685, 769, 0.5, 0.88, 0.955, [256, 512, 685], 'A brass stamp with an ink pad'),
  economics: render('economics', 792, 1006, 0.5, 0.88, 0.96, [256, 512, 792], 'A kitchen scale with an onion'),
  english: render('english', 1024, 631, 0.48, 0.8, 0.88, [256, 512, 1024], 'A folded newspaper and a fountain pen'),
  generaltest: render('generaltest', 911, 722, 0.5, 0.86, 0.93, [256, 512, 911], 'A puzzle cube and a compass'),
  mathematics: render('mathematics', 1008, 699, 0.52, 0.8, 0.9, [256, 512, 1008], 'A pair of compasses and a protractor on graph paper'),
  physics: render('physics', 942, 848, 0.5, 0.88, 0.95, [256, 512, 942], 'A Newton’s cradle'),
  chemistry: render('chemistry', 737, 749, 0.5, 0.88, 0.955, [256, 512, 737], 'A conical flask and a test tube'),
  biology: render('biology', 455, 783, 0.5, 0.86, 0.955, [256, 455], 'A brass microscope'),
  history: render('history', 989, 680, 0.5, 0.88, 0.92, [256, 512, 989], 'A carved seal and a scroll'),
  politicalscience: render('politicalscience', 1020, 783, 0.5, 0.84, 0.94, [256, 512, 1020], 'A bound constitution and a gavel'),
  geography: render('geography', 633, 892, 0.5, 0.58, 0.955, [256, 633], 'A globe'),
  psychology: render('psychology', 1024, 1018, 0.53, 0.72, 0.955, [256, 512, 1024], 'A glass brain on a stand'),
  sociology: render('sociology', 951, 762, 0.5, 0.9, 0.945, [256, 512, 951], 'Wooden figures on a woven mat'),
  computerscience: render('computerscience', 1024, 813, 0.5, 0.8, 0.92, [256, 512, 1024], 'A laptop showing code'),
  language: render('language', 1024, 601, 0.56, 0.74, 0.9, [256, 512, 1024], 'An open notebook and a pencil'),
  environmentalstudies: render('environmentalstudies', 1024, 739, 0.5, 0.88, 0.93, [256, 512, 1024], 'A tree-trunk slice with a seedling growing from it'),
  massmedia: render('massmedia', 738, 982, 0.4, 0.62, 0.955, [256, 512, 738], 'A vintage radio microphone'),
  homescience: render('homescience', 1024, 704, 0.58, 0.8, 0.94, [256, 512, 1024], 'A vintage sewing machine with a pincushion'),
  physicaleducation: render('physicaleducation', 1024, 680, 0.5, 0.9, 0.93, [256, 512, 1024], 'A brass whistle and training cones'),
  legalstudies: render('legalstudies', 1024, 874, 0.48, 0.8, 0.94, [256, 512, 1024], 'Brass scales of justice and a sealed scroll'),
  knowledgetradition: render('knowledgetradition', 1024, 673, 0.5, 0.92, 0.93, [256, 512, 1024], 'A palm-leaf manuscript in carved wooden covers'),
  anthropology: render('anthropology', 1024, 919, 0.52, 0.8, 0.92, [256, 512, 1024], 'A plaster skull cast and a brass caliper'),
  finearts: render('finearts', 1024, 647, 0.52, 0.86, 0.9, [256, 512, 1024], 'A painter’s palette with brushes'),
  performingarts: render('performingarts', 1024, 664, 0.5, 0.88, 0.935, [256, 512, 1024], 'A pair of tabla drums'),
  engineeringgraphics: render('engineeringgraphics', 1024, 676, 0.5, 0.88, 0.9, [256, 512, 1024], 'A drafting compass and set square on blueprint paper'),
  entrepreneurship: render('entrepreneurship', 1024, 762, 0.54, 0.86, 0.935, [256, 512, 1024], 'A brass-trimmed cash box with coins'),
  agriculture: render('agriculture', 800, 703, 0.5, 0.82, 0.93, [256, 512, 800], 'A wheat sheaf and a hand trowel'),
  teachingaptitude: render('teachingaptitude', 1024, 856, 0.5, 0.84, 0.93, [256, 512, 1024], 'A school chalkboard with chalk and a duster'),
});

// Website subject ids (public and internal: data/subjects.js, data/cuet_controls.js) and the app's aliases,
// to a render. The CUET language papers share the notebook, as in the app.
const LANGUAGES = ['hindi', 'assamese', 'bengali', 'gujarati', 'kannada', 'malayalam', 'marathi', 'odia', 'punjabi', 'tamil', 'telugu', 'urdu', 'sanskrit'];
export const SUBJECT_ART_BY_ID = Object.freeze({
  accountancy: 'accountancy',
  business_studies: 'business', bst: 'business', business: 'business',
  economics: 'economics',
  english: 'english',
  general_test: 'generaltest', gat: 'generaltest', gt: 'generaltest',
  mathematics: 'mathematics', applied_mathematics: 'mathematics', maths: 'mathematics',
  physics: 'physics',
  chemistry: 'chemistry',
  biology: 'biology',
  history: 'history',
  political_science: 'politicalscience',
  geography: 'geography',
  psychology: 'psychology',
  sociology: 'sociology',
  computer_science: 'computerscience',
  environmental_studies: 'environmentalstudies',
  mass_media: 'massmedia',
  home_science: 'homescience',
  physical_education: 'physicaleducation',
  legal_studies: 'legalstudies',
  knowledge_tradition_india: 'knowledgetradition',
  anthropology: 'anthropology',
  fine_arts: 'finearts',
  performing_arts: 'performingarts',
  engineering_graphics: 'engineeringgraphics',
  entrepreneurship: 'entrepreneurship',
  agriculture: 'agriculture',
  teaching_aptitude: 'teachingaptitude',
  ...Object.fromEntries(LANGUAGES.map((id) => [id, 'language'])),
});

/** The render for a subject id (any case; dashes or spaces allowed), or null: keep the line icon. */
export function subjectArt(subjectId) {
  const id = String(subjectId || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  const name = SUBJECT_ART_BY_ID[id];
  return name ? SUBJECT_RENDERS[name] : null;
}

/** The file for one srcset width (the full file for the largest). */
export function subjectArtSrc(art, width) {
  if (!art) return '';
  return width >= art.width ? art.src : `${SUBJECT_ART_DIR}/obj-${art.name}-${width}.webp`;
}

/** The srcset string: every width that exists, smallest first. */
export function subjectArtSrcSet(art) {
  if (!art) return '';
  return art.widths.map((w) => `${subjectArtSrc(art, w)} ${w}w`).join(', ');
}

/**
 * Where the picture sits in a square box of `side`: centred and wholly inside, with room under it for the
 * contact shadow. `framed` keeps the tile's margin. Mirrors SubjectRender.rectIn in the app.
 * Returns { x, y, width, height, shadow: { x, y, width } } in the units of `side` (pass 100 for percent).
 */
export function artBox(art, side, { framed = true } = {}) {
  if (!art || !(side > 0)) return null;
  const inner = framed
    ? { l: side * 0.085, t: side * 0.075, r: side * 0.915, b: side * 0.875 }
    : { l: side * 0.03, t: side * 0.04, r: side * 0.97, b: side * 0.92 };
  const iw = inner.r - inner.l;
  const ih = inner.b - inner.t;
  const scale = Math.min(iw / art.width, ih / art.height);
  const width = art.width * scale;
  const height = art.height * scale;
  const x = inner.l + (iw - width) / 2;
  const y = inner.t + (ih - height) / 2;
  return { x, y, width, height, shadow: { x: x + width * (art.footX - art.footWidth / 2), y: y + height * art.ground, width: width * art.footWidth } };
}
