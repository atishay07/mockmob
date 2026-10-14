import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import '../logic/sheet_cells.dart';
import 'answered_mark.dart';
import 'runner_motion.dart';
import 'sheet_cell.dart';

/// The palette (spec 5.5, runner.md 4) as the student's own answer sheet: a monumental "14 of 50
/// answered", the shapes of the other states, one key that goes to the first question still
/// without an answer, five columns of 48 dp bubbles that pop in as a wave when it opens, and the
/// submit key (pinned in the sheet's footer when the runner opens it).
class PaletteSheet extends StatelessWidget {
  const PaletteSheet({super.key, required this.cells, required this.onJump, required this.onReview, this.showSubmit = true});

  final List<SheetCell> cells;
  final ValueChanged<int> onJump;
  final VoidCallback onReview;

  /// False when the sheet pins the submit key in its own footer.
  final bool showSubmit;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final counts = sheetCountsOf(cells);
    final firstOpen = cells.indexWhere((c) => !c.answered);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        // The header and legend show the same counts; this sentence is what TalkBack reads.
        Semantics(
          container: true,
          label: RunnerCopy.legendSummary(
            answered: counts.answered,
            notAnswered: counts.notAnswered - counts.notVisited,
            notVisited: counts.notVisited,
            marked: counts.marked,
            total: counts.total,
          ),
          child: ExcludeSemantics(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Align(
                  alignment: Alignment.centerLeft,
                  child: MonumentalNumber(
                    value: '${counts.answered}',
                    unit: RunnerCopy.answeredOf(counts.total),
                    roll: false,
                    style: type.figureCompact.copyWith(fontSize: 40, height: 1),
                    unitColor: colors.ink2,
                  ),
                ),
                const SizedBox(height: MmSpace.s12),
                _Legend(counts: counts, unsynced: cells.where((c) => c.unsynced).length),
              ],
            ),
          ),
        ),
        if (firstOpen >= 0) ...[
          const SizedBox(height: MmSpace.s8),
          // A quiet text key, left on the gutter: the grid and the pinned submit key are the loud
          // things here, this is a shortcut.
          Align(
            alignment: Alignment.centerLeft,
            // The key's own padding is pulled back, so its words start on the gutter with the rest.
            child: Transform.translate(
              offset: const Offset(-MmSpace.s16, 0),
              child: KeyButton.quiet(label: RunnerCopy.goToFirstOpen(firstOpen + 1), onPressed: () => onJump(firstOpen), hapticOnCommit: false),
            ),
          ),
        ],
        const SizedBox(height: MmSpace.s16),
        Divider(height: 1, thickness: 1, color: colors.line),
        const SizedBox(height: MmSpace.s12),
        _CellWave(
          count: cells.length,
          builder: (i) => SheetCellKey(cell: cells[i], onTap: () => onJump(i)),
          columns: 5,
        ),
        // A short paper keeps its key at the foot; a long one gets a pinned footer instead.
        if (showSubmit) ...[
          const SizedBox(height: MmSpace.s16),
          KeyButton(label: RunnerCopy.reviewAndSubmit, onPressed: onReview, hapticOnCommit: false),
        ],
      ],
    );
  }
}

/// The grid of cells, each popping in from 0.84 to full size in cell order when the sheet opens
/// (260 ms each, 10 ms apart, transform only). Under reduced motion it is simply there.
class _CellWave extends StatefulWidget {
  const _CellWave({required this.count, required this.builder, required this.columns});

  final int count;
  final Widget Function(int index) builder;
  final int columns;

  /// The cells that stagger; the rest share the last slot so a long paper still opens in under
  /// half a second.
  static const int maxStagger = 40;

  @override
  State<_CellWave> createState() => _CellWaveState();
}

class _CellWaveState extends State<_CellWave> with SingleTickerProviderStateMixin {
  static const Duration _pop = Duration(milliseconds: 260);
  static const Duration _gap = Duration(milliseconds: 10);

  late final AnimationController _controller = AnimationController(
    vsync: this,
    duration: _pop + _gap * _CellWave.maxStagger,
  );
  bool _started = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_started) return;
    _started = true;
    if (RunnerMotion.reduced(context)) {
      _controller.value = 1;
    } else {
      _controller.forward();
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final total = _controller.duration!.inMicroseconds;
    return Column(
      children: [
        for (var row = 0; row * widget.columns < widget.count; row++)
          Row(
            children: [
              for (var col = 0; col < widget.columns; col++)
                Expanded(
                  child: row * widget.columns + col < widget.count ? _cell(row * widget.columns + col, total) : const SizedBox.shrink(),
                ),
            ],
          ),
      ],
    );
  }

  Widget _cell(int i, int total) {
    final start = (_gap * i.clamp(0, _CellWave.maxStagger)).inMicroseconds / total;
    final interval = Interval(start, (start + _pop.inMicroseconds / total).clamp(0.0, 1.0), curve: Motion.emphasized);
    return AnimatedBuilder(
      animation: _controller,
      child: widget.builder(i),
      builder: (context, child) => Transform.scale(scale: 0.84 + 0.16 * interval.transform(_controller.value), child: child),
    );
  }
}

