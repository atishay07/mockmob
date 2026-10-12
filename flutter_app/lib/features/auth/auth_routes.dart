// Route builders for the auth feature. This feature module owns this file and replaces each
// placeholder body with its real screen. Keep the function names: lib/core/router/screens.dart
// re-exports them and router.dart binds them to the paths of spec 4.2.

import 'package:flutter/widgets.dart';
import 'package:go_router/go_router.dart';

import '../../core/router/placeholder_screen.dart';
import '../../core/router/routes.dart';

Widget signInScreen(BuildContext context, GoRouterState state) =>
    const PlaceholderScreen(title: 'Sign in', route: AppRoutes.signIn);

Widget signInCodeScreen(BuildContext context, GoRouterState state) =>
    const PlaceholderScreen(title: 'Enter your code', route: AppRoutes.signInCodeBase);
