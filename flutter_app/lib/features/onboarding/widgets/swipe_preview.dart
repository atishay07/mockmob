import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/physics.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/haptics/haptics.dart';
import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';
import '../copy.dart';

/// The first look at Today's swipe deck, on the sheet after sign-in (owner, D90: "When a
/// first-time user is entering, it won't know what cards actually do or what swipe left and
/// swipe right mean"). One 72 dp card titled "Your next moves come as cards": on first show it
/// nudges 24 dp right and then 24 dp left by itself, and a stamp lands on it in step with the
/// offset, "Up next" (volt) going right and "Not now" going left, as on Today's deck, so the
/// meaning of each side is seen before Today. The
/// student can drag it too; crossing the deck's commit threshold (30% of the width, as in
/// SWIPE-V2-1018 section 7) ticks once, and letting go springs it home: a preview never commits.
/// The words are the deck's own (SWIPE-V2-1018 section 12).
class SwipePreviewCard extends ConsumerStatefulWidget {
  const SwipePreviewCard({super.key, this.demo = true});

  /// Plays the nudge on first show (off in goldens of the rest state, and under reduced motion).
  final bool demo;

  /// The card's height.
  static const double height = 72;

  /// How far the demo nudges each way.
  static const double nudge = 24;

  /// The deck's commit threshold, as a share of the width (SWIPE-V2-1018 section 7).
  static const double threshold = 0.30;

  /// Each nudge's spring, and the pause between the two.
  static const Duration leg = Duration(milliseconds: 380);
  static const Duration pause = Duration(milliseconds: 200);

  @override
  ConsumerState<SwipePreviewCard> createState() => _SwipePreviewCardState();
}

class _SwipePreviewCardState extends ConsumerState<SwipePreviewCard> with SingleTickerProviderStateMixin {
  late final AnimationController _x = AnimationController.unbounded(vsync: this);
  static final SpringDescription _leg = SpringDescription.withDurationAndBounce(duration: SwipePreviewCard.leg, bounce: 0.15);
  bool _demoStopped = false;
  bool _past = false;
  double _width = 1;

  @override
  void initState() {
    super.initState();
    if (widget.demo) WidgetsBinding.instance.addPostFrameCallback((_) => unawaited(_playDemo()));
  }

  @override
  void dispose() {
    _x.dispose();
    super.dispose();
  }

  Future<void> _springTo(double target, {double velocity = 0}) {
    final sim = SpringSimulation(_leg, _x.value, target, velocity);
    return _x.animateWith(sim).orCancel.catchError((Object _) {});
  }

  /// Right 24 dp, settle, a 200 ms pause, left 24 dp, settle, home. Any touch stops it.
  Future<void> _playDemo() async {
    if (!mounted || Motion.reduced(context)) return;
    await _springTo(SwipePreviewCard.nudge);
    if (_demoStopped || !mounted) return;
    await _springTo(0);
    if (_demoStopped || !mounted) return;
    await Future<void>.delayed(SwipePreviewCard.pause);
    if (_demoStopped || !mounted) return;
    await _springTo(-SwipePreviewCard.nudge);
    if (_demoStopped || !mounted) return;
    await _springTo(0);
  }

  void _start(DragStartDetails _) {
    _demoStopped = true;
    _x.stop();
  }

  void _update(DragUpdateDetails d) {
    _x.value += d.delta.dx;
    final past = _x.value.abs() >= _width * SwipePreviewCard.threshold;
    if (past != _past) {
      _past = past;
      ref.read(hapticsProvider).selection();
    }
  }

  void _end(DragEndDetails d) {
    _past = false;
    unawaited(_springTo(0, velocity: d.velocity.pixelsPerSecond.dx));
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        LayoutBuilder(
          builder: (context, box) {
            _width = box.maxWidth.isFinite ? box.maxWidth : 360;
            final reveal = _width * SwipePreviewCard.threshold;
            return Semantics(
              container: true,
              label: '${OnboardingCopy.swipePreviewTitle}. ${OnboardingCopy.swipePreviewCaption}',
              excludeSemantics: true,
              child: GestureDetector(
                behavior: HitTestBehavior.opaque,
                onHorizontalDragStart: _start,
                onHorizontalDragUpdate: _update,
                onHorizontalDragEnd: _end,
                child: SizedBox(
                  height: SwipePreviewCard.height,
                  child: AnimatedBuilder(
                    animation: _x,
                    builder: (context, _) {
                      final x = _x.value;
                      // Each stamp lands with the offset toward it: full at the demo's 24 dp, so the
                      // nudge alone says what each side means.
                      final right = (x / SwipePreviewCard.nudge).clamp(0.0, 1.0);
                      final left = (-x / SwipePreviewCard.nudge).clamp(0.0, 1.0);
                      final past = x.abs() >= reveal;
                      final lean = (x / 20).clamp(-6.0, 6.0) * 3.14159 / 180;
                      return Stack(
                        clipBehavior: Clip.none,
                        children: [
                          Positioned.fill(
                            child: _Track(right: right, left: left),
                          ),
                          Positioned.fill(
                            child: Transform.translate(
                              offset: Offset(x, 0),
                              child: Transform.rotate(
                                angle: lean,
                                child: _Face(lift: (x.abs() / reveal).clamp(0.0, 1.0), right: right, left: left, past: past),
                              ),
                            ),
                          ),
                        ],
                      );
                    },
                  ),
                ),
              ),
            );
          },
        ),
        const SizedBox(height: MmSpace.s8),
        ExcludeSemantics(
          child: Text(OnboardingCopy.swipePreviewCaption, style: type.small.copyWith(color: colors.ink2)),
        ),
      ],
    );
  }
}

