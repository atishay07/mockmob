import 'package:flutter/material.dart';

import '../../../core/motion/motion.dart';
import '../model/practice_door.dart';

/// Where Practice's doors stand (D126): one door on show, the others kept as the student left them (a subject filter on
/// Your papers, a search in Learn, the cards' own state) but out of sight, out of touch and out of the focus order.
/// A door is built the first time it is opened, so a first visit to Practice builds only Practise.
///
/// A change of door is one calm fade-through (the app's own pattern for content that changes in place): the old door
/// lifts out over 90 ms and drifts a few dp away, then the new one comes in over 210 ms on the app's ease-out, sliding
/// 16 dp from the side of the door that was tapped (from the right for a door further along, from the left for one
/// before). Never both at once. Reduced motion swaps at once.
class PracticeDoorStage extends StatefulWidget {
  const PracticeDoorStage({super.key, required this.door, required this.builder});

  final PracticeDoor door;
  final Widget Function(BuildContext context, PracticeDoor door) builder;

  /// The out half, then the in half.
  static const Duration outTime = Duration(milliseconds: 90);
  static const Duration inTime = Duration(milliseconds: 210);
  static const double travel = 16;

  @override
  State<PracticeDoorStage> createState() => _PracticeDoorStageState();
}

class _PracticeDoorStageState extends State<PracticeDoorStage> with SingleTickerProviderStateMixin {
  late PracticeDoor _shown = widget.door;
  late final Set<PracticeDoor> _built = {widget.door};
  double _dir = 1;

  static final double _outShare = PracticeDoorStage.outTime.inMicroseconds / (PracticeDoorStage.outTime + PracticeDoorStage.inTime).inMicroseconds;

  late final AnimationController _c = AnimationController(vsync: this, duration: PracticeDoorStage.outTime + PracticeDoorStage.inTime, value: 1)
    ..addListener(_maybeSwap);

  void _maybeSwap() {
    if (_c.value >= _outShare && _shown != widget.door) setState(() => _shown = widget.door);
  }

  @override
  void didUpdateWidget(PracticeDoorStage old) {
    super.didUpdateWidget(old);
    if (widget.door == old.door) return;
    _built.add(widget.door);
    _dir = widget.door.index >= _shown.index ? 1 : -1;
    if (Motion.reduced(context)) {
      _c.value = 1;
      _shown = widget.door;
      return;
    }
    _c.forward(from: 0);
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final doors = Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        for (final d in PracticeDoor.values)
          if (_built.contains(d))
            KeyedSubtree(
              key: ValueKey('practice-door-body-${d.name}'),
              child: Offstage(
                offstage: d != _shown,
                child: TickerMode(
                  enabled: d == _shown,
                  child: ExcludeFocus(excluding: d != _shown, child: widget.builder(context, d)),
                ),
              ),
            ),
      ],
    );
    final sign = Directionality.maybeOf(context) == TextDirection.rtl ? -1.0 : 1.0;
    return AnimatedBuilder(
      animation: _c,
      child: doors,
      builder: (context, child) {
        final t = _c.value;
        final double opacity;
        final double dx;
        if (t < _outShare) {
          final p = t / _outShare;
          opacity = 1 - p;
          dx = -_dir * sign * PracticeDoorStage.travel / 3 * p;
        } else {
          final v = Motion.out.transform(((t - _outShare) / (1 - _outShare)).clamp(0.0, 1.0));
          opacity = v;
          dx = _dir * sign * PracticeDoorStage.travel * (1 - v);
        }
        // Always the same two wrappers, so the doors below are never rebuilt from scratch when the fade ends.
        return Opacity(opacity: opacity.clamp(0.0, 1.0), child: Transform.translate(offset: Offset(dx, 0), child: child));
      },
    );
  }
}
