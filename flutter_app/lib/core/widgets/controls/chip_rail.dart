import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/scheduler.dart' show SchedulerBinding, SchedulerPhase;

import '../../../features/insights/widgets/edge_fade.dart';
import '../../motion/motion.dart';
import '../../theme/theme.dart';
import 'chip.dart';

/// Where one chip sits in a rail's scrolled content, edge to edge, in dp from the content's start.
@immutable
class ChipSpan {
  const ChipSpan(this.left, this.right);

  final double left;
  final double right;

  double get width => right - left;

  @override
  String toString() => 'ChipSpan($left, $right)';
}

/// The arithmetic of a [ChipRail], kept apart from the widget so it can be tested with numbers.
///
/// The rule it enforces: a sideways rail must suggest more, never look broken. At rest the right
/// edge either meets the end of the rail or cuts the next chip inside its cap and bubble (between
/// [peekMin] and [peekMax] dp of it showing, before any letter), so what shows is a clean start of
/// a chip and not "Economics, full mo". Every rest position is a chip boundary: a chip's left edge
/// at the rail's start inset, nudged by at most [nudgeMax] dp (inside the left fade) to make the
/// peek clean.
abstract final class ChipRailGeometry {
  /// The least of the next chip that shows at the right edge: its rounded cap and a hint of its bubble.
  static const double peekMin = 16;

  /// The most: the cap, the bubble, the gap before the label ([MmChip.labelInset]) and 18 dp of the
  /// first letters, all of which sit inside the 24 dp edge fade and dissolve before the cut.
  static const double peekMax = 48;

  /// How far a rest position may slide back (a little of the chip before it shows) to make the
  /// peek clean; it may move forward only by the start inset the first chip leaves free.
  static const double nudgeMax = 24;

  /// Where an anchored rest puts the next chip's left edge: this far inside the right edge.
  static const double peekAnchor = 32;

  /// The widest the right-edge fade grows to when a first view's cut chip cannot be made clean.
  static const double peekFadeMax = 72;

  /// The right-edge fade at rest, given how much of the cut chip shows ([peekDepth]). A clean peek
  /// (or none) keeps the plain [base] fade. A chip cut deeper than [peekMax] (a first view whose
  /// widths do not line up, where the rest cannot be moved) is dissolved over its whole visible
  /// width, up to [peekFadeMax], so it reads as the start of a chip fading in, not a cut label.
  static double peekFadeExtent(double? depth, {double base = ChipRail.fadeDp}) {
    if (depth == null || depth <= peekMax) return base;
    return math.min(math.max(depth, base), peekFadeMax);
  }

  /// The chip the viewport's right edge cuts, or null when the edge is past the last chip.
  static int? cutChip(List<ChipSpan> chips, double offset, double viewport) {
    final edge = offset + viewport;
    for (var i = 0; i < chips.length; i++) {
      if (chips[i].right > edge + 0.01) return i;
    }
    return null;
  }

  /// How much of the cut chip shows at the right edge for [offset]: negative while the next chip
  /// has not begun yet (the edge is in the gap). Null when nothing is cut.
  static double? peekDepth(List<ChipSpan> chips, double offset, double viewport) {
    final i = cutChip(chips, offset, viewport);
    return i == null ? null : offset + viewport - chips[i].left;
  }

  /// True when [offset] is a clean rest: the end of the rail, or a peek inside the cap zone.
  static bool isClean(List<ChipSpan> chips, double offset, double viewport, double maxExtent) {
    if (offset >= maxExtent - 0.5) return true;
    final d = peekDepth(chips, offset, viewport);
    return d == null || (d >= peekMin - 0.01 && d <= peekMax + 0.01);
  }

