import 'dart:async';
import 'dart:io' show Platform;

import 'package:app_links/app_links.dart';
import 'package:flutter/foundation.dart' show kDebugMode;
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../features/account_access/access_routes.dart';
import '../../features/billing/widgets/pro_page.dart' show proPageScreen;
import '../../features/nudges/data/nudge_store.dart' show nudgeCalmProvider;
import '../../features/pro_nudge/pro_nudge.dart' show ArmRules, ShellPlace, proNudgeProvider;
import '../../features/referrals/referral_data.dart' show pendingInviteStoreProvider;
import '../../features/social/mob_routes.dart';
import '../auth/auth_links.dart';
import '../auth/auth_state.dart';
import '../widgets/account/account_avatar.dart' show PushedPageMarker;
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
/// The shell has four tabs (Today, Practice, Mob, You) under the bar, with Start as the bar's centre
/// key between Practice and Mob (D105). Your papers (the Review screen) lives inside Practice;
/// Colleges, Learn and the CUET tools are pages pushed over the bar.
final routerProvider = Provider<GoRouter>((ref) {
  final rootKey = GlobalKey<NavigatorState>(debugLabel: 'root');
  final intended = ref.watch(intendedRouteProvider);
  final refresh = _AuthRefresh();
  // The routes whose page is a modal sheet: reaching one is never a page the student left (D181 arming).
  final sheets = <RouteBase>{};
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
    routes: _routes(rootKey, sheets),
  );

  final links = _AppLinkRouting(ref, router, intended)..start(ref.read(appLinkSourceProvider));
  final places = _PlaceReporter(ref, router, sheets);

  ref.onDispose(() {
    places.dispose();
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
    // The emailed sign-in link is the auth service's (it signs in); never a page to open.
    if (AuthLinks.isEmailLink(uri)) return;
    final now = DateTime.now();
    final at = _lastAt;
    if (uri == _last && at != null && now.difference(at) < const Duration(seconds: 3)) return;
    _last = uri;
    _lastAt = now;
    // A friend's invite (/r/<code>, a Mob invite /join/<code>, or ?ref=) is kept on the phone through sign-in and
    // onboarding, and handed to the server once signed in (features/referrals, owner D165).
    unawaited(_ref.read(pendingInviteStoreProvider).captureUri(uri).catchError((Object _) => false));

    switch (ActionRouter.resolve(uri.toString())) {
      case NativeTarget(:final location):
        if (_ref.read(authSnapshotProvider).status == AuthStatus.unknown) {
          // The splash is still deciding; the redirect continues here after sign-in.
          _intended.remember(location);
        } else {
          // Signed in: open it. Signed out: the redirect remembers it and asks to sign in.
          openNativeLocation(_router, location);
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

/// Tells the Pro nudges where the student is after every change of the router's location, so returns to
/// Today are counted for the first-session sheet (D181): coming back to Today from a page, a result or a run
/// is a return, however the page closed (a pop, or `go` home, which builds the shell again); a sheet the
/// router opens is reported as one, and a sheet or dialog opened without the router never changes the
/// location. Reported a moment later, never while the tree is building.
class _PlaceReporter {
  _PlaceReporter(this._ref, this._router, this._sheets) {
    _router.routerDelegate.addListener(_changed);
  }

  final Ref _ref;
  final GoRouter _router;
  final Set<RouteBase> _sheets;
  bool _disposed = false;

  void _changed() {
    final ShellPlace place;
    try {
      final config = _router.routerDelegate.currentConfiguration;
      if (config.isEmpty || config.isError) return;
      place = ArmRules.placeOf(
        // The top page's own location: a pushed page's, not the one under it.
        path: _router.state.uri.path,
        sheet: _sheets.contains(config.last.route),
        today: AppRoutes.today,
        roots: AppRoutes.branchRoots,
      );
    } on Object {
      // Counting returns is a convenience: it never gets in the way of navigating.
      return;
    }
    scheduleMicrotask(() {
      if (_disposed) return;
      try {
        _ref.read(proNudgeProvider.notifier).notePlace(place);
      } on Object {
        // As above.
      }
      try {
        // The smart nudges (D191) show only on Today's root with nothing over it.
        _ref.read(nudgeCalmProvider.notifier).set(place == ShellPlace.today);
      } on Object {
        // As above.
      }
    });
  }

  void dispose() {
    _disposed = true;
    _router.routerDelegate.removeListener(_changed);
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
      openNativeLocation(router, location);
    case ExternalTarget(uri: final target):
      ref.read(externalLinkOpenerProvider).open(target);
    case UnsupportedTarget():
      router.go(AppRoutes.today);
  }
}

/// Opens a native [location] from a link. Colleges and the CUET tool pages (`/tools/...`) are root
/// pages with no tab under them, so they open over Today (a tool over Colleges): Back then lands on
/// Colleges and Today, never out of the app (L04). `/profile` lands on You with the account sheet
/// open (`?account=1`).
void openNativeLocation(GoRouter router, String location) {
  final path = Uri.parse(location).path;
  final tool = path.startsWith('${AppRoutes.tools}/');
  final colleges = path == AppRoutes.colleges || path.startsWith('${AppRoutes.colleges}/');
  if (tool || colleges || path == AppRoutes.tools) {
    router.go(AppRoutes.today);
    unawaited(router.push<void>(colleges ? location : AppRoutes.colleges));
    if (tool) unawaited(router.push<void>(location));
    return;
  }
  router.go(location);
}

/// Every old Review path (`/review` and everything under it) lands on Your papers inside Practice
/// with the same tail and query (D105): `/review/repair/a/q?count=3` opens
/// `/practice/papers/repair/a/q?count=3`. Null for any other path.
String? papersLocationFor(Uri uri) {
  final path = uri.path;
  if (path != AppRoutes.review && !path.startsWith('${AppRoutes.review}/')) return null;
  var tail = path.substring(AppRoutes.review.length);
  if (tail == '/') tail = '';
  return uri.replace(path: '${AppRoutes.papers}$tail').toString();
}

String? _reviewToPapers(BuildContext context, GoRouterState state) => papersLocationFor(state.uri);

/// Your papers and Learn are Practice's doors (19 Oct PM, D126, Practice C): `/practice/papers` alone
/// opens Practice on Your papers, and `/learn` alone opens it on Learn, with the rest of the query
/// kept (`?paper=` brings that paper's row into view). Their own pages keep their paths, so a
/// mistake, a lesson or a run still opens as before. Null for any other path.
String? practiceDoorFor(Uri uri) {
  final path = uri.path.endsWith('/') && uri.path.length > 1 ? uri.path.substring(0, uri.path.length - 1) : uri.path;
  if (path == AppRoutes.papers) return AppRoutes.practiceDoorLocation('papers', from: uri);
  if (path == AppRoutes.learn) return AppRoutes.practiceDoorLocation('learn', from: uri);
  return null;
}

String? _toPracticeDoor(BuildContext context, GoRouterState state) => practiceDoorFor(state.uri);

/// A page over the bar that was opened with nothing under it (`go` from a screen outside the shell):
/// system Back goes to Today instead of closing the app (L04). With a page under it, Back pops as
/// usual.
class _Backstop extends StatelessWidget {
  const _Backstop({required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    final alone = !(ModalRoute.of(context)?.canPop ?? true);
    return PopScope(
      canPop: !alone,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) GoRouter.of(context).go(AppRoutes.today);
      },
      child: PushedPageMarker(child: child),
    );
  }
}

/// The Review screen's own pages, under Your papers (and, as redirects, under the old `/review`).
const List<String> _papersChildren = [
  'mistakes',
  'record',
  'rules',
  'revise',
  'again',
  'insights',
  'saved',
  'repair/:attemptId/ending',
  'repair/:attemptId/:questionId',
];

/// `/tools` alone redirects to Colleges; its child pages (Compass, a programme, Combo, the 2027
/// guide) keep their paths.
String? toolsHubRedirect(BuildContext context, GoRouterState state) {
  final path = state.uri.path;
  return path == AppRoutes.tools || path == '${AppRoutes.tools}/' ? AppRoutes.colleges : null;
}

List<RouteBase> _routes(GlobalKey<NavigatorState> rootKey, Set<RouteBase> sheets) {
  GoRoute page(
    String path,
    GoRouterWidgetBuilder builder, {
    MmTransition transition = MmTransition.push,
    bool root = false,
    List<RouteBase> routes = const [],
    GoRouterRedirect? redirect,
  }) {
    return GoRoute(
      path: path,
      parentNavigatorKey: root ? rootKey : null,
      redirect: redirect,
      pageBuilder: (context, state) =>
          mmPage<void>(context: context, state: state, child: builder(context, state), transition: transition),
      routes: routes,
    );
  }

  GoRoute sheet(String path, GoRouterWidgetBuilder builder, {GoRouterWidgetBuilder? footer}) {
    final route = GoRoute(
      path: path,
      parentNavigatorKey: rootKey,
      pageBuilder: (context, state) =>
          MmSheetPage<void>(key: state.pageKey, footer: footer?.call(context, state), child: builder(context, state)),
    );
    sheets.add(route);
    return route;
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

    // The four tabs (D105: Today, Practice, Mob, You; Start is the bar's centre key). Each branch
    // keeps its own navigation stack and fades through on a switch.
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
            // Your papers (D105, G20): the Review screen, inside Practice with the bar under it, and
            // its own pages with the bar under them, so Back from a mistake lands on Your papers,
            // then Practice. Since D126 Your papers is a door of Practice: the path alone opens that
            // door ([practiceDoorFor]); the page here is only built under its own pages' links.
            page('papers', reviewScreen, redirect: _toPracticeDoor, routes: [
              page('mistakes', reviewMistakesScreen),
              page('record', reviewRecordScreen),
              page('insights', reviewInsightsScreen),
              page('saved', reviewSavedScreen),
            ]),
            // Your papers' pages that cover the bar sit on Practice itself, not on Your papers: a link
            // or a result opens them over a page that already covers the tab, and a tab out of sight
            // must not gain a page under them (its navigator is not laid out, so the page flight that
            // a new top page starts would have no size). Opened from Your papers they are pushed, so
            // Back still returns there; opened by a link, Back lands on Practice, whose first row is
            // Your papers.
            // The Rule book: over the dock, so the result page (outside the shell) can push it too.
            page('papers/rules', reviewRulesScreen, root: true),
            page('papers/revise', reviewReviseScreen, root: true),
            // Review again: repaired mistakes asked once more, key hidden. Over the dock like Revise.
            page('papers/again', reviewAgainScreen, root: true),
            // Literal "ending" before the :questionId pattern.
            page('papers/repair/:attemptId/ending', reviewRepairEndingScreen, transition: MmTransition.rise, root: true),
            page('papers/repair/:attemptId/:questionId', reviewRepairScreen, transition: MmTransition.container, root: true),
          ]),
        ]),
        // The Mob (D105, SOCIAL-SPEC section 8): your Mob, this week's paper and the invite, or the
        // way to start one or join a friend's. The page lives in features/social.
        StatefulShellBranch(routes: [
          tabRoot(AppRoutes.mob, mobTabScreen),
        ]),
        // You: the student's study. Its own pages and the account pages (reached from the
        // account sheet) cover the bar (root pages), so their paths and transitions are unchanged.
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
            page('credits', youCreditsScreen, root: true),
            page('pro', proPageScreen, transition: MmTransition.rise, root: true),
            // The Mob was a page here before it had its tab (D105): the old path opens the tab.
            GoRoute(path: 'mob', redirect: (context, state) => AppRoutes.mob),
          ]),
        ]),
      ],
    ),

    // Every old Review path lands on Your papers inside Practice (D105), with the same tail.
    GoRoute(path: AppRoutes.review, redirect: _reviewToPapers, routes: [
      for (final child in _papersChildren) GoRoute(path: child, redirect: _reviewToPapers),
    ]),

    // Colleges (app-ia-1016.md 5.1): My colleges, Admission Compass and the CUET tools. A page over
    // the bar since the Mob took its tab (D105), pushed from Today's colleges card, You's Aim row and
    // Review, so Back returns to where the student came from.
    page(AppRoutes.colleges, (context, state) => _Backstop(child: collegesScreen(context, state)), root: true, routes: [
      // Check a score (`?score=&category=`): a sheet over Colleges (app-ia-1016.md 5.3).
      sheet('cutoff', collegesCutoffScreen),
    ]),

    // CUET tools: root pages over the bar, pushed from Colleges, Today's colleges card and
    // Practice's More rows, so Back returns to where they came from. `/tools` itself is Colleges
    // (a redirect); the child paths are unchanged (app-ia-1016.md D7).
    GoRoute(path: AppRoutes.tools, redirect: toolsHubRedirect, routes: [
      page('compass', toolsCompassScreen, root: true, routes: [
        page(':groupId', toolsProgrammeScreen, root: true),
      ]),
      page('combo', toolsComboScreen, root: true),
      page('guide-2027', toolsGuide2027Screen, root: true),
    ]),

    // Ask your record: from the record, the tools hub and the Start sheet.
    // Ask Mobi opens over the page (it rises 24 dp and fades in, and closes the same way) with a close
    // mark, not a sideways push: it is a conversation on top of where you were (owner N9, web release 4).
    page(AppRoutes.ask, askScreen, transition: MmTransition.rise, root: true),

    // Learn is no longer a tab: its screens stay reachable from Practice (the Concepts shelf)
    // and from the mistakes they explain.
    // Since D126 Learn is a door of Practice: `/learn` alone opens that door ([practiceDoorFor]); the
    // page here is only built under its own pages' links.
    page(AppRoutes.learn, learnScreen, root: true, redirect: _toPracticeDoor, routes: [
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

    // The Mob's invite link (www.mockmob.in/join/<code>).
    page('/join/:code', mobJoinScreen, root: true),

    // Web alias. The redirect also catches it; this keeps the path "known" to the router.
    GoRoute(path: AppRoutes.dashboard, redirect: (context, state) => AppRoutes.today),
  ];
}
