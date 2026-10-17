import '../../../core/models/models.dart';
import '../copy.dart';

/// How one question ended, as the server marked it.
enum ReelResult { right, wrong, blank, held }

/// Why the reel stops on a question.
enum ReelMomentKind {
  /// The server's own `changed_from_right` group: the first pick was the key, the final one was not.
  changedFromRight,

  /// A long stall: the server's `long_stay` group, or (older servers) a time far above the paper's
  /// own middle time.
  stall,

  /// The answer was changed (recovery record) and ended wrong; the first pick is not known, so the
  /// line never says it was right.
  changedToWrong,
}

/// One question of the paper, in paper order.
class ReelQuestion {
  const ReelQuestion({
    required this.number,
    required this.qid,
    required this.result,
    this.chapter,
    this.timeSec,
    this.changed = false,
  });

  /// 1-based number in this paper.
  final int number;
  final String qid;
  final ReelResult result;
  final String? chapter;

  /// Seconds spent, or null when the record does not say (or the timing is not reliable).
  final int? timeSec;

  /// The answer was changed at least once.
  final bool changed;

  /// Marks this question adds to the running score (+5 right, -1 wrong, 0 blank or held).
  int get marks => switch (result) {
        ReelResult.right => 5,
        ReelResult.wrong => -1,
        ReelResult.blank || ReelResult.held => 0,
      };
}

/// A real moment the reel pauses on.
class ReelMoment {
  const ReelMoment({required this.index, required this.kind, required this.line});

  /// Index into [PaperReelModel.questions].
  final int index;
  final ReelMomentKind kind;

  /// "Q22: you changed a right answer to wrong."
  final String line;
}

/// The chapter where the most marks went.
class ReelChapter {
  const ReelChapter({required this.name, required this.lost, required this.max, required this.wrong, required this.blank, required this.qids});

  final String name;

  /// Marks missed against full marks (a wrong costs 6: the 5 not earned and the 1 taken).
  final int lost;
  final int max;
  final int wrong;
  final int blank;

  /// The wrong and blank questions of the chapter, in paper order.
  final List<String> qids;
}

/// What the one closing key does.
enum ReelMoveKind { repairChapter, reviewMistakes, nextMock }

class ReelNextMove {
  const ReelNextMove({required this.kind, required this.label, this.chapter, this.qids = const []});

  final ReelMoveKind kind;

  /// The key's words: "Repair the 3 wrong in Partnership".
  final String label;
  final String? chapter;
  final List<String> qids;
}

/// The phase a moment of the reel is in.
enum ReelPhase { intro, sheet, pause, chapter, end }

/// What the reel shows at one moment. Pure: [PaperReelModel.frameAt] builds it from a time.
class ReelFrame {
  const ReelFrame({
    required this.phase,
    required this.revealed,
    required this.marks,
    this.current,
    this.moment,
    this.phaseT = 0,
  });

  final ReelPhase phase;

  /// Questions lit so far (bubbles `0 .. revealed - 1`).
  final int revealed;

  /// The running score shown by the counter.
  final int marks;

  /// The question in focus, or null (intro, chapter, end).
  final int? current;

  /// The moment held on, during [ReelPhase.pause].
  final ReelMoment? moment;

  /// Progress through the current phase, 0 to 1.
  final double phaseT;

  bool get isEnd => phase == ReelPhase.end;
}

/// One stretch of the timeline.
class ReelSegment {
  const ReelSegment({required this.phase, required this.startMs, required this.endMs, this.index, this.moment});

  final ReelPhase phase;
  final int startMs;
  final int endMs;

  /// The question this segment lights (sheet) or holds (pause).
  final int? index;
  final ReelMoment? moment;

  int get lengthMs => endMs - startMs;
}

/// The paper played back (owner item D29, one engine with the meaningful replay of D17): built
/// only from the attempt detail the app already loads. Every number on screen is the server's:
/// the results per question, the final marks, the changed-from-right and long-stay groups of the
/// Mistake Lab. Nothing is invented, and there is no marking wait: the paper is already marked.
class PaperReelModel {
  PaperReelModel._({
    required this.subject,
    required this.questions,
    required this.moments,
    required this.finalMarks,
    required this.maxMarks,
    required this.chapter,
    required this.nextMove,
    required this.perQuestionScore,
  }) : segments = _timeline(questions.length, moments);

