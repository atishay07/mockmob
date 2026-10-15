import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/foundation.dart' show ValueListenable;
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/haptics/haptics.dart';
import '../../../core/models/models.dart';
import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import '../model/time_decisions.dart' show clockLabel;

/// "Replay" on the full result (Mistake Lab v4 slice 2, spec 4.5): the paper as a clock you can
/// scrub, the Lab's Find step.
///
/// One row per 10 minutes. Each visit is a bar from entering to leaving, filled by the question's
/// final result; a pick is a dot, a change a ringed dot, a mark for review a small flag, and time
/// away a hatched gap. Each row ends with the server's "By 20:00: 14 of 50 answered. Even pace: 16.", and
/// the three facts follow the grid. Every sentence is the server's (`lab.replay`); the app adds only
/// the moving clock, which reads the same words at the moment under the finger.
///
/// - **Drag along a row** to scrub: the clock and the mini answer map follow the finger, the paper
///   after it goes faint, and a segment haptic ticks at each question boundary.
/// - **Play** runs the record in 15 seconds with the clock counting up and the map filling.
///   Under reduced motion, Play becomes Previous and Next, stepping one moment of the record.
/// - **A chip** (the ledger's own groups) dims every other bar and lists its questions.
/// - **Tap a bar** to open that answer below (the screen's own jump). Nothing covers text.
class ReplaySection extends StatefulWidget {
  const ReplaySection({super.key, required this.replay, required this.onOpenQuestion, this.numbersOf, this.filter});

  final LabReplay replay;

  /// Opens the answer of a question number (the answer map's own jump).
  final ValueChanged<int> onOpenQuestion;

  /// The question numbers of a ledger group (a chip's filter); null shows "All" only.
  final List<int> Function(String id)? numbersOf;

  /// The chip that is on (a ledger row's "See it in the replay" sets it). Owned here when null.
  final ValueNotifier<String>? filter;

  @override
  State<ReplaySection> createState() => ReplaySectionState();
}

class ReplaySectionState extends State<ReplaySection> with SingleTickerProviderStateMixin {
  /// The moment shown, in seconds from the start; null at rest (the whole record).
  final ValueNotifier<double?> cursor = ValueNotifier<double?>(null);
  late final AnimationController _play;
  ValueNotifier<String>? _ownFilter;
  ValueNotifier<String> get _filter => widget.filter ?? (_ownFilter ??= ValueNotifier<String>(ReplayChip.all));

  /// The question under the finger while scrubbing, so the haptic ticks once per boundary.
  int? _scrubQuestion;

  /// The row being scrubbed (its label lights).
  int? _scrubRow;

  LabReplay get _replay => widget.replay;

  @override
  void initState() {
    super.initState();
    _play = AnimationController(vsync: this, duration: Duration(milliseconds: widget.replay.playMs))
      ..addListener(_onPlayTick)
      ..addStatusListener(_onPlayStatus);
    _filter.addListener(_onFilter);
    // Opened with a chip already on (a ledger row's "See it in the replay" came first).
    if (_filter.value != ReplayChip.all) WidgetsBinding.instance.addPostFrameCallback((_) => _revealChip(_filter.value));
  }

