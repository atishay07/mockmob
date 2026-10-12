// Route builders for the result feature. This feature module owns this file and replaces each
// placeholder body with its real screen. Keep the function names: lib/core/router/screens.dart
// re-exports them and router.dart binds them to the paths of spec 4.2.

import 'package:flutter/widgets.dart';
import 'package:go_router/go_router.dart';

import '../../core/router/placeholder_screen.dart';

Widget resultSealedScreen(BuildContext context, GoRouterState state) =>
    const PlaceholderScreen(title: 'Your sheet', route: '/result/:attemptId/sealed');

Widget resultRecapScreen(BuildContext context, GoRouterState state) =>
    const PlaceholderScreen(title: 'Recap', route: '/result/:attemptId/recap/:card');

Widget resultScreen(BuildContext context, GoRouterState state) =>
    const PlaceholderScreen(title: 'Result', route: '/result/:attemptId');
