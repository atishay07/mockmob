// The app's photo-real 3D subject objects, on the website (web IA plan 7, N7).
//
// One map for both platforms. The files in public/art/subjects/ are byte copies of the app's
// wt-phase2/flutter_app/assets/art/obj-*.webp, under the same names, so a regenerated object is
// copied once and both platforms update. Sizes and feet are the app's own measurements
// (lib/core/art/object_art.dart SubjectRender): the box is laid out before the file decodes, and the
// contact shadow sits under the object's foot, never under an empty corner.
//
// Rules from the app: never cropped (object-fit: contain inside the tile's margin), one object per
// subject, and a subject the art does not know keeps its initials card, never a wrong object.
// Shown only while brand_flags.subjectArt is on.

export const SUBJECT_ART_DIR = '/art/subjects';
export const SUBJECT_ART_APP_SOURCE = 'wt-phase2/flutter_app/assets/art';

const render = (name, width, height, footX, footWidth, ground, object) =>
  Object.freeze({ name, file: `obj-${name}.webp`, src: `${SUBJECT_ART_DIR}/obj-${name}.webp`, width, height, footX, footWidth, ground, object });

// Alt text says what the object is; the subject name is always printed beside it.
export const SUBJECT_RENDERS = Object.freeze({
  accountancy: render('accountancy', 512, 335, 0.54, 0.80, 0.92, 'A desk calculator on a ledger page'),
  business: render('business', 456, 512, 0.50, 0.88, 0.955, 'A brass stamp with an ink pad'),
  economics: render('economics', 403, 512, 0.50, 0.88, 0.96, 'A kitchen scale with an onion'),
  english: render('english', 512, 316, 0.48, 0.80, 0.88, 'A folded newspaper and a fountain pen'),
  generaltest: render('generaltest', 512, 406, 0.50, 0.86, 0.93, 'A puzzle cube and a compass'),
  mathematics: render('mathematics', 512, 355, 0.52, 0.80, 0.90, 'A pair of compasses and a protractor on graph paper'),
  physics: render('physics', 512, 461, 0.50, 0.88, 0.95, 'A Newton’s cradle'),
  chemistry: render('chemistry', 504, 512, 0.50, 0.88, 0.955, 'A conical flask and a test tube'),
  biology: render('biology', 298, 512, 0.50, 0.86, 0.955, 'A brass microscope'),
  history: render('history', 512, 352, 0.50, 0.88, 0.92, 'A carved seal and a scroll'),
  politicalscience: render('politicalscience', 512, 393, 0.50, 0.84, 0.94, 'A bound constitution and a gavel'),
  geography: render('geography', 363, 512, 0.50, 0.58, 0.955, 'A globe'),
  psychology: render('psychology', 512, 509, 0.53, 0.72, 0.955, 'A glass brain on a stand'),
  sociology: render('sociology', 512, 410, 0.50, 0.90, 0.945, 'Wooden figures on a woven mat'),
  computerscience: render('computerscience', 512, 408, 0.50, 0.80, 0.92, 'A laptop showing code'),
  language: render('language', 512, 300, 0.56, 0.74, 0.90, 'An open notebook and a pencil'),
});

// Website subject ids (public and internal, data/cuet_controls.js and data/subjects.js) to a render.
// The CUET language papers share the notebook, as in the app.
const LANGUAGES = ['hindi', 'assamese', 'bengali', 'gujarati', 'kannada', 'malayalam', 'marathi', 'odia', 'punjabi', 'tamil', 'telugu', 'urdu', 'sanskrit'];
export const SUBJECT_ART_BY_ID = Object.freeze({
  accountancy: 'accountancy',
  business_studies: 'business', bst: 'business',
  economics: 'economics',
  english: 'english',
  general_test: 'generaltest', gat: 'generaltest', gt: 'generaltest',
  mathematics: 'mathematics', applied_mathematics: 'mathematics',
  physics: 'physics',
  chemistry: 'chemistry',
  biology: 'biology',
  history: 'history',
  political_science: 'politicalscience',
  geography: 'geography',
  psychology: 'psychology',
  sociology: 'sociology',
  computer_science: 'computerscience',
  ...Object.fromEntries(LANGUAGES.map((id) => [id, 'language'])),
});

// The 15 public subjects in data/cuet_controls.js order (CUET_PUBLIC_ALLOWED_SUBJECTS; a test keeps
// them in step), with the short name students read and the subject hub where one exists
// (src/lib/subjectHubs.js). The landing Subjects section, the footer and Practice tiles read this.
const subject = (id, name, hub = null, internal = id) => Object.freeze({ id, internal, name, hub });
export const PUBLIC_SUBJECTS = Object.freeze([
  subject('english', 'English', '/cuet/english'),
  subject('general_test', 'General Test', null, 'gat'),
  subject('accountancy', 'Accountancy', '/cuet/accountancy'),
  subject('business_studies', 'Business Studies', '/cuet/business-studies'),
  subject('economics', 'Economics', '/cuet/economics'),
  subject('mathematics', 'Mathematics'),
  subject('physics', 'Physics'),
  subject('chemistry', 'Chemistry'),
  subject('biology', 'Biology'),
  subject('history', 'History', '/cuet/history'),
  subject('political_science', 'Political Science', '/cuet/political-science'),
  subject('geography', 'Geography'),
  subject('psychology', 'Psychology'),
  subject('sociology', 'Sociology'),
  subject('computer_science', 'Computer Science'),
]);

/** The short subject name students read, for a public or internal id; a tidy fallback otherwise. */
export function subjectName(subjectId) {
  const id = String(subjectId || '').trim().toLowerCase();
  const hit = PUBLIC_SUBJECTS.find((s) => s.id === id || s.internal === id);
  if (hit) return hit.name;
  if (!id) return '';
  const words = id.replace(/[_-]+/g, ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** The render for a subject id (any case, dashes or spaces allowed), or null: keep the initials card. */
export function subjectArt(subjectId) {
  const id = String(subjectId || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  const name = SUBJECT_ART_BY_ID[id];
  return name ? SUBJECT_RENDERS[name] : null;
}

/**
 * Where the picture sits in a square box of `side` px: centred and wholly inside, with room under it
 * for the contact shadow. `framed` uses the tile's margin. Mirrors SubjectRender.rectIn in the app.
 * Returns { x, y, width, height, shadow: { x, y, width } } in px.
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
