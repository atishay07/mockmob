import '../../../core/models/attempt.dart';
import '../../../core/models/json_helpers.dart';

/// What one finished practice shows, ported from the website's `data/session_recovery.js`
/// (`analyseSession`), so the app and the site say the same thing about the same attempt.
///
/// Every figure is an observation under the session's key (+5 right, -1 wrong, 0 blank). The
/// attempt's own `correct`, `wrong` and `unattempted` stay the authority; nothing here is a
/// forecast. Timings and answer changes exist only when the server marked the session's
/// telemetry `self_reported`; otherwise they are absent, never guessed.
class SessionAnalysis {
  const SessionAnalysis({
    required this.dwellMs,
    required this.changes,
    required this.observations,
    required this.telemetry,
  });

  /// Wrong answers that took less than this were picked fast (the website's 20 seconds).
  static const int quickPickMs = 20000;

  factory SessionAnalysis.of(Attempt attempt) {
    final recovery = asJson(attempt.selectionMeta.raw['recovery']);
    final telemetry = asString(recovery['telemetry']) ?? 'none';
    final usable = telemetry == 'self_reported';
    final events = usable ? asJsonList(recovery['timeline']) : const <Json>[];
    final dwell = dwellByQuestion(events);
    final changes = usable
        ? [
            for (final c in asJsonList(asJson(recovery['observed'])['answerChanges']))
              if (asStringOr(c['qid'], '').isNotEmpty) AnswerChange.fromJson(c),
          ]
        : const <AnswerChange>[];

    // Per question: the event dwell when the timeline holds it, else the detail's own time.
    final ms = <String, int>{};
    for (final d in attempt.details) {
      final t = dwell == null ? d.timeMs : dwell[d.qid];
      if (t != null) ms[d.qid] = t;
    }

    final numbers = {for (var i = 0; i < attempt.details.length; i++) attempt.details[i].qid: i + 1};
    final chapterOf = {for (final q in attempt.questions) q.id: q.chapter ?? 'Chapter'};
    return SessionAnalysis(
      dwellMs: ms,
      changes: changes,
      telemetry: telemetry,
      observations: _observations(attempt, ms, changes, numbers, chapterOf),
    );
  }

  /// Milliseconds on each question, when known.
  final Map<String, int> dwellMs;
  final List<AnswerChange> changes;
  final List<Observation> observations;

  /// `self_reported`, `inconsistent`, `invalid` or `none`.
  final String telemetry;

  bool changed(String qid) => changes.any((c) => c.qid == qid);

  int get helped => changes.where((c) => c.markEffect > 0).fold(0, (s, c) => s + c.markEffect);
  int get hurt => changes.where((c) => c.markEffect < 0).fold(0, (s, c) => s - c.markEffect);
}

/// One recorded answer change: from one option to another, and what it did to the marks.
class AnswerChange {
  const AnswerChange({required this.qid, required this.markEffect, this.from, this.to});

  factory AnswerChange.fromJson(Json j) => AnswerChange(
    qid: asStringOr(j['qid'], ''),
    markEffect: asInt(j['markEffect']) ?? 0,
    from: asInt(j['before']),
    to: asInt(j['after']),
  );

  final String qid;
  final int markEffect;
  final int? from;
  final int? to;
}

enum ObservationKind { changes, quick, chapter, blank }

enum ObservationTone { good, bad, neutral }

/// One fact, its plain consequence, one thing to do, and the question numbers behind it (the
/// "Show me" that every claim must carry).
class Observation {
  const Observation({
    required this.kind,
    required this.tone,
    required this.label,
    required this.headline,
    required this.detail,
    required this.tip,
    required this.questions,
  });

  final ObservationKind kind;
  final ObservationTone tone;
  final String label;
  final String headline;
  final String detail;
  final String tip;

  /// 1-based question numbers.
  final List<int> questions;
}

/// Seconds on each question from the device's visit and answer events: the interval to the next
/// event is credited to the question the event named. Null with fewer than two events.
Map<String, int>? dwellByQuestion(List<Json> timeline) {
  final events = [
    for (final e in timeline)
      if (asString(e['qid']) != null && asInt(e['at']) != null) e,
  ]..sort((a, b) {
      final at = asInt(a['at'])!.compareTo(asInt(b['at'])!);
      return at != 0 ? at : (asInt(a['seq']) ?? 0).compareTo(asInt(b['seq']) ?? 0);
    });
  if (events.length < 2) return null;
  final dwell = <String, int>{};
  for (var i = 0; i < events.length - 1; i++) {
    final gap = asInt(events[i + 1]['at'])! - asInt(events[i]['at'])!;
    if (gap > 0) dwell.update(asString(events[i]['qid'])!, (v) => v + gap, ifAbsent: () => gap);
  }
  return dwell;
}

/// "42s" or "1m 05s", as the website formats it.
String formatDwell(int ms) {
  final s = (ms / 1000).round();
  return s < 60 ? '${s}s' : '${s ~/ 60}m ${(s % 60).toString().padLeft(2, '0')}s';
}

