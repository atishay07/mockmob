// Where every Mob v3 screen opens from. Screens are pushed over the shell on the root navigator (the
// bottom bar stays put under the Mob tab's own den). Moments (K1 to K4) are full-screen routes with a
// fade, so the den stays drawn behind until the moment covers it.

import 'package:flutter/material.dart';

import 'screens/chains_screen.dart';
import 'screens/fix_together_screen.dart';
import 'screens/game_run_screen.dart';
import 'screens/join_v3_screen.dart';
import 'screens/live_lobby_screen.dart';
import 'screens/moment_overlay.dart';
import 'screens/mob_settings_v3_screen.dart';
import 'screens/moments_screen.dart';
import 'screens/podium_screen.dart';
import 'screens/shelf_screen.dart';

abstract final class MobV3Nav {
  static Future<T?> _push<T>(BuildContext context, Widget page, {String? name}) =>
      Navigator.of(context, rootNavigator: true).push<T>(MaterialPageRoute<T>(builder: (_) => page, settings: RouteSettings(name: name)));

  static Future<void> run(BuildContext context, String gameId) => _push(context, GameRunScreen(gameId: gameId), name: '/mob/game/$gameId/run');

  /// L1, a live room's lobby (only when the server says live is on). [opened]: you just opened it, so
  /// the go-live wash plays.
  static Future<void> room(BuildContext context, String gameId, {bool opened = false}) =>
      _push(context, LiveLobbyScreen(gameId: gameId, opened: opened), name: '/mob/game/$gameId/room');

  /// After a run the podium replaces the run screen (Back returns to the den, not to a finished run).
  static Future<void> podiumAfterRun(BuildContext context, String gameId) =>
      Navigator.of(context).pushReplacement(MaterialPageRoute<void>(builder: (_) => PodiumScreen(gameId: gameId), settings: RouteSettings(name: '/mob/game/$gameId/podium')));

  static Future<void> podium(BuildContext context, String gameId) => _push(context, PodiumScreen(gameId: gameId), name: '/mob/game/$gameId/podium');
  static Future<void> moments(BuildContext context, String gameId) => _push(context, MomentsScreen(gameId: gameId), name: '/mob/game/$gameId/moments');
  static Future<void> fix(BuildContext context, String gameId, int q) => _push(context, FixTogetherScreen(gameId: gameId, q: q), name: '/mob/game/$gameId/fix');
  static Future<void> chains(BuildContext context, {bool mobTab = false}) => _push(context, ChainsScreen(mobTab: mobTab), name: '/mob/chains');
  static Future<void> shelf(BuildContext context) => _push(context, const ShelfScreen(), name: '/mob/shelf');
  static Future<void> settings(BuildContext context) => _push(context, const MobSettingsV3Screen(), name: '/mob/settings');
  static Future<void> join(BuildContext context, {String code = ''}) => _push(context, JoinV3Screen(code: code), name: '/join');

  /// Plays one moment key (`quest_done:<mobId>:<week>`, `stitch:<mobId>:<week>`, `reveal:<fold>`, `chain:<n>`).
  /// Completes when the moment closes (shown fully or skipped).
  static Future<void> moment(BuildContext context, String key) => Navigator.of(context, rootNavigator: true).push<void>(
        PageRouteBuilder<void>(
          opaque: false,
          settings: RouteSettings(name: '/mob/moment/$key'),
          transitionDuration: const Duration(milliseconds: 200),
          reverseTransitionDuration: const Duration(milliseconds: 200),
          pageBuilder: (_, _, _) => MomentOverlay(momentKey: key),
          transitionsBuilder: (_, a, _, child) => FadeTransition(opacity: a, child: child),
        ),
      );
}