  /// Builds the reel, or returns null when the paper has nothing to play (no questions).
  static PaperReelModel? tryFrom(AttemptDetail detail, {String? subjectLabel}) {
    final a = detail.attempt;
    final details = {for (final d in a.details) d.qid: d};
    final held = detail.heldQuestionIds.toSet();
    final changedQids = a.selectionMeta.recovery?.answerChangeQids.toSet() ?? const <String>{};
    final timingOk = detail.recap?.timingReliable != false;

    // Paper order: the snapshot, else the details as they came.
    final order = a.questions.isNotEmpty
        ? [for (final q in a.questions) (qid: q.id, chapter: _clean(q.chapter))]
        : [for (final d in a.details) (qid: d.qid, chapter: null as String?)];
    if (order.isEmpty) return null;

    final questions = <ReelQuestion>[];
    for (var i = 0; i < order.length; i++) {
      final qid = order[i].qid;
      final d = details[qid];
      final result = held.contains(qid)
          ? ReelResult.held
          : switch (d?.isCorrect) {
              true => ReelResult.right,
              false => ReelResult.wrong,
              null => ReelResult.blank,
            };
      final ms = d?.timeMs;
      questions.add(ReelQuestion(
        number: i + 1,
        qid: qid,
        result: result,
        chapter: order[i].chapter,
        timeSec: timingOk && ms != null && ms > 0 ? (ms / 1000).round() : null,
        changed: changedQids.contains(qid),
      ));
    }

    final sum = questions.fold<int>(0, (s, q) => s + q.marks);
    final moments = _moments(questions, detail.lab);
    final chapter = _costliest(questions);
    return PaperReelModel._(
      subject: subjectLabel ?? a.subject,
      questions: questions,
      moments: moments,
      finalMarks: a.marks,
      maxMarks: a.maxMarks,
      chapter: chapter,
      nextMove: _nextMove(questions, chapter),
      // The running score adds up per question only when it lands on the server's marks; otherwise
      // the counter runs evenly to the server's number and never shows a sum it cannot stand by.
      perQuestionScore: sum == a.marks,
    );
  }

  final String subject;
  final List<ReelQuestion> questions;
  final List<ReelMoment> moments;
  final int finalMarks;
  final int maxMarks;
  final ReelChapter? chapter;
  final ReelNextMove nextMove;
  final bool perQuestionScore;
  final List<ReelSegment> segments;

  int get totalMs => segments.last.endMs;

  /// The length said on the entry cards, in whole seconds.
  int get seconds => (totalMs / 1000).round();

  int get right => questions.where((q) => q.result == ReelResult.right).length;
  int get wrong => questions.where((q) => q.result == ReelResult.wrong).length;
  int get blank => questions.where((q) => q.result == ReelResult.blank).length;

  // Timeline budget: about 20 s with three moments, never under 15 s.
  static const introMs = 1000;
  static const sheetMs = 10000;
  static const pauseMs = 1800;
  static const chapterMs = 2800;
  static const endMs = 1200;
  static const maxMoments = 3;

  static List<ReelSegment> _timeline(int n, List<ReelMoment> moments) {
    final out = <ReelSegment>[];
    var t = 0;
    out.add(ReelSegment(phase: ReelPhase.intro, startMs: 0, endMs: t += introMs));
    final byIndex = {for (final m in moments) m.index: m};
    // Each question gets an even share of the sheet time; the pauses come on top.
    for (var i = 0; i < n; i++) {
      final len = ((i + 1) * sheetMs / n).round() - (i * sheetMs / n).round();
      out.add(ReelSegment(phase: ReelPhase.sheet, startMs: t, endMs: t += len, index: i));
      final m = byIndex[i];
      if (m != null) out.add(ReelSegment(phase: ReelPhase.pause, startMs: t, endMs: t += pauseMs, index: i, moment: m));
    }
    out.add(ReelSegment(phase: ReelPhase.chapter, startMs: t, endMs: t += chapterMs));
    out.add(ReelSegment(phase: ReelPhase.end, startMs: t, endMs: t += endMs));
    return out;
  }

  /// What the reel shows [ms] milliseconds in. Past the end it is the end state (reduced motion and
  /// skip both read `frameAt(totalMs)`).
  ReelFrame frameAt(num ms) {
    if (ms >= totalMs) return ReelFrame(phase: ReelPhase.end, revealed: questions.length, marks: finalMarks, phaseT: 1);
    final t = ms < 0 ? 0 : ms;
    for (final s in segments) {
      if (t < s.endMs) {
        final pt = s.lengthMs == 0 ? 1.0 : ((t - s.startMs) / s.lengthMs).clamp(0.0, 1.0);
        switch (s.phase) {
          case ReelPhase.intro:
            return ReelFrame(phase: ReelPhase.intro, revealed: 0, marks: 0, phaseT: pt);
          case ReelPhase.sheet:
            final i = s.index!;
            return ReelFrame(phase: ReelPhase.sheet, revealed: i + 1, marks: marksAfter(i + 1, t), current: i, phaseT: pt);
          case ReelPhase.pause:
            final i = s.index!;
            return ReelFrame(phase: ReelPhase.pause, revealed: i + 1, marks: marksAfter(i + 1, t), current: i, moment: s.moment, phaseT: pt);
          case ReelPhase.chapter:
          case ReelPhase.end:
            return ReelFrame(phase: s.phase, revealed: questions.length, marks: finalMarks, phaseT: pt);
        }
      }
    }
    return ReelFrame(phase: ReelPhase.end, revealed: questions.length, marks: finalMarks, phaseT: 1);
  }

