import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';

import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import 'keyboard_watch.dart';

/// What the flow hands every step's frame (D43, D44): the guide Mobi's controller, how he
/// enters, and the way back. A step pumped on its own (tests) has none: no Mobi, no Back.
class StepGuide extends InheritedWidget {
  const StepGuide({super.key, required super.child, this.mobi, this.onBack, this.entrance = MobiAct.idle});

  /// The deck's one Mobi controller: his cues reach whichever step is on screen.
  final MobiController? mobi;

  /// Back to the step before, answers kept. Null on the first step (no labelled Back there).
  final VoidCallback? onBack;

  /// How the step's Mobi enters: hello on the first step of a visit, idle after.
  final MobiAct entrance;

  static StepGuide? of(BuildContext context) => context.dependOnInheritedWidgetOfExactType<StepGuide>();

  @override
  bool updateShouldNotify(StepGuide old) => old.mobi != mobi || old.onBack != onBack || old.entrance != entrance;
}

/// How big Mobi stands on a step (D44, D48): a share of the free height, clamped. The plan step
/// takes a larger share ([plan]) and gives back what its card needs, so it never scrolls for him.
@immutable
class MobiSizing {
  const MobiSizing({this.share = 0.18, this.min = 88, this.max = 168, this.fit = true});

  /// The plan step: up to 30% of the free height, 120 to 200 dp, shrinking to fit the card.
  static const MobiSizing plan = MobiSizing(share: 0.30, min: 120, max: 200);

  final double share;
  final double min;
  final double max;

  /// Shrink (never below [min]) so the content group fits the free height without scrolling:
  /// on a 360 by 800 phone the first step's four answers stay above the fold.
  final bool fit;

  /// Mobi's height for [free] dp of free height, with [rest] dp of content beside him (for [fit]).
  double sizeFor(double free, {double? rest, double gap = 0}) {
    var want = free * share;
    if (fit && rest != null) want = math.min(want, free - rest - gap);
    return want.clamp(min, max).toDouble();
  }

  @override
  bool operator ==(Object other) => other is MobiSizing && other.share == share && other.min == min && other.max == max && other.fit == fit;

  @override
  int get hashCode => Object.hash(share, min, max, fit);
}

/// The one frame every onboarding step stands in (D40, D43, D44).
///
/// - The content group (Mobi and his bubble, then the step's [content]) sits in the free height
///   with about 45% of the spare room above it and 55% below, so nothing is pinned under the
///   status bar with a void below. When the group is taller than the room it scrolls (a 360 by
///   640 phone), and a fade over the action row says there is more.
/// - The action row is pinned at the foot, 16 dp above the bottom inset: a labelled "Back" (a
///   secondary pill, from [StepGuide.onBack]) left of the step's primary key.
/// - Mobi is sized by [mobi] from the free height; his bubble takes the rest of the row and its
///   line goes up one type step on a phone 760 dp or taller. He never overlaps the bubble or the
///   title: they share a row, and the title starts under it.
/// - While the keyboard is up the action row and Mobi step aside, so a field and its answers
///   keep the room.
class StepFrame extends StatelessWidget {
  const StepFrame({
    super.key,
    required this.content,
    this.bottom,
    this.mobi = const MobiSizing(),
    this.endInset = fade + MmSpace.s8,
    this.backInRow = true,
    this.hideBottomForKeyboard = true,
    this.guideController,
    this.guideKey,
    this.guideEntrance,
    this.overlay,
    this.showGuide = true,
    this.head,
    this.besideHead = false,
  });

  /// The step's own group under Mobi: its title, support and answers. Laid out at its natural
  /// height (it scrolls with Mobi when the room is short).
  final Widget content;

  /// The step's primary key (and anything that belongs with it).
  final Widget? bottom;

  final MobiSizing mobi;

  /// The room kept under the group's end when it scrolls, so the last answer clears the fade.
  final double endInset;

  /// Puts the labelled Back left of [bottom]. Off for a step that places Back itself (the save
  /// step sets it beside whichever key is primary).
  final bool backInRow;

  final bool hideBottomForKeyboard;

  /// A step with its own Mobi (the first move): his controller, a key on his figure for aiming,
  /// and his entrance. Otherwise the deck's guide from [StepGuide].
  final MobiController? guideController;
  final GlobalKey? guideKey;
  final MobiAct? guideEntrance;

  /// Laid over the free area, at its foot (the plan's seal words).
  final Widget? overlay;

  /// Mobi stands in the group (off where a moment needs the room).
  final bool showGuide;

  /// The step's title and support, above [content]. Laid out with the content unless
  /// [besideHead].
  final Widget? head;

