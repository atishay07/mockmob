import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/auth/auth_state.dart';
import 'package:mockmob/core/router/router_redirect.dart';

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
      expect(_redirect(AuthSnapshot.signedOut, '/splash', intended), '/welcome');
      expect(intended.location, '/result/abc');
      expect(_redirect(_signedIn, '/sign-in/code', intended), '/result/abc');
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
