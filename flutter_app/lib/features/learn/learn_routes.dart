// Route builders for the learn feature (spec 5.9). lib/core/router/screens.dart re-exports
// them and router.dart binds them to the paths of spec 4.2.
//
// New, for the integrator to bind in router.dart under page(AppRoutes.learn, ...), placed
// before page(':unitId', ...):
//   page(LearnPaths.summaryTemplate, learnSummaryScreen, root: true),
// and add '/learn/summary/:subject/:chapter' to AppRoutes.templates.

import 'package:flutter/widgets.dart';
import 'package:go_router/go_router.dart';

import 'data/concepts_pick.dart' show LessonFrom;
import 'screens/learn_screen.dart';
import 'screens/run_done_screen.dart';
import 'screens/run_screen.dart';
import 'screens/summary_screen.dart';
import 'screens/unit_screen.dart';

export 'learn_paths.dart';

Widget learnScreen(BuildContext context, GoRouterState state) =>
    const LearnScreen();

/// `/learn/:unitId[?from=]`: a lesson, saying where it was opened from (LEARN-REVIEW-1017 5.10).
Widget learnUnitScreen(BuildContext context, GoRouterState state) => LearnUnitScreen(
  unitId: state.pathParameters['unitId'] ?? '',
  from: LessonFrom.parse(state.uri.queryParameters['from']),
);

Widget learnRunScreen(BuildContext context, GoRouterState state) =>
    LearnRunScreen(runId: state.pathParameters['runId'] ?? '');

Widget learnRunDoneScreen(BuildContext context, GoRouterState state) =>
    LearnRunDoneScreen(runId: state.pathParameters['runId'] ?? '');

/// `/learn/summary/:subject/:chapter`: the chapter reader.
Widget learnSummaryScreen(BuildContext context, GoRouterState state) =>
    LearnSummaryScreen(
      subject: state.pathParameters['subject'] ?? '',
      chapter: state.pathParameters['chapter'] ?? '',
    );