  @override
  void didUpdateWidget(ReplaySection oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.filter != widget.filter) {
      (oldWidget.filter ?? _ownFilter)?.removeListener(_onFilter);
      _filter.addListener(_onFilter);
    }
    _play.duration = Duration(milliseconds: widget.replay.playMs);
  }

  @override
  void dispose() {
    _filter.removeListener(_onFilter);
    _ownFilter?.dispose();
    _chipScroll.dispose();
    _play.dispose();
    cursor.dispose();
    super.dispose();
  }

  void _onFilter() {
    if (!mounted) return;
    setState(() {});
    WidgetsBinding.instance.addPostFrameCallback((_) => _revealChip(_filter.value));
  }

  final ScrollController _chipScroll = ScrollController();
  final Map<String, GlobalKey> _chipKeys = {};
  GlobalKey _chipKey(String id) => _chipKeys.putIfAbsent(id, GlobalKey.new);

  /// Scrolls the chip line (only it, never the page) so chip [id] is in view.
  void _revealChip(String id) {
    final ro = _chipKeys[id]?.currentContext?.findRenderObject();
    if (!mounted || ro == null || !_chipScroll.hasClients) return;
    final viewport = RenderAbstractViewport.maybeOf(ro);
    if (viewport == null) return;
    final position = _chipScroll.position;
    final target = viewport.getOffsetToReveal(ro, 0.5).offset.clamp(position.minScrollExtent, position.maxScrollExtent);
    if ((target - position.pixels).abs() < 1) return;
    if (Motion.reduced(context)) {
      _chipScroll.jumpTo(target);
    } else {
      unawaited(_chipScroll.animateTo(target, duration: Motion.of(context, Motion.ui), curve: Motion.out));
    }
  }

  void _onPlayTick() {
    if (_play.isAnimating) cursor.value = _play.value * _replay.recordSec;
  }

  void _onPlayStatus(AnimationStatus status) {
    if (status == AnimationStatus.completed) {
      // The whole record has played: back to rest, where the end and every answer show.
      cursor.value = null;
      if (mounted) setState(() {});
    }
  }

  bool get playing => _play.isAnimating;

  /// Play from the moment shown (from the start at rest), or pause.
  void togglePlay() {
    if (_play.isAnimating) {
      _play.stop();
      setState(() {});
      return;
    }
    final at = cursor.value;
    final from = at == null || at >= _replay.recordSec ? 0.0 : at / _replay.recordSec;
    cursor.value = from * _replay.recordSec;
    unawaited(_play.forward(from: from));
    setState(() {});
  }

  /// Reduced motion: one moment of the record back or forward. At rest the record stands at its end.
  void step(int direction) {
    final moments = _replay.moments;
    if (moments.isEmpty) return;
    final at = cursor.value ?? _replay.recordSec.toDouble();
    int? target;
    if (direction > 0) {
      if (cursor.value == null) {
        target = moments.first;
      } else {
        for (final m in moments) {
          if (m > at + 0.001) {
            target = m;
            break;
          }
        }
      }
    } else {
      for (final m in moments.reversed) {
        if (m < at - 0.001) {
          target = m;
          break;
        }
      }
    }
    if (target == null) return;
    unawaited(hapticsOf(context)?.segmentTick());
    cursor.value = target >= _replay.recordSec ? null : target.toDouble();
    setState(() {});
  }

  /// Moves the moment to [sec] inside row [row] (a drag along it).
  void scrubTo(int row, double sec) {
    if (_play.isAnimating) _play.stop();
    final r = _replay.rows[row];
    final clamped = sec.clamp(r.from.toDouble(), math.min(r.to, _replay.recordSec).toDouble());
    cursor.value = clamped;
    final bar = _replay.barAt(clamped);
    if (bar?.n != _scrubQuestion) {
      _scrubQuestion = bar?.n;
      unawaited(hapticsOf(context)?.segmentTick());
    }
    if (_scrubRow != row) setState(() => _scrubRow = row);
  }

  void _scrubEnd() {
    _scrubQuestion = null;
    if (_scrubRow != null) setState(() => _scrubRow = null);
  }

  void _choose(String id) {
    _filter.value = _filter.value == id && id != ReplayChip.all ? ReplayChip.all : id;
  }

  /// The question numbers the chip that is on keeps lit; null for "All".
  Set<int>? get _lit {
    final id = _filter.value;
    if (id == ReplayChip.all) return null;
    return {...?widget.numbersOf?.call(id)};
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final replay = _replay;
    final reduced = Motion.reduced(context);
    final lit = _lit;
    final chipOn = _filter.value;
    final chipNumbers = lit == null ? const <int>[] : (widget.numbersOf?.call(chipOn) ?? const <int>[]);
    final fine = type.small.copyWith(color: colors.ink3);
    final style = ReplayStyle.of(colors);

    // Play sits beside the title, so the clock and the grid keep the width. Under reduced motion it
    // becomes Previous and Next, one moment of the record at a time.
    final controls = reduced
        ? Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              _ControlPill(key: const ValueKey('replay-previous'), icon: LucideIcons.stepBack, label: replay.labels.previous, onTap: () => step(-1)),
              const SizedBox(width: MmSpace.s4),
              _ControlPill(key: const ValueKey('replay-next'), icon: LucideIcons.stepForward, label: replay.labels.next, onTap: () => step(1)),
            ],
          )
        : _ControlPill(
            key: const ValueKey('replay-play'),
            icon: playing ? LucideIcons.pause : LucideIcons.play,
            label: playing ? replay.labels.pause : replay.labels.play,
            onTap: togglePlay,
          );

    return MmSection(
      title: replay.labels.title,
      caption: replay.labels.sub,
      action: controls,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const SizedBox(height: MmSpace.s4),
          _Readout(replay: replay, cursor: cursor, style: style),
          if (replay.chips.length > 1) ...[
            const SizedBox(height: MmSpace.s12),
            // One line of chips that scrolls sideways; the one turned on from the ledger is brought
            // into view.
            SizedBox(
              height: 48,
              child: SingleChildScrollView(
                key: const ValueKey('replay-chips'),
                controller: _chipScroll,
                scrollDirection: Axis.horizontal,
                child: Row(
                  children: [
                    for (var i = 0; i < replay.chips.length; i++) ...[
                      if (i > 0) const SizedBox(width: MmSpace.s4),
                      KeyedSubtree(
                        key: _chipKey(replay.chips[i].id),
                        child: _FilterChip(chip: replay.chips[i], selected: replay.chips[i].id == chipOn, onTap: () => _choose(replay.chips[i].id)),
                      ),
                    ],
                  ],
                ),
              ),
            ),
          ],
          const SizedBox(height: MmSpace.s8),
          for (var i = 0; i < replay.rows.length; i++)
            _RowView(
              key: ValueKey('replay-row-$i'),
              replay: replay,
              index: i,
              cursor: cursor,
              lit: lit,
              style: style,
              scrubbing: _scrubRow == i,
              onScrub: (sec) => scrubTo(i, sec),
              onScrubEnd: _scrubEnd,
              onOpenQuestion: widget.onOpenQuestion,
            ),
          if (chipNumbers.isNotEmpty) ...[
            const SizedBox(height: MmSpace.s4),
            Wrap(
              spacing: MmSpace.s4,
              children: [
                for (final n in chipNumbers)
                  _QuestionChip(label: ResultCopy.labQuestionChip(n), semanticsLabel: ResultCopy.labGoToQuestion(n), onTap: () => widget.onOpenQuestion(n)),
              ],
            ),
          ],
          if (replay.facts.isNotEmpty) ...[
            const SizedBox(height: MmSpace.s16),
            for (var i = 0; i < replay.facts.length; i++) ...[
              if (i > 0) const SizedBox(height: MmSpace.s8),
              Text(replay.facts[i], style: type.body.copyWith(fontFeatures: const [FontFeature.tabularFigures()])),
            ],
          ],
          const SizedBox(height: MmSpace.s16),
          Text(replay.labels.clockNote, style: fine),
          if (replay.hasPace) ...[const SizedBox(height: MmSpace.s4), Text(replay.labels.evenPaceNote, style: fine)],
        ],
      ),
    );
  }
}

