// Route builders for the onboarding feature. This feature module owns this file and replaces each
// placeholder body with its real screen. Keep the function names: lib/core/router/screens.dart
// re-exports them and router.dart binds them to the paths of spec 4.2.

import 'package:flutter/widgets.dart';
import 'package:go_router/go_router.dart';

import '../../core/router/placeholder_screen.dart';
import '../../core/router/routes.dart';

Widget welcomeScreen(BuildContext context, GoRouterState state) =>
    const PlaceholderScreen(title: 'Welcome', route: AppRoutes.welcome);

Widget onboardingSubjectScreen(BuildContext context, GoRouterState state) =>
    const PlaceholderScreen(title: 'Which paper first', route: AppRoutes.onboardingSubject);

Widget onboardingSampleScreen(BuildContext context, GoRouterState state) =>
    const PlaceholderScreen(title: 'Sample question', route: '/onboarding/sample/:i');

Widget onboardingSampleResultScreen(BuildContext context, GoRouterState state) =>
    const PlaceholderScreen(title: 'Sample result', route: AppRoutes.onboardingSampleResult);

Widget beforeYouStartScreen(BuildContext context, GoRouterState state) =>
    const PlaceholderScreen(title: 'Before you start', route: AppRoutes.beforeYouStart, isSheet: true);
