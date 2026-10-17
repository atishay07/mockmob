import 'package:flutter/gestures.dart' show VelocityTracker, kTouchSlop;
import 'package:flutter/material.dart';

import '../motion/motion.dart';
import '../theme/theme.dart';
import 'feedback.dart';
import 'key_button.dart';
import '../platform/device_corner.dart';
import 'materials/glass_surface.dart';
import 'materials/mm_glass.dart';

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

/// The sheet's glass (GLASS-1017 section 5.7): it floats, then fills.
///
/// * **Partial detent** (every sheet shorter than the screen): MockMob Glass inset 8 dp from the
///   sides and the bottom, 32 dp top corners and bottom corners concentric with the phone's
///   (its corner radius minus 8, [DeviceCorner]). The rim is thinner glass over the page; the
///   reading core stays dense. The page behind keeps the scrim and does not recede.
/// * **Toward the full detent** (a sheet opened at 85% of the screen or more, [heightFactor]):
///   over the last 15% the insets and the bottom corners go to 0 and the glass turns into the
///   opaque `raised` surface (LG-3).
/// * **Materialise, do not fade** (LG-1): over the first 60% of the rise the blur, the rim and
///   the tint grow together; closing runs the same path back. Under reduced motion the route's
///   own 120 ms fade carries it and the glass is whole from the first frame.
/// * With the keyboard up the sheet sits on it: no bottom inset, square bottom corners.
/// * At large text scale (1.5 and up) it is a solid full page with a visible Close (unchanged).
class MmSheetGlass extends StatelessWidget {
  const MmSheetGlass({super.key, required this.child, this.heightFactor});

  final Widget child;

  /// The share of the screen the sheet opens at, when it is fixed (see [MmSheetScaffold]).
  final double? heightFactor;

  /// How far a sheet of [heightFactor] has filled the screen: 0 up to 85%, 1 at the full height.
  static double fillFor(double? heightFactor) => heightFactor == null ? 0 : ((heightFactor - 0.85) / 0.15).clamp(0.0, 1.0);

  /// How far the glass has materialised at route value [t] (0 to 1).
  static double materializeAt(double t) => (t / GlassTokens.materializeShare).clamp(0.0, 1.0);

  @override
  Widget build(BuildContext context) {
    if (_isLargeText(context)) {
      return ColoredBox(color: context.mmColors.ground, child: child);
    }
    final route = Motion.reduced(context) ? null : ModalRoute.of(context)?.animation;
    if (route == null) return _frame(context, 1);
    return _SheetMaterialize(route: route, builder: (context, m) => _frame(context, m));
  }

  Widget _frame(BuildContext context, double materialize) {
    final media = MediaQuery.of(context);
    final fill = fillFor(heightFactor);
    final keyboard = media.viewInsets.bottom > 0;
    final side = DeviceCorner.sheetInset * (1 - fill);
    final bottom = keyboard ? 0.0 : side;
    final cornerBottom = keyboard ? 0.0 : DeviceCorner.sheetRadius * (1 - fill);
    final radius = BorderRadius.only(
      topLeft: const Radius.circular(32),
      topRight: const Radius.circular(32),
      bottomLeft: Radius.circular(cornerBottom),
      bottomRight: Radius.circular(cornerBottom),
    );
    // The sheet's own safe area (the gesture bar) is measured from the glass's bottom, which
    // now sits [bottom] above the screen's.
    EdgeInsets lift(EdgeInsets p) => p.copyWith(bottom: (p.bottom - bottom).clamp(0.0, double.infinity));
    return Padding(
      padding: EdgeInsets.fromLTRB(side, 0, side, bottom),
      child: MediaQuery(
        data: media.copyWith(padding: lift(media.padding), viewPadding: lift(media.viewPadding)),
        child: GlassSurface(
          role: GlassRole.sheet,
          borderRadius: radius,
          materialize: materialize,
          fill: fill,
          child: child,
        ),
      ),
    );
  }
}

/// Rebuilds the sheet's glass from its route: materialising on the way up, whole once it has
/// landed (a drag down keeps the glass), and dematerialising along the same path on the way out.
class _SheetMaterialize extends StatefulWidget {
  const _SheetMaterialize({required this.route, required this.builder});

  final Animation<double> route;
  final Widget Function(BuildContext context, double materialize) builder;

  @override
  State<_SheetMaterialize> createState() => _SheetMaterializeState();
}