/// The shapes of the three other states with their counts. "Answered" is the header's number.
class _Legend extends StatelessWidget {
  const _Legend({required this.counts, required this.unsynced});

  final SheetCounts counts;

  /// Answers that exist only on this phone so far; the legend names their dot while there are any.
  final int unsynced;

  @override
  Widget build(BuildContext context) {
    Widget item(SheetCell sample, String label, int count) => _LegendItem(sample: sample, label: label, count: count);
    const base = SheetCell(number: 0, answered: false, visited: true, marked: false, unsynced: false, current: false);
    final seenBlank = counts.notAnswered - counts.notVisited;
    // Only the states that exist: a legend item with a count of zero is noise.
    final items = <Widget>[
      if (seenBlank > 0) item(base, RunnerCopy.notAnswered, seenBlank),
      if (counts.notVisited > 0)
        item(
          const SheetCell(number: 0, answered: false, visited: false, marked: false, unsynced: false, current: false),
          RunnerCopy.notVisited,
          counts.notVisited,
        ),
      if (counts.marked > 0) _FlagLegend(count: counts.marked),
      if (unsynced > 0) _PhoneLegend(count: unsynced),
    ];
    // Four states do not fit one line: two columns, so no item is left alone on a second line.
    if (items.length >= 4) {
      return Column(
        children: [
          for (var i = 0; i < items.length; i += 2)
            Padding(
              padding: EdgeInsets.only(top: i == 0 ? 0 : MmSpace.s8),
              child: Row(
                children: [
                  Expanded(
                    child: Align(alignment: Alignment.centerLeft, child: items[i]),
                  ),
                  Expanded(
                    child: i + 1 < items.length ? Align(alignment: Alignment.centerLeft, child: items[i + 1]) : const SizedBox.shrink(),
                  ),
                ],
              ),
            ),
        ],
      );
    }
    return Wrap(spacing: MmSpace.s16, runSpacing: MmSpace.s8, children: items);
  }
}

/// Every legend glyph is drawn in the same 16 dp box, so the four states read as one set.
const double _legendGlyph = 16;

class _LegendItem extends StatelessWidget {
  const _LegendItem({required this.sample, required this.label, required this.count});

  final SheetCell sample;
  final String label;
  final int count;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        SizedBox.square(
          dimension: _legendGlyph,
          child: CustomPaint(
            painter: _MiniBubble(sample: sample, colors: colors),
          ),
        ),
        const SizedBox(width: MmSpace.s8),
        Text('$label $count', style: type.caption.copyWith(color: colors.ink2)),
      ],
    );
  }
}

class _MiniBubble extends CustomPainter {
  const _MiniBubble({required this.sample, required this.colors});

  final SheetCell sample;
  final MmColors colors;

  @override
  void paint(Canvas canvas, Size size) {
    final c = size.center(Offset.zero);
    final r = size.width / 2 - 1.5;
    final b = BubblePaint(colors);
    if (sample.answered) {
      AnsweredMark.paint(canvas, c, r, colors);
    } else if (sample.visited) {
      b.paint(canvas, c, r, BubbleState.hollow);
    } else {
      canvas.drawCircle(c, r, Paint()..color = colors.sunken);
      b.paint(canvas, c, r, BubbleState.blank);
    }
  }

  @override
  bool shouldRepaint(_MiniBubble old) => old.colors != colors || old.sample != sample;
}

class _FlagIcon extends StatelessWidget {
  const _FlagIcon();

  @override
  Widget build(BuildContext context) => Icon(LucideIcons.flag, size: _legendGlyph, color: context.mmColors.ink);
}

class _FlagLegend extends StatelessWidget {
  const _FlagLegend({required this.count});

  final int count;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        const SizedBox.square(dimension: _legendGlyph, child: _FlagIcon()),
        const SizedBox(width: MmSpace.s8),
        Text('${RunnerCopy.markedShort} $count', style: type.caption.copyWith(color: colors.ink2)),
      ],
    );
  }
}

/// The hollow dot on a bubble: the answer is on this phone and the server does not have it yet.
class _PhoneLegend extends StatelessWidget {
  const _PhoneLegend({required this.count});

  final int count;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        SizedBox.square(
          dimension: _legendGlyph,
          child: CustomPaint(painter: _PhoneDot(colors: colors)),
        ),
        const SizedBox(width: MmSpace.s8),
        Text('${RunnerCopy.onThisPhone} $count', style: type.caption.copyWith(color: colors.ink2)),
      ],
    );
  }
}

class _PhoneDot extends CustomPainter {
  const _PhoneDot({required this.colors});

  final MmColors colors;

  @override
  void paint(Canvas canvas, Size size) {
    final c = size.center(Offset.zero);
    // An answered bubble with the dot at its corner, as it appears in the grid.
    AnsweredMark.paint(canvas, c, size.width / 2 - 2.5, colors);
    SheetCellPainter.paintUnsyncedDot(canvas, c + Offset(size.width * 0.3, size.width * 0.3), colors);
  }

  @override
  bool shouldRepaint(_PhoneDot old) => old.colors != colors;
}
