// Route builders and openers for the Mob. `/mob` is the Mob tab (D105; `/you/mob`, its old page,
// redirects there) and `/join/<code>` (the verified www.mockmob.in link) opens the join sheet. The Mob
// page opens as its tab; the join sheet is pushed through the router when the path is registered,
// and otherwise as a plain page, so the feature works before the router lines land. The side-by-side
// and the history are pages pushed from the Mob page (they hold data the page has just read), so they
// have no path of their own.

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import 'data/mob_models.dart';
import 'screens/mob_compare_screen.dart';
import 'screens/mob_history_screen.dart';
import 'screens/mob_join_screen.dart';
import 'screens/mob_screen.dart';

abstract final class MobPaths {
  static const String mob = '/mob';
  static String join(String code) => '/join/${Uri.encodeComponent(code)}';
}

Widget mobScreen(BuildContext context, GoRouterState state) => const MobScreen();

/// The Mob tab's root (D105): the same page, with no back key.
Widget mobTabScreen(BuildContext context, GoRouterState state) => const MobScreen(asTab: true);

Widget mobJoinScreen(BuildContext context, GoRouterState state) => MobJoinScreen(code: state.pathParameters['code'] ?? '');

Future<void> _open(BuildContext context, String path, WidgetBuilder fallback) async {
  final router = GoRouter.maybeOf(context);
  if (router != null && router.configuration.findMatch(Uri.parse(path)).isNotEmpty) {
    await router.push<void>(path);
    return;
  }
  await Navigator.of(context, rootNavigator: true).push<void>(MaterialPageRoute(builder: fallback));
}

/// The Mob tab (D105). A tab is gone to, never pushed (a push of another branch's root would stack it
/// in the wrong place); without the router lines it opens as a plain page.
Future<void> openMobPage(BuildContext context) async {
  final router = GoRouter.maybeOf(context);
  if (router != null && router.configuration.findMatch(Uri.parse(MobPaths.mob)).isNotEmpty) {
    router.go(MobPaths.mob);
    return;
  }
  await Navigator.of(context, rootNavigator: true).push<void>(MaterialPageRoute(builder: (_) => const MobScreen()));
}

Future<void> openMobJoin(BuildContext context, String code) => _open(context, MobPaths.join(code), (_) => MobJoinScreen(code: code));

/// The side-by-side of one paper: [week] (a Monday, `YYYY-MM-DD`) or [extra] (an extra paper's id)
/// is what a change of the share switch reads again.
Future<void> openMobCompare(BuildContext context, MobCompare data, {String? week, String? extra}) =>
    Navigator.of(context).push<void>(MaterialPageRoute(builder: (_) => MobCompareScreen(data: data, week: week, extra: extra)));

Future<void> openMobHistory(BuildContext context) => Navigator.of(context).push<void>(MaterialPageRoute(builder: (_) => const MobHistoryScreen()));
