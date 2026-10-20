// A10 The results run (pass-1020 MOB-MINIMAL 3.4 and 4.3; MOB-V4-BUILD 4; D173): after a game, a short run of
// focused screens, then a celebration screen for each achievement this game earned. Only true screens appear:
//
//   1. the podium (always; lamp-lit, Skip lands it in 200 ms);
//   2. everyone's moment (always; stickers, Rematch);
//   3. Fix it together, only once the game has closed and its trap is chosen;
//   4. each earned achievement, in order: quest done, week stitched, a Fold earned (the parcel), the streak
//      milestone (version 13's design). These are the den's due moments after the server read the run.
//
// Step dots show the true length; the X on every screen returns to the den; Continue moves on and the last
// screen's key says "Back to the den". Every achievement key is marked seen only after its screen closed, and
// is remembered for this app run, so the den's own queue never plays it a second time.
//
// Achievements earned outside a game play the same screens on the next den open: the den calls
// [ResultsRun.showPending], which opens a run of only those screens (nothing when none is due).

import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/api/api_providers.dart' show nowProvider;
import '../../../../core/motion/motion.dart';
import '../../../../core/theme/theme.dart';
import '../../../../core/widgets/widgets.dart' show showMmSheet;
import '../../copy.dart' show MobCopy;
import '../../data/mob_navigator.dart' show mobNavigatorProvider;
import '../../screens/mob_sheets.dart' show InviteSheet;
import '../copy_v3.dart';
import '../data/mob_v3_api.dart';
import '../data/mob_v3_den.dart';
import '../data/mob_v3_models.dart';
import '../logic/moment_queue.dart';
import '../widgets/fold_manifest.dart';
import '../widgets/mark_sheets.dart';
import '../widgets/mob_fx.dart';
import '../widgets/podium_stage.dart';
import '../widgets/results_parts.dart';
import '../widgets/start_game_sheet.dart';
import 'fix_together_screen.dart' show FixTogetherView;
import 'moment_overlay.dart';
import 'moments_screen.dart';

/// One screen of the run.
sealed class RunScreen {
  const RunScreen();
}

class PodiumStep extends RunScreen {
  const PodiumStep();
}

class MomentsStep extends RunScreen {
  const MomentsStep();
}

class FixStep extends RunScreen {
  const FixStep(this.q);
  final int q;
}

/// An achievement: a moment key (`quest_done:…`, `stitch:…`, `reveal:<fold>`, `chain:<n>`).
class AchievementStep extends RunScreen {
  const AchievementStep(this.key);
  final String key;
}

/// What the run knows after its reads.
class RunFacts {
  const RunFacts({required this.podium, this.game, this.review});
  final Podium podium;
  final MobGame? game;
  final Review? review;

  /// Fix it together is true only once the game has closed and the server chose its trap (with a fix to do).
  bool get fixOpen => podium.trap != null && !podium.soFar && review?.trap != null;
}

/// The run's screens from what is true. [facts] is null for a run of achievements only (outside a game).
List<RunScreen> runScreensFor({RunFacts? facts, List<String> achievements = const []}) => [
      if (facts != null) ...[
        const PodiumStep(),
        const MomentsStep(),
        if (facts.fixOpen) FixStep(facts.podium.trap!.q),
      ],
      for (final k in achievements) AchievementStep(k),
    ];

/// The achievements to celebrate now: the den's due moments plus the chain's due milestones, in the spec's order
/// (quest done, week stitched, a Fold earned, streak), without those already shown in this app run and without any
/// the den could not show truthfully (a stitch before the quest is done, F13).
List<String> achievementsFor(DenView? den, List<String> chainDue, {Set<String> played = const {}}) {
  if (den == null) return const [];
  final out = <String>[];
  for (final k in momentOrder(den.v3.moments, chainDue)) {
    if (played.contains(k)) continue;
    final m = MomentKey.parse(k);
    final ok = switch (m.kind) {
      'quest_done' => den.v3.quest.done,
      'stitch' => stitchAllowed(den, m),
      'reveal' => m.fold != null,
      'chain' => (m.days ?? 0) > 0,
      _ => false,
    };
    if (ok) out.add(k);
  }
  return out;
}

