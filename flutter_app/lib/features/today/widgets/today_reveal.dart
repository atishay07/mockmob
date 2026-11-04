// The lower sections of Today (the papers, the road, the colleges) usually sit below the fold,
// so the page's entrance runs while they are out of sight. Each one is wrapped in a
// [TodayReveal]: the first time its top edge comes into the viewport, it runs its own short
// entrance, so the road draws to Now and the picks rise onto their scale as the student scrolls
// to them, the way HIGH stages a section as it arrives. It runs once per page life and never on
// reduced motion; everything is in place and live from the first frame.
//
// A section only plays while it is on stage: a door that is built behind another one (Practice keeps its doors in
// place and hides the ones not shown, with their tickers off) waits until its tickers run, and then looks again after
// every frame until it has played, so a door that comes on stage with no scroll at all still draws in (4 Nov walk, I1:
// the Papers door's chart was one empty dot, and its newest row read 0 of 250, until the student scrolled).
import 'package:flutter/scheduler.dart';
import 'package:flutter/widgets.dart';

import '../../../core/motion/motion.dart';
import 'today_entrance.dart';

class TodayReveal extends StatefulWidget {
  const TodayReveal({super.key, required this.child});

  final Widget child;

  @override
  State<TodayReveal> createState() => _TodayRevealState();
}

class _TodayRevealState extends State<TodayReveal> with SingleTickerProviderStateMixin {
  late final AnimationController _t = AnimationController(vsync: this, duration: todayEntranceDuration);
  ScrollPosition? _position;
  bool _decided = false;
  bool _watching = false;

  /// How far into the viewport the section's top must come before it plays.
  static const double _threshold = 72;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (!_decided && Motion.reduced(context)) {
      _decided = true;
      _t.value = 1;
    }
    if (_decided) return;
    // Read here so a door that comes on stage (its tickers switching on) asks again.
    _onStage = TickerMode.valuesOf(context).enabled;
    final position = Scrollable.maybeOf(context)?.position;
    if (position != _position) {
      _position?.removeListener(_check);
      _position = position?..addListener(_check);
    }
    _watch();
  }

  bool _onStage = true;

  /// Looks again after the next frame, whatever moved it (a door coming on stage, a block above changing height with no
  /// scroll), until the section has played. Nothing runs while it is off stage or once it has played.
  void _watch() {
    if (_watching || _decided || !_onStage) return;
    _watching = true;
    SchedulerBinding.instance.addPostFrameCallback((_) {
      _watching = false;
      if (!mounted) return;
      _check();
      _watch();
    });
  }

  void _check() {
    if (_decided || !mounted || !_onStage) return;
    final box = context.findRenderObject();
    final viewport = _position?.context.storageContext.findRenderObject();
    if (box is! RenderBox || !box.attached || !box.hasSize) return;
    double bottom;
    double top;
    if (viewport is RenderBox && viewport.attached && viewport.hasSize) {
      top = box.localToGlobal(Offset.zero, ancestor: viewport).dy;
      bottom = viewport.size.height;
    } else {
      // No scrollable: the section is on screen as laid out.
      top = 0;
      bottom = double.infinity;
    }
    if (top < bottom - _threshold) {
      _decided = true;
      _position?.removeListener(_check);
      _position = null;
      _t.forward();
    }
  }

  @override
  void dispose() {
    _position?.removeListener(_check);
    _t.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => TodayEntranceScope(progress: _t, child: widget.child);
}
