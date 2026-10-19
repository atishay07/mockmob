import '../../review/model/your_papers.dart' show paperLocation;
import '../../../core/copy/formatters.dart';
import '../../../core/domain/chapter_breakdown.dart';
import '../../../core/domain/marks.dart';
import '../../../core/models/attempt.dart';
import '../widgets/ask_prompts.dart' show AskIntent;
import 'ask_mock_lines.dart';
import 'chapter_ties.dart';
import 'insights_models.dart';
import 'readout.dart' show RecordAnswer;
import 'subject_names.dart';
import 'trend.dart' show modeLabel;

/// The two doors of Ask Mobi's own screen (ASK-MOBI-1019, option B; the owner's D112 and D114):
/// "Ask now" takes any CUET doubt, and "Ask your record" answers from the student's own papers.
/// Pure: no providers, no I/O. Every figure here is read from the record or from a paper on the
/// phone; with nothing to read, the line is left out, never made up.

/// What a door ask costs, said on the row before the tap.
enum DoorPrice {
  /// Answered on this phone from the record. Never reaches the model.
  free,

  /// A written reply through the server's budget guard.
  credit,

  /// Part of Pro: visible, with a quiet lock (D101). A tap explains Pro; it never sends.
  pro,
}

/// One ask on a door: the words that are sent, its price and one line from the record under it.
class DoorAsk {
  const DoorAsk({required this.text, required this.price, this.preview, this.answer, this.intent});

  final String text;
  final DoorPrice price;

  /// A real line from the record, or a plain description of what the ask reads. Null for none.
  final String? preview;

  /// The answer already read on this phone (the last paper's own breakdown). Null when the record
  /// answers it as it always has.
  final RecordAnswer? answer;

  /// The record intent behind the ask, when it has one.
  final AskIntent? intent;

  bool get locked => price == DoorPrice.pro;
}

/// The words of the two doors. Each line was read aloud (D84, R6): full sentences, no clipped
/// fragments, no exclamation marks, no arrows.
abstract final class AskDoorCopy {
  // The greeting beside Mobi.
  static String greetFresh(String? name) => '${_hi(name)} Stuck on a CUET doubt? Ask me.';
  /// The server reads the student's last 60 papers at most (`GET /api/prepos/insights`), so a count at or over that is
  /// said as "your last 60 papers", which is true whether the student has sat exactly 60 or many more.
  static const recordReadCap = 60;
  static String _papersSay(int papers) =>
      papers == 1 ? 'your first paper says' : papers >= recordReadCap ? 'your last $recordReadCap papers say' : 'your $papers papers say';

  static String greetHeavy(String? name, int papers) => '${_hi(name)} Ask me any doubt, or ask what ${_papersSay(papers)}.';
  static String _hi(String? name) => name == null ? 'Hi.' : 'Hi $name.';

  // Ask now.
  static const nowTitle = 'Ask now';
  /// What a credit buys, said on the door before anything is typed (C-dec 3b: 1 credit on every plan).
  static const nowLine = '1 credit buys an answer, a follow-up and 2 real CUET questions.';

  /// The line under a starter from the record: "Accountancy. You lost 39 marks here."
  static String starterLost(String subject, int lost) => '$subject. You lost $lost ${lost == 1 ? 'mark' : 'marks'} here.';

  /// The line under a starter from the student's subjects.
  static String starterSubject(String subject) => '$subject. You pick the chapter for the 2 questions.';
  static const nowHint = 'Type your doubt here';
  static const nowTip = 'Or tap a doubt from your weak chapters.';
  static const nowTipFresh = 'Or tap one to ask it now.';
  static const nowTapBox = 'Tap the box to see three ideas to start with.';

  // Ask your record.
  static const recordTitle = 'Ask your record';
  static String recordLine(int papers) =>
      papers == 1
          ? 'Mobi reads your first paper and answers from it.'
          : papers >= recordReadCap
          ? 'Mobi reads your last $recordReadCap papers and answers from them.'
          : 'Mobi reads your $papers papers and answers from them.';
  static const recordTip = 'Tap a question and Mobi answers at once.';
  static const recordTipFree = 'Then ask your record. Each answer is free and comes at once.';
  static String leadFigureLine(String chapter) => 'marks lost in $chapter, your biggest leak';

