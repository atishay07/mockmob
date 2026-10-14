import 'dart:async';

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
/// answered" that rolls when it changes, the shapes of the other states (each a filter key: the
/// other cells dim to 30% and the matches get a ring), one key that goes to the first question
/// still without an answer (or, with a filter, walks through the matches), five columns of 48 dp
/// bubbles that pop in as a wave when it opens, and the submit key (pinned in the sheet's footer
/// when the runner opens it). With [showMobi] Mobi's head sits by the count: he glances at the
/// first open cell, or nods when none is open.
class PaletteSheet extends StatefulWidget {
  const PaletteSheet({
    super.key,
    required this.cells,
    required this.onJump,
    required this.onReview,
    this.showSubmit = true,
    this.filter,
    this.onFilter,
    this.showMobi = false,
  });

  final List<SheetCell> cells;
  final ValueChanged<int> onJump;
  final VoidCallback onReview;

  /// False when the sheet pins the submit key in its own footer.
  final bool showSubmit;

  /// The legend filter in force, or null for none.
  final SheetFilter? filter;

  /// A legend key tapped: the filter to apply (null turns it off). Null: the legend is not a key.
  final ValueChanged<SheetFilter?>? onFilter;

  /// Mobi's 56 dp head by the count (off under Celebrations Off).
  final bool showMobi;

  /// Mobi's head.
  static const double mobiSize = 56;

  @override
  State<PaletteSheet> createState() => _PaletteSheetState();
}

class _PaletteSheetState extends State<PaletteSheet> {
  final MobiController _mobi = MobiController();
  final GlobalKey _firstOpenKey = GlobalKey();
  Timer? _look;

  @override
  void initState() {
    super.initState();
    if (!widget.showMobi) return;
    // Once the wave of cells has landed: a glance at the first open cell, or a nod for a full sheet.
    _look = Timer(const Duration(milliseconds: 700), () {
      if (!mounted) return;
      if (widget.cells.any((c) => !c.answered)) {
        _mobi.glanceAtWidget(_firstOpenKey, hold: const Duration(milliseconds: 1400));
      } else {
        _mobi.react(MobiAct.nod, key: 'palette:allAnswered');
      }
    });
  }

