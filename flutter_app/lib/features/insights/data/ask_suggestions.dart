import '../copy.dart';
import '../widgets/ask_prompts.dart' show recordPrompts;
import 'ask_mobi_context.dart';
import 'insights_models.dart';
import 'readout.dart';

/// The asks the Ask Mobi sheet offers and the free first answer it opens with, from its context
/// and the student's record (ASK-MOBI-1018 section 4). Pure: no providers, no I/O.
///
/// Every ask carries its price. A free ask always carries its answer, already read from the record
/// on this phone, so tapping it can never reach the model. A preview is a real line from the
/// record or a plain description of what the ask uses; a figure is never invented, and with no
/// record line there is no figure.

enum AskPrice { free, credit }

class AskSuggestion {
  const AskSuggestion({required this.text, required this.price, this.preview, this.answer, this.message});

  /// The ask as the row shows it.
  final String text;

  /// What is sent when it differs from [text]: a question with no attempt behind it travels with
  /// its own words, because the server has nothing else to read it from.
  final String? message;

  /// The ask as it is sent.
  String get sent => message ?? text;
  final AskPrice price;

  /// One line under the ask: a record figure, or what the ask uses. Null when there is none.
  final String? preview;

  /// The record's answer, for a free ask. Null for a written reply.
  final RecordAnswer? answer;

  bool get free => price == AskPrice.free;
}

/// The answer a sheet opens with, already there and free: where a mock's marks went, why Today
/// chose its lead, or what to practise.
class AskOpening {
  const AskOpening({required this.reply, this.title, this.actions = const [], this.lines = const []});

  /// The figures as separate lines (a mock's chapters, Today's counts), when the opening is a list
  /// of them; [reply] holds the same words joined, for a screen reader and for tests.
  final List<String> lines;

  /// One plain line above the figures ("Where the 78 lost marks went"), or null.
  final String? title;
  final String reply;

  /// (label, web href) pairs; the sheet shows the first it can open.
  final List<(String, String)> actions;
}

/// Free product asks for a student with no sessions yet.
const askCreditsQuestion = 'How do credits work?';
const askScopeQuestion = 'What can you answer?';

/// The free record ask when it is answered on this phone, or null when the record cannot answer it.
AskSuggestion? _recordAsk(String text, PrepInsights? v, {required bool pro, String? preview}) {
  if (v == null) return null;
  final answer = answerFromInsights(text, v, pro: pro);
  if (answer == null) return null;
  return AskSuggestion(text: text, price: AskPrice.free, preview: preview, answer: answer);
}

/// The record's line for [chapter], matched by name either way round ("Partnership" and
/// "Partnership Accounts"), or null.
ChapterLine? chapterLineFor(String? chapter, PrepInsights? v) {
  if (chapter == null || v == null || !v.isReady) return null;
  final want = chapter.toLowerCase();
  for (final c in [...v.ranked, ...v.thin]) {
    final have = c.chapter.toLowerCase();
    if (have == want || have.contains(want) || want.contains(have)) return c;
  }
  return null;
}

String _plural(int n, String word) => '$n $word${n == 1 ? '' : 's'}';

