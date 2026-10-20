// K1 to K4 (spec 5.3 M-sheets, 5.6 M8 to M11): the full-screen moments, one route over the shell
// (MobV3Nav.moment pushes it with a fade, opaque false). Keys, as the server sends them in
// `v3.moments` (or the chain's `due`):
//   quest_done:<mobId>:<week>  K2 Quest done (M10)
//   stitch:<mobId>:<week>      K3 Week stitched (M8); plays only once the server says the quest is done (F13)
//   reveal:<fold>      K4 Reveal (M9)
//   chain:<n>          K1 Milestone (M11)
// Every moment has a visible Skip and a close X; any tap lands the end state in 200 ms. The overlay
// never marks a moment seen: the den does that after it closes, for every key in
// [momentsShownProvider] (K2's "Open the parcel" plays K4 in place, so one overlay can show two keys).
// Every number on screen is a server field (the den read and the chain read).

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/motion/motion.dart';
import '../../../../core/theme/theme.dart';
import '../copy_v3.dart';
import '../data/mob_v3_den.dart';
import '../data/mob_v3_models.dart';
import '../logic/fold_catalog.dart' show denItemsByWeek, foldRuleOf;
import '../mob_v3_nav.dart';
import '../widgets/moment_kit.dart';
import '../widgets/moment_milestone.dart';
import '../widgets/moment_quest_done.dart';
import '../widgets/moment_reveal.dart';
import '../widgets/moment_stitched.dart';
import '../widgets/paper_particles.dart' show PaperParticlesController;
import '../widgets/results_parts.dart' show RunStep;

/// Every moment key an overlay has shown (fully or skipped), in order. The den takes them after
/// `MobV3Nav.moment` returns and marks them seen (`POST /seen`); the overlay never calls seen.
class MomentsShown extends Notifier<List<String>> {
  @override
  List<String> build() => const [];

  void add(String key) {
    if (!state.contains(key)) state = [...state, key];
  }

  /// Returns the keys and clears them.
  List<String> take() {
    final out = state;
    state = const [];
    return out;
  }
}

final momentsShownProvider = NotifierProvider<MomentsShown, List<String>>(MomentsShown.new);

/// What the finished quest's parcel held, from what the server sent: the server's own parcel when it names a Fold;
/// else a `reveal:<fold>` due for a Fold the Mob earns by its quest (never a personal Fold such as Naav, app-mob-truth
/// H1 and M2); else a den object the chain reached this week and the shelf now holds; else the week's stitch.
QuestPrize questPrizeOf(MobV3 v3) {
  final p = v3.quest.parcel;
  if (p.kind == ParcelKind.fold && p.fold != null) return QuestPrize(ParcelKind.fold, fold: p.fold);
  for (final k in v3.moments) {
    final m = MomentKey.parse(k);
    final f = m.fold;
    if (m.kind == 'reveal' && f != null && foldRuleOf(f).source == 'mob_quest') return QuestPrize(ParcelKind.fold, fold: f);
  }
  final item = weekItemOf(v3);
  if (item != null) return QuestPrize(ParcelKind.item, item: item);
  return const QuestPrize(ParcelKind.stitch);
}

/// The den object the Mob's chain reached at this week, when the server's shelf holds it.
String? weekItemOf(MobV3 v3) {
  for (final item in denItemsByWeek[v3.mobChain.weeks] ?? const <String>[]) {
    if (item != 'stamp' && v3.shelf.items.contains(item)) return item;
  }
  return null;
}

/// The week's stitch key to play next, when one is due, allowed (F13) and not shown yet.
String? nextStitch(DenView den, {Set<String> shown = const {}}) {
  for (final k in den.v3.moments) {
    if (shown.contains(k)) continue;
    final m = MomentKey.parse(k);
    if (m.kind == 'stitch' && stitchAllowed(den, m)) return k;
  }
  return null;
}

/// The reveal key to play next, when the server sent one that has not been shown.
String? nextReveal(MobV3 v3, {Set<String> shown = const {}, FoldKey? only}) {
  for (final k in v3.moments) {
    if (shown.contains(k)) continue;
    final m = MomentKey.parse(k);
    if (m.kind == 'reveal' && m.fold != null && (only == null || m.fold == only)) return k;
  }
  return null;
}