/// The colours of the replay, by the question's final result: right in the good tone, wrong in
/// coral, blank hatched grey and held dotted (colour is never alone: every bar has its words for a
/// screen reader, and the answer below says it).
@immutable
class ReplayStyle {
  const ReplayStyle({
    required this.right,
    required this.wrong,
    required this.blank,
    required this.held,
    required this.hatch,
    required this.future,
    required this.ink,
    required this.inkOnBar,
    required this.inkOnBarLight,
    required this.tick,
    required this.tickStrong,
    required this.mark,
    required this.cursor,
    required this.away,
    required this.awayInk,
    required this.awayText,
    required this.mapAnswered,
    required this.mapOpened,
    required this.mapUnopened,
    required this.mapCurrent,
  });

  factory ReplayStyle.of(MmColors colors) {
    final night = colors.isNight;
    return ReplayStyle(
      right: night ? Color.lerp(colors.goodText, colors.ground, 0.28)! : Color.lerp(colors.goodText, colors.raised, 0.32)!,
      wrong: night ? const Color(0xFFC9604F) : colors.wrongBorder,
      blank: night ? colors.ink4 : colors.lineStrong,
      held: colors.lineStrong,
      hatch: night ? const Color(0x47F4F0E6) : const Color(0x80FFFDF8),
      future: colors.line,
      ink: colors.ink,
      inkOnBar: night ? colors.ground : const Color(0xFFFFFDF8),
      inkOnBarLight: colors.ink,
      tick: colors.line,
      tickStrong: colors.lineStrong,
      mark: colors.warnText,
      cursor: colors.ink,
      away: colors.sunken,
      awayInk: night ? const Color(0x59A09989) : const Color(0x66655F53),
      awayText: colors.ink2,
      mapAnswered: colors.ink,
      mapOpened: colors.ink3,
      mapUnopened: colors.line,
      mapCurrent: colors.accentText,
    );
  }

  final Color right;
  final Color wrong;
  final Color blank;
  final Color held;
  final Color hatch;
  final Color future;
  final Color ink;
  final Color inkOnBar;
  final Color inkOnBarLight;
  final Color tick;
  final Color tickStrong;
  final Color mark;
  final Color cursor;
  final Color away;
  final Color awayInk;
  final Color awayText;
  final Color mapAnswered;
  final Color mapOpened;
  final Color mapUnopened;
  final Color mapCurrent;

