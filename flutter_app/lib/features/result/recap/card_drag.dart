import 'package:flutter/material.dart';
import 'package:flutter/physics.dart';
import 'package:flutter/semantics.dart';

import '../../../core/motion/motion.dart';
import '../copy.dart';

/// Where the dragged recap cards are, for whoever draws them (the recap's card switcher).
///
/// [shift] is the current card's sideways offset (it is in the hand while dragged), [exit] the
/// offset of the card a drag just threw out, and [enter] the side the card that replaced it comes
/// in from (dp, signed; 0 when the turn was not a drag).
class CardDragController extends ChangeNotifier {
  double _shift = 0;
  double _exit = 0;
  double _enter = 0;

  double get shift => _shift;
  double get exit => _exit;
  double get enter => _enter;

  void _set({double? shift, double? exit, double? enter}) {
    var changed = false;
    if (shift != null && shift != _shift) {
      _shift = shift;
      changed = true;
    }
    if (exit != null && exit != _exit) {
      _exit = exit;
      changed = true;
    }
    if (enter != null && enter != _enter) {
      _enter = enter;
      changed = true;
    }
    if (changed) notifyListeners();
  }

  /// Read once by the switcher when the next card is added: the side it comes in from. Taking it
  /// clears it, so a later turn by a key or the story bar enters the usual way.
  double takeEnter() {
    final e = _enter;
    _enter = 0;
    return e;
  }
}

/// A sideways drag over the recap's cards (pass 1016e AP3-01, ledger L34): the card is in the
/// hand, not on a rubber band. Toward a card that exists it follows the finger 1:1. Letting go
/// past [commitFraction] of the card's width, or with a flick of [flick] px/s the same way, throws
/// it out on [Springs.smooth] seeded with the finger's velocity while the next card comes in from
/// the other side; short of that it springs home on [Springs.snappy], again from the finger's
/// velocity. Toward nothing (the first or last card) the drag rubber-bands at [edgeFollow], so
/// the end is felt and not mistaken for a bug.
///
/// A separate axis from the cards' own scroll (vertical), so the two never fight. TalkBack and
/// switch users get "Next card" and "Previous card" as custom actions on the same area.
/// Reduced motion: no following and no throw; the commit still turns the card.
class CardDrag extends StatefulWidget {
  const CardDrag({
    super.key,
    required this.child,
    this.onNext,
    this.onBack,
    this.onThreshold,
    this.enabled = true,
    this.controller,
  });

  final Widget child;
  final VoidCallback? onNext;
  final VoidCallback? onBack;

  /// The drag just crossed the distance that commits (once per drag, a light tick).
  final VoidCallback? onThreshold;

  /// False while the sealed sheet is on card 1 (a drag there belongs to the sheet).
  final bool enabled;

  /// When given, the offsets are written here and the drawing is left to its listener (so the
  /// leaving card and the arriving one can move apart). Without it the child itself is moved.
  final CardDragController? controller;

  /// Toward a card that exists the card is in the hand.
  static const double follow = 1.0;

  /// Toward nothing: a rubber band.
  static const double edgeFollow = 0.15;

  /// The farthest the rubber band gives at an end.
  static const double edgeMax = 48;

  /// Letting go past this share of the card's width turns it (about 115 dp on a 384 dp card).
  static const double commitFraction = 0.30;

  /// A flick this fast (px/s) the same way turns it from anywhere past 16 dp.
  static const double flick = 500;

  /// How far the arriving card starts to the side of its place (dp).
  static const double enterFrom = 56;

  /// The card's shift for a raw drag of [dx]: 1:1 toward a card that exists, a rubber band
  /// ([edgeFollow], at most [edgeMax]) toward none.
  static double shiftFor(double dx, {required bool hasNext, required bool hasBack}) {
    final toward = dx < 0 ? hasNext : hasBack;
    if (toward) return dx * follow;
    return (dx * edgeFollow).clamp(-edgeMax, edgeMax);
  }

  /// The drag distance that commits on a card [width] wide.
  static double commitFor(double width) => width * commitFraction;

  /// What letting go does: -1 for the next card, 1 for the previous, 0 to spring back.
  static int decide(double dx, double velocity, {required bool hasNext, required bool hasBack, double width = 384}) {
    final far = dx.abs() >= commitFor(width);
    final quick = velocity.abs() >= flick && dx.abs() >= 16 && (velocity < 0) == (dx < 0);
    if (!far && !quick) return 0;
    if (dx < 0 && hasNext) return -1;
    if (dx > 0 && hasBack) return 1;
    return 0;
  }

