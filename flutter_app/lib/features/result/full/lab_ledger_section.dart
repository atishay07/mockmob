import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/haptics/haptics.dart';
import '../../../core/models/models.dart';
import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../../insights/widgets/motion_bits.dart' show WhenInView;
import '../copy.dart';

/// "Mistake Lab" on the full result (Mistake Lab v4 slice 1, spec 4.1 to 4.3): the marks ledger.
///
/// One glance answers "where did my marks go, and what do I do": the heading, the headline when
/// one group stands out, one bar split into the ways the marks were lost (they add up to the
/// marks missed), a row per group that opens to its one thing to do and its questions, the same
/// paper re-marked with the first picks, and the questions most other students got right. Every
/// sentence is the server's (`attempt.lab`), the same words as the website.
///
/// Motion: the first time an attempt's ledger comes into view in this app run, the bar starts as
/// one neutral "missed" block and splits into its groups left to right (each segment 180 ms on the
/// ease-out curve, 60 ms apart), and each row fades in 150 ms after its segment. Opening a row
/// dims the other segments to 40% and lifts its own by 2 dp. Under reduced motion the ledger is
/// at rest at once and only the dimming remains.
class LabLedgerSection extends StatefulWidget {
  const LabLedgerSection({super.key, required this.attemptId, required this.lab, required this.onOpenQuestion, this.onSeeChanges, this.onSeeInReplay});

  final String attemptId;
  final MistakeLab lab;

  /// A "Q17" chip: open that answer (the screen's `_openFromMap`).
  final ValueChanged<int> onOpenQuestion;

  /// "See every change": scrolls to "Every answer you changed" in Time and decisions. Null hides
  /// it (no Time and decisions section on this result).
  final VoidCallback? onSeeChanges;

  /// "See it in the replay" on an opened row (slice 2): opens the Replay with that group's chip on.
  /// Shown only for groups the replay has a chip for; null hides it (no replay on this result).
  final ValueChanged<String>? onSeeInReplay;

  /// Forgets which attempts have played their split (tests only).
  @visibleForTesting
  static void debugResetSeen() => _LabLedgerSectionState._seen.clear();

  /// The timings of the split (spec 4.1), shared with the tests.
  static const Duration lead = Duration(milliseconds: 120);
  static const Duration segment = Duration(milliseconds: 180);
  static const Duration segmentStep = Duration(milliseconds: 60);
  static const Duration rowDelay = Duration(milliseconds: 150);
  static const Duration rowFade = Duration(milliseconds: 150);
  static const Duration focus = Duration(milliseconds: 150);

  /// Questions shown in a row before "Show {k} more".
  static const int chipsShown = 8;

  /// The length of the whole split for [segments] groups.
  static Duration splitLength(int segments) =>
      lead + segmentStep * math.max(0, segments - 1) + (rowDelay + rowFade > segment ? rowDelay + rowFade : segment);

  @override
  State<LabLedgerSection> createState() => _LabLedgerSectionState();
}

class _LabLedgerSectionState extends State<LabLedgerSection> with TickerProviderStateMixin {
  /// Attempts whose split has played, for the life of the app run.
  static final Set<String> _seen = {};

  late final AnimationController _split;
  late final AnimationController _focus;
  final Set<String> _open = {};
  final Set<String> _allChips = {};
  String? _focused;
  bool _decided = false;

  List<LabGroup> get _groups => [for (final g in widget.lab.groups) if (g.marks > 0) g];

