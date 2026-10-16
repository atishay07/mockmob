// Route builders for the Colleges area. The Shell registers them in `lib/core/router/router.dart`:
//
//   tabRoot('/colleges', collegesScreen, routes: [sheet('cutoff', collegesCutoffScreen)]),
//   GoRoute(path: '/tools', redirect: ..., routes: [
//     page('compass', toolsCompassScreen, root: true, routes: [
//       page(':groupId', toolsProgrammeScreen, root: true),
//     ]),
//     page('combo', toolsComboScreen, root: true),
//     page('guide-2027', toolsGuide2027Screen, root: true),
//   ]),
//
// and maps the website paths in `ToolsPaths.webAliases` in the ActionRouter. Other areas read
// the list and its pieces only through the exports below.

import 'package:flutter/widgets.dart';
import 'package:go_router/go_router.dart';

import 'colleges/check_score_sheet.dart';
import 'colleges/colleges_screen.dart';
import 'combo/combo_screen.dart';
import 'compass/compass_screen.dart';
import 'compass/programme_screen.dart';
import 'guide/guide_2027_screen.dart';
import 'hub/tools_hub_screen.dart';
import 'widgets/tools_origin.dart';

export 'colleges/college_rung.dart' show CollegeRung, RungRank, collegeFigureProvider;
export 'colleges/colleges_screen.dart' show CompassCard, EstimateBar;
export 'estimate/estimate.dart' show Estimate, EstimateSource, Verdict, verdictFor, verdictWords, estimateRange, estimateFigure;
export 'estimate/estimate_providers.dart' show estimateProvider, estimateCategoryProvider;
export 'hub/tools_shelf.dart' show ToolsQuietLink, ToolsShelf;
export 'my_colleges/college_search.dart' show duSearch, duMatchRank, duNormalise, duCompact;
export 'my_colleges/my_colleges_sheet.dart' show showMyCollegesSheet, MyCollegesEntry;
export 'tools_paths.dart';

/// `/colleges`, the Colleges tab root (branch 3).
Widget collegesScreen(BuildContext context, GoRouterState state) => const CollegesScreen();

/// `/colleges/cutoff` (`?score=600-650&category=OBC-NCL`), Check a score. A sheet body: register it
/// with the router's `sheet(...)` (an `MmSheetPage`).
Widget collegesCutoffScreen(BuildContext context, GoRouterState state) => CheckScoreSheet(
      initialScore: state.uri.queryParameters['score'],
      initialCategory: state.uri.queryParameters['category'],
    );

/// `/tools` (now a redirect to `/colleges`; kept for older links and tests).
Widget toolsScreen(BuildContext context, GoRouterState state) => const ToolsHubScreen();

/// Compass and Combo Planner carry `?from=` so each can hand back to the other (see ToolsOrigin).
Widget toolsCompassScreen(BuildContext context, GoRouterState state) =>
    ToolsOrigin(from: state.uri.queryParameters['from'], child: const CompassScreen());

Widget toolsProgrammeScreen(BuildContext context, GoRouterState state) =>
    ProgrammeScreen(groupId: state.pathParameters['groupId'] ?? '');

Widget toolsComboScreen(BuildContext context, GoRouterState state) =>
    ToolsOrigin(from: state.uri.queryParameters['from'], child: const ComboScreen());

Widget toolsGuide2027Screen(BuildContext context, GoRouterState state) => const Guide2027Screen();
