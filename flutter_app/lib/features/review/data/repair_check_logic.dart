import '../../../core/api/api_error.dart';
import '../../../core/models/ai_credits.dart';
import '../../../core/models/repair_check.dart';

/// The words around "Check it held" and "Ask Mobi about Q3". Every sentence about an answer (the
/// verdict line, the explanation, the key) comes finished from the server; these are the words the
/// screen lays out around it, the same as the website's `data/repair_check_client.mjs`
/// (`CHECK_COPY`), so the two never disagree.
abstract final class CheckCopy {
  static const title = 'Check it held';
  static const loading = 'Finding a question you have not seen.';
  static const submit = 'Check my answer';
  static const marking = 'Marking your answer';
  static const firstCounts = 'Your first answer counts.';
  static const pickOne = 'Pick one option.';
  static const retry = 'Try again';
  static const another = 'Get another question';
  static const answeredEarlier = 'You answered this check earlier. The first answer counts.';
  static const explanation = 'Explanation';
  static const yourRule = 'Your rule';
  static const reviseLabel = 'Revise';
  static const loadFailed = 'The question could not be loaded. Nothing was charged.';
  static const markFailed = 'We could not confirm the mark. Try again. Your answer is counted once.';
  static const changed = 'That question was withdrawn before it was marked. Nothing was recorded.';
  static const waitAMoment = 'Please wait a moment before the next check.';

  // Ask Mobi, about the mistake being repaired (never the check question).
  static const askCost = 'One written reply';
  static const askPaused = 'Written replies are paused right now. Nothing is charged.';
  static const askEmpty = 'You have no credits left, so Mobi cannot write a reply. Nothing is charged.';
  static const askUnreadable = 'Your credits could not be read just now, so Mobi cannot write a reply. Nothing is charged.';

  /// The tag on an option of an answered check: words, never colour alone.
  static const tagKey = 'Key';
  static const tagPick = 'Your pick';
  static const tagBoth = 'Your pick and the key';

  /// "Ask Mobi about Q3": it names the mistake by its number on the paper.
  static String askLabel(int? number) => number != null && number > 0 ? 'Ask Mobi about Q$number' : 'Ask Mobi about this mistake';

  static String askSees(int? number) =>
      'Mobi sees ${number != null && number > 0 ? 'Q$number' : 'this mistake'}, your pick, the key and your rule, and nothing else about you.';

  /// The lead under the title. It says what the question is tied to only once the server has said.
  static String lead(String? basis) {
    final tie = switch (basis) {
      'concept' => ' on the same idea',
      'topic' => ' on the same topic',
      'chapter' => ' from the same chapter',
      _ => '',
    };
    return 'One new question$tie that you have not seen. It comes with this repair, so there is no extra credit.';
  }

  /// "Of the 41 questions in this chapter, 7 are new to you and can be used for a check." Both
  /// numbers or no line: a count never stands without its total.
  static String? poolLine(CheckPool? pool) {
    if (pool == null) return null;
    final unseen = pool.unseen;
    final total = pool.ofChapter;
    if (unseen < 0 || total < unseen || total < 1) return null;
    return 'Of the $total questions in this chapter, $unseen ${unseen == 1 ? 'is' : 'are'} new to you and can be used for a check.';
  }

  /// "This mistake comes back tomorrow." / "Both come back tomorrow: this mistake and the question
  /// you just missed." Null when Revise could not be written: it never promises a card that does
  /// not exist. The day is worked out again from the due day each time, so a stored answer opened
  /// days later does not still say "tomorrow" about a day that has passed.
  static String? reviseLine(CheckRevise? revise, {required bool right, required DateTime nowUtc}) {
    if (revise == null || !revise.scheduled) return null;
    final label = _reviseWhen(revise, nowUtc);
    final when = label == null ? 'soon' : (label == 'tomorrow' || label == 'today' ? label : 'on $label');
    return right ? 'This mistake comes back $when.' : 'Both come back $when: this mistake and the question you just missed.';
  }

  static const _weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  static const _months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  static final _day = RegExp(r'^(\d{4})-(\d{2})-(\d{2})$');

  static String? _reviseWhen(CheckRevise revise, DateTime nowUtc) {
    final due = revise.dueDay;
    final m = due == null ? null : _day.firstMatch(due);
    if (m == null) return revise.whenLabel;
    final dueDay = DateTime.utc(int.parse(m.group(1)!), int.parse(m.group(2)!), int.parse(m.group(3)!));
    // India days, like Revise itself.
    final ist = nowUtc.toUtc().add(const Duration(hours: 5, minutes: 30));
    final today = DateTime.utc(ist.year, ist.month, ist.day);
    if (!dueDay.isAfter(today)) return 'today';
    if (dueDay == today.add(const Duration(days: 1))) return 'tomorrow';
    return '${_weekdays[dueDay.weekday - 1]} ${dueDay.day} ${_months[dueDay.month - 1]}';
  }

