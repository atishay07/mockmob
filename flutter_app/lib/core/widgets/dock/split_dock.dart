import 'package:flutter/foundation.dart' show ValueListenable;
import 'package:flutter/material.dart';

import '../../motion/motion.dart';
import '../../theme/theme.dart';
import 'dock_pill.dart';
import 'start_button.dart';

/// The split glass dock (brief section 6): the tab pill and, 12 dp to its right, the Start
/// circle, floating 10 dp above the gesture inset. While content scrolls down both drift 8 dp
/// lower and shrink to 0.94; they come back on scroll up or when scrolling stops. It is never
/// hidden on a tab root.
class SplitDock extends StatefulWidget {
  const SplitDock({
    super.key,
    required this.currentIndex,
    required this.onTab,
    required this.onStart,
    this.showReviewDot = false,
    this.compact,
    this.startPressed = false,
  });

  final int currentIndex;
  final ValueChanged<int> onTab;

  /// Receives the Start circle's global rect, for the morph into the sheet.
  final ValueChanged<Rect> onStart;
  final bool showReviewDot;

  /// True while content is scrolling down.
  final ValueListenable<bool>? compact;

  /// Draws Start pressed (goldens).
  final bool startPressed;

  /// The pill's slot width for a screen [width]: 88 dp, narrower on small phones.
  static double slotFor(double width) {
    final room = width - 2 * MmSpace.gutter - MmDock.startSize - MmDock.gap - DockPill.pad * 2;
    return (room / 3).clamp(72.0, 88.0);
  }

  @override
  State<SplitDock> createState() => _SplitDockState();
}

class _SplitDockState extends State<SplitDock> {
  final GlobalKey _startKey = GlobalKey(debugLabel: 'start');

  @override
  Widget build(BuildContext context) {
    final width = MediaQuery.sizeOf(context).width;
    final startKey = _startKey;
    final currentIndex = widget.currentIndex;
    final onTab = widget.onTab;
    final showReviewDot = widget.showReviewDot;
    final startPressed = widget.startPressed;
    final onStart = widget.onStart;
    final row = Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        DockPill(currentIndex: currentIndex, onTap: onTab, showReviewDot: showReviewDot, slotWidth: SplitDock.slotFor(width)),
        const SizedBox(width: MmDock.gap),
        KeyedSubtree(
          key: startKey,
          child: StartButton(
            pressed: startPressed,
            onPressed: () {
              final box = startKey.currentContext?.findRenderObject() as RenderBox?;
              final origin = box == null
                  ? Rect.fromCenter(center: Offset(width - 46, MediaQuery.sizeOf(context).height - 60), width: 60, height: 60)
                  : box.localToGlobal(Offset.zero) & box.size;
              onStart(origin);
            },
          ),
        ),
      ],
    );

    final listenable = widget.compact;
    final body = listenable == null
        ? row
        : _CompactDrift(compact: listenable, child: row);
    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.viewPaddingOf(context).bottom + MmDock.lift),
      child: Center(heightFactor: 1, child: body),
    );
  }
}

class _CompactDrift extends StatefulWidget {
  const _CompactDrift({required this.compact, required this.child});

  final ValueListenable<bool> compact;
  final Widget child;

  @override
  State<_CompactDrift> createState() => _CompactDriftState();
}

class _CompactDriftState extends State<_CompactDrift> with SingleTickerProviderStateMixin {
  // Starts at the value the dock mounts with, so a dock built while compact is already compact.
  late final AnimationController _t = AnimationController(
    vsync: this,
    duration: Motion.glideDuration,
    reverseDuration: Motion.glideDuration,
    value: widget.compact.value ? 1 : 0,
  );

  @override
  void initState() {
    super.initState();
    widget.compact.addListener(_changed);
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    // Reduced motion shows the final state at once (brief section 7).
    if (Motion.reduced(context)) _t.value = widget.compact.value ? 1 : 0;
  }

  @override
  void didUpdateWidget(_CompactDrift oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.compact != widget.compact) {
      oldWidget.compact.removeListener(_changed);
      widget.compact.addListener(_changed);
      _changed();
    }
  }

  /// Compact gives 8 dp lower and 0.94 scale; reduced motion jumps straight there.
  void _changed() {
    final compact = widget.compact.value;
    if (Motion.reduced(context)) {
      _t.value = compact ? 1 : 0;
      return;
    }
    compact ? _t.forward() : _t.reverse();
  }

  @override
  void dispose() {
    widget.compact.removeListener(_changed);
    _t.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _t,
      builder: (context, child) {
        final e = Motion.glide.transform(_t.value);
        return Transform.translate(
          offset: Offset(0, 8 * e),
          child: Transform.scale(scale: 1 - 0.06 * e, alignment: Alignment.bottomCenter, child: child),
        );
      },
      child: widget.child,
    );
  }
}
