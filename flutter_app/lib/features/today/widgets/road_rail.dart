// The road to May as a strip of weeks you scroll sideways (L05, app-today-1016 section 8.5): one
// 48 dp column a week from today to the exam, each showing what that week holds. Boards and
// registration run as bands across the top, a planned mock is a small paper mark, the study days
// planned are pips (this week's counted days filled in volt), and the exam's own column carries
// the CUET flag. A tap selects a week and the readout above says it in words. Vertical drags pass
// to the page; the rail claims only horizontal ones.
import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';
import '../copy.dart';
import '../logic/road_weeks.dart';

class RoadRail extends StatefulWidget {
  const RoadRail({
    super.key,
    required this.weeks,
    required this.selected,
    required this.onSelect,
    this.ownDate = false,
    this.onFlag,
    this.controller,
  });

  final List<RoadWeek> weeks;
  final int selected;
  final ValueChanged<int> onSelect;

  /// The exam column is the student's own date ("Your date" on the flag).
  final bool ownDate;

  /// A tap on the exam flag (opens the date sheet).
  final VoidCallback? onFlag;
  final ScrollController? controller;

  static const double column = 48;
  static const double height = 152;

  @override
  State<RoadRail> createState() => _RoadRailState();
}

class _RoadRailState extends State<RoadRail> {
  ScrollController? _own;
  ScrollController get _scroll => widget.controller ?? (_own ??= ScrollController());
  bool _moreRight = true;
  bool _moreLeft = false;

  @override
  void dispose() {
    _own?.dispose();
    super.dispose();
  }

  bool _onScroll(ScrollMetrics m) {
    final right = m.pixels < m.maxScrollExtent - 1;
    final left = m.pixels > 1;
    if (right != _moreRight || left != _moreLeft) {
      setState(() {
        _moreRight = right;
        _moreLeft = left;
      });
    }
    return false;
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final scaler = MediaQuery.textScalerOf(context).clamp(maxScaleFactor: 1.3);
    final extra = (scaler.scale(12) - 12) * 2;
    final weeks = widget.weeks;
    return SizedBox(
      height: RoadRail.height + extra,
      child: MediaQuery(
        data: MediaQuery.of(context).copyWith(textScaler: scaler),
        child: NotificationListener<ScrollMetricsNotification>(
          onNotification: (n) => _onScroll(n.metrics),
          child: NotificationListener<ScrollUpdateNotification>(
            onNotification: (n) => _onScroll(n.metrics),
            child: ShaderMask(
              blendMode: BlendMode.dstIn,
              shaderCallback: (rect) => LinearGradient(
                colors: [
                  _moreLeft ? const Color(0x00000000) : const Color(0xFF000000),
                  const Color(0xFF000000),
                  const Color(0xFF000000),
                  _moreRight ? const Color(0x00000000) : const Color(0xFF000000),
                ],
                stops: [0, 32 / rect.width, 1 - 32 / rect.width, 1],
              ).createShader(rect),
              child: ListView.builder(
                controller: _scroll,
                scrollDirection: Axis.horizontal,
                physics: const ClampingScrollPhysics(),
                itemExtent: RoadRail.column,
                itemCount: weeks.length,
                itemBuilder: (context, i) {
                  final w = weeks[i];
                  final firstOfMonth = i == 0 || weeks[i - 1].start.month != w.start.month;
                  final mockNo = _mockNumberAt(i);
                  return _WeekColumn(
                    key: ValueKey(w.start),
                    week: w,
                    index: i,
                    selected: widget.selected == i,
                    showMonth: firstOfMonth,
                    prevBoards: i > 0 && weeks[i - 1].boards,
                    nextBoards: i + 1 < weeks.length && weeks[i + 1].boards,
                    prevReg: i > 0 && weeks[i - 1].registration,
                    nextReg: i + 1 < weeks.length && weeks[i + 1].registration,
                    ownDate: widget.ownDate,
                    mockNo: mockNo,
                    colors: colors,
                    onTap: () {
                      HapticFeedback.selectionClick();
                      if (w.exam && widget.onFlag != null && widget.selected == i) {
                        widget.onFlag!();
                      } else {
                        widget.onSelect(i);
                      }
                    },
                  );
                },
              ),
            ),
          ),
        ),
      ),
    );
  }

