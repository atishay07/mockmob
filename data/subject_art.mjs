// The app's photo-real, lamp-lit 3D subject objects, on the website (owner's yes at Gate A, 15 Oct 2026).
//
// One object per subject, the same renders as the app (wt-phase2/flutter_app/assets/art/obj-<name>.webp, I2 of
// 15 Oct: 13 new objects and sharper Accountancy and Computer Science). The files are versioned (.v2), because
// next.config serves images with a one-year immutable cache, and every file is under 120 KB:
//   obj-<name>.v2.webp       the app's file itself when it is under 120 KB; otherwise the widest size that fits,
//                            made from the lossless master by the same crop, one linear-light LANCZOS resize
//                            and quality 80 (never enlarged), so it is a uniform scale of the app's file
//   obj-<name>.v2-512.webp   and -256: the same, for srcset
// Generator: mockmob-next/tmp/feature-wave-1015/masters/I2 (web/subject_art.v2.json for the feet and alt text,
// read from the app's lib/core/art/object_art.dart, so the two platforms cannot disagree).
//
// Rules from the app: never cropped (the object sits wholly inside the tile's margin), the contact shadow
// sits under the object's foot (never under an empty corner), one object per subject, and a subject the art
// does not know keeps its line icon, never a wrong object. Each object also carries its life numbers: its
// float phase (subject_identity.dart) and its subject light, Night and Day (core/theme/light_fields.dart),
// which the sparkle blooms in (src/components/brand/ObjectLife.jsx).

export const SUBJECT_ART_DIR = '/art/subjects';
export const SUBJECT_ART_VERSION = 'v2';
export const SUBJECT_ART_APP_SOURCE = 'wt-phase2/flutter_app/assets/art';

// The subject light fields (app: SubjectLight). The 13 subjects added on 15 Oct share the notebook's sepia.
const LIGHT = Object.freeze({
  ACCOUNTANCY: Object.freeze({ night: '#3B2A10', day: '#F6E8CF' }),
  BUSINESS: Object.freeze({ night: '#14213F', day: '#DCE3F7' }),
  ECONOMICS: Object.freeze({ night: '#0F3330', day: '#D3EEEA' }),
  ENGLISH: Object.freeze({ night: '#3A1626', day: '#F4DDE6' }),
  GENERAL_TEST: Object.freeze({ night: '#22300F', day: '#E2EDCF' }),
  MATHEMATICS: Object.freeze({ night: '#1C2638', day: '#DEE4EE' }),
  PHYSICS: Object.freeze({ night: '#241C3A', day: '#E4DEF2' }),
  CHEMISTRY: Object.freeze({ night: '#0E2F2A', day: '#D2ECE6' }),
  BIOLOGY: Object.freeze({ night: '#1C2E12', day: '#DDEBD0' }),
  HISTORY: Object.freeze({ night: '#3A2414', day: '#F3E2D2' }),
  POLITICAL_SCIENCE: Object.freeze({ night: '#38171A', day: '#F2DADB' }),
  GEOGRAPHY: Object.freeze({ night: '#102A3A', day: '#D4E6F0' }),
  PSYCHOLOGY: Object.freeze({ night: '#301A33', day: '#EDDCEF' }),
  SOCIOLOGY: Object.freeze({ night: '#34280E', day: '#F1E6CC' }),
  COMPUTER_SCIENCE: Object.freeze({ night: '#14291C', day: '#D6EADC' }),
  LANGUAGE: Object.freeze({ night: '#2E2418', day: '#EFE5D6' }),
});

// name, intrinsic width and height of the website's full file, foot centre and width (fractions of the
// width), the ground line (fraction of the height), the srcset widths that exist, the alt text (what the
// object is), the float phase (0 to 1 of the 7.2 s cycle) and the subject light.
const render = (name, width, height, footX, footWidth, ground, widths, object, phase, light) => Object.freeze({
  name,
  file: `obj-${name}.${SUBJECT_ART_VERSION}.webp`,
  src: `${SUBJECT_ART_DIR}/obj-${name}.${SUBJECT_ART_VERSION}.webp`,
  width,
  height,
  footX,
  footWidth,
  ground,
  widths: Object.freeze(widths),
  object,
  phase,
  light,
});

