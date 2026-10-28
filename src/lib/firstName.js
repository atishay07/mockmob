// The first word of a display name for a greeting ("Aleksandra, what are we practising?"). Empty when there is no
// usable word: no name, a name that is really an email address (some sign-ins send it), or a single word too long to
// read as a name, so the greeting falls back to its plain form instead of printing 60 unbroken characters.
export function firstName(name) {
  const word = String(name || '').trim().split(/\s+/)[0] || '';
  if (word.includes('@') || Array.from(word).length > 24) return '';
  return word;
}
