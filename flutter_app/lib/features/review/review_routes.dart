// Route builders for the review feature (spec 5.8). lib/core/router/screens.dart re-exports
// them and router.dart binds them to the paths of spec 4.2.

// The way into Review again, for the places that link to it (Practice's More list reads these).
export 'again/review_again_copy.dart' show ReviewAgainCopy;
export 'again/review_again_entry.dart' show ReviewAgainRow, reviewAgainCountProvider;

import 'package:flutter/widgets.dart';
import 'package:go_router/go_router.dart';

import '../rules/screens/rule_book_screen.dart';
import 'again/review_again_screen.dart';
import 'revise/revise_screen.dart';
import 'screens/mistakes_screen.dart';
import 'screens/record_screen.dart';
import 'screens/repair_ending_screen.dart';
import 'screens/repair_screen.dart';
import 'screens/review_screen.dart';

/// The Review tab.
Widget reviewScreen(BuildContext context, GoRouterState state) => const ReviewScreen();

/// `/review/again`: Review again, the repaired mistakes asked once more with the key hidden.
/// `?keys=attemptId/questionId,...` (a repair run just finished) narrows the set to those.
Widget reviewAgainScreen(BuildContext context, GoRouterState state) {
  final raw = state.uri.queryParameters['keys'];
  final seed = raw == null || raw.isEmpty ? null : {for (final k in raw.split(',')) if (k.isNotEmpty) k};
  return ReviewAgainScreen(key: ValueKey(raw ?? ''), seed: seed);
}

/// `/review/mistakes`: every chapter with mistakes.
Widget reviewMistakesScreen(BuildContext context, GoRouterState state) => const MistakesScreen();

/// `/review/record`: the repair record.
Widget reviewRecordScreen(BuildContext context, GoRouterState state) => const RecordScreen();

/// `/review/rules`: the Rule book (Mistake Lab v4 slice 3).
Widget reviewRulesScreen(BuildContext context, GoRouterState state) => const RuleBookScreen();

/// `/review/revise`: Revise, the student's own wrong answers coming back (Mistake Lab v4 slice 4).
Widget reviewReviseScreen(BuildContext context, GoRouterState state) => const ReviseScreen();

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