  Color fillOf(String result) => switch (result) {
    ReplayBar.right => right,
    ReplayBar.wrong => wrong,
    ReplayBar.held => held,
    _ => blank,
  };

  /// The label colour that reads on [fill].
  Color labelOn(Color fill) => ThemeData.estimateBrightnessForColor(fill) == Brightness.dark ? const Color(0xFFFFFDF8) : const Color(0xFF17150F);

  @override
  bool operator ==(Object other) =>
      other is ReplayStyle &&
      other.right == right &&
      other.wrong == wrong &&
      other.blank == blank &&
      other.held == held &&
      other.future == future &&
      other.ink == ink &&
      other.mark == mark &&
      other.away == away;

  @override
  int get hashCode => Object.hash(right, wrong, blank, held, future, ink, mark, away);
}

/// The big clock at the moment shown, what it says in the server's own words, the question on
/// screen then, and the mini answer map filling as the paper goes.
class _Readout extends StatelessWidget {
  const _Readout({required this.replay, required this.cursor, required this.style});

  final LabReplay replay;
  final ValueListenable<double?> cursor;
  final ReplayStyle style;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return ValueListenableBuilder<double?>(
      valueListenable: cursor,
      builder: (context, at, _) {
        final sec = at ?? replay.recordSec.toDouble();
        final whole = sec.floor();
        final answered = replay.answeredSetAt(sec);
        final opened = replay.openedAt(sec);
        final bar = at == null ? null : replay.barAt(sec);
        ReplaySpan? away;
        if (bar != null) {
          for (final a in bar.away) {
            if (a.from <= sec && sec < a.to) away = a;
          }
        }
        final line = at == null
            ? (replay.end?.label ?? ResultCopy.replayAnsweredBy(clockLabel(whole), answered.length, replay.total, replay.hasPace ? replay.evenPaceAt(whole) : null))
            : ResultCopy.replayAnsweredBy(clockLabel(whole), answered.length, replay.total, replay.hasPace ? replay.evenPaceAt(whole) : null);
        final tag = away?.label ?? (bar == null ? null : ResultCopy.labQuestionChip(bar.n));
        return Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              child: Semantics(
                container: true,
                label: '${ResultCopy.replayClockSpoken(clockLabel(whole))}. $line${tag == null ? '' : ' $tag.'}',
                excludeSemantics: true,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Wraps rather than overflows at a large text size: the tag drops under the clock.
                    Wrap(
                      crossAxisAlignment: WrapCrossAlignment.center,
                      spacing: MmSpace.s8,
                      runSpacing: MmSpace.s4,
                      children: [
                        Text(
                          clockLabel(whole),
                          key: const ValueKey('replay-clock'),
                          style: type.figureCompact.copyWith(fontSize: 36, height: 40 / 36, fontFeatures: const [FontFeature.tabularFigures()]),
                        ),
                        if (tag != null) ...[
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: MmSpace.s8, vertical: 3),
                            decoration: ShapeDecoration(
                              color: colors.raised2,
                              shape: RoundedSuperellipseBorder(borderRadius: MmRadius.smallAll, side: BorderSide(color: colors.lineStrong)),
                            ),
                            child: Text(tag, style: type.label.copyWith(fontFeatures: const [FontFeature.tabularFigures()])),
                          ),
                        ],
                      ],
                    ),
                    const SizedBox(height: MmSpace.s4),
                    Text(line, key: const ValueKey('replay-line'), style: type.small.copyWith(color: colors.ink2, fontFeatures: const [FontFeature.tabularFigures()])),
                  ],
                ),
              ),
            ),
            const SizedBox(width: MmSpace.s12),
            Semantics(
              label: ResultCopy.replayMapSpoken(answered.length, opened.length, replay.total),
              excludeSemantics: true,
              child: CustomPaint(
                size: _MiniMapPainter.sizeFor(replay.total),
                painter: _MiniMapPainter(
                  total: replay.total,
                  answered: answered,
                  opened: opened,
                  current: bar?.n,
                  style: style,
                ),
              ),
            ),
          ],
        );
      },
    );
  }
}

/// The paper's answer map in miniature: a dot per question, ten to a line. Answered dots are inked,
/// opened ones a ring, unopened ones a faint dot; the question on screen wears the accent ring. The
/// dots say what was answered at that moment, never whether it was right then.
class _MiniMapPainter extends CustomPainter {
  _MiniMapPainter({required this.total, required this.answered, required this.opened, required this.current, required this.style});

  final int total;
  final Set<int> answered;
  final Set<int> opened;
  final int? current;
  final ReplayStyle style;

