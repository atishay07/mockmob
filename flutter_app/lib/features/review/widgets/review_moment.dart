import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../../core/theme/theme.dart';
import 'review_layout.dart';

/// The layout of a moment screen (the repair entry and ending), the same shape on both: a header
/// row, the content block weighted to the optical centre (2 parts of air above it, 3 below), and
/// the action band pinned at the bottom. When the content is taller than the room it scrolls and
/// the air collapses; nothing is top-stacked above a hole.
///
/// The weighting is an [Align] inside a minimum-height box, not spacers, so no intrinsic-height
/// pass runs through the content (the ending mounts a live celebration slot in it).
class MomentBody extends StatelessWidget {
  const MomentBody({super.key, this.header, required this.content, required this.bar});

  /// The row above the content (the close key), or null.
  final Widget? header;

  /// The content block, laid out in the moment gutter.
  final Widget content;

  /// The pinned action band: keys, built by the caller with its own padding.
  final Widget bar;

  /// Where the content block sits in the free height: 2 of 5 parts above it.
  static const Alignment opticalCentre = Alignment(0, -0.2);

  /// The fade from the content into the ground above the band.
  static const double fade = 24;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        ?header,
        Expanded(
          child: LayoutBuilder(
            builder: (context, box) => Stack(
              children: [
                SingleChildScrollView(
                  padding: const EdgeInsets.fromLTRB(ReviewSpace.moment, 0, ReviewSpace.moment, MmSpace.s16),
                  child: ConstrainedBox(
                    constraints: BoxConstraints(minHeight: math.max(0, box.maxHeight - MmSpace.s16)),
                    child: Align(
                      alignment: opticalCentre,
                      child: Padding(
                        padding: const EdgeInsets.only(top: MmSpace.s16),
                        child: content,
                      ),
                    ),
                  ),
                ),
                Positioned(
                  left: 0,
                  right: 0,
                  bottom: 0,
                  height: fade,
                  child: IgnorePointer(
                    child: DecoratedBox(
                      decoration: BoxDecoration(
                        gradient: LinearGradient(
                          begin: Alignment.topCenter,
                          end: Alignment.bottomCenter,
                          colors: [colors.ground.withValues(alpha: 0), colors.ground],
                        ),
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
        ColoredBox(color: colors.ground, child: bar),
      ],
    );
  }
}
