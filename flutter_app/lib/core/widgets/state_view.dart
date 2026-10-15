import 'dart:async';

import 'package:flutter/material.dart';

import '../motion/motion.dart';
import '../theme/theme.dart';
import 'art/scene_art.dart';
import 'key_button.dart';
import 'materials/light_field.dart';
import 'mobi.dart';

// The painted scenes travel with the state view, so features reach them through the barrel.
export 'art/scene_art.dart' show SceneArt, SceneImage, SceneVignette, StateScene;

enum StateViewKind { empty, error, offline }

/// A label and handler for one of the (at most two) actions of a [StateView].
class StateAction {
  const StateAction(this.label, this.onPressed, {this.loading = false});

  final String label;
  final VoidCallback onPressed;

  /// The action is running: the main key shows its spinner in place, keeps its size and ignores
  /// taps. Only the primary action shows it; the quiet secondary key has no spinner.
  final bool loading;
}

/// An empty, error or offline state: Mobi in a painted room (or, for an empty state with no scene
/// of its own, in a small pool of lamp light), a title, a message and up to two actions (the volt
/// pill and a quiet one). Offline sits Mobi in the unplugged room, an error in the room with the
/// loose cable and the repair kit (he shrugs once, `oops`, on the first failure of a run only: a
/// retry that fails again finds him calm), and an empty state in whichever room it names with
/// [scene]; both themes. Pass a [pose] to choose Mobi yourself. Every ending is designed: pass
/// the recovery action here.
class StateView extends StatefulWidget {
  const StateView({
    super.key,
    required this.kind,
    required this.title,
    this.message,
    this.primary,
    this.secondary,
    this.pose = MobiPose.idle,
    this.scene,
    this.art,
    this.slowArt,
    this.onSlow,
  }) : assert(primary != null || secondary == null, 'A secondary action needs a primary action.');

  final StateViewKind kind;
  final String title;
  final String? message;
  final StateAction? primary;
  final StateAction? secondary;

  /// [MobiPose.idle] (the default) lets the kind choose the art.
  final MobiPose pose;

  /// The painted room Mobi sits in. Offline always has its own (the unplugged desk) and an error
  /// always has its own (the lamp with the loose cable and the repair kit). An empty state shows a
  /// room only when it names one ([StateScene.allClear], [StateScene.nothingYet],
  /// [StateScene.saved], [StateScene.noResults]), because "nothing yet" is not "all marked" and
  /// not every empty state has a room that fits it.
  final StateScene? scene;

  /// The Mobi slot: replaces the default Mobi in the illustration area (a Mobi reacting to this
  /// particular state, a subject object). It sits in the same lamp pool, above the title, never
  /// over text. Ignored when the state shows a painted [scene] (an error that sets [art] or
  /// [slowArt] keeps its own picture and shows no room).
  final Widget? art;

  /// What the Mobi slot shows once the main action has run past [slowAfter] (a quietly thinking
  /// Mobi): it swaps in over the art with no blank frame, and back when the action stops. Null
  /// keeps the art; the default Mobi then turns to quiet thought by itself.
  final Widget? slowArt;

  /// Called once each time the main action runs past [slowAfter], as the words change, for a
  /// caller whose own Mobi should react.
  final VoidCallback? onSlow;

  /// The scene this state shows, if any.
  StateScene? get shownScene => switch (kind) {
        StateViewKind.offline => StateScene.offline,
        StateViewKind.empty => (scene?.forEmpty ?? false) ? scene : null,
        StateViewKind.error => art == null && slowArt == null ? StateScene.unreachable : null,
      };

  /// How long the main action runs before the screen says so in words (MOTION.md P1-7).
  static const Duration slowAfter = Duration(seconds: 12);

  /// What the message line says once a retry has run long.
  static const String slowWords = 'Still trying. This can take a moment on a slow connection.';

  @override
  State<StateView> createState() => _StateViewState();
}

class _StateViewState extends State<StateView> {
  final MobiController _mobi = MobiController();
  final GlobalKey _action = GlobalKey(debugLabel: 'state-view-action');

