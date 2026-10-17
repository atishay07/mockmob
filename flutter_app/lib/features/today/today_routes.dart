// Route builders for the today feature. Keep the function names: lib/core/router/screens.dart
// re-exports them and router.dart binds them to the paths of spec 4.2. Sheet routes return a
// sheet body only; `MmSheetPage` supplies the glass frame.

import 'package:flutter/widgets.dart';
import 'package:go_router/go_router.dart';

import 'screens/alternatives_sheet.dart';
import 'screens/today_screen.dart';
import 'screens/weekly_ending_page.dart';
import 'screens/why_sheet.dart';

/// Today: one move, then the glance (TODAY-1017). The record finding lives in Review's Your record,
/// reached from the move's See why and the Review tab; it no longer sits on Today.
Widget todayScreen(BuildContext context, GoRouterState state) => const TodayScreen();

Widget todayWhyScreen(BuildContext context, GoRouterState state) =>
    WhySheet(key: ValueKey(state.uri.toString()), attemptId: state.pathParameters['actionId'] ?? '');

Widget todayAlternativesScreen(BuildContext context, GoRouterState state) => const AlternativesSheet();

Widget todayWeeklyEndingScreen(BuildContext context, GoRouterState state) => const WeeklyEndingPage();
