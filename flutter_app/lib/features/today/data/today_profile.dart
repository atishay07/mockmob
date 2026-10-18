// What Today reads from the student's sealed onboarding sheet (brief section 11): the dream
// ladder with real CSAS 2026 Round 1 figures, the subject and route of the first move, a first
// check put off to tonight, and the chosen rest days. Before a sheet is sealed this is null and
// Today still works: day one starts from the account's subjects and the ladder is not shown.
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_providers.dart';
import '../../../core/auth/auth_state.dart';
import '../../../core/models/my_colleges.dart';
import '../../onboarding/onboarding.dart';
import '../../tools/data/my_colleges_actions.dart';

/// One college on the student's ladder, with its real CSAS 2026 Round 1 closing score.
class LadderPick {
  const LadderPick({required this.college, required this.course, this.closingScore, this.outOf, this.programmeId});

  final String college;

  /// The DU programme (Compass opens it), when known.
  final String? programmeId;

  /// "B.Com (Hons)".
  final String course;

  /// The Round 1 closing score as published (CSAS 2026). Never estimated: null when no figure is on
  /// file for this college and the student's category.
  final num? closingScore;

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
    this.subjects = const [],
    this.weakestRated,
  });

  /// Every college on My colleges, the hardest to get into first ([hardestFirst]). Today shows the
  /// first three and says how many there are in all (D104).
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

  /// The subjects the setup sheet holds (public ids), weakest first by the student's own ratings.
  /// The suggested deck builds its first cards from them before any paper exists (19 Oct, G12),
  /// and they stand in while the account's own list has not synced yet.
  final List<String> subjects;

  /// The subject the student themselves rated below every other one ([weakestRatedOf]), or null
  /// when the ratings do not single one out.
  final String? weakestRated;
}

/// [picks] with the hardest to get into first: the highest Round 1 closing marks lead, a college
/// without a figure for the category goes last, and ties keep the order they came in (D103, D104).
/// My colleges may already arrive in this order; the sort is stable, so it agrees with that order
/// and still holds when the list arrives in the order the student picked.
List<LadderPick> hardestFirst(List<LadderPick> picks) {
  final indexed = [for (final (i, p) in picks.indexed) (i, p)];
  indexed.sort((a, b) {
    final x = a.$2.closingScore, y = b.$2.closingScore;
    if (x == null && y == null) return a.$1.compareTo(b.$1);
    if (x == null) return 1;
    if (y == null) return -1;
    final c = y.compareTo(x);
    return c != 0 ? c : a.$1.compareTo(b.$1);
  });
  return [for (final (_, p) in indexed) p];
}

/// The sheet's subjects, weakest first, as public ids.
List<String> sheetSubjectsOf(StudentSheet sheet) => [for (final (s, _) in sheet.subjects) s.id];

/// The subject the student rated weakest: the first of the ranked list when the student rated it
/// and rated it below every other subject (an unrated subject counts as Okay, as the ranking does);
/// a lone subject counts when it was rated Shaky.
String? weakestRatedOf(StudentSheet sheet) {
  final rated = sheet.subjects;
  if (rated.isEmpty) return null;
  final (first, confidence) = rated.first;
  if (confidence == null) return null;
  final others = rated.skip(1).toList();
  if (others.isEmpty) return confidence == Confidence.shaky ? first.id : null;
  final below = others.every((e) => confidence.index < (e.$2 ?? Confidence.okay).index);
  return below ? first.id : null;
}

/// The sealed sheet as Today needs it, or null before one is sealed. The ladder is every college of
/// My colleges (the one list shared with Compass, You and the website), hardest first, each with its
/// Round 1 figure when one is on file for the student's category and none when it is not: a college
/// is never left off, and a number is never estimated. Until the list is known (loading, did not
/// load, or nobody signed in) the colleges named in the setup stand in for it.
///
/// Colleges chosen in You, Your sheet before the setup was ever sealed (a student who signed in
/// on the website first, or left the setup before its plan) still reach the ladder: owner test
/// 15 Oct, "Choose colleges" led to an editor whose picks Today never showed. Nothing else of an
/// unsealed sheet is read.
final todayProfileProvider = Provider<TodayProfile?>((ref) {
  final sheet = ref.watch(studentSheetProvider);
  final mine = ref.watch(myCollegesProvider);
  if (sheet == null) return mine.hasList ? _listOnly(ref, mine) : _collegesOnly(ref);
  final move = sheet.firstMove;
  final days = sheet.days;
  return TodayProfile(
    ladder: hardestFirst(mine.hasList ? ladderOfList(mine.list.colleges, sheet.category) : ladderOf(sheet)),
    category: sheet.category,
    subjects: sheetSubjectsOf(sheet),
    weakestRated: weakestRatedOf(sheet),
    weakestSubject: move.subject.id,
    firstMoveAt: sheet.deferredToTonight ? move.nextWindow(ref.watch(nowProvider)()) : null,
    restWeekdays: days.isEmpty ? const {} : {for (var d = 0; d < 7; d++) if (!days.contains(d)) d + 1},
    firstMoveRoute: move.route,
    firstMoveLine: move.framing,
  );
});

/// The ladder of a sheet's setup, dream (highest closing score) first: what Today showed before the
/// list was shared, kept for the moments the list is not known.
List<LadderPick> ladderOf(StudentSheet sheet) {
  final course = sheet.course?.short ?? '';
  return [
    for (final c in sheet.colleges)
      if (c.score case final score?) LadderPick(college: c.name, course: course, closingScore: score, outOf: DuCatalog.scale),
  ]..sort((a, b) => (b.closingScore ?? 0).compareTo(a.closingScore ?? 0));
}

/// My colleges as Today's ladder, in the list's order ([hardestFirst] then orders it). The Round 1 figure
/// comes from the DU file on the phone when it names this college in this programme.
List<LadderPick> ladderOfList(List<MyCollege> colleges, String category) {
  final picks = <LadderPick>[];
  for (final c in colleges) {
    final course = DuCatalog.course(c.programmeId);
    final figure = course?.offeringAt(c.college)?.scoreFor(category);
    picks.add(LadderPick(college: c.college, course: course?.short ?? c.programme, closingScore: figure, outOf: figure == null ? null : DuCatalog.scale, programmeId: c.programmeId));
  }
  return picks;
}

/// The list alone, for a student whose setup was never sealed.
TodayProfile? _listOnly(Ref ref, MyCollegesView mine) {
  if (mine.list.isEmpty) return null;
  final answers = ref.watch(onboardingAnswersProvider).value;
  return TodayProfile(ladder: hardestFirst(ladderOfList(mine.list.colleges, answers?.category ?? DuCatalog.defaultCategory)), category: answers?.category ?? DuCatalog.defaultCategory);
}

/// The ladder alone, from answers that were edited but never sealed and belong to this account.
TodayProfile? _collegesOnly(Ref ref) {
  final answers = ref.watch(onboardingAnswersProvider).value;
  if (answers == null || answers.colleges.isEmpty) return null;
  final owner = answers.owner;
  if (owner != null && owner != ref.watch(authSnapshotProvider.select((a) => a.userId))) return null;
  final ladder = ladderOf(StudentSheet(answers: answers, now: ref.watch(nowProvider)()));
  if (ladder.isEmpty) return null;
  return TodayProfile(ladder: ladder, category: answers.category);
}
