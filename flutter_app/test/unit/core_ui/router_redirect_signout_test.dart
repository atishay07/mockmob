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
}
