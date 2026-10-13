// Some live questions store each option with its own letter in front ("A  7/2", "B. Planning", "C) A-2, B-1",
// "A 36"), so the runner showed the letter twice. The display strips that marker only when every option carries
// its own letter in order, which a real answer never does by accident. A single space after the letter is the
// weakest marker, so it counts only when no option then reads as a reference to other options ("A and B",
// "B or C"). Scoring and keys use the option index and never this text.
const LETTERS = 'ABCDE';
// After a single-space marker, text that continues a label reference rather than starting an answer.
const CONTINUES_REFERENCE = /^(?:and|or|nor|&|,|only|both|is|are|was|were|has|have|\(?[A-E]\)?(?:\s|,|$))/i;

function rawText(option) {
  return typeof option === 'string' ? option : option?.text ?? option?.label ?? option?.value ?? String(option ?? '');
}

export function plainOptionTexts(options) {
  const texts = (Array.isArray(options) ? options : []).map(rawText);
  if (texts.length < 2 || texts.length > LETTERS.length) return texts;
  const strong = texts.map((text, i) => new RegExp(String.raw`^\s*${LETTERS[i]}(?:\s*[.):]\s*|\s{2,})(?=\S)`).exec(text));
  if (strong.every(Boolean)) return texts.map((text, i) => text.slice(strong[i][0].length));
  const weak = texts.map((text, i) => new RegExp(String.raw`^\s*${LETTERS[i]}\s(?=\S)`).exec(text));
  if (texts.length >= 3 && weak.every(Boolean) && texts.every((text, i) => !CONTINUES_REFERENCE.test(text.slice(weak[i][0].length)))) {
    return texts.map((text, i) => text.slice(weak[i][0].length));
  }
  return texts;
}
