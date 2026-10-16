// Route builders for the today feature. Keep the function names: lib/core/router/screens.dart
// re-exports them and router.dart binds them to the paths of spec 4.2. Sheet routes return a
// sheet body only; `MmSheetPage` supplies the glass frame.

import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../insights/insights_routes.dart' show InsightsCard;
import '../social/social.dart' show MobTodayCard, currentMobProvider;
import 'screens/alternatives_sheet.dart';
import 'screens/today_screen.dart';
import 'screens/weekly_ending_page.dart';
import 'screens/why_sheet.dart';

/// Today with the record's top finding under the hero. The CUET tools link under the road is gone:
/// Colleges is a tab of its own and Today ends on the Your colleges card (IA 5.2).
/// The Mob card (SOCIAL-SPEC section 8) fills the slot under the road only while the student is in
/// a Mob, so nobody else gets its gap.
Widget todayScreen(BuildContext context, GoRouterState state) => Consumer(
      builder: (context, ref, _) => TodayScreen(
        insights: const InsightsCard(),
        roadFooter: ref.watch(currentMobProvider) == null ? null : const MobTodayCard(padding: EdgeInsets.zero),
      ),
    );

Widget todayWhyScreen(BuildContext context, GoRouterState state) =>
    WhySheet(key: ValueKey(state.uri.toString()), attemptId: state.pathParameters['actionId'] ?? '');

Widget todayAlternativesScreen(BuildContext context, GoRouterState state) => const AlternativesSheet();

Widget todayWeeklyEndingScreen(BuildContext context, GoRouterState state) => const WeeklyEndingPage();
