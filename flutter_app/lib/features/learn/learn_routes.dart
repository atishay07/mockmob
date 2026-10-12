// Route builders for the learn feature (spec 5.9). lib/core/router/screens.dart re-exports
// them and router.dart binds them to the paths of spec 4.2.

import 'package:flutter/widgets.dart';
import 'package:go_router/go_router.dart';

import 'screens/learn_screen.dart';
import 'screens/run_done_screen.dart';
import 'screens/run_screen.dart';
import 'screens/unit_screen.dart';

Widget learnScreen(BuildContext context, GoRouterState state) => const LearnScreen();

Widget learnUnitScreen(BuildContext context, GoRouterState state) =>
    LearnUnitScreen(unitId: state.pathParameters['unitId'] ?? '');

Widget learnRunScreen(BuildContext context, GoRouterState state) =>
    LearnRunScreen(runId: state.pathParameters['runId'] ?? '');

Widget learnRunDoneScreen(BuildContext context, GoRouterState state) =>
    LearnRunDoneScreen(runId: state.pathParameters['runId'] ?? '');
