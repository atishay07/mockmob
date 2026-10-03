// Wall of love data. Real student words only.
//
// An entry appears on the site only when `consent: true`, which means the student agreed to be quoted
// (a message or email saying so is enough; keep it). Do not edit quotes, merge quotes, or attribute them
// to a college, rank or score unless the student said so in the same message.
//
//   { name: 'Aanya K.', detail: 'CUET 2026 aspirant', quote: '...', consent: true }
//
// An empty list hides the whole section. See /preview/wall (development only) for the layout with
// clearly-labelled placeholder text.
export const VOICES = [];

/** Only voices with explicit consent, a name and a quote are ever shown. */
export const publishedVoices = (list = VOICES) => list.filter((v) => v && v.consent === true && v.quote && v.name);
