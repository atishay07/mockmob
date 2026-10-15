import 'dart:async';
import 'dart:io' show Platform;

import 'package:app_links/app_links.dart';
import 'package:flutter/foundation.dart' show kDebugMode;
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../features/account_access/access_routes.dart';
import '../auth/auth_state.dart';
import '../widgets/mm_sheet.dart';
import 'action_router.dart';
import 'app_shell.dart';
import 'external_link_opener.dart';
import 'router_redirect.dart';
import 'routes.dart';
import 'screens.dart';
import 'transitions.dart';

/// Holds the location a signed-out student was heading to. Read by the auth feature to continue
/// after sign-in.
final intendedRouteProvider = Provider<IntendedRoute>((ref) => IntendedRoute());

/// The app's router. Every route of spec 4.2 is declared here; screens come from `screens.dart`.
/// The shell has four tabs (Today, Practice, Review, You) under the bar; Learn is pushed over it.
final routerProvider = Provider<GoRouter>((ref) {
  final rootKey = GlobalKey<NavigatorState>(debugLabel: 'root');
  final intended = ref.watch(intendedRouteProvider);
  final refresh = _AuthRefresh();
  // Who was signed in last, and whether the student just chose to sign out: the redirect that
  // follows must not remember the screen they left (see resolveRedirect).
  final startAuth = ref.read(authSnapshotProvider);
  String? lastUserId = startAuth.status == AuthStatus.signedIn ? startAuth.userId : null;
  var explicitSignOut = false;
  ref.listen<AuthSnapshot>(authSnapshotProvider, (previous, next) {
    if (next.status == AuthStatus.signedIn) {
      lastUserId = next.userId;
      explicitSignOut = false;
    } else if (previous?.status == AuthStatus.signedIn && next.status == AuthStatus.signedOut && !next.sessionExpired) {
      explicitSignOut = true;
    }
    refresh.notify();
  });

  final router = GoRouter(
    navigatorKey: rootKey,
    initialLocation: AppRoutes.splash,
    refreshListenable: refresh,
    redirect: (context, state) {
      final auth = ref.read(authSnapshotProvider);
      final leaving = explicitSignOut;
      // Only the redirect that follows the sign-out forgets; a link opened afterwards is a new
      // intention and is remembered as usual.
      explicitSignOut = false;
      return resolveRedirect(auth: auth, uri: state.uri, intended: intended, explicitSignOut: leaving, leavingUserId: lastUserId);
    },
    onException: (context, state, router) => _handleUnknown(ref, state.uri, router),
    routes: _routes(rootKey),
  );

  final links = _AppLinkRouting(ref, router, intended)..start(ref.read(appLinkSourceProvider));

  ref.onDispose(() {
    links.dispose();
    refresh.dispose();
    router.dispose();
  });
  return router;
});

/// Where verified https App Links (www.mockmob.in) come from. Replaceable in tests.
abstract interface class AppLinkSource {
  /// The link that launched the app, if any.
  Future<Uri?> initialLink();

  /// Links that arrive while the app runs.
  Stream<Uri> get links;
}

/// The platform's links through `app_links` (the same singleton the auth callback listens to).
/// Off under `flutter test`, where there is no platform channel.
class PlatformAppLinkSource implements AppLinkSource {
  const PlatformAppLinkSource();

  static bool get _testing => Platform.environment.containsKey('FLUTTER_TEST');

  @override
  Future<Uri?> initialLink() async {
    if (_testing) return null;
    try {
      return await AppLinks().getInitialLink();
    } on Object {
      return null;
    }
  }

  @override
  Stream<Uri> get links => _testing ? const Stream<Uri>.empty() : AppLinks().uriLinkStream;
}

final appLinkSourceProvider = Provider<AppLinkSource>((ref) => const PlatformAppLinkSource());

/// Sends each https link on our own domain through [ActionRouter] (spec 4.3): a native screen
/// opens with the router (or is remembered for after sign-in while auth is still loading), a
/// page with no native screen opens in a Custom Tab, anything else is ignored. The auth
/// callback (`in.mockmob.app://`) is the auth service's and is skipped here.
class _AppLinkRouting {
  _AppLinkRouting(this._ref, this._router, this._intended);

  final Ref _ref;
  final GoRouter _router;
  final IntendedRoute _intended;
  StreamSubscription<Uri>? _sub;
  bool _disposed = false;
  Uri? _last;
  DateTime? _lastAt;

  void start(AppLinkSource source) {
    // app_links also replays the launch link on the stream; [_handle] drops the repeat.
    _sub = source.links.listen(_handle, onError: (Object _) {});
    unawaited(source.initialLink().then((uri) {
      if (uri != null) _handle(uri);
    }, onError: (Object _) {}));
  }

