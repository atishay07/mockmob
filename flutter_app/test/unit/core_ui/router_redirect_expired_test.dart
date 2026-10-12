import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/auth/auth_state.dart';
import 'package:mockmob/core/router/router_redirect.dart';
import 'package:mockmob/core/router/routes.dart';

void main() {
  const expired = AuthSnapshot(status: AuthStatus.signedOut, sessionExpired: true);

  test('an expired session goes to sign-in and remembers the target', () {
    final intended = IntendedRoute();
    expect(resolveRedirect(auth: expired, uri: Uri.parse('/practice'), intended: intended), AppRoutes.signIn);
    expect(intended.location, '/practice');
  });

  test('an expired session on a non-deep path goes to sign-in, a plain guest to welcome', () {
    expect(resolveRedirect(auth: expired, uri: Uri.parse('/today'), intended: IntendedRoute()), AppRoutes.signIn);
    expect(resolveRedirect(auth: AuthSnapshot.signedOut, uri: Uri.parse('/today'), intended: IntendedRoute()), AppRoutes.welcome);
  });
}
