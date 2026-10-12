// Route builders for the rhythm feature. This feature module owns this file and replaces each
// placeholder body with its real screen. Keep the function names: lib/core/router/screens.dart
// re-exports them and router.dart binds them to the paths of spec 4.2.

import 'package:flutter/widgets.dart';
import 'package:go_router/go_router.dart';

import '../../core/router/placeholder_screen.dart';
import '../../core/router/routes.dart';

Widget todayWeekScreen(BuildContext context, GoRouterState state) =>
    const PlaceholderScreen(title: 'This week', route: AppRoutes.todayWeek, isSheet: true);

Widget youRhythmScreen(BuildContext context, GoRouterState state) =>
    const PlaceholderScreen(title: 'Rhythm', route: AppRoutes.youRhythm);

Widget youMilestonesScreen(BuildContext context, GoRouterState state) =>
    const PlaceholderScreen(title: 'Milestones', route: AppRoutes.youMilestones);

Widget youBestsScreen(BuildContext context, GoRouterState state) =>
    const PlaceholderScreen(title: 'Personal bests', route: AppRoutes.youBests);
