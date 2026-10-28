// Route builders for the you feature. This feature module owns this file and replaces each
// placeholder body with its real screen. Keep the function names: lib/core/router/screens.dart
// re-exports them and router.dart binds them to the paths of spec 4.2.

import 'package:flutter/widgets.dart';
import 'package:go_router/go_router.dart';

import 'account/account_screen.dart';
import 'account/delete_screen.dart';
import 'appearance/appearance_screen.dart';
import 'goal/goal_screen.dart';
import 'help/help_screen.dart';
import 'privacy/privacy_screen.dart';
import 'you_hub_screen.dart';

Widget youScreen(BuildContext context, GoRouterState state) => const YouHubScreen();

Widget youGoalScreen(BuildContext context, GoRouterState state) => const GoalScreen();

Widget youPrivacyScreen(BuildContext context, GoRouterState state) => const PrivacyScreen();

Widget youAccountScreen(BuildContext context, GoRouterState state) => const AccountScreen();

Widget youDeleteScreen(BuildContext context, GoRouterState state) => const DeleteScreen();

Widget youAppearanceScreen(BuildContext context, GoRouterState state) => const AppearanceScreen();

Widget youHelpScreen(BuildContext context, GoRouterState state) => const HelpScreen();