  @override
  void initState() {
    super.initState();
    _split = AnimationController(vsync: this, duration: LabLedgerSection.splitLength(_groups.length), value: 1);
    _focus = AnimationController(vsync: this, duration: LabLedgerSection.focus);
    for (final g in widget.lab.groups) {
      if (g.open) _open.add(g.id);
    }
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_decided) return;
    _decided = true;
    // Unseen and motion allowed: hold the neutral block until the ledger is in view.
    if (!_seen.contains(widget.attemptId) && !Motion.reduced(context)) _split.value = 0;
  }

  @override
  void didUpdateWidget(LabLedgerSection old) {
    super.didUpdateWidget(old);
    // A re-read with a different number of groups: the split's length follows it.
    _split.duration = LabLedgerSection.splitLength(_groups.length);
    if (_focused != null && !_groups.any((g) => g.id == _focused)) {
      _focused = null;
      _focus.value = 0;
    }
  }

  @override
  void dispose() {
    _split.dispose();
    _focus.dispose();
    super.dispose();
  }

  void _onVisible() {
    if (!mounted || _split.value >= 1) return;
    if (!_seen.add(widget.attemptId) || Motion.reduced(context)) {
      _split.value = 1;
      return;
    }
    unawaited(_split.forward(from: 0));
  }

  /// Opens or closes [id]'s row; an opened row takes the bar's focus.
  void _toggle(String id) {
    final opening = !_open.contains(id);
    setState(() {
      if (opening) {
        _open.add(id);
        _focused = id;
      } else {
        _open.remove(id);
        if (_focused == id) _focused = null;
      }
    });
    _moveFocus();
  }

  void _moveFocus() {
    final target = _focused == null ? 0.0 : 1.0;
    if (Motion.reduced(context)) {
      _focus.value = target;
    } else {
      unawaited(_focus.animateTo(target, curve: Motion.out));
    }
  }

  /// A tap on the bar opens the row of the segment under the finger.
  void _tapBar(int index) {
    final groups = _groups;
    if (index < 0 || index >= groups.length) return;
    unawaited(hapticsOf(context)?.segmentTick());
    final id = groups[index].id;
    if (_open.contains(id) && _focused != id) {
      setState(() => _focused = id);
      _moveFocus();
      return;
    }
    _toggle(id);
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final lab = widget.lab;
    final groups = _groups;
    final styles = [for (final g in groups) LabSwatchStyle.of(g.id, colors)];
    final focusIndex = _focused == null ? null : groups.indexWhere((g) => g.id == _focused);
    final total = LabLedgerSection.splitLength(groups.length).inMicroseconds;

    Animation<double> rowArrival(int i) {
      final start = (LabLedgerSection.lead + LabLedgerSection.segmentStep * i + LabLedgerSection.rowDelay).inMicroseconds / total;
      final end = start + LabLedgerSection.rowFade.inMicroseconds / total;
      // `drive` listens to the controller only while the row listens, so a rebuild leaves nothing behind.
      return _split.drive(CurveTween(curve: Interval(start.clamp(0.0, 1.0), end.clamp(0.0, 1.0), curve: Motion.out)));
    }

    final headlineIndex = lab.headline == null ? -1 : groups.indexWhere((g) => g.id == lab.headline!.group);
    final fine = type.small.copyWith(color: colors.ink3);
    final cohort = lab.cohort;
    final remark = lab.remark;

    return MmSection(
      title: lab.labels.name,
      child: WhenInView(
        onVisible: _onVisible,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(lab.heading, style: type.subhead.copyWith(fontSize: 19, height: 25 / 19, letterSpacing: -0.4)),
            if (lab.headline != null) ...[
              const SizedBox(height: MmSpace.s12),
              _Headline(text: lab.headline!.text, style: headlineIndex < 0 ? null : styles[headlineIndex]),
            ],
            const SizedBox(height: MmSpace.s16),
            _LedgerBar(
              groups: groups,
              styles: styles,
              split: _split,
              focus: _focus,
              focusIndex: focusIndex,
              semanticsLabel: lab.barLabel,
              onTap: _tapBar,
            ),
            const SizedBox(height: MmSpace.s12),
            for (var i = 0; i < groups.length; i++) ...[
              if (i > 0) const SizedBox(height: MmSpace.s8),
              _Arrive(
                animation: rowArrival(i),
                child: _LegendRow(
                  group: groups[i],
                  style: styles[i],
                  open: _open.contains(groups[i].id),
                  focused: _focused == groups[i].id,
                  allChips: _allChips.contains(groups[i].id),
                  showMore: lab.labels.showMoreFor,
                  onToggle: () => _toggle(groups[i].id),
                  onShowAll: () => setState(() => _allChips.add(groups[i].id)),
                  onOpenQuestion: widget.onOpenQuestion,
                  seeInReplay: lab.replay?.labels.seeInReplay,
                  onSeeInReplay: widget.onSeeInReplay != null && (lab.replay?.chips.any((c) => c.id == groups[i].id) ?? false)
                      ? () => widget.onSeeInReplay!(groups[i].id)
                      : null,
                ),
              ),
            ],
            if (remark != null) ...[
              const SizedBox(height: MmSpace.s20),
              MmSurface.inset(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(remark.text, style: type.body.copyWith(fontWeight: FontWeight.w500, fontFeatures: const [FontFeature.tabularFigures()])),
                    if (remark.fine != null) ...[const SizedBox(height: MmSpace.s4), Text(remark.fine!, style: fine)],
                    if (widget.onSeeChanges != null) _TextAction(label: lab.labels.seeChanges, onTap: widget.onSeeChanges!),
                  ],
                ),
              ),
            ],
            if (cohort?.line != null) ...[
              const SizedBox(height: MmSpace.s20),
              Text(cohort!.line!, style: type.body),
              if (cohort.numbers.isNotEmpty) ...[
                const SizedBox(height: MmSpace.s4),
                _Chips(numbers: cohort.numbers, onOpenQuestion: widget.onOpenQuestion),
              ],
            ],
            if (lab.fine.isNotEmpty || (cohort?.fine.isNotEmpty ?? false)) const SizedBox(height: MmSpace.s16),
            for (final line in [...lab.fine, ...?cohort?.fine]) ...[
              Text(line, style: fine),
              const SizedBox(height: MmSpace.s4),
            ],
          ],
        ),
      ),
    );
  }
}

