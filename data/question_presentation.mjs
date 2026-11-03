const squash = t => String(t || '').normalize('NFKC').replace(/[­​]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();

// Shared by authoring, validation and serving. This must stay browser-safe.
export function presentationLint(q) {
  const issues = [], body = String(q.body || q.question || ''), options = (q.options || []).map(o => String(typeof o === 'string' ? o : o?.text || ''));
  if (/<\/?[a-z][^>]*>/i.test(body + options.join(' '))) issues.push('html');
  // Underscore runs used as exam blanks are plain text; paired emphasis still fails.
  const markupBody = body.replace(/(?<![\p{L}\p{N}_])_{2,}(?![\p{L}\p{N}_])/gu, 'blank');
  if (/\*\*|__|^\s*#|\|\s*-{3}/m.test(markupBody)) issues.push('markdown');
  const passage = String(q.passage_text || q.passage || '').trim();
  // Official CUET UG 2026 English syllabus: maximum 300 words. Commerce cases have no such rule.
  if (q.subject === 'english' && passage && passage.split(/\s+/u).length > 300) issues.push('english_passage_word_limit');
  if (q.provenance?.kind !== 'authentic_pyq' && options.some(o => /\b(all|none) of the (above|these)\b/i.test(o))) issues.push('all_none_of_above');
  if (/according to (the|this) (chapter|text|textbook|lesson)|as (discussed|given) in the (chapter|text)|explicitly listed|as listed in|listed under/i.test(body)) issues.push('unseen_reference');
  // Undefined hybrids cannot serve as meaningful economic propositions, even
  // when they were transcribed faithfully from an authenticated paper.
  if (/\bex[ -]+(?:ante[ -]+post|post[ -]+ante)\b/i.test(body + ' ' + options.join(' '))) issues.push('undefined_economic_term');
  if (new Set(options.map(squash)).size !== options.length || options.some(o => !o.trim())) issues.push('option_collision');
  if (options.some(o => /^\s*(\([A-D1-4]\)|[A-D][.)])\s+(?!and\s|or\s|[-–—:])\S/.test(o))) issues.push('option_label_prefix');
  if (['synonym', 'antonym'].includes(q.question_type) && !/\bphrase\b/i.test(body) && options.some(o => o.trim().split(/\s+/).length > 3)) issues.push('vocabulary_options_not_words');
  const maps = options.map(o => [...o.matchAll(/\(([A-D])\)\s*[-–—:]\s*\(?(IV|I{1,3})\)?(?![IV])/g)].map(m => [m[1], m[2]]));
  if (maps.every(m => m.length >= 3)) {
    const size = maps[0].length;
    const valid = maps.every(m => m.length === size && new Set(m.map(x => x[0])).size === size && new Set(m.map(x => x[1])).size === size);
    if (!valid || new Set(maps.map(m => m.map(x => x.join(':')).sort().join())).size !== 4) issues.push('matching_options_not_distinct_bijections');
  }
  return issues;
}

// Restore only unambiguous interleaved OCR lists, without editing stored content/key/evidence.
export function formatQuestionText(value) {
  const text = String(value || '');
  const start = text.match(/List-I\s+List-II\s*(\([^()]+\))?\s*(\([^()]+\))?\s*(?=\(A\))/);
  if (start) {
    const from = start.index + start[0].length;
    const tail = text.slice(from), end = tail.search(/Choose the correct answer/i);
    if (end >= 0) {
      const entries = tail.slice(0, end), markers = [...entries.matchAll(/\((IV|III|II|I|[A-D])\)\s*/g)];
      const letters = markers.filter(m => /^[A-D]$/.test(m[1])), romans = markers.filter(m => /^[IV]+$/.test(m[1]));
      if ([3, 4].includes(letters.length) && letters.length === romans.length && new Set(letters.map(m => m[1])).size === letters.length && new Set(romans.map(m => m[1])).size === romans.length && markers.every((m, i) => i % 2 === 0 ? /^[A-D]$/.test(m[1]) : /^[IV]+$/.test(m[1]))) {
        const rows = markers.map((m, i) => ({ label: m[1], text: entries.slice(m.index + m[0].length, markers[i + 1]?.index ?? entries.length).trim() }));
        if (rows.every(r => r.text)) {
          const list = pattern => rows.filter(r => pattern.test(r.label)).map(r => `(${r.label}) ${r.text}`).join('\n');
          return `${text.slice(0, start.index).trim()}\n\nList-I ${start[1] || ''}\n${list(/^[A-D]$/)}\n\nList-II ${start[2] || ''}\n${list(/^[IV]+$/)}\n\n${tail.slice(end)}`;
        }
      }
    }
  }
  if (!text.includes('\n') && [...text.matchAll(/\([A-D]\)\s+/g)].length >= 3) return text.replace(/\s+(?=\([A-D]\)\s+)/g, '\n').replace(/\s+(?=Choose the correct answer)/i, '\n');
  return text;
}
