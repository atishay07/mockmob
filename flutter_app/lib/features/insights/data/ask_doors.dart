import '../../review/model/your_papers.dart' show paperLocation;
import '../../../core/copy/formatters.dart';
import '../../../core/domain/chapter_breakdown.dart';
import '../../../core/domain/marks.dart';
import '../../../core/models/attempt.dart';
import '../widgets/ask_prompts.dart' show AskIntent;
import 'ask_mock_lines.dart';
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
  static String greetHeavy(String? name, int papers) =>
      '${_hi(name)} Ask me any doubt, or ask what ${papers == 1 ? 'your first paper says' : 'your $papers papers say'}.';
  static String _hi(String? name) => name == null ? 'Hi.' : 'Hi $name.';

  // Ask now.
  static const nowTitle = 'Ask now';
  static const nowLine = 'Type any CUET doubt and Mobi explains it in plain words.';
  static const nowHint = 'Type your doubt here';
  static const nowTip = 'Or tap one to ask it now.';
  static const nowTapBox = 'Tap the box to see three ideas to start with.';

  // Ask your record.
  static const recordTitle = 'Ask your record';
  static String recordLine(int papers) =>
      papers == 1 ? 'Mobi reads your first paper and answers from it.' : 'Mobi reads your $papers papers and answers from them.';
  static const recordTip = 'Tap a question and Mobi answers at once.';
  static String leadFigureLine(String chapter) => 'marks lost in $chapter, your biggest leak';
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
  static const revisePreview = 'A written plan built from your record';
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
  static const howItCosts = 'Answers from your marks are free. A written answer uses 1 credit.';
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
  static const writingNote = 'This reply uses 1 credit. A reply that fails uses none.';
  static const followUpHint = 'Ask a follow-up';
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

/// Starters per subject: common CUET doubts, each a question the model answers (none is answered
/// from the record, so none is ever marked "1 credit" and then answered free, or the other way).
const Map<String, List<String>> askNowBank = {
  'accountancy': [
    'Explain the sacrificing ratio in simple words',
    'How is goodwill valued by the super profit method?',
    'What is the difference between shares and debentures?',
  ],
  'economics': [
    'What is price elasticity of demand?',
    'Explain the investment multiplier in simple words',
    'Why does the demand curve slope downwards?',
  ],
  'business_studies': [
    'Explain Fayol’s principles of management in simple words',
    'What is the difference between delegation and decentralisation?',
  ],
  'english': [
    'How do I find the main idea of a passage?',
    'How do I solve para jumbles faster?',
  ],
  'mathematics': [
    'How do I find the inverse of a 2 by 2 matrix?',
    'Explain the chain rule in simple words',
  ],
  'general_test': [
    'How do I solve blood relation questions quickly?',
    'How do I find a percentage increase in my head?',
  ],
  'physics': ['Explain Gauss’s law in simple words'],
  'chemistry': ['How do I balance a redox equation?'],
  'biology': ['Explain how DNA replication works in simple words'],
  'history': ['What were the main features of the Harappan cities?'],
  'political_science': ['What did the Non-Aligned Movement stand for?'],
  'geography': ['What is the difference between weather and climate?'],
  'psychology': ['What is the difference between a trait and a type?'],
  'sociology': ['What does social stratification mean?'],
  'computer_science': ['What is the difference between a list and a tuple in Python?'],
};

/// The three Ask now starters, in order. A student with a record leads with their own weakest
/// chapter (T001); the rest come from their subjects, one subject at a time. With no subjects the
/// Commerce set the design was drawn with stands in.
List<String> askNowStarters({PrepInsights? record, List<String> subjects = const []}) {
  final out = <String>[];
  void add(String s) {
    if (!out.contains(s) && out.length < 3) out.add(s);
  }

  final top = record != null && record.isReady && record.ranked.isNotEmpty ? record.ranked.first.chapter.trim() : null;
  if (top != null && top.isNotEmpty) add('Explain $top in simple words');

  final lists = [for (final s in subjects) ?askNowBank[canonicalSubjectId(s)]];
  if (lists.isEmpty) lists.addAll([askNowBank['accountancy']!, askNowBank['economics']!, askNowBank['english']!]);
  for (var round = 0; out.length < 3 && round < 3; round++) {
    for (final l in lists) {
      if (round < l.length) add(l[round]);
    }
  }
  // A set with few starters of its own is filled from the parts every CUET student sits, so the
  // door always has three ideas (it says so at 360 dp).
  for (final s in [...askNowBank['english']!, ...askNowBank['general_test']!]) {
    add(s);
  }
  return out;
}

// ---- Ask your record ----------------------------------------------------------------------

/// The lead of the record door: the chapter that cost the most marks, with the figure.
class RecordLead {
  const RecordLead({required this.lost, required this.chapter});

  final int lost;
  final String chapter;
}

/// The biggest leak in the record, or null when no chapter is ranked yet.
RecordLead? recordLead(PrepInsights? record) {
  if (record == null || !record.isReady || record.ranked.isEmpty) return null;
  final c = record.ranked.first;
  if (c.lost <= 0 || c.chapter.trim().isEmpty) return null;
  return RecordLead(lost: c.lost, chapter: c.chapter.trim());
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
      preview: lead == null ? 'Reads your wrong and blank answers' : '${lead.lost} marks lost in ${lead.chapter}',
    ),
    DoorAsk(
      text: 'Which chapter should I practise?',
      price: DoorPrice.free,
      intent: AskIntent.chapter,
      preview: ready && record.ranked.isNotEmpty ? AskDoorCopy.chaptersRanked(record.ranked.length) : 'Ranks the chapters costing you the most marks',
    ),
    if (last != null) DoorAsk(text: AskDoorCopy.lastPaper, price: DoorPrice.free, preview: last.preview, answer: last.answer),
    DoorAsk(text: AskDoorCopy.revise(now), price: DoorPrice.credit, intent: AskIntent.plan, preview: AskDoorCopy.revisePreview),
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