/// The 2 or 3 asks for [c], in order.
List<AskSuggestion> suggestionsFor(AskMobiContext c, PrepInsights? v, {bool pro = false}) {
  final ready = v != null && v.isReady;
  if (!ready && c.kind != AskMobiKind.question) {
    return const [
      AskSuggestion(text: askCreditsQuestion, price: AskPrice.free, answer: RecordAnswer(AskSheetCopy.creditsAnswer)),
      AskSuggestion(text: askScopeQuestion, price: AskPrice.free, answer: RecordAnswer(AskSheetCopy.scopeAnswer)),
    ];
  }
  final previews = recordPrompts(v, pro: pro);
  final top = ready && v.ranked.isNotEmpty ? v.ranked.first.chapter : null;
  AskSuggestion paid(String text, String? preview) => AskSuggestion(text: text, price: AskPrice.credit, preview: preview);
  final losing = _recordAsk(InsightsCopy.promptLosing, v, pro: pro, preview: previews[0].preview);
  final chapter = _recordAsk(InsightsCopy.promptChapter, v, pro: pro, preview: previews[1].preview);
  final week = _recordAsk(InsightsCopy.promptWeek, v, pro: pro, preview: previews[3].preview);

  switch (c.kind) {
    case AskMobiKind.question:
      final q = c.question;
      // A question with no attempt behind it (the question stream): the server cannot read it, so
      // the written ask carries the question's own words, and there is no pick to ask about.
      if (q?.ref == null && q?.stem != null) {
        return [
          AskSuggestion(
            text: AskSheetCopy.explainStep,
            price: AskPrice.credit,
            preview: AskSheetCopy.explainStepPreview,
            message: InsightsCopy.askAboutQuestion(q!.stem!, q.keyLetter),
          ),
          ?_history(c.chapter, v) ?? losing,
        ];
      }
      // Short options are asked by their words ("19:11:10"), long ones by their letters.
      final why = q?.keyText != null && q?.pickText != null && q!.keyText!.length <= 28 && q.pickText!.length <= 28
          ? AskSheetCopy.whyKeyNotPick(q.keyText!, q.pickText!)
          : q?.keyLetter != null && q?.pickLetter != null
              ? AskSheetCopy.whyLetters(q!.keyLetter!, q.pickLetter!)
              : AskSheetCopy.whyWrong;
      return [
        paid(why, AskSheetCopy.usesQuestion),
        paid(AskSheetCopy.misread, AskSheetCopy.misreadPreview),
        ?_history(c.chapter, v) ?? losing,
      ];
    case AskMobiKind.mock:
      return [?chapter, paid(InsightsCopy.promptPlan(top), AskSheetCopy.planPreview)];
    case AskMobiKind.today:
      return [?losing, paid(InsightsCopy.promptPlan(top), AskSheetCopy.planPreview)];
    case AskMobiKind.practice:
      return [?week, paid(InsightsCopy.promptExplain(top), AskSheetCopy.explainPreview)];
    case AskMobiKind.page:
      return [?losing, ?chapter, paid(InsightsCopy.promptExplain(top), AskSheetCopy.explainPreview)];
  }
}

/// "Have I missed Partnership before?", answered from the record's line for that chapter. Null
/// when the question has no chapter.
AskSuggestion? _history(String? chapter, PrepInsights? v) {
  if (chapter == null || v == null) return null;
  final line = chapterLineFor(chapter, v);
  final text = AskSheetCopy.missedBefore(chapter);
  if (line == null) {
    return AskSuggestion(text: text, price: AskPrice.free, answer: RecordAnswer(AskSheetCopy.noChapterYet(chapter)));
  }
  final preview = AskSheetCopy.wrongOf(line.wrong, line.n, line.sessions);
  final open = line.lost > 0 ? ' ${line.lost > line.offer ? '${_plural(line.lost, 'mark')} lost there.' : '${line.lost} of the ${line.offer} marks on offer lost there.'}' : '';
  return AskSuggestion(
    text: text,
    price: AskPrice.free,
    preview: preview,
    answer: RecordAnswer('${line.chapter}: ${AskSheetCopy.wrongOf(line.wrong, line.n, line.sessions)}.$open'),
  );
}

/// The free answer [c] opens with, or null (a question or the page opens on its asks instead).
AskOpening? openingFor(AskMobiContext c, PrepInsights? v, {bool pro = false}) {
  final ready = v != null && v.isReady;
  switch (c.kind) {
    case AskMobiKind.question || AskMobiKind.page:
      return null;
    case AskMobiKind.mock:
      if (c.lines.isNotEmpty) return AskOpening(title: AskSheetCopy.mockOpeningTitle, reply: c.lines.join('\n'));
      final a = ready ? answerFromInsights(InsightsCopy.promptLosing, v, pro: pro) : null;
      return a == null ? null : AskOpening(reply: a.reply, actions: a.actions);
    case AskMobiKind.today:
      if (c.reason == null && c.lines.isEmpty) return null;
      return AskOpening(title: c.reason, reply: c.lines.join('\n'));
    case AskMobiKind.practice:
      final a = ready ? answerFromInsights(InsightsCopy.promptChapter, v, pro: pro) : null;
      return a == null ? null : AskOpening(reply: a.reply, actions: a.actions);
  }
}

