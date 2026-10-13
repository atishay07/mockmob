// Route builders for the review feature (spec 5.8). lib/core/router/screens.dart re-exports
// them and router.dart binds them to the paths of spec 4.2.

import 'package:flutter/widgets.dart';
import 'package:go_router/go_router.dart';

import 'screens/mistakes_screen.dart';
import 'screens/record_screen.dart';
import 'screens/repair_ending_screen.dart';
import 'screens/repair_screen.dart';
import 'screens/review_screen.dart';

/// The Review tab.
Widget reviewScreen(BuildContext context, GoRouterState state) => const ReviewScreen();

/// `/review/mistakes`: every chapter with mistakes.
Widget reviewMistakesScreen(BuildContext context, GoRouterState state) => const MistakesScreen();

/// `/review/record`: the repair record.
Widget reviewRecordScreen(BuildContext context, GoRouterState state) => const RecordScreen();

/// `/review/repair/:attemptId/:questionId`: the repair flow, starting at that mistake.
Widget reviewRepairScreen(BuildContext context, GoRouterState state) {
  final attemptId = state.pathParameters['attemptId'] ?? '';
  final questionId = state.pathParameters['questionId'] ?? '';
  final count = int.tryParse(state.uri.queryParameters['count'] ?? '');
  return RepairScreen(key: ValueKey('$attemptId/$questionId'), attemptId: attemptId, questionId: questionId, count: count);
}

/// `/review/repair/:attemptId/ending`: the repair ending.
Widget reviewRepairEndingScreen(BuildContext context, GoRouterState state) {
  final attemptId = state.pathParameters['attemptId'] ?? '';
  return RepairEndingScreen(key: ValueKey(attemptId), attemptId: attemptId);
}