  /// The figure's line for the lead: alone, "marks lost in Ray Optics, your biggest leak"; tied (owner I14), "marks lost in
  /// each of Ray Optics and Optics, tied as your biggest leak".
  static String leadLine(RecordLead lead) =>
      lead.tied > 1 ? 'marks lost in ${lead.shortPlace}, tied as your biggest leak' : leadFigureLine(lead.chapter);
  static String seeAll(int n) => 'See all $n questions about your record';
  static const seeFewer = 'Show fewer questions';
  static const emptySay = 'Your record is empty for now.';
  static const emptyBody = 'Finish one practice paper and Mobi can show you where every mark went.';
  static const emptyKey = 'Practise 10 questions first';
  static const emptyAfter = 'After that, you can ask where you lose marks, which chapter to practise and what to revise tonight.';
  static const reading = 'Mobi is reading your record.';
  static const readFailed = 'Your record could not be read just now. Ask now still works.';
  static const readOffline = 'You are offline, so your record has not loaded yet. It loads here when you are back online.';
  static const tryAgain = 'Try again';

  // The record asks.
  static const lastPaper = 'Why did I lose marks in my last paper?';
  static String revise(DateTime now) => 'What should I revise ${tonightOrToday(now)}?';
  static const revisePreview = 'Chapters, rules and traps from your record';
  static String chaptersRanked(int n) => '$n ${n == 1 ? 'chapter' : 'chapters'} ranked from your answers';
  static const pacePreviewLocked = 'Timing from your timed papers';
  static const changesPreviewLocked = 'From the answers you changed';
  static String changesPreview(int count, int gains, int losses) =>
      '$count ${count == 1 ? 'change' : 'changes'}: $gains helped, $losses hurt';

  // Prices, said before the tap.
  static const free = 'Free';
  static const oneCredit = '1 credit';
  static const pro = 'Pro';

  // The line at the foot of the doors, in the design's words (ASK-MOBI-1019, "Credit line"). [day] is
  // "1 Nov": its space never breaks, so the date is never split across two lines. The free monthly
  // credits "refill", the website's word (copy pass, 19 Oct: Help says they refill to 50 at the start
  // of every month; "renew" is what a paid plan does).
  static String creditsOfMonthly(int left, int monthly, String day) => '$left of your $monthly free credits left\u00a0· they refill\u00a0$day';
  static String creditsLeft(int left, String day) => '${left == 1 ? '1 credit' : '$left credits'} left\u00a0· free ones refill\u00a0$day';
  static String renews(String day) => 'Your free credits refill on $day.';
  static const creditsUnknown = 'See your credits';
  static const creditsNone = 'You have no credits left.';
  static const creditsPaused = 'Written answers are paused just now.';
  static const pausedSecond = 'Answers from your marks still work.';
  static const howItCosts = 'Answers from your record are free. A doubt uses 1 credit, with its follow-up and 2 real CUET questions.';
  static const howItCostsNone = 'Answers from your marks stay free.';

  // Pro, with PLAY_BILLING off: a calm sheet, no price, no link (D101).
  static const proPaceTitle = 'Timing is part of Pro';
  static const proPaceBody = 'With Pro, Mobi shows how long you spend on the questions you get wrong, from your timed papers.';
  static const proChangesTitle = 'Changed answers are part of Pro';
  static const proChangesBody = 'With Pro, Mobi shows whether changing an answer helped you or cost you marks, from your timed papers.';
  static const proChaptersTitle = 'Every chapter is part of Pro';
  static const proChaptersBody = 'With Pro, your record ranks every chapter you have answered, not only the first three.';
  static const proSoon = 'Pro is coming to the app soon. Everything else on this screen works now.';
  static const proDone = 'Done';

  // Offline, above the doors.
  static const offline = 'You are offline. Answers from your record still work. Written answers wait until you are back online.';

  // While a written reply is on its way.
  static const writingNote = 'This doubt uses 1 credit. A reply that fails uses none.';
  static const followUpWriting = 'Your follow-up is free. A reply that fails uses nothing.';
  static const followUpHint = 'Ask a follow-up';

  // A doubt's thread: its one free follow-up, then a new doubt.
  static const followUpOneHint = 'Ask your one follow-up';
  static const followUpLeft = '1 follow-up left. It is free.';
  static const threadDone = 'This doubt has had its follow-up.';
  static const threadDoneBody = 'Ask a new doubt to open a new one. It uses 1 credit.';
  static const newDoubt = 'Ask a new doubt (1 credit)';
  static const startOver = 'Ask something new';

