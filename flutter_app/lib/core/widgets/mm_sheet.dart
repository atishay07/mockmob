import 'package:flutter/material.dart';

import '../motion/motion.dart';
import '../theme/theme.dart';
import 'key_button.dart';

/// At or above this text scale a sheet becomes a full page with a visible Close (spec 11).
const double kSheetFullPageTextScale = 1.5;

bool _isLargeText(BuildContext context) => MediaQuery.textScalerOf(context).scale(1) >= kSheetFullPageTextScale;

/// Shared by [showMmSheet] and [MmSheetPage] so both honour reduced motion: a 120 ms linear fade
/// replaces the slide when the system or the in-app switch asks for less motion.
AnimationStyle _sheetAnimationStyle(BuildContext context) {
  final reduced = Motion.reduced(context);
  return AnimationStyle(
    duration: reduced ? Motion.reducedFade : Motion.sheetIn,
    reverseDuration: reduced ? Motion.reducedFade : Motion.sheetOut,
    curve: reduced ? Curves.linear : Motion.drawer,
    reverseCurve: reduced ? Curves.linear : Motion.drawer,
  );
}

/// The sheet's content frame: a drag handle, an optional title, and a scrollable body. At large
/// text scale it fills the screen and shows a Close key. Use inside [showMmSheet] or an
/// [MmSheetPage].
class MmSheetScaffold extends StatelessWidget {
  const MmSheetScaffold({super.key, required this.child, this.title, this.onClose});

  final Widget child;
  final String? title;

  /// Defaults to popping the sheet.
  final VoidCallback? onClose;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final large = _isLargeText(context);
    final close = onClose ?? () => Navigator.of(context).maybePop();

    final header = <Widget>[
      if (!large)
        Center(
          child: Padding(
            padding: const EdgeInsets.only(top: MmSpace.s12, bottom: MmSpace.s8),
            child: SizedBox(
              width: 36,
              height: 4,
              child: DecoratedBox(
                decoration: BoxDecoration(color: colors.lineStrong, borderRadius: MmRadius.pillAll),
              ),
            ),
          ),
        ),
      if (large || title != null)
        Padding(
          padding: const EdgeInsets.fromLTRB(MmSpace.s20, MmSpace.s8, MmSpace.s8, MmSpace.s8),
          child: Row(
            children: [
              Expanded(
                child: title == null
                    ? const SizedBox.shrink()
                    : Semantics(header: true, child: Text(title!, style: type.title)),
              ),
              if (large)
                KeyButton.quiet(label: 'Close', onPressed: close),
            ],
          ),
        ),
    ];

    final body = Padding(
      padding: const EdgeInsets.fromLTRB(MmSpace.s20, 0, MmSpace.s20, MmSpace.s20),
      child: child,
    );

    final column = Column(
      mainAxisSize: large ? MainAxisSize.max : MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        ...header,
        large ? Expanded(child: SingleChildScrollView(child: body)) : Flexible(child: SingleChildScrollView(child: body)),
      ],
    );

    return SafeArea(top: large, child: large ? SizedBox.expand(child: column) : column);
  }
}

/// A modal bottom sheet: 28 dp top radius, slides up in 280 ms and out in 200 ms, dismisses by
/// drag, scrim or back. At large text scale it is a full page with Close.
Future<T?> showMmSheet<T>({
  required BuildContext context,
  required WidgetBuilder builder,
  String? title,
  bool isDismissible = true,
  bool useRootNavigator = true,
}) {
  final colors = context.mmColors;
  final large = _isLargeText(context);
  return showModalBottomSheet<T>(
    context: context,
    useRootNavigator: useRootNavigator,
    isScrollControlled: true,
    useSafeArea: !large,
    isDismissible: isDismissible,
    enableDrag: isDismissible,
    backgroundColor: colors.raised,
    barrierColor: colors.scrim,
    elevation: 0,
    clipBehavior: Clip.antiAlias,
    constraints: BoxConstraints(maxWidth: MmSpace.contentMaxWidth, maxHeight: large ? double.infinity : 640),
    shape: RoundedRectangleBorder(borderRadius: large ? BorderRadius.zero : MmRadius.sheetTopOnly),
    sheetAnimationStyle: _sheetAnimationStyle(context),
    builder: (context) => MmSheetScaffold(title: title, child: builder(context)),
  );
}

/// A go_router page that presents its [child] as an MockMob modal sheet over the shell.
/// Used for the sheet routes of spec 4.2 (`/today/week`, `/before-you-start`, ...).
class MmSheetPage<T> extends Page<T> {
  const MmSheetPage({super.key, super.name, super.arguments, super.restorationId, required this.child, this.title});

  final Widget child;
  final String? title;

  @override
  Route<T> createRoute(BuildContext context) {
    final colors = context.mmColors;
    final large = _isLargeText(context);
    return ModalBottomSheetRoute<T>(
      settings: this,
      isScrollControlled: true,
      useSafeArea: !large,
      backgroundColor: colors.raised,
      modalBarrierColor: colors.scrim,
      elevation: 0,
      clipBehavior: Clip.antiAlias,
      constraints: BoxConstraints(maxWidth: MmSpace.contentMaxWidth, maxHeight: large ? double.infinity : 640),
      shape: RoundedRectangleBorder(borderRadius: large ? BorderRadius.zero : MmRadius.sheetTopOnly),
      sheetAnimationStyle: _sheetAnimationStyle(context),
      builder: (context) => MmSheetScaffold(title: title, child: child),
    );
  }
}
