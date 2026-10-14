import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/auth/auth.dart';
import 'package:mockmob/core/router/router.dart' show intendedRouteProvider;
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
      expect(
        s.hasCodeFor('asha@example.com'),
        isTrue,
        reason: 'the server limits codes per address, so one is already out',
      );
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
      'a new phone gets the after-sign-in sheet once, and never again',
      () async {
        final prefs = MemoryPrefsStore();
        final gateway = FakeGateway();
        final c = _container(gateway, prefs: prefs);
        final intended = c.read(intendedRouteProvider);
        c.read(signInControllerProvider.notifier).setEmail('asha@example.com');

        await c.read(signInControllerProvider.notifier).verify('12345678');
        expect(gateway.sheetLaunches, 1);
        expect(
          intended.location,
          isNull,
          reason: 'the router goes to Today and the sheet opens over it',
        );
        expect(await prefs.getBool('auth_before_you_start_offered'), isTrue);

        c.read(signInControllerProvider.notifier).setEmail('asha@example.com');
        await c.read(signInControllerProvider.notifier).verify('12345678');
        expect(gateway.sheetLaunches, 1, reason: 'the offer is once per phone');
      },
    );

    test('a deep link the student was heading to is kept', () async {
      final prefs = MemoryPrefsStore();
      final gateway = FakeGateway();
      final c = _container(gateway, prefs: prefs);
      final intended = c.read(intendedRouteProvider)..remember('/result/abc');
      c.read(signInControllerProvider.notifier).setEmail('asha@example.com');
      await c.read(signInControllerProvider.notifier).verify('12345678');
      expect(intended.location, '/result/abc');
      expect(gateway.sheetLaunches, 0);
      expect(await prefs.getBool('auth_before_you_start_offered'), isNull);
    });

    test(
      'a route left by another student\'s expired session does not cost a new student the sheet',
      () async {
        final prefs = MemoryPrefsStore();
        final gateway = FakeGateway()..signsInAs = 'u2';
        final c = _container(gateway, prefs: prefs);
        // What the redirect remembers when u1's session expires on /result/abc.
        c.read(intendedRouteProvider).remember('/result/abc', userId: 'u1');
        c.read(signInControllerProvider.notifier).setEmail('ravi@example.com');
        await c.read(signInControllerProvider.notifier).verify('12345678');
        expect(
          gateway.sheetLaunches,
          1,
          reason: 'u2 lands on Today, so the sheet opens over it',
        );
        expect(await prefs.getBool('auth_before_you_start_offered'), isTrue);
      },
    );

    test(
      'the same student back after an expiry returns to their route, with no sheet',
      () async {
        final prefs = MemoryPrefsStore();
        final gateway = FakeGateway()..signsInAs = 'u1';
        final c = _container(gateway, prefs: prefs);
        c.read(intendedRouteProvider).remember('/result/abc', userId: 'u1');
        c.read(signInControllerProvider.notifier).setEmail('asha@example.com');
        await c.read(signInControllerProvider.notifier).verify('12345678');
        expect(gateway.sheetLaunches, 0);
        expect(await prefs.getBool('auth_before_you_start_offered'), isNull);
      },
    );

    test(
      'Google: a route left by another student does not skip the sheet either',
      () async {
        final gateway = FakeGateway()..signsInAs = 'u2';
        final c = _container(gateway);
        c.read(intendedRouteProvider).remember('/result/abc', userId: 'u1');
        await c.read(signInControllerProvider.notifier).signInWithGoogle();
        expect(gateway.sheetLaunches, 1);
      },
    );

    test(
      'the decision survives the router taking the route as the account loads',
      () async {
        final gateway = FakeGateway()..signsInAs = 'u1';
        final hold = gateway.verifyHold = Completer<void>();
        final c = _container(gateway);
        final intended = c.read(intendedRouteProvider)
          ..remember('/result/abc', userId: 'u1');
        c.read(signInControllerProvider.notifier).setEmail('asha@example.com');
        final verifying = c
            .read(signInControllerProvider.notifier)
            .verify('12345678');
        await Future<void>.delayed(Duration.zero);
        // The redirect hands the route to u1 (and forgets it) before verify returns.
        expect(intended.take(userId: 'u1'), '/result/abc');
        hold.complete();
        await verifying;
        expect(
          gateway.sheetLaunches,
          0,
          reason: 'u1 went back to their result, not to Today',
        );
      },
    );

    test('a failed code opens nothing and remembers nothing', () async {
      final prefs = MemoryPrefsStore();
      final gateway = FakeGateway()
        ..verifyError = failure(AuthFailure.invalidCode);
      final c = _container(gateway, prefs: prefs);
      c.read(signInControllerProvider.notifier).setEmail('asha@example.com');
      await c.read(signInControllerProvider.notifier).verify('12345678');
      expect(gateway.sheetLaunches, 0);
      expect(c.read(intendedRouteProvider).location, isNull);
      expect(await prefs.getBool('auth_before_you_start_offered'), isNull);
    });
  });

  group('google', () {
    test('a cancel returns quietly with no message', () async {
      final gateway = FakeGateway()..googleOutcome = GoogleOutcome.cancelled;
      final c = _container(gateway);
      await c.read(signInControllerProvider.notifier).signInWithGoogle();
      final s = c.read(signInControllerProvider);
      expect(s.problem, isNull);
      expect(s.busy, SignInBusy.none);
      expect(gateway.sheetLaunches, 0);
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

    test('success opens the after-sign-in sheet on a new phone', () async {
      final gateway = FakeGateway();
      final c = _container(gateway);
      await c.read(signInControllerProvider.notifier).signInWithGoogle();
      expect(gateway.sheetLaunches, 1);
      expect(c.read(intendedRouteProvider).location, isNull);
    });

    test(
      'the browser opening is not a cancel: it waits for the callback link',
      () async {
        final gateway = FakeGateway()
          ..googleOutcome = GoogleOutcome.browserOpened;
        final c = _container(gateway);
        c.listen(signInControllerProvider, (_, _) {});
        await c.read(signInControllerProvider.notifier).signInWithGoogle();
        var s = c.read(signInControllerProvider);
        expect(
          s.googleInBrowser,
          isTrue,
          reason: 'finish-in-browser, not a quiet cancel',
        );
        expect(s.problem, isNull);
        expect(s.busy, SignInBusy.none);

        gateway.returns.add(const OAuthReturn(OAuthReturnKind.cancelled));
        await Future<void>.delayed(Duration.zero);
        s = c.read(signInControllerProvider);
        expect(s.googleInBrowser, isFalse);
        expect(s.problem, isNull);
      },
    );

    test('a failed browser return shows the Google line', () async {
      final gateway = FakeGateway()
        ..googleOutcome = GoogleOutcome.browserOpened;
      final c = _container(gateway);
      c.listen(signInControllerProvider, (_, _) {});
      await c.read(signInControllerProvider.notifier).signInWithGoogle();
      gateway.returns.add(const OAuthReturn(OAuthReturnKind.failed));
      await Future<void>.delayed(Duration.zero);
      final s = c.read(signInControllerProvider);
      expect(s.googleInBrowser, isFalse);
      expect(s.problem, SignInProblem.googleUnavailable);
    });

    test(
      'a browser sign-in that lands offers the sheet on a new phone',
      () async {
        final gateway = FakeGateway()
          ..googleOutcome = GoogleOutcome.browserOpened;
        final c = _container(gateway);
        c.listen(signInControllerProvider, (_, _) {});
        await c.read(signInControllerProvider.notifier).signInWithGoogle();
        gateway.returns.add(const OAuthReturn(OAuthReturnKind.signedIn));
        await Future<void>.delayed(Duration.zero);
        expect(gateway.sheetLaunches, 1);
      },
    );

    test(
      'the Google button on the sign-in screen offers the sheet once',
      () async {
        final gateway = FakeGateway();
        final prefs = MemoryPrefsStore();
        final c = _container(gateway, prefs: prefs);
        final notifier = c.read(signInControllerProvider.notifier);
        await notifier.googleSignedIn();
        await notifier.googleSignedIn();
        expect(gateway.sheetLaunches, 1);
      },
    );
  });

  group('the sheet after a sign-in on the sign-in screen', () {
    test(
      'a deep link remembered before the Google key was pressed wins, though the router took it first',
      () async {
        final prefs = MemoryPrefsStore();
        final gateway = FakeGateway();
        final c = _container(gateway, prefs: prefs);
        final intended = c.read(intendedRouteProvider)..remember('/result/abc');
        final notifier = c.read(signInControllerProvider.notifier)
          ..signInStarting();
        // The account loads and the redirect takes the link before the button's callback runs.
        expect(intended.take(userId: 'u1'), '/result/abc');
        await notifier.googleSignedIn();
        expect(
          gateway.sheetLaunches,
          0,
          reason: 'the student went to their result, not to Today',
        );
        expect(
          await prefs.getBool('auth_before_you_start_offered'),
          isNull,
          reason: 'the one sheet is still owed',
        );
      },
    );

    test(
      'a browser return waits for the account before offering the sheet',
      () async {
        final gateway = FakeGateway();
        final hold = gateway.accountHold = Completer<bool>();
        final c = _container(gateway);
        final offering = c
            .read(signInControllerProvider.notifier)
            .googleSignedIn();
        await Future<void>.delayed(Duration.zero);
        expect(
          gateway.sheetLaunches,
          0,
          reason: 'the profile is still loading',
        );
        hold.complete(true);
        await offering;
        expect(gateway.sheetLaunches, 1);
      },
    );

    test(
      'an account that never loads opens nothing and keeps the sheet owed',
      () async {
        final prefs = MemoryPrefsStore();
        final gateway = FakeGateway()..accountLoads = false;
        final c = _container(gateway, prefs: prefs);
        await c.read(signInControllerProvider.notifier).googleSignedIn();
        expect(gateway.sheetLaunches, 0);
        expect(await prefs.getBool('auth_before_you_start_offered'), isNull);
      },
    );

    test('a sheet that never got to open is offered again next time', () async {
      final prefs = MemoryPrefsStore();
      final gateway = FakeGateway()..sheetOpens = false;
      final c = _container(gateway, prefs: prefs);
      final notifier = c.read(signInControllerProvider.notifier);
      await notifier.googleSignedIn();
      expect(
        await prefs.getBool('auth_before_you_start_offered'),
        isNull,
        reason: 'Today never came',
      );
      await notifier.googleSignedIn();
      expect(gateway.sheetLaunches, 2);
    });
  });

  group('a browser sign-in from onboarding', () {
    test(
      'stops listening once it has an answer, so a later browser sign-in does not reopen the sheet',
      () async {
        final prefs = MemoryPrefsStore();
        final gateway = FakeGateway()
          ..googleOutcome = GoogleOutcome.browserOpened;
        final c = _container(gateway, prefs: prefs);
        c.listen(signInControllerProvider, (_, _) {});
        await c.read(signInControllerProvider.notifier).signInWithGoogle();
        gateway.returns.add(const OAuthReturn(OAuthReturnKind.signedIn));
        await pumpEventQueue();
        expect(gateway.sheetLaunches, 1);

        // Later: signed out, the phone forgets the offer (a new student), and a browser sign-in
        // starts from the sign-in screen, which handles its own return.
        await prefs.remove('auth_before_you_start_offered');
        gateway.returns.add(const OAuthReturn(OAuthReturnKind.signedIn));
        await pumpEventQueue();
        expect(gateway.sheetLaunches, 1, reason: 'the old listener is gone');

        gateway.returns.add(const OAuthReturn(OAuthReturnKind.failed));
        await pumpEventQueue();
        expect(
          c.read(signInControllerProvider).problem,
          isNull,
          reason: 'a later failure belongs to another screen',
        );
      },
    );

    test('a cancel ends the wait too', () async {
      final gateway = FakeGateway()
        ..googleOutcome = GoogleOutcome.browserOpened;
      final c = _container(gateway);
      c.listen(signInControllerProvider, (_, _) {});
      await c.read(signInControllerProvider.notifier).signInWithGoogle();
      gateway.returns.add(const OAuthReturn(OAuthReturnKind.cancelled));
      await pumpEventQueue();
      gateway.returns.add(const OAuthReturn(OAuthReturnKind.signedIn));
      await pumpEventQueue();
      expect(gateway.sheetLaunches, 0);
    });
  });

  group('a broken preferences store never holds sign-in', () {
    test('verify still signs in and does not stick on the spinner', () async {
      final gateway = FakeGateway();
      final c = ProviderContainer(
        overrides: authOverrides(gateway: gateway, prefs: BrokenPrefs()),
      );
      addTearDown(c.dispose);
      final notifier = c.read(signInControllerProvider.notifier)
        ..setEmail('asha@example.com');
      await notifier.verify('12345678');
      final s = c.read(signInControllerProvider);
      expect(gateway.verified, [('asha@example.com', '12345678')]);
      expect(s.busy, SignInBusy.none);
      expect(s.problem, isNull);
      expect(
        gateway.sheetLaunches,
        0,
        reason: 'an unreadable store answers no sheet',
      );
    });

    test('Google still signs in', () async {
      final gateway = FakeGateway();
      final c = ProviderContainer(
        overrides: authOverrides(gateway: gateway, prefs: BrokenPrefs()),
      );
      addTearDown(c.dispose);
      await c.read(signInControllerProvider.notifier).signInWithGoogle();
      expect(gateway.googleCalls, 1);
      expect(c.read(signInControllerProvider).busy, SignInBusy.none);
    });
  });
}