  /// The offsets the rail comes to rest at, ascending: one per chip boundary, then the end.
  ///
  /// Each is a chip's left edge at the start inset (nudged a few dp when that makes the peek
  /// clean). Where no nudge can, the rest anchors the other way: the next chip's left edge sits
  /// [peekAnchor] dp inside the right edge, so the right edge always shows a clean cap and the
  /// left edge, behind the fade, shows the tail of a chip already read. The very first rest is the
  /// start of the rail and can only be nudged forward, so a first view whose cut chip is too wide
  /// to fix stays as it is (the 24 dp fade softens it). A chip no rest shows whole gets its own.
  static List<double> restStops({
    required List<ChipSpan> chips,
    required double viewport,
    required double maxExtent,
    required double startInset,
    double gap = MmSpace.s8,
  }) {
    if (chips.isEmpty || maxExtent <= 0.5) return const [0];
    final stops = <double>[];
    final plain = <double>[];
    for (var k = 0; k < chips.length; k++) {
      final o = (chips[k].left - startInset).clamp(0.0, maxExtent);
      plain.add(o);
      if (o >= maxExtent - 0.5) continue;
      final fixed = _clean(chips, o, viewport, maxExtent, startInset: startInset, atStart: k == 0, gap: gap);
      if (fixed != null) {
        stops.add(fixed);
      } else if (k > 0) {
        final j = cutChip(chips, o, viewport);
        if (j != null) {
          final anchored = chips[j].left - (viewport - peekAnchor);
          if (anchored > 0 && anchored < maxExtent - 0.5) stops.add(anchored);
        }
      }
    }
    // The rail always has a rest at its very start, and at its end.
    if (stops.isEmpty || stops.first > math.max(startInset - 4, 0) + 0.5) stops.insert(0, 0);
    stops.add(maxExtent);
    stops.sort();
    // A chip that no rest shows whole gets its own plain rest.
    for (var k = 0; k < chips.length; k++) {
      final c = chips[k];
      if (!stops.any((s) => c.left >= s - 0.5 && c.right <= s + viewport + 0.5)) stops.add(plain[k]);
    }
    stops.sort();
    final out = <double>[];
    for (final s in stops) {
      if (out.isEmpty || s - out.last > 6) out.add(s);
    }
    // The end always stays, even when a neighbour was within 6 dp of it.
    if ((out.last - maxExtent).abs() > 0.5) {
      out.removeLast();
      out.add(maxExtent);
    }
    return out;
  }

  /// The stop a release at [pixels] with [velocity] settles on: the one nearest where a short
  /// glide would end, never one behind a fling's direction.
  static double snapTarget(List<double> stops, double pixels, double velocity, [double minVelocity = 50]) {
    final projected = pixels + velocity * 0.22;
    var best = stops.first;
    for (final s in stops) {
      if ((s - projected).abs() < (best - projected).abs()) best = s;
    }
    if (velocity > minVelocity && best < pixels) {
      best = stops.firstWhere((s) => s >= pixels, orElse: () => stops.last);
    } else if (velocity < -minVelocity && best > pixels) {
      best = stops.lastWhere((s) => s <= pixels, orElse: () => stops.first);
    }
    return best;
  }

  static double? _clean(
    List<ChipSpan> chips,
    double o,
    double viewport,
    double maxExtent, {
    required double startInset,
    required bool atStart,
    required double gap,
  }) {
    final j = cutChip(chips, o, viewport);
    if (j == null) return o;
    final d = o + viewport - chips[j].left;
    if (d >= peekMin && d <= peekMax) return o;
    // The first rest has no chip before it to slide over and may not scroll below zero; it can
    // only move forward by the slack its start inset leaves (the cap of the first chip).
    final up = math.max(startInset - 4, 0.0);
    final down = atStart ? 0.0 : nudgeMax;
    if (d < peekMin) {
      final delta = peekMin - d;
      return delta <= up && o + delta <= maxExtent ? o + delta : null;
    }
    // Too much of the chip shows (its label would be cut). Either slide back so only its cap
    // shows, or forward so it shows whole and the one after it peeks.
    final back = d - (peekMin + peekMax) / 2;
    final nextLeft = j + 1 < chips.length ? chips[j + 1].left : chips[j].right + gap;
    final forward = nextLeft - (o + viewport) + (j + 1 < chips.length ? (peekMin + peekMax) / 2 : 0);
    final canBack = back <= down && o - back >= 0;
    final canForward = forward <= up && o + forward <= maxExtent + 0.5;
    if (canBack && (!canForward || back <= forward)) return o - back;
    if (canForward) return math.min(o + forward, maxExtent);
    return null;
  }
}

