// Route builders for the learn feature. This feature module owns this file and replaces each
// placeholder body with its real screen. Keep the function names: lib/core/router/screens.dart
// re-exports them and router.dart binds them to the paths of spec 4.2.

import 'package:flutter/widgets.dart';
import 'package:go_router/go_router.dart';

import '../../core/router/placeholder_screen.dart';
import '../../core/router/routes.dart';

Widget learnScreen(BuildContext context, GoRouterState state) =>
    const PlaceholderScreen(title: 'Learn', route: AppRoutes.learn);

Widget learnUnitScreen(BuildContext context, GoRouterState state) =>
    const PlaceholderScreen(title: 'Unit', route: '/learn/:unitId');

Widget learnRunScreen(BuildContext context, GoRouterState state) =>
    const PlaceholderScreen(title: 'Learn run', route: '/learn/run/:runId');

Widget learnRunDoneScreen(BuildContext context, GoRouterState state) =>
    const PlaceholderScreen(title: 'Run ending', route: '/learn/run/:runId/done');
