// Read-only WordNet 3.0 lookups for licensed, verbatim study facts. No network or model calls.
import { readFileSync } from 'node:fs';
const cache = {};
const load = pos => cache[pos] ||= readFileSync(`data/study/sources/dict/data.${pos}`, 'utf8').split('\n');
const index = pos => cache[`i${pos}`] ||= readFileSync(`data/study/sources/dict/index.${pos}`, 'utf8').split('\n');
export function parseSynset(line, pos = 'adj') {
  const [head, gloss] = line.split(' | ');
  const parts = head.trim().split(' ');
  const offset = parts[0], wordCount = parseInt(parts[3], 16);
  const words = []; let i = 4;
  for (let w = 0; w < wordCount; w++) { words.push(parts[i].replace(/\(.*\)$/, '').replaceAll('_', ' ')); i += 2; }
  const pointerCount = Number(parts[i]); i++;
  const pointers = [];
  for (let p = 0; p < pointerCount; p++) { pointers.push({ symbol: parts[i], offset: parts[i + 1], pos: parts[i + 2], source: parts[i + 3] }); i += 4; }
  const segments = gloss.trim().split('; "');
  const definition = segments[0].trim();
  // Keep only the quoted example itself; drop attributions such as "- Robert Burton".
  const examples = segments.slice(1).map(s => s.slice(0, s.indexOf('"') === -1 ? undefined : s.indexOf('"')).trim());
  return { offset, pos, type: parts[2], words, pointers, definition, examples, line };
}
export function synset(offset, pos = 'adj') {
  const line = load(pos).find(l => l.startsWith(`${offset} `));
  if (!line) throw new Error(`WordNet offset not found: ${pos}:${offset}`);
  return parseSynset(line, pos);
}
export function senses(word, pos = 'adj') {
  const line = index(pos).find(l => l.startsWith(`${word.replaceAll(' ', '_')} `));
  if (!line) return [];
  const parts = line.trim().split(' ');
  const synsetCount = Number(parts[2]);
  return parts.slice(-synsetCount).map(offset => synset(offset, pos));
}
// Direct antonyms, or the antonyms of the head synset for satellite adjectives.
export function antonyms(entry) {
  const own = entry.pointers.filter(p => p.symbol === '!').map(p => synset(p.offset, 'adj').words);
  if (own.length) return [...new Set(own.flat())];
  const heads = entry.pointers.filter(p => p.symbol === '&').map(p => synset(p.offset, 'adj'));
  return [...new Set(heads.flatMap(h => h.pointers.filter(p => p.symbol === '!').map(p => synset(p.offset, 'adj').words).flat()))];
}