/// The reveal the quest chain opens as its parcel: only the parcel's own Fold. Every other reveal plays later in the
/// queue on its own, never as if it had been in the parcel (app-mob-truth M2).
String? parcelReveal(MobV3 v3, {Set<String> shown = const {}}) {
  final prize = questPrizeOf(v3);
  if (prize.kind != ParcelKind.fold || prize.fold == null) return null;
  return nextReveal(v3, shown: shown, only: prize.fold);
}

/// F13: a stitch plays only after the server reported this week's quest done, for this Mob's week.
bool stitchAllowed(DenView den, MomentKey key) {
  final v3 = den.v3;
  if (key.kind != 'stitch' || !v3.quest.done) return false;
  if (key.mobId != null && den.mobId.isNotEmpty && key.mobId != den.mobId) return false;
  return v3.quest.week == null || key.week == null || v3.quest.week == key.week;
}

class MomentOverlay extends ConsumerStatefulWidget {
  const MomentOverlay({super.key, required this.momentKey, this.onDone});

  final String momentKey;

  /// Set inside the results run (A10): this moment is one screen of the run. Its key and X call [onDone] (the run
  /// moves on or leaves), and it never plays the next moment in place: the run already lists each one as a screen.
  final VoidCallback? onDone;

  bool get single => onDone != null;

  @override
  ConsumerState<MomentOverlay> createState() => _MomentOverlayState();
}

class _MomentOverlayState extends ConsumerState<MomentOverlay> {
  late String _current = widget.momentKey;
  bool _closing = false;
  bool _sitting = false;
  String? _error;

  void _record(String key) => ref.read(momentsShownProvider.notifier).add(key);

  void _close() {
    if (_closing) return;
    _closing = true;
    _record(_current);
    final done = widget.onDone;
    if (done != null) {
      done();
      return;
    }
    Navigator.of(context).maybePop();
  }

  /// The key in the results run: Continue, or Back to the den on the last screen.
  String get _runLabel => RunStep.maybeOf(context)?.last == false ? MobV4ResultsCopy.continueKey : MobV3Copy.backToDen;

  /// Plays another due moment in place (K2 to K4 or K3), with a fade through.
  void _playInPlace(String key) {
    _record(_current);
    setState(() {
      _current = key;
      _error = null;
    });
  }

  Future<void> _playAs(FoldKey fold) async {
    if (_sitting) return;
    setState(() {
      _sitting = true;
      _error = null;
    });
    try {
      await ref.read(mobV3ActionsProvider).sitAs(fold);
      if (mounted) _close();
    } on Object catch (e) {
      if (mounted) {
        setState(() {
          _sitting = false;
          _error = MobV3Copy.error(e);
        });
      }
    }
  }

  void _shelf() {
    if (_closing) return;
    final nav = Navigator.of(context, rootNavigator: true);
    _close();
    MobV3Nav.shelf(nav.context);
  }