  /// The receipt under an answered check: what the mistake cost, in which paper, and how many checks
  /// held. "Fixed. This trap cost you 6 marks in Mock 3. Held 1 of 1." A miss says "Not yet." and
  /// the same facts. The marks clause is left out when the scheme is not known (never guessed), and
  /// "trap" only when the repair named one; otherwise it says "mistake".
  static String receipt({required bool right, required String source, required int? marks, required bool trap, required int held, required int answered}) {
    final head = right ? 'Fixed.' : 'Not yet.';
    final thing = trap ? 'This trap' : 'This mistake';
    final cost = marks == null ? '$thing was in $source.' : '$thing cost you ${marks == 1 ? '1 mark' : '$marks marks'} in $source.';
    return '$head $cost Held $held of $answered.';
  }

  /// The tag for an answered row, or null.
  static String? tag({required bool isKey, required bool isPick}) => isKey && isPick ? tagBoth : (isKey ? tagKey : (isPick ? tagPick : null));
}

/// How many of the checks answered so far held. Only checks the student has answered count, and
/// only the ones this tally is given: a check never answered is not a miss, and a repair that
/// offered none counts for nothing.
class HeldTally {
  const HeldTally({required this.held, required this.answered});

  /// Answered right the first time.
  final int held;

  /// Answered at all.
  final int answered;

  /// Tallies the answered ones among [views].
  factory HeldTally.of(Iterable<CheckView> views) {
    var held = 0;
    var answered = 0;
    for (final v in views) {
      final r = v.result;
      if (!v.answered || r == null) continue;
      answered++;
      if (r.right) held++;
    }
    return HeldTally(held: held, answered: answered);
  }
}

/// What the receipt of one check needs from the repair it belongs to: the paper's name, what the
/// mistake cost, whether the repair named a trap, and the checks of the same run to tally.
class CheckReceipt {
  const CheckReceipt({required this.source, required this.marks, required this.trap, required this.runKeys});

  final String source;

  /// Marks the mistake cost in its paper, from the marking scheme alone; null when unknown.
  final int? marks;
  final bool trap;

  /// The (attemptId, questionId) of every mistake in this run, whose checks are counted.
  final List<({String attemptId, String questionId})> runKeys;
}

/// What the repair says about Ask Mobi, from the AI wallet. The price is promised only while
/// written replies can be bought: [ask] is true when the link shows (the wallet is available), and
/// [line] is the sentence for the screen. Paused, empty or unreadable: the link goes, and the line
/// says so and that nothing is charged, never a price and never "free". [pending] is the wallet not
/// read yet: nothing shows, so nothing is shown and then taken back.
class AskOffer {
  const AskOffer({required this.ask, this.pending = false, this.line});

  /// From the credits read, or null when it has not arrived.
  factory AskOffer.of(AiCredits? credits) {
    if (credits == null) return const AskOffer(ask: false, pending: true);
    final wallet = credits.wallet;
    final left = wallet == null || wallet.known == false ? null : (wallet.total ?? wallet.spendable);
    switch (credits.state) {
      case 'available':
        if (left == null) return const AskOffer(ask: false, line: CheckCopy.askUnreadable);
        return AskOffer(ask: true, line: '${CheckCopy.askCost} uses 1 credit. You have $left.');
      case 'empty':
        return const AskOffer(ask: false, line: CheckCopy.askEmpty);
      case 'paused':
        return const AskOffer(ask: false, line: CheckCopy.askPaused);
      default:
        return const AskOffer(ask: false, line: CheckCopy.askUnreadable);
    }
  }

  final bool ask;
  final bool pending;
  final String? line;

  /// A wallet read that failed with nothing cached.
  static const unreadable = AskOffer(ask: false, line: CheckCopy.askUnreadable);
}

/// Where the check screen is.
enum CheckPhase {
  /// Not started: the same first frame as [loading].
  idle,
  loading,

  /// Nothing to offer, with its reason line (and a retry only where trying again can help).
  none,

  /// The question could not be loaded (offline, slow, rate limited): retry.
  loadError,
  ready,
  sending,
  answered,
}

/// All that the check section needs to draw. Immutable.
class CheckView {
  const CheckView({
    this.phase = CheckPhase.idle,
    this.question,
    this.pool,
    this.pick,
    this.result,
    this.replayed = false,
    this.message,
    this.canRetry = false,
    this.error,
    this.errorCanRetry = false,
    this.refetch = false,
  });