/// One rail of chips for the whole app (a subject, a category, a length): it never ends in a chip
/// cut through a letter.
///
/// - It snaps. Letting go settles on a chip boundary, with a spring ([Springs.settle]) carrying
///   the fling's speed, so a swipe moves a few chips and stops square.
/// - It fades. A 24 dp mask ([EdgeFade]) dissolves whichever edge has more behind it; at rest
///   against the start nothing fades, at the very end nothing fades.
/// - It peeks. Wherever it rests, the right edge shows the clean start of the next chip (see
///   [ChipRailGeometry]) so the student can see there is more and what it begins with.
///
/// Place it edge to edge, outside the screen's gutter, and give the gutter as [padding] (the
/// default is 16 dp each side), so the peek meets the screen edge. Chips here get all the width
/// their words need; a chip wider than the rail is the only one that ellipsises. The rail is 48
/// dp tall so each chip's 48 dp target is whole inside it. Pass [revealIndex] (the chosen chip) and
/// the rail scrolls to show that chip whole whenever it changes, and on first build.
class ChipRail extends StatefulWidget {
  const ChipRail({
    super.key,
    required this.children,
    this.gap = MmSpace.s8,
    this.padding = const EdgeInsets.symmetric(horizontal: MmSpace.gutter),
    this.height = MmChip.targetHeight,
    this.revealIndex,
    this.fadeExtent = fadeDp,
    this.semanticLabel,
  });

  /// A rail of [MmChip]s from [labels]; [selected] is the chosen one (and the one revealed).
  factory ChipRail.labelled({
    Key? key,
    required List<String> labels,
    required int? selected,
    required ValueChanged<int>? onSelected,
    List<IconData?>? leading,
    double gap = MmSpace.s8,
    EdgeInsets padding = const EdgeInsets.symmetric(horizontal: MmSpace.gutter),
    String? semanticLabel,
  }) {
    return ChipRail(
      key: key,
      gap: gap,
      padding: padding,
      revealIndex: selected,
      semanticLabel: semanticLabel,
      children: [
        for (var i = 0; i < labels.length; i++)
          MmChip(
            label: labels[i],
            selected: i == selected,
            leading: leading != null && i < leading.length ? leading[i] : null,
            onTap: onSelected == null ? null : () => onSelected(i),
          ),
      ],
    );
  }

  /// The edge fade, in dp.
  static const double fadeDp = 24;

  final List<Widget> children;
  final double gap;

  /// Start and end insets of the content (the screen gutter).
  final EdgeInsets padding;
  final double height;

  /// The chip to bring whole into view when this changes (and at first build).
  final int? revealIndex;
  final double fadeExtent;
  final String? semanticLabel;

  @override
  State<ChipRail> createState() => _ChipRailState();
}

class _ChipRailState extends State<ChipRail> with SingleTickerProviderStateMixin {
  final ScrollController _controller = ScrollController();
  final GlobalKey _rowKey = GlobalKey();
  List<GlobalKey> _keys = const [];

  /// 0 while scrolling (the plain fade); 1 once the rail has rested and a deeper fade, if the
  /// cut chip needs one, is fully in.
  late final AnimationController _peekCtl;
  double _peekTo = ChipRail.fadeDp;

  @override
  void initState() {
    super.initState();
    _peekCtl = AnimationController(vsync: this, duration: Motion.glideDuration);
    WidgetsBinding.instance.addPostFrameCallback((_) => _firstRest());
  }

  @override
  void didUpdateWidget(ChipRail old) {
    super.didUpdateWidget(old);
    final index = widget.revealIndex;
    if (index != null && index != old.revealIndex) {
      WidgetsBinding.instance.addPostFrameCallback((_) => _reveal(index, animate: true));
    }
  }

  @override
  void dispose() {
    _peekCtl.dispose();
    _controller.dispose();
    super.dispose();
  }

