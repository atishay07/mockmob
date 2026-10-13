// Route builders for the result feature. Keep the function names: lib/core/router/screens.dart
// re-exports them and router.dart binds them to the paths of spec 4.2.

import 'package:flutter/widgets.dart';
import 'package:go_router/go_router.dart';

import 'full/full_result_screen.dart';
import 'recap/recap_screens.dart';

String _id(GoRouterState state) => state.pathParameters['attemptId'] ?? '';

/// `/result/:attemptId/sealed`: the folded, sealed answer sheet.
Widget resultSealedScreen(BuildContext context, GoRouterState state) =>
    SealedResultScreen(key: ValueKey('sealed-${_id(state)}'), attemptId: _id(state));

/// `/result/:attemptId/recap/:card` (card 1 to 4).
Widget resultRecapScreen(BuildContext context, GoRouterState state) {
  final card = (int.tryParse(state.pathParameters['card'] ?? '') ?? 1).clamp(1, 4);
  return RecapScreen(key: ValueKey('recap-${_id(state)}-$card'), attemptId: _id(state), card: card);
}

/// `/result/:attemptId?q=12`: the full result, optionally opened at one question.
Widget resultScreen(BuildContext context, GoRouterState state) => FullResultScreen(
  key: ValueKey(state.uri.toString()),
  attemptId: _id(state),
  focusQuestion: int.tryParse(state.uri.queryParameters['q'] ?? ''),
);