  static const double dot = 7;
  static const double gap = 3.5;
  static const int perLine = 10;

  static Size sizeFor(int total) {
    final cols = math.min(perLine, math.max(1, total));
    final lines = (total / perLine).ceil().clamp(1, 20);
    return Size(cols * dot + (cols - 1) * gap + 2, lines * dot + (lines - 1) * gap + 2);
  }

  @override
  void paint(Canvas canvas, Size size) {
    for (var i = 0; i < total; i++) {
      final n = i + 1;
      final c = Offset(1 + (i % perLine) * (dot + gap) + dot / 2, 1 + (i ~/ perLine) * (dot + gap) + dot / 2);
      if (answered.contains(n)) {
        canvas.drawCircle(c, dot / 2, Paint()..color = style.mapAnswered);
      } else if (opened.contains(n)) {
        canvas.drawCircle(
          c,
          dot / 2 - 0.75,
          Paint()
            ..style = PaintingStyle.stroke
            ..strokeWidth = 1.5
            ..color = style.mapOpened,
        );
      } else {
        canvas.drawCircle(c, dot / 2 - 1, Paint()..color = style.mapUnopened);
      }
      if (current == n) {
        canvas.drawCircle(
          c,
          dot / 2 + 1.25,
          Paint()
            ..style = PaintingStyle.stroke
            ..strokeWidth = 1.5
            ..color = style.mapCurrent,
        );
      }
    }
  }

  @override
  bool shouldRepaint(_MiniMapPainter oldDelegate) =>
      oldDelegate.total != total ||
      oldDelegate.current != current ||
      oldDelegate.style != style ||
      !_sameSet(oldDelegate.answered, answered) ||
      !_sameSet(oldDelegate.opened, opened);

  static bool _sameSet(Set<int> a, Set<int> b) => a.length == b.length && a.containsAll(b);
}

/// One 10-minute row: the strip of visits (drag along it to scrub, tap a bar to open its answer)
/// and the server's row line under it.
class _RowView extends StatelessWidget {
  const _RowView({
    super.key,
    required this.replay,
    required this.index,
    required this.cursor,
    required this.lit,
    required this.style,
    required this.scrubbing,
    required this.onScrub,
    required this.onScrubEnd,
    required this.onOpenQuestion,
  });

  final LabReplay replay;
  final int index;
  final ValueListenable<double?> cursor;
  final Set<int>? lit;
  final ReplayStyle style;
  final bool scrubbing;
  final ValueChanged<double> onScrub;
  final VoidCallback onScrubEnd;
  final ValueChanged<int> onOpenQuestion;

  /// The touch band; the strip of bars sits in its middle.
  static const double band = 44;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final row = replay.rows[index];
    final painter = ReplayRowPainter(
      row: row,
      rowSec: replay.rowSec,
      recordSec: replay.recordSec,
      cursor: cursor,
      lit: lit,
      style: style,
      textDirection: Directionality.of(context),
      labelStyle: type.label.copyWith(fontSize: 10.5, height: 1, fontFeatures: const [FontFeature.tabularFigures()]),
      awayStyle: type.label.copyWith(fontSize: 10, height: 1, fontWeight: FontWeight.w500, color: style.awayText),
      onOpen: onOpenQuestion,
    );
    double secAt(double dx, double width) => row.from + (dx / math.max(1, width)).clamp(0.0, 1.0) * replay.rowSec;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        LayoutBuilder(
          builder: (context, box) => GestureDetector(
            behavior: HitTestBehavior.opaque,
            excludeFromSemantics: true,
            onTapUp: (d) {
              final bar = painter.barAt(d.localPosition.dx, box.maxWidth);
              if (bar != null) onOpenQuestion(bar.n);
            },
            onHorizontalDragStart: (d) => onScrub(secAt(d.localPosition.dx, box.maxWidth)),
            onHorizontalDragUpdate: (d) => onScrub(secAt(d.localPosition.dx, box.maxWidth)),
            onHorizontalDragEnd: (_) => onScrubEnd(),
            onHorizontalDragCancel: onScrubEnd,
            child: SizedBox(
              height: band,
              width: double.infinity,
              child: RepaintBoundary(child: CustomPaint(painter: painter)),
            ),
          ),
        ),
        Padding(
          padding: const EdgeInsets.only(bottom: MmSpace.s8),
          child: AnimatedDefaultTextStyle(
            duration: Motion.of(context, Motion.ui),
            curve: Motion.out,
            style: type.small.copyWith(color: scrubbing ? colors.ink : colors.ink2, fontFeatures: const [FontFeature.tabularFigures()]),
            child: Text(row.label),
          ),
        ),
      ],
    );
  }
}

