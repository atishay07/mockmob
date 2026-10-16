// The paper behind a derived badge, said in words in the badge sheet: "From your Accountancy full
// mock, 12 October: 152 of 250 (before: 142)". Only the badges the phone worked out itself have
// one; a server badge says its date and nothing more, so no source is ever made up.
import '../../../core/models/attempt.dart';
import '../copy.dart';
import 'derived_badges.dart';

class BadgeRecord {
  const BadgeRecord({required this.attemptId, required this.subject, required this.mode, required this.at, required this.marks, required this.max, this.before});

  final String attemptId;
  final String subject;
  final String mode;
  final DateTime at;
  final int marks;
  final int max;

  /// For a new best: the marks it beat.
  final int? before;

  /// "From your Accountancy full mock, 12 October: 152 of 250 (before: 142)".
  String text(String Function(DateTime) dateOf, String Function(String) subjectName) => RhythmCopy.badgeFromPaper(
        subjectName(subject),
        RhythmCopy.paperKind(mode),
        dateOf(at),
        '$marks of $max',
        before: before == null ? null : '$before',
      );
}

/// The record behind each derived badge earned, keyed by badge id. A badge whose attempt is no
/// longer in [attempts] has none.
Map<String, BadgeRecord> badgeRecords(Map<String, DerivedBadge> derived, List<Attempt> attempts) {
  final byId = {for (final a in attempts) a.id: a};
  final out = <String, BadgeRecord>{};
  for (final d in derived.values) {
    final a = byId[d.attemptId];
    if (a == null) continue;
    out[d.id] = BadgeRecord(attemptId: a.id, subject: a.subject, mode: a.mode ?? '', at: a.completedAt, marks: a.marks, max: a.maxMarks, before: d.before);
  }
  return out;
}