  @override
  void dispose() {
    _look?.cancel();
    _mobi.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final cells = widget.cells;
    final filter = widget.filter;
    final onJump = widget.onJump;
    final counts = sheetCountsOf(cells);
    final firstOpen = cells.indexWhere((c) => !c.answered);
    final current = cells.indexWhere((c) => c.current);
    // With a filter the key walks through its matches from the question on show.
    final target = filter == null ? firstOpen : nextSheetMatch(cells, filter, current < 0 ? -1 : current);
    final number = MonumentalNumber(
      value: '${counts.answered}',
      unit: RunnerCopy.answeredOf(counts.total),
      roll: true,
      fromZeroOnFirstBuild: false,
      style: type.figureCompact.copyWith(fontSize: 40, height: 1),
      unitColor: colors.ink2,
    );
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        // The header shows the same counts as the legend; this sentence is what TalkBack reads.
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
            child: Row(
              children: [
                Expanded(
                  child: Align(alignment: Alignment.centerLeft, child: number),
                ),
                if (widget.showMobi)
                  SizedBox.square(
                    dimension: PaletteSheet.mobiSize,
                    child: MobiCharacter(
                      controller: _mobi,
                      size: PaletteSheet.mobiSize,
                      head: true,
                      entrance: MobiAct.idle,
                      shadow: false,
                      seed: 23,
                    ),
                  ),
              ],
            ),
          ),
        ),
        const SizedBox(height: MmSpace.s8),
        _Legend(counts: counts, unsynced: cells.where((c) => c.unsynced).length, filter: filter, onFilter: widget.onFilter),
        if (target >= 0) ...[
          // A quiet text key, left on the gutter: the grid and the pinned submit key are the loud
          // things here, this is a shortcut.
          Align(
            alignment: Alignment.centerLeft,
            // The key's own padding is pulled back, so its words start on the gutter with the rest.
            child: Transform.translate(
              offset: const Offset(-MmSpace.s16, 0),
              child: KeyButton.quiet(
                label: filter == null ? RunnerCopy.goToFirstOpen(target + 1) : RunnerCopy.goToQuestion(target + 1),
                onPressed: () => onJump(target),
                hapticOnCommit: false,
              ),
            ),
          ),
        ],
        const SizedBox(height: MmSpace.s16),
        Divider(height: 1, thickness: 1, color: colors.line),
        const SizedBox(height: MmSpace.s12),
        _CellWave(
          count: cells.length,
          builder: (i) {
            final match = filter == null || sheetCellMatches(cells[i], filter);
            return AnimatedOpacity(
              opacity: match ? 1 : 0.3,
              duration: Motion.of(context, const Duration(milliseconds: 160)),
              child: SheetCellKey(
                key: i == firstOpen ? _firstOpenKey : null,
                cell: cells[i],
                ringed: filter != null && match,
                onTap: () => onJump(i),
              ),
            );
          },
          columns: 5,
        ),
        // A short paper keeps its key at the foot; a long one gets a pinned footer instead.
        if (widget.showSubmit) ...[
          const SizedBox(height: MmSpace.s16),
          KeyButton(label: RunnerCopy.reviewAndSubmit, onPressed: widget.onReview, hapticOnCommit: false),
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

  late final AnimationController _controller = AnimationController(vsync: this, duration: _pop + _gap * _CellWave.maxStagger);
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
/// Each item is a filter key (48 dp tall): on, only its cells stay bright; tapped again, off.
class _Legend extends StatelessWidget {
  const _Legend({required this.counts, required this.unsynced, this.filter, this.onFilter});

  final SheetCounts counts;

  /// Answers that exist only on this phone so far; the legend names their dot while there are any.
  final int unsynced;
  final SheetFilter? filter;
  final ValueChanged<SheetFilter?>? onFilter;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    Widget key(SheetFilter f, Widget glyph, String label) {
      final onFilter = this.onFilter;
      return _FilterKey(
        glyph: glyph,
        label: label,
        on: filter == f,
        onTap: onFilter == null ? null : () => onFilter(filter == f ? null : f),
      );
    }

    final seenBlank = counts.notAnswered - counts.notVisited;
    // Only the states that exist: a legend item with a count of zero is noise.
    final items = <Widget>[
      if (seenBlank > 0)
        key(
          SheetFilter.notAnswered,
          CustomPaint(
            painter: _MiniBubble(sample: _blank, colors: colors),
          ),
          '${RunnerCopy.notAnswered} $seenBlank',
        ),
      if (counts.notVisited > 0)
        key(
          SheetFilter.notVisited,
          CustomPaint(
            painter: _MiniBubble(sample: _unseen, colors: colors),
          ),
          '${RunnerCopy.notVisited} ${counts.notVisited}',
        ),
      if (counts.marked > 0) key(SheetFilter.marked, const _FlagIcon(), '${RunnerCopy.markedShort} ${counts.marked}'),
      if (unsynced > 0) key(SheetFilter.unsynced, CustomPaint(painter: _PhoneDot(colors: colors)), '${RunnerCopy.onThisPhone} $unsynced'),
    ];
    // The keys' own padding is pulled back, so their glyphs start on the gutter with the rest.
    final Widget body;
    // Four states do not fit one line: two columns, so no item is left alone on a second line.
    if (items.length >= 4) {
      body = Column(
        children: [
          for (var i = 0; i < items.length; i += 2)
            Row(
              children: [
                Expanded(
                  child: Align(alignment: Alignment.centerLeft, child: items[i]),
                ),
                Expanded(
                  child: i + 1 < items.length ? Align(alignment: Alignment.centerLeft, child: items[i + 1]) : const SizedBox.shrink(),
                ),
              ],
            ),
        ],
      );
    } else {
      body = Wrap(spacing: MmSpace.s4, children: items);
    }
    return Transform.translate(offset: const Offset(-MmSpace.s8, 0), child: body);
  }
}

const SheetCell _blank = SheetCell(number: 0, answered: false, visited: true, marked: false, unsynced: false, current: false);
const SheetCell _unseen = SheetCell(number: 0, answered: false, visited: false, marked: false, unsynced: false, current: false);

/// Every legend glyph is drawn in the same 16 dp box, so the four states read as one set.
const double _legendGlyph = 16;

/// One legend item as a filter key: glyph and words in a 48 dp pill that fills while on.
class _FilterKey extends StatelessWidget {
  const _FilterKey({required this.glyph, required this.label, required this.on, this.onTap});

  final Widget glyph;
  final String label;
  final bool on;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final face = AnimatedContainer(
      duration: Motion.of(context, const Duration(milliseconds: 160)),
      curve: Motion.glide,
      constraints: const BoxConstraints(minHeight: MmTarget.min),
      padding: const EdgeInsets.symmetric(horizontal: MmSpace.s8),
      decoration: ShapeDecoration(
        color: on ? colors.raised2 : colors.raised2.withValues(alpha: 0),
        shape: StadiumBorder(side: BorderSide(color: on ? colors.ink : colors.ink.withValues(alpha: 0))),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          SizedBox.square(dimension: _legendGlyph, child: glyph),
          const SizedBox(width: MmSpace.s8),
          Text(label, style: type.caption.copyWith(color: on ? colors.ink : colors.ink2)),
        ],
      ),
    );
    final onTap = this.onTap;
    if (onTap == null) return ExcludeSemantics(child: face);
    return MmPressable(onTap: onTap, lift: false, selected: on, semanticsLabel: label, builder: (context, pressed, focused) => face);
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