  void _handle(Uri uri) {
    if (_disposed || uri.scheme != 'https') return;
    final now = DateTime.now();
    final at = _lastAt;
    if (uri == _last && at != null && now.difference(at) < const Duration(seconds: 3)) return;
    _last = uri;
    _lastAt = now;

    switch (ActionRouter.resolve(uri.toString())) {
      case NativeTarget(:final location):
        if (_ref.read(authSnapshotProvider).status == AuthStatus.unknown) {
          // The splash is still deciding; the redirect continues here after sign-in.
          _intended.remember(location);
        } else {
          // Signed in: open it. Signed out: the redirect remembers it and asks to sign in.
          _router.go(location);
        }
      case ExternalTarget(uri: final target):
        unawaited(_ref.read(externalLinkOpenerProvider).open(target));
      case UnsupportedTarget():
        break;
    }
  }

  void dispose() {
    _disposed = true;
    unawaited(_sub?.cancel());
  }
}

class _AuthRefresh extends ChangeNotifier {
  void notify() => notifyListeners();
}

/// An unmatched location: map it like an API href. A known web page opens the matching native
/// screen, our own pages open in a Custom Tab, anything else lands on Today.
void _handleUnknown(Ref ref, Uri uri, GoRouter router) {
  switch (ActionRouter.resolve(uri.toString())) {
    case NativeTarget(:final location):
      router.go(location);
    case ExternalTarget(uri: final target):
      ref.read(externalLinkOpenerProvider).open(target);
    case UnsupportedTarget():
      router.go(AppRoutes.today);
  }
}

