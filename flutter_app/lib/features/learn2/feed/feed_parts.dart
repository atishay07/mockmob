/// The feed's own small parts on the stage (what only the feed has; the stage parts are in `../stage/`):
///
///   FeedOptionKey   a key with a second line (the web's `.st-opt-key`): "Pick up where you stopped, 8 of 21" over the
///                   chapter, "Revise 3 due cards" over "About 1 min."; volt for the one lead, else a line key
///   FeedEndSwipe    the end as the pager's last page: a drag down that starts at the end's top goes back to the last
///                   item (past 18% of the screen or a 350 dp/s flick), as the web's pager does over its end
///   FeedCentreArea  a centred state in the item area that scrolls when the words are taller (text scale 1.3)
///   FeedSlowLine    "Taking longer than usual. Try again"
///   FeedFreeNote    Free's line over the end's keys with its own "See Pro"
library;

import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../../core/theme/theme.dart';
import '../../../core/widgets/materials/shape.dart';
import '../../../core/widgets/pressable.dart';
import '../stage/pager_model.dart';
import '../stage/stage_keys.dart';
import 'feed_copy.dart';

/// A full-width key with a second, smaller line under its label.
class FeedOptionKey extends StatelessWidget {
  const FeedOptionKey({super.key, required this.label, required this.onTap, this.sub, this.tone = StageTone.line});

  final String label;
  final String? sub;
  final VoidCallback? onTap;
  final StageTone tone;

  static const double radius = 14;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final volt = tone == StageTone.volt;
    final r = BorderRadius.circular(radius);
    final words = Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(
          label,
          textAlign: TextAlign.center,
          style: type.button.copyWith(fontSize: 16, height: 1.25, fontWeight: FontWeight.w600, color: volt ? colors.voltInk : colors.ink),
        ),
        if (sub != null && sub!.isNotEmpty) ...[
          const SizedBox(height: 2),
          Text(
            sub!,
            textAlign: TextAlign.center,
            style: type.body.copyWith(
              fontSize: 13,
              height: 1.35,
              fontWeight: FontWeight.w500,
              color: volt ? colors.voltInk.withValues(alpha: 0.72) : colors.ink3,
            ),
          ),
        ],
      ],
    );
    return MmPressable(
      onTap: onTap,
      lift: false,
      pressedScale: volt ? 0.985 : 0.98,
      focusRadius: r,
      haptic: MmPressHaptic.light,
      semanticsLabel: sub == null || sub!.isEmpty ? label : '$label. $sub',
      builder: (context, pressed, focused) {
        final face = DecoratedBox(
          decoration: ShapeDecoration(
            color: volt ? colors.volt : colors.raised,
            shape: mmShapeBorder(r, side: BorderSide(color: volt ? Color.lerp(colors.volt, colors.voltEdge, 0.6)! : colors.lineStrong)),
            shadows: [if (volt && !pressed) BoxShadow(color: colors.voltEdge, offset: const Offset(0, 3))],
          ),
          child: ConstrainedBox(
            constraints: const BoxConstraints(minHeight: 52, minWidth: double.infinity),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 10),
              child: Center(child: words),
            ),
          ),
        );
        return volt ? Transform.translate(offset: Offset(0, pressed ? 2 : -1), child: face) : face;
      },
    );
  }
}

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

/// Free's line on the end, with "See Pro" under it when Pro can be offered.
class FeedFreeNote extends StatelessWidget {
  const FeedFreeNote({super.key, required this.text, this.onSeePro});

  final String text;
  final VoidCallback? onSeePro;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(text, textAlign: TextAlign.center, style: type.body.copyWith(fontSize: 15, height: 1.5, fontWeight: FontWeight.w500, color: colors.ink2)),
          if (onSeePro != null) ...[const SizedBox(height: 2), StageTextKey(label: FeedCopy.seePro, onTap: onSeePro)],
        ],
      ),
    );
  }
}
