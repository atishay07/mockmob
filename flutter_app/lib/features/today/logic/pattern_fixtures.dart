// Study logs for the smart layer's tests and its device walk (SMART-LAYER-1019PM 2.8): a new
// student, a regular one, an irregular one, one whose habits shifted, and a motivated one. Built
// relative to [now], so the same shapes hold on any clock. The device walk reaches them through a
// debug-only switch (`--dart-define=MM_PATTERN_FIXTURE=regular`), which release builds compile out.
import 'study_log.dart';
import 'study_pattern.dart';

/// One fixture: the log and what the student set.
class PatternFixture {
  const PatternFixture({required this.log, this.goal, this.subjects = const [], this.notes = const PatternNotes(), this.deck});

  final List<StudyLogEntry> log;
  final int? goal;
  final List<String> subjects;
  final PatternNotes notes;
  final DeckReactions? deck;

  StudyPattern pattern(DateTime now) => StudyPattern.from(log: log, now: now, goalMinutes: goal, chosenSubjects: subjects, notes: notes, reactions: deck);
}

/// The UTC instant of [hour]:[minute] IST on the IST day [daysAgo] days before [now]'s.
DateTime istAt(DateTime now, int daysAgo, int hour, int minute) {
  final day = istDay(now.millisecondsSinceEpoch) - daysAgo;
  final midnightIst = DateTime.fromMillisecondsSinceEpoch(day * Duration.millisecondsPerDay, isUtc: true);
  return midnightIst.add(Duration(hours: hour, minutes: minute)).subtract(const Duration(hours: 5, minutes: 30));
}

/// A finished session started at [start] that lasted [minutes].
StudyLogEntry session(
  String id,
  DateTime start,
  int minutes, {
  String mode = StudyMode.chapter,
  String subject = 'accountancy',
  String source = StudySource.practice,
  int? suggested,
  int? chosen,
  bool timed = true,
}) {
  final s = start.millisecondsSinceEpoch;
  final e = s + minutes * Duration.millisecondsPerMinute;
  return StudyLogEntry(
    id: id,
    startedAtMs: timed ? s : null,
    endedAtMs: e,
    activeMs: timed ? minutes * Duration.millisecondsPerMinute : null,
    mode: mode,
    subject: subject,
    questions: 10,
    source: source,
    suggestedMinutes: suggested,
    chosenMinutes: chosen,
  );
}

abstract final class PatternFixtures {
  static const names = ['new', 'new_three', 'regular', 'irregular', 'shifted', 'motivated'];

  static PatternFixture? byName(String name, DateTime now) => switch (name) {
        'new' => fresh(),
        'new_three' => newThree(now),
        'regular' => regular(now),
        'irregular' => irregular(now),
        'shifted' => shifted(now),
        'motivated' => motivated(now),
        _ => null,
      };

  /// No sessions, a 20-minute goal.
  static PatternFixture fresh() => const PatternFixture(log: [], goal: 20, subjects: ['accountancy', 'economics']);

  /// Three sessions on two days.
  static PatternFixture newThree(DateTime now) => PatternFixture(
        goal: 20,
        subjects: const ['accountancy'],
        log: [
          session('n1', istAt(now, 2, 19, 0), 15),
          session('n2', istAt(now, 2, 20, 0), 12),
          session('n3', istAt(now, 1, 19, 30), 20),
        ],
      );

  /// 21 sessions over four weeks: 18 start between 9:30 and 10 pm, 35 to 45 minutes each, mostly
  /// chapter practice and repairs he chose; Economics chosen but untouched for 16 days; a 30-minute
  /// goal, set 27 days ago, met on 6 of his last 7 study days at about 40 minutes. Nothing today.
  static PatternFixture regular(DateTime now) {
    const lateStarts = [(21, 30), (21, 45), (22, 0)];
    const lengths = [40, 35, 45, 40, 38, 42];
    final log = <StudyLogEntry>[];
    // The last seven study days: one session each, all late, six of them about 40 minutes.
    for (var k = 0; k < 7; k++) {
      final (h, m) = lateStarts[k % 3];
      log.add(session('r$k', istAt(now, 1 + k, h, m), k == 3 ? 25 : lengths[k % lengths.length], mode: k.isEven ? StudyMode.chapter : StudyMode.repair));
    }
    // Eleven more late sessions, 8 to 26 days ago.
    for (var k = 0; k < 11; k++) {
      final (h, m) = lateStarts[k % 3];
      log.add(session('rl$k', istAt(now, 8 + k * 2, h, m), lengths[(k + 2) % lengths.length], mode: k % 3 == 0 ? StudyMode.repair : StudyMode.chapter));
    }
    // Three afternoon sessions, and the one Economics paper, 16 days ago.
    log
      ..add(session('ra1', istAt(now, 9, 16, 0), 40))
      ..add(session('ra2', istAt(now, 13, 16, 30), 38))
      ..add(session('ra3', istAt(now, 16, 15, 0), 40, subject: 'economics', mode: StudyMode.quick));
    return PatternFixture(
      goal: 30,
      subjects: const ['accountancy', 'economics'],
      notes: PatternNotes(goalSetAtMs: istAt(now, 27, 9, 0).millisecondsSinceEpoch),
      log: log,
    );
  }

  /// 14 sessions in four weeks, starting in the mornings, the afternoons, the evenings and late at
  /// night with no window above 45%, from 5 to 70 minutes.
  static PatternFixture irregular(DateTime now) {
    const starts = [(8, 0), (14, 0), (19, 0), (22, 30)];
    const lengths = [5, 70, 15, 50, 8, 60, 25];
    return PatternFixture(
      goal: 20,
      subjects: const ['accountancy'],
      log: [
        for (var k = 0; k < 14; k++) session('i$k', istAt(now, 1 + k * 2, starts[k % 4].$1, starts[k % 4].$2), lengths[k % lengths.length]),
      ],
    );
  }

  /// [regular] 30 to 40 days ago, then six morning sessions in the last nine days.
  static PatternFixture shifted(DateTime now) {
    final old = [
      for (var k = 0; k < 18; k++) session('s$k', istAt(now, 30 + (k % 11), 21, 30 + (k % 3) * 15), 40),
    ];
    final mornings = [
      for (var k = 0; k < 6; k++) session('m$k', istAt(now, 1 + (k * 3) ~/ 2, 7, 0), 25),
    ];
    return PatternFixture(goal: 30, subjects: const ['accountancy'], log: [...old, ...mornings]);
  }

  /// A 2-hour goal and two full mocks a day for the last week; none yet today.
  static PatternFixture motivated(DateTime now) => PatternFixture(
        goal: 120,
        subjects: const ['accountancy', 'economics'],
        notes: PatternNotes(goalSetAtMs: istAt(now, 10, 9, 0).millisecondsSinceEpoch),
        log: [
          for (var k = 1; k <= 7; k++) ...[
            session('f${k}a', istAt(now, k, 17, 0), 60, mode: StudyMode.full),
            session('f${k}b', istAt(now, k, 19, 0), 60, mode: StudyMode.full, subject: 'economics'),
          ],
        ],
      );
}
