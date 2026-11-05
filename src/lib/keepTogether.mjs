// Words that must never part at a line end on the public pages (night 1105, R2-B): "CUET 2027", "CUET UG 2026",
// "Class 12", "Round 3", "Paper 301". A no-break space joins each pair, so a heading or a paragraph never leaves
// "CUET" at the end of one line and "2027" at the start of the next. Only rendered text goes through this; JSON-LD and
// metadata keep plain spaces.
export const NBSP = ' ';

const PAIRS = /\b(CUET|UG|Class|Round|Paper) (\d{1,4})\b/g;

/** The string with its exam names and numbers joined by no-break spaces; anything that is not a string is returned as it is. */
export function keepTogether(text) {
  if (typeof text !== 'string') return text;
  return text.replace(/\bCUET UG\b/g, `CUET${NBSP}UG`).replace(PAIRS, `$1${NBSP}$2`);
}

export default keepTogether;