String _plural(int n, String word) => '$n $word${n == 1 ? '' : 's'}';

List<Observation> _observations(
  Attempt attempt,
  Map<String, int> ms,
  List<AnswerChange> changes,
  Map<String, int> numbers,
  Map<String, String> chapterOf,
) {
  final out = <Observation>[];
  final details = attempt.details;
  final wrong = details.where((d) => d.isCorrect == false).toList();
  final blank = details.where((d) => d.isCorrect == null).toList();

  final helped = changes.where((c) => c.markEffect > 0).fold(0, (s, c) => s + c.markEffect);
  final hurt = changes.where((c) => c.markEffect < 0).fold(0, (s, c) => s - c.markEffect);
  final rightToWrong = changes.where((c) => c.markEffect == -6).length;
  List<int> nums(Iterable<String> qids) => [for (final q in qids) ?numbers[q]];

  if (changes.isNotEmpty && hurt > 0) {
    out.add(
      Observation(
        kind: ObservationKind.changes,
        tone: ObservationTone.bad,
        label: 'Changed answers',
        headline: rightToWrong > 0
            ? 'You changed ${rightToWrong == 1 ? 'a right answer' : '$rightToWrong right answers'} to wrong'
            : 'Changing answers cost you $hurt marks',
        detail: '${_plural(changes.length, 'change')} this session: −$hurt from the ones that hurt${helped > 0 ? ', +$helped from the ones that helped' : ''}.',
        tip: 'Switch only when you spot a specific error, not a new feeling.',
        questions: nums(changes.where((c) => c.markEffect < 0).map((c) => c.qid)),
      ),
    );
  } else if (changes.isNotEmpty && helped > 0) {
    out.add(
      Observation(
        kind: ObservationKind.changes,
        tone: ObservationTone.good,
        label: 'Changed answers',
        headline: 'Your second looks earned +$helped',
        detail: '${_plural(changes.length, 'change')} this session and none cost marks.',
        tip: 'Keep revisiting flagged questions before you submit.',
        questions: nums(changes.map((c) => c.qid)),
      ),
    );
  }

  final wrongTimed = [for (final d in wrong) if (ms[d.qid] != null) d];
  final quickWrong = [for (final d in wrongTimed) if (ms[d.qid]! < SessionAnalysis.quickPickMs) d];
  if (wrongTimed.length >= 2 && quickWrong.length / wrongTimed.length >= 0.5) {
    out.add(
      Observation(
        kind: ObservationKind.quick,
        tone: ObservationTone.bad,
        label: 'Rushed picks',
        headline: '${quickWrong.length} of your ${wrongTimed.length} wrong answers took under ${SessionAnalysis.quickPickMs ~/ 1000} seconds',
        detail: 'Fast wrong answers usually mean the question was matched to a familiar pattern on the first read.',
        tip: 'Find what is actually being asked before you look at the options.',
        questions: nums(quickWrong.map((d) => d.qid)),
      ),
    );
  }

  // The chapter that lost the most marks (6 per wrong, 5 per blank), first asked breaks ties.
  final lost = <String, int>{};
  final wrongIn = <String, int>{};
  final firstIn = <String, int>{};
  for (var i = 0; i < details.length; i++) {
    final d = details[i];
    if (d.isCorrect == true) continue;
    final chapter = chapterOf[d.qid] ?? 'Chapter';
    lost.update(chapter, (v) => v + (d.isCorrect == false ? 6 : 5), ifAbsent: () => d.isCorrect == false ? 6 : 5);
    if (d.isCorrect == false) wrongIn.update(chapter, (v) => v + 1, ifAbsent: () => 1);
    firstIn.putIfAbsent(chapter, () => i);
  }
  final ranked = lost.keys.toList()..sort((a, b) => lost[b]! != lost[a]! ? lost[b]!.compareTo(lost[a]!) : firstIn[a]!.compareTo(firstIn[b]!));
  if (ranked.isNotEmpty) {
    final top = ranked.first;
    final n = wrongIn[top] ?? 0;
    if (n >= 2 && wrong.length >= 3 && n / wrong.length >= 0.4) {
      out.add(
        Observation(
          kind: ObservationKind.chapter,
          tone: ObservationTone.bad,
          label: 'One weak chapter',
          headline: '$n of your ${wrong.length} mistakes were in $top',
          detail: 'This chapter is your biggest single leak in this session.',
          tip: 'Repair these first; they may share one idea.',
          questions: nums(wrong.where((d) => chapterOf[d.qid] == top).map((d) => d.qid)),
        ),
      );
    }
  }

  if (blank.isNotEmpty) {
    out.add(
      Observation(
        kind: ObservationKind.blank,
        tone: ObservationTone.neutral,
        label: 'Blanks',
        headline: '${blank.length == 1 ? 'One question' : '${blank.length} questions'} left blank',
        detail: 'A blank costs nothing but earns nothing. The record cannot tell whether time ran out.',
        tip: 'Under +5/−1, once you can rule out one option, a guess is worth +1 on average.',
        questions: nums(blank.map((d) => d.qid)),
      ),
    );
  }
  return out;
}
