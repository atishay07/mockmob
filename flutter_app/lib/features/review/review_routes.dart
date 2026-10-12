// Route builders for the review feature. This feature module owns this file and replaces each
// placeholder body with its real screen. Keep the function names: lib/core/router/screens.dart
// re-exports them and router.dart binds them to the paths of spec 4.2.

import 'package:flutter/widgets.dart';
import 'package:go_router/go_router.dart';

import '../../core/router/placeholder_screen.dart';
import '../../core/router/routes.dart';

Widget reviewScreen(BuildContext context, GoRouterState state) =>
    const PlaceholderScreen(title: 'Review', route: AppRoutes.review);

Widget reviewMistakesScreen(BuildContext context, GoRouterState state) =>
    const PlaceholderScreen(title: 'Mistakes', route: AppRoutes.reviewMistakes);

Widget reviewRecordScreen(BuildContext context, GoRouterState state) =>
    const PlaceholderScreen(title: 'Repair record', route: AppRoutes.reviewRecord);

Widget reviewRepairScreen(BuildContext context, GoRouterState state) =>
    const PlaceholderScreen(title: 'Mistake repair', route: '/review/repair/:attemptId/:questionId');

Widget reviewRepairEndingScreen(BuildContext context, GoRouterState state) =>
    const PlaceholderScreen(title: 'Repair ending', route: '/review/repair/:attemptId/ending');
