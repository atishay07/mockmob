import 'dart:io';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/api/api_providers.dart';
import 'package:mockmob/core/auth/auth_state.dart';
import 'package:mockmob/core/mascot/mascot.dart' show MobiRation;
import 'package:mockmob/core/models/ai_credits.dart';
import 'package:mockmob/core/models/attempt.dart';
import 'package:mockmob/core/repositories/credits_repository.dart';
import 'package:mockmob/core/repositories/remote_state.dart';
import 'package:mockmob/features/insights/data/ask_controller.dart';
import 'package:mockmob/features/insights/data/insights_models.dart';
import 'package:mockmob/features/insights/data/insights_repository.dart';
import 'package:mockmob/features/insights/data/saved_repository.dart';
import 'package:mockmob/features/insights/data/stream_controller.dart';
import 'package:mockmob/features/insights/screens/insights_screen.dart';
import 'package:mockmob/features/review/data/repair_record_api.dart' show serverRepairsProvider;

import '../../helpers/fonts.dart';
import '../../helpers/golden_harness.dart';
import '../../unit/insights/support/insights_fixtures.dart';

/// The Night Sheet golden frame: 384 by 853 logical px at DPR 2.
const Size kInsightsSize = Size(384, 853);

final _evening = DateTime.utc(2026, 10, 13, 14, 30);

/// A stream that shows [fixed] and ignores open calls (the screen opens it on first frame).
class FixedStream extends StreamController {
  FixedStream(this.fixed);

  final StreamState fixed;

  @override
  StreamState build() => fixed;

  @override
  Future<void> open(StreamFilters filters) async {}

  @override
  void openSaved(questions, {int startAt = 0}) {}
}

class _FixedAsk extends AskController {
  _FixedAsk(this.fixed);

  final AskState fixed;

  @override
  AskState build() => fixed;
}

class _FixedSave extends SaveController {
  _FixedSave(this.fixed);

  final SaveMarks fixed;

  @override
  SaveMarks build() => fixed;
}

List<Override> insightsOverrides({
  RemoteState<PrepInsights>? insights,
  List<Attempt>? attempts,
  RemoteState<List<Attempt>>? attemptsState,
  bool pro = false,
  RemoteState<SavedList>? saved,
  StreamState? stream,
  AskState ask = const AskState(),
  AiCredits? credits,
  SaveMarks marks = const SaveMarks(),

  /// Leaves Ask's controller real (it sends through the api client the test supplies) instead of
  /// fixing its state to [ask].
  bool realAsk = false,
}) {
  final record = insights ?? RemoteState(value: rich(), fetchedAt: _evening);
  return [
    authSnapshotProvider.overrideWithBuild(
      (ref, n) => AuthSnapshot(status: AuthStatus.signedIn, userId: 'u1', name: 'Riya', isPro: pro, subjects: const ['accountancy', 'economics']),
    ),
    nowProvider.overrideWithValue(() => _evening),
    insightsRepositoryProvider.overrideWithBuild((ref, n) => record),
    insightsInputsProvider.overrideWithValue(
      InsightsInputs(insights: record, attempts: attempts ?? trendAttempts(), attemptsState: attemptsState, pro: pro),
    ),
    savedRepositoryProvider.overrideWithBuild((ref, n) => saved ?? const RemoteState()),
    creditsRepositoryProvider.overrideWithBuild(
      (ref, n) => RemoteState(value: credits ?? const AiCredits(state: 'available', wallet: AiWallet(known: true, spendable: 18))),
    ),
    saveControllerProvider.overrideWith(() => _FixedSave(marks)),
    // The account's saved repairs (the sheet's "Fix it for good" key reads them): none, with no network.
    serverRepairsProvider.overrideWith((ref) async => const <String, DateTime>{}),
    if (stream != null) streamControllerProvider.overrideWith(() => FixedStream(stream)),
    if (!realAsk) askControllerProvider.overrideWith(() => _FixedAsk(ask)),
  ];
}

/// Runs [build] once per theme as `goldens/<name>_<night|day>.png`.
void insightsGolden(
  String name,
  Widget Function() build, {
  List<Override> Function()? overrides,
  Size size = kInsightsSize,
  double textScale = 1,
  Future<void> Function(WidgetTester tester)? after,
}) {
  setUpAll(loadAppFonts);
  for (final brightness in [Brightness.dark, Brightness.light]) {
    final tag = brightness == Brightness.dark ? 'night' : 'day';
    testWidgets('$name, $tag', (tester) async {
      // Mobi greets once a day and speaks once a run, by a clock: a fixed evening and fresh gates
      // make every frame the same whatever order the goldens run in, or the hour they run at.
      MobiRation.reset();
      MobiRation.now = () => DateTime(2026, 10, 13, 19, 30);
      addTearDown(MobiRation.reset);
      final boundary = GlobalKey();
      await pumpMockmob(
        tester,
        RepaintBoundary(key: boundary, child: build()),
        brightness: brightness,
        size: size,
        textScale: textScale,
        disableAnimations: true,
        overrides: overrides?.call() ?? insightsOverrides(),
        wrapInScaffold: false,
      );
      await settleImages(tester);
      if (after != null) await after(tester);
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
