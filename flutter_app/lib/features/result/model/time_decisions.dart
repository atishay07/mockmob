/// Time and decisions on the result: how one paper's time and answer choices went, question by
/// question. A line-for-line port of the website's `data/time_decisions.js`: the same rules and the
/// same words, and `test/unit/result/time_decisions_test.dart` checks the same fixture sentences as
/// the website's `data/tests/time_decisions.test.mjs`.
///
/// Every fact comes from two places only: the device record of the session (visit and answer events
/// on the paper clock, `selectionMeta.recovery`), used only when the server found it matched the
/// submitted answers, and the paper's own time limit. Nothing is a forecast, a cause or another
/// student's number. Pure: no I/O, no clock.
library;

import '../../../core/models/json_helpers.dart';
import '../../../core/models/models.dart';

abstract final class TimeRules {
  /// A question counts as timed at 2 s or more (the repair's record line uses the same floor).
  static const minTimedMs = 2000;

  /// A median is named only over 10 or more timed questions.
  static const minTimedForMedian = 10;

  /// "That is 2.3 times the paper's pace" appears from twice the paper's time a question.
  static const longRatio = 2.0;

  /// A gap over 30 minutes (the app left open) is not counted as time on a question.
  static const maxGapMs = 30 * 60 * 1000;

  /// Rows in "Where your time went".
  static const longest = 5;

  /// Change rows shown before "Show all N changes" (all shown when there are 6 or fewer).
  static const changesShown = 5;
}

/// Answer-review states whose stored key may be the old one: their marks effect is left out.
const timeExcludedReviewStates = {'withdrawn', 'under_review', 'content_changed', 'key_changed_unverified', 'corrected'};

// Paper limits, as the website's data/test_modes.js sets them.
const _fixedPaperSec = {'full': 3600, 'nta': 3600};
const _quickSecPerQuestion = 60;
const _smartSecByDifficulty = {'easy': 45, 'medium': 60, 'hard': 90};
const _smartSecFallback = 60;

const _serverScoring = {'server_practice_v1', 'server_snapshot_v1'};
const _minus = '−';

String _plural(int n, String one, [String? many]) => '$n ${n == 1 ? one : (many ?? '${one}s')}';
String _marksWord(int n) => _plural(n, 'mark');
int _sec(num ms) => (ms / 1000).round();

/// "42s", "1m", "2m 05s".
String spentLabel(num seconds) {
  final s = seconds < 0 ? 0 : seconds.round();
  if (s < 60) return '${s}s';
  return s % 60 != 0 ? '${s ~/ 60}m ${(s % 60).toString().padLeft(2, '0')}s' : '${s ~/ 60}m';
}

/// The paper clock: "0:42", "12:05", "60:00".
String clockLabel(num seconds) {
  final s = seconds < 0 ? 0 : seconds.round();
  return '${s ~/ 60}:${(s % 60).toString().padLeft(2, '0')}';
}

String signedMarks(int n) => n > 0 ? '+$n' : (n < 0 ? '$_minus${-n}' : '0');

/// 2.25 -> "2.3", 2 -> "2", 12.4 -> "12".
String ratioLabel(double x) {
  if (x >= 10) return '${x.round()}';
  final tenths = (x * 10).round();
  return tenths % 10 == 0 ? '${tenths ~/ 10}' : '${tenths ~/ 10}.${tenths % 10}';
}

String _paperLength(int ms) => ms % 60000 == 0 ? _plural(ms ~/ 60000, 'minute') : spentLabel(ms / 1000);