  /// At rest, sizes the right fade to the chip the edge cuts (see [ChipRailGeometry.peekFadeExtent]).
  void _settlePeek() {
    if (!mounted || !_controller.hasClients || !_controller.position.hasContentDimensions) return;
    final spans = _spans();
    if (spans == null) return;
    final p = _controller.position;
    final more = p.pixels < p.maxScrollExtent - 2;
    final depth = more ? ChipRailGeometry.peekDepth(spans, p.pixels, p.viewportDimension) : null;
    final target = ChipRailGeometry.peekFadeExtent(depth, base: widget.fadeExtent);
    if (target - widget.fadeExtent < 1) {
      _peekCtl.reverse();
      return;
    }
    _peekTo = target;
    final duration = Motion.of(context, Motion.glideDuration);
    if (duration == Duration.zero) {
      _peekCtl.value = 1;
    } else {
      _peekCtl.duration = duration;
      _peekCtl.forward();
    }
  }

  bool _onScroll(ScrollNotification n) {
    if (n.depth != 0) return false;
    if (n is ScrollStartNotification || (n is ScrollUpdateNotification && n.dragDetails != null)) {
      if (_peekCtl.value > 0 && _peekCtl.status != AnimationStatus.reverse) _peekCtl.reverse();
    } else if (n is ScrollEndNotification) {
      _settlePeek();
    }
    return false;
  }

  /// The spans measured outside layout, kept for the moments the rail is asked mid-layout (a
  /// scroll position settling to new dimensions asks its physics for a rest while the viewport is
  /// still laying out, when no child may read another's size).
  List<ChipSpan>? _measuredSpans;

  /// The chips' extents in the scrolled content, or null before the first layout. During layout
  /// (the persistent-callbacks phase) the last measure is returned instead of reading sizes.
  List<ChipSpan>? _spans() {
    if (SchedulerBinding.instance.schedulerPhase == SchedulerPhase.persistentCallbacks) return _measuredSpans;
    final row = _rowKey.currentContext?.findRenderObject();
    if (row is! RenderBox || !row.hasSize) return null;
    final spans = <ChipSpan>[];
    for (final key in _keys) {
      final box = key.currentContext?.findRenderObject();
      if (box is! RenderBox || !box.hasSize) return null;
      final left = widget.padding.left + box.localToGlobal(Offset.zero, ancestor: row).dx;
      spans.add(ChipSpan(left, left + box.size.width));
    }
    return _measuredSpans = spans;
  }

  List<double> _stops() {
    if (!_controller.hasClients || !_controller.position.hasContentDimensions) return const [];
    final spans = _spans();
    if (spans == null) return const [];
    final p = _controller.position;
    return ChipRailGeometry.restStops(
      chips: spans,
      viewport: p.viewportDimension,
      maxExtent: p.maxScrollExtent,
      startInset: widget.padding.left,
      gap: widget.gap,
    );
  }

  void _firstRest() {
    if (!mounted || !_controller.hasClients) return;
    final index = widget.revealIndex;
    if (index != null) {
      _reveal(index, animate: false);
      _settlePeek();
      return;
    }
    final stops = _stops();
    // The first view is already as clean as a chip boundary lets it be; only a small forward
    // nudge (inside the start inset) is applied, to make its peek clean.
    if (stops.isNotEmpty && stops.first > 0.5 && _controller.offset < 0.5) _controller.jumpTo(stops.first);
    _settlePeek();
  }

  void _reveal(int index, {required bool animate}) {
    if (!mounted || !_controller.hasClients || index < 0 || index >= _keys.length) return;
    final spans = _spans();
    if (spans == null) return;
    final p = _controller.position;
    final chip = spans[index];
    final o = p.pixels;
    bool whole(double at) => chip.left >= at + 4 && chip.right <= at + p.viewportDimension - 4;
    if (whole(o) && ChipRailGeometry.isClean(spans, o, p.viewportDimension, p.maxScrollExtent)) return;
    final stops = _stops().where(whole).toList()..sort((a, b) => (a - o).abs().compareTo((b - o).abs()));
    final target = (stops.isNotEmpty ? stops.first : chip.left - widget.padding.left).clamp(0.0, p.maxScrollExtent);
    final duration = animate ? Motion.of(context, Motion.emphasizedDuration) : Duration.zero;
    if (duration == Duration.zero) {
      _controller.jumpTo(target);
    } else {
      _controller.animateTo(target, duration: duration, curve: Motion.emphasized);
    }
  }

