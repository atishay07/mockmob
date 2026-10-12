// Route builders for the you feature. This feature module owns this file and replaces each
// placeholder body with its real screen. Keep the function names: lib/core/router/screens.dart
// re-exports them and router.dart binds them to the paths of spec 4.2.

import 'package:flutter/widgets.dart';
import 'package:go_router/go_router.dart';

import '../../core/router/placeholder_screen.dart';
import '../../core/router/routes.dart';

Widget youScreen(BuildContext context, GoRouterState state) =>
    const PlaceholderScreen(title: 'You', route: AppRoutes.you);

Widget youGoalScreen(BuildContext context, GoRouterState state) =>
    const PlaceholderScreen(title: 'Weekly goal', route: AppRoutes.youGoal);

Widget youPrivacyScreen(BuildContext context, GoRouterState state) =>
    const PlaceholderScreen(title: 'Usage data', route: AppRoutes.youPrivacy);

Widget youAccountScreen(BuildContext context, GoRouterState state) =>
    const PlaceholderScreen(title: 'Account', route: AppRoutes.youAccount);

Widget youDeleteScreen(BuildContext context, GoRouterState state) =>
    const PlaceholderScreen(title: 'Delete account', route: AppRoutes.youDelete);

Widget youAppearanceScreen(BuildContext context, GoRouterState state) =>
    const PlaceholderScreen(title: 'Appearance', route: AppRoutes.youAppearance);

Widget youHelpScreen(BuildContext context, GoRouterState state) =>
    const PlaceholderScreen(title: 'Help', route: AppRoutes.youHelp);