  @override
  State<CardDrag> createState() => _CardDragState();
}

class _CardDragState extends State<CardDrag> with TickerProviderStateMixin {
  late final AnimationController _home;
  late final AnimationController _out;
  final CardDragController _own = CardDragController();
  double _dx = 0;
  bool _crossed = false;

  CardDragController get _c => widget.controller ?? _own;

  void _onHome() => _c._set(shift: _home.value);

  void _onOut() => _c._set(exit: _out.value);

  @override
  void initState() {
    super.initState();
    _home = AnimationController.unbounded(vsync: this)..addListener(_onHome);
    _out = AnimationController.unbounded(vsync: this)..addListener(_onOut);
    _own.addListener(_rebuildOwn);
  }

  void _rebuildOwn() {
    if (widget.controller == null && mounted) setState(() {});
  }

  @override
  void dispose() {
    _home.dispose();
    _out.dispose();
    _own.dispose();
    super.dispose();
  }

  bool get _hasNext => widget.onNext != null;
  bool get _hasBack => widget.onBack != null;

  double get _width {
    final s = context.size;
    return s == null || s.width <= 0 ? 384 : s.width;
  }

  void _start(DragStartDetails d) {
    _home.stop();
    // A card caught on its way home is picked up where it is.
    _dx = _c.shift;
    _crossed = false;
  }

  void _update(DragUpdateDetails d) {
    _dx += d.delta.dx;
    final reduced = Motion.reduced(context);
    final next = reduced ? 0.0 : CardDrag.shiftFor(_dx, hasNext: _hasNext, hasBack: _hasBack);
    final crossed = CardDrag.decide(_dx, 0, hasNext: _hasNext, hasBack: _hasBack, width: _width) != 0;
    if (crossed && !_crossed) widget.onThreshold?.call();
    _crossed = crossed;
    _c._set(shift: next);
  }

  void _end(DragEndDetails d) {
    final v = d.primaryVelocity ?? 0;
    final decision = CardDrag.decide(_dx, v, hasNext: _hasNext, hasBack: _hasBack, width: _width);
    _dx = 0;
    _crossed = false;
    if (decision != 0) {
      _throw(decision, v);
      return;
    }
    _goHome(v);
  }

  /// The card in the hand goes out the way it was thrown, from where it was let go and at the
  /// finger's speed; its place is taken by the next card, coming in from the other side.
  void _throw(int decision, double velocity) {
    final reduced = Motion.reduced(context);
    final from = _c.shift;
    _home.stop();
    if (reduced) {
      _c._set(shift: 0, exit: 0, enter: 0);
    } else {
      final to = decision * _width;
      _c._set(shift: 0, exit: from, enter: -decision * CardDrag.enterFrom);
      _out.animateWith(SpringSimulation(Springs.smooth, from, to, velocity)).whenCompleteOrCancel(() {
        if (mounted) _c._set(exit: 0);
      });
    }
    if (decision < 0) widget.onNext?.call();
    if (decision > 0) widget.onBack?.call();
  }

  void _goHome(double velocity) {
    final from = _c.shift;
    if (from == 0) return;
    if (Motion.reduced(context)) {
      _c._set(shift: 0);
      return;
    }
    _home.value = from;
    // Settled to the pixel: a spring only reaches its end within its tolerance.
    _home.animateWith(SpringSimulation(Springs.snappy, from, 0, velocity)).whenCompleteOrCancel(() {
      if (mounted && !_home.isAnimating && _c.shift.abs() < 0.5) _c._set(shift: 0);
    });
  }

  @override
  Widget build(BuildContext context) {
    Widget child = widget.child;
    if (widget.enabled) {
      if (widget.controller == null) {
        child = Transform.translate(offset: Offset(_own.shift, 0), transformHitTests: false, child: child);
      }
      child = GestureDetector(
        behavior: HitTestBehavior.translucent,
        onHorizontalDragStart: _start,
        onHorizontalDragUpdate: _update,
        onHorizontalDragEnd: _end,
        onHorizontalDragCancel: () {
          _dx = 0;
          _crossed = false;
          _goHome(0);
        },
        child: child,
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
