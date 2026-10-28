// A list of chapters carried as one comma-joined string (?chapters=A,B and the sessions body).
// Nine canonical chapters hold a comma themselves ("Alcohols, Phenols & Ethers"), so a plain split(',') cuts them
// in two and the launch is refused as INVALID_CHAPTER. The list is read against the names that are valid for the
// subject: at each position the longest run of pieces that rejoins into a valid name wins. Names that are valid on
// their own read exactly as before. A piece that never rejoins into a valid name is kept as it is, so the caller's
// own check still refuses it. Pure: node:test loads it, and so does the browser.

export const CHAPTER_LIST_MAX = 12;
const LONGEST_NAME_PIECES = 6;

/**
 * parseChapterList(raw, isValid) -> string[]. `raw` is the joined string (or an array, read as already split);
 * `isValid(name)` says whether a name is a real chapter. Order is kept, repeats are dropped, empty pieces are
 * dropped, and at most CHAPTER_LIST_MAX names are returned.
 */
export function parseChapterList(raw, isValid = () => false) {
  const pieces = Array.isArray(raw) ? raw.map((p) => String(p)) : typeof raw === 'string' ? raw.split(',') : [];
  const out = [];
  for (let i = 0; i < pieces.length;) {
    let took = 0;
    for (let n = Math.min(LONGEST_NAME_PIECES, pieces.length - i); n >= 2; n--) {
      if (isValid(pieces.slice(i, i + n).join(','))) { took = n; break; }
    }
    const name = took ? pieces.slice(i, i + took).join(',') : pieces[i];
    i += took || 1;
    if (name && !out.includes(name)) out.push(name);
  }
  return out.slice(0, CHAPTER_LIST_MAX);
}
