import 'package:flutter/material.dart';

import '../../../core/theme/theme.dart';

/// Lets a [ChipRail] inside a screen's gutter run edge to edge: the rail is made wider than its
/// slot by the gutter on each side, so its peek of the next chip meets the screen edge and the
/// first chip still starts on the gutter line (the rail's own start inset). The slot keeps the
/// rail's height, so layout around it does not change.
///
/// Only for a parent that has the gutter as its horizontal padding (the record and Saved lists).
class RailBleed extends StatelessWidget {
  const RailBleed({super.key, required this.child, this.bleed = MmSpace.gutter, this.height = 48});

  final Widget child;
  final double bleed;
  final double height;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, box) {
        final wide = box.maxWidth + 2 * bleed;
        return SizedBox(
          height: height,
          width: box.maxWidth,
          child: OverflowBox(
            minWidth: wide,
            maxWidth: wide,
            minHeight: height,
            maxHeight: height,
            child: child,
          ),
        );
      },
    );
  }
}
