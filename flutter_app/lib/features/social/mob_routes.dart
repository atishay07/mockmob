// Route builders and openers for the Mob. `/you/mob` is the page and `/join/<code>` (the verified
// www.mockmob.in link) opens the join sheet. Each opener pushes through the router when the path is
// registered and otherwise as a plain page, so the feature works before the router lines land.

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import 'screens/mob_join_screen.dart';
import 'screens/mob_screen.dart';

abstract final class MobPaths {
  static const String mob = '/you/mob';
  static String join(String code) => '/join/${Uri.encodeComponent(code)}';
}

Widget mobScreen(BuildContext context, GoRouterState state) => const MobScreen();

Widget mobJoinScreen(BuildContext context, GoRouterState state) => MobJoinScreen(code: state.pathParameters['code'] ?? '');

Future<void> _open(BuildContext context, String path, WidgetBuilder fallback) async {
  final router = GoRouter.maybeOf(context);
  if (router != null && router.configuration.findMatch(Uri.parse(path)).isNotEmpty) {
    await router.push<void>(path);
    return;
  }
  await Navigator.of(context, rootNavigator: true).push<void>(MaterialPageRoute(builder: fallback));
}

Future<void> openMobPage(BuildContext context) => _open(context, MobPaths.mob, (_) => const MobScreen());

Future<void> openMobJoin(BuildContext context, String code) => _open(context, MobPaths.join(code), (_) => MobJoinScreen(code: code));
