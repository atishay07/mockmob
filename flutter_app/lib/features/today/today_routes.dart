// Route builders for the today feature. This feature module owns this file and replaces each
// placeholder body with its real screen. Keep the function names: lib/core/router/screens.dart
// re-exports them and router.dart binds them to the paths of spec 4.2.

import 'package:flutter/widgets.dart';
import 'package:go_router/go_router.dart';

import '../../core/router/placeholder_screen.dart';
import '../../core/router/routes.dart';

Widget todayScreen(BuildContext context, GoRouterState state) =>
    const PlaceholderScreen(title: 'Today', route: AppRoutes.today);

Widget todayWhyScreen(BuildContext context, GoRouterState state) =>
    const PlaceholderScreen(title: 'Why this', route: '/today/why/:actionId', isSheet: true);

Widget todayAlternativesScreen(BuildContext context, GoRouterState state) =>
    const PlaceholderScreen(title: 'Choose something else', route: AppRoutes.todayAlternatives, isSheet: true);

Widget todayWeeklyEndingScreen(BuildContext context, GoRouterState state) =>
    const PlaceholderScreen(title: 'Weekly ending', route: AppRoutes.todayWeeklyEnding);
