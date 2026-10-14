// Route builders for the rhythm feature. lib/core/router/screens.dart re-exports them and
// router.dart binds them to the paths of spec 4.2.

import 'package:flutter/widgets.dart';
import 'package:go_router/go_router.dart';

import 'screens/bests_screen.dart';
import 'screens/milestones_screen.dart';
import 'screens/rhythm_screen.dart';
import 'screens/week_sheet.dart';

/// `/today/week`: a sheet body, `MmSheetPage` supplies the frame.
Widget todayWeekScreen(BuildContext context, GoRouterState state) => const WeekSheet();

Widget youRhythmScreen(BuildContext context, GoRouterState state) => const YouRhythmScreen();

Widget youMilestonesScreen(BuildContext context, GoRouterState state) => const YouMilestonesScreen();

Widget youBestsScreen(BuildContext context, GoRouterState state) => const YouBestsScreen();