List<RouteBase> _routes(GlobalKey<NavigatorState> rootKey) {
  GoRoute page(
    String path,
    GoRouterWidgetBuilder builder, {
    MmTransition transition = MmTransition.push,
    bool root = false,
    List<RouteBase> routes = const [],
  }) {
    return GoRoute(
      path: path,
      parentNavigatorKey: root ? rootKey : null,
      pageBuilder: (context, state) =>
          mmPage<void>(context: context, state: state, child: builder(context, state), transition: transition),
      routes: routes,
    );
  }

  GoRoute sheet(String path, GoRouterWidgetBuilder builder, {GoRouterWidgetBuilder? footer}) {
    return GoRoute(
      path: path,
      parentNavigatorKey: rootKey,
      pageBuilder: (context, state) =>
          MmSheetPage<void>(key: state.pageKey, footer: footer?.call(context, state), child: builder(context, state)),
    );
  }

  GoRoute tabRoot(String path, GoRouterWidgetBuilder builder, {List<RouteBase> routes = const []}) {
    return GoRoute(
      path: path,
      pageBuilder: (context, state) => mmTabRootPage<void>(context: context, state: state, child: builder(context, state)),
      routes: routes,
    );
  }

  return [
    // First run and auth.
    page(AppRoutes.splash, splashScreen, transition: MmTransition.fade),
    page(AppRoutes.loadFailed, authLoadFailedScreen, transition: MmTransition.fade),
    page(AppRoutes.welcome, welcomeScreen, transition: MmTransition.fade),
    page('/onboarding/subject', onboardingSubjectScreen),
    page('/onboarding/sample/result', onboardingSampleResultScreen),
    page('/onboarding/sample/:i', onboardingSampleScreen),
    page('/sign-in', signInScreen, routes: [
      page('code', signInCodeScreen),
      // Account access: password, forgot password and phone (account_access/access_routes.dart).
      page('password', passwordSignInScreen),
      page('forgot', forgotPasswordScreen),
      page('phone', phoneSignInScreen),
    ]),
    sheet(AppRoutes.beforeYouStart, beforeYouStartScreen),

    // The four tabs. Each branch keeps its own navigation stack and fades through on a switch.
    StatefulShellRoute(
      pageBuilder: (context, state, shell) => mmShellPage<void>(context: context, state: state, child: AppShell(shell: shell)),
      navigatorContainerBuilder: (context, shell, children) =>
          FadingBranchContainer(currentIndex: shell.currentIndex, children: children),
      branches: [
        StatefulShellBranch(routes: [
          tabRoot('/today', todayScreen, routes: [
            sheet('why/:actionId', todayWhyScreen),
            sheet('week', todayWeekScreen),
            sheet('alternatives', todayAlternativesScreen),
            page('weekly-ending', todayWeeklyEndingScreen, transition: MmTransition.fade, root: true),
          ]),
        ]),
        StatefulShellBranch(routes: [
          tabRoot('/practice', practiceScreen, routes: [
            // Over the dock like Start, so it can also be pushed from a page outside the shell
            // (Compass's Practise keys): a push of a route inside the shell from there would
            // build the shell a second time. Reached with `go`, Back still lands on Practice.
            page('setup/:mode', practiceSetupScreen, transition: MmTransition.container, root: true),
            // The untimed question stream (the website's Explore), full screen over the dock.
            page('stream', practiceStreamScreen, root: true),
            page('start', practiceStartScreen, transition: MmTransition.container, root: true),
            page('result/:attemptId', practiceResultScreen, transition: MmTransition.container, root: true),
          ]),
        ]),
        StatefulShellBranch(routes: [
          tabRoot('/review', reviewScreen, routes: [
            page('mistakes', reviewMistakesScreen),
            page('record', reviewRecordScreen),
            // The Rule book: over the dock, so the result page (outside the shell) can push it too.
            page('rules', reviewRulesScreen, root: true),
            page('insights', reviewInsightsScreen),
            page('saved', reviewSavedScreen),
            // Literal "ending" before the :questionId pattern.
            page('repair/:attemptId/ending', reviewRepairEndingScreen, transition: MmTransition.rise, root: true),
            page('repair/:attemptId/:questionId', reviewRepairScreen, transition: MmTransition.container, root: true),
          ]),
        ]),
        // You: the student's sheet, the CUET tools and settings. Its own pages cover the bar
        // (root pages), so their paths and transitions are unchanged.
        StatefulShellBranch(routes: [
          tabRoot(AppRoutes.you, youScreen, routes: [
            page('goal', youGoalScreen, root: true),
            page('rhythm', youRhythmScreen, root: true),
            page('notifications', youNotificationsScreen, root: true),
            page('privacy', youPrivacyScreen, root: true),
            page('account', youAccountScreen, root: true, routes: [
              // Set or reset the password (`?mode=reset` after a forgot-password code) and add a phone.
              page('password', setPasswordScreen, root: true),
              page('phone', addPhoneScreen, root: true),
            ]),
            page('delete', youDeleteScreen, root: true),
            page('milestones', youMilestonesScreen, transition: MmTransition.container, root: true),
            page('bests', youBestsScreen, root: true),
            page('appearance', youAppearanceScreen, root: true),
            page('help', youHelpScreen, root: true),
            page('subjects', youSubjectsScreen, root: true),
            page('sheet', youSheetScreen, root: true),
          ]),
        ]),
      ],
    ),

    // CUET tools: pushed from You, Practice and the quiet link under Today's road.
    page(AppRoutes.tools, toolsScreen, root: true, routes: [
      page('compass', toolsCompassScreen, root: true, routes: [
        page(':groupId', toolsProgrammeScreen, root: true),
      ]),
      page('combo', toolsComboScreen, root: true),
      page('guide-2027', toolsGuide2027Screen, root: true),
    ]),

    // Ask your record: from the record, the tools hub and the Start sheet.
    page(AppRoutes.ask, askScreen, root: true),

    // Learn is no longer a tab: its screens stay reachable from Practice (the Concepts shelf)
    // and from the mistakes they explain.
    page(AppRoutes.learn, learnScreen, root: true, routes: [
      // "run" before the :unitId pattern.
      page('run/:runId', learnRunScreen, root: true, routes: [
        page('done', learnRunDoneScreen, transition: MmTransition.fade, root: true),
      ]),
      // The chapter reader, before the :unitId pattern.
      page(LearnPaths.summaryTemplate, learnSummaryScreen, root: true),
      page(':unitId', learnUnitScreen, root: true),
    ]),

    // The design lab (debug builds only): every foundation component in both themes.
    if (kDebugMode) page(AppRoutes.lab, labScreen, root: true),

    // NTA mode's instructions, before the session exists (no dock, like the runner).
    page(AppRoutes.examNta, ntaInstructionsScreen, transition: MmTransition.fade, root: true),

    // Runner: fullscreen, 120 ms fade.
    page('/run/:sessionId', runScreen, transition: MmTransition.fade, root: true, routes: [
      page('submit', runSubmitScreen, transition: MmTransition.fade, root: true),
    ]),

    // Result and recap: focus pages that rise into place (results, endings and You rise; steps
    // sideways push).
    page('/result/:attemptId', resultScreen, transition: MmTransition.container, root: true, routes: [
      page('sealed', resultSealedScreen, transition: MmTransition.container, root: true),
      page('recap/:card', resultRecapScreen, transition: MmTransition.rise, root: true),
    ]),

    sheet(AppRoutes.permissionsNotifications, permissionsNotificationsScreen, footer: permissionsNotificationsFooter),

    // Web alias. The redirect also catches it; this keeps the path "known" to the router.
    GoRoute(path: AppRoutes.dashboard, redirect: (context, state) => AppRoutes.today),
  ];
}