/// The line under Practice's "Ask Mobi what to practise": the weakest chapter's own figures from the
/// record, or null when the record has none (nothing is invented).
String? practicePreview(PrepInsights? v) {
  if (v == null || !v.isReady || v.ranked.isEmpty) return null;
  final c = v.ranked.first;
  if (c.n <= 0) return null;
  return AskSheetCopy.practiceLine(c.chapter, c.wrong, c.n);
}

/// The record chip's three lines: the marks ledger, the biggest leak and pace (pace only on Pro
/// with timed answers). Empty when the record has nothing yet.
List<String> recordSummary(PrepInsights? v, {bool pro = false}) {
  if (v == null || !v.isReady) return const [];
  final l = v.ledger;
  final top = v.ranked.isEmpty ? null : v.ranked.first;
  final p = v.pace;
  String sec(int s) => s >= 60 ? '${s ~/ 60}:${(s % 60).toString().padLeft(2, '0')}' : '${s}s';
  return [
    AskSheetCopy.ledgerLine(l.net, l.gained, l.penalty, v.questions),
    if (top != null) AskSheetCopy.leakLine(top.chapter, top.lost, top.wrong, top.n),
    if (pro && p.usable && p.medianSec != null) AskSheetCopy.paceLine(sec(p.medianSec!), p.questionsTimed),
  ];
}

/// The wallet line under the composer: "9 of 50 AI credits left · refills 1 Nov".
///
/// [oneBalance]: the server keeps one credits balance (owner D78), so [total] is that one balance and the
/// line says "108 credits left · free ones refill 1 Nov", never "AI credits".
String walletLine({required int? total, int? includedMonthly, int? bonus, bool paused = false, String? resetsOn, bool oneBalance = false}) {
  if (paused) return AskSheetCopy.walletPaused;
  if (total == null) return AskSheetCopy.walletUnknown;
  if (oneBalance) {
    final left = '${InsightsCopy.credits(total)} left';
    return resetsOn == null ? left : '$left · free ones refill $resetsOn';
  }
  final left = includedMonthly != null && (bonus ?? 0) == 0 && total <= includedMonthly
      ? '$total of $includedMonthly credits left'
      : '${InsightsCopy.aiCredits(total)} left';
  return resetsOn == null || includedMonthly == null ? left : '$left · refills $resetsOn';
}