/// Whether [s] is still true for [den]: an achievement re-checked as [achievementsFor] does; every other screen, and
/// any screen while the den is not read, stays.
bool stillTrue(RunScreen s, DenView? den) {
  if (s is! AchievementStep || den == null) return true;
  final m = MomentKey.parse(s.key);
  return switch (m.kind) {
    'quest_done' => den.v3.quest.done,
    'stitch' => stitchAllowed(den, m),
    'reveal' => m.fold != null,
    'chain' => (m.days ?? 0) > 0,
    _ => false,
  };
}

class ResultsRun extends ConsumerStatefulWidget {
  const ResultsRun({super.key, this.gameId, this.pending = const []}) : assert(gameId != null || pending.length > 0);

  /// The game this run follows, or null for a run of [pending] achievements only.
  final String? gameId;

  /// Achievement keys for a run outside a game ([showPending]).
  final List<String> pending;

  /// How many results runs are on screen. The den holds its event acts while one shows (4.2: a friend joining never
  /// plays under the podium).
  static final ValueNotifier<int> onScreen = ValueNotifier<int>(0);

  static Route<void> route({String? gameId, List<String> pending = const []}) => PageRouteBuilder<void>(
        settings: RouteSettings(name: gameId != null ? '/mob/game/$gameId/results' : '/mob/results'),
        transitionDuration: const Duration(milliseconds: 240),
        reverseTransitionDuration: const Duration(milliseconds: 200),
        pageBuilder: (_, _, _) => ResultsRun(gameId: gameId, pending: pending),
        transitionsBuilder: (_, a, _, child) => FadeTransition(opacity: CurvedAnimation(parent: a, curve: Motion.out), child: child),
      );

  /// After a run: the results run replaces the run screen (the X and Back return to the den, never to a finished run).
  static Future<void> afterRun(BuildContext context, String gameId) => Navigator.of(context).pushReplacement(route(gameId: gameId));

  /// The results of a game from anywhere (the den's "See the podium").
  static Future<void> open(BuildContext context, String gameId) => Navigator.of(context, rootNavigator: true).push(route(gameId: gameId));

  /// Achievements earned outside a game: the same celebration screens, on the next den open. Plays nothing when none
  /// is due. Completes when the run closes, with the keys that were shown (already marked seen).
  static Future<List<String>> showPending(BuildContext context) async {
    final container = ProviderScope.containerOf(context, listen: false);
    final den = container.read(denViewProvider);
    if (den == null) return const [];
    var due = const <String>[];
    try {
      due = await chainDueFor(
        den.v3.chainChip,
        cached: () => container.read(chainProvider.future),
        fresh: () => container.refresh(chainProvider.future),
      );
    } on Object {
      // No chain read: the Mob's own achievements still play.
    }
    final memory = container.read(denSessionMemoryProvider);
    final keys = achievementsFor(container.read(denViewProvider) ?? den, due, played: memory.playedMoments);
    if (keys.isEmpty || !context.mounted) return const [];
    final shown = container.read(_runShownProvider);
    shown.clear();
    await Navigator.of(context, rootNavigator: true).push(route(pending: keys));
    return List.of(shown);
  }

  @override
  ConsumerState<ResultsRun> createState() => _ResultsRunState();
}

/// The keys the last run showed (for [ResultsRun.showPending]'s answer).
final _runShownProvider = Provider<List<String>>((ref) => <String>[]);

class _ResultsRunState extends ConsumerState<ResultsRun> {
  late final Future<({RunFacts? facts, List<RunScreen> screens})> _load = _fetch();
  int _index = 0;
  bool _leaving = false;

  @override
  void initState() {
    super.initState();
    ResultsRun.onScreen.value++;
  }

  @override
  void dispose() {
    if (ResultsRun.onScreen.value > 0) ResultsRun.onScreen.value--;
    super.dispose();
  }

