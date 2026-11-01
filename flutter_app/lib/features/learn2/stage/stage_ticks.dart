/// The stage's ticks (the web's `Ticks`, A1 3.3, B7): one 2 dp segment per item with 3 dp gaps, radius 2. Done
/// segments are ink-2, the current one fills with the select colour left to right in 300 ms (`Motion.out`), the ones
/// ahead are ink at 34% on Night and 42% on Day (visible on Day). Over 48 items it is one bar whose select fill
/// stands at the share reached. A total of 0 draws one plain hairline (loading; no invented segments). The ticks
/// are decoration for a screen reader: the counter carries the number.
library;

import 'package:flutter/material.dart';

import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';
import 'stage_keys.dart' show stageSelect;

class StageTicks extends StatelessWidget {
  const StageTicks({super.key, this.total = 0, this.done = 0, this.current = -1});

  /// Items in all (0 while loading).
  final int total;

  /// Items before the current one that are done (the segments drawn ink-2).
  final int done;

  /// The current item (0-based), or -1 for none (a checkpoint, the end).
  final int current;

  static const double height = 2;
  static const double gap = 3;

  /// More items than this draw one bar.
  static const int maxSegments = 48;

  /// The colour of the ticks still ahead.
  static Color ahead(MmColors colors) => colors.ink.withValues(alpha: colors.isNight ? 0.34 : 0.42);

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final Widget body;
    if (total <= 0) {
      body = DecoratedBox(
        decoration: BoxDecoration(color: colors.line, borderRadius: BorderRadius.circular(2)),
        child: const SizedBox(height: height, width: double.infinity),
      );
    } else if (total > maxSegments) {
      final share = ((current >= 0 ? current + 1 : done) / total).clamp(0.0, 1.0);
      body = ClipRRect(
        borderRadius: BorderRadius.circular(2),
        child: SizedBox(
          height: height,
          width: double.infinity,
          child: Stack(
            fit: StackFit.expand,
            children: [
              ColoredBox(color: ahead(colors)),
              TweenAnimationBuilder<double>(
                tween: Tween(end: share),
                duration: Motion.of(context, const Duration(milliseconds: 300)),
                curve: Motion.out,
                builder: (context, v, _) => Transform(
                  alignment: Alignment.centerLeft,
                  transform: Matrix4.diagonal3Values(v, 1, 1),
                  child: ColoredBox(color: stageSelect(colors)),
                ),
              ),
            ],
          ),
        ),
      );
    } else {
      body = SizedBox(
        height: height,
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            for (var i = 0; i < total; i++) ...[
              if (i > 0) const SizedBox(width: gap),
              Expanded(child: _Segment(state: i < done ? _Seg.done : (i == current ? _Seg.now : _Seg.ahead))),
            ],
          ],
        ),
      );
    }
    return ExcludeSemantics(child: body);
  }
}

enum _Seg { done, now, ahead }

class _Segment extends StatefulWidget {
  const _Segment({required this.state});

  final _Seg state;

  @override
  State<_Segment> createState() => _SegmentState();
}

class _SegmentState extends State<_Segment> with SingleTickerProviderStateMixin {
  // A segment that is current when it is first drawn is simply full; one that becomes current fills.
  late final AnimationController _fill;

  @override
  void initState() {
    super.initState();
    _fill = AnimationController(vsync: this, duration: const Duration(milliseconds: 300), value: widget.state == _Seg.now ? 1 : 0);
  }

  @override
  void didUpdateWidget(_Segment old) {
    super.didUpdateWidget(old);
    if (widget.state == old.state) return;
    if (widget.state == _Seg.now) {
      if (Motion.reduced(context)) {
        _fill.value = 1;
      } else {
        _fill.forward(from: 0);
      }
    } else {
      _fill.value = 0;
    }
  }

  @override
  void dispose() {
    _fill.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final base = widget.state == _Seg.done ? colors.ink2 : StageTicks.ahead(colors);
    return ClipRRect(
      borderRadius: BorderRadius.circular(2),
      child: SizedBox.expand(
        child: ColoredBox(
          color: base,
          child: widget.state == _Seg.now
              ? AnimatedBuilder(
                  animation: _fill,
                  builder: (context, _) => Transform(
                    alignment: Alignment.centerLeft,
                    transform: Matrix4.diagonal3Values(Motion.out.transform(_fill.value.clamp(0.0, 1.0)), 1, 1),
                    child: SizedBox.expand(child: ColoredBox(color: stageSelect(colors))),
                  ),
                )
              : null,
        ),
      ),
    );
  }
}
