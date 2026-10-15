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
import 'package:mockmob/core/models/rhythm.dart' show Goal, Rhythm;
import 'package:mockmob/features/insights/data/insights_repository.dart';
import 'package:mockmob/features/insights/data/saved_repository.dart';
import 'package:mockmob/features/review/data/mistake_index.dart';
import 'package:mockmob/core/repositories/attempts_repository.dart';
import 'package:mockmob/core/repositories/credits_repository.dart';
import 'package:mockmob/core/repositories/goal_repository.dart';
import 'package:mockmob/core/repositories/rhythm_repository.dart';
import 'package:mockmob/core/repositories/notification_prefs_repository.dart';
import 'package:mockmob/core/repositories/remote_state.dart';
import 'package:mockmob/core/repositories/repair_local_repository.dart';
import 'package:mockmob/core/repositories/rhythm_seen_repository.dart';
import 'package:mockmob/core/storage/prefs_store.dart';
import 'package:mockmob/features/review/data/repair_run.dart';
import 'package:mockmob/features/review/data/repair_state.dart';
import 'package:mockmob/features/review/data/retry.dart';
import 'package:mockmob/features/review/data/review_providers.dart';
import 'package:mockmob/features/rhythm/data/rhythm_prefs.dart' show rhythmPrefsStoreProvider;
import 'package:mockmob/features/rhythm/rhythm.dart' show CelebrationMode, celebrationModeProvider;
import 'package:mockmob/features/you/you_providers.dart' show lateNightLinesProvider;
import 'package:mockmob/core/models/lab_loop.dart' show RulesRead;
import 'package:mockmob/features/rules/data/rules_data.dart' show rulesRepositoryProvider;

import '../../helpers/fonts.dart';
import '../../helpers/golden_harness.dart';
import '../../unit/review/support/review_fixtures.dart';

/// The Night Sheet golden frame: 384 by 853 logical px at DPR 2.
const Size kReviewSize = Size(384, 853);

/// The celebration ids this phone has spent, in memory (the real one is a `rhythm_seen` row).
class MemoryRhythmSeen implements RhythmSeenRepository {
  final Set<String> ids = {};

  @override
  Future<RhythmSeenState> read() async => RhythmSeenState(celebratedIds: {...ids});

  @override
  Future<bool> hasCelebrated(String id) async => ids.contains(id);

  @override
  Future<bool> markCelebrated(String id) async => ids.add(id);

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

/// The wallet, held as given. The repair screen asks for a refresh once it is up, and the real
/// one reads the on-disk cache and then the network (path_provider, connectivity): a golden has
/// neither, so a refresh here does nothing.
class StillCredits extends CreditsRepository {
  StillCredits(this.held);

  final AiCredits? held;

  @override
  RemoteState<AiCredits> build() => RemoteState(value: held);

  @override
  Future<void> refresh({bool force = false}) async {}
}

/// The rhythm and goal the repair ending reads and refreshes: settled and empty, with no
/// cache or network behind a refresh.
class StillRhythm extends RhythmRepository {
  @override
  RemoteState<Rhythm> build() => const RemoteState<Rhythm>();

  @override
  Future<void> refresh({bool force = false}) async {}
}

class StillGoal extends GoalRepository {
  @override
  RemoteState<Goal> build() => const RemoteState<Goal>();

  @override
  Future<void> refresh({bool force = false}) async {}
}

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
  PrefsStore? rhythmStore,
  RhythmSeenRepository? seen,
  RemoteState<RulesRead>? rules,
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
  creditsRepositoryProvider.overrideWith(() => StillCredits(credits)),
  rhythmRepositoryProvider.overrideWith(StillRhythm.new),
  goalRepositoryProvider.overrideWith(StillGoal.new),
  // The record and saved rows on the tab: settled, no network.
  insightsRepositoryProvider.overrideWithBuild((ref, n) => const RemoteState()),
  savedRepositoryProvider.overrideWithBuild((ref, n) => const RemoteState()),
  // The Rule book row (Mistake Lab v4 slice 3): settled, no network.
  rulesRepositoryProvider.overrideWithBuild((ref, n) => rules ?? const RemoteState()),
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
  // The repair ending fires its moment into the rhythm module: its choices and spent ids.
  rhythmPrefsStoreProvider.overrideWithValue(rhythmStore ?? MemoryPrefsStore()),
  rhythmSeenRepositoryProvider.overrideWithValue(seen ?? MemoryRhythmSeen()),
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