/// The words of the Ask Mobi sheet. Sentence case, no exclamation marks, no arrows.
abstract final class AskSheetCopy {
  static const title = 'Ask Mobi';
  static const close = 'Close';
  static const recordChip = 'Your record';
  static String recordSessions(int n) => n == 0 ? 'no sessions yet' : _plural(n, 'session');
  static const recordNotLoaded = 'Record not loaded';
  static const retry = 'Retry';
  static const fullRecord = 'Full record';
  static String dropSubject(String label) => 'Stop asking about $label';
  static const practiceRow = 'Ask Mobi what to practise';
  // A chapter name that already holds a colon ("Partnership: admission of a partner") takes a comma, so
  // the line never reads "a: b: 4 wrong".
  static String practiceLine(String chapter, int wrong, int n) => '$chapter${chapter.contains(':') ? ',' : ':'} $wrong wrong of $n answered';
  static const askAboutQuestion = 'Ask about this question';
  static const askNext = 'Ask next';
  static const youCanAsk = 'You can ask now';
  static const free = 'Free';
  static const oneCredit = '1 credit';
  static const needsWritten = 'Needs a written reply';
  static String youPicked(String letter, String? text) => text == null ? 'You picked $letter' : 'You picked $letter, $text';
  static String keyIs(String letter, String? text) => text == null ? 'Key $letter' : 'Key $letter, $text';
  static const openingQuestion = 'Opening your question.';
  static const questionFailed = 'That question could not be opened. You can still ask about your record.';
  static String whyKeyNotPick(String key, String pick) => 'Why is $key right and $pick wrong?';
  static String whyLetters(String key, String pick) => 'Why is $key right and $pick wrong?';
  static const whyWrong = 'Why is my answer wrong?';
  static const explainStep = 'Explain this question step by step';
  static const explainStepPreview = 'Sends the question and its key';
  static const usesQuestion = 'Uses this question, your pick and the key';
  static const misread = 'What did I misread?';
  static const misreadPreview = 'Points to the words that decide the answer';
  static String missedBefore(String chapter) => 'Have I missed $chapter before?';
  static String wrongOf(int wrong, int n, int sessions) => '$wrong wrong of $n answered, in ${_plural(sessions, 'session')}';
  static String noChapterYet(String chapter) => 'Your record has no answers in $chapter yet. This is the first time it comes up.';
  static const planPreview = 'A written plan built from your record';
  static const explainPreview = 'A written explanation in plain words';
  static const mockOpeningTitle = 'Where the lost marks went';
  static const creditsAnswer = 'Questions about your own practice are free and answered from your record. Anything else gets a '
      'written reply for 1 credit, and the price shows before you send. Free includes 50 credits a month and Pro 50; '
      'bought credits never expire. A reply that fails costs nothing.';
  static const scopeAnswer = 'Your marks, chapters, timing and week, from your own practice, for free. Anything else, like '
      'explaining a question, gets a written reply for 1 credit.';
  static const newStudent = 'Mobi answers from your own practice. After one session it can show where your marks went.';
  static const firstCheck = 'Take a 10-question check';
  static const firstCheckHref = '/dashboard?mode=quick';
  static String ledgerLine(int net, int gained, int penalty, int questions) =>
      'Net $net marks from $questions answers: $gained gained, $penalty lost to wrong answers';
  static String leakLine(String chapter, int lost, int wrong, int n) => 'Biggest leak: $chapter, $lost marks lost, $wrong wrong of $n';
  static String paceLine(String median, int timed) => 'Pace: a typical question takes $median, over $timed timed answers';
  static const openCredits = 'Open credits';
  static const walletPaused = 'AI replies are paused. Record questions still work.';
  static const walletUnknown = 'credits not loaded';
  static const recordFree = thisCosts;
  static const thisIsFree = 'Free, from your record';
  static const thisCosts = "An AI service writes Mobi's replies\u00a0·\u00a01\u00a0credit";
  static String noCredits(String renew) => 'No credits left. They refill on $renew. Questions about your record stay free. Nothing is charged from here.';
  static const paused = 'Written replies are paused just now. Questions about your record stay free. Nothing is charged from here.';
  static const blocked = 'Mobi cannot write replies right now. Questions about your record stay free. Nothing is charged from here.';
  static String hint(String? label) => label == null ? 'Ask about your record' : 'Ask about $label';
  static const ask = 'Ask';
  static String reading(String? label) => label == null ? 'Reading your record' : 'Reading $label, your pick and the key';
  /// A written reply is the AI service's, not the record's (the consent sheet says so): the line never claims it is from the record.
  static const writing = 'Writing a reply';
  static const stillWriting = 'Still writing. Long questions take a little longer.';
  static String sourceRecord(int? questions, int sessions) => questions == null || questions == 0
      ? 'From your record · no credit used'
      : 'From your record · ${_plural(sessions, 'session')}, ${_plural(questions, 'answer')}';
  static String sourceWritten(String? label, int? charged, int? left) {
    final on = label == null ? 'Written reply' : 'Written reply on $label';
    final cost = switch (charged) {
      null => 'check your credits for the charge',
      0 => 'no credit used',
      1 => left == null ? '1 credit used' : '1 credit used, $left left',
      final n => left == null ? '$n credits used' : '$n credits used, $left left',
    };
    return '$on · $cost';
  }

  static const sourcePaused = 'Written replies paused · no credit used';

  /// The source of a mock's own breakdown, counted by the result screen.
  static String sourceFrom(String label) => 'From $label · no credit used';
}
