import 'package:flutter/material.dart';

import '../motion/motion.dart';
import '../theme/theme.dart';
import 'feedback.dart';
import 'key_button.dart';
import 'materials/glass_surface.dart';

/// At or above this text scale a sheet becomes a full page with a visible Close (spec 11).
const double kSheetFullPageTextScale = 1.5;

bool _isLargeText(BuildContext context) => MediaQuery.textScalerOf(context).scale(1) >= kSheetFullPageTextScale;

/// Shared by [showMmSheet] and [MmSheetPage]: the sheet rises on the emphasized curve (420 ms)
/// and leaves on the exit curve; a 120 ms linear fade replaces the slide when the system or the
/// in-app switch asks for less motion.
AnimationStyle _sheetAnimationStyle(BuildContext context) {
  final reduced = Motion.reduced(context);
  return AnimationStyle(
    duration: reduced ? Motion.reducedFade : Motion.sheetIn,
    reverseDuration: reduced ? Motion.reducedFade : Motion.sheetOut,
    curve: reduced ? Curves.linear : Motion.emphasized,
    reverseCurve: reduced ? Curves.linear : Motion.drawer,
  );
}

/// The sheet's body: smoked glass with a 32 dp top radius and the edge light, or a solid page
/// at large text scale.
class MmSheetGlass extends StatelessWidget {
  const MmSheetGlass({super.key, required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    if (_isLargeText(context)) {
      return ColoredBox(color: context.mmColors.ground, child: child);
    }
    return GlassSurface(
      role: GlassRole.sheet,
      borderRadius: MmRadius.sheetTopOnly,
      shadow: false,
      child: child,
    );
  }
}

/// The sheet's content frame: a drag handle, an optional title, and a scrollable body. At large
/// text scale it fills the screen and shows a Close key. Use inside [showMmSheet] or an
/// [MmSheetPage].
class MmSheetScaffold extends StatelessWidget {
  const MmSheetScaffold({super.key, required this.child, this.title, this.onClose, this.footer, this.heightFactor});

  final Widget child;
  final String? title;

  /// Pinned under the scrolling body, above a hairline: the sheet's main key stays in reach.
  final Widget? footer;

  /// Opens the sheet at this fraction of the screen height (the body scrolls inside it).
  final double? heightFactor;

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
        const Center(
          child: Padding(
            padding: EdgeInsets.only(top: MmSpace.s12, bottom: MmSpace.s8),
            child: MmSheetHandle(),
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
                    : Semantics(header: true, child: Text(title!, style: type.screenTitle.copyWith(fontSize: 24))),
              ),
              if (large)
                KeyButton.quiet(label: 'Close', onPressed: close),
            ],
          ),
        ),
    ];

    final body = MmSheetBodyReveal(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(MmSpace.s20, 0, MmSpace.s20, MmSpace.s20),
        child: child,
      ),
    );

    final fixed = large || heightFactor != null;
    final column = Column(
      mainAxisSize: fixed ? MainAxisSize.max : MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        ...header,
        fixed ? Expanded(child: SingleChildScrollView(child: body)) : Flexible(child: SingleChildScrollView(child: body)),
        if (footer != null)
          DecoratedBox(
            decoration: BoxDecoration(border: Border(top: BorderSide(color: colors.line))),
            child: Padding(padding: const EdgeInsets.fromLTRB(MmSpace.s20, MmSpace.s16, MmSpace.s20, MmSpace.s16), child: footer),
          ),
      ],
    );

    if (large) return SafeArea(child: SizedBox.expand(child: column));
    if (heightFactor != null) {
      return SafeArea(top: false, child: SizedBox(height: MediaQuery.sizeOf(context).height * heightFactor!, child: column));
    }
    return SafeArea(top: false, child: column);
  }
}

/// A modal glass sheet: 32 dp top radius, rises in 420 ms on the emphasized curve and leaves in
/// 240 ms, dismisses by drag, scrim or back. At large text scale it is a full page with Close.
Future<T?> showMmSheet<T>({
  required BuildContext context,
  required WidgetBuilder builder,
  String? title,
  bool isDismissible = true,
  bool useRootNavigator = true,
  WidgetBuilder? footer,
  double? heightFactor,
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
    backgroundColor: Colors.transparent,
    barrierColor: colors.scrim,
    elevation: 0,
    clipBehavior: Clip.none,
    constraints: BoxConstraints(maxWidth: MmSpace.contentMaxWidth, maxHeight: large || heightFactor != null ? double.infinity : 680),
    shape: const RoundedRectangleBorder(),
    sheetAnimationStyle: _sheetAnimationStyle(context),
    builder: (context) => MmSheetGlass(
      child: MmSheetScaffold(title: title, footer: footer?.call(context), heightFactor: heightFactor, child: builder(context)),
    ),
  );
}

/// A go_router page that presents its [child] as an MockMob modal sheet over the shell.
/// Used for the sheet routes of spec 4.2 (`/today/week`, `/before-you-start`, ...).
class MmSheetPage<T> extends Page<T> {
  const MmSheetPage({super.key, super.name, super.arguments, super.restorationId, required this.child, this.title, this.footer});