class _SheetMaterializeState extends State<_SheetMaterialize> {
  bool _landed = false;

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: widget.route,
      builder: (context, _) {
        final route = widget.route;
        if (route.status == AnimationStatus.completed) _landed = true;
        final closing = route.status == AnimationStatus.reverse || route.status == AnimationStatus.dismissed;
        final m = _landed && !closing ? 1.0 : MmSheetGlass.materializeAt(route.value);
        return widget.builder(context, m);
      },
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
        // Above a pinned footer the body dissolves into the glass over 40 dp instead of meeting a
        // hairline (GLASS-1017 5.7).
        fixed
            ? Expanded(child: _EdgeFadeScroll(bottomExtent: footer != null ? 40 : 24, child: body))
            : Flexible(child: _EdgeFadeScroll(bottomExtent: footer != null ? 40 : 24, child: body)),
        if (footer != null)
          Padding(padding: const EdgeInsets.fromLTRB(MmSpace.s20, MmSpace.s8, MmSpace.s20, MmSpace.s16), child: footer),
      ],
    );

    if (large) return SafeArea(child: SizedBox.expand(child: column));
    if (heightFactor != null) {
      final media = MediaQuery.of(context);
      final inset = media.viewInsets.bottom;
      final full = media.size.height * heightFactor!;
      if (inset <= 0) return SafeArea(top: false, child: SizedBox(height: full, child: column));
      // With the keyboard up the sheet rises onto it: the glass runs down behind the keys and the
      // column stops where they start, so a search field with its results shows them above the
      // keys instead of under them (v13 device walk: one partial row showed).
      final view = View.of(context);
      final statusBar = view.padding.top / view.devicePixelRatio;
      final room = media.size.height - inset - statusBar - MmSpace.s16;
      return SafeArea(
        top: false,
        child: Padding(
          padding: EdgeInsets.only(bottom: inset),
          child: SizedBox(height: full < room ? full : room, child: column),
        ),
      );
    }
    return SafeArea(top: false, child: column);
  }
}

/// The sheet body's scroll view. When content runs past an edge, that edge dissolves over 24 dp
/// so a cut-off row reads as "more here" instead of being sliced by the title or the pinned
/// footer. At rest with everything visible nothing is faded.
class _EdgeFadeScroll extends StatefulWidget {
  const _EdgeFadeScroll({required this.child, this.bottomExtent = 24});

  final Widget child;

  /// How far the bottom edge dissolves: 40 dp above a pinned footer.
  final double bottomExtent;

  @override
  State<_EdgeFadeScroll> createState() => _EdgeFadeScrollState();
}

class _EdgeFadeScrollState extends State<_EdgeFadeScroll> {
  static const double _extent = 24;
  bool _above = false;
  bool _below = false;

  bool _onMetrics(ScrollMetrics m) {
    final above = m.extentBefore > 0.5;
    final below = m.extentAfter > 0.5;
    if (above != _above || below != _below) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!mounted) return;
        setState(() {
          _above = above;
          _below = below;
        });
      });
    }
    return false;
  }

  @override
  Widget build(BuildContext context) {
    final scroll = NotificationListener<ScrollMetricsNotification>(
      onNotification: (n) => n.depth == 0 && _onMetrics(n.metrics),
      child: NotificationListener<ScrollNotification>(
        onNotification: (n) => n.depth == 0 && _onMetrics(n.metrics),
        child: SingleChildScrollView(child: widget.child),
      ),
    );
    return ShaderMask(
      blendMode: BlendMode.dstIn,
      shaderCallback: (rect) {
        final stop = (_extent / rect.height).clamp(0.0, 0.5);
        final stopBottom = (widget.bottomExtent / rect.height).clamp(0.0, 0.5);
        const clear = Color(0x00FFFFFF);
        const solid = Color(0xFFFFFFFF);
        return LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [_above ? clear : solid, solid, solid, _below ? clear : solid],
          stops: [0, stop, 1 - stopBottom, 1],
        ).createShader(rect);
      },
      child: scroll,
    );
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
  final navigator = Navigator.of(context, rootNavigator: useRootNavigator);
  final localizations = MaterialLocalizations.of(context);
  return navigator.push(MmSheetRoute<T>(
    capturedThemes: InheritedTheme.capture(from: context, to: navigator.context),
    barrierLabel: localizations.scrimLabel,
    barrierOnTapHint: localizations.scrimOnTapHint(localizations.bottomSheetLabel),
    isScrollControlled: true,
    useSafeArea: !large,
    isDismissible: isDismissible,
    enableDrag: isDismissible,
    backgroundColor: Colors.transparent,
    modalBarrierColor: colors.sheetScrim,
    elevation: 0,
    clipBehavior: Clip.none,
    constraints: BoxConstraints(maxWidth: MmSpace.contentMaxWidth, maxHeight: large || heightFactor != null ? double.infinity : 680),
    shape: const RoundedRectangleBorder(),
    sheetAnimationStyle: _sheetAnimationStyle(context),
    builder: (context) => MmSheetReleaseTracker(
      child: MmSheetGlass(
        heightFactor: heightFactor,
        child: MmSheetScaffold(title: title, footer: footer?.call(context), heightFactor: heightFactor, child: builder(context)),
      ),
    ),
  ));
}

/// A MockMob sheet's route. The drag itself is Flutter's (the sheet tracks the finger 1:1 and a
/// flick past 700 px/s or a release under half closes it). What it adds (AP1-13, MOTION.md C7):
/// a sheet let go on its way down closes on [Springs.settle] seeded with the finger's own speed,
/// so a fast flick leaves fast and a slow release drifts out, instead of every close taking the
/// same 240 ms whatever the hand did. A close from a key or the scrim keeps the drawer curve.
class MmSheetRoute<T> extends ModalBottomSheetRoute<T> {
  MmSheetRoute({
    required super.builder,
    super.capturedThemes,
    super.barrierLabel,
    super.barrierOnTapHint,
    super.backgroundColor,
    super.elevation,
    super.shape,
    super.clipBehavior,
    super.constraints,
    super.modalBarrierColor,
    super.isDismissible,
    super.enableDrag,
    required super.isScrollControlled,
    super.settings,
    super.useSafeArea,
    super.sheetAnimationStyle,
  });

