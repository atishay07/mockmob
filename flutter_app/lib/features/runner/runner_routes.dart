// Route builders for the runner feature. This feature module owns this file and replaces each
// placeholder body with its real screen. Keep the function names: lib/core/router/screens.dart
// re-exports them and router.dart binds them to the paths of spec 4.2.

import 'package:flutter/widgets.dart';
import 'package:go_router/go_router.dart';

import '../../core/router/placeholder_screen.dart';

Widget runScreen(BuildContext context, GoRouterState state) =>
    const PlaceholderScreen(title: 'Runner', route: '/run/:sessionId');

Widget runSubmitScreen(BuildContext context, GoRouterState state) =>
    const PlaceholderScreen(title: 'Submit', route: '/run/:sessionId/submit');
