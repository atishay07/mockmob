// Route builders for the practice feature. This feature module owns this file and replaces each
// placeholder body with its real screen. Keep the function names: lib/core/router/screens.dart
// re-exports them and router.dart binds them to the paths of spec 4.2.

import 'package:flutter/widgets.dart';
import 'package:go_router/go_router.dart';

import '../../core/router/placeholder_screen.dart';
import '../../core/router/routes.dart';

Widget practiceScreen(BuildContext context, GoRouterState state) =>
    const PlaceholderScreen(title: 'Practice', route: AppRoutes.practice);

Widget practiceSetupScreen(BuildContext context, GoRouterState state) =>
    const PlaceholderScreen(title: 'Practice setup', route: '/practice/setup/:mode');

Widget practiceStartScreen(BuildContext context, GoRouterState state) =>
    const PlaceholderScreen(title: 'Starting practice', route: AppRoutes.practiceStart);

Widget practiceResultScreen(BuildContext context, GoRouterState state) =>
    const PlaceholderScreen(title: 'Practice result', route: '/practice/result/:attemptId');
