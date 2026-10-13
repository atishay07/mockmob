import 'dart:io';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/api/api_providers.dart';
import 'package:mockmob/core/auth/auth_state.dart';
import 'package:mockmob/core/models/ai_credits.dart';
import 'package:mockmob/core/models/attempt.dart';
import 'package:mockmob/core/models/repair.dart';
import 'package:mockmob/features/review/data/mistake_index.dart';
import 'package:mockmob/core/repositories/attempts_repository.dart';
import 'package:mockmob/core/repositories/credits_repository.dart';
import 'package:mockmob/core/repositories/notification_prefs_repository.dart';
import 'package:mockmob/core/repositories/remote_state.dart';
import 'package:mockmob/core/repositories/repair_local_repository.dart';
import 'package:mockmob/features/review/data/repair_run.dart';
import 'package:mockmob/features/review/data/repair_state.dart';
import 'package:mockmob/features/review/data/retry.dart';
import 'package:mockmob/features/review/data/review_providers.dart';
import 'package:mockmob/features/rhythm/rhythm.dart' show CelebrationMode, celebrationModeProvider;
import 'package:mockmob/features/you/you_providers.dart' show lateNightLinesProvider;

import '../../helpers/fonts.dart';
import '../../helpers/golden_harness.dart';
import '../../unit/review/support/review_fixtures.dart';

/// The Night Sheet golden frame: 384 by 853 logical px at DPR 2.
const Size kReviewSize = Size(384, 853);

/// The Review overrides: a signed-in student, fixed clock and zone, the given attempts and
/// local records, no network.
List<Override> reviewOverrides({
  List<Attempt>? attempts,
  RemoteState<List<Attempt>>? attemptsState,
  List<RepairLocalRecord> records = const [],
  DateTime? nowUtc,
  bool lateNightLines = true,
  AiCredits? credits,
  RepairRunState? run,
  RetryOffer retry = const RetryAvailable(subjectId: 'accountancy', cost: 5),
  ConceptLink? concept,
  CelebrationMode celebration = CelebrationMode.full,
}) => [
  authSnapshotProvider.overrideWithBuild((ref, n) => const AuthSnapshot(status: AuthStatus.signedIn, userId: 'u1', name: 'Riya')),
  studentTimezoneProvider.overrideWithValue('Asia/Kolkata'),
  nowProvider.overrideWithValue(() => nowUtc ?? eveningUtc),
  lateNightLinesProvider.overrideWithBuild((ref, n) => lateNightLines),
  celebrationModeProvider.overrideWithValue(celebration),
  reviewInputsProvider.overrideWithValue(
    ReviewInputs(
      attempts: attemptsState ?? RemoteState(value: attempts ?? allAttempts, fetchedAt: eveningUtc),
      records: records,
    ),
  ),
  creditsRepositoryProvider.overrideWithBuild((ref, n) => RemoteState(value: credits)),
  for (final a in attempts ?? allAttempts)
    attemptDetailProvider(a.id).overrideWithBuild(
      (ref, n) => RemoteState(
        value: AttemptDetail(attempt: a),
        fetchedAt: eveningUtc,
      ),
    ),
  if (run != null) repairRunProvider(run.attemptId).overrideWithBuild((ref, n) => run),
  retryOfferProvider.overrideWith((ref, subject) async => retry),
  conceptLinkProvider.overrideWith((ref, chapter) => concept),
];

/// Runs [build] once per theme as `goldens/<name>_<night|day>.png`.
void reviewGolden(
  String name,
  Widget Function() build, {
  List<Override> Function()? overrides,
  Size size = kReviewSize,
  bool disableAnimations = true,
  Future<void> Function(WidgetTester tester)? after,
  double textScale = 1,
}) {
  setUpAll(loadAppFonts);
  for (final brightness in [Brightness.dark, Brightness.light]) {
    final tag = brightness == Brightness.dark ? 'night' : 'day';
    testWidgets('$name, $tag', (tester) async {
      final boundary = GlobalKey();
      await pumpMockmob(
        tester,
        RepaintBoundary(key: boundary, child: build()),
        brightness: brightness,
        size: size,
        textScale: textScale,
        disableAnimations: disableAnimations,
        overrides: overrides?.call() ?? reviewOverrides(),
        wrapInScaffold: false,
      );
      if (after != null) await after(tester);
      await settleImages(tester);
      await expectLater(find.byKey(boundary), matchesGoldenFile('goldens/${name}_$tag.png'));
      await _preview(tester, boundary, '${name}_$tag');
    });
  }
}

Future<void> _preview(WidgetTester tester, GlobalKey key, String name) async {
  final dir = Platform.environment['MM_PREVIEW_DIR'];
  if (dir == null || dir.isEmpty) return;
  final boundary = key.currentContext!.findRenderObject()! as RenderRepaintBoundary;
  await tester.runAsync(() async {
    final image = await boundary.toImage(pixelRatio: 2);
    final bytes = await image.toByteData(format: ui.ImageByteFormat.png);
    image.dispose();
    await File('$dir/$name.png').writeAsBytes(bytes!.buffer.asUint8List());
  });
}

/// Tonight's run: Mock 7's three Partnership mistakes.
RepairRunState runOf({
  RepairPhase phase = RepairPhase.working,
  List<MistakeOutcome?> outcomes = const [],
  int index = 0,
  bool repairedBefore = true,
}) {
  final pick = buildReviewIndex(allAttempts, const []).tonight!;
  return RepairRunState(
    attemptId: pick.attemptId,
    chapter: pick.chapter,
    subjectId: pick.subjectId,
    source: pick.source,
    steps: [for (var i = 0; i < pick.items.length; i++) RepairStep(pick.items[i], i < outcomes.length ? outcomes[i] : null)],
    index: index,
    phase: phase,
    repairedBefore: repairedBefore,
  );
}

final explained = OutcomeExplained(RepairResponse.fromJson(explainedJson()), ackedAt: DateTime.utc(2026, 10, 12, 17, 38));
final explained2 = OutcomeExplained(RepairResponse.fromJson(explainedJson()), ackedAt: DateTime.utc(2026, 10, 12, 17, 51));

AiCredits credits(int spendable) => AiCredits.fromJson({
  'state': spendable > 0 ? 'available' : 'empty',
  'wallet': {'state': 'available', 'known': true, 'spendable': spendable, 'resetAt': '2026-10-31T18:30:00Z'},
  'practiceCredits': {'balance': 40},
});