  // The Practice card.
  static const cardTitle = 'Ask Mobi';
  static const cardLineFresh = 'Stuck on a doubt? Ask now and Mobi explains it in plain words.';
  // Shorter than the old line, so the card's fixed height holds it at 360 dp (the longer draft overflowed by 5 px).
  static String cardLineHeavy(int lost, String chapter) => 'Stuck on a doubt? Ask now, or ask why you lost $lost marks in $chapter.';
  static const cardLineRecord = 'Stuck on a doubt? Ask now, or ask what your papers say.';
  static const cardNow = 'Ask now';
  static const cardRecord = 'Ask your record';

  // The header key.
  static const button = 'Ask Mobi';
  static const buttonShort = 'Ask';
}

// ---- Ask now ------------------------------------------------------------------------------

/// One Ask now starter: the doubt that is sent, the line under it, and the anchor of its 2 check questions. A
/// starter from the record carries its chapter, so the server attaches 2 real CUET questions on it; one from the
/// student's subjects alone sends the subject and lets the student pick the chapter after the answer.
class NowStarter {
  const NowStarter({required this.text, this.preview, this.subject, this.chapter});

  final String text;
  final String? preview;

  /// The subject id (`accountancy`), or null.
  final String? subject;

  /// The bank's chapter name, only when the record named it. Never guessed.
  final String? chapter;
}

/// With no record: one plain doubt per subject, sent with its subject only (no chapter is guessed: the student
/// picks it for the 2 questions).
const Map<String, String> askNowFallback = {
  'accountancy': 'How is goodwill valued by the super profit method?',
  'economics': 'What is price elasticity of demand?',
  'business_studies': 'What is the difference between delegation and decentralisation?',
  'english': 'How do I find the main idea of a passage?',
  'mathematics': 'How do I find the inverse of a 2 by 2 matrix?',
  'general_test': 'How do I solve blood relation questions quickly?',
  'physics': 'Explain Gauss’s law in simple words.',
  'chemistry': 'How do I balance a redox equation?',
  'biology': 'How does DNA replication work?',
  'history': 'What were the main features of the Harappan cities?',
  'political_science': 'What did the Non-Aligned Movement stand for?',
  'geography': 'What is the difference between weather and climate?',
  'psychology': 'What is the difference between a trait and a type?',
  'sociology': 'What does social stratification mean?',
  'computer_science': 'What is the difference between a list and a tuple in Python?',
};

/// The doubts asked about a weak chapter, in turn: each names the chapter, so Mobi answers about it and the 2
/// questions come from it.
const List<String Function(String)> _chapterDoubts = [
  _explainIt,
  _whichTrap,
  _whatToRemember,
];
String _explainIt(String c) => 'I keep losing marks in $c. Explain it the CUET way.';
String _whichTrap(String c) => 'Which trap catches me in $c, and how do I spot it?';
String _whatToRemember(String c) => 'What must I remember about $c before a mock?';

/// The three Ask now starters, in order. With a record they are doubts about the student's own weakest chapters
/// (the ones that cost the most marks), each sending its subject and chapter. With no record (or fewer than three
/// ranked chapters) the rest come from the student's subjects, one doubt each, sending the subject alone. With no
/// subjects the Commerce set stands in.
List<NowStarter> askNowStarters({PrepInsights? record, List<String> subjects = const []}) {
  final out = <NowStarter>[];
  final chapters = record != null && record.isReady
      ? [
          for (final c in byMarksLost(record.ranked))
            if (c.lost > 0 && c.chapter.trim().isNotEmpty && c.chapter != 'Unmapped chapter') c,
        ]
      : const <ChapterLine>[];
  for (final c in chapters.take(3)) {
    final name = c.chapter.trim();
    out.add(NowStarter(
      text: _chapterDoubts[out.length](name),
      preview: AskDoorCopy.starterLost(subjectDisplayName(c.subject), c.lost),
      subject: canonicalSubjectId(c.subject),
      chapter: name,
    ));
  }
  final ids = [for (final s in subjects) canonicalSubjectId(s)];
  final pool = [
    for (final id in ids.isEmpty ? const ['accountancy', 'economics', 'english'] : ids)
      if (askNowFallback[id] case final doubt?) (id, doubt),
    for (final id in const ['english', 'general_test'])
      if (askNowFallback[id] case final doubt?) (id, doubt),
  ];
  final seen = {for (final s in out) s.subject};
  for (final (id, doubt) in pool) {
    if (out.length >= 3) break;
    if (seen.contains(id)) continue;
    seen.add(id);
    out.add(NowStarter(text: doubt, preview: AskDoorCopy.starterSubject(subjectDisplayName(id)), subject: id));
  }
  return out;
}

