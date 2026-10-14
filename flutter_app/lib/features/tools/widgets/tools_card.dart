import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/haptics/haptics.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';

/// A surface in the page gutter. The one focal pane of a screen ([lit]) is the hero tier: the
/// lamp's light pool, the grain, the edge light and the volt lit edge. Every other pane is the
/// plain tier: a raised fill with only a top edge light, no outline. Never nest one in another;
/// content inside a pane that needs its own well uses `MmSurface.inset`.
class ToolsCard extends StatelessWidget {
  const ToolsCard({super.key, required this.child, this.lit = false, this.padding});

  final Widget child;
  final bool lit;

  /// Defaults to the tier's own padding (24 for the hero, 20 for a plain pane).
  final EdgeInsetsGeometry? padding;

  @override
  Widget build(BuildContext context) {
    // The focal pane's volt edge comes with its soft volt glow underneath (LitEdge), so the line
    // reads as the lamp catching the card and not as a stray border.
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: MmSpace.gutter),
      child: lit
          ? LitEdge(
              glow: true,
              borderRadius: BorderRadius.circular(MmRhythm.heroRadius),
              child: MmSurface.hero(padding: padding, child: child),
            )
          : MmSurface.plain(padding: padding, child: child),
    );
  }
}

/// A heading for a group inside a tools screen, with an optional note under it: the Bricolage
/// title cut, the section gap above and the item gap below.
class ToolsHeading extends StatelessWidget {
  const ToolsHeading(this.text, {super.key, this.note, this.top = MmRhythm.section, this.trailing, this.leading});

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
      padding: EdgeInsets.fromLTRB(MmSpace.gutter, top, trailing == null ? MmSpace.gutter : MmSpace.s8, MmRhythm.item),
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
                    Expanded(child: Semantics(header: true, child: Text(text, style: type.title))),
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

/// The hero number of a tools pane ("14 of 70"). It rolls in after its card has arrived, gives
/// one selection tick when it lands, and afterwards follows the value without waiting, so a
/// count that changes as the student ticks subjects never lags behind their finger.
class ToolsNumber extends ConsumerStatefulWidget {
  const ToolsNumber({super.key, required this.value, this.unit, this.semanticsLabel});

  final String value;
  final String? unit;
  final String? semanticsLabel;

  /// Long enough for the card's own entrance (the third item of the page) to land first.
  static const Duration firstDelay = Duration(milliseconds: 260);

  @override
  ConsumerState<ToolsNumber> createState() => _ToolsNumberState();
}

class _ToolsNumberState extends ConsumerState<ToolsNumber> {
  bool _landed = false;

  @override
  Widget build(BuildContext context) {
    return MonumentalNumber(
      value: widget.value,
      unit: widget.unit,
      style: context.mmType.figure,
      semanticsLabel: widget.semanticsLabel,
      delay: _landed ? Duration.zero : ToolsNumber.firstDelay,
      onLanded: () {
        _landed = true;
        ref.read(hapticsProvider).selection();
      },
    );
  }
}