  Future<({RunFacts? facts, List<RunScreen> screens})> _fetch() async {
    final gameId = widget.gameId;
    if (gameId == null) return (facts: null, screens: runScreensFor(achievements: widget.pending));
    FoilSheenProgram.precache();
    final api = ref.read(mobV3ApiProvider);
    // The reads run side by side: the podium, the game, and the den refresh with the chain read. Only the review
    // waits, for the podium's trap.
    final podiumF = api.podium(gameId);
    final gameF = api.game(gameId).then<MobGame?>((g) => g, onError: (Object _) => null);
    final achievementsF = _achievements();
    final podium = await podiumF;
    Review? review;
    if (podium.trap != null && !podium.soFar) {
      try {
        review = await api.review(gameId);
      } on Object {
        review = null;
      }
    }
    final game = await gameF;
    if (mounted) {
      precacheFolds(context, [for (final p in podium.places) if (p.place == 1) p.fold], large: true);
      precacheFolds(context, [for (final p in podium.places) p.fold]);
    }
    final achievements = await achievementsF;
    final facts = RunFacts(podium: podium, game: game, review: review);
    return (facts: facts, screens: runScreensFor(facts: facts, achievements: achievements));
  }

  /// What this game earned, from the den read after the run (the server's acknowledgement). Capped at 1.5 s: a late
  /// den starts the run without achievements and leaves them for the den's next open, so the dots stay true.
  Future<List<String>> _achievements() async {
    Future<List<String>> read() async {
      await ref.read(mobV3ActionsProvider).refresh();
      final den = ref.read(denViewProvider);
      var due = const <String>[];
      if (den != null) {
        try {
          due = await chainDueFor(den.v3.chainChip, cached: () => ref.read(chainProvider.future), fresh: () => ref.refresh(chainProvider.future));
        } on Object {
          due = const [];
        }
      }
      return achievementsFor(ref.read(denViewProvider), due, played: ref.read(denSessionMemoryProvider).playedMoments);
    }

    try {
      return await read().timeout(const Duration(milliseconds: 1500));
    } on Object {
      return const [];
    }
  }

  /// The screens of this run once loaded (for [_exit]'s seen mark).
  List<RunScreen> _screens = const [];

  /// Achievements that have been on screen: they keep their place, so the steps behind the current one never move.
  final Set<String> _onScreen = {};

  /// The X (or the last key): back to the den. An achievement closed with its X counts as seen, so it never replays on
  /// the next den open.
  void _exit() {
    if (_leaving) return;
    _leaving = true;
    final screens = _screens;
    if (screens.isNotEmpty) {
      final current = screens[_index.clamp(0, screens.length - 1)];
      if (current is AchievementStep) unawaited(_markSeen(current.key));
    }
    Navigator.of(context).maybePop();
  }

  void _next(List<RunScreen> screens) {
    if (_leaving) return;
    final current = screens[_index];
    if (_index >= screens.length - 1) {
      _exit();
      return;
    }
    if (current is AchievementStep) unawaited(_markSeen(current.key));
    setState(() => _index++);
  }

  /// An achievement is marked seen only once its screen closed (shown fully or skipped), and remembered for this app
  /// run so the den's own queue never plays it again. A key shown in place inside another is marked with it.
  Future<void> _markSeen(String key) async {
    final recorded = ref.read(momentsShownProvider.notifier).take();
    final keys = {key, ...recorded}.toList();
    ref.read(denSessionMemoryProvider).playedMoments.addAll(keys);
    ref.read(_runShownProvider).addAll(keys.where((k) => !ref.read(_runShownProvider).contains(k)));
    await ref.read(mobV3ActionsProvider).seen(keys);
  }