// ---- Ask your record ----------------------------------------------------------------------

/// The lead of the record door: the chapter that cost the most marks, with the figure. When chapters tie for it
/// ([tied] above 1) every one of them is named ([chapters]), never just the first (owner I14).
class RecordLead {
  const RecordLead({required this.lost, required this.chapter, this.chapters = const []});

  final int lost;

  /// The first of the tied chapters (the one a Practise key opens).
  final String chapter;

  /// Every chapter that shares the first place, [chapter] first. Empty means [chapter] alone.
  final List<String> chapters;

  int get tied => chapters.length < 2 ? 1 : chapters.length;

  /// After "in": "Ray Optics", "each of Ray Optics and Optics", "each of 4 chapters".
  String get place => tied > 1 ? costliestPlace(chapters) : chapter;

  /// [place] for a tight spot (the big figure's line, the card line): long tied names become their count, "each of 2
  /// chapters", so the line stays short; the answer names them all.
  String get shortPlace => tied > 1 && chapters.join().length > 32 ? 'each of $tied chapters' : place;
}

/// The biggest leak in the record, or null when no chapter is ranked yet.
RecordLead? recordLead(PrepInsights? record) {
  if (record == null || !record.isReady || record.ranked.isEmpty) return null;
  final tied = costliestChapters(record.ranked);
  final c = tied.first;
  if (c.lost <= 0 || c.chapter.trim().isEmpty) return null;
  final names = [for (final t in tied) if (t.chapter.trim().isNotEmpty) t.chapter.trim()];
  return RecordLead(lost: c.lost, chapter: c.chapter.trim(), chapters: names.length > 1 ? names : const []);
}

/// The student's latest scored paper, read from its own answers on the phone: the line under the
/// ask and the free answer it gives.
class LastPaper {
  const LastPaper({required this.attempt, required this.preview, required this.answer});

  final Attempt attempt;
  final String preview;
  final RecordAnswer answer;
}

/// The first words of the last-paper answer, so a reply can be traced back to its paper.
const lastPaperLead = 'Your last paper was ';

/// The same, when a newer paper has not been opened yet: the answer reads the newest paper the student has opened, and
/// says so rather than calling it the last.
const lastOpenedPaperLead = 'The last paper you opened was ';

String _signed(int n) => n < 0 ? '−${-n}' : '$n';

/// "Accountancy full mock", "Economics Quick 10".
String paperName(Attempt a) => '${subjectDisplayName(a.subject)} ${modeLabel(a.mode, a.total)}';

/// The paper inside a sentence (copy pass, 19 Oct): "the Accountancy full mock", "the Economics set of
/// 10 questions". The row's short name ([paperName]) is a label; a reply says it as English.
String paperPhrase(Attempt a) {
  final subject = subjectDisplayName(a.subject);
  return switch (a.mode) {
    'full' => 'the $subject full mock',
    'nta' => 'the $subject mock in NTA mode',
    'smart' => 'the $subject Smart practice set',
    _ => 'the $subject set of ${a.total} questions',
  };
}

/// "today", "yesterday", "Thursday" within the week, otherwise "12 October".
String paperDay(DateTime at, DateTime now) {
  final a = at.toLocal(), n = now.toLocal();
  final days = DateTime(n.year, n.month, n.day).difference(DateTime(a.year, a.month, a.day)).inDays;
  if (days <= 0) return 'today';
  if (days == 1) return 'yesterday';
  if (days < 7) return weekdayName(a.weekday);
  return formatDayMonth(a);
}