/// The headline, with a short rule in its group's colour so it reads as the bar's biggest part.
class _Headline extends StatelessWidget {
  const _Headline({required this.text, this.style});

  final String text;
  final LabSwatchStyle? style;

  @override
  Widget build(BuildContext context) {
    final type = context.mmType;
    final s = style;
    return IntrinsicHeight(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (s != null) ...[
            ExcludeSemantics(
              child: SizedBox(
                width: 4,
                child: CustomPaint(painter: _SwatchPainter(style: s, radius: 2)),
              ),
            ),
            const SizedBox(width: MmSpace.s12),
          ],
          Expanded(child: Text(text, style: type.body)),
        ],
      ),
    );
  }
}

/// Fades and rises a legend row in with its segment.
class _Arrive extends StatelessWidget {
  const _Arrive({required this.animation, required this.child});

  final Animation<double> animation;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: animation,
      child: child,
      builder: (context, child) {
        final t = animation.value;
        if (t >= 1) return child!;
        return Opacity(opacity: t, child: Transform.translate(offset: Offset(0, 4 * (1 - t)), child: child));
      },
    );
  }
}

/// How one group is drawn: its fill, and the pattern that tells it apart without colour.
@immutable
class LabSwatchStyle {
  const LabSwatchStyle({required this.fill, this.pattern = LabPattern.solid, this.ink = const Color(0x00000000)});

  final Color fill;
  final LabPattern pattern;

  /// The pattern's colour.
  final Color ink;