/// Paints one row of the replay: the minute ruler, each visit as a bar with its label, picks,
/// changes, marks and time away, the paper after the moment shown faint, and the moment's line.
/// Public for its geometry and semantics tests.
class ReplayRowPainter extends CustomPainter {
  ReplayRowPainter({
    required this.row,
    required this.rowSec,
    required this.recordSec,
    required this.cursor,
    required this.lit,
    required this.style,
    required this.textDirection,
    required this.labelStyle,
    required this.awayStyle,
    this.onOpen,
  }) : super(repaint: cursor);

  final ReplayRow row;
  final int rowSec;
  final int recordSec;
  final ValueListenable<double?> cursor;
  final Set<int>? lit;
  final ReplayStyle style;
  final TextDirection textDirection;
  final TextStyle labelStyle;
  final TextStyle awayStyle;
  final ValueChanged<int>? onOpen;

  static const double barHeight = 22;
  static const double minLabelWidth = 24;
  static const double dimTo = 0.22;

  double _x(num sec, double width) => (sec - row.from) / rowSec * width;

  Rect _barRect(ReplayBar b, Size size) {
    final top = (size.height - barHeight) / 2;
    final left = _x(b.from, size.width);
    final right = _x(b.to, size.width);
    // A 1 dp seam between visits that touch, while the bar keeps at least a hairline.
    final w = math.max(1.0, right - left - (right - left > 3 ? 1 : 0));
    return Rect.fromLTWH(left, top, w, barHeight);
  }

  /// The visit under [dx] in a row [width] wide, or the nearest one within 8 dp.
  ReplayBar? barAt(double dx, double width) {
    ReplayBar? best;
    var bestDist = 8.0;
    for (final b in row.bars) {
      final l = _x(b.from, width);
      final r = _x(b.to, width);
      if (dx >= l && dx <= r) return b;
      final d = dx < l ? l - dx : dx - r;
      if (d < bestDist) {
        bestDist = d;
        best = b;
      }
    }
    return best;
  }

