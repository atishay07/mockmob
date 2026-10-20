// Where every Mob v3 screen opens from. Screens are pushed over the shell on the root navigator (the
// bottom bar stays put under the Mob tab's own den). Moments (K1 to K4) are full-screen routes with a
// fade, so the den stays drawn behind until the moment covers it.

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'copy_v3.dart';
import 'data/mob_mock.dart';
import 'data/mob_v3_den.dart';
import 'data/mob_v3_models.dart';
import 'logic/explainer_flow.dart';

import 'screens/chains_screen.dart';
import 'screens/fix_together_screen.dart';
import 'screens/game_run_screen.dart';
import 'screens/join_v3_screen.dart';
import 'screens/mob_explainer_screen.dart';
import 'screens/mob_setup_screen.dart';
import 'screens/moment_overlay.dart';
import 'screens/mob_settings_v3_screen.dart';
import 'screens/moments_screen.dart';
import 'screens/podium_screen.dart';
import 'screens/shelf_screen.dart';
import 'widgets/sit_mock_sheet.dart';

abstract final class MobV3Nav {
  static Future<T?> _push<T>(BuildContext context, Widget page, {String? name}) =>
      Navigator.of(context, rootNavigator: true).push<T>(MaterialPageRoute<T>(builder: (_) => page, settings: RouteSettings(name: name)));

  static Future<void> run(BuildContext context, String gameId) => _push(context, GameRunScreen(gameId: gameId), name: '/mob/game/$gameId/run');

  /// Plays a game the way its format plays (D167): a full mock in the app's mock runner, a live room that has
  /// not started in its room (the game's ready phase), anything else in the run.
  static Future<void> play(BuildContext context, MobGameSummary g) async {
    if (g.format == GameFormat.mock) {
      final messenger = ScaffoldMessenger.maybeOf(context);
      // A Free member pays credits to sit (D174, D175): the price and the way to Pro are shown before the paper opens.
      final starts = ProviderScope.containerOf(context, listen: false).read(denViewProvider)?.v3.starts;
      final cost = starts == null ? 0 : mockSitCost(g, starts);
      if (cost > 0) {
        final go = await showSitMockSheet(context, cost: cost);
        if (!go || !context.mounted) return;
      }
      final failed = await sitMobMock(context, g.id);
      // The server refused for want of credits (nothing charged): the same sheet again, short, with Pro and credits
      // (only when a price is known; otherwise its own sentence says it).
      final price = cost > 0 ? cost : (starts?.freeMockPrice ?? 0);
      if (failed != null && failed.short && price > 0 && context.mounted) {
        await showSitMockSheet(context, cost: price, refused: true);
        return;
      }
      if (failed != null) messenger?.showSnackBar(SnackBar(content: Text(failed.message), behavior: SnackBarBehavior.floating));
      return;
    }
    if (g.mode == GameMode.live && g.room?.state == RoomState.lobby) return room(context, g.id);
    return run(context, g.id);
  }

  /// A game's results: the podium (a full mock's carries everyone's mark sheets).
  static String resultsKey(MobGameSummary g) => g.format == GameFormat.mock ? MobV3Copy.seeMarkSheets : MobV3Copy.seePodiumSoFar;

  /// A live room (only when the server says live is on): the game screen in its ready phase. [opened]: you
  /// just opened it, so the go-live wash plays.
  static Future<void> room(BuildContext context, String gameId, {bool opened = false}) =>
      _push(context, GameRunScreen(gameId: gameId, room: true, opened: opened), name: '/mob/game/$gameId/room');

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

  /// D0 "Start a Mob": the explainer the first time on this phone for this account (D166), then the
  /// one-question setup; straight to the setup after that.
  static Future<void> startMob(BuildContext context) async {
    final seen = await ProviderScope.containerOf(context, listen: false).read(explainerSeenProvider).read();
    if (!context.mounted) return;
    if (seen) return setup(context);
    return _push(context, const MobExplainerScreen(via: ExplainerVia.start), name: '/mob/how');
  }

  /// D0 "Join with a code": the explainer the first time, then the code screen.
  static Future<void> joinMob(BuildContext context) async {
    final seen = await ProviderScope.containerOf(context, listen: false).read(explainerSeenProvider).read();
    if (!context.mounted) return;
    if (seen) return join(context);
    return _push(context, const MobExplainerScreen(via: ExplainerVia.join), name: '/mob/how');
  }

  /// The one-question setup (after the explainer, or on its own once it was seen).
  static Future<void> setup(BuildContext context) => _push(context, const MobSetupScreen(), name: '/mob/start');

  /// "How the Mob works": from D0 it leads on to Start or Join; from Mob settings ([replay]) it ends
  /// with one key back to the den.
  static Future<void> howItWorks(BuildContext context, {bool replay = false}) =>
      _push(context, MobExplainerScreen(via: replay ? ExplainerVia.replay : ExplainerVia.start), name: '/mob/how');

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