  /// The style of group [id] in [colors]' theme: amber for right then changed, cross-hatched amber
  /// for crossed out the key (slice 2), hatched grey for
  /// never opened, striped coral for long stays, solid coral for quick wrong, deep coral for other
  /// wrong answers, plain grey for opened blanks, dotted line colour for held (spec 4.1).
  static LabSwatchStyle of(String id, MmColors colors) {
    final night = colors.isNight;
    final coral = night ? colors.badText : const Color(0xFFE06A58);
    final deep = night ? const Color(0xFFC9604F) : colors.wrongBorder;
    return switch (id) {
      LabGroup.changedFromRight => LabSwatchStyle(fill: night ? colors.warnText : const Color(0xFFB97C10)),
      // Crossed out the key: the same amber as a changed answer (both are a decision about an
      // option), crossed both ways like the strike itself.
      LabGroup.struckKey => LabSwatchStyle(
          fill: night ? const Color(0xFFB98A3A) : const Color(0xFF9A6A12),
          pattern: LabPattern.cross,
          ink: night ? const Color(0x6612110E) : const Color(0x8CFFFDF8),
        ),
      LabGroup.neverOpened => LabSwatchStyle(
          fill: night ? const Color(0xFF5D584F) : const Color(0xFF9C9485),
          pattern: LabPattern.hatch,
          ink: night ? const Color(0x47F4F0E6) : const Color(0x66FFFDF8),
        ),
      LabGroup.longStay => LabSwatchStyle(
          fill: coral,
          pattern: LabPattern.stripe,
          ink: night ? const Color(0x7312110E) : const Color(0x5917150F),
        ),
      LabGroup.quickWrong => LabSwatchStyle(fill: coral),
      LabGroup.otherWrong || LabGroup.wrong => LabSwatchStyle(fill: deep),
      LabGroup.otherBlank || LabGroup.blank => LabSwatchStyle(fill: night ? colors.ink3 : colors.ink4),
      LabGroup.held => LabSwatchStyle(fill: colors.lineStrong, pattern: LabPattern.dots, ink: colors.ink3),
      _ => LabSwatchStyle(fill: colors.ink4),
    };
  }

  @override
  bool operator ==(Object other) => other is LabSwatchStyle && other.fill == fill && other.pattern == pattern && other.ink == ink;

  @override
  int get hashCode => Object.hash(fill, pattern, ink);
}

enum LabPattern { solid, hatch, stripe, dots, cross }

/// Paints [style]'s pattern over [rect] (already clipped by the caller).
void _paintPattern(Canvas canvas, Rect rect, LabSwatchStyle style, double strength) {
  if (style.pattern == LabPattern.solid || strength <= 0) return;
  final ink = style.ink.withValues(alpha: style.ink.a * strength);
  switch (style.pattern) {
    case LabPattern.hatch:
    case LabPattern.stripe:
      // Lines at 135 degrees: from the bottom edge up to the right.
      final period = style.pattern == LabPattern.hatch ? 6.0 : 5.0;
      final paint = Paint()
        ..color = ink
        ..strokeWidth = 2
        ..isAntiAlias = true;
      final h = rect.height;
      for (var x = rect.left - h; x < rect.right + h; x += period) {
        canvas.drawLine(Offset(x, rect.bottom), Offset(x + h, rect.top), paint);
      }
    case LabPattern.cross:
      // Both diagonals, like a struck-out option.
      final paint = Paint()
        ..color = ink
        ..strokeWidth = 1.5
        ..isAntiAlias = true;
      final h = rect.height;
      for (var x = rect.left - h; x < rect.right + h; x += 7) {
        canvas.drawLine(Offset(x, rect.bottom), Offset(x + h, rect.top), paint);
        canvas.drawLine(Offset(x, rect.top), Offset(x + h, rect.bottom), paint);
      }
    case LabPattern.dots:
      final paint = Paint()..color = ink;
      final y = rect.center.dy;
      for (var x = rect.left + 3; x < rect.right - 1; x += 4) {
        canvas.drawCircle(Offset(x, y), 1, paint);
      }
    case LabPattern.solid:
      break;
  }
}