  final CheckPhase phase;
  final CheckQuestion? question;
  final CheckPool? pool;

  /// The option the student has picked, before submitting.
  final int? pick;
  final CheckResult? result;

  /// The answer was stored earlier.
  final bool replayed;

  /// The line of a none or load-error phase.
  final String? message;
  final bool canRetry;

  /// A failed submit: the line, and whether the same answer can be sent again.
  final String? error;
  final bool errorCanRetry;

  /// The question was withdrawn: the only action is another question, and the old rows stop
  /// taking taps.
  final bool refetch;

  bool get answered => phase == CheckPhase.answered;
  bool get sending => phase == CheckPhase.sending;

  CheckView copyWith({CheckPhase? phase, int? pick, bool clearPick = false, String? error, bool clearError = false, bool? errorCanRetry}) => CheckView(
        phase: phase ?? this.phase,
        question: question,
        pool: pool,
        pick: clearPick ? null : (pick ?? this.pick),
        result: result,
        replayed: replayed,
        message: message,
        canRetry: canRetry,
        error: clearError ? null : (error ?? this.error),
        errorCanRetry: errorCanRetry ?? this.errorCanRetry,
        refetch: refetch,
      );
}

/// What the screen shows after the question was asked for (GET). Pure, so a test covers every
/// answer the server and the network can give. Every failure says nothing was charged: nothing
/// ever is.
CheckView planLoaded(CheckLoad load) => switch (load) {
      CheckReady(:final question) => CheckView(phase: CheckPhase.ready, question: question, pool: question.pool),
      CheckStored(:final question, :final result) => CheckView(phase: CheckPhase.answered, question: question, result: result, replayed: true),
      CheckNone(:final line, :final canRetry) => CheckView(phase: CheckPhase.none, message: line, canRetry: canRetry),
    };

/// The screen after a GET that failed.
CheckView planLoadFailed(ApiError e) {
  CheckView none(String line, {bool retry = false}) => CheckView(phase: CheckPhase.none, message: line, canRetry: retry);
  CheckView failed(String line) => CheckView(phase: CheckPhase.loadError, message: line, canRetry: true);
  if (e.code == ApiCodes.lookupFailed) return none(e.serverMessage ?? RepairCheckReasons.lookupFailed, retry: true);
  if (e.isOffline) return failed(CheckCopy.loadFailed);
  if (e.kind == ApiErrorKind.rateLimited) return failed(CheckCopy.waitAMoment);
  if (e.code == ApiCodes.repairFirst) return none(e.serverMessage ?? RepairCheckReasons.repairFirst);
  switch (e.status) {
    case 401 || 404 || 409 || 422:
      // The check follows the repair's own eligibility: nothing to retry here.
      return none(RepairCheckReasons.checkUnavailable);
  }
  return failed(CheckCopy.loadFailed);
}

/// A failed submit: what the line says and what the student can do next. The question and the
/// pick stay on screen.
class AnswerFailure {
  const AnswerFailure({required this.message, required this.canRetry, required this.refetch});

  final String message;

  /// The same answer can be sent again (the same request id: it counts once).
  final bool canRetry;

  /// The question is no longer on offer: ask for another.
  final bool refetch;
}

AnswerFailure planAnswerFailed(ApiError e) {
  const markFailed = AnswerFailure(message: CheckCopy.markFailed, canRetry: true, refetch: false);
  if (e.isOffline) return markFailed;
  final server = e.serverMessage;
  switch (e.code) {
    case ApiCodes.checkChanged:
      return AnswerFailure(message: server ?? CheckCopy.changed, canRetry: false, refetch: true);
    case ApiCodes.invalidPick:
      // "Pick one of the four options." can be fixed by picking; "That is not the question that was
      // offered" cannot, so the way on is another question.
      final plainPick = server == null || server == RepairCheckReasons.invalidPick;
      return AnswerFailure(message: server ?? RepairCheckReasons.invalidPick, canRetry: plainPick, refetch: !plainPick);
    case ApiCodes.repairFirst:
      return AnswerFailure(message: server ?? RepairCheckReasons.repairFirst, canRetry: false, refetch: false);
  }
  if (e.kind == ApiErrorKind.rateLimited) return const AnswerFailure(message: CheckCopy.waitAMoment, canRetry: true, refetch: false);
  switch (e.status) {
    case 401 || 404 || 422:
      return const AnswerFailure(message: CheckCopy.markFailed, canRetry: false, refetch: false);
  }
  return markFailed;
}
