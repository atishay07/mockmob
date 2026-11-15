// S3 (security audit 15 Nov 2026): terms the Mob name filter adds to data/mob_name_blocklist.json. The JSON list was
// Latin only, so the common Hindi profanities written in Devanagari passed, and a few Latin spellings were missing
// ("Lavde"). Server side only (service.js merges this into the JSON list), so the words never ship to a browser.
// Matching rules are nameBlocked's (src/lib/mob/model.mjs): 'contains' anywhere in the name, 'words' only as a whole
// word, both after normalising the name the same way.
export const EXTRA_NAME_TERMS = Object.freeze({
  contains: [
    // Devanagari, matched after the nukta is dropped and candrabindu read as anusvara (so ड़ is ड, ँ is ं).
    'चूतिया', 'चुतिया', 'चूतिये', 'चुतिये', 'भोसडी', 'भोसडा', 'भोसडे', 'मादरचोद', 'मादरजात', 'बहनचोद', 'बहेनचोद', 'बेहनचोद', 'भेनचोद', 'भैनचोद',
    'बेटीचोद', 'बकचोद', 'हरामी', 'हरामजादा', 'हरामजादी', 'हरामखोर', 'कमीना', 'कमीने', 'कमीनी', 'भडवा', 'भडवे', 'झाट', 'झांट', 'गांडू', 'गाण्डू',
    'लौडा', 'लौडे', 'लवडा', 'लवडे', 'रंडी', 'रण्डी', 'छिनाल', 'चुदाई',
    // Latin transliterations the JSON list does not cover.
    'chutiy', 'chutye', 'bhosdike', 'bhosda', 'bhosri', 'madarjat', 'madarjaat', 'haramzad', 'haramkhor', 'behnchod', 'bahenchod',
    'bahanchod', 'betichod', 'bakchod', 'lavde', 'lawde', 'lawda', 'bhadwe', 'bhadve', 'chinaal', 'chhinal', 'jhaant', 'jhantu', 'randwa',
    'shitty', 'shithead', 'bullshit',
  ],
  words: [
    'चूत', 'गांड', 'लंड', 'लण्ड', 'चोद', 'चोदू', 'कुत्ता', 'कुत्ती', 'कुतिया', 'कुत्ते', 'सूअर', 'सुअर', 'टट्टी', 'रांड', 'लोडा',
    'chut', 'choot', 'gaand', 'gand', 'loda', 'lodu', 'laude', 'lavdu', 'chod', 'kamine', 'kaminey', 'kutte', 'kuttey', 'kutiya', 'kuttiya',
    'suwar', 'raand', 'shit', 'shits',
  ],
});

// In the JSON list's 'contains', but they sit inside real names (Shital, Kshitij), so they are matched as whole words.
export const WORD_ONLY = Object.freeze(['shit']);

/** The JSON list plus EXTRA_NAME_TERMS, with WORD_ONLY moved to 'words'. Pure. */
export function mobNameBlocklist(base = {}) {
  const contains = (Array.isArray(base.contains) ? base.contains : []).filter((t) => !WORD_ONLY.includes(t));
  const words = Array.isArray(base.words) ? base.words : [];
  return {
    contains: [...new Set([...contains, ...EXTRA_NAME_TERMS.contains])],
    words: [...new Set([...words, ...WORD_ONLY, ...EXTRA_NAME_TERMS.words])],
  };
}