/// The latest paper with questions in it whose result the student has opened (newest first, the record's own order), or
/// null. A paper whose result is still sealed ([unopened]) is skipped: its score and its marks lost are the reveal, and
/// the link would lead past the sealed sheet.
LastPaper? lastPaper(List<Attempt>? attempts, DateTime now, {Set<String> unopened = const {}}) {
  Attempt? latest;
  var skipped = false;
  for (final a in attempts ?? const <Attempt>[]) {
    if (a.total <= 0) continue;
    if (unopened.contains(a.id)) {
      skipped = true;
      continue;
    }
    if (latest == null || a.completedAt.isAfter(latest.completedAt)) latest = a;
  }
  if (latest == null) return null;
  final name = paperName(latest);
  final day = paperDay(latest.completedAt, now);
  final marks = '${_signed(latest.marks)} of ${latest.maxMarks}';
  final lost = markBreakdownOf(latest).lost;
  final lines = mockLostLines(observedChapterBreakdown(latest), lost: lost);
  final on = day == 'today' || day == 'yesterday' ? day : 'on $day';
  // "Your last paper was the Accountancy full mock you sat today. It scored 34 of 50 marks."
  final newerSealed = skipped && (attempts ?? const <Attempt>[]).any((a) => a.total > 0 && unopened.contains(a.id) && a.completedAt.isAfter(latest!.completedAt));
  final opening = '${newerSealed ? lastOpenedPaperLead : lastPaperLead}${paperPhrase(latest)} you sat $on. It scored $marks marks.';
  final String reply;
  if (lost <= 0) {
    reply = '$opening It lost no marks at all.';
  } else if (lines.isEmpty) {
    final w = latest.wrong, b = latest.unattempted;
    final cause = [
      if (w > 0) '$w wrong ${w == 1 ? 'answer' : 'answers'}',
      if (b > 0) '$b left blank',
    ].join(' and ');
    reply = '$opening It lost $lost marks${cause.isEmpty ? '' : ', from $cause'}.';
  } else {
    reply = '$opening It lost $lost marks, and these chapters cost the most:\n${lines.join('\n')}';
  }
  return LastPaper(
    attempt: latest,
    preview: '$name, $marks, $day',
    answer: RecordAnswer(reply, actions: [('See this paper', paperLocation(latest, sealed: false))]),
  );
}

String? _paceLine(PrepInsights v) {
  final p = v.pace;
  if (!p.usable) return null;
  String sec(int s) => s >= 60 ? '${s ~/ 60}:${(s % 60).toString().padLeft(2, '0')}' : '${s}s';
  final wrong = p.medianWrongSec, right = p.medianRightSec;
  if (wrong != null && right != null) return 'Wrong answers take ${sec(wrong)}, right ones ${sec(right)}';
  return p.medianSec == null ? null : 'A typical question takes ${sec(p.medianSec!)}';
}

/// Every record ask, in the door's order: the lead first, then the rest. The count of this list is
/// the "See all" number. With no paper on the phone the last-paper ask is left out.
List<DoorAsk> recordDoorAsks(PrepInsights? record, {required bool pro, LastPaper? last, required DateTime now}) {
  final ready = record != null && record.isReady;
  final lead = recordLead(record);
  final week = ready ? record.thisWeek : null;
  final changes = ready ? record.changes : null;
  return [
    DoorAsk(
      text: 'Where am I losing marks?',
      price: DoorPrice.free,
      intent: AskIntent.losing,
      preview: lead == null ? 'Reads your wrong and blank answers' : '${lead.lost} marks lost in ${lead.place}',
    ),
    // Worked out from the record by the server with no model call (replyKind 'tonight'): free (C-dec 3).
    DoorAsk(text: AskDoorCopy.revise(now), price: DoorPrice.free, intent: AskIntent.plan, preview: AskDoorCopy.revisePreview),
    DoorAsk(
      text: 'Which chapter should I practise?',
      price: DoorPrice.free,
      intent: AskIntent.chapter,
      preview: ready && record.ranked.isNotEmpty ? AskDoorCopy.chaptersRanked(record.ranked.length) : 'Ranks the chapters costing you the most marks',
    ),
    if (last != null) DoorAsk(text: AskDoorCopy.lastPaper, price: DoorPrice.free, preview: last.preview, answer: last.answer),
    DoorAsk(
      text: 'Am I too slow on wrong answers?',
      price: pro ? DoorPrice.free : DoorPrice.pro,
      intent: AskIntent.pace,
      preview: pro ? (ready ? _paceLine(record) : null) ?? 'Needs timed answers' : AskDoorCopy.pacePreviewLocked,
    ),
    DoorAsk(
      text: 'How is my week going?',
      price: DoorPrice.free,
      intent: AskIntent.week,
      preview: week == null
          ? 'Counts your last 7 days'
          : (week.sessions == 0
              ? 'No papers in the last 7 days'
              : '${week.sessions} ${week.sessions == 1 ? 'paper' : 'papers'}, ${week.questions} questions in 7 days'),
    ),
    DoorAsk(
      text: 'Do I change answers too much?',
      price: pro ? DoorPrice.free : DoorPrice.pro,
      intent: AskIntent.changes,
      preview: pro
          ? (changes != null && changes.count > 0 ? AskDoorCopy.changesPreview(changes.count, changes.gains, changes.losses) : 'Needs timed answers')
          : AskDoorCopy.changesPreviewLocked,
    ),
  ];
}