/// A legend swatch, or the headline's rule: one group's fill and pattern.
class _SwatchPainter extends CustomPainter {
  const _SwatchPainter({required this.style, this.radius = 4});

  final LabSwatchStyle style;
  final double radius;

  @override
  void paint(Canvas canvas, Size size) {
    final rect = Offset.zero & size;
    final rrect = RRect.fromRectAndRadius(rect, Radius.circular(radius));
    canvas.drawRRect(rrect, Paint()..color = style.fill);
    canvas.save();
    canvas.clipRRect(rrect);
    _paintPattern(canvas, rect, style, 1);
    canvas.restore();
  }

  @override
  bool shouldRepaint(_SwatchPainter old) => old.style != style || old.radius != radius;
}

/// The bar: 12 dp tall, segments in group order with 2 dp gaps, widths by marks, thin ticks
/// between a segment's questions. It sits in a 32 dp band that takes the taps.
class _LedgerBar extends StatelessWidget {
  const _LedgerBar({
    required this.groups,
    required this.styles,
    required this.split,
    required this.focus,
    required this.focusIndex,
    required this.semanticsLabel,
    required this.onTap,
  });

  final List<LabGroup> groups;
  final List<LabSwatchStyle> styles;
  final Animation<double> split;
  final Animation<double> focus;
  final int? focusIndex;
  final String? semanticsLabel;
  final ValueChanged<int> onTap;

