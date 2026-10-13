// Route builders for the today feature. Keep the function names: lib/core/router/screens.dart
// re-exports them and router.dart binds them to the paths of spec 4.2. Sheet routes return a
// sheet body only; `MmSheetPage` supplies the glass frame.

import 'package:flutter/widgets.dart';
import 'package:go_router/go_router.dart';

import '../insights/insights_routes.dart' show InsightsCard;
import '../tools/tools_routes.dart' show ToolsQuietLink;
import 'screens/alternatives_sheet.dart';
import 'screens/today_screen.dart';
import 'screens/weekly_ending_page.dart';
import 'screens/why_sheet.dart';

/// Today with the record's top finding under the hero and the quiet CUET tools link under the road.
Widget todayScreen(BuildContext context, GoRouterState state) =>
    const TodayScreen(insights: InsightsCard(), roadFooter: ToolsQuietLink());

Widget todayWhyScreen(BuildContext context, GoRouterState state) =>
    WhySheet(key: ValueKey(state.uri.toString()), attemptId: state.pathParameters['actionId'] ?? '');

Widget todayAlternativesScreen(BuildContext context, GoRouterState state) => const AlternativesSheet();

Widget todayWeeklyEndingScreen(BuildContext context, GoRouterState state) => const WeeklyEndingPage();
