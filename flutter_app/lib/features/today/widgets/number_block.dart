// The hero's monumental number with its meaning ("4  to repair / tonight"). The meaning sits
// beside the number on its baseline when both fit the column; otherwise it goes under the
// number on one line, so a two-digit number never squeezes its words (ui-blitz/today.md 2.2).
// The number rolls in once (landing just after the stage arrives, with a selection tick) and
// again whenever the chosen duration reshapes the task; after landing it never moves (brief
// section 7).
import 'package:flutter/material.dart';

import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import 'today_entrance.dart';
import 'today_type.dart';

class NumberBlock extends StatelessWidget {
  const NumberBlock({super.key, required this.number, this.label, this.semanticsLabel, this.besideWidth});

  final String number;

  /// Up to two short lines ("to repair\ntonight").
  final String? label;
  final String? semanticsLabel;

  /// The width the number and a beside label must fit in (the column clear of the art). Null:
  /// the full width given.
  final double? besideWidth;

  static const double _gap = MmSpace.s12;

  /// While Today's entrance is playing the roll waits for the stage to arrive, so the number
  /// lands after its card (ui-blitz/motion.md 3.3). Afterwards (a length chip reshaping the
  /// task, a page that loaded behind the skeleton) it rolls at once.
  static const Duration entranceRollDelay = Duration(milliseconds: 280);

  static Duration rollDelay(BuildContext context) {
    final entrance = TodayEntranceScope.of(context);
    if (entrance == null || entrance.isCompleted || Motion.reduced(context)) return Duration.zero;
    return entranceRollDelay;
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final labelStyle = type.stageLabel.copyWith(color: colors.ink);
    final numberStyle = type.stageNumber(number);
    final figure = MonumentalNumber(
      value: number,
      color: colors.ink,
      style: numberStyle,
      delay: rollDelay(context),
      // The number landing is the moment the card finishes arriving: one selection tick.
      onLanded: () {
        if (context.mounted) mmFireHaptic(context, MmPressHaptic.selection);
      },
    );
    return Semantics(
      container: true,
      label: semanticsLabel ?? [number, if (label != null) label!.replaceAll('\n', ' ')].join(' '),
      excludeSemantics: true,
      child: label == null
          ? Align(alignment: Alignment.centerLeft, child: figure)
          : LayoutBuilder(
              builder: (context, box) {
                final scaler = MediaQuery.textScalerOf(context);
                final numberWidth = _width(number, numberStyle.copyWith(fontSize: scaler.scale(numberStyle.fontSize!)), TextScaler.noScaling);
                final labelWidth = _width(label!, labelStyle, scaler);
                final room = (besideWidth ?? box.maxWidth).clamp(0.0, box.maxWidth);
                final beside = numberWidth + _gap + labelWidth <= room;
                if (beside) {
                  return Row(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      figure,
                      const SizedBox(width: _gap),
                      Flexible(
                        child: Padding(
                          // Sits the last line on the number's baseline (the hero cut has a short descent).
                          padding: const EdgeInsets.only(bottom: 14),
                          child: Text(label!, style: labelStyle, softWrap: false),
                        ),
                      ),
                    ],
                  );
                }
                return Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    figure,
                    const SizedBox(height: MmSpace.s4),
                    FittedBox(
                      fit: BoxFit.scaleDown,
                      alignment: Alignment.centerLeft,
                      child: Text(label!.replaceAll('\n', ' '), style: labelStyle, maxLines: 1, softWrap: false),
                    ),
                  ],
                );
              },
            ),
    );
  }

  static double _width(String text, TextStyle style, TextScaler scaler) {
    final painter = TextPainter(text: TextSpan(text: text, style: style), textDirection: TextDirection.ltr, textScaler: scaler)..layout();
    final w = painter.width;
    painter.dispose();
    return w;
  }
}