  /// Mobi stands at the end of the [head] row instead of above it, with no bubble: for a step
  /// whose sealed sheet, pinned keys and quiet lines all need the height (the save step).
  final bool besideHead;

  /// The fade above the action row (SPACING.md 4.5).
  static const double fade = MmSpace.s24;

  /// The share of the spare room above the group (the rest goes below).
  static const double topShare = 0.45;

  /// The room between the action row and the bottom inset.
  static const double footGap = MmSpace.s16;

  /// Mobi's gap to the title under him (his contact shadow already sets him apart).
  static double headGap(BuildContext context) => MediaQuery.sizeOf(context).height < 720 ? MmSpace.s8 : MmSpace.s12;

  /// The line in Mobi's bubble goes up one type step from this screen height.
  static const double largeBubbleFrom = 760;

  @override
  Widget build(BuildContext context) {
    final guide = StepGuide.of(context);
    final controller = guideController ?? guide?.mobi;
    final onBack = guide?.onBack;
    final back = backInRow && onBack != null ? StepBackKey(onPressed: onBack) : null;
    final Widget? row = switch ((back, bottom)) {
      (null, null) => null,
      (final Widget b, null) => Align(alignment: Alignment.centerLeft, child: b),
      (null, final Widget k) => k,
      // Tops aligned: Back sits beside the primary pill, not beside a hint line under it.
      (final Widget b, final Widget k) => Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [b, const SizedBox(width: MmSpace.s12), Expanded(child: k)],
        ),
    };
    final gap = StepFrame.headGap(context);
    final large = MediaQuery.sizeOf(context).height >= StepFrame.largeBubbleFrom;

    return KeyboardWatch(
      builder: (context, open) {
        final withGuide = showGuide && controller != null && !open;
        final scroll = LayoutBuilder(
          builder: (context, box) {
            final free = box.maxHeight;
            // Mobi is sized in the same layout pass as the content beside him (GuidedGroup), so
            // a step never paints him at one size and then another.
            final head = this.head;
            final beside = besideHead && head != null;
            final entrance = guideEntrance ?? guide?.entrance ?? MobiAct.idle;
            final Widget? header = !withGuide
                ? null
                : LayoutBuilder(
                    builder: (context, c) => beside
                        ? Row(
                            children: [
                              Expanded(child: head),
                              const SizedBox(width: MmSpace.s12),
                              GuideHeader(controller: controller, size: c.minHeight, entrance: entrance, figureKey: guideKey, bubble: false),
                            ],
                          )
                        : GuideHeader(controller: controller, size: c.minHeight, entrance: entrance, figureKey: guideKey, large: large),
                  );
            final group = GuidedGroup(
              free: free,
              gap: beside ? 0 : gap,
              sizing: mobi,
              header: header,
              // Mobi stepped aside for the keyboard: the title keeps its room under the bar.
              topGap: !withGuide && showGuide && controller != null ? gap : 0,
              content: head == null || (beside && withGuide)
                  ? content
                  : Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [head, content]),
            );
            final body = SingleChildScrollView(
              // Dragging the list puts the keyboard away, so the pinned key comes back.
              keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
              child: BalancedBox(
                minHeight: free.isFinite ? free : 0,
                // With no action row the group keeps clear of the gesture bar itself.
                reserve: endInset + (row == null ? MediaQuery.paddingOf(context).bottom : 0),
                topShare: StepFrame.topShare,
                child: group,
              ),
            );
            final faded = row == null ? body : FadeWhenMore(child: body);
            final over = overlay;
            if (over == null) return faded;
            return Stack(
              children: [
                Positioned.fill(child: faded),
                Positioned(left: 0, right: 0, bottom: MmSpace.s24, child: over),
              ],
            );
          },
        );
        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Expanded(child: scroll),
            if (row != null && !(hideBottomForKeyboard && open))
              Padding(
                padding: EdgeInsets.only(top: MmSpace.s8, bottom: MediaQuery.paddingOf(context).bottom + StepFrame.footGap),
                child: row,
              ),
          ],
        );
      },
    );
  }
}

/// The labelled way back (D43): a secondary pill, as tall as the primary key beside it.
class StepBackKey extends StatelessWidget {
  const StepBackKey({super.key, required this.onPressed});

  final VoidCallback onPressed;

  static const Key keyKey = ValueKey('step-back');

  @override
  Widget build(BuildContext context) => ConstrainedBox(
        constraints: const BoxConstraints(minWidth: 96),
        child: KeyButton.secondary(key: keyKey, label: OnboardingCopy.back, onPressed: onPressed, expanded: false),
      );
}

