import 'package:flutter/material.dart';

import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';

/// A solid raised pane in the page gutter: continuous corners, the room's edge light, and, for
/// the one focal element of a screen, the volt lit edge.
class ToolsCard extends StatelessWidget {
  const ToolsCard({super.key, required this.child, this.lit = false, this.padding = const EdgeInsets.all(MmSpace.cardPadding)});

  final Widget child;
  final bool lit;
  final EdgeInsetsGeometry padding;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final pane = DecoratedBox(
      decoration: ShapeDecoration(color: colors.raised, shape: mmShapeBorder(MmRadius.panelAll), shadows: colors.cardShadow),
      child: CustomPaint(
        foregroundPainter: EdgeLightPainter(
          borderRadius: MmRadius.panelAll,
          top: colors.edgeTop,
          bottom: colors.edgeBottom,
          sheen: false,
        ),
        child: Padding(padding: padding, child: child),
      ),
    );
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: MmSpace.gutter),
      child: lit ? LitEdge(child: pane) : pane,
    );
  }
}

/// A heading for a group inside a tools screen, with an optional note under it.
class ToolsHeading extends StatelessWidget {
  const ToolsHeading(this.text, {super.key, this.note, this.top = MmSpace.s32, this.trailing, this.leading});

  final String text;
  final String? note;
  final double top;
  final Widget? trailing;

  /// A small mark before the title (a step's answer bubble).
  final Widget? leading;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return Padding(
      padding: EdgeInsets.fromLTRB(MmSpace.gutter + 4, top, trailing == null ? MmSpace.gutter + 4 : MmSpace.s8, MmSpace.s12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    if (leading != null) ...[leading!, const SizedBox(width: MmSpace.s8)],
                    Expanded(child: Semantics(header: true, child: Text(text, style: type.title.copyWith(fontSize: 20)))),
                  ],
                ),
                if (note != null) ...[
                  const SizedBox(height: MmSpace.s4),
                  Text(note!, style: type.caption.copyWith(color: colors.ink2)),
                ],
              ],
            ),
          ),
          ?trailing,
        ],
      ),
    );
  }
}
