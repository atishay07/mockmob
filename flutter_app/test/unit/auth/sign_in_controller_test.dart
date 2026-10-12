import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/auth/auth.dart';
import 'package:mockmob/core/router/router.dart' show intendedRouteProvider;
import 'package:mockmob/core/router/routes.dart';
import 'package:mockmob/core/storage/prefs_store.dart';
import 'package:mockmob/features/auth/sign_in_controller.dart';
import 'package:mockmob/features/auth/sign_in_state.dart';

import 'fakes.dart';

ProviderContainer _container(
  FakeGateway gateway, {
  MemoryPrefsStore? prefs,
  TestClock? clock,
}) {
  final c = ProviderContainer(
    overrides: authOverrides(gateway: gateway, prefs: prefs, clock: clock),
  );
  addTearDown(c.dispose);
  return c;
}

void main() {
  group('email validation', () {
    test('accepts a normal address and ignores case and spaces around it', () {
      expect(isValidEmail('  Asha@Example.com '), isTrue);
      expect(normalizeEmail('  Asha@Example.com '), 'asha@example.com');
    });

    test('rejects text without an at sign or a dot after it', () {
      expect(isValidEmail('asha'), isFalse);
      expect(isValidEmail('asha@example'), isFalse);
      expect(isValidEmail('a b@example.com'), isFalse);
      expect(isValidEmail(''), isFalse);
    });
  });

  group('send code', () {
    test(
      'a bad address never reaches the network and the text is kept',
      () async {
        final gateway = FakeGateway();
        final c = _container(gateway);
        final notifier = c.read(signInControllerProvider.notifier)
          ..setEmail('asha@');
        expect(await notifier.sendCode(step: SignInStep.email), isFalse);
        final s = c.read(signInControllerProvider);
        expect(gateway.sent, isEmpty);
        expect(s.problem, SignInProblem.invalidEmail);
        expect(s.problemStep, SignInStep.email);
        expect(s.email, 'asha@');
      },
    );

    test(
      'success remembers the address and starts a 60 second cooldown',
      () async {
        final clock = TestClock();
        final gateway = FakeGateway();
        final c = _container(gateway, clock: clock);
        final notifier = c.read(signInControllerProvider.notifier)
          ..setEmail(' Asha@Example.com ');
        expect(await notifier.sendCode(step: SignInStep.email), isTrue);
        final s = c.read(signInControllerProvider);
        expect(gateway.sent, ['asha@example.com']);
        expect(s.codeSentTo, 'asha@example.com');
        expect(
          s.resendAvailableAt,
          clock.value.add(const Duration(seconds: 60)),
        );
        expect(s.busy, SignInBusy.none);
        expect(s.problem, isNull);
        expect(s.hasCodeFor('asha@example.com'), isTrue);
      },
    );

    test(
      'a resend from the code screen says a new code is on its way',
      () async {
        final c = _container(FakeGateway());
        final notifier = c.read(signInControllerProvider.notifier)
          ..setEmail('asha@example.com');
        await notifier.sendCode(step: SignInStep.code);
        expect(c.read(signInControllerProvider).codeResentNotice, isTrue);
      },
    );

    test('a rate limit keeps the email and restarts the wait', () async {
      final clock = TestClock();
      final gateway = FakeGateway()
        ..sendError = failure(AuthFailure.rateLimited);
      final c = _container(gateway, clock: clock);
      final notifier = c.read(signInControllerProvider.notifier)
        ..setEmail('asha@example.com');
      expect(await notifier.sendCode(step: SignInStep.email), isFalse);
      final s = c.read(signInControllerProvider);
      expect(s.problem, SignInProblem.rateLimited);
      expect(s.email, 'asha@example.com');
      expect(s.resendAvailableAt, clock.value.add(const Duration(seconds: 60)));
    });

    test(
      'offline and unknown failures keep the work and are not raw errors',
      () async {
        final gateway = FakeGateway()..sendError = failure(AuthFailure.offline);
        final c = _container(gateway);
        final notifier = c.read(signInControllerProvider.notifier)
          ..setEmail('asha@example.com');
        await notifier.sendCode(step: SignInStep.email);
        expect(c.read(signInControllerProvider).problem, SignInProblem.offline);

        gateway.sendError = StateError('{"ok":false,"message":"boom"}');
        await notifier.sendCode(step: SignInStep.email);
        expect(c.read(signInControllerProvider).problem, SignInProblem.unknown);
        expect(c.read(signInControllerProvider).email, 'asha@example.com');
      },
    );

    test('typing in the email clears an email problem', () async {
      final c = _container(FakeGateway());
      final notifier = c.read(signInControllerProvider.notifier)
        ..setEmail('asha@');
      await notifier.sendCode(step: SignInStep.email);
      notifier.setEmail('asha@example.com');
      expect(c.read(signInControllerProvider).problem, isNull);
    });

    test('a second tap while sending is ignored', () async {
      final gateway = FakeGateway();
      final c = _container(gateway);
      final notifier = c.read(signInControllerProvider.notifier)
        ..setEmail('asha@example.com');
      final first = notifier.sendCode(step: SignInStep.email);
      final second = await notifier.sendCode(step: SignInStep.email);
      await first;
      expect(second, isFalse);
      expect(gateway.sent, hasLength(1));
    });
  });

  group('verify', () {
    test(
      'a wrong code keeps the email, names the fix and allows another try',
      () async {
        final gateway = FakeGateway()
          ..verifyError = failure(AuthFailure.invalidCode);
        final c = _container(gateway);
        final notifier = c.read(signInControllerProvider.notifier)
          ..setEmail('asha@example.com');
        await notifier.verify('12345678');
        var s = c.read(signInControllerProvider);
        expect(s.problem, SignInProblem.invalidCode);
        expect(s.problemStep, SignInStep.code);
        expect(s.email, 'asha@example.com');
        expect(s.busy, SignInBusy.none);
        final serial = s.problemSerial;

        await notifier.verify('12345678');
        s = c.read(signInControllerProvider);
        expect(
          s.problemSerial,
          greaterThan(serial),
          reason: 'the nudge replays on a repeat',
        );
        expect(gateway.verified, hasLength(2));
      },
    );

    test('fewer than eight digits is not sent', () async {
      final gateway = FakeGateway();
      final c = _container(gateway);
      c.read(signInControllerProvider.notifier).setEmail('asha@example.com');
      await c.read(signInControllerProvider.notifier).verify('1234567');
      expect(gateway.verified, isEmpty);
    });

    test(
      'a signed-in account that did not load keeps the work and says so',
      () async {
        final gateway = FakeGateway()..signedInAfterVerify = false;
        final c = _container(gateway);
        final notifier = c.read(signInControllerProvider.notifier)
          ..setEmail('asha@example.com');
        await notifier.verify('12345678');
        final s = c.read(signInControllerProvider);
        expect(s.problem, SignInProblem.accountNotLoaded);
        expect(s.email, 'asha@example.com');
      },
    );

    test(
      'success resets the screens so the next account starts clean',
      () async {
        final gateway = FakeGateway();
        final c = _container(gateway);
        final notifier = c.read(signInControllerProvider.notifier)
          ..setEmail('asha@example.com');
        await notifier.sendCode(step: SignInStep.email);
        await notifier.verify('12345678');
        final s = c.read(signInControllerProvider);
        expect(s.email, isEmpty);
        expect(s.codeSentTo, isNull);
      },
    );
  });

  group('continue after sign-in', () {
    test(
      'a new phone is sent to before you start once, and never again',
      () async {
        final prefs = MemoryPrefsStore();
        final gateway = FakeGateway();
        final c = _container(gateway, prefs: prefs);
        final intended = c.read(intendedRouteProvider);
        c.read(signInControllerProvider.notifier).setEmail('asha@example.com');

        await c.read(signInControllerProvider.notifier).verify('12345678');
        expect(intended.location, AppRoutes.beforeYouStart);
        expect(await prefs.getBool('auth_before_you_start_offered'), isTrue);

        intended.clear();
        c.read(signInControllerProvider.notifier).setEmail('asha@example.com');
        await c.read(signInControllerProvider.notifier).verify('12345678');
        expect(
          intended.location,
          isNull,
          reason: 'the offer is once per phone',
        );
      },
    );

    test('a deep link the student was heading to is kept', () async {
      final prefs = MemoryPrefsStore();
      final c = _container(FakeGateway(), prefs: prefs);
      final intended = c.read(intendedRouteProvider)..remember('/result/abc');
      c.read(signInControllerProvider.notifier).setEmail('asha@example.com');
      await c.read(signInControllerProvider.notifier).verify('12345678');
      expect(intended.location, '/result/abc');
      expect(await prefs.getBool('auth_before_you_start_offered'), isNull);
    });

    test('a failed code takes the remembered offer back', () async {
      final gateway = FakeGateway()
        ..verifyError = failure(AuthFailure.invalidCode);
      final c = _container(gateway);
      final intended = c.read(intendedRouteProvider);
      c.read(signInControllerProvider.notifier).setEmail('asha@example.com');
      await c.read(signInControllerProvider.notifier).verify('12345678');
      expect(intended.location, isNull);
    });
  });

  group('google', () {
    test('a cancel returns quietly with no message', () async {
      final gateway = FakeGateway()..googleResult = false;
      final c = _container(gateway);
      await c.read(signInControllerProvider.notifier).signInWithGoogle();
      final s = c.read(signInControllerProvider);
      expect(s.problem, isNull);
      expect(s.busy, SignInBusy.none);
      expect(c.read(intendedRouteProvider).location, isNull);
    });

    test('a failure shows the Google line on the email screen', () async {
      final gateway = FakeGateway()
        ..googleError = failure(AuthFailure.googleUnavailable);
      final c = _container(gateway);
      await c.read(signInControllerProvider.notifier).signInWithGoogle();
      final s = c.read(signInControllerProvider);
      expect(s.problem, SignInProblem.googleUnavailable);
      expect(s.problemStep, SignInStep.email);
    });

    test('success continues to before you start on a new phone', () async {
      final c = _container(FakeGateway());
      await c.read(signInControllerProvider.notifier).signInWithGoogle();
      expect(c.read(intendedRouteProvider).location, AppRoutes.beforeYouStart);
    });
  });
}