  void _closeLater() => WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) _close();
      });

  @override
  Widget build(BuildContext context) {
    final den = ref.watch(denViewProvider);
    final key = MomentKey.parse(_current);
    final Widget child = switch (key.kind) {
      'quest_done' => _questDone(den),
      'stitch' => _stitch(den, key),
      'reveal' => _reveal(den, key.fold),
      'chain' => _milestone(key.days),
      _ => _unknown(),
    };
    return Stack(
      children: [
        Positioned.fill(
          child: MmOverlapSwitcher(
            fit: StackFit.expand,
            child: KeyedSubtree(key: ValueKey(_current), child: child),
          ),
        ),
        if (_error != null)
          Positioned(
            left: MmSpace.gutter,
            right: MmSpace.gutter,
            bottom: 96 + MediaQuery.paddingOf(context).bottom,
            child: Text(_error!, style: context.mmType.small.copyWith(color: context.mmColors.badText), textAlign: TextAlign.center),
          ),
      ],
    );
  }

  Widget _unknown() {
    _closeLater();
    return _Blank(onClose: _close);
  }

  /// The keys this overlay has shown so far, the current one included.
  Set<String> get _shownHere => {...ref.read(momentsShownProvider), _current};

  Widget _questDone(DenView? den) {
    if (den == null || !den.v3.quest.done) return _unknown();
    final v3 = den.v3;
    final prize = questPrizeOf(v3);
    // The spec's order (5.6): quest done, week stitched, reveal; each once. K2's key goes to the next
    // one that is due: the stitch (when allowed), else the reveal.
    final stitchKey = nextStitch(den, shown: _shownHere) ?? '';
    final revealKey = parcelReveal(v3, shown: _shownHere);
    final String label;
    final VoidCallback onKey;
    if (widget.single) {
      label = _runLabel;
      onKey = _close;
    } else if (stitchKey.isNotEmpty) {
      // With a Fold in the parcel the pennant comes first and K3's key opens the parcel.
      label = prize.kind == ParcelKind.item ? MobV3Copy.openParcel : MobV3Copy.seePennant;
      onKey = () => _playInPlace(stitchKey);
    } else if (revealKey != null) {
      label = MobV3Copy.openParcel;
      onKey = () => _playInPlace(revealKey);
    } else {
      label = prize.kind == ParcelKind.stitch ? MobV3Copy.seePennant : MobV3Copy.openParcel;
      onKey = _close;
    }
    return QuestDoneMoment(
      mobName: v3.name.text,
      members: v3.members,
      quest: v3.quest,
      week: v3.mobChain.weeks,
      prize: prize,
      keyLabel: label,
      onKey: onKey,
      onClose: _close,
    );
  }

  Widget _stitch(DenView? den, MomentKey key) {
    if (den == null || !stitchAllowed(den, key)) return _unknown();
    final v3 = den.v3;
    final revealKey = parcelReveal(v3, shown: _shownHere);
    return StitchedMoment(
      mobName: v3.name.text,
      members: v3.members,
      weeks: v3.mobChain.weeks,
      item: weekItemOf(v3),
      keyLabel: widget.single ? _runLabel : (revealKey == null ? MobV3Copy.backToDen : MobV3Copy.openParcel),
      onKey: widget.single || revealKey == null ? _close : () => _playInPlace(revealKey),
      onClose: _close,
    );
  }

  Widget _reveal(DenView? den, FoldKey? fold) {
    if (fold == null) return _unknown();
    // The Mob is named only when this Fold is its own finished quest's parcel; any other reveal says how it was earned
    // in its own words (app-mob-truth H1).
    final v3 = den?.v3;
    final prize = v3 == null ? null : questPrizeOf(v3);
    final ownParcel = v3 != null && v3.quest.done && prize?.kind == ParcelKind.fold && prize?.fold == fold;
    return RevealMoment(
      mobName: ownParcel ? v3.name.text : null,
      fold: fold,
      playing: _sitting,
      onPlayAs: () => _playAs(fold),
      onShelf: widget.single ? _close : _shelf,
      onClose: _close,
    );
  }

  Widget _milestone(int? n) {
    if (n == null || n <= 0) return _unknown();
    final chain = ref.watch(chainProvider);
    return chain.when(
      data: (c) => MilestoneMoment(days: n, chain: c, onKey: _close, onClose: _close),
      loading: () => _Blank(onClose: _close),
      error: (_, _) => _unknown(),
    );
  }
}

/// The frame with nothing in it yet (the chain is loading), or on the way out.
class _Blank extends StatelessWidget {
  const _Blank({required this.onClose});
  final VoidCallback onClose;

  @override
  Widget build(BuildContext context) => MomentFrame(
        stageKey: GlobalKey(),
        title: null,
        lamp: const LampState(strength: 0.5),
        playing: false,
        onSkip: () {},
        onClose: onClose,
        body: const SizedBox.expand(),
        particles: _blankParticles,
        keys: const [],
        keysT: 0,
      );
}

final _blankParticles = PaperParticlesController();