/// Every sentence, word for word the website's TIME_COPY.
abstract final class TimeCopy {
  static const title = 'Time and decisions';
  static const sub = 'Where your time went and every answer you changed';
  static const clockNote = 'Clock times count from the start of the paper.';
  static String pace(String pace, String length, int total) => 'This paper gives you $pace a question: $length for ${_plural(total, 'question')}.';
  static String median(String median, int timed) => 'Your median was $median a question, over $timed timed questions.';
  static String split(List<String> parts) =>
      'You spent ${parts.length > 1 ? '${parts.sublist(0, parts.length - 1).join(', ')} and ${parts.last}' : parts.first}.';
  static String splitPart(String time, int n, String kind) =>
      '$time on ${_plural(n, kind == 'correct' ? 'right answer' : (kind == 'wrong' ? 'wrong answer' : 'blank question'))}';
  static const longestTitle = 'Where your time went';
  static String longestNote(String pace) => "The mark on each bar is the paper's $pace a question.";
  static String longestRatio(String x) => "$x times the paper's pace";
  static const verdict = {'correct': 'Right', 'wrong': 'Wrong', 'skipped': 'Blank'};
  static const changesTitle = 'Every answer you changed';
  static const changesNone = 'You did not change any answers in this paper.';
  static String changesLead(int count, int questions, int net) => count == 1
      ? 'You changed one answer. Net effect on your marks: ${signedMarks(net)}.'
      : 'You changed answers $count times across ${_plural(questions, 'question')}. Net effect on your marks: ${signedMarks(net)}.';
  static String changesGained(int n, int m) => '${_plural(n, 'change')} gained ${_marksWord(m)}';
  static String changesCost(int n, int m) => '${_plural(n, 'change')} cost ${_marksWord(m)}';
  static String changesNeutral(int n) => '${_plural(n, 'change')} made no difference';
  static String showAll(int n) => 'Show all $n changes';
  static const showFewer = 'Show fewer';
  static String changesHeld(int n) => n == 1
      ? '1 question under re-check or corrected is left out of the marks effect.'
      : '$n questions under re-check or corrected are left out of the marks effect.';
  static const rowLabel = 'Your time and picks';
  static String time(String spent) => '$spent on this question.';
  static String timePace(String spent, String pace) => '$spent on this question. The paper gives $pace a question.';
  static String timePaceMedian(String spent, String pace, String median) =>
      '$spent on this question. The paper gives $pace a question, and your median was $median.';
  static String timeMedian(String spent, String median) => '$spent on this question. Your median was $median.';
  static String ratio(String x) => " That is $x times the paper's pace.";
  static String visits(int n) => ' You opened it $n times.';
  static const underTwo = 'Less than 2 seconds on this question.';
  static const breakOnly = 'A break of over 30 minutes on this question is not counted.';
  static const lastOnly = 'The last question you opened. Time after your last tap is not recorded.';
  static String atLeast(String spent) => 'At least $spent';
  static const breakToo = ' A break of over 30 minutes is not counted.';
  static const notOpened = 'You did not open this question.';
  static String first(String l, String at) => 'Picked $l at $at.';
  static String changed(String l, String at, String gap) => 'Changed to $l at $at, $gap later.';
  static String cleared(String at, String gap) => 'Cleared it at $at, $gap later.';
  static String repicked(String l, String at, String gap) => 'Picked $l at $at, $gap later.';
  static String effectOne(int m) => m < 0
      ? 'That change cost ${_marksWord(-m)}.'
      : (m > 0 ? 'That change gained ${_marksWord(m)}.' : 'That change made no difference to your marks.');
  static String effectMany(int n, int net) => net < 0
      ? 'Together these $n changes cost ${_marksWord(-net)}.'
      : (net > 0 ? 'Together these $n changes gained ${_marksWord(net)}.' : 'Together these $n changes made no difference to your marks.');
  static const device = 'This earlier session was scored in your browser, so answer changes and timings are not available.';
  static const inconsistent = 'The record from your device did not match your submitted answers, so it is not used. Your score is unaffected.';
  static const notRecorded = 'Time and answer changes were not recorded for this paper. Your score is unaffected.';
}

/// The paper's time limit and its share per question.
class PaperPace {
  const PaperPace({required this.paperMs, required this.perQuestionMs, required this.total});
  final int paperMs;
  final int perQuestionMs;
  final int total;
}

/// The paper's limit: `selectionMeta.durationMinutes`, else the mode's fixed limit. Null when the
/// limit is not known (nothing is guessed).
PaperPace? paperPace(Attempt attempt) {
  final questions = attempt.questions;
  final total = questions.length;
  if (total == 0) return null;
  final mode = attempt.mode;
  final minutes = attempt.selectionMeta.durationMinutes;
  int? paperMs = minutes != null && minutes > 0 ? minutes * 60000 : null;
  paperMs ??= _fixedPaperSec[mode] == null ? null : _fixedPaperSec[mode]! * 1000;
  if (paperMs == null && mode == 'smart') {
    paperMs = questions.fold<int>(0, (s, q) => s + (_smartSecByDifficulty[q.difficulty] ?? _smartSecFallback)) * 1000;
  }
  if (paperMs == null && mode == 'quick') paperMs = total * _quickSecPerQuestion * 1000;
  if (paperMs == null) return null;
  return PaperPace(paperMs: paperMs, perQuestionMs: (paperMs / total).round(), total: total);
}

class _Event {
  const _Event({required this.qid, required this.at, required this.seq, required this.type, this.answer});
  final String qid;
  final double at;
  final int seq;
  final String type;
  final int? answer;
}

