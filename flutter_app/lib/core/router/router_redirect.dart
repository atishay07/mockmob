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
  String? _owner;

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

  /// Remembers [location]. [userId] names the account the student was signed in as when the
  /// location was left behind (a session that expired mid-task): only that account continues
  /// there, so a different student signing in on the same phone never lands on it.
  void remember(String location, {String? userId}) {
    _location = location;
    _at = _clock();
    _owner = userId;
  }

  /// Returns the remembered location once and forgets it. A stale location is forgotten and
  /// null is returned. A location left behind by one account is never given to another: when
  /// [userId] differs from the account it was remembered for, it is dropped and null returned.
  String? take({String? userId}) {
    final value = location;
    final owner = _owner;
    clear();
    if (owner != null && owner != userId) return null;
    return value;
  }

  void clear() {
    _location = null;
    _at = null;
    _owner = null;
  }
}

/// The pure redirect decision of spec 4.2 and 4.3.
///
/// - `/dashboard` is an alias of `/today`.
/// - Auth state unknown: show `/splash`, remembering a deep-link target; when loading it failed
///   ([AuthSnapshot.loadFailed]) show `/load-failed` instead, which is reachable only then.
/// - Signed out: only the welcome, onboarding and sign-in flows. A deep link goes to
///   `/sign-in` and is continued after sign-in; anything else goes to `/welcome`. Leaving the
///   splash with a fresh remembered link goes to `/sign-in` too. Entering welcome or onboarding
///   forgets a remembered link: the student has started somewhere else.
/// - Signed in: leave the auth flows for the remembered target or `/today`, unless the target was
///   left behind by a different account.
///
/// [explicitSignOut] is true for the redirect that follows the student choosing Sign out or
/// deleting the account: the screen they were on is forgotten, never offered to whoever signs in
/// next. [leavingUserId] is the account that was signed in just before a signed-out state, so a
/// location remembered because its session expired continues only for that account.
String? resolveRedirect({
  required AuthSnapshot auth,
  required Uri uri,
  required IntendedRoute intended,
  bool explicitSignOut = false,
  String? leavingUserId,
}) {
  final path = uri.path;

  if (path == AppRoutes.dashboard) return AppRoutes.today;

  final here = uri.hasQuery ? '$path?${uri.query}' : path;
  final isDeepTarget = !AppRoutes.isAuthPath(path) &&
      path != AppRoutes.loadFailed &&
      path != AppRoutes.beforeYouStart &&
      path != AppRoutes.today;

  switch (auth.status) {
    case AuthStatus.unknown:
      // Loading the auth state failed: a calm retry screen instead of an endless splash.
      final target = auth.loadFailed ? AppRoutes.loadFailed : AppRoutes.splash;
      if (path == target) return null;
      if (isDeepTarget) intended.remember(here);
      return target;

    case AuthStatus.signedOut:
      if (explicitSignOut) {
        // The student chose to leave: nothing of this account's screens is remembered.
        intended.clear();
        if (path == AppRoutes.welcome || path.startsWith('/onboarding/')) return null;
        if (AppRoutes.isAuthPath(path) && path != AppRoutes.splash) return null;
        return AppRoutes.signIn;
      }
      // The load-failed screen only belongs to an unknown state.
      if (path == AppRoutes.loadFailed) return intended.location != null ? AppRoutes.signIn : AppRoutes.welcome;
      if (path == AppRoutes.welcome || path.startsWith('/onboarding/')) {
        intended.clear();
        return null;
      }
      if (AppRoutes.isAuthPath(path) && path != AppRoutes.splash) return null;
      if (isDeepTarget) {
        intended.remember(here, userId: auth.sessionExpired ? leavingUserId : null);
        return AppRoutes.signIn;
      }
      // A session that expired mid-task goes straight to sign-in, where the banner explains it.
      if (auth.sessionExpired) return AppRoutes.signIn;
      // A link remembered on a cold start (status unknown at the splash) continues to sign-in.
      if (path == AppRoutes.splash && intended.location != null) return AppRoutes.signIn;
      return AppRoutes.welcome;

    case AuthStatus.signedIn:
      if (path == AppRoutes.loadFailed || AppRoutes.isAuthPath(path)) return intended.take(userId: auth.userId) ?? AppRoutes.today;
      return null;
  }
}
