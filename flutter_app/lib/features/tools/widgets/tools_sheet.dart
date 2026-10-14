import 'package:flutter/material.dart';

import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';

/// [showMmSheet] for the tools, with the page behind dimmed further: the glass sheet is
/// translucent, so under the plain scrim the screen's own controls ghost through its top edge.
/// Same sheet, same motion, same handle and safe-area padding; only the backdrop is deeper.
Future<T?> showToolsSheet<T>({required BuildContext context, required WidgetBuilder builder, String? title}) {
  final colors = context.mmColors;
  final large = MediaQuery.textScalerOf(context).scale(1) >= kSheetFullPageTextScale;
  final reduced = Motion.reduced(context);
  return showModalBottomSheet<T>(
    context: context,
    useRootNavigator: true,
    isScrollControlled: true,
    useSafeArea: !large,
    backgroundColor: Colors.transparent,
    barrierColor: Color.alphaBlend(colors.isNight ? const Color(0x66000000) : const Color(0x2E17150F), colors.scrim),
    elevation: 0,
    clipBehavior: Clip.none,
    constraints: BoxConstraints(maxWidth: MmSpace.contentMaxWidth, maxHeight: large ? double.infinity : 680),
    shape: const RoundedRectangleBorder(),
    sheetAnimationStyle: AnimationStyle(
      duration: reduced ? Motion.reducedFade : Motion.sheetIn,
      reverseDuration: reduced ? Motion.reducedFade : Motion.sheetOut,
      curve: reduced ? Curves.linear : Motion.emphasized,
      reverseCurve: reduced ? Curves.linear : Motion.drawer,
    ),
    builder: (context) => MmSheetGlass(child: MmSheetScaffold(title: title, child: builder(context))),
  );
}