class _Change {
  const _Change({required this.qid, required this.markEffect});
  final String qid;
  final int markEffect;
}

/// One step of a question: the first pick, a change, a clear or a pick after a clear.
class PickStep {
  const PickStep({required this.kind, required this.answer, required this.at, this.gapSeconds});
  final String kind; // first | change | clear | repick
  final int? answer;
  final double at;
  final int? gapSeconds;
}

class TimeRow {
  const TimeRow({
    required this.qid,
    required this.number,
    required this.verdict,
    required this.opened,
    required this.ms,
    required this.visits,
    required this.ratio,
    required this.steps,
    required this.changeCount,
    required this.net,
    required this.held,
    required this.lines,
  });
  final String qid;
  final int number;

  /// `correct`, `wrong` or `skipped`.
  final String verdict;
  final bool opened;

  /// Time on screen; null when the question was never opened.
  final int? ms;
  final int visits;
  final double? ratio;
  final List<PickStep> steps;
  final int changeCount;
  final int net;

  /// Under re-check or corrected: times stay, the marks effect is left out.
  final bool held;

  /// "Your time and picks": the time line, the picks line and the effect line, each when it applies.
  final List<String> lines;
}

class LongRow {
  const LongRow({required this.number, required this.verdict, required this.ms, required this.time, this.ratio, this.ratioText});
  final int number;
  final String verdict;
  final int ms;
  final String time;
  final double? ratio;
  final String? ratioText;
}

class ChangePart {
  const ChangePart({required this.kind, required this.text});
  final String kind; // gained | cost | neutral
  final String text;
}

class ChangeRow {
  const ChangeRow({required this.number, required this.qid, required this.net, required this.text});
  final int number;
  final String qid;

  /// Null for a question under re-check or corrected.
  final int? net;
  final String text;
}

/// The whole read. [state] is `ready`, or `device`, `inconsistent` or `none` with only [message].
class TimeDecisions {
  const TimeDecisions._({
    required this.state,
    this.message,
    this.pace,
    this.rows = const [],
    this.longest = const [],
    this.paceLine,
    this.medianLine,
    this.splitLine,
    this.longestNote,
    this.changeCount = 0,
    this.changesLead,
    this.changeParts = const [],
    this.changesHeld,
    this.changeRows = const [],
  });

  final String state;
  final String? message;
  final PaperPace? pace;
  final List<TimeRow> rows;
  final List<LongRow> longest;
  final String? paceLine;
  final String? medianLine;
  final String? splitLine;
  final String? longestNote;
  final int changeCount;
  final String? changesLead;
  final List<ChangePart> changeParts;
  final String? changesHeld;
  final List<ChangeRow> changeRows;

  bool get isReady => state == 'ready';

  /// The row of one question, by id.
  TimeRow? rowFor(String qid) {
    for (final r in rows) {
      if (r.qid == qid) return r;
    }
    return null;
  }
}

double _median(List<int> values) {
  final v = [...values]..sort();
  final mid = v.length ~/ 2;
  return v.length.isOdd ? v[mid].toDouble() : (v[mid - 1] + v[mid]) / 2;
}

