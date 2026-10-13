import 'dart:convert';
import 'dart:io';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/api/api_providers.dart';
import 'package:mockmob/core/auth/auth_state.dart';
import 'package:mockmob/core/config/app_config.dart';
import 'package:mockmob/core/connectivity/connectivity.dart';
import 'package:mockmob/core/storage/app_prefs.dart';
import 'package:mockmob/core/storage/prefs_store.dart';
import 'package:mockmob/core/storage/storage_providers.dart';
import 'package:mockmob/core/theme/theme.dart';
import 'package:mockmob/core/widgets/widgets.dart';
import 'package:mockmob/features/onboarding/data/subjects.dart';
import 'package:mockmob/features/onboarding/model/answers.dart';
import 'package:mockmob/features/onboarding/model/choices.dart';
import 'package:mockmob/features/onboarding/model/deck.dart';
import 'package:mockmob/features/onboarding/state/answers_store.dart';

import '../../helpers/fonts.dart';
import '../../helpers/golden_harness.dart';
import '../../unit/auth/fakes.dart' show FakeNetwork;
import '../../unit/core_data/support/fakes.dart';

/// The Night Sheet frame: 384 by 853 at DPR 2.
const Size kPhone = Size(384, 853);

/// A Tuesday evening in October 2026: 29 weeks to the expected May 2027 window.
final DateTime kNow = DateTime(2026, 10, 13, 21, 40);

/// A Class 12 B.Com (Hons) student part way through: answers up to and including [upTo].
OnboardingAnswers studentUpTo(String upTo, {String? step}) {
  const order = [Steps.stage, Steps.course, Steps.subjects, Steps.worry, Steps.question, Steps.rhythm, Steps.plan];
  final n = order.indexOf(upTo) + 1;
  var a = OnboardingAnswers(step: step ?? upTo);
  if (n >= 1) a = a.copyWith(stage: Stage.classTwelve).mark(Steps.stage);
  if (n >= 2) {
    a = a.copyWith(
      courseId: 'b-com-hons',
      colleges: const ['Shri Ram College of Commerce', 'Hindu College', 'Hansraj College'],
      subjects: const [SheetSubject.english, SheetSubject.accountancy, SheetSubject.businessStudies, SheetSubject.economics],
    ).mark(Steps.course);
  }
  if (n >= 3) {
    a = a.copyWith(confidence: const {
      SheetSubject.accountancy: Confidence.shaky,
      SheetSubject.economics: Confidence.okay,
      SheetSubject.businessStudies: Confidence.okay,
      SheetSubject.english: Confidence.strong,
    }).mark(Steps.subjects);
  }
  if (n >= 4) a = a.copyWith(worry: Worry.knewIt).mark(Steps.worry);
  if (n >= 5) a = a.copyWith(warmup: const WarmupResult(questionId: 'acc-1', chosen: 0, correct: true, millis: 41000)).mark(Steps.question);
  if (n >= 6) a = a.mark(Steps.rhythm);
  if (n >= 7) a = a.copyWith(sealedAt: kNow).mark(Steps.plan);
  return a;
}

/// Overrides for a signed-out phone with [answers] stored, a fixed clock and Google on.
List<Override> onboardingOverrides({
  OnboardingAnswers answers = OnboardingAnswers.empty,
  AuthSnapshot auth = AuthSnapshot.signedOut,
  NetworkStatus network = NetworkStatus.online,
  bool google = true,
  FakeHttpAdapter? http,
  DateTime? now,
}) {
  final store = MemoryPrefsStore();
  store.values[AnswersStore.key] = jsonEncode(answers.toJson());
  final appPrefs = MemoryPrefsStore();
  return [
    answersStoreProvider.overrideWithValue(AnswersStore(store)),
    nowProvider.overrideWithValue(() => now ?? kNow),
    authSnapshotProvider.overrideWithBuild((ref, notifier) => auth),
    networkStatusProvider.overrideWith(() => FakeNetwork(network)),
    appPrefsProvider.overrideWithValue(AppPrefs(appPrefs)),
    shouldPlayColdOpenProvider.overrideWith((ref) async => false),
    apiClientProvider.overrideWithValue(newApiClient(http ?? FakeHttpAdapter())),
    appConfigProvider.overrideWithValue(
      AppConfig(apiBaseUrl: 'https://example.test', supabaseUrl: '', supabaseAnonKey: '', googleWebClientId: google ? 'test' : ''),
    ),
  ];
}

/// Runs a golden of [build] in Night and Daylight, named `<name>_<night|day>.png`, at phone size
/// with a status bar and gesture inset. With `MM_PREVIEW_DIR` set, also writes a DPR 2 render.
void onboardingGolden(
  String name,
  Widget Function() build, {
  List<Override> Function()? overrides,
  Size size = kPhone,
  double textScale = 1,
  Future<void> Function(WidgetTester tester)? act,
}) {
  setUpAll(loadAppFonts);
  for (final brightness in [Brightness.dark, Brightness.light]) {
    final tag = brightness == Brightness.dark ? 'night' : 'day';
    testWidgets('$name, $tag', (tester) async {
      tester.view.padding = const FakeViewPadding(top: 56, bottom: 40);
      final boundary = GlobalKey();
      await pumpMockmob(
        tester,
        RepaintBoundary(
          key: boundary,
          child: Builder(builder: (context) => ColoredBox(color: context.mmColors.ground, child: build())),
        ),
        brightness: brightness,
        size: size,
        textScale: textScale,
        disableAnimations: true,
        overrides: overrides?.call() ?? onboardingOverrides(),
      );
      if (act != null) {
        await act(tester);
        await settleImages(tester);
      }
      await expectLater(find.byType(Scaffold).first, matchesGoldenFile('goldens/${name}_$tag.png'));
      await preview(tester, boundary, '${name}_$tag');
    });
  }
}

/// Writes a DPR 2 render of [key] to `MM_PREVIEW_DIR`, when set. Not part of the comparison.
Future<void> preview(WidgetTester tester, GlobalKey key, String name) async {
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
