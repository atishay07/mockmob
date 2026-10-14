// What Today reads from the student's sealed onboarding sheet (brief section 11): the dream
// ladder with real CSAS 2026 Round 1 figures, the subject and route of the first move, a first
// check put off to tonight, and the chosen rest days. Before a sheet is sealed this is null and
// Today still works: day one starts from the account's subjects and the ladder is not shown.
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_providers.dart';
import '../../onboarding/onboarding.dart';

/// One college on the student's ladder, with its real CSAS 2026 Round 1 closing score.
class LadderPick {
  const LadderPick({required this.college, required this.course, required this.closingScore, this.outOf});

  final String college;

  /// "B.Com (Hons)".
  final String course;

  /// The Round 1 closing score as published (CSAS 2026). Never estimated.
  final num closingScore;

  /// The scale, when the source states one (1000 for a four-paper combination).
  final int? outOf;
}

class TodayProfile {
  const TodayProfile({
    this.ladder = const [],
    this.category = 'UR',
    this.weakestSubject,
    this.firstMoveAt,
    this.restWeekdays = const {},
    this.firstMoveRoute,
    this.firstMoveLine,
  });

  /// Dream first, safest last. At most three.
  final List<LadderPick> ladder;

  /// The CSAS category the ladder figures belong to (default UR).
  final String category;

  /// Public subject id the onboarding marked shakiest: the first check's subject.
  final String? weakestSubject;

  /// When the student chose "Tonight at 8:00 PM" for the first check.
  final DateTime? firstMoveAt;

  /// Chosen rest days, 1 (Monday) to 7 (Sunday). Drawn as rest bubbles in the week.
  final Set<int> restWeekdays;

  /// Where the first check opens (onboarding's own link, through the confirm sheet).
  final String? firstMoveRoute;

  /// The line the student's biggest worry wrote ("Every slip becomes a repair.").
  final String? firstMoveLine;
}

/// The sealed sheet as Today needs it, or null before one is sealed. Colleges without a Round 1
/// figure for the student's category are left off the ladder rather than given a number.
final todayProfileProvider = Provider<TodayProfile?>((ref) {
  final sheet = ref.watch(studentSheetProvider);
  if (sheet == null) return null;
  final move = sheet.firstMove;
  final course = sheet.course?.short ?? '';
  final picks = [
    for (final c in sheet.colleges)
      if (c.score case final score?) LadderPick(college: c.name, course: course, closingScore: score, outOf: DuCatalog.scale),
  ]..sort((a, b) => b.closingScore.compareTo(a.closingScore));
  final days = sheet.days;
  return TodayProfile(
    ladder: picks,
    category: sheet.category,
    weakestSubject: move.subject.id,
    firstMoveAt: sheet.deferredToTonight ? move.nextWindow(ref.watch(nowProvider)()) : null,
    restWeekdays: days.isEmpty ? const {} : {for (var d = 0; d < 7; d++) if (!days.contains(d)) d + 1},
    firstMoveRoute: move.route,
    firstMoveLine: move.framing,
  );
});