  @override
  void paint(Canvas canvas, Size size) {
    final at = cursor.value;
    final width = size.width;
    final mid = size.height / 2;
    final bottom = mid + barHeight / 2;

    // The minute ruler under the bars: a tick each minute, a taller one each 5 minutes.
    for (var s = 60; s < rowSec; s += 60) {
      final x = _x(row.from + s, width);
      final strong = (row.from + s) % 300 == 0;
      canvas.drawLine(
        Offset(x, bottom + 2),
        Offset(x, bottom + (strong ? 7 : 4)),
        Paint()
          ..color = strong ? style.tickStrong : style.tick
          ..strokeWidth = 1,
      );
    }
    // The record's end inside this row: a short closing rule.
    if (recordSec > row.from && recordSec < row.to) {
      final x = _x(recordSec, width);
      canvas.drawLine(
        Offset(x, mid - barHeight / 2 - 4),
        Offset(x, bottom + 4),
        Paint()
          ..color = style.tickStrong
          ..strokeWidth = 1.5
          ..strokeCap = StrokeCap.round,
      );
    }

    final cut = at == null ? null : _x(at, width);
    for (final b in row.bars) {
      final rect = _barRect(b, size);
      final dim = lit == null || lit!.contains(b.n) ? 1.0 : dimTo;
      final fill = style.fillOf(b.result);
      final rrect = RRect.fromRectAndRadius(rect, const Radius.circular(3));
      // Before the moment shown the bar is inked; after it the paper is still to come.
      final inkRight = cut == null ? rect.right : cut.clamp(rect.left, rect.right);
      if (inkRight < rect.right) {
        canvas.drawRRect(rrect, Paint()..color = style.future.withValues(alpha: style.future.a * dim));
      }
      if (inkRight > rect.left) {
        canvas.save();
        canvas.clipRect(Rect.fromLTRB(rect.left, rect.top - 6, inkRight, rect.bottom + 1));
        canvas.drawRRect(rrect, Paint()..color = fill.withValues(alpha: fill.a * dim));
        if (b.result == ReplayBar.blank || b.result == ReplayBar.held) _pattern(canvas, rrect, b.result, dim);
        canvas.restore();
      }
      // Time away inside the visit: a hatched gap with its words where they fit.
      for (final a in b.away) {
        final l = _x(a.from, width).clamp(rect.left, rect.right);
        final r = _x(a.to, width).clamp(rect.left, rect.right);
        if (r - l < 1) continue;
        final gapRect = Rect.fromLTRB(l, rect.top, r, rect.bottom);
        canvas.save();
        canvas.clipRRect(rrect);
        canvas.drawRect(gapRect, Paint()..color = style.away.withValues(alpha: style.away.a * dim));
        _hatch(canvas, gapRect, style.awayInk.withValues(alpha: style.awayInk.a * dim), 5);
        canvas.restore();
        final tp = _text(a.label, awayStyle.copyWith(color: awayStyle.color!.withValues(alpha: (awayStyle.color!.a * dim).clamp(0.0, 1.0))));
        if (tp.width + 8 <= gapRect.width) tp.paint(canvas, Offset(gapRect.left + 4, mid - tp.height / 2));
      }
      final inked = cut == null || cut >= rect.right - 0.5;
      // The question's number, where the bar is wide enough to hold it.
      final awayWide = b.away.any((a) => _x(a.to, width) - _x(a.from, width) > rect.width / 2);
      // A bar a chip has dimmed keeps only its shape, so the lit questions read at once.
      if (rect.width >= minLabelWidth && inked && !awayWide && dim >= 1) {
        final color = style.labelOn(fill);
        final tp = _text(ResultCopy.labQuestionChip(b.n), labelStyle.copyWith(color: color.withValues(alpha: dim)));
        if (tp.width + 6 <= rect.width) tp.paint(canvas, Offset(rect.left + 4, rect.top + 3.5));
      }
      // Picks and changes, marks for review.
      for (final p in b.picks) {
        if (cut != null && _x(p.at, width) > cut) continue;
        final c = Offset(_x(p.at, width).clamp(rect.left + 3, math.max(rect.left + 3, rect.right - 3)), rect.bottom - 5);
        final dotColor = style.labelOn(fill).withValues(alpha: dim);
        if (p.change || p.option == null) {
          canvas.drawCircle(
            c,
            3.3,
            Paint()
              ..style = PaintingStyle.stroke
              ..strokeWidth = 1.3
              ..color = dotColor,
          );
          if (p.option != null) canvas.drawCircle(c, 1.3, Paint()..color = dotColor);
        } else {
          canvas.drawCircle(c, 2.2, Paint()..color = dotColor);
        }
      }
      for (final m in b.marks) {
        if (cut != null && _x(m, width) > cut) continue;
        final x = _x(m, width).clamp(rect.left + 1, math.max(rect.left + 1, rect.right - 1));
        final top = rect.top - 6;
        final paint = Paint()..color = style.mark.withValues(alpha: dim);
        canvas.drawRect(Rect.fromLTWH(x - 0.75, top, 1.5, 9), paint);
        canvas.drawPath(
          Path()
            ..moveTo(x + 0.75, top)
            ..lineTo(x + 6, top + 2.25)
            ..lineTo(x + 0.75, top + 4.5)
            ..close(),
          paint,
        );
      }
    }
    // The moment shown.
    if (cut != null && at! >= row.from && at <= row.to) {
      final x = cut.clamp(1.0, width - 1);
      canvas.drawLine(
        Offset(x, mid - barHeight / 2 - 7),
        Offset(x, bottom + 7),
        Paint()
          ..color = style.cursor
          ..strokeWidth = 2
          ..strokeCap = StrokeCap.round,
      );
    }
  }

  void _pattern(Canvas canvas, RRect rrect, String result, double dim) {
    final rect = rrect.outerRect;
    if (result == ReplayBar.blank) {
      _hatch(canvas, rect, style.hatch.withValues(alpha: style.hatch.a * dim), 6);
    } else {
      final paint = Paint()..color = style.ink.withValues(alpha: 0.45 * dim);
      for (var x = rect.left + 3; x < rect.right - 1; x += 4) {
        canvas.drawCircle(Offset(x, rect.center.dy), 0.9, paint);
      }
    }
  }

  static void _hatch(Canvas canvas, Rect rect, Color color, double period) {
    final paint = Paint()
      ..color = color
      ..strokeWidth = 1.5;
    final h = rect.height;
    canvas.save();
    canvas.clipRect(rect);
    for (var x = rect.left - h; x < rect.right + h; x += period) {
      canvas.drawLine(Offset(x, rect.bottom), Offset(x + h, rect.top), paint);
    }
    canvas.restore();
  }

  final Map<String, TextPainter> _texts = {};

  TextPainter _text(String s, TextStyle st) {
    final key = '$s|${st.color?.toARGB32()}';
    return _texts.putIfAbsent(key, () => TextPainter(text: TextSpan(text: s, style: st), textDirection: textDirection, maxLines: 1)..layout());
  }