  /// How recent a release must be for the close to take its speed.
  static const Duration releaseWindow = Duration(milliseconds: 250);

  double? _releaseVelocity;
  final Stopwatch _sinceRelease = Stopwatch();

  /// The finger left the sheet after a vertical drag at [unitsPerSecond] of the sheet's own
  /// height (negative: downward, toward closed).
  void noteRelease(double unitsPerSecond) {
    _releaseVelocity = unitsPerSecond;
    _sinceRelease
      ..reset()
      ..start();
  }

  /// The close for a drag released at [velocity] from [from] (both in route units), or null for
  /// the route's own reverse. Pure, for tests.
  static Simulation? closeAfterRelease({required double from, required double? velocity, required bool reduced}) {
    if (velocity == null || reduced) return null;
    // Never pull a sheet back up on its way out: a release moving upward still closes calmly.
    return Motion.spring(Springs.settle, from, 0, velocity: velocity < 0 ? velocity : 0);
  }

  @override
  Simulation? createSimulation({required bool forward}) {
    final velocity = _releaseVelocity;
    final recent = _sinceRelease.isRunning && _sinceRelease.elapsed <= releaseWindow;
    _releaseVelocity = null;
    _sinceRelease.stop();
    if (forward || !recent) return super.createSimulation(forward: forward);
    final reduced = sheetAnimationStyle?.curve == Curves.linear;
    return closeAfterRelease(from: controller?.value ?? 1, velocity: velocity, reduced: reduced) ?? super.createSimulation(forward: forward);
  }
}

/// Reads the finger's speed as it leaves a sheet after a vertical drag, without joining the
/// gesture arena (the sheet's own drag still owns the gesture), and hands it to [MmSheetRoute].
class MmSheetReleaseTracker extends StatefulWidget {
  const MmSheetReleaseTracker({super.key, required this.child});

  final Widget child;

  @override
  State<MmSheetReleaseTracker> createState() => _MmSheetReleaseTrackerState();
}

class _MmSheetReleaseTrackerState extends State<MmSheetReleaseTracker> {
  VelocityTracker? _tracker;
  double _startY = 0;
  double _travel = 0;

  @override
  Widget build(BuildContext context) {
    return Listener(
      behavior: HitTestBehavior.translucent,
      onPointerDown: (e) {
        _tracker = VelocityTracker.withKind(e.kind)..addPosition(e.timeStamp, e.position);
        _startY = e.position.dy;
        _travel = 0;
      },
      onPointerMove: (e) {
        _tracker?.addPosition(e.timeStamp, e.position);
        _travel = (e.position.dy - _startY).abs();
      },
      onPointerUp: (e) {
        final tracker = _tracker;
        _tracker = null;
        // Only a drag carries a speed: a tap on a key inside the sheet closes it the usual way.
        if (tracker == null || _travel < kTouchSlop) return;
        final route = ModalRoute.of(context);
        final height = context.size?.height ?? 0;
        if (route is! MmSheetRoute || height <= 0) return;
        route.noteRelease(-tracker.getVelocity().pixelsPerSecond.dy / height);
      },
      onPointerCancel: (_) => _tracker = null,
      child: widget.child,
    );
  }
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
    final localizations = MaterialLocalizations.of(context);
    return MmSheetRoute<T>(
      settings: this,
      barrierLabel: localizations.scrimLabel,
      barrierOnTapHint: localizations.scrimOnTapHint(localizations.bottomSheetLabel),
      isScrollControlled: true,
      useSafeArea: !large,
      backgroundColor: Colors.transparent,
      modalBarrierColor: colors.sheetScrim,
      elevation: 0,
      clipBehavior: Clip.none,
      constraints: BoxConstraints(maxWidth: MmSpace.contentMaxWidth, maxHeight: large ? double.infinity : 680),
      shape: const RoundedRectangleBorder(),
      sheetAnimationStyle: _sheetAnimationStyle(context),
      builder: (context) => MmSheetReleaseTracker(child: MmSheetGlass(child: MmSheetScaffold(title: title, footer: footer, child: child))),
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
    final modal = ModalRoute.of(context);
    // A route built offstage (for heroes) shows its animation standing at 1: wait for onstage.
    if (modal != null && modal.offstage) return;
    final route = modal?.animation;
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

/// A sheet's body riding in on the sheet: it fades and rises 12 dp over the second half of
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
    final modal = ModalRoute.of(context);
    if (modal != null && modal.offstage) return;
    final route = modal?.animation;
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
        // The glass materialises over the first 60% of the rise; the words begin once it is
        // mostly there, so text never lands on thin glass.
        final t = _landed ? 1.0 : Motion.emphasized.transform(((route.value - 0.5) / 0.5).clamp(0.0, 1.0));
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