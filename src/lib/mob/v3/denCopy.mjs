// The web den's words (MOB-BUILD-SPEC-V3 section 5.3, D0 to D6, D0a, J1, SET, P1 to P5, C1, C2, S1, K1 to K5). Every
// sentence is the app's own (flutter_app/lib/features/social/v3/copy_v3.dart), so the website and the app say the same
// thing: plain, warm and grammatical, no exclamation marks, no arrows, no emoji, the 12-hour clock in IST, no price, no
// one's plan, and never "lost", "behind", "last", "waiting on you", "hurry" or "streak at risk" (spec 5.0). Pure: no I/O.
// data/tests/mob_v3_den_web.test.mjs holds the lint (C-1 to C-4) over this file and the den components.

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const IST_MS = 330 * 60_000;

const toMs = (at) => (at instanceof Date ? at.getTime() : typeof at === 'number' ? at : Date.parse(at));
/** The IST wall clock of `at` as a UTC Date (read it with getUTC*). Null for a value that is not a time. */
function ist(at) {
  const ms = toMs(at);
  return Number.isFinite(ms) ? new Date(ms + IST_MS) : null;
}

// ---- Time, always IST, 12-hour ----
export const MobTime = Object.freeze({
  /** "2:05 PM". */
  clock(at) {
    const t = ist(at);
    if (!t) return '';
    const h = t.getUTCHours();
    return `${h % 12 === 0 ? 12 : h % 12}:${String(t.getUTCMinutes()).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
  },
  /** "Wednesday 28 Oct". */
  day(at) {
    const t = ist(at);
    return t ? `${WEEKDAYS[t.getUTCDay()]} ${t.getUTCDate()} ${MONTHS[t.getUTCMonth()]}` : '';
  },
  /** "Monday" for the IST day of `at`. */
  weekdayOf(at) {
    const t = ist(at);
    return t ? WEEKDAYS[t.getUTCDay()] : '';
  },
  /** "Wednesday" from an IST day key YYYY-MM-DD. */
  weekdayOfKey(key) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(key || ''));
    if (!m) return 'That day';
    return WEEKDAYS[new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])).getUTCDay()];
  },
  monthName: (month) => MONTHS_LONG[Math.min(11, Math.max(0, month - 1))],
  /** "2:05 PM tomorrow", "8:44 PM" (today), "2:05 PM yesterday", else "2:05 PM on Saturday 24 Oct". */
  when(at, now) {
    const a = ist(at);
    const n = ist(now);
    if (!a || !n) return '';
    const da = Date.UTC(a.getUTCFullYear(), a.getUTCMonth(), a.getUTCDate());
    const dn = Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate());
    const diff = Math.round((da - dn) / 86_400_000);
    const c = MobTime.clock(at);
    if (diff === 0) return c;
    if (diff === 1) return `${c} tomorrow`;
    if (diff === -1) return `${c} yesterday`;
    return `${c} on ${MobTime.day(at)}`;
  },
});

// ---- Helpers ----
export function joinNames(names) {
  const list = (names || []).filter(Boolean);
  if (list.length <= 1) return list[0] || '';
  if (list.length === 2) return `${list[0]} and ${list[1]}`;
  return `${list.slice(0, -1).join(', ')} and ${list[list.length - 1]}`;
}
const aAn = (word) => (/^[AEIOUaeiou]/.test(word || '') ? 'An' : 'A');
const NUMBER_WORDS = { 2: 'two', 3: 'three', 4: 'four', 5: 'five' };

// ---- Folds ----
export const FOLD_NAMES = Object.freeze({
  dart: 'Dart', dogear: 'Dog-ear', hexa: 'Hexa', kandil: 'Kandil', hop: 'Hop', crane: 'Crane',
  stamp: 'Stamp', naav: 'Naav', tally: 'Tally', patang: 'Patang', sticky: 'Sticky', cutting: 'Cutting',
});
export const FOLD_LINES = Object.freeze({
  dart: 'Answers first, then learns to check.',
  dogear: 'Learning to trust the first pick.',
  hexa: 'Builds each answer step by step.',
  kandil: 'Keeps the desk lit for everyone.',
  hop: 'Bounces back after a wrong one.',
  crane: 'Folds it until it is right.',
  stamp: 'Seals every fix that held.',
  naav: 'Steady in the last ten minutes.',
  tally: 'Counts the minus marks too.',
  patang: 'Rises against the wind.',
  sticky: 'Remembers the formula for you.',
  cutting: 'Knows a break is part of the plan.',
});
export const FOLD_RULES = Object.freeze({
  dart: 'Free to everyone.', dogear: 'Free to everyone.', hexa: 'Free to everyone.', kandil: 'Free to everyone.',
  hop: 'Your Mob finishes its first weekly quest.',
  crane: 'Your Mob fixes 3 traps together.',
  stamp: "Your Mob's chain reaches 4 weeks in a row.",
  naav: 'Finish your first full-length mock.',
  tally: 'Finish 3 Mob games with no minus marks.',
  patang: "Beat your own best score in a subject's full mock.",
  sticky: '5 fixes that held.',
  cutting: 'Come back after 3 or more days away.',
});
export const foldName = (key) => FOLD_NAMES[key] || 'Your Fold';
export const ITEM_NAMES = Object.freeze({
  den_stamp: 'Den stamp', desk_bell: 'A desk bell', brass_lamp: 'Brass lamp', foil_seal: 'Foil seal',
  stamp_row_2: 'A second den stamp row', den_stamp_row: 'A second den stamp row', stamp: 'Stamp',
});
export const itemName = (item) => ITEM_NAMES[item] || 'A new piece';
const articled = (phrase) => (/^An? /.test(phrase) ? phrase : `${aAn(phrase)} ${phrase.toLowerCase()}`);
export const creaseLabel = (folds) => (folds === 1 ? 'A starter Fold' : folds === 2 ? 'Earned by you' : 'Earned with your Mob');

// ---- Stickers (an 8-value enum: no free text between users, spec 6.1) ----
export const STICKERS = Object.freeze({
  nice_one: 'Nice one', so_close: 'So close', teach_me: 'Teach me', again: 'Again?',
  good_luck: 'Good luck', lets_go: "Let's go", one_sec: 'One sec', ready: 'Ready',
});
export const DEN_STICKERS = Object.freeze(['nice_one', 'so_close', 'teach_me', 'again']);

// ---- The den words ----
export const DenCopy = Object.freeze({
  title: 'Your Mob',
  d0Lead: 'Sit papers and play quick games with up to 4 friends. Your friends see your marks in games, never your answers.',
  startMob: 'Start a Mob',
  joinWithCode: 'Join with a code',
  noSubjects: 'Choose your CUET subjects first. A Mob plays in one of them.',
  chooseSubjects: 'Choose your subjects',
  openSeat: 'Open seat',
  you: 'You',
  denPreviewLabel: 'Your den, with four seats waiting for friends.',
  denSubtitle: (subject, size) => (size <= 1 ? `${subject}, just you` : `${subject}, ${size} of you`),
  chainChip: (days) => (days === 1 ? '1 day' : `${days} days`),
  chainChipLabel: (days) => `Your chain, ${days === 1 ? '1 day' : `${days} days`} in a row. Opens your chain.`,
  pennantWord: (w) => (w === 1 ? 'week' : 'weeks'),
  pennantLabel: (w) => `${w === 1 ? '1 week' : `${w} weeks`} in a row. Opens your Mob's chain.`,
  shelfLabel(mob, items, next) {
    const have = items.length ? `${joinNames(items.map(itemName))}.` : 'Nothing on it yet.';
    const coming = next ? ` Next: ${itemName(next.item).toLowerCase()} at ${next.at} weeks.` : '';
    return `${mob}'s shelf. ${have}${coming} Opens your shelf.`;
  },
  settings: 'Mob settings',
  switchMob: 'Switch to another Mob',

  quietTitle: 'Nothing is open right now',
  quietLine: "Start a 5-question sprint for your Mob, or sit this week's Mob paper.",
  startAGame: 'Start a game',
  sitPaper: "Sit this week's paper",
  seeAnswers: 'See your answers',
  askTitle: 'Ask your Mob for a game',
  askKey: 'Send "Again?"',
  askLine: 'Anyone with a start left can open one.',

  gameKind: (format) => (format === 'round' ? 'round' : format === 'rematch' ? 'rematch' : 'sprint'),
  gameTitle(g) {
    const kind = DenCopy.gameKind(g.format);
    return !g.host || g.host.you || g.host.memberId === g.youId ? `Your ${kind}` : `${g.host.name}'s ${kind}`;
  },
  openedA(g) {
    const who = !g.host || g.host.you || g.host.memberId === g.youId ? 'You' : g.host.name;
    return `${who} opened ${g.format === 'rematch' ? 'a rematch' : `a ${DenCopy.gameKind(g.format)}`}`;
  },
  openLine(g, now) {
    const what = g.chapter ? `${g.count} ${g.chapter} questions` : `${g.count} ${g.subjectName} questions`;
    const race = (g.runs || []).length ? 'Race the runs so far.' : 'Be the first to set a run.';
    const until = g.closesAt ? ` Open until ${MobTime.when(g.closesAt, now)}.` : '';
    return `${what}. ${race}${until}`;
  },
  /** Finished runs only, names and times (F2). Null with none. */
  runsSoFar(runs, now) {
    if (!runs || !runs.length) return null;
    return `Runs so far: ${runs.map((r) => (r.at ? `${r.name}, ${MobTime.when(r.at, now)}.` : `${r.name}.`)).join(' ')}`;
  },
  playKey(g) {
    const kind = DenCopy.gameKind(g.format);
    return !g.host || g.host.you || g.host.memberId === g.youId ? `Play your ${kind}` : `Play ${g.host.name}'s ${kind}`;
  },
  moreWays: 'More ways to play',
  moreOpen: (n) => (n === 1 ? '1 more game is open' : `${n} more games are open`),
  playedAt: (at, closes, now) => `You played at ${MobTime.when(at, now)}. Places can change until ${MobTime.when(closes, now)}.`,
  playedClosed: (at, now) => `You played at ${MobTime.when(at, now)}. This game has closed, and its answers are open now.`,
  seePodiumSoFar: 'See the podium so far',
  seePodium: 'See the podium',
  liveOpened: (g) => `${g.host?.name || 'A friend'} opened a live room`,
  liveLine: (g) => `A sprint with ${g.count} new ${g.chapter || g.subjectName} questions.`,
  joinRoom: (g) => (g.host?.name ? `Join ${g.host.name}'s room` : 'Join the room'),
  playLater: (closes, now) => `Play it later, until ${MobTime.when(closes, now)}`,
  roomStarted: (started, closes, now) => `The room started at ${MobTime.clock(started)}. You can still play it until ${MobTime.when(closes, now)}.`,
  playItNow: 'Play it now',

  // D5 a Mob of one
  oneTitle: 'Save a seat for a friend',
  oneLine: 'A Mob is 2 to 5 friends. Send the card; they tap it and take a seat.',
  seatsOpen: (n) => (n === 1 ? '1 open seat' : `${n} open seats`),
  inviteCardTitle: (you, mob) => `${you} saved you a seat in ${mob}`,
  inviteCardLine: (subject, display) => `${aAn(subject)} ${subject} Mob on MockMob. Code ${display}.`,
  inviteCardLineNoCode: (subject) => `${aAn(subject)} ${subject} Mob on MockMob.`,
  inviteWhatsApp: 'Invite on WhatsApp',
  copyCode: 'Copy the code',
  codeCopied: 'The code is copied.',
  inviteWorks: 'Works for 7 days, for up to 4 friends.',
  invitesPaused: 'New invites are paused for now. Your Mob works as before.',
  onePaper: "This week's Mob paper. 10 questions, 10 minutes. Sit it now; friends who join can too.",
  sitIt: 'Sit it',
  startSprint: 'Start a sprint',
  inviteShare: (you, mob, subject, display, url) => `${you} saved you a seat in ${mob}, ${aAn(subject).toLowerCase()} ${subject} Mob on MockMob. Tap to join: ${url} (code ${display})`,
  makingCode: 'Making your code',

  // D6
  loading: 'Loading your Mob',
  failed: "Your Mob didn't load.",
  tryAgain: 'Try again',

  // Quest strip
  questTitle: "This week's quest",
  questCount: (q) => (q.answered > q.target ? `${q.answered} answered. The quest needed ${q.target}.` : `${q.answered} of ${q.target} questions`),
  passNotice: (weekday, days) => `${weekday} was covered by a rest pass. Your chain is still ${days}.`,
  stickerSent: 'Sent to your Mob.',
  stickerLabel: (kind) => `Send the sticker ${STICKERS[kind] || ''}`,
  reactionLine: (name, kind) => `${name}: ${STICKERS[kind] || ''}`,

  // D0a Start a Mob
  pickName: "Pick your Mob's name",
  showSixMore: 'Show six more',
  showFirstSix: 'Back to the first six',
  namesKind: 'Names come from our list, so every Mob name is kind.',
  subjectYouPlay: 'Subject you will play',
  pickFold: 'Pick your Fold',
  youPlayAs: (fold) => `You play as ${fold}`,
  change: 'Change',
  nameLabel: 'Your name in the Mob',
  nameHint: 'First name',
  nameNote: 'Only your Mob sees it. 2 to 18 letters.',
  nameRule: 'Use 2 to 18 letters. Spaces, dots, apostrophes and hyphens are fine.',
  colourLabel: 'Colour',
  marksNote: 'Your Mob sees your marks in games. One switch in Mob settings keeps them private.',
  startKey: (name) => `Start ${name}`,
  startNext: 'Next, you can invite up to 4 friends.',
  starting: 'Starting your Mob',

  // J1 Join
  joinTitle: 'Join a Mob',
  joinLine: 'Type the 6-character code your friend sent.',
  joinCodeLabel: 'Mob code',
  joinChecking: 'Checking the code',
  joinPreviewName: (p) => `${p.name || p.subjectName}, ${p.subjectName}`,
  seatsTaken: (taken) => `${taken} of 5 seats taken`,
  pickWho: "Pick who you'll be",
  joinYourName: 'Your name in this Mob',
  joinPrivacy: 'MockMob never asks for your contacts. Only your Mob sees your name. You can leave any time.',
  joinKey: (name) => `Join ${name}`,
  joining: 'Joining',
  joinPaused: 'New members cannot join by code just now. Try this code again later.',
  joinCodeInvalid: 'That code does not look right. Check it with your friend.',
  joinCodeExpired: 'That code has expired. Ask your friend for a new one.',
  joinStartOwn: 'Start your own Mob',

  // P1 Play picker
  pickerTitle: 'Play with your Mob',
  openNow: 'Open now',
  openRow: (g, now) => `${g.count} questions. Open until ${g.closesAt ? MobTime.when(g.closesAt, now) : 'tomorrow'}.`,
  play: 'Play',
  podiumKey: 'Podium',
  weeklyPaper: "This week's Mob paper",
  satLine: (at) => (at ? `You sat it on ${MobTime.weekdayOf(at)}.` : 'You sat it this week.'),
  answers: 'Answers',
  paperClock: '10 questions, 10 minutes.',
  startsLeft: (mob, n) => (n === 1 ? `You have 1 start in ${mob} this week.` : `You have ${n} starts in ${mob} this week.`),
  startUsed: 'Your start this week is used. It comes back on Monday.',
  anyoneWithPro: 'Anyone in your Mob with Pro can start one, then everyone plays it free.',
  micPassed: (from) => `${from} passed you the mic. You can start one game, live or anytime.`,
  anyoneCanStart: 'Anyone in your Mob can start a game.',
  askForGame: 'Ask your Mob for a game',
  whatProAdds: 'What Pro adds',
  sprint: 'Sprint',
  sprintSub: '5 questions',
  ownRound: 'Your own round',
  ownRoundSub: '10 to 20 questions',
  ownRoundSubStart: '10, 15 or 20 questions',
  live: 'Live',
  liveSub: 'Everyone at once',
  fullMock: 'Full mock',
  fullMockSub: '50 questions in 60 minutes',
  proTag: 'Pro',
  lockedWord: 'Locked',

  // P2 Start a game
  startSub: (mob, subject) => `${mob}, ${subject}`,
  whatItCovers: 'What it covers',
  coversTrap: (chapter) => `${chapter}, the chapter of your Mob's last trap`,
  coversWhole: (subject) => `The whole of ${subject}`,
  coversChapter: (chapter) => chapter,
  useWholeSubject: 'Use the whole subject',
  chapterLabel: 'Chapter',
  howMobPlays: 'How your Mob plays it',
  liveNow: 'Live now',
  anytime24: 'Anytime in 24 hours',
  liveLineStart: 'Live starts everyone on one 3, 2, 1. Anyone who misses it gets the same questions for 24 hours.',
  asyncLineStart: 'Everyone gets the same questions for 24 hours and races the runs before them.',
  liveHours: 'Live rooms open from 6:00 AM to 11:00 PM.',
  passMicRow: (left) => `Let a friend start one game. ${left} left this week.`,
  passMic: 'Pass the mic',
  openRoom: 'Open the room',
  startTheSprint: 'Start the sprint',
  startTheRound: 'Start the round',
  startUnder: (mob) => `Everyone in ${mob} plays it free. Marks count the same for all.`,
  lengthLabel: (n) => `${n} questions`,
  fewerQuestions: 'Fewer questions',
  moreQuestions: 'More questions',
  startingGame: 'Starting',

  // P3 Pass the mic
  micLine: (mob) => `Let a friend start one game in ${mob} this week.`,
  micKey: (name) => `Pass the mic to ${name}`,
  micPick: 'Choose a friend',
  micNote: 'You can pass it 2 times a week.',
  micToast: (name) => `${name} can start one game this week.`,

  // P4 Free and Pro
  freeProTitle: 'Free and Pro in the Mob',
  proLead: 'Pro never changes marks, chains or what you can earn. It adds hosting.',
  freeAlways: 'Free, always',
  freeList: [
    'Play every game your Mob starts, as often as you like.',
    'The weekly Mob paper, in every Mob you are in.',
    'One start a week in each Mob.',
    'Your chain, rest passes and make-up days.',
    'The podium, your marks and Fix it together.',
    'Every Fold and sticker you earn.',
  ],
  proAdds: 'Pro adds',
  proList: [
    'Start as many games as you like, live or anytime.',
    'Open live rooms.',
    'Pass the mic to a friend, twice a week.',
    'Start up to 3 Mobs.',
  ],
  notForSale: 'Nothing you earn in the Mob is for sale.',
  seePlans: 'See Pro plans',

  // SET
  settingsTitle: 'Mob settings',
  showPodium: 'Show a podium',
  showPodiumNote: "Games show places by marks. Off: everyone's marks, with no places.",
  podiumNotOwner: (mob, on, owner) => `${mob} ${on ? 'shows' : 'does not show'} a podium. ${owner} can change this.`,
  mobName: 'Mob name',
  namePicked: 'The Mob name is changed.',
  restingWeek: 'Resting this week',
  restingNote: 'The quest gets smaller without your name.',
  shareMarks: 'Share my marks in games',
  shareMarksNote: 'Off: your Fold stands on the podium with "Private" instead of marks, and you get no place. Your answers stay out of the Mob\'s total and nobody races your run as a ghost.',
  yourFold: 'Your Fold',

  // C1 Chain, You
  chainsTitle: 'Chains',
  chainLoading: 'Loading your chain',
  chainFailed: "Your chain didn't load.",
  tabYou: 'You',
  daysInARow: (n) => (n === 1 ? 'day in a row' : 'days in a row'),
  chainBreakdown(c) {
    const parts = [`${c.practised} practised`];
    if (c.rested > 0) parts.push(`${c.rested} rested`);
    if (c.madeUp > 0) parts.push(`${c.madeUp} made up`);
    const best = c.days >= c.best ? 'Your best run.' : `Your best is ${c.best} days.`;
    return `${joinNames(parts)}. ${best}`;
  },
  todayProgress: (a, n) => `${a} of ${n}`,
  answerMore: (left) => (left === 1 ? 'Answer 1 more question today to count it.' : `Answer ${left} more questions today to count it.`),
  passesHeld: (held, max) => (held >= max ? `${held} rest passes, the most you can hold` : held === 1 ? '1 rest pass' : `${held} rest passes`),
  passesRule: 'Miss a day and one is used for you. You earn one every 7 days, and one for every 3 fixes that hold.',
  makeUpOpen: (weekday, needed) => `${weekday} was missed and no pass was left. Answer ${needed} questions today or tomorrow and ${weekday} counts.`,
  makeUpProgress: (answered, needed) => `You have answered ${answered} of ${needed} today.`,
  makeUpOnce: 'A make-up can be used once every 14 days.',
  newChain: (best) => `A new chain starts today. Your best is ${best} days.`,
  calendarCaption: 'Moon: a rest pass kept the chain.',
  milestone: (m) => (m.reward === 'rest_pass' ? `Rest pass at ${m.at}` : m.reward === 'foil' ? `Foil edge at ${m.at}` : m.reward === 'ribbon' ? `A ribbon at ${m.at}` : `${m.at} days`),
  moreDays: (n) => (n === 1 ? '1 more day' : `${n} more days`),
  examPause: 'Exam pause days',
  hideChain: 'Hide my chain',
  hiddenLine: 'Your chain is hidden. It still counts, and nobody else ever sees it.',
  showChain: 'Show my chain',
  dayInitials: ['M', 'T', 'W', 'T', 'F', 'S', 'S'],
  dayState: (s) => ({ practised: 'practised', rested: 'rested', made_up: 'made up', paused: 'set aside for exams', open: 'open', today: 'today' }[s] || 'not practised'),

  // C2 Chain, Mob
  weeksInARow: (n) => (n === 1 ? 'week in a row' : 'weeks in a row'),
  mobChainLine: (mob) => `A week is stitched each time ${mob} finishes the weekly quest. Nobody can break it alone.`,
  bestRun: (w) => (w === 1 ? 'Best run: 1 week' : `Best run: ${w} weeks`),
  questEnds: 'Ends Sunday 11:59 PM',
  questGoal: (target) => `Answer ${target} questions together in Mob games and papers.`,
  questAnswered: (a, t) => (a > t ? `${a} answered. The quest needed ${t}.` : `${a} of ${t} answered`),
  whatFilled: 'What filled it',
  parcelHolds(p, mob) {
    if (!p || p.kind === 'stitch') return "This week's stitch. Finish the quest and the pennant gets one more week.";
    if (p.kind === 'fold') { const n = foldName(p.fold || 'hop'); return `${n} is folded in this week's parcel. Finish the quest and everyone in ${mob} gets ${n}.`; }
    return `This week's parcel holds ${itemName(p.item).toLowerCase()}. Finish the quest and it goes on ${mob}'s shelf.`;
  },
  howItCounts: 'How it counts',
  countsLine: (sizedFor, each) => `Every question answered in a Mob game or paper counts, right or wrong. Sized for ${sizedFor} of you: ${each} each. Resting this week? Step out, and the quest gets smaller without your name.`,
  stepOut: 'Step out this week',
  steppedOut: 'You stepped out this week. Step back in',
  mobPath: [{ at: 2, text: 'Den stamp at 2' }, { at: 4, text: 'Stamp and the desk bell at 4' }, { at: 8, text: 'Brass lamp at 8' }, { at: 12, text: 'Foil seal at 12' }],
  newMobChain: (best) => `A new chain starts this week. Your best is ${best} weeks.`,
  onTheWay: 'On the way',

  // P5 Exam pause
  pauseLine: (left) => `Set days ahead for school exams. Your chain holds on those days. You have 14 a season, and ${left} are left.`,
  pauseKey: (n) => (n === 1 ? 'Pause 1 day' : `Pause ${n} days`),
  clearDays: 'Clear these days',
  pickDays: 'Choose days to pause',
  earlierMonth: 'Earlier month',
  laterMonth: 'Later month',

  // S1 Shelf
  shelfTitle: 'Your shelf',
  shelfLead: 'Every one is earned. None can be bought.',
  shelfOwned: 'Yours',
  shelfToEarn: 'Still to earn',
  shelfLoading: 'Loading your shelf',
  shelfFailed: "Your shelf didn't load.",
  finishes: 'Finishes',
  foilProgress: (have, need) => `Foil edge. ${need} days in a row. ${Math.min(Math.max(0, have), need)} of ${need}.`,
  foilEarned: 'Foil edge. Earned.',
  mobShelf: (mob) => `${mob}'s shelf`,
  mobShelfOwned: 'On the shelf',
  mobShelfNext: (have, need) => (have != null && need != null ? `${Math.min(Math.max(0, have), need)} of ${need} weeks in a row` : need != null ? `At ${need} weeks in a row` : 'Next on the shelf'),
  lockedRule(f) {
    const count = f.have == null || f.need == null ? '' : ` ${Math.min(Math.max(0, f.have), f.need)} of ${f.need}`;
    const where = f.mob ? `, in ${f.mob}` : '';
    return `${foldName(f.key)}. ${FOLD_RULES[f.key] || ''}${count}${where}.`;
  },
  changeFoldTitle: 'Change your Fold',
  sitAs: (name) => `Sit as ${name}`,
  foldChanged: (name) => `You play as ${name} now.`,

  // K1 to K5 moments
  close: 'Close',
  skip: 'Skip',
  milestoneLine(c) {
    const rested = c.rested > 0 ? ` and rested ${c.rested}` : '';
    const best = c.days >= c.best ? 'It is your best run so far.' : `Your best is ${c.best} days.`;
    return `You practised ${c.practised} of them${rested}. ${best}`;
  },
  aRestPass: 'A rest pass',
  backToDen: 'Back to the den',
  questDone: 'Quest done',
  questTail: (a, t) => (a > t ? `answered. The quest needed ${t}.` : `of ${t} answered`),
  questDoneLine: (mob, answered, target, week) => `${mob} answered ${answered} questions this week. The quest needed ${target}, so week ${week} of your chain is stitched.`,
  openParcel: 'Open the parcel',
  seePennant: 'See the pennant',
  stitchedLine: (mob, week, size) => `${mob} finished this week's quest together, so week ${week} is stitched for ${size <= 1 ? 'you' : `all ${NUMBER_WORDS[size] || size} of you`}.`,
  rewardFor: (item) => `${articled(itemName(item))} for your den`,
  staysOnShelf: "It stays on your den's shelf.",
  newOnShelf: 'New on your shelf',
  revealFact: (mob, fold) => `${mob} finished its first weekly quest, so everyone in it gets ${foldName(fold)}. Nobody can buy ${fold === 'hop' ? 'him' : 'it'}.`,
  playAs: (fold) => `Play as ${foldName(fold)}`,
  seeShelf: 'See your shelf',

  offline: "You're offline. Nothing changed.",
  generic: "That didn't go through. Try again.",
});

// ---- Errors by the server's code (spec 3.2). The server's own sentence wins when it sends one. ----
export const DEN_ERRORS = Object.freeze({
  START_PRO: 'Starting games is part of Pro. You can play every game your Mob starts.',
  START_USED: "You started this week's game in this Mob. You can start another on Monday, or a friend with Pro can pass you the mic.",
  START_FORMAT: 'Live rooms are part of Pro. You can start this game for anytime in 24 hours.',
  GAMES_OPEN_LIMIT: 'Your Mob already has 3 games open. A new one can start when one closes.',
  ROOM_OPEN_ALREADY: 'A live room is already open in your Mob. Join it from the den.',
  LIVE_OFF: 'Live rooms are not on yet. Start it for anytime in 24 hours.',
  LIVE_HOURS: 'Live rooms open from 6:00 AM to 11:00 PM. You can start it for anytime in 24 hours.',
  LIVE_BUSY: 'Live is busy right now. Play now, and your Mob can catch up within 24 hours.',
  STICKER_INVALID: 'Choose one of the stickers.',
  MIC_LIMIT: 'You passed the mic twice this week, the most a week allows. You can pass it again on Monday.',
  MIC_SELF: 'Pass the mic to a friend in your Mob.',
  BILLING_OFF: 'Everyone can start games right now, so there is no mic to pass.',
  NOT_OWNER_SETTINGS: 'Only the member who started the Mob can change this.',
  NAME_KEY_INVALID: 'Choose one of the names.',
  FOLD_INVALID: 'Choose one of the Folds.',
  FOLD_LOCKED: 'You have not earned that Fold yet. Its card says how.',
  STEP_OUT_DONE: "This week's quest is already done, so there is nothing to step out of.",
  PAUSE_PAST: 'Pause days have to be after today.',
  PAUSE_LIMIT: 'You have used the 14 pause days this season allows.',
  LENGTH_INVALID: 'Choose 5, 10, 15 or 20 questions.',
  CHAPTER_INVALID: 'Choose a chapter of this subject.',
  BANK_THIN: 'There are not enough questions ready for that paper.',
});

/** The sentence for a failed write: the server's message, else the den's own by code, else offline or the plain fallback. */
export function denError(r) {
  if (!r || r.ok) return null;
  if (r.status === 0 || r.code === 'NETWORK') return DenCopy.offline;
  return r.message || DEN_ERRORS[r.code] || DenCopy.generic;
}
