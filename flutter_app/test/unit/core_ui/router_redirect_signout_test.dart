import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/auth/auth_state.dart';
import 'package:mockmob/core/router/router_redirect.dart';
import 'package:mockmob/core/router/routes.dart';

const _signedIn = AuthSnapshot(status: AuthStatus.signedIn, userId: 'u2');

void main() {
  test('an explicit sign-out goes to sign-in and remembers nothing', () {
    final intended = IntendedRoute()..remember('/result/old');
    final to = resolveRedirect(
      auth: AuthSnapshot.signedOut,
      uri: Uri.parse('/you/account'),
      intended: intended,
      explicitSignOut: true,
      leavingUserId: 'u1',
    );
    expect(to, AppRoutes.signIn);
    expect(intended.location, isNull);
  });

  test('without the sign-out flag a signed-out deep link is still remembered', () {
    final intended = IntendedRoute();
    expect(resolveRedirect(auth: AuthSnapshot.signedOut, uri: Uri.parse('/result/abc'), intended: intended), AppRoutes.signIn);
    expect(intended.location, '/result/abc');
  });

  test('a location left by an expired session is only for the same account', () {
    const expired = AuthSnapshot(status: AuthStatus.signedOut, sessionExpired: true);
    final intended = IntendedRoute();
    resolveRedirect(auth: expired, uri: Uri.parse('/run/s1'), intended: intended, leavingUserId: 'u1');
    expect(intended.location, '/run/s1');

    // A different student signs in: the old session is not offered, and it is forgotten.
    expect(resolveRedirect(auth: _signedIn, uri: Uri.parse('/sign-in'), intended: intended), AppRoutes.today);
    expect(intended.location, isNull);

    resolveRedirect(auth: expired, uri: Uri.parse('/run/s1'), intended: intended, leavingUserId: 'u1');
    const same = AuthSnapshot(status: AuthStatus.signedIn, userId: 'u1');
    expect(resolveRedirect(auth: same, uri: Uri.parse('/sign-in'), intended: intended), '/run/s1');
  });

  test('a location with no owner (a link, a reminder) continues for anyone', () {
    final intended = IntendedRoute()..remember('/before-you-start');
    expect(resolveRedirect(auth: _signedIn, uri: Uri.parse('/sign-in'), intended: intended), '/before-you-start');
  });

  test('locationFor answers as take would, without forgetting', () {
    final intended = IntendedRoute()..remember('/run/s1', userId: 'u1');
    expect(intended.locationFor('u2'), isNull, reason: 'left by u1');
    expect(intended.locationFor('u1'), '/run/s1');
    expect(intended.location, '/run/s1', reason: 'still remembered');

    final anyone = IntendedRoute()..remember('/result/abc');
    expect(anyone.locationFor('u2'), '/result/abc');
    expect(anyone.locationFor(null), '/result/abc');
  });

  test('a snapshot keeps its answer after the router takes the original', () {
    var now = DateTime(2026, 10, 14, 21);
    final intended = IntendedRoute(clock: () => now)..remember('/run/s1', userId: 'u1');
    final copy = intended.snapshot();
    expect(intended.take(userId: 'u1'), '/run/s1');
    expect(intended.location, isNull);
    expect(copy.locationFor('u1'), '/run/s1');
    expect(copy.locationFor('u2'), isNull);

    now = now.add(IntendedRoute.defaultMaxAge + const Duration(seconds: 1));
    expect(copy.locationFor('u1'), isNull, reason: 'the copy goes stale like the original');
  });
}
