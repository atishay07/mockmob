// Route builders for the practice feature (spec 5.4 and 5.4.1). lib/core/router/screens.dart
// re-exports them and router.dart binds them to the paths of spec 4.2.

import 'package:flutter/widgets.dart';
import 'package:go_router/go_router.dart';

import 'model/practice_link.dart';
import 'model/practice_selection.dart';
import 'practice_result_screen.dart';
import 'practice_screen.dart';
import 'practice_setup_screen.dart';
import 'practice_start_screen.dart';

export 'model/practice_link.dart' show PracticeLink;

/// The Practice tab.
Widget practiceScreen(BuildContext context, GoRouterState state) => const PracticeScreen();

/// `/practice/setup/:mode?...`. An unknown mode opens Quick practice.
Widget practiceSetupScreen(BuildContext context, GoRouterState state) => PracticeSetupScreen(
  key: ValueKey(state.uri.toString()),
  mode: PracticeMode.parse(state.pathParameters['mode']) ?? PracticeMode.quick,
  link: PracticeLink.of(state.uri),
);

/// `/practice/start?mode=&...`: starts Quick, Smart or chapter practice without a setup screen
/// (used by Today). Mocks are sent to setup for the pre-start sheet.
Widget practiceStartScreen(BuildContext context, GoRouterState state) => PracticeStartScreen(
  key: ValueKey(state.uri.toString()),
  mode: PracticeMode.parse(state.uri.queryParameters['mode']),
  link: PracticeLink.of(state.uri),
);

/// `/practice/result/:attemptId`: the finish moment and the answers of Quick and chapter practice.
Widget practiceResultScreen(BuildContext context, GoRouterState state) =>
    PracticeResultScreen(key: ValueKey(state.pathParameters['attemptId']), attemptId: state.pathParameters['attemptId'] ?? '');
