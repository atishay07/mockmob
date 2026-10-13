import '../auth/auth_state.dart';
import 'routes.dart';

/// Remembers where a signed-out (or not yet known) student was heading so sign-in can continue
/// there (spec 4.3). Held by the router; the auth feature may also `remember` a location of its
/// own, for example `/before-you-start`, which is then shown before the original target.
///
/// A remembered location is stamped and goes stale after [maxAge] (about ten minutes), so a link
/// tapped long ago is never restored after a later, unrelated sign-in. Entering the welcome or
/// onboarding flow also forgets it (see [resolveRedirect]).
class IntendedRoute {
  IntendedRoute({DateTime Function()? clock, this.maxAge = defaultMaxAge}) : _clock = clock ?? DateTime.now;

  static const Duration defaultMaxAge = Duration(minutes: 10);

  final DateTime Function() _clock;

  /// How long a remembered location stays usable.
  final Duration maxAge;

  String? _location;
  DateTime? _at;

  /// The remembered location, or null when nothing is remembered or it has gone stale.
  String? get location {
    final at = _at;
    if (_location == null || at == null) return null;
    if (_clock().difference(at) > maxAge) {
      clear();
      return null;
    }
    return _location;
  }

  void remember(String location) {
    _location = location;
    _at = _clock();
  }

  /// Returns the remembered location once and forgets it. A stale location is forgotten and
  /// null is returned.
  String? take() {
    final value = location;
    clear();
    return value;
  }

  void clear() {
    _location = null;
    _at = null;
  }
}

/// The pure redirect decision of spec 4.2 and 4.3.
///
/// - `/dashboard` is an alias of `/today`.
/// - Auth state unknown: show `/splash`, remembering a deep-link target.
/// - Signed out: only the welcome, onboarding and sign-in flows. A deep link goes to
///   `/sign-in` and is continued after sign-in; anything else goes to `/welcome`. Leaving the
///   splash with a fresh remembered link goes to `/sign-in` too. Entering welcome or onboarding
///   forgets a remembered link: the student has started somewhere else.
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
      if (path == AppRoutes.welcome || path.startsWith('/onboarding/')) {
        intended.clear();
        return null;
      }
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
      // A link remembered on a cold start (status unknown at the splash) continues to sign-in.
      if (path == AppRoutes.splash && intended.location != null) return AppRoutes.signIn;
      return AppRoutes.welcome;

    case AuthStatus.signedIn:
      if (AppRoutes.isAuthPath(path)) return intended.take() ?? AppRoutes.today;
      return null;
  }
}
