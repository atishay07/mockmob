import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/haptics/haptics.dart';
import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../../rhythm/rhythm.dart' show LateNightLine;
import '../copy.dart';
import '../model/finish_reaction.dart';
import 'finish_ceremony.dart';
import 'marks_bar.dart';
import 'sheet_columns.dart';

/// The finish moment of a practice (owner feedback 1110, WEB-PARITY A13). It opens only after
/// the server has acknowledged the submit (the result route is reached from the receipt). The
/// student's sheet inks in, bubble by bubble in order (40 ms apart, 800 ms at most), the figure
/// counts up with each right answer, then the figure is stamped: it lifts and lands with an ink
/// ring (a medium haptic), and for a good set a burst of volt shards and bubbles flies out while
/// a light band crosses the sheet (the success haptic, which is allowed here because the server
/// has already acknowledged). Then Mobi, who has been reading the sheet, reacts: a cheer for a
/// good run, thinking it over for a mixed one, never sad. A tap anywhere skips to the end;
/// reduced motion and a result opened again show the end at once.
///
/// The screen mounts it only once the sheet has rows (or the read has settled without them) and
/// keys it by the number of bubbles, so rows that arrive after an empty mount make a new stage:
/// the ink is timed for the real sheet and starts from 0.
class FinishStage extends ConsumerStatefulWidget {
  const FinishStage({
    super.key,
    required this.marks,
    required this.cells,
    required this.tone,
    required this.recordedAt,
    required this.fresh,
    this.subject,
    this.chapter,
    this.onCellTap,
  });

  final FinishMarks marks;
  final List<QuestionCell> cells;
  final FinishTone tone;

  /// When the server acknowledged; null while that is still being read (no receipt yet).
  final DateTime? recordedAt;

  /// First open straight after the submit: play the moment. False shows the end state.
  final bool fresh;
  final String? subject;
  final String? chapter;
  final ValueChanged<int>? onCellTap;

  /// Bubble-to-bubble stagger, the cap on the whole ink, and the beats around it.
  static const Duration stagger = Duration(milliseconds: 40);
  static const Duration inkCap = Duration(milliseconds: 800);
  static const Duration lead = Duration(milliseconds: 200);
  static const Duration tail = Duration(milliseconds: 260);

  /// How long the whole moment runs for [count] questions.
  static Duration durationFor(int count) {
    final ink = Duration(milliseconds: math.min(stagger.inMilliseconds * math.max(count, 1), inkCap.inMilliseconds));
    return lead + ink + tail;
  }

  @override
  ConsumerState<FinishStage> createState() => _FinishStageState();
}

const double _mobiSize = 92;

class _FinishStageState extends ConsumerState<FinishStage> with TickerProviderStateMixin {
  late final AnimationController _c = AnimationController(vsync: this, duration: FinishStage.durationFor(widget.cells.length));
  late final Animation<double> _ink;

  /// The stamp after the ink (lift, land, ring, burst) and the light band over the sheet.
  late final AnimationController _stamp = AnimationController(vsync: this, duration: FinishCeremony.stampDuration);
  late final AnimationController _sweep = AnimationController(vsync: this, duration: Motion.sweep);
  bool _landed = false;
  final MobiController _mobi = MobiController();
  final GlobalKey _sheetKey = GlobalKey();
  bool _reacted = false;
  bool _started = false;

  @override
  void initState() {
    super.initState();
    _ink = _inkFor(_c.duration!);
    _c.addStatusListener((s) {
      if (s == AnimationStatus.completed) _stampDown();
    });
    _stamp.addListener(() {
      if (!_landed && _stamp.value >= FinishCeremony.landAt) _land();
    });
  }

  /// A good or great set gets the burst, the band of light and the success haptic.
  bool get _celebrates => widget.tone == FinishTone.good || widget.tone == FinishTone.great;

  /// The ink is done: stamp the figure. A result opened again, or reduced motion, lands at once.
  void _stampDown() {
    // A skip has already landed it.
    if (_landed) return;
    if (!widget.fresh || Motion.reduced(context)) {
      _landed = true;
      _react();
      return;
    }
    _stamp.forward(from: 0);
  }

  /// The figure touches down: the haptic, the band of light, and Mobi's turn.
  void _land() {
    _landed = true;
    final haptics = ref.read(hapticsProvider);
    if (_celebrates) {
      haptics.success();
      _sweep.forward(from: 0);
    } else {
      haptics.medium();
    }
    _react();
  }

