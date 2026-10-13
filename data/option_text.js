// Some live questions store each option with its own letter in front ("A  7/2", "B. Planning", "C) A-2, B-1"),
// so the runner showed the letter twice. The display strips that marker only when every option carries its
// own letter in order, which a real answer never does by accident. Scoring and keys use the option index and
// never this text.
const LETTERS = 'ABCDE';

function rawText(option) {
  return typeof option === 'string' ? option : option?.text ?? option?.label ?? option?.value ?? String(option ?? '');
}

export function plainOptionTexts(options) {
  const texts = (Array.isArray(options) ? options : []).map(rawText);
  if (texts.length < 2 || texts.length > LETTERS.length) return texts;
  const markers = texts.map((text, i) => new RegExp(String.raw`^\s*${LETTERS[i]}(?:\s*[.):]\s*|\s{2,})(?=\S)`).exec(text));
  if (!markers.every(Boolean)) return texts;
  return texts.map((text, i) => text.slice(markers[i][0].length));
}
