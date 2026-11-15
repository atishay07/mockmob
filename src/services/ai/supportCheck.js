// L1 (15 Nov 2026): a student in distress. Ask Mobi (signed in, POST /api/ai/mentor/chat) and guest Ask Mobi
// (POST /api/mobi/guest) run this check on the student's own words before any record answer, credit, question allowance
// or model call. A match gets SUPPORT_REPLY, fixed, free, from the server: no model ever writes the first reply to a
// student who may be at risk. The panel runs the same check so a student with no credits left still reaches it.
//
// PURE and dependency-free (the browser imports it too). No lookbehind in any pattern: older iPhone Safari cannot parse it.
// Tested phrase by phrase in data/tests/mobi_safety.test.mjs (English, Hindi in Devanagari, Hinglish).
//
// How it decides: STRONG patterns always match. AMBIGUOUS ones ("khatam kar lunga" is also "I will finish it") match only
// when the message names no study thing (chapter, syllabus, mock ...). Ordinary exam talk ("this chapter is killing me",
// "I'm dead tired", "death of a partner") matches nothing. When a phrase is unclear the check leans to the support reply:
// a kind reply to a joke costs nothing (owner, 15 Nov 2026).

export const SUPPORT_REPLY = "This sounds really hard, and I'm glad you told me. I'm a study helper, so I can't give you the support you deserve right now. Please talk to someone you trust today: a parent, a teacher or a friend. You can also call Tele-MANAS on 14416. It is free, open all day and night, and they speak your language. If you are in danger right now, call 112.";

// ------------------------------------------------------------------------------------------------ normalising
// Latin: lower case, apostrophes dropped ("can't" -> "cant", "I'm" -> "im"), every other mark a space. Devanagari: nukta
// dropped (ज़ -> ज, ड़ -> ड), chandrabindu read as anusvara (हूँ -> हूं), zero-width joiners removed.
// Idioms where "mar" means hit or cram, not die ("ratta marna hai", "chakka maarna"), are taken out first.
const IDIOM_MAR = /\b(ratta|ratte|rata|ratt|chakka|chhakka|chakke|chhakke|tukka|tukke|chauka|chauke|chouka|dhakka|jhaank|jhank|nazar|chhalang|sixer|bunk|gappe|gappa|mazak|mazaak|taana|taane|gol|goal) (mar|maar)[a-z]*/g;

