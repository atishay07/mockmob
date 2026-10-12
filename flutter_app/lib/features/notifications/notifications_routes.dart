// Route builders for the notifications feature. This feature module owns this file and replaces each
// placeholder body with its real screen. Keep the function names: lib/core/router/screens.dart
// re-exports them and router.dart binds them to the paths of spec 4.2.

import 'package:flutter/widgets.dart';
import 'package:go_router/go_router.dart';

import '../../core/router/placeholder_screen.dart';
import '../../core/router/routes.dart';

Widget youNotificationsScreen(BuildContext context, GoRouterState state) =>
    const PlaceholderScreen(title: 'Notifications', route: AppRoutes.youNotifications);

Widget permissionsNotificationsScreen(BuildContext context, GoRouterState state) =>
    const PlaceholderScreen(title: 'Reminders', route: AppRoutes.permissionsNotifications, isSheet: true);
