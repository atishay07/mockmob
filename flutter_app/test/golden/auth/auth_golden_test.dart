import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/auth/auth.dart';
import 'package:mockmob/core/config/app_config.dart';
import 'package:mockmob/core/connectivity/connectivity.dart';
import 'package:mockmob/features/auth/sign_in_code_screen.dart';
import 'package:mockmob/features/auth/sign_in_controller.dart';
import 'package:mockmob/features/auth/sign_in_screen.dart';
import 'package:mockmob/features/auth/sign_in_state.dart';

import '../../helpers/fonts.dart';
import '../../helpers/golden_harness.dart';
import '../../unit/auth/fakes.dart';

/// The real controller, started from a chosen state.
class _Preset extends SignInController {
  _Preset(this.initial);

  final SignInState initial;

  @override
  SignInState build() => initial;
}

final _clock = TestClock();

List<Override> _overrides(
  SignInState state, {
  NetworkStatus network = NetworkStatus.online,
  bool google = false,
  AuthSnapshot? auth,
  FakeGateway? gateway,
}) => [
  ...authOverrides(
    gateway: gateway ?? FakeGateway(),
    clock: _clock,
    network: network,
  ),
  signInControllerProvider.overrideWith(() => _Preset(state)),
  authSnapshotProvider.overrideWithBuild(
    (ref, notifier) => auth ?? AuthSnapshot.signedOut,
  ),
  if (google)
    appConfigProvider.overrideWithValue(
      const AppConfig(
        apiBaseUrl: 'x',
        supabaseUrl: 'x',
        supabaseAnonKey: 'x',
        googleWebClientId: 'web-id',
      ),
    ),
];

const _email = 'asha.verma@example.com';

SignInState get _afterSend => SignInState(
  email: _email,
  codeSentTo: _email,
  resendAvailableAt: _clock.value.add(const Duration(seconds: 37)),
);

Future<void> _emailShot(
  WidgetTester tester,
  Brightness b,
  String name,
  SignInState state, {
  NetworkStatus network = NetworkStatus.online,
  bool google = false,
  AuthSnapshot? auth,
}) async {
  await pumpMockmob(
    tester,
    const SignInScreen(autofocus: false),
    brightness: b,
    wrapInScaffold: false,
    disableAnimations: true,
    overrides: _overrides(state, network: network, google: google, auth: auth),
  );
  await expectLater(
    find.byType(MaterialApp),
    matchesGoldenFile('goldens/${name}_${b.name}.png'),
  );
}

Future<void> _codeShot(
  WidgetTester tester,
  Brightness b,
  String name,
  SignInState state, {
  String digits = '',
  bool focus = false,
  NetworkStatus network = NetworkStatus.online,
  FakeGateway? gateway,
}) async {
  await pumpMockmob(
    tester,
    SignInCodeScreen(email: _email, autofocus: focus),
    brightness: b,
    wrapInScaffold: false,
    disableAnimations: true,
    overrides: _overrides(state, network: network, gateway: gateway),
  );
  if (digits.isNotEmpty) {
    await tester.enterText(find.byType(TextField), digits);
    await tester.pump(const Duration(milliseconds: 200));
  }
  await expectLater(
    find.byType(MaterialApp),
    matchesGoldenFile('goldens/${name}_${b.name}.png'),
  );
}

void main() {
  setUpAll(loadAppFonts);

  for (final b in Brightness.values) {
    group('sign-in ${b.name}', () {
      testWidgets(
        'empty',
        (t) => _emailShot(t, b, 'sign_in_empty', const SignInState()),
      );

      testWidgets('filled with Google configured', (t) async {
        await _emailShot(
          t,
          b,
          'sign_in_filled_google',
          const SignInState(email: _email),
          google: true,
        );
      });

      testWidgets(
        'sending',
        (t) => _emailShot(
          t,
          b,
          'sign_in_sending',
          const SignInState(email: _email, busy: SignInBusy.sending),
        ),
      );

      testWidgets('bad address', (t) async {
        await _emailShot(
          t,
          b,
          'sign_in_error',
          const SignInState(
            email: 'asha.verma@',
            problem: SignInProblem.invalidEmail,
            problemStep: SignInStep.email,
            problemSerial: 1,
          ),
        );
      });

      testWidgets('rate limited with a code already sent', (t) async {
        await _emailShot(
          t,
          b,
          'sign_in_rate_limited',
          SignInState(
            email: _email,
            codeSentTo: _email,
            problem: SignInProblem.rateLimited,
            problemStep: SignInStep.email,
            problemSerial: 1,
            resendAvailableAt: _clock.value.add(const Duration(seconds: 60)),
          ),
        );
      });

      testWidgets(
        'offline',
        (t) => _emailShot(
          t,
          b,
          'sign_in_offline',
          const SignInState(email: _email),
          network: NetworkStatus.offline,
        ),
      );

      testWidgets('signed out because the session ended', (t) async {
        await _emailShot(
          t,
          b,
          'sign_in_session_expired',
          const SignInState(),
          auth: const AuthSnapshot(
            status: AuthStatus.signedOut,
            sessionExpired: true,
          ),
        );
      });
    });

    group('code ${b.name}', () {
      testWidgets(
        'empty and focused',
        (t) => _codeShot(t, b, 'code_empty', _afterSend, focus: true),
      );

      testWidgets(
        'partly typed',
        (t) => _codeShot(
          t,
          b,
          'code_partial',
          _afterSend,
          digits: '48201',
          focus: true,
        ),
      );

      testWidgets('wrong code', (t) async {
        await _codeShot(
          t,
          b,
          'code_error',
          _afterSend,
          digits: '48201736',
          gateway: FakeGateway()
            ..verifyError = failure(AuthFailure.invalidCode),
        );
      });

      testWidgets('signing in', (t) async {
        await _codeShot(
          t,
          b,
          'code_verifying',
          _afterSend,
          digits: '48201736',
          gateway: FakeGateway()..verifyHold = Completer<void>(),
        );
      });

      testWidgets('resend ready after a new code', (t) async {
        await _codeShot(
          t,
          b,
          'code_resend_ready',
          SignInState(
            email: _email,
            codeSentTo: _email,
            resendAvailableAt: _clock.value.subtract(
              const Duration(seconds: 1),
            ),
            codeResentNotice: true,
          ),
          focus: true,
        );
      });

      testWidgets(
        'offline',
        (t) => _codeShot(
          t,
          b,
          'code_offline',
          _afterSend,
          digits: '4820',
          network: NetworkStatus.offline,
        ),
      );
    });
  }
}