  StateViewKind get kind => widget.kind;
  String get title => widget.title;
  String? get message => widget.message;
  StateAction? get primary => widget.primary;
  StateAction? get secondary => widget.secondary;
  MobiPose get pose => widget.pose;

  /// An error's first failure of a run: Mobi shrugs. Later failures of the same run are calm.
  late final bool _shrug = widget.kind == StateViewKind.error && widget.pose == MobiPose.idle && MobiRation.oopsRun('state-view');

  @override
  void initState() {
    super.initState();
    // Mobi's eyes lead the reader to the way out: once the screen is laid out it looks at the
    // main action (a held glance, not an idle loop). Still under reduced motion.
    if (widget.primary != null) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) _mobi.lookAtWidget(_action);
      });
    }
    if (widget.primary?.loading ?? false) _slowTimer = Timer(StateView.slowAfter, _goSlow);
  }

  /// The pose the default Mobi holds when nothing is running.
  MobiPose get _stance => pose != MobiPose.idle
      ? pose
      : switch (kind) {
          StateViewKind.empty => MobiPose.read,
          StateViewKind.offline || StateViewKind.error => MobiPose.rest,
        };

  /// Whether the default Mobi is on screen (no art of the caller's): in the pool, or sitting in
  /// the painted room.
  bool get _defaultMobi => widget.art == null && widget.slowArt == null;

  /// The main action has run long: the words say so, and Mobi turns to quiet thought (a real
  /// wait, so a real reaction; once per state).
  void _goSlow() {
    if (!mounted) return;
    setState(() => _slow = true);
    widget.onSlow?.call();
    if (_defaultMobi) _mobi.react(MobiAct.think, key: 'state-view:slow');
  }

  Timer? _slowTimer;
  bool _slow = false;

  @override
  void didUpdateWidget(StateView old) {
    super.didUpdateWidget(old);
    final was = old.primary?.loading ?? false;
    final now = widget.primary?.loading ?? false;
    if (was == now) return;
    _slowTimer?.cancel();
    _slowTimer = null;
    if (now) {
      _slowTimer = Timer(StateView.slowAfter, _goSlow);
    } else if (_slow) {
      _slow = false;
      // The wait is over and the state is still here (the retry failed again): back to rest.
      if (_defaultMobi) _mobi.react(_stance.act);
    }
  }

  @override
  void dispose() {
    _slowTimer?.cancel();
    _mobi.dispose();
    super.dispose();
  }

  Widget _art(BuildContext context, double size) {
    final slowArt = widget.slowArt;
    if (slowArt == null) return _picture(context, size, widget.art);
    final showSlow = _slow;
    // The slot swaps with no blank frame; each picture keeps its state while it is showing.
    return MmOverlapSwitcher(
      alignment: Alignment.bottomCenter,
      child: KeyedSubtree(
        key: ValueKey<bool>(showSlow),
        child: _picture(context, size, showSlow ? slowArt : widget.art),
      ),
    );
  }

  Widget _picture(BuildContext context, double size, Widget? custom) {
    if (custom != null) return SizedBox(height: size, child: Center(child: custom));
    if (pose != MobiPose.idle) return Mobi(pose: pose, size: size, motion: MobiMotion.settle, controller: _mobi);
    return switch (kind) {
      StateViewKind.empty => Mobi(pose: MobiPose.read, size: size, motion: MobiMotion.settle, controller: _mobi),
      StateViewKind.offline => Mobi(pose: MobiPose.rest, size: size, motion: MobiMotion.settle, controller: _mobi),
      StateViewKind.error => Mobi(
          pose: MobiPose.rest,
          size: size,
          motion: MobiMotion.settle,
          controller: _mobi,
          entrance: _shrug ? MobiAct.oops : MobiAct.idle,
        ),
    };
  }

  @override
  Widget build(BuildContext context) {
    // Centred when it fits; scrolls (never clips) at large text sizes. Short slots get a
    // smaller Mobi so the actions stay in view.
    return LayoutBuilder(
      builder: (context, constraints) {
        final bounded = constraints.hasBoundedHeight;
        final compact = bounded && constraints.maxHeight < 600;
        return SingleChildScrollView(
          child: ConstrainedBox(
            constraints: BoxConstraints(minHeight: bounded ? constraints.maxHeight : 0),
            child: _content(context, compact),
          ),
        );
      },
    );
  }

  Widget _content(BuildContext context, bool compact) {
    final colors = context.mmColors;
    final type = context.mmType;
    // Large enough to be the screen's picture, not a speck on an empty canvas (SPACING.md 6: 140).
    final artSize = compact ? 96.0 : 140.0;
    final scene = widget.shownScene;

    // The stack sits at the optical centre, about 42% down the free height (SPACING.md 6), not the
    // geometric one: dead-centre reads as sinking.
    return Align(
      alignment: const Alignment(0, -0.16),
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 420),
        child: Padding(
          padding: const EdgeInsets.all(MmSpace.s24),
          // One entrance, in reading order: Mobi settles, then the title, the message and the
          // way out. Still under reduced motion.
          child: MmStagger(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                MmStaggerItem(
                  index: 0,
                  rise: 8,
                  child: scene != null
                      // The painted room is the picture: Mobi sits in its lit ellipse, the scene
                      // brings its own lamp, so no extra light pool is laid under it.
                      ? SceneVignette(
                          scene: scene,
                          maxHeight: compact ? 150 : 248,
                          controller: _mobi,
                          // Mobi sits in the scene; asleep at the unplugged desk is the one other seat,
                          // and an error shows whichever pose its caller chose (thinking, for one).
                          pose: pose == MobiPose.sleepy || (kind == StateViewKind.error && pose != MobiPose.idle) ? pose : MobiPose.rest,
                          // An error: one shrug as he arrives on the first failure of a run, calm after.
                          entrance: kind == StateViewKind.error ? (_shrug ? MobiAct.oops : MobiAct.idle) : null,
                        )
                      : SizedBox(
                    height: artSize * 1.3,
                    child: Stack(
                      alignment: Alignment.bottomCenter,
                      children: [
                        Positioned.fill(
                          child: LightField(
                            pools: [
                              LightPool(
                                color: colors.lamp.withValues(alpha: colors.isNight ? 0.18 : 0.16),
                                center: const Alignment(-0.15, 0.15),
                                radius: 0.24,
                                aspect: 1.8,
                              ),
                            ],
                          ),
                        ),
                        _art(context, artSize),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: MmSpace.s12),
                MmStaggerItem(
                  index: 1,
                  child: Semantics(
                    header: true,
                    child: Text(title, style: type.title, textAlign: TextAlign.center),
                  ),
                ),
                if (message != null) ...[
                  const SizedBox(height: MmSpace.s8),
                  MmStaggerItem(
                    index: 2,
                    // A retry that runs long says so in words; the line swaps in place (the message
                    // is already reserved, so nothing moves), the new words over the old with no
                    // blank frame between.
                    child: MmOverlapSwitcher(
                      alignment: Alignment.topCenter,
                      child: Text(
                        _slow ? StateView.slowWords : message!,
                        key: ValueKey<bool>(_slow),
                        style: type.body.copyWith(color: colors.ink2),
                        textAlign: TextAlign.center,
                      ),
                    ),
                  ),
                ],
                if (primary != null) ...[
                  const SizedBox(height: MmSpace.s24),
                  MmStaggerItem(
                    index: 3,
                    child: KeyedSubtree(key: _action, child: KeyButton(label: primary!.label, onPressed: primary!.onPressed, loading: primary!.loading)),
                  ),
                ],
                if (secondary != null) ...[
                  const SizedBox(height: MmSpace.s4),
                  MmStaggerItem(
                    index: 4,
                    child: Align(child: KeyButton.quiet(label: secondary!.label, onPressed: secondary!.onPressed)),
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}