export const SUBJECT_RENDERS = Object.freeze({
  accountancy: render('accountancy', 1024, 666, 0.54, 0.8, 0.92, [256, 512, 1024], 'A desk calculator on a ledger page', 0, LIGHT.ACCOUNTANCY),
  business: render('business', 685, 582, 0.55, 0.8, 0.96, [256, 512, 685], 'An open briefcase with a growth chart, coins and a calculator', 0.137, LIGHT.BUSINESS),
  economics: render('economics', 792, 1006, 0.5, 0.88, 0.96, [256, 512, 792], 'A kitchen scale with an onion', 0.274, LIGHT.ECONOMICS),
  english: render('english', 1024, 631, 0.48, 0.8, 0.88, [256, 512, 1024], 'A folded newspaper and a fountain pen', 0.411, LIGHT.ENGLISH),
  generaltest: render('generaltest', 911, 722, 0.5, 0.86, 0.93, [256, 512, 911], 'A puzzle cube and a compass', 0.548, LIGHT.GENERAL_TEST),
  mathematics: render('mathematics', 1008, 699, 0.52, 0.8, 0.9, [256, 512, 1008], 'A pair of compasses and a protractor on graph paper', 0.685, LIGHT.MATHEMATICS),
  physics: render('physics', 942, 848, 0.5, 0.88, 0.95, [256, 512, 942], 'A Newton’s cradle', 0.822, LIGHT.PHYSICS),
  chemistry: render('chemistry', 737, 749, 0.5, 0.88, 0.955, [256, 512, 737], 'A conical flask and a test tube', 0.959, LIGHT.CHEMISTRY),
  biology: render('biology', 455, 783, 0.5, 0.86, 0.955, [256, 455], 'A brass microscope', 0.096, LIGHT.BIOLOGY),
  history: render('history', 989, 680, 0.5, 0.88, 0.92, [256, 512, 989], 'A carved seal and a scroll', 0.233, LIGHT.HISTORY),
  politicalscience: render('politicalscience', 1020, 783, 0.5, 0.84, 0.94, [256, 512, 1020], 'A bound constitution and a gavel', 0.37, LIGHT.POLITICAL_SCIENCE),
  geography: render('geography', 633, 892, 0.5, 0.58, 0.955, [256, 633], 'A globe', 0.507, LIGHT.GEOGRAPHY),
  psychology: render('psychology', 1024, 1018, 0.53, 0.72, 0.955, [256, 512, 1024], 'A glass brain on a stand', 0.644, LIGHT.PSYCHOLOGY),
  sociology: render('sociology', 951, 762, 0.5, 0.9, 0.945, [256, 512, 951], 'Wooden figures on a woven mat', 0.781, LIGHT.SOCIOLOGY),
  computerscience: render('computerscience', 1024, 813, 0.5, 0.8, 0.92, [256, 512, 1024], 'A laptop showing code', 0.918, LIGHT.COMPUTER_SCIENCE),
  language: render('language', 1024, 601, 0.56, 0.74, 0.9, [256, 512, 1024], 'An open notebook and a pencil', 0.055, LIGHT.LANGUAGE),
  environmentalstudies: render('environmentalstudies', 1024, 739, 0.5, 0.88, 0.93, [256, 512, 1024], 'A tree-trunk slice with a seedling growing from it', 0.03, LIGHT.LANGUAGE),
  massmedia: render('massmedia', 738, 982, 0.4, 0.62, 0.955, [256, 512, 738], 'A vintage radio microphone', 0.11, LIGHT.LANGUAGE),
  homescience: render('homescience', 1024, 704, 0.58, 0.8, 0.94, [256, 512, 1024], 'A vintage sewing machine with a pincushion', 0.19, LIGHT.LANGUAGE),
  physicaleducation: render('physicaleducation', 1024, 680, 0.5, 0.9, 0.93, [256, 512, 1024], 'A brass whistle and training cones', 0.255, LIGHT.LANGUAGE),
  legalstudies: render('legalstudies', 1024, 874, 0.48, 0.8, 0.94, [256, 512, 1024], 'Brass scales of justice and a sealed scroll', 0.35, LIGHT.LANGUAGE),
  knowledgetradition: render('knowledgetradition', 1024, 673, 0.5, 0.92, 0.93, [256, 512, 1024], 'A palm-leaf manuscript in carved wooden covers', 0.43, LIGHT.LANGUAGE),
  anthropology: render('anthropology', 1024, 919, 0.52, 0.8, 0.92, [256, 512, 1024], 'A plaster skull cast and a brass caliper', 0.57, LIGHT.LANGUAGE),
  finearts: render('finearts', 1024, 647, 0.52, 0.86, 0.9, [256, 512, 1024], 'A painter’s palette with brushes', 0.61, LIGHT.LANGUAGE),
  performingarts: render('performingarts', 1024, 664, 0.5, 0.88, 0.935, [256, 512, 1024], 'A pair of tabla drums', 0.7, LIGHT.LANGUAGE),
  engineeringgraphics: render('engineeringgraphics', 1024, 676, 0.5, 0.88, 0.9, [256, 512, 1024], 'A drafting compass and set square on blueprint paper', 0.75, LIGHT.LANGUAGE),
  entrepreneurship: render('entrepreneurship', 1024, 762, 0.54, 0.86, 0.935, [256, 512, 1024], 'A brass-trimmed cash box with coins', 0.84, LIGHT.LANGUAGE),
  agriculture: render('agriculture', 800, 703, 0.5, 0.82, 0.93, [256, 512, 800], 'A wheat sheaf and a hand trowel', 0.89, LIGHT.LANGUAGE),
  teachingaptitude: render('teachingaptitude', 1024, 856, 0.5, 0.84, 0.93, [256, 512, 1024], 'A school chalkboard with chalk and a duster', 0.99, LIGHT.LANGUAGE),
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
  return width >= art.width ? art.src : `${SUBJECT_ART_DIR}/obj-${art.name}.${SUBJECT_ART_VERSION}-${width}.webp`;
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
