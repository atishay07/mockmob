import 'package:flutter/foundation.dart' show kDebugMode;
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

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
/// The shell has three tabs (Today, Practice, Review); You and Learn are pushed over it.
final routerProvider = Provider<GoRouter>((ref) {
  final rootKey = GlobalKey<NavigatorState>(debugLabel: 'root');
  final intended = ref.watch(intendedRouteProvider);
  final refresh = _AuthRefresh();
  ref.listen<AuthSnapshot>(authSnapshotProvider, (_, _) => refresh.notify());

  final router = GoRouter(
    navigatorKey: rootKey,
    initialLocation: AppRoutes.splash,
    refreshListenable: refresh,
    redirect: (context, state) =>
        resolveRedirect(auth: ref.read(authSnapshotProvider), uri: state.uri, intended: intended),
    onException: (context, state, router) => _handleUnknown(ref, state.uri, router),
    routes: _routes(rootKey),
  );

  ref.onDispose(() {
    refresh.dispose();
    router.dispose();
  });
  return router;
});

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

  GoRoute sheet(String path, GoRouterWidgetBuilder builder) {
    return GoRoute(
      path: path,
      parentNavigatorKey: rootKey,
      pageBuilder: (context, state) => MmSheetPage<void>(key: state.pageKey, child: builder(context, state)),
    );
  }

  GoRoute tabRoot(String path, GoRouterWidgetBuilder builder, {List<RouteBase> routes = const []}) {
    return GoRoute(
      path: path,
      pageBuilder: (context, state) => NoTransitionPage<void>(key: state.pageKey, child: builder(context, state)),
      routes: routes,
    );
  }

  return [
    // First run and auth.
    page(AppRoutes.splash, splashScreen, transition: MmTransition.fade),
    page(AppRoutes.welcome, welcomeScreen, transition: MmTransition.fade),
    page('/onboarding/subject', onboardingSubjectScreen),
    page('/onboarding/sample/result', onboardingSampleResultScreen),
    page('/onboarding/sample/:i', onboardingSampleScreen),
    page('/sign-in', signInScreen, routes: [page('code', signInCodeScreen)]),
    sheet(AppRoutes.beforeYouStart, beforeYouStartScreen),

    // The three tabs. Each branch keeps its own navigation stack and fades in on a switch.
    StatefulShellRoute(
      builder: (context, state, shell) => AppShell(shell: shell),
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
            page('setup/:mode', practiceSetupScreen),
            // The untimed question stream (the website's Explore), full screen over the dock.
            page('stream', practiceStreamScreen, root: true),
            page('start', practiceStartScreen, transition: MmTransition.fade, root: true),
            page('result/:attemptId', practiceResultScreen, root: true),
          ]),
        ]),
        StatefulShellBranch(routes: [
          tabRoot('/review', reviewScreen, routes: [
            page('mistakes', reviewMistakesScreen),
            page('record', reviewRecordScreen),
            page('insights', reviewInsightsScreen),
            page('saved', reviewSavedScreen),
            // Literal "ending" before the :questionId pattern.
            page('repair/:attemptId/ending', reviewRepairEndingScreen, root: true),
            page('repair/:attemptId/:questionId', reviewRepairScreen, root: true),
          ]),
        ]),
      ],
    ),

    // You: pushed from the avatar on every tab root, over the dock.
    page(AppRoutes.you, youScreen, root: true, routes: [
      page('goal', youGoalScreen, root: true),
      page('rhythm', youRhythmScreen, root: true),
      page('notifications', youNotificationsScreen, root: true),
      page('privacy', youPrivacyScreen, root: true),
      page('account', youAccountScreen, root: true),
      page('delete', youDeleteScreen, root: true),
      page('milestones', youMilestonesScreen, root: true),
      page('bests', youBestsScreen, root: true),
      page('appearance', youAppearanceScreen, root: true),
      page('help', youHelpScreen, root: true),
      page('subjects', youSubjectsScreen, root: true),
      page('sheet', youSheetScreen, root: true),
    ]),

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

    // Result and recap.
    page('/result/:attemptId', resultScreen, root: true, routes: [
      page('sealed', resultSealedScreen, root: true),
      page('recap/:card', resultRecapScreen, root: true),
    ]),

    sheet(AppRoutes.permissionsNotifications, permissionsNotificationsScreen),

    // Web alias. The redirect also catches it; this keeps the path "known" to the router.
    GoRoute(path: AppRoutes.dashboard, redirect: (context, state) => AppRoutes.today),
  ];
}
