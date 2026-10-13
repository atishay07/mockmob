import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/auth/auth_state.dart';
import 'package:mockmob/core/router/router_redirect.dart';

const _loadFailed = AuthSnapshot(status: AuthStatus.unknown, loadFailed: true);
const _signedIn = AuthSnapshot(status: AuthStatus.signedIn, userId: 'u1');

String? _redirect(AuthSnapshot auth, String location, [IntendedRoute? intended]) =>
    resolveRedirect(auth: auth, uri: Uri.parse(location), intended: intended ?? IntendedRoute());

void main() {
  group('dashboard alias', () {
    test('is Today in every auth state', () {
      for (final auth in [AuthSnapshot.unknown, AuthSnapshot.signedOut, _signedIn]) {
        expect(_redirect(auth, '/dashboard'), '/today');
      }
    });
  });

  group('auth state unknown', () {
    test('everything goes to the splash', () {
      expect(_redirect(AuthSnapshot.unknown, '/today'), '/splash');
      expect(_redirect(AuthSnapshot.unknown, '/welcome'), '/splash');
    });

    test('the splash stays', () {
      expect(_redirect(AuthSnapshot.unknown, '/splash'), isNull);
    });

    test('a deep link is remembered', () {
      final intended = IntendedRoute();
      expect(_redirect(AuthSnapshot.unknown, '/result/abc?x=1', intended), '/splash');
      expect(intended.location, '/result/abc?x=1');
    });

    test('Today and auth paths are not remembered', () {
      final intended = IntendedRoute();
      _redirect(AuthSnapshot.unknown, '/today', intended);
      _redirect(AuthSnapshot.unknown, '/sign-in', intended);
      expect(intended.location, isNull);
    });
  });

  group('auth load failed (unknown with loadFailed)', () {
    test('everything goes to /load-failed, which stays', () {
      expect(_redirect(_loadFailed, '/splash'), '/load-failed');
      expect(_redirect(_loadFailed, '/today'), '/load-failed');
      expect(_redirect(_loadFailed, '/welcome'), '/load-failed');
      expect(_redirect(_loadFailed, '/load-failed'), isNull);
    });

    test('a deep link is remembered, but /load-failed never is', () {
      final intended = IntendedRoute();
      expect(_redirect(_loadFailed, '/result/abc', intended), '/load-failed');
      expect(intended.location, '/result/abc');
      final other = IntendedRoute();
      _redirect(_loadFailed, '/load-failed', other);
      expect(other.location, isNull);
    });

    test('unknown without loadFailed still goes to the splash, and leaves /load-failed', () {
      expect(_redirect(AuthSnapshot.unknown, '/today'), '/splash');
      expect(_redirect(AuthSnapshot.unknown, '/load-failed'), '/splash');
    });

    test('once the state is known /load-failed goes to the normal target', () {
      expect(_redirect(AuthSnapshot.signedOut, '/load-failed'), '/welcome');
      expect(_redirect(_signedIn, '/load-failed'), '/today');
      final intended = IntendedRoute()..remember('/result/abc');
      expect(_redirect(AuthSnapshot.signedOut, '/load-failed', intended), '/sign-in');
      expect(_redirect(_signedIn, '/load-failed', intended), '/result/abc');
    });
  });

  group('signed out', () {
    test('the welcome, onboarding and sign-in flows are allowed', () {
      for (final path in [
        '/welcome',
        '/onboarding/subject',
        '/onboarding/sample/1',
        '/onboarding/sample/result',
        '/sign-in',
        '/sign-in/code?email=a%40b.in',
      ]) {
        expect(_redirect(AuthSnapshot.signedOut, path), isNull, reason: path);
      }
    });

    test('the splash and Today go to welcome', () {
      expect(_redirect(AuthSnapshot.signedOut, '/splash'), '/welcome');
      final intended = IntendedRoute();
      expect(_redirect(AuthSnapshot.signedOut, '/today', intended), '/welcome');
      expect(intended.location, isNull);
    });

    test('a deep link goes to sign-in and is remembered', () {
      final intended = IntendedRoute();
      expect(_redirect(AuthSnapshot.signedOut, '/result/abc', intended), '/sign-in');
      expect(intended.location, '/result/abc');
      expect(_redirect(AuthSnapshot.signedOut, '/review/mistakes', intended), '/sign-in');
      expect(intended.location, '/review/mistakes', reason: 'the newest link wins');
    });

    test('the sign-in sheets and app screens are not reachable', () {
      expect(_redirect(AuthSnapshot.signedOut, '/before-you-start'), '/welcome');
      expect(_redirect(AuthSnapshot.signedOut, '/run/s1'), '/sign-in');
    });
  });

  group('signed in', () {
    test('leaves the auth flows for Today', () {
      for (final path in ['/splash', '/welcome', '/onboarding/subject', '/sign-in', '/sign-in/code']) {
        expect(_redirect(_signedIn, path), '/today', reason: path);
      }
    });

    test('continues to the remembered link exactly once', () {
      final intended = IntendedRoute()..remember('/result/abc');
      expect(_redirect(_signedIn, '/sign-in/code', intended), '/result/abc');
      expect(intended.location, isNull);
      expect(_redirect(_signedIn, '/sign-in', intended), '/today');
    });

    test('app screens and sheets are untouched', () {
      for (final path in ['/today', '/practice/setup/quick', '/result/abc', '/before-you-start', '/you/delete']) {
        expect(_redirect(_signedIn, path), isNull, reason: path);
      }
    });
  });

  group('deep link through sign-in', () {
    test('cold start unknown, then signed out, then signed in', () {
      final intended = IntendedRoute();
      expect(_redirect(AuthSnapshot.unknown, '/result/abc', intended), '/splash');
      expect(_redirect(AuthSnapshot.signedOut, '/splash', intended), '/sign-in', reason: 'a remembered link goes to sign-in');
      expect(intended.location, '/result/abc');
      expect(_redirect(AuthSnapshot.signedOut, '/sign-in', intended), isNull);
      expect(_redirect(_signedIn, '/sign-in/code', intended), '/result/abc');
    });

    test('the splash with nothing remembered still goes to welcome', () {
      expect(_redirect(AuthSnapshot.signedOut, '/splash', IntendedRoute()), '/welcome');
    });
  });

  group('a remembered link goes stale (navigation-07)', () {
    test('it is dropped after about ten minutes', () {
      var now = DateTime(2026, 10, 13, 21);
      final intended = IntendedRoute(clock: () => now);
      expect(_redirect(AuthSnapshot.signedOut, '/result/abc', intended), '/sign-in');
      now = now.add(const Duration(minutes: 9, seconds: 59));
      expect(intended.location, '/result/abc');
      now = now.add(const Duration(seconds: 2));
      expect(intended.location, isNull);
      expect(_redirect(_signedIn, '/sign-in/code', intended), '/today', reason: 'an old link is not restored');
    });

    test('take returns null once stale, and forgets it', () {
      var now = DateTime(2026, 10, 13, 21);
      final intended = IntendedRoute(clock: () => now)..remember('/result/abc');
      now = now.add(IntendedRoute.defaultMaxAge + const Duration(seconds: 1));
      expect(intended.take(), isNull);
      now = now.subtract(const Duration(minutes: 20));
      expect(intended.location, isNull, reason: 'a stale link stays forgotten');
    });

    test('remembering again restarts the clock', () {
      var now = DateTime(2026, 10, 13, 21);
      final intended = IntendedRoute(clock: () => now)..remember('/a');
      now = now.add(const Duration(minutes: 8));
      intended.remember('/b');
      now = now.add(const Duration(minutes: 8));
      expect(intended.location, '/b');
    });

    test('entering welcome or onboarding forgets it', () {
      for (final path in ['/welcome', '/onboarding/subject', '/onboarding/sample/1']) {
        final intended = IntendedRoute()..remember('/result/abc');
        expect(_redirect(AuthSnapshot.signedOut, path, intended), isNull, reason: path);
        expect(intended.location, isNull, reason: path);
      }
    });

    test('the sign-in screens keep it', () {
      for (final path in ['/sign-in', '/sign-in/code', '/sign-in/password', '/sign-in/forgot', '/sign-in/phone']) {
        final intended = IntendedRoute()..remember('/result/abc');
        expect(_redirect(AuthSnapshot.signedOut, path, intended), isNull, reason: path);
        expect(intended.location, '/result/abc', reason: path);
      }
    });

    test('an unknown auth state on welcome does not forget it', () {
      final intended = IntendedRoute()..remember('/result/abc');
      expect(_redirect(AuthSnapshot.unknown, '/welcome', intended), '/splash');
      expect(intended.location, '/result/abc');
    });
  });

  group('IntendedRoute', () {
    test('take clears, clear clears', () {
      final intended = IntendedRoute()..remember('/a');
      expect(intended.take(), '/a');
      expect(intended.take(), isNull);
      intended.remember('/b');
      intended.clear();
      expect(intended.location, isNull);
    });
  });
}
