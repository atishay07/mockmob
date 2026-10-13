// One student record behind every screen of the device demo (review round 1, P0-4). Every
// paper is built from real question text whose chapter is its own, every number on Today,
// Review, the record and the rhythm is computed from these papers, and a submitted practice or
// exam is marked from the answers given and added here at the moment it was submitted, so the
// next screen (Mock 8, the receipt time, the week strip) agrees with what just happened.
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mockmob/core/models/models.dart';
import 'package:mockmob/core/repositories/repair_local_repository.dart';

import 'demo_questions.dart';

/// Mock 7 keeps the id the result screens and earlier shots use.
const String demoMockId = 'a7';

/// Kolkata is UTC+5:30, so "today" and the week follow the student's clock.
const Duration _ist = Duration(hours: 5, minutes: 30);

DateTime istOf(DateTime instant) => instant.toUtc().add(_ist);

String dayKey(DateTime instant) {
  final d = istOf(instant);
  return '${d.year.toString().padLeft(4, '0')}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';
}

DateTime _daysBefore(DateTime nowUtc, int days, {int hourUtc = 14}) => DateTime.utc(nowUtc.year, nowUtc.month, nowUtc.day - days, hourUtc, 40);

class DemoBook extends ChangeNotifier {
  DemoBook(DateTime nowUtc) {
    _seed(nowUtc);
  }

  /// Newest first.
  final List<AttemptDetail> _papers = [];

  /// When the server "acknowledged" each paper submitted in this run.
  final Map<String, DateTime> receivedAt = {};

  /// Results not opened yet in this run: the finish moment plays once.
  final Set<String> fresh = {};

  int version = 0;

  List<Attempt> get attempts => [for (final p in _papers) p.attempt];

  AttemptDetail? detail(String id) {
    for (final p in _papers) {
      if (p.attempt.id == id) return p;
    }
    return null;
  }

  /// A paper the student just submitted, acknowledged now.
  void record(AttemptDetail paper, DateTime at) {
    _papers.insert(0, paper);
    receivedAt[paper.attempt.id] = at;
    fresh.add(paper.attempt.id);
    version++;
    notifyListeners();
  }

  void _add(String id, String subject, String mode, DateTime at, {required int count, Set<int> wrong = const {}, Set<int> blank = const {}}) {
    final questions = demoQuestions(subject, count, id);
    final pool = demoPool(subject);
    final answers = <String, int>{
      for (var i = 0; i < count; i++)
        if (!blank.contains(i + 1)) questions[i].id: wrong.contains(i + 1) ? (pool[i % pool.length].key + 1) % 4 : pool[i % pool.length].key,
    };
    _papers.add(demoPracticeDetail(id: id, subject: subject, questions: questions, answers: answers, completedAt: at, mode: mode));
  }

  /// Asha's record: seven Accountancy mocks and a Business Studies Quick 10, newest first.
  /// Mock 7, two days ago: 26 right, 15 wrong, 9 blank (115 of 250); four of its mistakes are in
  /// Admission of a partner, the chapter tonight's repair opens.
  void _seed(DateTime now) {
    _add(demoMockId, 'accountancy', 'full', _daysBefore(now, 2),
        count: 50,
        wrong: const {2, 12, 31, 41, 4, 23, 44, 6, 26, 35, 8, 18, 47, 20, 39},
        blank: const {14, 16, 24, 28, 30, 36, 43, 45, 50});
    _add('q1', 'business_studies', 'quick', _daysBefore(now, 4), count: 10, wrong: const {2, 7}, blank: const {9});
    _add('m6', 'accountancy', 'full', _daysBefore(now, 6), count: 50, wrong: const {2, 9, 14, 19, 26, 33, 41, 44, 49}, blank: const {12, 36, 37, 48, 50});
    _add('m5', 'accountancy', 'full', _daysBefore(now, 9), count: 50, wrong: const {4, 11, 15, 23, 28, 30, 39, 42}, blank: const {45, 46, 47, 48});
    _add('m4', 'accountancy', 'full', _daysBefore(now, 11), count: 50, wrong: const {1, 6, 18, 25, 34, 43}, blank: const {49, 50});
    _add('m3', 'accountancy', 'full', _daysBefore(now, 13), count: 50, wrong: const {2, 3, 10, 20, 27, 35, 38});
    _add('m2', 'accountancy', 'full', _daysBefore(now, 15), count: 50, wrong: const {5, 9, 16, 24});
    _add('m1', 'accountancy', 'full', _daysBefore(now, 18), count: 50, wrong: const {7, 8, 13, 21, 29, 32, 40, 41, 44, 47});
  }

  /// The days anything was recorded: a paper, or a repair the server acknowledged.
  Set<String> studyDays(List<RepairLocalRecord> repairs) => {
        for (final a in attempts) dayKey(a.completedAt),
        for (final r in repairs)
          if (r.isRepaired && r.ackedAt != null) dayKey(r.ackedAt!),
      };

  /// What the server would say for this record: the first scored set, the first full mock, the
  /// first repair once one lands, and the first week that met the goal of four.
  List<RhythmMilestone> milestones(List<RepairLocalRecord> repairs) {
    final byTime = [...attempts]..sort((a, b) => a.completedAt.compareTo(b.completedAt));
    final mocks = [for (final a in byTime) if (a.isMock) a];
    final acked = [for (final r in repairs) if (r.isRepaired && r.ackedAt != null) r.ackedAt!]..sort();
    return [
      if (byTime.isNotEmpty) RhythmMilestone(id: 'first_scored_session', achievedAt: byTime.first.completedAt),
      if (mocks.isNotEmpty) RhythmMilestone(id: 'first_full_mock', achievedAt: mocks.first.completedAt),
      RhythmMilestone(id: 'first_repair', achievedAt: acked.isEmpty ? null : acked.first),
      RhythmMilestone(id: 'first_week_met', achievedAt: mocks.length > 2 ? mocks[2].completedAt : null),
    ];
  }

  /// This week, Monday first, in the student's time zone.
  ({String weekStart, List<String> dates, int todayIndex, List<int> dayNumbers}) week(DateTime nowUtc) {
    final today = istOf(nowUtc);
    final monday = DateTime.utc(today.year, today.month, today.day - (today.weekday - 1));
    final days = [for (var i = 0; i < 7; i++) monday.add(Duration(days: i))];
    String key(DateTime d) => '${d.year.toString().padLeft(4, '0')}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';
    return (weekStart: key(monday), dates: [for (final d in days) key(d)], todayIndex: today.weekday - 1, dayNumbers: [for (final d in days) d.day]);
  }
}

/// The one book for the whole demo run.
final DemoBook demoBook = DemoBook(DateTime.now().toUtc());

/// Rebuilds whatever reads the book whenever a paper is added.
final demoBookProvider = Provider<int>((ref) {
  void changed() => ref.invalidateSelf();
  demoBook.addListener(changed);
  ref.onDispose(() => demoBook.removeListener(changed));
  return demoBook.version;
});