  static const double band = 32;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final painter = LedgerBarPainter(
      marks: [for (final g in groups) g.marks],
      counts: [for (final g in groups) g.count],
      styles: styles,
      neutral: colors.ink4,
      tick: colors.ground.withValues(alpha: 0.75),
      split: split,
      focus: focus,
      focusIndex: focusIndex,
      lift: !Motion.reduced(context),
      segments: groups.length,
    );
    return Semantics(
      container: true,
      image: true,
      label: semanticsLabel,
      excludeSemantics: true,
      child: LayoutBuilder(
        builder: (context, box) => GestureDetector(
          behavior: HitTestBehavior.opaque,
          excludeFromSemantics: true,
          onTapUp: (d) => onTap(painter.indexAt(d.localPosition.dx, box.maxWidth)),
          child: SizedBox(
            height: band,
            width: double.infinity,
            child: Center(
              child: RepaintBoundary(
                child: SizedBox(
                  height: LedgerBarPainter.height,
                  width: double.infinity,
                  child: CustomPaint(painter: painter),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// Paints the ledger bar from [split] (the whole split timeline, 0 to 1) and [focus] (0 to 1
/// towards the focused segment). Public for its own geometry tests.
class LedgerBarPainter extends CustomPainter {
  LedgerBarPainter({
    required this.marks,
    required this.counts,
    required this.styles,
    required this.neutral,
    required this.tick,
    required this.split,
    required this.focus,
    required this.focusIndex,
    required this.lift,
    required this.segments,
  }) : super(repaint: Listenable.merge([split, focus]));

  final List<int> marks;
  final List<int> counts;
  final List<LabSwatchStyle> styles;
  final Color neutral;
  final Color tick;
  final Animation<double> split;
  final Animation<double> focus;
  final int? focusIndex;
  final bool lift;
  final int segments;

  /// The painted height: the 12 dp bar with 2 dp above and below for the lift.
  static const double height = 16;
  static const double barHeight = 12;
  static const double gap = 2;
  static const double minWidth = 6;
  static const double dimTo = 0.4;
  static const double liftBy = 2;

  /// How far segment [i] has split, 0 to 1, eased.
  double progressOf(int i) {
    final total = LabLedgerSection.splitLength(segments).inMicroseconds;
    final now = split.value * total;
    final start = (LabLedgerSection.lead + LabLedgerSection.segmentStep * i).inMicroseconds;
    final t = ((now - start) / LabLedgerSection.segment.inMicroseconds).clamp(0.0, 1.0);
    return Motion.out.transform(t);
  }

  /// Segment widths for [width], each at least [minWidth], gaps opened by [gapOf].
  List<double> widths(double width, double Function(int) gapOf) {
    final n = marks.length;
    if (n == 0) return const [];
    var gaps = 0.0;
    for (var i = 1; i < n; i++) {
      gaps += gapOf(i);
    }
    final avail = math.max(0.0, width - gaps);
    final total = marks.fold<int>(0, (s, m) => s + m);
    if (total <= 0) return List.filled(n, avail / n);
    final w = [for (final m in marks) avail * m / total];
    // Lift the slivers to the least width, taking the room from the wider segments in proportion.
    final small = [for (var i = 0; i < n; i++) w[i] < minWidth];
    final need = [for (var i = 0; i < n; i++) small[i] ? minWidth - w[i] : 0.0].fold<double>(0, (s, d) => s + d);
    if (need > 0) {
      final spare = [for (var i = 0; i < n; i++) small[i] ? 0.0 : w[i] - minWidth].fold<double>(0, (s, d) => s + d);
      if (spare > need) {
        for (var i = 0; i < n; i++) {
          w[i] = small[i] ? minWidth : w[i] - (w[i] - minWidth) * need / spare;
        }
      }
    }
    return w;
  }

  /// The segment under [dx] in a bar [width] wide (at rest).
  int indexAt(double dx, double width) {
    final w = widths(width, (_) => gap);
    var x = 0.0;
    for (var i = 0; i < w.length; i++) {
      x += w[i] + (i > 0 ? gap : 0);
      if (dx <= x + gap / 2) return i;
    }
    return w.length - 1;
  }

  @override
  void paint(Canvas canvas, Size size) {
    final n = marks.length;
    if (n == 0) return;
    final p = [for (var i = 0; i < n; i++) progressOf(i)];
    final w = widths(size.width, (i) => gap * p[i]);
    final f = focus.value.clamp(0.0, 1.0);
    const top = (height - barHeight) / 2;
    const end = Radius.circular(barHeight / 2);
    var x = 0.0;
    for (var i = 0; i < n; i++) {
      if (i > 0) x += gap * p[i];
      final style = styles[i];
      final focused = focusIndex == i;
      final dim = focusIndex == null || focused ? 1.0 : 1 - (1 - dimTo) * f;
      final dy = focused && lift ? -liftBy * f : 0.0;
      final rect = Rect.fromLTWH(x, top + dy, w[i], barHeight);
      // The inner corners round as the gaps open, so the neutral block reads as one piece.
      final leftR = i == 0 ? end : Radius.circular(2 * p[i]);
      final rightR = i == n - 1 ? end : Radius.circular(2 * p[i + 1]);
      final rrect = RRect.fromRectAndCorners(rect, topLeft: leftR, bottomLeft: leftR, topRight: rightR, bottomRight: rightR);
      final fill = Color.lerp(neutral, style.fill, p[i])!;
      canvas.drawRRect(rrect, Paint()..color = fill.withValues(alpha: fill.a * dim));
      canvas.save();
      canvas.clipRRect(rrect);
      _paintPattern(canvas, rect, style, p[i] * dim);
      // Ticks between the segment's questions, where they have room.
      final count = counts[i];
      if (count > 1 && w[i] / count >= 5) {
        final paint = Paint()
          ..color = tick.withValues(alpha: tick.a * p[i] * dim)
          ..strokeWidth = 1.5;
        for (var k = 1; k < count; k++) {
          final tx = rect.left + rect.width * k / count;
          canvas.drawLine(Offset(tx, rect.top), Offset(tx, rect.bottom), paint);
        }
      }
      canvas.restore();
      x += w[i];
    }
  }

  @override
  bool shouldRepaint(LedgerBarPainter old) =>
      old.focusIndex != focusIndex ||
      old.lift != lift ||
      old.neutral != neutral ||
      old.tick != tick ||
      !_same(old.marks, marks) ||
      !_same(old.counts, counts) ||
      !_same(old.styles, styles);

  static bool _same<T>(List<T> a, List<T> b) {
    if (a.length != b.length) return false;
    for (var i = 0; i < a.length; i++) {
      if (a[i] != b[i]) return false;
    }
    return true;
  }
}

/// One group: swatch, label, "12 marks on 2 questions" and a disclosure. Open, it shows the one
/// thing to do and the questions as chips.
class _LegendRow extends StatelessWidget {
  const _LegendRow({
    required this.group,
    required this.style,
    required this.open,
    required this.focused,
    required this.allChips,
    required this.showMore,
    required this.onToggle,
    required this.onShowAll,
    required this.onOpenQuestion,
    this.seeInReplay,
    this.onSeeInReplay,
  });

  final LabGroup group;
  final LabSwatchStyle style;
  final bool open;
  final bool focused;
  final bool allChips;
  final String Function(int) showMore;
  final VoidCallback onToggle;
  final VoidCallback onShowAll;
  final ValueChanged<int> onOpenQuestion;
  final String? seeInReplay;
  final VoidCallback? onSeeInReplay;

  /// Left edge of the open panel: the row's padding, the swatch and its gap, so the do line sits
  /// under the label.
  static const double _indent = MmSpace.s12 + 14 + MmSpace.s12;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final numbers = group.numbers;
    final folded = !allChips && numbers.length > LabLedgerSection.chipsShown + 1;
    final shown = folded ? numbers.take(LabLedgerSection.chipsShown).toList() : numbers;
    return AnimatedContainer(
      duration: Motion.of(context, Motion.ui),
      curve: Motion.out,
      decoration: ShapeDecoration(
        color: open ? colors.selectedSurface : colors.raised,
        shape: RoundedSuperellipseBorder(
          borderRadius: MmRadius.smallAll,
          side: BorderSide(color: open || focused ? colors.lineStrong : colors.line),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          MmPressable(
            onTap: onToggle,
            pressedScale: 0.99,
            focusRadius: MmRadius.smallAll,
            haptic: MmPressHaptic.selection,
            highlight: true,
            selected: open,
            semanticsLabel: '${group.label}, ${group.line}',
            builder: (context, pressed, _) => ConstrainedBox(
              constraints: const BoxConstraints(minHeight: MmTarget.min),
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: MmSpace.s12, vertical: 10),
                child: Row(
                  children: [
                    SizedBox.square(dimension: 14, child: CustomPaint(painter: _SwatchPainter(style: style))),
                    const SizedBox(width: MmSpace.s12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(group.label, style: type.subhead.copyWith(fontSize: 15, height: 20 / 15)),
                          const SizedBox(height: MmSpace.s2),
                          Text(group.line, style: type.small.copyWith(color: colors.ink2, fontFeatures: const [FontFeature.tabularFigures()])),
                        ],
                      ),
                    ),
                    const SizedBox(width: MmSpace.s8),
                    AnimatedRotation(
                      turns: open ? 0.5 : 0,
                      duration: Motion.of(context, Motion.ui),
                      curve: Motion.out,
                      child: Icon(LucideIcons.chevronDown, size: 20, color: colors.ink3),
                    ),
                  ],
                ),
              ),
            ),
          ),
          MmSizeEase(
            duration: Motion.of(context, Motion.card),
            curve: Motion.out,
            alignment: Alignment.topCenter,
            child: !open
                ? const SizedBox(width: double.infinity)
                : Padding(
                    padding: const EdgeInsets.fromLTRB(_indent, 0, MmSpace.s12, MmSpace.s12),
                    child: MmEntrance(
                      rise: 4,
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          if (group.doLine != null) Text(group.doLine!, style: type.body.copyWith(color: colors.ink2, fontSize: 15, height: 22 / 15)),
                          if (shown.isNotEmpty) ...[
                            if (group.doLine != null) const SizedBox(height: MmSpace.s4),
                            _Chips(
                              numbers: shown,
                              onOpenQuestion: onOpenQuestion,
                              more: folded ? showMore(numbers.length - shown.length) : null,
                              onMore: folded ? onShowAll : null,
                            ),
                          ],
                          if (onSeeInReplay != null && seeInReplay != null) _TextAction(label: seeInReplay!, onTap: onSeeInReplay!),
                        ],
                      ),
                    ),
                  ),
          ),
        ],
      ),
    );
  }
}

/// Question chips ("Q17"), each opening its answer; with [more], a last chip that shows the rest.
/// Each chip is 40 dp tall inside a 48 dp target.
class _Chips extends StatelessWidget {
  const _Chips({required this.numbers, required this.onOpenQuestion, this.more, this.onMore});

