// Route builders for the you feature. This feature module owns this file and replaces each
// placeholder body with its real screen. Keep the function names: lib/core/router/screens.dart
// re-exports them and router.dart binds them to the paths of spec 4.2.
//
// `/you/subjects` and `/you/sheet` are registered in router.dart; [openYouPage] still falls back
// to a plain push where no router is present (widget tests).

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../tools/tools_routes.dart' show ToolsShelf;
import 'account/account_screen.dart';
import 'account/delete_screen.dart';
import 'appearance/appearance_screen.dart';
import 'goal/goal_screen.dart';
import 'help/help_screen.dart';
import 'privacy/privacy_screen.dart';
import 'sheet/sheet_editor_screen.dart';
import 'subjects/subjects_screen.dart';
import 'you_hub_screen.dart';

/// Paths this feature adds.
abstract final class YouPaths {
  static const String subjects = '/you/subjects';
  static const String sheet = '/you/sheet';
}

Widget youScreen(BuildContext context, GoRouterState state) => const YouHubScreen(tools: ToolsShelf());

Widget youGoalScreen(BuildContext context, GoRouterState state) => const GoalScreen();

Widget youPrivacyScreen(BuildContext context, GoRouterState state) => const PrivacyScreen();

Widget youAccountScreen(BuildContext context, GoRouterState state) => const AccountScreen();

Widget youDeleteScreen(BuildContext context, GoRouterState state) => const DeleteScreen();

Widget youAppearanceScreen(BuildContext context, GoRouterState state) => const AppearanceScreen();

Widget youHelpScreen(BuildContext context, GoRouterState state) => const HelpScreen();

/// Edit subjects: `/you/subjects`.
Widget youSubjectsScreen(BuildContext context, GoRouterState state) => const SubjectsScreen();

/// Edit the sheet: `/you/sheet`.
Widget youSheetScreen(BuildContext context, GoRouterState state) => const SheetEditorScreen();

/// Opens one of this feature's new pages: through the router when the path is registered,
/// otherwise as a plain pushed page.
Future<void> openYouPage(BuildContext context, String path) async {
  final router = GoRouter.maybeOf(context);
  if (router != null && router.configuration.findMatch(Uri.parse(path)).isNotEmpty) {
    await router.push<void>(path);
    return;
  }
  final Widget page = switch (path) {
    YouPaths.subjects => const SubjectsScreen(),
    _ => const SheetEditorScreen(),
  };
  await Navigator.of(context, rootNavigator: true).push<void>(MaterialPageRoute(builder: (_) => page));
}