  Future<void> _rematch(MobGame? game) async {
    final gameId = widget.gameId;
    if (gameId == null) return;
    final den = ref.read(denViewProvider);
    if (den?.v3.starts.can ?? false) {
      await showStartGame(
        context,
        prefill: StartGamePrefill(format: game?.format ?? GameFormat.sprint, count: game?.count ?? 5, chapter: game?.chapter, rematchOf: gameId, minutes: game?.minutes),
      );
      return;
    }
    if ((den?.v3.members.length ?? 0) <= 1) {
      await showMmSheet<void>(context: context, title: MobCopy.inviteTitle, builder: (_) => const InviteSheet());
      return;
    }
    final messenger = ScaffoldMessenger.maybeOf(context);
    try {
      final sent = await ref.read(mobV3ActionsProvider).sticker(StickerKind.again, game: gameId);
      if (!sent || !mounted) return;
      messenger?.showSnackBar(SnackBar(content: Text(MobV3Copy.rematchAsked), behavior: SnackBarBehavior.floating, duration: const Duration(seconds: 3)));
    } on Object catch (e) {
      if (!mounted) return;
      messenger?.showSnackBar(SnackBar(content: Text(MobV3Copy.error(e)), behavior: SnackBarBehavior.floating));
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.mmColors;
    return Scaffold(
      backgroundColor: c.ground,
      body: MobIdleScope(
        child: FutureBuilder<({RunFacts? facts, List<RunScreen> screens})>(
          future: _load,
          builder: (context, snap) {
            if (snap.hasError) {
              return ResultsRefused(message: MobV3Copy.error(snap.error!), onBack: _exit);
            }
            final data = snap.data;
            // Never an empty screen while the reads are on the way: the podium's lamp, waiting.
            if (data == null) return PodiumLampFrame(onClose: _exit);
            // An achievement still ahead is checked against the den again: one no longer true (the den changed
            // since the list was built) leaves the run and the dots shrink, never a blank screen that counts as a
            // step (review fix 14). Screens already passed keep their place.
            final den = ref.watch(denViewProvider);
            final screens = [
              for (final s in data.screens)
                if (s is! AchievementStep || _onScreen.contains(s.key) || stillTrue(s, den)) s,
            ];
            _screens = screens;
            if (screens.isEmpty) {
              WidgetsBinding.instance.addPostFrameCallback((_) => _exit());
              return const SizedBox.expand();
            }
            final i = _index.clamp(0, screens.length - 1);
            final screen = screens[i];
            if (screen is AchievementStep) _onScreen.add(screen.key);
            return RunStep(
              index: i,
              total: screens.length,
              onNext: () => _next(screens),
              onExit: _exit,
              onRematch: data.facts == null ? null : () => _rematch(data.facts!.game),
              child: MmOverlapSwitcher(
                fit: StackFit.expand,
                child: KeyedSubtree(key: ValueKey('run-step-$i'), child: _screen(context, screen, data.facts, () => _next(screens))),
              ),
            );
          },
        ),
      ),
    );
  }

  Widget _screen(BuildContext context, RunScreen s, RunFacts? facts, VoidCallback next) {
    final gameId = widget.gameId ?? '';
    final mobName = ref.watch(denViewProvider)?.v3.name.text ?? '';
    switch (s) {
      case PodiumStep():
        final f = facts!;
        final game = f.game;
        final now = game?.serverNow ?? ref.read(nowProvider)();
        final mock = game?.format == GameFormat.mock || f.podium.sheets.isNotEmpty;
        final resultId = game?.you.resultId;
        return PodiumStage(
          key: const ValueKey('run-podium'),
          podium: f.podium,
          gameTitle: game?.title ?? '',
          now: now,
          onClose: _exit,
          onMoments: next,
          below: mock && f.podium.sheets.isNotEmpty ? MobMarkSheets(sheets: f.podium.sheets) : null,
          primaryLabel: mock && resultId != null ? MobV3Copy.yourMarkSheet : null,
          onPrimary: mock && resultId != null ? () => ref.read(mobNavigatorProvider).openAnswers(context, resultId) : null,
        );
      case MomentsStep():
        final f = facts!;
        return MomentsView(
          key: const ValueKey('run-moments'),
          data: (podium: f.podium, game: f.game, review: f.review),
          gameId: gameId,
          mobName: mobName,
          mobSize: ref.watch(denViewProvider)?.v3.members.length,
          now: f.game?.serverNow ?? ref.read(nowProvider)(),
        );
      case FixStep(:final q):
        final f = facts!;
        return FixTogetherView(
          key: const ValueKey('run-fix'),
          review: f.review!,
          gameId: gameId,
          q: q,
          mobName: mobName,
          now: f.game?.serverNow ?? ref.read(nowProvider)(),
        );
      case AchievementStep(:final key):
        return MomentOverlay(key: ValueKey('run-moment-$key'), momentKey: key, onDone: next, onExit: _exit);
    }
  }
}