  @override
  SemanticsBuilderCallback get semanticsBuilder => (size) => [
    for (final b in row.bars)
      CustomPainterSemantics(
        key: ValueKey('replay-bar-${b.n}-${b.from}'),
        rect: _barRect(b, size).inflate(4),
        properties: SemanticsProperties(
          label: ResultCopy.replayBarSpoken(b.n, b.result, clockLabel(b.from), clockLabel(b.to), [for (final a in b.away) a.label]),
          button: onOpen != null,
          textDirection: textDirection,
          onTap: onOpen == null ? null : () => onOpen!(b.n),
        ),
      ),
  ];

  @override
  bool shouldRebuildSemantics(ReplayRowPainter oldDelegate) => oldDelegate.row != row || oldDelegate.rowSec != rowSec;

  @override
  bool shouldRepaint(ReplayRowPainter oldDelegate) =>
      oldDelegate.row != row ||
      oldDelegate.lit != lit ||
      oldDelegate.style != style ||
      oldDelegate.rowSec != rowSec ||
      oldDelegate.labelStyle != labelStyle ||
      oldDelegate.recordSec != recordSec;
}

/// A filter chip: the ledger's word and its count. 40 dp tall in a 48 dp target.
class _FilterChip extends StatelessWidget {
  const _FilterChip({required this.chip, required this.selected, required this.onTap});

  final ReplayChip chip;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final count = chip.count;
    return MmPressable(
      key: ValueKey('replay-chip-${chip.id}'),
      onTap: onTap,
      focusRadius: MmRadius.smallAll,
      haptic: MmPressHaptic.selection,
      selected: selected,
      inMutuallyExclusiveGroup: true,
      semanticsLabel: count == null ? chip.label : '${chip.label}, $count',
      builder: (context, pressed, _) => Padding(
        padding: const EdgeInsets.symmetric(vertical: MmSpace.s4),
        child: AnimatedContainer(
          duration: Motion.of(context, Motion.ui),
          curve: Motion.out,
          constraints: const BoxConstraints(minHeight: 40),
          padding: const EdgeInsets.symmetric(horizontal: MmSpace.s12),
          decoration: ShapeDecoration(
            color: selected ? colors.ink : (pressed ? colors.raised2 : colors.raised),
            shape: RoundedSuperellipseBorder(borderRadius: MmRadius.smallAll, side: BorderSide(color: selected ? colors.ink : colors.lineStrong)),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(chip.label, style: type.label.copyWith(fontSize: 14, color: selected ? colors.ground : colors.ink)),
              if (count != null) ...[
                const SizedBox(width: MmSpace.s8),
                Text(
                  '$count',
                  style: type.label.copyWith(fontSize: 14, color: selected ? colors.ground : colors.ink3, fontFeatures: const [FontFeature.tabularFigures()]),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

/// Play, Pause, Previous or Next: a compact outlined pill with its icon, 44 dp tall.
class _ControlPill extends StatelessWidget {
  const _ControlPill({super.key, required this.icon, required this.label, required this.onTap});

  final IconData icon;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return MmPressable(
      onTap: onTap,
      focusRadius: MmRadius.pillAll,
      haptic: MmPressHaptic.selection,
      semanticsLabel: label,
      builder: (context, pressed, _) => Container(
        constraints: const BoxConstraints(minHeight: MmTarget.min),
        padding: const EdgeInsets.fromLTRB(MmSpace.s12, 0, MmSpace.s16, 0),
        decoration: ShapeDecoration(
          color: pressed ? colors.raised2 : colors.raised,
          shape: StadiumBorder(side: BorderSide(color: colors.lineStrong)),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 16, color: colors.ink),
            const SizedBox(width: MmSpace.s8),
            Text(label, style: type.labelLarge),
          ],
        ),
      ),
    );
  }
}

/// A "Q17" chip under the grid: opens that answer.
class _QuestionChip extends StatelessWidget {
  const _QuestionChip({required this.label, required this.semanticsLabel, required this.onTap});

  final String label;
  final String semanticsLabel;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return MmPressable(
      onTap: onTap,
      focusRadius: MmRadius.smallAll,
      haptic: MmPressHaptic.selection,
      semanticsLabel: semanticsLabel,
      builder: (context, pressed, _) => Padding(
        padding: const EdgeInsets.symmetric(vertical: MmSpace.s4, horizontal: MmSpace.s2),
        child: DecoratedBox(
          decoration: ShapeDecoration(
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
                child: Text(label, style: type.label.copyWith(fontSize: 14, fontFeatures: const [FontFeature.tabularFigures()])),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
