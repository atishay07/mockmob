/// The feed's own small parts on the stage (what only the feed has; the stage parts are in `../stage/`):
///
///   FeedEndSwipe    the end as the pager's last page: a drag down that starts at the end's top goes back to the last
///                   item (past 18% of the screen or a 350 dp/s flick), as the web's pager does over its end
///   FeedCentreArea  a centred state in the item area that scrolls when the words are taller (text scale 1.3)
///   FeedSlowLine    "Taking longer than usual. Try again"
library;

import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../../core/theme/theme.dart';
import '../stage/pager_model.dart';
import '../stage/stage_keys.dart';
import 'feed_copy.dart';

/// The end over the stage: a drag down that starts with the end scrolled to its top goes back to the last item.
class FeedEndSwipe extends StatefulWidget {
  const FeedEndSwipe({super.key, required this.child, required this.onBack, this.enabled = true});

  final Widget child;
  final VoidCallback onBack;
  final bool enabled;

  @override
  State<FeedEndSwipe> createState() => _FeedEndSwipeState();
}

class _FeedEndSwipeState extends State<FeedEndSwipe> {
  int? _pointer;
  Offset _down = Offset.zero;
  bool _atTop = true;
  double _pixels = 0;
  PagerTouch? _lock;
  final List<PagerSample> _samples = [];

  static double _ms(Duration t) => t.inMicroseconds / 1000.0;

  bool _onScroll(ScrollNotification n) {
    if (n.depth == 0 && n.metrics.axis == Axis.vertical) _pixels = n.metrics.pixels - n.metrics.minScrollExtent;
    return false;
  }

  void _start(PointerDownEvent e) {
    if (!widget.enabled || _pointer != null) return;
    _pointer = e.pointer;
    _down = e.position;
    _atTop = _pixels <= 1;
    _lock = null;
    _samples
      ..clear()
      ..add((t: _ms(e.timeStamp), y: e.position.dy));
  }

  void _move(PointerMoveEvent e) {
    if (e.pointer != _pointer) return;
    _samples.add((t: _ms(e.timeStamp), y: e.position.dy));
    if (_samples.length > 12) _samples.removeAt(0);
    if (_lock == null) {
      final lock = PagerModel.touchLock(e.position.dx - _down.dx, e.position.dy - _down.dy);
      if (lock != PagerTouch.tap) _lock = lock;
    }
  }

  void _end(PointerUpEvent e) {
    if (e.pointer != _pointer) return;
    _pointer = null;
    if (!widget.enabled || !_atTop || _lock != PagerTouch.vertical) return;
    final dy = e.position.dy - _down.dy;
    if (dy <= 0) return;
    final height = MediaQuery.sizeOf(context).height;
    final target = PagerModel.releaseTarget(dy: dy, v: PagerModel.releaseVelocity(_samples), height: height, index: 1, count: 2);
    if (target == 0) widget.onBack();
  }

  @override
  Widget build(BuildContext context) => Listener(
    behavior: HitTestBehavior.translucent,
    onPointerDown: _start,
    onPointerMove: _move,
    onPointerUp: _end,
    onPointerCancel: (e) {
      if (e.pointer == _pointer) _pointer = null;
    },
    child: NotificationListener<ScrollNotification>(onNotification: _onScroll, child: widget.child),
  );
}

/// A centred state in the item area (the web's `.st-page--center`), scrolling when it is taller than the area.
class FeedCentreArea extends StatelessWidget {
  const FeedCentreArea({super.key, required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    final bias = 0.04 * MediaQuery.sizeOf(context).height;
    return LayoutBuilder(
      builder: (context, c) => SingleChildScrollView(
        child: ConstrainedBox(
          constraints: BoxConstraints(minHeight: math.max(0, c.maxHeight)),
          child: Padding(
            padding: EdgeInsets.fromLTRB(MmSpace.gutter, 0, MmSpace.gutter, bias),
            child: Center(child: child),
          ),
        ),
      ),
    );
  }
}

/// "Taking longer than usual." and Try again, under the loading card.
class FeedSlowLine extends StatelessWidget {
  const FeedSlowLine({super.key, required this.onRetry});

  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return Semantics(
      liveRegion: true,
      child: Wrap(
        alignment: WrapAlignment.center,
        crossAxisAlignment: WrapCrossAlignment.center,
        spacing: 6,
        children: [
          Text(FeedCopy.slow, style: type.body.copyWith(fontSize: 15, height: 1.5, fontWeight: FontWeight.w500, color: colors.ink2)),
          StageTextKey(label: FeedCopy.tryAgain, onTap: onRetry),
        ],
      ),
    );
  }
}