  /// The running score once [revealed] questions are lit.
  int marksAfter(int revealed, [num? ms]) {
    if (revealed >= questions.length) return finalMarks;
    if (perQuestionScore) return questions.take(revealed).fold<int>(0, (s, q) => s + q.marks);
    return (finalMarks * revealed / questions.length).round();
  }

  static String? _clean(String? s) {
    final t = s?.trim();
    return t == null || t.isEmpty ? null : t;
  }

  static List<ReelMoment> _moments(List<ReelQuestion> qs, MistakeLab? lab) {
    final byNumber = {for (var i = 0; i < qs.length; i++) qs[i].number: i};
    final found = <int, ReelMoment>{};

    // 1. Right answers changed to wrong: the server's own group, never a guess.
    for (final n in lab?.numbersOf(LabGroup.changedFromRight) ?? const <int>[]) {
      final i = byNumber[n];
      if (i == null || qs[i].result != ReelResult.wrong) continue;
      found[i] = ReelMoment(index: i, kind: ReelMomentKind.changedFromRight, line: ReelCopy.changedFromRight(n));
    }

    // 2. The longest stall: the server's long-stay group, else far above the middle time.
    final stalls = <int>[
      for (final n in lab?.numbersOf(LabGroup.longStay) ?? const <int>[])
        ?byNumber[n],
    ];
    if (stalls.isEmpty) {
      final times = [for (final q in qs) if (q.timeSec != null) q.timeSec!]..sort();
      if (times.length >= qs.length / 2 && times.isNotEmpty) {
        final median = times[times.length ~/ 2];
        final bar = (median * 3).clamp(120, 1 << 30);
        for (var i = 0; i < qs.length; i++) {
          if ((qs[i].timeSec ?? 0) >= bar) stalls.add(i);
        }
      }
    }
    stalls.removeWhere((i) => found.containsKey(i));
    if (stalls.isNotEmpty) {
      stalls.sort((x, y) => (qs[y].timeSec ?? 0).compareTo(qs[x].timeSec ?? 0));
      final i = stalls.first;
      found[i] = ReelMoment(index: i, kind: ReelMomentKind.stall, line: ReelCopy.stall(qs[i].number, qs[i].timeSec, qs[i].result));
    }

    // 3. Changed and ended wrong, first pick unknown.
    for (var i = 0; i < qs.length; i++) {
      if (found.containsKey(i) || !qs[i].changed || qs[i].result != ReelResult.wrong) continue;
      found[i] = ReelMoment(index: i, kind: ReelMomentKind.changedToWrong, line: ReelCopy.changedToWrong(qs[i].number));
    }

    // Keep the strongest three, then play them in paper order.
    final ranked = found.values.toList()
      ..sort((x, y) {
        final k = x.kind.index.compareTo(y.kind.index);
        return k != 0 ? k : x.index.compareTo(y.index);
      });
    return ranked.take(maxMoments).toList()..sort((x, y) => x.index.compareTo(y.index));
  }

  static ReelChapter? _costliest(List<ReelQuestion> qs) {
    final lost = <String, int>{};
    final max = <String, int>{};
    final wrong = <String, int>{};
    final blank = <String, int>{};
    final qids = <String, List<String>>{};
    for (final q in qs) {
      final c = q.chapter;
      if (c == null || q.result == ReelResult.held) continue;
      max[c] = (max[c] ?? 0) + 5;
      final cost = switch (q.result) { ReelResult.wrong => 6, ReelResult.blank => 5, _ => 0 };
      if (cost == 0) continue;
      lost[c] = (lost[c] ?? 0) + cost;
      if (q.result == ReelResult.wrong) wrong[c] = (wrong[c] ?? 0) + 1;
      if (q.result == ReelResult.blank) blank[c] = (blank[c] ?? 0) + 1;
      (qids[c] ??= []).add(q.qid);
    }
    if (lost.isEmpty) return null;
    // Most marks lost; a tie goes to the chapter met first in the paper.
    String? best;
    for (final c in lost.keys) {
      if (best == null || lost[c]! > lost[best]!) best = c;
    }
    return ReelChapter(name: best!, lost: lost[best]!, max: max[best]!, wrong: wrong[best] ?? 0, blank: blank[best] ?? 0, qids: qids[best]!);
  }

  static ReelNextMove _nextMove(List<ReelQuestion> qs, ReelChapter? chapter) {
    if (chapter != null && chapter.wrong > 0) {
      return ReelNextMove(kind: ReelMoveKind.repairChapter, label: ReelCopy.repairChapter(chapter.wrong, chapter.name), chapter: chapter.name, qids: chapter.qids);
    }
    final misses = [for (final q in qs) if (q.result == ReelResult.wrong || q.result == ReelResult.blank) q.qid];
    if (misses.isNotEmpty) return ReelNextMove(kind: ReelMoveKind.reviewMistakes, label: ReelCopy.reviewMistakes, qids: misses, chapter: chapter?.name);
    return const ReelNextMove(kind: ReelMoveKind.nextMock, label: ReelCopy.nextMock);
  }
}
