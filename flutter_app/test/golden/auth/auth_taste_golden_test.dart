import 'package:flutter/material.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/auth/auth.dart';
import 'package:mockmob/core/config/app_config.dart';
import 'package:mockmob/core/connectivity/connectivity.dart';
import 'package:mockmob/features/auth/sign_in_controller.dart';
import 'package:mockmob/features/auth/sign_in_screen.dart';
import 'package:mockmob/features/auth/sign_in_state.dart';

import '../../helpers/fonts.dart';
import '../../helpers/golden_harness.dart';
import '../../unit/auth/fakes.dart';

/// The v15 taste pass on sign-in (OWNER-TASTE-PROFILE.md): "Use an email code" from the save
/// step opens "Save your plan" with the email form alone, and with the keyboard up Mobi steps
/// aside and the volt key stays in view above it. 360 by 800 and 412 by 915, Night and Day.
class _Preset extends SignInController {
  _Preset(this.initial);

  final SignInState initial;

  @override
  SignInState build() => initial;
}

final _clock = TestClock();

List<Override> _overrides({bool google = true}) => [
  ...authOverrides(gateway: FakeGateway(), clock: _clock, network: NetworkStatus.online),
  signInControllerProvider.overrideWith(() => _Preset(const SignInState(email: 'asha.verma@example.com'))),
  authSnapshotProvider.overrideWithBuild((ref, notifier) => AuthSnapshot.signedOut),
  if (google)
    appConfigProvider.overrideWithValue(
      const AppConfig(apiBaseUrl: 'x', supabaseUrl: 'x', supabaseAnonKey: 'x', googleWebClientId: 'web-id'),
    ),
];

const Map<String, Size> _sizes = {'360': Size(360, 800), '412': Size(412, 915)};

Future<void> _shot(
  WidgetTester tester,
  Brightness b,
  String name,
  Widget screen, {
  Size size = const Size(360, 800),
  bool keyboard = false,
  double textScale = 1,
}) async {
  tester.view.padding = const FakeViewPadding(top: 56, bottom: 40);
  if (keyboard) tester.view.viewInsets = const FakeViewPadding(bottom: 600);
  addTearDown(tester.view.reset);
  await pumpMockmob(
    tester,
    screen,
    brightness: b,
    size: size,
    textScale: textScale,
    wrapInScaffold: false,
    disableAnimations: true,
    overrides: _overrides(),
  );
  // Mobi steps aside, then the key is brought above the keyboard.
  await tester.pump(const Duration(milliseconds: 300));
  await tester.pump(const Duration(milliseconds: 600));
  await expectLater(find.byType(MaterialApp), matchesGoldenFile('goldens/${name}_${b.name}.png'));
}

void main() {
  setUpAll(loadAppFonts);

  for (final b in Brightness.values) {
    group('taste ${b.name}', () {
      for (final e in _sizes.entries) {
        testWidgets('save your plan, ${e.key}', (t) => _shot(t, b, 'taste_save_plan_${e.key}', const SignInScreen(autofocus: false, toSave: true), size: e.value));
        testWidgets(
          'save your plan, keyboard up, ${e.key}',
          (t) => _shot(t, b, 'taste_save_plan_keyboard_${e.key}', const SignInScreen(autofocus: false, toSave: true), size: e.value, keyboard: true),
        );
        testWidgets(
          'sign in, keyboard up, ${e.key}',
          (t) => _shot(t, b, 'taste_sign_in_keyboard_${e.key}', const SignInScreen(autofocus: false), size: e.value, keyboard: true),
        );
      }
      testWidgets(
        'save your plan, large text',
        (t) => _shot(t, b, 'taste_save_plan_large_text', const SignInScreen(autofocus: false, toSave: true), textScale: 1.3),
      );
    });
  }
}
