// The move's key label that fits. While the card's own key is out of view (under the bar on a
// short phone or at large text), tonight's move stands in for it as the bar's live capsule
// (BarMove, published by TodayBody; MOTION.md 5.1), so one thing floats above the bar.
import 'package:flutter/material.dart';

import '../../../core/theme/theme.dart';
import '../logic/today_model.dart';

/// [action]'s label, or its [TodayAction.shortLabel] when the long one would break onto a second
/// line in a key [keyWidth] wide at the current text size.
String fitKeyLabel(BuildContext context, TodayAction action, double keyWidth) {
  final short = action.shortLabel;
  if (short == null || !keyWidth.isFinite) return action.label;
  final style = DefaultTextStyle.of(context).style.merge(context.mmType.button);
  final painter = TextPainter(
    text: TextSpan(text: action.label, style: style),
    textDirection: Directionality.of(context),
    textScaler: MediaQuery.textScalerOf(context),
    maxLines: 1,
  )..layout();
  final fits = painter.width <= keyWidth - 2 * MmSpace.s24;
  painter.dispose();
  return fits ? action.label : short;
}