  final Widget child;
  final String? title;

  /// Pinned under the scrolling [child] (see [MmSheetScaffold.footer]): the sheet's keys stay in
  /// reach however long the body grows at large text.
  final Widget? footer;

  @override
  Route<T> createRoute(BuildContext context) {
    final colors = context.mmColors;
    final large = _isLargeText(context);
    return ModalBottomSheetRoute<T>(
      settings: this,
      isScrollControlled: true,
      useSafeArea: !large,
      backgroundColor: Colors.transparent,
      modalBarrierColor: colors.scrim,
      elevation: 0,
      clipBehavior: Clip.none,
      constraints: BoxConstraints(maxWidth: MmSpace.contentMaxWidth, maxHeight: large ? double.infinity : 680),
      shape: const RoundedRectangleBorder(),
      sheetAnimationStyle: _sheetAnimationStyle(context),
      builder: (context) => MmSheetGlass(child: MmSheetScaffold(title: title, footer: footer, child: child)),
    );
  }
}

/// The sheet's grab handle, answering the finger: while the sheet is dragged down it widens
/// from 36 to 52 dp and brightens, and crossing the close threshold (half the sheet, Flutter's
/// own) gives one `selectionClick`, and one back if the student changes their mind. Still under
/// reduced motion (the tick stays: it is information, not decoration).
class MmSheetHandle extends StatefulWidget {
  const MmSheetHandle({super.key, this.closeThreshold = 0.5});

  /// The route's animation value below which a release closes the sheet.
  final double closeThreshold;

  @override
  State<MmSheetHandle> createState() => _MmSheetHandleState();
}

class _MmSheetHandleState extends State<MmSheetHandle> {
  Animation<double>? _route;
  bool _landed = false;
  bool _below = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final route = ModalRoute.of(context)?.animation;
    if (route == _route) return;
    _route?.removeListener(_changed);
    _route = route;
    _landed = route == null || route.status == AnimationStatus.completed;
    route?.addListener(_changed);
  }

  @override
  void dispose() {
    _route?.removeListener(_changed);
    super.dispose();
  }

  void _changed() {
    final route = _route;
    if (route == null) return;
    if (!_landed) {
      if (route.status == AnimationStatus.completed || route.value >= 1) _landed = true;
      return;
    }
    if (route.status == AnimationStatus.reverse) return;
    final below = route.value < widget.closeThreshold;
    if (below != _below) {
      _below = below;
      mmFireHaptic(context, MmPressHaptic.selection);
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final route = _route;
    Widget handle(double pull) => SizedBox(
      width: 36 + 16 * pull,
      height: 4,
      child: DecoratedBox(
        decoration: BoxDecoration(color: Color.lerp(colors.ink4, colors.ink2, pull), borderRadius: MmRadius.pillAll),
      ),
    );
    if (route == null) return handle(0);
    return SizedBox(
      width: 52,
      height: 4,
      child: Center(
        child: AnimatedBuilder(
          animation: route,
          builder: (context, _) {
            // Pull: 0 at rest, 1 a fifth of the way down.
            final dragging = _landed && route.status != AnimationStatus.reverse;
            final pull = dragging ? ((1 - route.value) * 5).clamp(0.0, 1.0) : 0.0;
            return handle(pull);
          },
        ),
      ),
    );
  }
}

/// A sheet's body riding in on the sheet: it fades and rises 12 dp over the last two thirds of
/// the sheet's own rise, so the glass arrives first and the content settles into it. After the
/// sheet has landed it never moves again (a drag moves the whole sheet, not the body). Nothing
/// under reduced motion.
class MmSheetBodyReveal extends StatefulWidget {
  const MmSheetBodyReveal({super.key, required this.child});

  final Widget child;

  @override
  State<MmSheetBodyReveal> createState() => _MmSheetBodyRevealState();
}

class _MmSheetBodyRevealState extends State<MmSheetBodyReveal> {
  Animation<double>? _route;
  bool _landed = true;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final route = ModalRoute.of(context)?.animation;
    if (route == _route) return;
    _route = route;
    _landed = route == null || Motion.reduced(context) || route.status != AnimationStatus.forward;
  }

  @override
  Widget build(BuildContext context) {
    final route = _route;
    if (route == null) return _shell(1, widget.child);
    // Always the same shape: a body that has landed keeps its builder, so a rebuild never
    // remounts it.
    return AnimatedBuilder(
      animation: route,
      child: widget.child,
      builder: (context, child) {
        if (route.status == AnimationStatus.completed || route.status == AnimationStatus.reverse) _landed = true;
        final t = _landed ? 1.0 : Motion.emphasized.transform(((route.value - 0.33) / 0.67).clamp(0.0, 1.0));
        return _shell(t, child!);
      },
    );
  }

  /// One widget shape in motion and at rest, so the body is never remounted.
  Widget _shell(double t, Widget child) => Opacity(
    opacity: t,
    child: Transform.translate(offset: Offset(0, 12 * (1 - t)), child: child),
  );
}