/// Mobi standing on the gutter at [size], his line in a bubble beside him taking the rest of the
/// row. The row is at least as tall as Mobi, so the title under it never meets either.
class GuideHeader extends StatelessWidget {
  const GuideHeader({
    super.key,
    required this.controller,
    required this.size,
    this.entrance = MobiAct.idle,
    this.figureKey,
    this.large = false,
    this.bubble = true,
  });

  final MobiController controller;
  final double size;
  final MobiAct entrance;
  final GlobalKey? figureKey;
  final bool large;

  /// Off: Mobi alone, with no bubble beside him (he stands at the end of a title row).
  final bool bubble;

  @override
  Widget build(BuildContext context) {
    // A size change (the plan's card growing) eases rather than jumps.
    final figure = TweenAnimationBuilder<double>(
      tween: Tween<double>(end: size),
      duration: Motion.of(context, const Duration(milliseconds: 240)),
      curve: Motion.glide,
      builder: (context, s, _) => MobiCharacter(
        controller: controller,
        size: s,
        entrance: entrance,
        interactive: true,
        // An input-heavy screen: he does not twitch at every tap. The flow glances on purpose,
        // at the thing the student just changed (GuideGlance).
        watchTaps: false,
        seed: 11,
      ),
    );
    final placed = figureKey == null ? figure : KeyedSubtree(key: figureKey, child: figure);
    if (!bubble) return placed;
    return ConstrainedBox(
      constraints: BoxConstraints(minHeight: size),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          placed,
          const SizedBox(width: MmSpace.s4),
          Expanded(
            child: LayoutBuilder(
              builder: (context, box) => ValueListenableBuilder<MobiSpeech?>(
                valueListenable: controller.speech,
                builder: (context, speech, _) => Align(
                  alignment: Alignment.centerLeft,
                  child: speech == null
                      ? const SizedBox.shrink()
                      : MobiBubble(key: ValueKey(speech.id), speech: speech, tail: MobiTail.left, maxWidth: box.maxWidth, large: large),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// Mobi's header above the step's content, Mobi sized from [free] and the content's height in one
/// layout pass: the content is laid out first, then [header] gets Mobi's height as its minimum
/// height (a LayoutBuilder there reads it). [topGap] stands in for a header that stepped aside.
class GuidedGroup extends MultiChildRenderObjectWidget {
  GuidedGroup({super.key, required this.free, required this.gap, required this.sizing, required Widget content, Widget? header, this.topGap = 0})
      : hasHeader = header != null,
        super(children: [content, ?header]);

  final double free;
  final double gap;
  final MobiSizing sizing;
  final bool hasHeader;
  final double topGap;

  @override
  RenderGuidedGroup createRenderObject(BuildContext context) => RenderGuidedGroup(free, gap, sizing, hasHeader, topGap);

  @override
  void updateRenderObject(BuildContext context, RenderGuidedGroup renderObject) {
    renderObject
      ..free = free
      ..gap = gap
      ..sizing = sizing
      ..hasHeader = hasHeader
      ..topGap = topGap;
  }
}

class RenderGuidedGroup extends RenderBox
    with ContainerRenderObjectMixin<RenderBox, _GroupData>, RenderBoxContainerDefaultsMixin<RenderBox, _GroupData> {
  RenderGuidedGroup(this._free, this._gap, this._sizing, this._hasHeader, this._topGap);

  double _free;
  set free(double v) {
    if (v == _free) return;
    _free = v;
    markNeedsLayout();
  }

  double _gap;
  set gap(double v) {
    if (v == _gap) return;
    _gap = v;
    markNeedsLayout();
  }

  MobiSizing _sizing;
  set sizing(MobiSizing v) {
    if (v == _sizing) return;
    _sizing = v;
    markNeedsLayout();
  }

  bool _hasHeader;
  set hasHeader(bool v) {
    if (v == _hasHeader) return;
    _hasHeader = v;
    markNeedsLayout();
  }

  double _topGap;
  set topGap(double v) {
    if (v == _topGap) return;
    _topGap = v;
    markNeedsLayout();
  }

  /// Mobi's height after the last layout (0 with no header).
  double mobiSize = 0;

  @override
  void setupParentData(RenderBox child) {
    if (child.parentData is! _GroupData) child.parentData = _GroupData();
  }

  @override
  void performLayout() {
    final w = constraints.maxWidth;
    final content = firstChild!;
    content.layout(BoxConstraints.tightFor(width: w), parentUsesSize: true);
    final h = content.size.height;
    var top = _topGap;
    final header = _hasHeader ? childAfter(content) : null;
    if (header != null) {
      mobiSize = _sizing.sizeFor(_free, rest: h + RenderBalancedBox.fitGap, gap: _gap);
      header.layout(BoxConstraints(minWidth: w, maxWidth: w, minHeight: mobiSize), parentUsesSize: true);
      (header.parentData! as _GroupData).offset = Offset.zero;
      top = header.size.height + _gap;
    } else {
      mobiSize = 0;
    }
    (content.parentData! as _GroupData).offset = Offset(0, top);
    size = constraints.constrain(Size(w, top + h));
  }

  @override
  void paint(PaintingContext context, Offset offset) => defaultPaint(context, offset);

  @override
  bool hitTestChildren(BoxHitTestResult result, {required Offset position}) => defaultHitTestChildren(result, position: position);
}

class _GroupData extends ContainerBoxParentData<RenderBox> {}

/// Sizes to at least [minHeight] and places its child with [topShare] of the spare room above
/// it. A child taller than that makes it taller, with [reserve] under the child's end (the scroll
/// takes over).
class BalancedBox extends SingleChildRenderObjectWidget {
  const BalancedBox({super.key, required this.minHeight, this.reserve = 0, this.topShare = 0.5, super.child});

  final double minHeight;
  final double reserve;
  final double topShare;

  @override
  RenderBalancedBox createRenderObject(BuildContext context) =>
      RenderBalancedBox(minHeight, reserve, topShare);

  @override
  void updateRenderObject(BuildContext context, RenderBalancedBox renderObject) {
    renderObject
      ..minHeight = minHeight
      ..reserve = reserve
      ..topShare = topShare;
  }
}

class RenderBalancedBox extends RenderShiftedBox {
  RenderBalancedBox(this._minHeight, this._reserve, this._topShare) : super(null);

  double _minHeight;
  set minHeight(double v) {
    if (v == _minHeight) return;
    _minHeight = v;
    markNeedsLayout();
  }

  double _reserve;
  set reserve(double v) {
    if (v == _reserve) return;
    _reserve = v;
    markNeedsLayout();
  }

  double _topShare;
  set topShare(double v) {
    if (v == _topShare) return;
    _topShare = v;
    markNeedsLayout();
  }

  /// The least room kept under a group that fits.
  static const double fitGap = MmSpace.s8;

  /// Where the child sits from the top, after the last layout.
  double get top => (child?.parentData as BoxParentData?)?.offset.dy ?? 0;

  @override
  void performLayout() {
    final c = constraints;
    final child = this.child;
    if (child == null) {
      size = c.constrain(Size(c.maxWidth, _minHeight));
      return;
    }
    child.layout(BoxConstraints.tightFor(width: c.maxWidth), parentUsesSize: true);
    final h = child.size.height;
    // A group that fits needs no end room for a fade (nothing scrolls); one that does not gets
    // [reserve] under its end, so its last line clears the fade over the action row.
    final fits = h + fitGap <= _minHeight;
    final height = fits ? _minHeight : h + _reserve;
    final spare = height - h;
    final top = fits ? math.max(0.0, math.min(spare * _topShare, spare - fitGap)) : 0.0;
    (child.parentData! as BoxParentData).offset = Offset(0, top);
    size = c.constrain(Size(c.maxWidth, height));
  }
}

/// A 24 dp fade into the ground above the pinned key, shown only while there is more below, so
/// nothing at rest sits half-dimmed under it and a long list reads as scrolling, not cut off.
class FadeWhenMore extends StatefulWidget {
  const FadeWhenMore({super.key, required this.child});

  final Widget child;

  @override
  State<FadeWhenMore> createState() => _FadeWhenMoreState();
}

class _FadeWhenMoreState extends State<FadeWhenMore> {
  final ValueNotifier<bool> _more = ValueNotifier<bool>(false);

  bool _onMetrics(ScrollMetrics m) {
    final more = m.extentAfter > 1;
    if (more != _more.value) _more.value = more;
    return false;
  }

  @override
  void dispose() {
    _more.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    return NotificationListener<ScrollMetricsNotification>(
      onNotification: (n) => n.depth == 0 && _onMetrics(n.metrics),
      child: NotificationListener<ScrollNotification>(
        onNotification: (n) => n.depth == 0 && _onMetrics(n.metrics),
        child: Stack(
          children: [
            Positioned.fill(child: widget.child),
            Positioned(
              left: 0,
              right: 0,
              bottom: 0,
              height: StepFrame.fade,
              child: IgnorePointer(
                child: ValueListenableBuilder<bool>(
                  valueListenable: _more,
                  builder: (context, more, child) => AnimatedOpacity(
                    opacity: more ? 1 : 0,
                    duration: Motion.of(context, const Duration(milliseconds: 160)),
                    child: child,
                  ),
                  child: DecoratedBox(
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        begin: Alignment.topCenter,
                        end: Alignment.bottomCenter,
                        colors: [colors.ground.withValues(alpha: 0), colors.ground],
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
