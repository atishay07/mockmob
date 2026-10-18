import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/auth/auth_state.dart';
import '../../../core/domain/tonight_pick.dart' show otherChapter;
import '../../../core/repositories/attempts_repository.dart';
import '../../credits/data/credit_figures.dart';
import '../../credits/data/credits_data.dart';
import '../../credits/data/credits_models.dart';
import '../../review/data/review_chapters_provider.dart';
import '../../tools/data/my_colleges_actions.dart';
import 'pro_benefits.dart';

/// The student's own figures, as the app already holds them, for the Upgrade sheet's personal lines.
/// Every figure is read from what is on the phone (the attempts, the credits overview, Review's
/// record, My colleges); one that is not known is left out, so the sheet never says what it cannot
/// back. Read only while the sheet is open.
final proFactsProvider = Provider<ProFacts>((ref) {
  final auth = ref.watch(authSnapshotProvider);

  final attempts = ref.watch(attemptsRepositoryProvider).value;
  final mocks = attempts == null ? 0 : attempts.where((a) => a.mode == 'full' || a.mode == 'nta').length;

  final chapters = ref.watch(reviewChaptersProvider);
  String? chapter;
  String? subject;
  if (chapters != null && chapters.rows.isNotEmpty) {
    final top = chapters.rows.first;
    // A bucket of questions with no chapter is not a chapter to name; its subject still is.
    if (top.name != otherChapter && top.name.trim().isNotEmpty) chapter = top.name;
    final s = top.subjectName?.trim();
    if (s != null && s.isNotEmpty) subject = s;
  }

  final overview = ref.watch(meCreditsProvider).value;
  int? used;
  var usedAtLeast = false;
  if (overview != null) {
    used = overview.history.where((e) => e.pool == CreditPool.practice && e.isSpend).fold<int>(0, (n, e) => n - e.delta);
    usedAtLeast = overview.nextCursor != null;
  }

  final figures = ref.watch(creditFiguresProvider);
  final colleges = ref.watch(myCollegesProvider);

  return ProFacts(
    mocksTaken: mocks,
    weakestChapter: chapter,
    weakestSubject: subject,
    creditsUsed: used,
    creditsUsedAtLeast: usedAtLeast,
    practiceCredits: figures.stale ? null : figures.practice,
    subjectCount: auth.subjects.length,
    targetColleges: colleges.ready ? colleges.colleges.length : 0,
  );
});