function normalise(text) {
  return ` ${String(text ?? '')
    .normalize('NFD')
    .replace(/़/g, '')
    .replace(/ँ/g, 'ं')
    .normalize('NFC')
    .toLowerCase()
    .replace(/[​-‍⁠﻿]/g, '')
    .replace(/[।॥]/g, ' ')
    .replace(/['’‘`´]/g, '')
    .replace(/[^a-z0-9ऀ-ॿ]+/g, ' ')
    .replace(IDIOM_MAR, ' ')
    .replace(/\s+/g, ' ')
    .trim()} `;
}

// ------------------------------------------------------------------------------------------------ English
const PERSON = '(?:he|she|they|someone|somebody|my (?:step ?)?(?:father|dad|daddy|papa|mother|mom|mum|mummy|mama|maa|parents?|brother|sister|uncle|aunt|aunty|cousin|grandfather|grandpa|teacher|tutor|coach|boyfriend|neighbou?r)|(?:father|dad|papa|mother|mom|mummy|parents|uncle|teacher|tutor))';
const HURTS = '(?:hits?|hitting|beats?|beating|slaps?|slapping|hurts?|hurting|abuses?|abused|abusing|touch(?:es|ed|ing)?|molests?|molested|molesting|rapes?|raped|harass(?:es|ed|ing)?|threaten(?:s|ed|ing)?)';
const ADVERBS = '(?: (?:keeps|keep|kept|always|often|still|has been|have been|is|are|was|were|will|would|used to|tried to|tries to|sometimes|daily))*';

const ENGLISH = [
  /\bsu[i1]c[i1]d(?:e|es|al|ing)\b/,
  /\bsewer ?slide\b/,
  /\bunalive\b/,
  /\b(?:want to|wanna|gonna|going to|will|ill|should|just|gotta) kms\b/,
  // Review of 15 Nov 2026: plain phrases the first list missed. A kind reply to a light remark costs nothing.
  /^ ?kms ?$/,
  /\bend(?:ing)? it all\b/,
  /\b(?:feel|feels|felt|feeling) like dying\b/,
  /\b(?:dont|do not|didnt|did not) (?:want|wanna) to be here any ?more\b/,
  /\bwish i (?:could|would|can) (?:just )?die\b/,
  /\bwish i (?:was|were) dead\b/,
  /\bkil+(?:ing)? ?my ?self\b/,
  /\bend(?:ing)? (?:my|this) (?:own )?life\b/,
  /\bend it all\b/,
  /\bend everything\b/,
  /\btak(?:e|ing) my (?:own )?life\b/,
  /\b(?:want|wanna|wish|going|gonna|ready|deserve|need|plan|planning|thinking about|think about|thought about)(?: to)? die\b/,
  /\b(?:i|ill|i will|i would|id|i shall|i should|i might|i may|let me|rather|i deserve to) (?:just |rather )?die\b/,
  /\bwish i (?:was|were) dead\b/,
  /\bwish i (?:was|were|had) never (?:been )?born\b/,
  /\b(?:better off|rather be|want to be|wanna be) dead\b/,
  /\b(?:dont|do not) (?:want to|wanna) (?:live|be alive|exist|wake up)\b/,
  /\bno (?:point|reason|use) (?:in |of )?(?:living|to live|being alive|life)\b/,
  /\bnothing (?:left )?to live for\b/,
  /\blife (?:is|isnt|is not|aint) (?:not )?worth (?:it|living)\b/,
  /\bnot worth living\b/,
  /\b(?:tired|sick) of (?:living|life|being alive|existing)\b/,
  /\bhate (?:my life|being alive)\b/,
  /\bgive up on (?:life|living|everything)\b/,
  /\bcan ?(?:no)?t (?:go|carry) on\b(?! to\b)(?! with (?:the|this|that|my) (?:chapter|question|topic|syllabus|test|mock|paper|subject|book|revision)s?\b)/,
  /\bcan ?(?:no)?t (?:take|handle|bear) (?:it|this|this life|life|the pressure|this pressure) any ?more\b/,
  /\bcan ?(?:no)?t do this any ?more\b/,
  /\bcan ?(?:no)?t live (?:like this|any ?more|with myself)\b/,
  /\b(?:want|wanna|wish i could|wish to|going to|gonna)(?: to)? (?:disappear|vanish)\b/,
  /\bdisappear (?:forever|from (?:this|the) world)\b/,
  /\brun away from home\b/,
  /\bnever wake up\b/,
  /\bsleep forever\b/,
  /\bself ?harm(?:ing)?\b/,
  /\b(?:hurt|hurting|harm|harming|cut|cutting|burn|burning|starve|starving|punish|punishing|poison|poisoning|hang|hanging) my ?self\b/,
  /\b(?:slit|slitting|cut|cutting) (?:my )?wrists?\b/,
  /\b(?:overdose|overdosing)\b/,
  /\bsleeping pills\b/,
  /\b(?:swallow|swallowed|eat|ate|take|took) (?:all|a lot of|lots of|many|so many|a bunch of|a bottle of) (?:the |my )?(?:sleeping )?(?:pills|tablets)\b/,
  /\bdrink(?:ing)? poison\b/,
  /\bjump(?:ing)? (?:off|from|in front of) (?:the |a |my )?(?:roof|building|terrace|bridge|balcony|train|cliff|top floor)\b/,
  new RegExp(`\\b${PERSON}${ADVERBS} ${HURTS} me\\b`),
  /\b(?:i am|im|i was|i have been|ive been|i get|i got|i keep getting) (?:being )?(?:abused|beaten|beaten up|hit|molested|raped|harassed|assaulted|touched|bullied|hurt)\b/,
  /\bsexual(?:ly)? (?:abuse|abused|assault|assaulted|harass|harassed|harassment)\b/,
  /\b(?:abuse|violence|abusive) at home\b/,
  /\bdomestic violence\b/,
  /\b(?:raped|rape me|molest|molested|molesting|molestation)\b/,
  /\b(?:not safe|unsafe|scared|afraid|terrified) (?:at|to go|of going) home\b/,
  /\bi(?:m| am) (?:not safe|unsafe|in danger)\b/,
  /\bi (?:dont|do not) feel safe\b/,
  /\b(?:i am|im|i feel|feeling|i felt) (?:so |very |completely |totally |just )?(?:worthless|hopeless)\b(?! (?:at|in|with)\b)/,
  /\b(?:i am|im) a burden\b/,
  /\bburden (?:to|on) (?:everyone|everybody|my family|my parents)\b/,
  /\b(?:nobody|no one|noone) (?:would|will) (?:miss|care about|notice) me\b/,
  /\bbetter off without me\b/,
];

// ------------------------------------------------------------------------------------------------ Hinglish
const NAHI = '(?:nahi|nahin|nahee|nai|nhi|ni|na)';
const MAMA = '(?:papa|pappa|papaji|dad|daddy|pitaji|mummy|mumma|mom|maa|mammi|mummi|bhai|bhaiya|bhaiyya|didi|chacha|chachu|mama|mamu|uncle|tauji|teacher|sir|madam|sautela|sauteli|gharwale|ghar wale|parents|wo|woh|vo|voh)';
const HITS = '(?:maarte|marte|maarti|marti|maarta|marta|peette|peetti|peetta|pitte|pitti|pitta|pitai karte|pitaai karte|chhoote|chhute|chhuta|chhuti|chhoota|touch karte|touch karta|touch karti|gaali dete|torture karte)';

const HINGLISH = [
  /\bmarna (?:chahta|chahti|chahata|chaahta|chaahti|chahte|chahu|chahun|hai|h)\b/,
  /\bmar (?:jana|jaana) (?:chahta|chahti|chaahta|chaahti|hai|h)\b/,
  /\bmar (?:jaunga|jaungi|jaaunga|jaaungi|jaonga|jaongi|jaun|jaau|jau|jaaun|jaoon|jaon)\b/,
  /\bmarne (?:ka|ki|ke) (?:mann|man|mn|dil|soch|khayal|khyal|khayaal|iccha|ichha|icchha|ichchha|vichar)\b/,
  /\b(?:khud|khudh|apne ?aap|apne aap) ?ko (?:maar|mar|khatam|khatm|khtm|khatham|hurt|chot|nuksan|nuksaan|kaat|kat|jala|saza|sazaa)/,
  /\b(?:jeena|jina|jeenaa) (?:nahi|nahin|nahee|nai|nhi|ni)\b/,
  /\b(?:nahi|nahin|nai|nhi|ni) (?:jeena|jina|jeenaa)\b/,
  new RegExp(`\\bjee?ne (?:ka|ki|ke) (?:mann|man|mn|dil|iccha|ichha|icchha|ichchha) (?:bhi |ab |ab bilkul |bilkul )?${NAHI}\\b`),
  /\bjee?ne (?:ka|ki|ke) koi (?:matlab|fayda|faida|wajah|reason|point|maksad|maqsad)\b/,
  /\b(?:nahi|nahin|nai|nhi|ni) (?:jee|ji|jeena|jina) (?:sakta|sakti|skta|skti|sakte|paunga|paungi|paaunga|paaungi)\b/,
  /\b(?:zindagi|zindgi|jindagi|jindgi|zindagee) (?:khatam|khatm|khtm|se (?:tang|thak|pareshan|nafrat|bezaar|bezar))/,
  /\bsab (?:kuch )?(?:khatam|khatm|khtm) kar (?:dunga|dungi|du|dun|doon|lunga|lungi|lu|lun|loon)\b/,
  /\bkhudk(?:h)?u(?:s|sh)(?:i|ee)\b/,
  /\baa?tma?hath?ya\b/,
  // "jaan lena" is also "to find out", so only giving or taking a life in the first person.
  /\bjaan (?:de|le) (?:dunga|dungi|du|dun|doon|lunga|lungi|lu|lun|loon|dena|deni|denge)\b/,
  /\b(?:fansi|phansi|faansi|phaansi)\b/,
  /\b(?:zeher|zehar|jeher|jahar|zahar|zehr|jehar|zaher) (?:kha|khaa|pee|pi)/,
  /\b(?:nas|nase|naso|kalai|kalaai) (?:kaat|kat)/,
  /\b(?:chhat|chat|chhath|terrace|building|bridge|pul) (?:se )?(?:kood|kud)/,
  /\bkood (?:jaunga|jaungi|jaun|jaau|jau|jaaunga|jaaungi)\b/,
  /\bmaut (?:aa )?(?:jaye|jaaye|jae|aaye|aye|chahiye|chahta|chahti|maangta|mangta)\b/,
  /\bkaash (?:main |mai |me |mein )?marr?\b/,
  /\b(?:gayab|gaayab|ghayab) (?:ho )?(?:jaun|jaau|jaunga|jaungi|jaaunga|jaaungi|jana chahta|jana chahti|jaana chahta|jaana chahti|hona chahta|hona chahti)\b/,
  /\bghar (?:se|chhod ?ke|chod ?ke) (?:bhaag|bhag)/,
  new RegExp(`\\b${MAMA} (?:mujhe |muje |mjhe )?(?:roz |rozana |bahut |bohot |bhot |hamesha )?${HITS}\\b`),
  /\bmujhe (?:roz |bahut |hamesha )?(?:maarte|maarti|maarta|peette|peetti|peetta|pitte|pitti|pitta) (?:hai|hain|he|h)\b/,
  /\b(?:maar ?peet|maarpeet|marpit|mar ?pit|maarpit|pitai|pitaai|pitayi)\b/,
  /\b(?:galat|gande|ganda|bure|bura) (?:tarike|tareeke|tarah|tareke|jagah) (?:se )?(?:chhoo|chhu|chu|chuu|touch)/,
  /\b(?:chhed ?chhad|chhedchhad|chhedkhani|chedkhani|ched ?chad)\b/,
  /\b(?:shoshan|balatkar|balaatkar)\b/,
];

// ------------------------------------------------------------------------------------------------ Hindi (Devanagari)
// Substrings of the normalised text (nukta dropped, chandrabindu as anusvara), each with a leading space or the start.
const DEVANAGARI = [
  'आत्महत्या', 'खुदकुशी', 'खुदखुशी',
  'मरना चाहता', 'मरना चाहती', 'मरना है', 'मर जाना चाहता', 'मर जाना चाहती',
  'मर जाऊंगा', 'मर जाऊंगी', 'मर जाउंगा', 'मर जाउंगी', 'मर जाऊं', 'मर जाउं',
  'मरने का मन', 'मरने का दिल', 'मरने की इच्छा', 'मरने का ख्याल', 'मरने के ख्याल', 'मरने के विचार',
  'जीना नहीं', 'नहीं जीना', 'जीने का मन नहीं', 'जीने का दिल नहीं', 'जीने की इच्छा नहीं', 'जीने का कोई', 'नहीं जी सकता', 'नहीं जी सकती',
  'जिंदगी खत्म', 'जिन्दगी खत्म', 'जिंदगी से तंग', 'जिन्दगी से तंग', 'जिंदगी से थक', 'जिन्दगी से थक',
  'खुद को खत्म', 'खुद को मार', 'खुद को नुकसान', 'खुद को चोट', 'खुद को काट',
  'अपने आप को खत्म', 'अपने आप को मार', 'अपने आप को नुकसान', 'अपने आप को चोट',
  'सब खत्म कर', 'जान दे दूंगा', 'जान दे दूंगी', 'जान दे दूं', 'अपनी जान ले', 'जान देना चाहता', 'जान देना चाहती',
  'फांसी', 'फंदा लगा', 'जहर खा', 'जहर पी', 'नस काट', 'कलाई काट',
  'छत से कूद', 'कूद जाऊंगा', 'कूद जाऊंगी', 'कूद जाउंगा', 'कूद जाउंगी',
  'मौत आ जाए', 'मौत आ जाये', 'मौत चाहिए', 'मौत चाहता', 'मौत चाहती', 'काश मैं मर', 'काश में मर',
  'गायब हो जाना चाहता', 'गायब हो जाना चाहती', 'गायब हो जाऊं', 'गायब होना चाहता', 'गायब होना चाहती', 'घर से भाग',
  'मुझे मारते', 'मुझे मारती', 'मुझे मारता', 'मुझे पीटते', 'मुझे पीटती', 'मुझे पीटता', 'मारपीट', 'पिटाई',
  'शोषण', 'बलात्कार', 'छेडछाड', 'गलत तरीके से छू', 'गंदे तरीके से छू', 'गलत तरह से छू', 'गलत जगह छू',
  'अब और नहीं सह', 'और नहीं सह सकता', 'और नहीं सह सकती',
].map((phrase) => normalise(phrase).trim());

// ------------------------------------------------------------------------------------------------ ambiguous
// Also everyday study talk: "aaj chapter khatam kar lunga" is "I will finish the chapter today". These count only when the
// message names no study thing.
const AMBIGUOUS = [
  /\b(?:khatam|khatm|khtm|khatham) kar (?:lunga|lungi|lu|lun|loon|loonga|dunga|dungi|du|dun|doon)\b/,
  /\b(?:want to|wanna|going to|gonna|will|ill) end it\b/,
];
const AMBIGUOUS_DEVANAGARI = ['खत्म कर लूंगा', 'खत्म कर लूंगी', 'खत्म कर दूंगा', 'खत्म कर दूंगी', 'खत्म कर लूं'].map((p) => normalise(p).trim());
const STUDY = /\b(?:chapters?|syllabus|topics?|revision|revise|padhai|padhaai|homework|notes|books?|ncert|mocks?|tests?|papers?|questions?|sawaa?l|units?|portion|course|lessons?|exercises?|practice|accounts|accountancy|economics|eco|english|maths?|bst|business studies|subjects?|kaam|assignments?|series|exam)\b/;
const STUDY_DEVANAGARI = ['अध्याय', 'चैप्टर', 'सिलेबस', 'पढाई', 'किताब', 'टेस्ट', 'पेपर', 'प्रश्न', 'सवाल', 'रिवीजन', 'यूनिट', 'काम', 'होमवर्क', 'नोट्स', 'अभ्यास', 'परीक्षा'];

const hasPhrase = (text, phrases) => phrases.some((phrase) => text.includes(` ${phrase}`));

/** True when the student's words need SUPPORT_REPLY instead of a study answer. */
export function needsSupport(text) {
  if (typeof text !== 'string' || !text.trim()) return false;
  const t = normalise(text.slice(0, 4000));
  if (ENGLISH.some((re) => re.test(t)) || HINGLISH.some((re) => re.test(t)) || hasPhrase(t, DEVANAGARI)) return true;
  const unclear = AMBIGUOUS.some((re) => re.test(t)) || hasPhrase(t, AMBIGUOUS_DEVANAGARI);
  if (!unclear) return false;
  return !(STUDY.test(t) || STUDY_DEVANAGARI.some((word) => t.includes(word)));
}

// The same rule, written for the two system prompts (src/services/ai/systemPrompt.js, src/lib/server/guestMobi.js), for a
// message the check above did not catch.
export const SUPPORT_PROMPT_RULE = 'If the student sounds in distress or unsafe (self-harm, suicide, wanting to die or disappear, being hurt or abused, or feeling hopeless), do not steer back to CUET, the record or MockMob. Answer with care in two or three short sentences: say you are glad they told you, ask them to talk to someone they trust today (a parent, a teacher or a friend), and give Tele-MANAS on 14416 (free, open all day and night, in their language) and 112 if they are in danger right now. Never give methods or details of self-harm, never diagnose, never promise to keep a secret, never blame them.';