/// What the card uncovers as it moves: the ground of the deck, with a chevron on the side it
/// leaves (volt going right, second ink going left).
class _Track extends StatelessWidget {
  const _Track({required this.right, required this.left});

  /// How far each side is in (0 to 1).
  final double right;
  final double left;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    return DecoratedBox(
      decoration: BoxDecoration(color: colors.sunken, borderRadius: BorderRadius.circular(MmRadius.key)),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: MmSpace.s8),
        child: Row(
          children: [
            Opacity(opacity: right, child: Icon(LucideIcons.chevronsRight, size: 16, color: colors.accentText)),
            const Spacer(),
            Opacity(opacity: left, child: Icon(LucideIcons.chevronsLeft, size: 16, color: colors.ink2)),
          ],
        ),
      ),
    );
  }
}

/// The card itself: a small stack of cards, the title, and a two-way drag mark.
class _Face extends StatelessWidget {
  const _Face({required this.lift, required this.right, required this.left, required this.past});

  /// 0 at rest, 1 at the threshold: the card lifts a little as it is dragged.
  final double lift;

  /// How far each stamp is in (0 to 1), and whether the drag is past the deck's threshold (the
  /// edge turns accent going right, as on Today).
  final double right;
  final double left;
  final bool past;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return DecoratedBox(
      decoration: BoxDecoration(
        color: colors.raised,
        borderRadius: BorderRadius.circular(MmRadius.key),
        border: past ? Border.all(color: right > 0 ? colors.accentText : colors.ink3, width: 1.5) : Border.all(color: colors.line),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: (colors.isNight ? 0.28 : 0.08) + 0.08 * lift),
            blurRadius: 12 + 8 * lift,
            offset: Offset(0, 4 + 4 * lift),
          ),
        ],
      ),
      child: Stack(
        children: [
          Opacity(
            // The words step back while a stamp is on the card.
            opacity: 1 - 0.55 * (right > left ? right : left),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: MmSpace.s16),
              child: Row(
                children: [
                  const _MiniDeck(),
            const SizedBox(width: MmSpace.s12),
            Expanded(
              child: Text(
                OnboardingCopy.swipePreviewTitle,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: type.body.copyWith(fontWeight: FontWeight.w600, color: colors.ink),
              ),
            ),
                  const SizedBox(width: MmSpace.s8),
                  Icon(LucideIcons.moveHorizontal, size: 18, color: colors.ink3),
                ],
              ),
            ),
          ),
          if (right > 0)
            Positioned(
              left: MmSpace.s12,
              top: 0,
              bottom: 0,
              child: Center(child: _Stamp(label: OnboardingCopy.swipePreviewRight, color: colors.accentText, t: right, angle: -0.14)),
            ),
          if (left > 0)
            Positioned(
              right: MmSpace.s12,
              top: 0,
              bottom: 0,
              child: Center(child: _Stamp(label: OnboardingCopy.swipePreviewLeft, color: colors.ink2, t: left, angle: 0.14)),
            ),
        ],
      ),
    );
  }
}

/// A stamp as on Today's deck: the words in a 2 dp rim on the raised fill, landing from 1.08.
class _Stamp extends StatelessWidget {
  const _Stamp({required this.label, required this.color, required this.t, required this.angle});

  final String label;
  final Color color;

  /// 0 to 1: how far it has landed.
  final double t;
  final double angle;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    return Opacity(
      opacity: t,
      child: Transform.rotate(
        angle: angle,
        child: Transform.scale(
          scale: 1.08 - 0.08 * t,
          child: DecoratedBox(
            decoration: BoxDecoration(
              color: colors.raised,
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: color, width: 2),
            ),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: MmSpace.s12, vertical: MmSpace.s4),
              child: Text(label, maxLines: 1, style: context.mmType.cardTitle.copyWith(color: color, height: 1.2)),
            ),
          ),
        ),
      ),
    );
  }
}

/// Three small cards fanned like the deck on Today: the top one carries the volt mark.
class _MiniDeck extends StatelessWidget {
  const _MiniDeck();

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    Widget card(double angle, double dx, Color fill, {bool top = false}) => Transform.translate(
          offset: Offset(dx, 0),
          child: Transform.rotate(
            angle: angle,
            child: Container(
              width: 22,
              height: 30,
              decoration: BoxDecoration(
                color: fill,
                borderRadius: BorderRadius.circular(5),
                border: Border.all(color: top ? colors.ink.withValues(alpha: 0.5) : colors.line),
              ),
              alignment: Alignment.topLeft,
              padding: const EdgeInsets.all(4),
              child: top
                  ? Container(width: 6, height: 6, decoration: BoxDecoration(color: colors.volt, shape: BoxShape.circle))
                  : null,
            ),
          ),
        );
    return SizedBox(
      width: 40,
      height: 40,
      child: Stack(
        alignment: Alignment.center,
        children: [
          card(-0.22, -6, colors.raised2),
          card(0.18, 6, colors.raised2),
          card(0, 0, colors.raised, top: true),
        ],
      ),
    );
  }
}