/// Builds the read for one attempt. [answerReviews] (question id to review state) leaves held or
/// corrected questions out of the marks effect. [letterOf] names the option at an index as the
/// screen shows it (position letters by default, as the website).
TimeDecisions buildTimeDecisions(
  Attempt attempt, {
  Map<String, String> answerReviews = const {},
  String Function(String qid, int index)? letterOf,
}) {
  final meta = attempt.selectionMeta;
  final rec = meta.raw['recovery'] is Map ? asJson(meta.raw['recovery']) : null;
  if (!_serverScoring.contains(meta.scoringVersion)) return const TimeDecisions._(state: 'device', message: TimeCopy.device);
  final telemetry = rec == null ? null : asString(rec['telemetry']);
  if (telemetry == 'inconsistent') return const TimeDecisions._(state: 'inconsistent', message: TimeCopy.inconsistent);
  final questions = attempt.questions;
  final timeline = <_Event>[
    for (final e in asJsonList(rec?['timeline']))
      if (asString(e['qid']) case final qid? when qid.isNotEmpty)
        if (asDouble(e['at']) case final at? when at.isFinite)
          if (asString(e['type']) != 'mark')
            _Event(qid: qid, at: at, seq: asInt(e['seq']) ?? 0, type: asStringOr(e['type'], ''), answer: asInt(e['answer'])),
  ]..sort((a, b) {
      final byAt = a.at.compareTo(b.at);
      return byAt != 0 ? byAt : a.seq.compareTo(b.seq);
    });
  if (telemetry != 'self_reported' || timeline.length < 2 || questions.isEmpty) {
    return const TimeDecisions._(state: 'none', message: TimeCopy.notRecorded);
  }
  final excluded = {
    for (final e in answerReviews.entries)
      if (timeExcludedReviewStates.contains(e.value)) e.key,
  };
  String letter(String qid, int i) => letterOf?.call(qid, i) ?? (i >= 0 && i < 8 ? 'ABCDEFGH'[i] : '${i + 1}');

  // Time on each question: the interval to the next event is credited to the question the event names.
  final dwell = <String, int>{};
  final visits = <String, int>{};
  final breaks = <String>{};
  String? last;
  for (var i = 0; i < timeline.length; i++) {
    final e = timeline[i];
    if (e.qid != last) {
      visits[e.qid] = (visits[e.qid] ?? 0) + 1;
      last = e.qid;
    }
    if (i + 1 >= timeline.length) continue;
    final gap = timeline[i + 1].at - e.at;
    if (gap >= 0 && gap <= TimeRules.maxGapMs) {
      dwell[e.qid] = (dwell[e.qid] ?? 0) + gap.round();
    } else if (gap > TimeRules.maxGapMs) {
      breaks.add(e.qid);
    }
  }

  final lastQid = timeline.last.qid; // time after the final event (until submit) is not in the record
  final pace = paperPace(attempt);
  final timed = [for (final ms in dwell.values) if (ms >= TimeRules.minTimedMs) ms];
  final medianMs = timed.length >= TimeRules.minTimedForMedian ? _median(timed) : null;
  final paceLabel = pace == null ? null : spentLabel(pace.perQuestionMs / 1000);
  final medianLabel = medianMs == null ? null : spentLabel(medianMs / 1000);

  final allChanges = [
    for (final c in asJsonList(asJson(rec?['observed'])['answerChanges']))
      if (asString(c['qid']) case final qid? when qid.isNotEmpty) _Change(qid: qid, markEffect: asInt(c['markEffect']) ?? 0),
  ];

  String stepText(String qid, PickStep s) {
    final at = clockLabel(_sec(s.at));
    final gap = spentLabel(s.gapSeconds ?? 0);
    return switch (s.kind) {
      'first' => TimeCopy.first(letter(qid, s.answer!), at),
      'clear' => TimeCopy.cleared(at, gap),
      'repick' => TimeCopy.repicked(letter(qid, s.answer!), at, gap),
      _ => TimeCopy.changed(letter(qid, s.answer!), at, gap),
    };
  }

  final rows = <TimeRow>[];
  for (var index = 0; index < questions.length; index++) {
    final q = questions[index];
    final d = attempt.detailFor(q.id);
    final verdict = d?.isCorrect == true ? 'correct' : (d?.isCorrect == false ? 'wrong' : 'skipped');
    final opened = visits.containsKey(q.id);
    final ms = opened ? (dwell[q.id] ?? 0) : null;
    final ratio = pace != null && ms != null && ms >= TimeRules.minTimedMs ? ms / pace.perQuestionMs : null;

    // Answer events in order; repeats of the same answer and leading clears left out.
    final steps = <PickStep>[];
    int? current;
    for (final e in timeline) {
      if (e.qid != q.id || e.type != 'answer') continue;
      final answer = e.answer;
      if (steps.isEmpty && answer == null) continue;
      if (steps.isNotEmpty && answer == current) continue;
      final prev = steps.isEmpty ? null : steps.last;
      final kind = prev == null ? 'first' : (answer == null ? 'clear' : (current == null ? 'repick' : 'change'));
      steps.add(PickStep(kind: kind, answer: answer, at: e.at, gapSeconds: prev == null ? null : _sec(e.at) - _sec(prev.at)));
      current = answer;
    }
    final changes = [for (final c in allChanges) if (c.qid == q.id) c];
    final held = excluded.contains(q.id);
    final net = changes.fold<int>(0, (s, c) => s + c.markEffect);

    String time;
    if (!opened) {
      time = TimeCopy.notOpened;
    } else if (ms! < TimeRules.minTimedMs) {
      time = breaks.contains(q.id) ? TimeCopy.breakOnly : (q.id == lastQid ? TimeCopy.lastOnly : TimeCopy.underTwo);
    } else {
      final spent = q.id == lastQid ? TimeCopy.atLeast(spentLabel(ms / 1000)) : spentLabel(ms / 1000);
      time = paceLabel != null && medianLabel != null
          ? TimeCopy.timePaceMedian(spent, paceLabel, medianLabel)
          : paceLabel != null
          ? TimeCopy.timePace(spent, paceLabel)
          : medianLabel != null
          ? TimeCopy.timeMedian(spent, medianLabel)
          : TimeCopy.time(spent);
      if (ratio != null && ratio >= TimeRules.longRatio) time += TimeCopy.ratio(ratioLabel(ratio));
      if (breaks.contains(q.id)) time += TimeCopy.breakToo;
    }
    if (opened && (visits[q.id] ?? 0) > 1) time += TimeCopy.visits(visits[q.id]!);
    final picks = steps.isEmpty ? null : steps.map((st) => stepText(q.id, st)).join(' ');
    final effect = changes.isNotEmpty && !held ? (changes.length == 1 ? TimeCopy.effectOne(net) : TimeCopy.effectMany(changes.length, net)) : null;
    rows.add(TimeRow(
      qid: q.id,
      number: index + 1,
      verdict: verdict,
      opened: opened,
      ms: ms,
      visits: visits[q.id] ?? 0,
      ratio: ratio,
      steps: steps,
      changeCount: changes.length,
      net: net,
      held: held,
      lines: [time, ?picks, ?effect],
    ));
  }

  // Whole paper.
  final split = <String>[];
  for (final kind in const ['correct', 'wrong', 'skipped']) {
    final group = [for (final r in rows) if (r.verdict == kind) r];
    if (group.isEmpty) continue;
    split.add(TimeCopy.splitPart(spentLabel(group.fold<int>(0, (s, r) => s + (r.ms ?? 0)) / 1000), group.length, kind));
  }
  final longRows = [for (final r in rows) if (r.ms != null && r.ms! >= TimeRules.minTimedMs) r]
    ..sort((a, b) {
      final byMs = b.ms!.compareTo(a.ms!);
      return byMs != 0 ? byMs : a.number.compareTo(b.number);
    });
  final longest = [
    for (final r in longRows.take(TimeRules.longest))
      LongRow(
        number: r.number,
        verdict: r.verdict,
        ms: r.ms!,
        time: spentLabel(r.ms! / 1000),
        ratio: r.ratio,
        ratioText: r.ratio != null && r.ratio! >= 1.05 ? TimeCopy.longestRatio(ratioLabel(r.ratio!)) : null,
      ),
  ];

  final counted = [for (final r in rows) if (r.changeCount > 0 && !r.held) r];
  final heldChanged = rows.where((r) => r.changeCount > 0 && r.held).length;
  final flat = [
    for (final r in counted)
      for (final c in allChanges)
        if (c.qid == r.qid) c.markEffect,
  ];
  final gained = [for (final m in flat) if (m > 0) m];
  final cost = [for (final m in flat) if (m < 0) m];
  final neutral = flat.where((m) => m == 0).length;
  final net = flat.fold<int>(0, (s, m) => s + m);
  final changeCount = rows.fold<int>(0, (s, r) => s + r.changeCount);

  return TimeDecisions._(
    state: 'ready',
    pace: pace,
    rows: rows,
    longest: longest,
    paceLine: pace == null ? null : TimeCopy.pace(paceLabel!, _paperLength(pace.paperMs), pace.total),
    medianLine: medianLabel == null ? null : TimeCopy.median(medianLabel, timed.length),
    splitLine: split.isEmpty ? null : TimeCopy.split(split),
    longestNote: paceLabel != null && longest.isNotEmpty ? TimeCopy.longestNote(paceLabel) : null,
    changeCount: changeCount,
    changesLead: changeCount == 0 ? TimeCopy.changesNone : (counted.isNotEmpty ? TimeCopy.changesLead(flat.length, counted.length, net) : null),
    changeParts: [
      if (gained.isNotEmpty) ChangePart(kind: 'gained', text: TimeCopy.changesGained(gained.length, gained.fold<int>(0, (s, m) => s + m))),
      if (cost.isNotEmpty) ChangePart(kind: 'cost', text: TimeCopy.changesCost(cost.length, -cost.fold<int>(0, (s, m) => s + m))),
      if (neutral > 0) ChangePart(kind: 'neutral', text: TimeCopy.changesNeutral(neutral)),
    ],
    changesHeld: heldChanged > 0 ? TimeCopy.changesHeld(heldChanged) : null,
    changeRows: [
      for (final r in rows)
        if (r.changeCount > 0) ChangeRow(number: r.number, qid: r.qid, net: r.held ? null : r.net, text: r.steps.map((st) => stepText(r.qid, st)).join(' ')),
    ],
  );
}
