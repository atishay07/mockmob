import 'package:flutter/material.dart';

import '../../theme/theme.dart';
import '../materials/edge_light.dart';
import '../materials/lit_edge.dart';

/// The dock's lit tile: a soft white 12% pane (ink 7% on Daylight) with its own edge light and
/// the volt top edge, the one light in the dock.
class LitTile extends StatelessWidget {
  const LitTile({super.key});

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final fill = colors.isNight ? MmDock.litTileNight : colors.ink.withValues(alpha: 0.07);
    return DecoratedBox(
      decoration: ShapeDecoration(color: fill, shape: const StadiumBorder()),
      child: CustomPaint(
        foregroundPainter: EdgeLightPainter(
          borderRadius: MmRadius.pillAll,
          top: colors.edgeTop,
          bottom: colors.edgeBottom.withValues(alpha: 0),
          sheen: false,
        ),
        child: CustomPaint(
          foregroundPainter: LitEdgePainter(
            color: colors.isNight ? colors.volt : colors.accentText,
            radius: 24,
            width: 1.5,
            wrap: 0.4,
          ),
          child: const SizedBox.expand(),
        ),
      ),
    );
  }
}