  final List<int> numbers;
  final ValueChanged<int> onOpenQuestion;
  final String? more;
  final VoidCallback? onMore;

  @override
  Widget build(BuildContext context) {
    return Wrap(
      spacing: MmSpace.s4,
      children: [
        for (final n in numbers)
          _Chip(label: ResultCopy.labQuestionChip(n), semanticsLabel: ResultCopy.labGoToQuestion(n), onTap: () => onOpenQuestion(n)),
        if (more != null && onMore != null) _Chip(label: more!, onTap: onMore!, quiet: true),
      ],
    );
  }
}

class _Chip extends StatelessWidget {
  const _Chip({required this.label, required this.onTap, this.semanticsLabel, this.quiet = false});

  final String label;
  final String? semanticsLabel;
  final VoidCallback onTap;
  final bool quiet;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return MmPressable(
      onTap: onTap,
      focusRadius: MmRadius.smallAll,
      haptic: MmPressHaptic.selection,
      semanticsLabel: semanticsLabel ?? label,
      builder: (context, pressed, _) => Padding(
        padding: const EdgeInsets.symmetric(vertical: MmSpace.s4, horizontal: MmSpace.s2),
        child: DecoratedBox(
          decoration: quiet
              ? const BoxDecoration()
              : ShapeDecoration(
                  color: pressed ? colors.raised2 : colors.sunken,
                  shape: RoundedSuperellipseBorder(borderRadius: MmRadius.smallAll, side: BorderSide(color: colors.lineStrong)),
                ),
          child: ConstrainedBox(
            constraints: const BoxConstraints(minHeight: 40, minWidth: 52),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: MmSpace.s12),
              child: Center(
                widthFactor: 1,
                heightFactor: 1,
                child: Text(
                  label,
                  style: (quiet
                          ? type.small.copyWith(fontWeight: FontWeight.w600, decoration: TextDecoration.underline, decorationColor: colors.lineStrong)
                          : type.label.copyWith(fontSize: 14))
                      .copyWith(color: colors.ink, fontFeatures: const [FontFeature.tabularFigures()]),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// A plain text action, 48 dp tall and flush with the text above it ("See every change").
class _TextAction extends StatelessWidget {
  const _TextAction({required this.label, required this.onTap});

  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    return Align(
      alignment: Alignment.centerLeft,
      child: MmPressable(
        onTap: onTap,
        semanticsLabel: label,
        focusRadius: MmRadius.smallAll,
        haptic: MmPressHaptic.selection,
        builder: (context, pressed, _) => ConstrainedBox(
          constraints: const BoxConstraints(minHeight: MmTarget.min),
          child: Align(
            alignment: Alignment.centerLeft,
            widthFactor: 1,
            child: Text(
              label,
              style: context.mmType.labelLarge.copyWith(
                color: pressed ? colors.ink2 : colors.ink,
                fontWeight: FontWeight.w600,
                decoration: TextDecoration.underline,
                decorationColor: colors.lineStrong,
              ),
            ),
          ),
        ),
      ),
    );
  }
}