  /// The ink runs between the lead-in and the tail of a moment [total] long.
  Animation<double> _inkFor(Duration total) {
    final ms = total.inMilliseconds;
    return CurvedAnimation(parent: _c, curve: Interval(FinishStage.lead.inMilliseconds / ms, 1 - FinishStage.tail.inMilliseconds / ms));
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_started) return;
    _started = true;
    if (!widget.fresh || Motion.reduced(context)) {
      _c.value = 1;
      _react();
    } else {
      _c.forward();
    }
  }

  void _skip() {
    if (_c.isAnimating) {
      // Straight to the end: no stamp left to watch.
      _landed = true;
      _c.value = 1;
      _react();
    } else if (_stamp.isAnimating) {
      _stamp.value = 1;
      _sweep.value = 1;
    }
  }

  /// Mobi reacts once, with the line for the tone; a good run gets a light tap of the haptics.
  void _react() {
    if (_reacted) return;
    _reacted = true;
    _mobi.play(widget.tone.act);
    _mobi.say(PracticeCopy.finishLine(widget.tone, widget.marks));
    if (widget.tone.pointsAtMistake) {
      WidgetsBinding.instance.addPostFrameCallback((_) => _pointAtFirstWrong());
    }
    if (mounted) setState(() {});
  }

  void _pointAtFirstWrong() {
    final first = widget.cells.indexOf(QuestionCell.wrong);
    final box = _sheetKey.currentContext?.findRenderObject();
    if (first < 0 || box is! RenderBox || !box.hasSize || !mounted) return;
    final g = _InkSheet.geometry(widget.cells.length, box.size.width);
    final local = Offset(
      g.left + (first % g.columns) * (g.cell + g.gap) + g.cell / 2,
      (first ~/ g.columns) * (g.cell + g.gap) + g.cell / 2,
    );
    _mobi.pointAt(box.localToGlobal(local));
  }

  @override
  void dispose() {
    _c.dispose();
    _stamp.dispose();
    _sweep.dispose();
    _mobi.dispose();
    super.dispose();
  }

  /// Right answers inked so far: the figure counts up with the sheet.
  int _tally() {
    final exact = _ink.value * widget.cells.length;
    var n = 0;
    for (var i = 0; i < widget.cells.length && i + 1 <= exact + 1e-6; i++) {
      if (widget.cells[i] == QuestionCell.right) n++;
    }
    return _c.value >= 1 ? widget.marks.correct : n;
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final m = widget.marks;
    final overline = [
      if (widget.subject != null) PracticeCopy.resultOverline(widget.subject!),
      if (widget.chapter != null) widget.chapter!,
    ].join(', ');

    return GestureDetector(
      behavior: HitTestBehavior.translucent,
      onTap: _skip,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (overline.isNotEmpty) Text(overline, style: type.caption.copyWith(color: colors.ink2)),
          const SizedBox(height: MmSpace.s4),
          Semantics(
            header: true,
            label: PracticeCopy.figureSemantics(m.correct, m.total),
            excludeSemantics: true,
            child: StampedFigure(
              stamp: _stamp,
              burst: _celebrates,
              digits: '${m.correct}'.length,
              child: AnimatedBuilder(
                animation: _c,
                builder: (context, _) =>
                    MonumentalNumber(value: PracticeCopy.figureNumber(_tally()), unit: PracticeCopy.figureUnit(m.total), roll: false),
              ),
            ),
          ),
          const SizedBox(height: MmSpace.s8),
          Text(PracticeCopy.countsLine(m.correct, m.wrong, m.blank), style: type.lead.copyWith(color: colors.ink)),
          if (widget.cells.isNotEmpty) ...[
            const SizedBox(height: MmSpace.s20),
            _InkSheet(cells: widget.cells, reveal: _ink, sweep: _sweep, onCellTap: widget.onCellTap, stripKey: _sheetKey),
          ],
          const SizedBox(height: MmSpace.s8),
          // Mobi sits under the sheet, reading it while it inks, then turns and says one line.
          // The row keeps Mobi's height from the start, so nothing above it moves.
          ConstrainedBox(
            constraints: const BoxConstraints(minHeight: _mobiSize),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                MobiCharacter(controller: _mobi, size: _mobiSize, entrance: MobiAct.read, seed: 41),
                const SizedBox(width: MmSpace.s8),
                Expanded(child: _MobiSays(controller: _mobi)),
              ],
            ),
          ),
          const SizedBox(height: MmSpace.s12),
          AnimatedOpacity(
            opacity: _reacted ? 1 : 0,
            duration: Motion.of(context, Motion.card),
            child: MarksBar(marks: m),
          ),
          const SizedBox(height: MmSpace.s16),
          // The line keeps its height while the acknowledgement time is read, so nothing jumps.
          SizedBox(height: 22, child: widget.recordedAt == null ? null : ReceiptLine(text: PracticeCopy.recorded(widget.recordedAt!))),
          const LateNightLine(),
        ],
      ),
    );
  }
}

