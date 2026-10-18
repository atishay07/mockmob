import 'package:flutter/material.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/auth/auth.dart';
import 'package:mockmob/core/config/app_config.dart';
import 'package:mockmob/core/connectivity/connectivity.dart';
import 'package:mockmob/core/widgets/widgets.dart' show Mobi;
import 'package:mockmob/core/router/routes.dart';
import 'package:mockmob/features/account_access/widgets/sign_in_methods.dart';
import 'package:mockmob/features/account_access/widgets/volt_key.dart';
import 'package:mockmob/features/auth/copy.dart';
import 'package:mockmob/features/auth/sign_in_controller.dart';
import 'package:mockmob/features/auth/sign_in_screen.dart';
import 'package:mockmob/features/auth/sign_in_state.dart';

import '../../helpers/fonts.dart';
import '../../helpers/golden_harness.dart';
import 'fakes.dart';

/// The v15 taste pass on sign-in (OWNER-TASTE-PROFILE.md #3, #8, #11).
class _Preset extends SignInController {
  _Preset(this.initial);

  final SignInState initial;

  @override
  SignInState build() => initial;
}

List<Override> _overrides() => [
  ...authOverrides(gateway: FakeGateway(), clock: TestClock(), network: NetworkStatus.online),
  signInControllerProvider.overrideWith(() => _Preset(const SignInState(email: 'asha.verma@example.com'))),
  authSnapshotProvider.overrideWithBuild((ref, notifier) => AuthSnapshot.signedOut),
  appConfigProvider.overrideWithValue(
    const AppConfig(apiBaseUrl: 'x', supabaseUrl: 'x', supabaseAnonKey: 'x', googleWebClientId: 'web-id'),
  ),
];

Future<void> _pump(WidgetTester tester, Widget screen, {bool keyboard = false}) async {
  if (keyboard) tester.view.viewInsets = const FakeViewPadding(bottom: 600);
  addTearDown(tester.view.reset);
  await pumpMockmob(tester, screen, size: const Size(360, 800), wrapInScaffold: false, overrides: _overrides());
  await tester.pump(const Duration(milliseconds: 300));
  await tester.pump(const Duration(milliseconds: 600));
}

void main() {
  setUpAll(loadAppFonts);

  test('the save step opens sign-in in its email-only mode', () {
    final uri = Uri.parse(AppRoutes.signInToSave);
    expect(uri.path, AppRoutes.signIn);
    expect(uri.queryParameters, {'from': 'save', 'method': 'email'});
  });

  testWidgets('from the save step: "Save your plan", the email form alone, "Email me the code"', (tester) async {
    await _pump(tester, const SignInScreen(autofocus: false, toSave: true));
    expect(find.text(AuthCopy.saveTitle), findsOneWidget);
    expect(find.text(AuthCopy.saveLead), findsOneWidget);
    expect(find.text(AuthCopy.signInTitle), findsNothing);
    expect(find.byType(SignInMethods), findsNothing, reason: 'no Google, divider or tabs a second time');
    expect(find.text(AuthCopy.continueWithGoogle), findsNothing);
    expect(find.widgetWithText(VoltKey, AuthCopy.emailMeCode), findsOneWidget);
    expect(find.text(AuthCopy.newHere), findsNothing, reason: 'the lead already says it');
  });

  testWidgets('the welcome path keeps every way in', (tester) async {
    await _pump(tester, const SignInScreen(autofocus: false));
    expect(find.text(AuthCopy.signInTitle), findsOneWidget);
    expect(find.byType(SignInMethods), findsOneWidget);
    expect(find.widgetWithText(VoltKey, AuthCopy.sendCode), findsOneWidget);
  });

  for (final toSave in [false, true]) {
    testWidgets('keyboard up (${toSave ? 'save' : 'sign in'}): Mobi steps aside, the key and the help stay in view', (tester) async {
      await _pump(tester, SignInScreen(autofocus: false, toSave: toSave), keyboard: true);
      expect(find.byType(Mobi), findsNothing, reason: 'never a clipped band under the status bar');
      final key = tester.getRect(find.byType(VoltKey));
      const keyboardTop = 800 - 300;
      expect(key.bottom, lessThanOrEqualTo(keyboardTop), reason: 'the one action is visible while typing');
      expect(key.top, greaterThan(0));
      if (!toSave) {
        final help = tester.getRect(find.text(AuthCopy.newHere));
        expect(help.top, greaterThan(0));
        expect(help.bottom, lessThanOrEqualTo(key.top), reason: 'the new-student line sits directly above the key');
      }
      // The keyboard goes down: Mobi comes back.
      tester.view.resetViewInsets();
      await tester.pump(const Duration(milliseconds: 300));
      await tester.pump(const Duration(milliseconds: 600));
      expect(find.byType(Mobi), findsOneWidget);
      expect(tester.takeException(), isNull);
    });
  }
}