  @override
  Widget build(BuildContext context) {
    final count = widget.children.length;
    if (_keys.length != count) {
      _keys = [for (var i = 0; i < count; i++) i < _keys.length ? _keys[i] : GlobalKey()];
    }
    return SizedBox(
      height: widget.height,
      child: LayoutBuilder(
        builder: (context, box) {
          // A chip may be as wide as the rail's own content area, no wider.
          final maxChip = math.max(box.maxWidth - widget.padding.horizontal, 48.0);
          return Semantics(
            container: true,
            label: widget.semanticLabel,
            child: NotificationListener<ScrollNotification>(
              onNotification: _onScroll,
              child: EdgeFade(
                extent: widget.fadeExtent,
                // A deeper right fade for a first view whose cut chip cannot be moved; the plain
                // fade (nothing extra) in every other case.
                child: AnimatedBuilder(
                  animation: _peekCtl,
                  builder: (context, child) => _PeekMask(
                    key: const ValueKey('chip-rail-peek'),
                    extent: widget.fadeExtent + (_peekTo - widget.fadeExtent) * Curves.easeOut.transform(_peekCtl.value),
                    base: widget.fadeExtent,
                    child: child!,
                  ),
                  child: SingleChildScrollView(
                    scrollDirection: Axis.horizontal,
                    controller: _controller,
                    padding: widget.padding,
                    physics: _ChipSnapPhysics(stops: _stops, parent: const ClampingScrollPhysics()),
                    child: Row(
                      key: _rowKey,
                      mainAxisSize: MainAxisSize.min,
                      crossAxisAlignment: CrossAxisAlignment.center,
                      children: [
                        for (var i = 0; i < count; i++) ...[
                          if (i > 0) SizedBox(width: widget.gap),
                          KeyedSubtree(
                            key: _keys[i],
                            child: ConstrainedBox(
                              constraints: BoxConstraints(maxWidth: maxChip),
                              child: widget.children[i],
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),
                ),
              ),
            ),
          );
        },
      ),
    );
  }
}

/// A mask over the rail's right edge only, deeper than [EdgeFade]'s own when [extent] exceeds
/// [base]; solid otherwise. Always in the tree, so the scroller never rebuilds to add it.
class _PeekMask extends StatelessWidget {
  const _PeekMask({super.key, required this.extent, required this.base, required this.child});

  final double extent;
  final double base;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return ShaderMask(
      blendMode: BlendMode.dstIn,
      shaderCallback: (rect) {
        const solid = Color(0xFFFFFFFF);
        const clear = Color(0x00FFFFFF);
        final deeper = extent > base + 0.5 && rect.width > 0;
        final f = deeper ? (extent / rect.width).clamp(0.0, 0.9) : 0.0;
        if (!deeper) return const LinearGradient(colors: [solid, solid]).createShader(rect);
        // Down to nothing 20% before the edge, so the letters of the cut chip are gone before the
        // cut and what shows is the chip's start fading out.
        return LinearGradient(colors: const [solid, Color(0x66FFFFFF), clear, clear], stops: [1 - f, 1 - 0.6 * f, 1 - 0.2 * f, 1]).createShader(rect);
      },
      child: child,
    );
  }
}

/// Settles a fling on the nearest rest stop in the direction it was going, on the shared
/// [Springs.settle] spring, keeping the finger's speed.
class _ChipSnapPhysics extends ScrollPhysics {
  const _ChipSnapPhysics({super.parent, required this.stops});

  final ValueGetter<List<double>> stops;

  @override
  _ChipSnapPhysics applyTo(ScrollPhysics? ancestor) => _ChipSnapPhysics(parent: buildParent(ancestor), stops: stops);

  @override
  Simulation? createBallisticSimulation(ScrollMetrics position, double velocity) {
    if ((velocity <= 0 && position.pixels <= position.minScrollExtent) || (velocity >= 0 && position.pixels >= position.maxScrollExtent)) {
      return super.createBallisticSimulation(position, velocity);
    }
    final list = stops();
    if (list.isEmpty) return super.createBallisticSimulation(position, velocity);
    final tolerance = toleranceFor(position);
    final target = ChipRailGeometry.snapTarget(list, position.pixels, velocity, tolerance.velocity);
    if ((target - position.pixels).abs() < tolerance.distance) return null;
    return ScrollSpringSimulation(Springs.settle, position.pixels, target, velocity, tolerance: tolerance);
  }
}
