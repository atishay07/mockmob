import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../haptics/haptics.dart';
import '../../motion/motion.dart';
import '../../theme/theme.dart';
import '../materials/edge_light.dart';
import '../hit_slop.dart';
import 'selection_style.dart';

/// One choice of an [MmSegmented].
class MmSegment<T> {
  const MmSegment(this.value, this.label);

  final T value;
  final String label;
}

/// A segmented control: a sunken track with a raised thumb that glides to the chosen segment
/// (emphasized curve, 300 ms; instant under reduced motion), and the answer-sheet bubble before
/// each label, inked on the chosen one. `selectionClick` on change.
class MmSegmented<T> extends ConsumerWidget {
  const MmSegmented({
    super.key,
    required this.segments,
    required this.value,
    required this.onChanged,
    this.semanticsLabel,
  });

  final List<MmSegment<T>> segments;
  final T value;

  /// Null disables the control.
  final ValueChanged<T>? onChanged;
  final String? semanticsLabel;

  /// The painted track. The 48 dp target is [MmHitSlop], not layout (SPACING.md 3.3).
  static const double height = 44;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = context.mmColors;
    final type = context.mmType;
    final index = segments.indexWhere((s) => s.value == value).clamp(0, segments.length - 1);
    final n = segments.length;
    final reduced = Motion.reduced(context);

    // The hit slop is the outermost box: a render box between it and its parent that is only as
    // big as the track (Semantics is one) would refuse a touch in the band before it arrived.
    return MmHitSlop.toTarget(
      visual: height,
      child: Semantics(
        container: true,
        label: semanticsLabel,
        // A decorated box, not a Container: a Container would add the border's width to the
        // padding and shrink the touch targets.
        child: DecoratedBox(
          decoration: ShapeDecoration(
            color: colors.sunken,
            shape: StadiumBorder(side: BorderSide(color: colors.line)),
          ),
          child: SizedBox(
            height: height,
            // Only sideways padding: the segments keep the track's full height; the thumb is inset
            // inside it.
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 4),
              child: Stack(
                children: [
                  Padding(
                    padding: const EdgeInsets.symmetric(vertical: 4),
                    child: AnimatedAlign(
                      alignment: Alignment(n == 1 ? 0 : -1 + 2 * index / (n - 1), 0),
                      duration: reduced ? Duration.zero : Motion.glideDuration,
                      curve: Motion.emphasized,
                      child: FractionallySizedBox(
                        widthFactor: 1 / n,
                        heightFactor: 1,
                        child: DecoratedBox(
                          decoration: ShapeDecoration(
                            color: colors.selectedSurface,
                            shape: const StadiumBorder(),
                            shadows: colors.cardShadow,
                          ),
                          child: CustomPaint(
                            foregroundPainter: EdgeLightPainter(
                              borderRadius: MmRadius.pillAll,
                              top: colors.edgeTop,
                              bottom: colors.edgeBottom,
                            ),
                          ),
                        ),
                      ),
                    ),
                  ),
                  Row(
                    children: [
                      for (var i = 0; i < n; i++)
                        Expanded(
                          child: Semantics(
                            button: true,
                            selected: i == index,
                            inMutuallyExclusiveGroup: true,
                            child: GestureDetector(
                              behavior: HitTestBehavior.opaque,
                              onTap: onChanged == null || i == index
                                  ? null
                                  : () {
                                      ref.read(hapticsProvider).selection();
                                      onChanged!(segments[i].value);
                                    },
                              child: Center(
                                child: Row(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    SelectBubble(selected: i == index),
                                    const SizedBox(width: MmSpace.s8),
                                    Flexible(
                                      child: Text(
                                        segments[i].label,
                                        maxLines: 1,
                                        overflow: TextOverflow.ellipsis,
                                        style: type.labelLarge.copyWith(
                                          fontSize: 14,
                                          color: i == index ? colors.ink : colors.ink2,
                                        ),
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ),
                          ),
                        ),
                    ],
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
