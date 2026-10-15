// Route builders for the CUET tools. The integrator registers them in `lib/core/router/router.dart`
// beside You (root navigator, push transition), for example:
//
//   page(ToolsPaths.hub, toolsScreen, root: true, routes: [
//     page('compass', toolsCompassScreen, root: true, routes: [
//       page(':groupId', toolsProgrammeScreen, root: true),
//     ]),
//     page('combo', toolsComboScreen, root: true),
//     page('guide-2027', toolsGuide2027Screen, root: true),
//   ]),
//
// and maps the website paths in `ToolsPaths.webAliases` in the ActionRouter. Entry points:
// `ToolsShelf` (You, replacing `ToolsPanel`) and `ToolsQuietLink` (under Today's road).

import 'package:flutter/widgets.dart';
import 'package:go_router/go_router.dart';

import 'combo/combo_screen.dart';
import 'compass/compass_screen.dart';
import 'compass/programme_screen.dart';
import 'guide/guide_2027_screen.dart';
import 'hub/tools_hub_screen.dart';
import 'widgets/tools_origin.dart';

export 'hub/tools_shelf.dart' show ToolsQuietLink, ToolsShelf;
export 'tools_paths.dart';

Widget toolsScreen(BuildContext context, GoRouterState state) => const ToolsHubScreen();

/// Compass and Combo Planner carry `?from=` so each can hand back to the other (see ToolsOrigin).
Widget toolsCompassScreen(BuildContext context, GoRouterState state) =>
    ToolsOrigin(from: state.uri.queryParameters['from'], child: const CompassScreen());

Widget toolsProgrammeScreen(BuildContext context, GoRouterState state) =>
    ProgrammeScreen(groupId: state.pathParameters['groupId'] ?? '');

Widget toolsComboScreen(BuildContext context, GoRouterState state) =>
    ToolsOrigin(from: state.uri.queryParameters['from'], child: const ComboScreen());

Widget toolsGuide2027Screen(BuildContext context, GoRouterState state) => const Guide2027Screen();
