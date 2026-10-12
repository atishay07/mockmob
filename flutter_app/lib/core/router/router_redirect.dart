import '../auth/auth_state.dart';
import 'routes.dart';

/// Remembers where a signed-out (or not yet known) student was heading so sign-in can continue
/// there (spec 4.3). Held by the router; the auth feature may also `remember` a location of its
/// own, for example `/before-you-start`, which is then shown before the original target.
class IntendedRoute {
  String? _location;

  String? get location => _location;

  void remember(String location) => _location = location;

  /// Returns the remembered location once and forgets it.
  String? take() {
    final value = _location;
    _location = null;
    return value;
  }

  void clear() => _location = null;
}

/// The pure redirect decision of spec 4.2 and 4.3.
///
/// - `/dashboard` is an alias of `/today`.
/// - Auth state unknown: show `/splash`, remembering a deep-link target.
/// - Signed out: only the welcome, onboarding and sign-in flows. A deep link goes to
///   `/sign-in` and is continued after sign-in; anything else goes to `/welcome`.
/// - Signed in: leave the auth flows for the remembered target or `/today`.
String? resolveRedirect({required AuthSnapshot auth, required Uri uri, required IntendedRoute intended}) {
  final path = uri.path;

  if (path == AppRoutes.dashboard) return AppRoutes.today;

  final here = uri.hasQuery ? '$path?${uri.query}' : path;
  final isDeepTarget = !AppRoutes.isAuthPath(path) && path != AppRoutes.beforeYouStart && path != AppRoutes.today;

  switch (auth.status) {
    case AuthStatus.unknown:
      if (path == AppRoutes.splash) return null;
      if (isDeepTarget) intended.remember(here);
      return AppRoutes.splash;

    case AuthStatus.signedOut:
      if (AppRoutes.isAuthPath(path) && path != AppRoutes.splash) return null;
      if (isDeepTarget) {
        intended.remember(here);
        return AppRoutes.signIn;
      }
      // A session that expired mid-task goes straight to sign-in, where the banner explains it.
      if (auth.sessionExpired) {
        if (isDeepTarget) intended.remember(here);
        return AppRoutes.signIn;
      }
      return AppRoutes.welcome;

    case AuthStatus.signedIn:
      if (AppRoutes.isAuthPath(path)) return intended.take() ?? AppRoutes.today;
      return null;
  }
}