  int? _mockNumberAt(int i) => widget.weeks[i].plannedMocks > 0 ? i : null;
}

class _WeekColumn extends StatelessWidget {
  const _WeekColumn({
    super.key,
    required this.week,
    required this.index,
    required this.selected,
    required this.showMonth,
    required this.prevBoards,
    required this.nextBoards,
    required this.prevReg,
    required this.nextReg,
    required this.ownDate,
    required this.colors,
    required this.onTap,
    this.mockNo,
  });

  final RoadWeek week;
  final int index;
  final bool selected, showMonth, prevBoards, nextBoards, prevReg, nextReg, ownDate;
  final int? mockNo;
  final MmColors colors;
  final VoidCallback onTap;

  static const _months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  @override
  Widget build(BuildContext context) {
    final type = context.mmType;
    final w = week;
    final micro = type.small.copyWith(fontSize: 11, height: 1.1, color: colors.ink3);
    final accent = colors.isNight ? colors.volt : colors.accentText;
    return Semantics(
      button: true,
      selected: selected,
      label: w.exam
          ? (ownDate ? TodayCopy.railOwnDate : TodayCopy.railExam)
          : TodayCopy.railWeekSemantics(w.start, w.planned, w.plannedMocks, index),
      excludeSemantics: true,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: onTap,
        child: Stack(
          clipBehavior: Clip.none,
          children: [
            // The selected week: a ring around its column.
            Positioned(
              left: 2,
              right: 2,
              top: 0,
              bottom: 22,
              child: AnimatedOpacity(
                opacity: selected ? 1 : 0,
                duration: Motion.of(context, const Duration(milliseconds: 160)),
                curve: Motion.out,
                child: DecoratedBox(
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: colors.ink, width: 1.5),
                  ),
                ),
              ),
            ),
            Positioned.fill(
              bottom: 26,
              child: CustomPaint(
                painter: _WeekPainter(
                  week: w,
                  colors: colors,
                  prevBoards: prevBoards,
                  nextBoards: nextBoards,
                  prevReg: prevReg,
                  nextReg: nextReg,
                ),
              ),
            ),
            if (w.exam)
              Positioned(
                left: 2,
                right: 2,
                top: 44,
                child: Container(
                  height: 40,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    color: colors.volt,
                    borderRadius: BorderRadius.circular(10),
                    border: colors.isNight ? null : Border.all(color: colors.ink, width: 1),
                  ),
                  child: Text(
                    ownDate ? 'Your\ndate' : 'CUET\nUG',
                    textAlign: TextAlign.center,
                    style: type.small.copyWith(fontSize: 11, height: 1.1, fontWeight: FontWeight.w700, color: colors.voltInk),
                  ),
                ),
              ),
            // Date and month rows.
            Positioned(
              left: 0,
              right: 0,
              bottom: 0,
              height: 26,
              child: Column(
                children: [
                  Text(
                    w.thisWeek ? TodayCopy.railThisA : '${w.start.day}',
                    style: w.thisWeek ? micro.copyWith(color: accent, fontWeight: FontWeight.w700) : micro,
                  ),
                  Text(
                    w.thisWeek ? TodayCopy.railThisB : (showMonth ? _months[w.start.month - 1] : ''),
                    style: w.thisWeek
                        ? micro.copyWith(color: accent, fontWeight: FontWeight.w700)
                        : micro.copyWith(color: colors.ink2, fontWeight: FontWeight.w600),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Bands (registration lane, boards lane), the planned mock mark and the pips of one week.
class _WeekPainter extends CustomPainter {
  _WeekPainter({
    required this.week,
    required this.colors,
    required this.prevBoards,
    required this.nextBoards,
    required this.prevReg,
    required this.nextReg,
  });

  final RoadWeek week;
  final MmColors colors;
  final bool prevBoards, nextBoards, prevReg, nextReg;

  @override
  void paint(Canvas canvas, Size size) {
    final w = week;
    final cx = size.width / 2;
    void band(double y, bool on, bool joinLeft, bool joinRight, Color color) {
      if (!on) return;
      final left = joinLeft ? 0.0 : 6.0, right = joinRight ? size.width : size.width - 6;
      canvas.drawRRect(
        RRect.fromLTRBR(left, y, right, y + 6, const Radius.circular(3)),
        Paint()..color = color,
      );
    }

    band(4, w.registration, prevReg, nextReg, colors.ink3.withValues(alpha: colors.isNight ? 0.7 : 0.5));
    band(18, w.boards, prevBoards, nextBoards, colors.ink2.withValues(alpha: colors.isNight ? 0.55 : 0.45));

    // Planned mocks: a small paper mark (two stacked when two).
    for (var k = 0; k < w.plannedMocks; k++) {
      final r = RRect.fromRectAndRadius(Rect.fromCenter(center: Offset(cx + k * 3 - (w.plannedMocks - 1) * 1.5, 38 - k * 2), width: 10, height: 12), const Radius.circular(2));
      canvas.drawRRect(r, Paint()..color = colors.raised2);
      canvas.drawRRect(r, Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1.2
        ..color = colors.ink2);
    }

    if (w.exam) return;
    // Pips: bottom-aligned stack, 8 x 8, 2 dp apart.
    const pip = 8.0, gap = 2.0;
    final bottom = size.height - 4;
    final done = w.done ?? 0;
    final count = w.thisWeek ? (w.planned > done ? w.planned : done).clamp(0, 7) : w.planned.clamp(0, 7);
    final planned = colors.ink3.withValues(alpha: colors.isNight ? 0.55 : 0.35);
    if (count == 0) {
      // No goal: one dashed pip says the week is open.
      final r = RRect.fromRectAndRadius(Rect.fromLTWH(cx - pip / 2, bottom - pip, pip, pip), const Radius.circular(2.5));
      canvas.drawRRect(r, Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1
        ..color = colors.ink3);
      return;
    }
    for (var k = 0; k < count; k++) {
      final top = bottom - pip - k * (pip + gap);
      final r = RRect.fromRectAndRadius(Rect.fromLTWH(cx - pip / 2, top, pip, pip), const Radius.circular(2.5));
      final counted = w.thisWeek && k < done;
      if (w.paused) {
        canvas.drawRRect(r, Paint()
          ..style = PaintingStyle.stroke
          ..strokeWidth = 1
          ..color = colors.ink3);
      } else if (counted) {
        canvas.drawRRect(r, Paint()..color = colors.volt);
        if (!colors.isNight) {
          canvas.drawRRect(r, Paint()
            ..style = PaintingStyle.stroke
            ..strokeWidth = 1
            ..color = colors.ink);
        }
      } else {
        canvas.drawRRect(r, Paint()..color = planned);
      }
    }
  }

  @override
  bool shouldRepaint(_WeekPainter old) =>
      old.week.planned != week.planned ||
      old.week.done != week.done ||
      old.week.plannedMocks != week.plannedMocks ||
      old.week.paused != week.paused ||
      old.colors != colors ||
      old.prevBoards != prevBoards ||
      old.nextBoards != nextBoards ||
      old.prevReg != prevReg ||
      old.nextReg != nextReg;
}

/// Study days a week (8.7): seven stops in one 48 dp row; a tap picks one, a horizontal drag
/// slides the pill. [onPreview] runs live while dragging; [onCommit] once on release or tap.
class PaceStrip extends StatefulWidget {
  const PaceStrip({super.key, required this.value, required this.onPreview, required this.onCommit, this.enabled = true, this.semanticsValue});

  /// The selected count, or null when no goal is set (no pill).
  final int? value;
  final ValueChanged<int> onPreview;
  final ValueChanged<int> onCommit;
  final bool enabled;
  final String? semanticsValue;

  @override
  State<PaceStrip> createState() => _PaceStripState();
}

class _PaceStripState extends State<PaceStrip> {
  int? _drag;
  Timer? _tapCommit;

  @override
  void dispose() {
    _tapCommit?.cancel();
    super.dispose();
  }

  int _stopAt(double x, double width) => ((x / (width / 7)).floor() + 1).clamp(1, 7);

  void _preview(int n) {
    if (n == (_drag ?? widget.value)) return;
    HapticFeedback.selectionClick();
    setState(() => _drag = n);
    widget.onPreview(n);
  }

  void _commit() {
    final n = _drag;
    if (n == null) return;
    setState(() => _drag = null);
    if (n != widget.value) widget.onCommit(n);
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final shown = _drag ?? widget.value;
    final enabled = widget.enabled;
    return Semantics(
      slider: true,
      label: TodayCopy.paceTitle,
      value: widget.semanticsValue ?? (shown == null ? '' : '$shown'),
      increasedValue: shown == null || shown >= 7 ? null : '${shown + 1}',
      decreasedValue: shown == null || shown <= 1 ? null : '${shown - 1}',
      onIncrease: !enabled || shown == null || shown >= 7 ? null : () => widget.onCommit(shown + 1),
      onDecrease: !enabled || shown == null || shown <= 1 ? null : () => widget.onCommit(shown - 1),
      excludeSemantics: true,
      child: LayoutBuilder(
        builder: (context, box) {
          final width = box.maxWidth;
          final stop = width / 7;
          return GestureDetector(
            behavior: HitTestBehavior.opaque,
            onTapUp: !enabled
                ? null
                : (d) {
                    _preview(_stopAt(d.localPosition.dx, width));
                    _tapCommit?.cancel();
                    _tapCommit = Timer(const Duration(milliseconds: 400), _commit);
                  },
            onHorizontalDragStart: !enabled ? null : (d) => _preview(_stopAt(d.localPosition.dx, width)),
            onHorizontalDragUpdate: !enabled ? null : (d) => _preview(_stopAt(d.localPosition.dx, width)),
            onHorizontalDragEnd: !enabled ? null : (_) => _commit(),
            onHorizontalDragCancel: !enabled ? null : _commit,
            child: SizedBox(
              height: 48,
              child: Stack(
                children: [
                  Positioned.fill(
                    child: DecoratedBox(
                      decoration: BoxDecoration(color: colors.raised, borderRadius: BorderRadius.circular(24)),
                    ),
                  ),
                  if (shown != null && enabled)
                    AnimatedPositioned(
                      duration: Motion.of(context, const Duration(milliseconds: 220)),
                      curve: Motion.out,
                      left: (shown - 1) * stop + (stop - 44) / 2,
                      top: 4,
                      width: 44,
                      height: 40,
                      child: DecoratedBox(
                        decoration: BoxDecoration(
                          color: colors.volt,
                          borderRadius: BorderRadius.circular(20),
                          border: colors.isNight ? null : Border.all(color: colors.ink, width: 1),
                        ),
                      ),
                    ),
                  Row(
                    children: [
                      for (var n = 1; n <= 7; n++)
                        Expanded(
                          child: Center(
                            child: Text(
                              '$n',
                              style: type.labelLarge.copyWith(
                                color: n == shown && enabled ? colors.voltInk : colors.ink3,
                                fontWeight: n == shown ? FontWeight.w700 : FontWeight.w500,
                                fontFeatures: const [FontFeature.tabularFigures()],
                              ),
                            ),
                          ),
                        ),
                    ],
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }
}
