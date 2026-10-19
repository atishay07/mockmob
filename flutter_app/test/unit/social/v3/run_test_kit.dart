// Harness for the run screen (R1 to R6): the fixture server on the fixed clock, the screen pumped
// WITHOUT the golden harness's image settling (so the fake clock starts at 0 and the countdown frames
// land on exact times), the art precached on the real event loop, and helpers that answer like a
// student does (pick, Lock in, Next) with the server's clock moved to a chosen run time.

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/api/api.dart';
import 'package:mockmob/core/theme/theme.dart';
import 'package:mockmob/dev/mob_v3_bank.dart';
import 'package:mockmob/features/social/v3/data/mob_v3_fake_server.dart';
import 'package:mockmob/features/social/v3/data/mob_v3_models.dart';
import 'package:mockmob/features/social/v3/screens/game_run_screen.dart';

import '../../../helpers/golden_harness.dart' show FileAssetBundle;
import 'mob_v3_test_kit.dart';

const String riyaSprint = 'game-riya-sprint';

/// The correct option of question [q] of Riya's sprint (bank questions 0 to 4), for tests only.
int correctOf(int q) => mobV3Bank[q].correct;

/// A wrong option of question [q].
int wrongOf(int q) => (correctOf(q) + 2) % 4;

/// The fixture server that records every answer call and can fail the first [failAnswers] of them
/// with a timeout (the "retry after a timeout" test).
class RecordingServer extends MobV3FakeServer {
  RecordingServer({super.scenario = 'heavy', this.failAnswers = 0}) : super(clock: () => v3Now) {
    answerDelay = Duration.zero;
  }

  int failAnswers;
  final List<(int, int)> calls = [];

  @override
  Future<AnswerResult> answer(String id, {required int q, required int pick}) async {
    calls.add((q, pick));
    if (failAnswers > 0) {
      failAnswers--;
      await Future<void>.delayed(answerDelay);
      throw const ApiError(kind: ApiErrorKind.timeout, code: 'timeout');
    }
    return super.answer(id, q: q, pick: pick);
  }
}

/// Pumps the run screen. The fake clock is at 0 when the countdown starts (one more pump starts it).
Future<void> pumpRun(
  WidgetTester tester,
  MobV3FakeServer server, {
  Brightness brightness = Brightness.dark,
  Size size = const Size(360, 780),
  double textScale = 1,
  bool reduced = false,
  String gameId = riyaSprint,
  List<Override> extra = const [],
}) async {
  loadFoldManifestForTest();
  tester.view.physicalSize = size * 2;
  tester.view.devicePixelRatio = 2;
  addTearDown(tester.view.reset);
  await tester.pumpWidget(
    ProviderScope(
      overrides: [...v3Overrides(server), ...extra],
      child: DefaultAssetBundle(
        bundle: FileAssetBundle(),
        child: MaterialApp(
          debugShowCheckedModeBanner: false,
          theme: buildTheme(Brightness.light),
          darkTheme: buildTheme(Brightness.dark),
          themeMode: brightness == Brightness.dark ? ThemeMode.dark : ThemeMode.light,
          builder: (context, app) => MediaQuery(
            data: MediaQuery.of(context).copyWith(textScaler: TextScaler.linear(textScale), disableAnimations: reduced),
            child: app!,
          ),
          home: GameRunScreen(gameId: gameId),
        ),
      ),
    ),
  );
  // The load runs after the first frame; the fixture server answers in microtasks.
  await tester.pump();
  await tester.pump();
}

/// Lets the images on screen decode on the real event loop, without moving the fake clock (each
/// pump here is a zero-length frame).
Future<void> precacheRunArt(WidgetTester tester, {int rounds = 10}) async {
  for (var i = 0; i < rounds; i++) {
    await tester.runAsync(() => Future<void>.delayed(const Duration(milliseconds: 60)));
    await tester.pump();
  }
}

/// Plays the countdown out (2700 ms) and lets the question rise.
Future<void> pastCountdown(WidgetTester tester) async {
  for (var i = 0; i < 60 && find.byKey(const ValueKey('run-countdown')).evaluate().isNotEmpty; i++) {
    await tester.pump(const Duration(milliseconds: 100));
  }
  await tester.pump(const Duration(milliseconds: 100));
}

Finder option(int i) => find.byKey(ValueKey('run-option-$i'));

/// Scrolls option [i] into view (long questions push it below the fold) and taps it.
Future<void> tapOption(WidgetTester tester, int i) async {
  await tester.ensureVisible(option(i));
  await tester.pump();
  await tester.tap(option(i));
}
Finder keyLabel(String text) => find.text(text);

/// Picks [pick] (or skips with -1) at run time [atSeconds] and waits for the server's answer.
Future<void> answerAt(WidgetTester tester, MobV3FakeServer server, {required int pick, required int atSeconds, bool next = true}) async {
  server.skew = Duration(seconds: atSeconds);
  if (pick < 0) {
    await tester.tap(find.byKey(const ValueKey('run-key-skip')));
  } else {
    await tapOption(tester, pick);
    await tester.pump(const Duration(milliseconds: 120));
    await tester.tap(find.byKey(const ValueKey('run-key-lock')));
  }
  await tester.pump();
  await tester.pump(const Duration(milliseconds: 50));
  await tester.pump(GameRunScreen.feedback);
  if (next) {
    await tester.tap(find.byKey(const ValueKey('run-key-next')));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 160));
    await tester.pump(const Duration(milliseconds: 220));
  }
}

/// Lets a pending future finish on the real loop when a test needs it.
Future<void> realDelay(WidgetTester tester, Duration d) => tester.runAsync(() => Future<void>.delayed(d));
