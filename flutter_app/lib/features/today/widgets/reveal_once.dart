// A block below the fold that draws itself in once, the first time it comes into view (D52 motion:
// the timeline's nodes, the marks line). Its own length, so each block keeps the timing the design
// gives it. It runs once per page life and never loops: the page's storage remembers that it played
// (by [RevealOnce.id]), so a lazy list that rebuilds the block after a scroll away and back shows it
// in place, never again. It looks on every frame until it plays (a scroll, or a block above it
// changing height with no scroll at all), and costs nothing while nothing draws. Under reduced
// motion it is complete from the first frame, so everything is in place at once.
import 'package:flutter/scheduler.dart';
import 'package:flutter/widgets.dart';

import '../../../core/motion/motion.dart';

class RevealOnce extends StatefulWidget {
  const RevealOnce({super.key, required this.id, required this.length, required this.builder});

  /// The block's name in the page's storage, unique on the page.
  final String id;

  final Duration length;

  /// Builds the block from its 0 to 1 progress (linear; the block applies its own curves).
  final Widget Function(BuildContext context, Animation<double> progress) builder;

  @override
  State<RevealOnce> createState() => _RevealOnceState();
}

class _RevealOnceState extends State<RevealOnce> with SingleTickerProviderStateMixin {
  late final AnimationController _t = AnimationController(vsync: this, duration: widget.length);
  ScrollPosition? _position;
  bool _decided = false;
  bool _watching = false;

  /// How far into the viewport the block's top must come before it plays.
  static const double _threshold = 72;

  String get _key => 'reveal-once:${widget.id}';

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (!_decided && (Motion.reduced(context) || PageStorage.maybeOf(context)?.readState(context, identifier: _key) == true)) {
      _decided = true;
      _t.value = 1;
    }
    if (_decided) return;
    final position = Scrollable.maybeOf(context)?.position;
    if (position != _position) {
      _position?.removeListener(_check);
      _position = position?..addListener(_check);
    }
    _watch();
  }

  /// Looks again after the next frame, whatever draws it, until the block has played.
  void _watch() {
    if (_watching || _decided) return;
    _watching = true;
    SchedulerBinding.instance.addPostFrameCallback((_) {
      _watching = false;
      if (!mounted) return;
      _check();
      _watch();
    });
  }

  void _check() {
    if (_decided || !mounted) return;
    final box = context.findRenderObject();
    if (box is! RenderBox || !box.attached || !box.hasSize) return;
    final viewport = _position?.context.storageContext.findRenderObject();
    var top = 0.0;
    var bottom = double.infinity;
    if (viewport is RenderBox && viewport.attached && viewport.hasSize) {
      top = box.localToGlobal(Offset.zero, ancestor: viewport).dy;
      bottom = viewport.size.height;
    }
    if (top < bottom - _threshold) {
      _decided = true;
      _position?.removeListener(_check);
      _position = null;
      PageStorage.maybeOf(context)?.writeState(context, true, identifier: _key);
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
  Widget build(BuildContext context) => widget.builder(context, _t);
}
