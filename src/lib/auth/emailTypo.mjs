// O9 (15 Nov 2026): catch a mistyped email domain before a code is sent to an inbox that does not exist. Pure, no React.
//
// Only known slips of the big free mail services are caught (gmial.com, gmail.con, yahooo.com, hotmial.com, outlok.com and
// the like), each by an explicit list, never by a guess about an unknown domain: a school's or a family's own domain is
// never questioned. The card shows the suggestion as one line with "Use this" and "No, send it"; it never blocks.

// The service's name as typed (before the first dot) -> the real name. Slips one key or one letter away, as students type them.
const NAME_SLIPS = Object.freeze({
  gmail: ['gmial', 'gmal', 'gamil', 'gmai', 'gmaill', 'gmali', 'gmil', 'gnail', 'gmeil', 'gmsil', 'gmaik', 'gmaio', 'gmajl', 'gmqil', 'gmailm', 'gimail', 'gemail', 'gmaul', 'gmall', 'gamail', 'gmaiil', 'ggmail', 'gmmail'],
  yahoo: ['yahooo', 'yaho', 'yhoo', 'yahho', 'yaoo', 'yahooa', 'yaahoo', 'tahoo', 'uahoo'],
  hotmail: ['hotmial', 'hotmal', 'hotmil', 'hotmai', 'hotamil', 'hotmaill', 'homail', 'hotnail', 'hormail', 'htmail', 'hotmali'],
  outlook: ['outlok', 'outllok', 'outloo', 'otlook', 'outlookk', 'oulook', 'outlool', 'outook', 'putlook', 'outlokk'],
  icloud: ['iclod', 'icoud', 'iclould', 'icluod', 'icload', 'iclud'],
  rediffmail: ['rediffmial', 'redifmail', 'rediffmal', 'rediffmai', 'rediffmil', 'reddifmail'],
});
const REAL_NAME = new Map(Object.entries(NAME_SLIPS).flatMap(([real, slips]) => slips.map((slip) => [slip, real])));

// The ending as typed -> ".com", for the services above only (gmail.cm is a slip; some other name.cm is a real domain).
// Not "co": for yahoo or hotmail it may be the start of co.in or co.uk (gmail.co is caught below, gmail has one ending).
const COM_SLIPS = new Set(['con', 'cm', 'om', 'comm', 'coom', 'cpm', 'vom', 'xom', 'cim', 'ocm', 'cmo', 'c0m', 'comn', 'cok', 'col', 'cmm', 'como', 'ccom']);

// The real endings each service uses; anything here is never questioned (yahoo.co.in, hotmail.co.uk, outlook.in are real).
const REAL_ENDINGS = Object.freeze({
  gmail: ['com'],
  yahoo: ['com', 'in', 'co.in', 'co.uk', 'ca', 'fr', 'de', 'com.au', 'com.sg'],
  hotmail: ['com', 'co.uk', 'fr', 'de', 'it', 'es', 'in'],
  outlook: ['com', 'in', 'co.uk', 'fr', 'de', 'es', 'it'],
  icloud: ['com'],
  rediffmail: ['com'],
});

function fixedEnding(real, ending) {
  const allowed = REAL_ENDINGS[real];
  if (allowed.includes(ending)) return ending;
  // gmail, icloud and rediffmail live only at .com, so any other ending (gmail.co, gmail.in, gmail.com.) means .com.
  if (allowed.length === 1) return 'com';
  if (!ending || COM_SLIPS.has(ending)) return 'com';
  return null; // an ending this service might really use (yahoo.co could be yahoo.co.in): say nothing
}

/**
 * The address the student probably meant, or null when the typed one looks right (or is not one we know how to fix).
 * The part before @ is kept exactly as typed; only the domain is corrected, in lower case.
 */
export function suggestEmail(typed) {
  const s = String(typed || '').trim();
  const at = s.lastIndexOf('@');
  if (at < 1 || at === s.length - 1) return null;
  const local = s.slice(0, at);
  const domain = s.slice(at + 1).toLowerCase();
  if (/\s|@/.test(domain)) return null;
  const dot = domain.indexOf('.');
  const name = dot < 0 ? domain : domain.slice(0, dot);
  const ending = dot < 0 ? '' : domain.slice(dot + 1).replace(/\.+$/, '');
  const real = REAL_NAME.get(name) || (REAL_ENDINGS[name] ? name : null);
  if (!real) return null;
  const end = fixedEnding(real, ending);
  if (!end) return null;
  const suggestion = `${real}.${end}`;
  return suggestion === domain ? null : `${local}@${suggestion}`;
}

export const TYPO_COPY = Object.freeze({
  line: (suggestion) => `Did you mean ${suggestion}?`,
  use: 'Use this',
  keep: 'No, send it',
});