/// Mobi's line, typed in after the reaction, in Mobi's own speech bubble.
class _MobiSays extends StatelessWidget {
  const _MobiSays({required this.controller});

  final MobiController controller;

  @override
  Widget build(BuildContext context) => ValueListenableBuilder<MobiSpeech?>(
    valueListenable: controller.speech,
    builder: (context, speech, _) => speech == null
        ? const SizedBox.shrink()
        : Align(
            alignment: Alignment.centerLeft,
            child: MobiBubble(key: ValueKey(speech.id), speech: speech, tail: MobiTail.left, maxWidth: 280),
          ),
  );
}

/// The student's sheet on a solid card: one bubble per question, inking in order. Each bubble
/// is a verdict, and a tap opens that question below (the rows are the accessible path).
class _InkSheet extends StatelessWidget {
  const _InkSheet({required this.cells, required this.reveal, required this.sweep, this.onCellTap, this.stripKey});

  final List<QuestionCell> cells;
  final Animation<double> reveal;

  /// The band of light that crosses the card once for a good set.
  final Animation<double> sweep;
  final ValueChanged<int>? onCellTap;
  final Key? stripKey;

  static const double gap = 6;

  /// Where the bubbles sit in a strip [width] wide: ten or fewer spread evenly across the card
  /// (no half-empty row), more in the sheet's columns.
  static ({int columns, double cell, double gap, double left}) geometry(int count, double width) {
    if (count <= 10) {
      // The bubbles shrink a little rather than run past the card's right padding.
      final cell = ((width - (count - 1) * gap) / count).clamp(16.0, 28.0);
      final spread = count <= 1 ? 0.0 : ((width - count * cell) / (count - 1)).clamp(gap, 40.0);
      final used = count * cell + (count - 1) * spread;
      return (columns: count, cell: cell, gap: spread, left: ((width - used) / 2).clamp(0.0, width));
    }
    final columns = sheetColumns(count);
    final cell = ((width - (columns - 1) * gap) / columns).clamp(16.0, 28.0);
    return (columns: columns, cell: cell, gap: gap, left: 0.0);
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return DecoratedBox(
      decoration: ShapeDecoration(
        color: colors.raised,
        shape: RoundedSuperellipseBorder(
          borderRadius: MmRadius.panelAll,
          side: BorderSide(color: colors.line),
        ),
      ),
      child: CustomPaint(
        foregroundPainter: SheetSweepPainter(sweep: sweep, colors: colors, radius: MmRadius.panel),
        child: Padding(
          padding: const EdgeInsets.all(MmSpace.s16),
          child: LayoutBuilder(
            builder: (context, constraints) {
              final g = geometry(cells.length, constraints.maxWidth);
              Widget strip = Padding(
                key: stripKey,
                padding: EdgeInsets.only(left: g.left),
                child: QuestionStrip(cells: cells, columns: g.columns, cellSize: g.cell, gap: g.gap, reveal: reveal),
              );
              // One row of ten or fewer reads like the real sheet: each bubble has its number under it.
              if (cells.length <= 10) {
                strip = Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    strip,
                    const SizedBox(height: MmSpace.s6),
                    ExcludeSemantics(
                      child: CustomPaint(
                        size: const Size.fromHeight(14),
                        painter: SheetNumeralsPainter(
                          count: cells.length,
                          left: g.left,
                          cell: g.cell,
                          gap: g.gap,
                          color: colors.ink3,
                          style: type.caption.copyWith(fontSize: 11, height: 1.2),
                        ),
                      ),
                    ),
                  ],
                );
              }
              if (onCellTap == null) return strip;
              return GestureDetector(
                behavior: HitTestBehavior.opaque,
                onTapUp: (details) {
                  final x = details.localPosition.dx - g.left;
                  final col = x < 0 ? -1 : x ~/ (g.cell + g.gap);
                  final row = details.localPosition.dy ~/ (g.cell + g.gap);
                  final index = row * g.columns + col;
                  if (col >= 0 && col < g.columns && index >= 0 && index < cells.length) onCellTap!(index);
                },
                child: strip,
              );
            },
          ),
        ),
      ),
    );
  }
}
