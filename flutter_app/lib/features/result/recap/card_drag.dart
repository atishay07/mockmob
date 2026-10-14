import 'package:flutter/material.dart';
import 'package:flutter/semantics.dart';

import '../../../core/motion/motion.dart';
import '../copy.dart';

/// A sideways drag over the recap's cards: the card follows the finger at [follow] of the
/// distance (it is on a rubber band, not in the hand), and letting go past [commitDistance] (or
/// with a flick) turns to the next card when the drag went left, the previous one when it went
/// right. Let go short of that and the card springs back. At the first or last card the drag
/// toward nothing is held to a sixth of the follow, so the end is felt and not mistaken for a bug.
///
/// A separate axis from the cards' own scroll (vertical), so the two never fight. TalkBack and
/// switch users get "Next card" and "Previous card" as custom actions on the same area.
/// Reduced motion: no following, the commit still turns the card.
class CardDrag extends StatefulWidget {
  const CardDrag({super.key, required this.child, this.onNext, this.onBack, this.onThreshold, this.enabled = true});

  final Widget child;
  final VoidCallback? onNext;
  final VoidCallback? onBack;

  /// The drag just crossed the distance that commits (once per drag, a light tick).
  final VoidCallback? onThreshold;

  /// False while the sealed sheet is on card 1 (a drag there belongs to the sheet).
  final bool enabled;

  static const double follow = 0.35;
  static const double commitDistance = 72;
  static const double flick = 700;
  static const double maxShift = 96;

  /// The card's shift for a raw drag of [dx]: [follow] of it toward a card that exists, a sixth
  /// of that toward none, never beyond [maxShift].
  static double shiftFor(double dx, {required bool hasNext, required bool hasBack}) {
    final toward = dx < 0 ? hasNext : hasBack;
    final f = toward ? follow : follow / 6;
    return (dx * f).clamp(-maxShift, maxShift);
  }

  /// What letting go does: -1 for the next card, 1 for the previous, 0 to spring back.
  static int decide(double dx, double velocity, {required bool hasNext, required bool hasBack}) {
    final far = dx.abs() >= commitDistance;
    final quick = velocity.abs() >= flick && dx.abs() >= 16 && (velocity < 0) == (dx < 0);
    if (!far && !quick) return 0;
    if (dx < 0 && hasNext) return -1;
    if (dx > 0 && hasBack) return 1;
    return 0;
  }

  @override
  State<CardDrag> createState() => _CardDragState();
}

class _CardDragState extends State<CardDrag> with SingleTickerProviderStateMixin {
  late final AnimationController _back = AnimationController(vsync: this, duration: const Duration(milliseconds: 280));
  double _dx = 0;
  double _shift = 0;
  double _from = 0;
  bool _crossed = false;
  late final Animation<double> _curve = CurvedAnimation(parent: _back, curve: Motion.out);

  @override
  void initState() {
    super.initState();
    _back.addListener(() {
      if (_back.isAnimating) setState(() => _shift = _from * (1 - _curve.value));
    });
  }

  @override
  void dispose() {
    _back.dispose();
    super.dispose();
  }

  bool get _hasNext => widget.onNext != null;
  bool get _hasBack => widget.onBack != null;

  void _start(DragStartDetails d) {
    _back.stop();
    _dx = 0;
    _crossed = false;
  }

  void _update(DragUpdateDetails d) {
    _dx += d.delta.dx;
    final reduced = Motion.reduced(context);
    final next = reduced ? 0.0 : CardDrag.shiftFor(_dx, hasNext: _hasNext, hasBack: _hasBack);
    final crossed = CardDrag.decide(_dx, 0, hasNext: _hasNext, hasBack: _hasBack) != 0;
    if (crossed && !_crossed) widget.onThreshold?.call();
    _crossed = crossed;
    if (next != _shift) setState(() => _shift = next);
  }

  void _end(DragEndDetails d) {
    final v = d.primaryVelocity ?? 0;
    final decision = CardDrag.decide(_dx, v, hasNext: _hasNext, hasBack: _hasBack);
    _dx = 0;
    _crossed = false;
    if (decision < 0) widget.onNext?.call();
    if (decision > 0) widget.onBack?.call();
    if (_shift == 0) return;
    // The card (or the one that replaced it) settles home from where it was let go.
    _from = _shift;
    _back.forward(from: 0);
  }

  @override
  Widget build(BuildContext context) {
    Widget child = widget.child;
    if (widget.enabled) {
      child = GestureDetector(
        behavior: HitTestBehavior.translucent,
        onHorizontalDragStart: _start,
        onHorizontalDragUpdate: _update,
        onHorizontalDragEnd: _end,
        onHorizontalDragCancel: () {
          _dx = 0;
          _crossed = false;
          if (_shift != 0) {
            _from = _shift;
            _back.forward(from: 0);
          }
        },
        child: Transform.translate(offset: Offset(_shift, 0), transformHitTests: false, child: child),
      );
      child = Semantics(
        container: false,
        customSemanticsActions: {
          if (widget.onNext != null) const CustomSemanticsAction(label: ResultCopy.nextCard): widget.onNext!,
          if (widget.onBack != null) const CustomSemanticsAction(label: ResultCopy.previousCard): widget.onBack!,
        },
        child: child,
      );
    }
    return child;
  }
}
