// Route builders for the practice feature (spec 5.4 and 5.4.1). lib/core/router/screens.dart
// re-exports them and router.dart binds them to the paths of spec 4.2.

import 'package:flutter/widgets.dart';
import 'package:go_router/go_router.dart';

import '../../core/models/json_helpers.dart';
import 'model/practice_selection.dart';
import 'practice_result_screen.dart';
import 'practice_screen.dart';
import 'practice_setup_screen.dart';
import 'practice_start_screen.dart';

/// The Practice tab.
Widget practiceScreen(BuildContext context, GoRouterState state) => const PracticeScreen();

/// `/practice/setup/:mode?subject=&count=&chapter=&purpose=`. An unknown mode opens Quick practice.
Widget practiceSetupScreen(BuildContext context, GoRouterState state) {
  final q = state.uri.queryParameters;
  return PracticeSetupScreen(
    key: ValueKey(state.uri.toString()),
    mode: PracticeMode.parse(state.pathParameters['mode']) ?? PracticeMode.quick,
    subject: _clean(q['subject']),
    count: asInt(q['count']),
    chapter: _clean(q['chapter']),
    purpose: q['purpose'],
  );
}

/// `/practice/start?mode=&subject=&count=&chapter=&purpose=`: starts Quick or chapter practice
/// without a setup screen (used by Today). Mocks are sent to setup for the pre-start sheet.
Widget practiceStartScreen(BuildContext context, GoRouterState state) {
  final q = state.uri.queryParameters;
  return PracticeStartScreen(
    key: ValueKey(state.uri.toString()),
    mode: PracticeMode.parse(q['mode']),
    subject: _clean(q['subject']),
    count: asInt(q['count']),
    chapter: _clean(q['chapter']),
    purpose: q['purpose'],
  );
}

/// `/practice/result/:attemptId`: the plain ending of Quick and chapter practice.
Widget practiceResultScreen(BuildContext context, GoRouterState state) =>
    PracticeResultScreen(key: ValueKey(state.pathParameters['attemptId']), attemptId: state.pathParameters['attemptId'] ?? '');

String? _clean(String? value) => value == null || value.trim().isEmpty ? null : value.trim();
