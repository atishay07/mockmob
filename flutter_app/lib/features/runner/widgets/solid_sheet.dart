import 'package:flutter/material.dart';

import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';

/// [showMmSheet] for the work layer: the same frame (handle, title, pinned footer, full page at
/// large text) on a solid surface instead of glass, so no word of the question behind it can
/// show through (DEVICE-FINDINGS 1: the palette sheet over the runner).
Future<T?> showRunnerSheet<T>({
  required BuildContext context,
  required WidgetBuilder builder,
  String? title,
  WidgetBuilder? footer,
  double? heightFactor,
}) {
  final colors = context.mmColors;
  final large = MediaQuery.textScalerOf(context).scale(1) >= kSheetFullPageTextScale;
  final reduced = Motion.reduced(context);
  return showModalBottomSheet<T>(
    context: context,
    useRootNavigator: true,
    isScrollControlled: true,
    useSafeArea: !large,
    backgroundColor: Colors.transparent,
    barrierColor: colors.scrim,
    elevation: 0,
    clipBehavior: Clip.none,
    constraints: BoxConstraints(maxWidth: MmSpace.contentMaxWidth, maxHeight: large || heightFactor != null ? double.infinity : 680),
    shape: const RoundedRectangleBorder(),
    sheetAnimationStyle: AnimationStyle(
      duration: reduced ? Motion.reducedFade : Motion.sheetIn,
      reverseDuration: reduced ? Motion.reducedFade : Motion.sheetOut,
      curve: reduced ? Curves.linear : Motion.emphasized,
      reverseCurve: reduced ? Curves.linear : Motion.drawer,
    ),
    builder: (context) => DecoratedBox(
      decoration: ShapeDecoration(
        color: colors.raised,
        shape: large
            ? const RoundedRectangleBorder()
            : RoundedSuperellipseBorder(
                borderRadius: MmRadius.sheetTopOnly,
                side: BorderSide(color: colors.line),
              ),
        shadows: colors.glassShadow,
      ),
      child: MmSheetScaffold(title: title, footer: footer?.call(context), heightFactor: heightFactor, child: builder(context)),
    ),
  );
}
