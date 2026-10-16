import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/art/art.dart';
import '../../../core/copy/formatters.dart';
import '../../../core/haptics/haptics.dart';
import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import '../data/mistake_index.dart';
import '../data/review_providers.dart';
import '../data/review_seen.dart';
import 'collapsible.dart';
import 'mistake_view.dart' show MissedTwiceGlyph;

/// "12 mistakes across 4 chapters".
String mistakesSummaryOf(ReviewIndex index) => ReviewCopy.mistakesSummary(index.openCount, index.openGroups.length);

/// The map's caption. When every open mistake is in one subject the subject is said here once,
/// so the rows do not repeat it; across subjects each row carries its own.
String mapCaptionOf(ReviewIndex index) {
  final subjects = {for (final g in index.openGroups) g.subjectId};
  final summary = mistakesSummaryOf(index);
  return subjects.length == 1 ? '${subjectName(subjects.first)}, $summary' : summary;
}

/// Whether the groups span more than one subject (rows then carry the subject's mark and name).
bool spansSubjects(Iterable<ChapterGroup> groups) => {for (final g in groups) g.subjectId}.length > 1;

/// "3 October" style for an attempt date, in the student's day.
String attemptDate(ReviewClock clock, DateTime t) => formatDayMonth(clock.local(t));

/// The largest number of mistakes any one of [groups] holds: the scale of every bar in the map.
int mapScaleOf(Iterable<ChapterGroup> groups) => groups.fold(1, (m, g) => math.max(m, g.items.length));

/// The mistake map: where the marks went, chapter by chapter (Review brief 12).
///
/// An open list on the ground, one row per chapter, hairlines between them and no card around
/// any of them, open or shut. Each row carries one filled track (volt for the share already repaired) with
/// its count and denominator beside it ("1 of 5 repaired"); the row's own number says how many are still
/// open. A row opens (one at a time) into the
/// mistakes as a vertical thread, with a key to repair them: one filled key for the paper to start
/// with when [leadKeyPrimary], the others as plain text links.
class MistakeMap extends ConsumerStatefulWidget {
  const MistakeMap({
    super.key,
    required this.groups,
    required this.clock,
    required this.onOpen,
    this.initialOpen = -1,
    this.scaleTo,
    this.showSubject,
    this.leadKeyPrimary = false,
    this.changes = const {},
    this.index,
  });

  /// The whole index, so a mistake whose question was also missed in another paper says so on
  /// its row ("Missed twice"). Null: rows say nothing about other papers.
  final ReviewIndex? index;

  final List<ChapterGroup> groups;

  /// What changed since the student last looked ([ReviewSeen.look]), by [chapterSeenKey]. A
  /// changed row rolls its number from the old count and carries one quiet mark; the map keeps
  /// a mark for as long as it is on screen.
  final Map<String, ChapterChange> changes;
  final ReviewClock clock;

  /// Opens the repair at a mistake.
  final ValueChanged<MistakeItem> onOpen;

  /// The index of the chapter that starts open, or -1.
  final int initialOpen;

  /// The mistakes the longest bar stands for. Null reads it from [groups]; the tab passes the
  /// full list's, so a shortened tab and the full page draw the same lengths.
  final int? scaleTo;

  /// Whether each row carries its subject's mark and name. Null: only when [groups] span more
  /// than one subject (one subject is said once in the section's caption).
  final bool? showSubject;

  /// The first paper's key is the one filled (volt) key of an opened chapter. Off where the screen
  /// already has its own volt key (the tab's hero), so there is one dominant action per screen.
  final bool leadKeyPrimary;

  @override
  ConsumerState<MistakeMap> createState() => _MistakeMapState();
}

class _MistakeMapState extends ConsumerState<MistakeMap> with SingleTickerProviderStateMixin {
  /// Each bar draws over 420 ms (`drawIn`), the next one starting 45 ms after it.
  static const Duration _draw = Duration(milliseconds: 420);
  static const Duration _step = Duration(milliseconds: 45);

  late final AnimationController _enter = AnimationController(vsync: this, duration: _total(widget.groups.length));
  String? _open;
  bool _started = false;

  /// The marks on screen: each change as it was first seen, kept while the map stays up.
  late final Map<String, ChapterChange> _marks = {...widget.changes};

  static Duration _total(int rows) => _draw + _step * (rows > 0 ? rows - 1 : 0);

  static String keyOf(ChapterGroup g) => '${g.subjectId}|${g.chapter}';

  @override
  void initState() {
    super.initState();
    if (widget.initialOpen >= 0 && widget.initialOpen < widget.groups.length) _open = keyOf(widget.groups[widget.initialOpen]);
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_started) return;
    _started = true;
    if (Motion.reduced(context)) {
      _enter.value = 1;
    } else {
      _enter.forward();
    }
  }

  @override
  void didUpdateWidget(MistakeMap old) {
    super.didUpdateWidget(old);
    if (!identical(old.changes, widget.changes) && widget.changes.isNotEmpty) {
      widget.changes.forEach((key, change) {
        // A second change while the map is up rolls on from what the row last showed.
        final had = _marks[key];
        _marks[key] = had == null ? change : ChapterChange(from: had.from, to: change.to);
      });
    }
  }

  @override
  void dispose() {
    _enter.dispose();
    super.dispose();
  }

  Interval _interval(int i, int rows) {
    final total = _total(rows).inMicroseconds;
    return Interval(i * _step.inMicroseconds / total, (i * _step.inMicroseconds + _draw.inMicroseconds) / total, curve: Motion.emphasized);
  }

  void _toggle(ChapterGroup g) {
    ref.read(hapticsProvider).tick();
    setState(() => _open = _open == keyOf(g) ? null : keyOf(g));
  }

  /// How many papers the question of a mistake was answered wrong in (1 when only this one).
  int _repeats(MistakeItem item) {
    final index = widget.index;
    return index == null ? 1 : index.missedElsewhere(item).length + 1;
  }

  @override
  Widget build(BuildContext context) {
    final groups = widget.groups;
    final scale = widget.scaleTo ?? mapScaleOf(groups);
    final showSubject = widget.showSubject ?? spansSubjects(groups);
    final colors = context.mmColors;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        for (var i = 0; i < groups.length; i++) ...[
          if (i > 0)
            AnimatedOpacity(
              duration: Motion.of(context, Motion.ui),
              opacity: (_open == keyOf(groups[i]) || _open == keyOf(groups[i - 1])) ? 0 : 1,
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: MmSpace.s12),
                child: Divider(height: 1, thickness: 1, color: colors.line),
              ),
            ),
          _ChapterRow(
            group: groups[i],
            clock: widget.clock,
            scale: scale,
            showSubject: showSubject,
            nameSubject: i == 0 || groups[i].subjectId != groups[i - 1].subjectId,
            open: _open == keyOf(groups[i]),
            leadKeyPrimary: widget.leadKeyPrimary,
            change: _marks[chapterSeenKey(groups[i])],
            repeats: _repeats,
            // Rows grow in one after another: the bar of row i starts 45 ms after the one above it.
            grow: _enter.drive(CurveTween(curve: _interval(i, groups.length))),
            onToggle: () => _toggle(groups[i]),
            onOpen: widget.onOpen,
          ),
        ],
      ],
    );
  }
}

class _ChapterRow extends StatelessWidget {
  const _ChapterRow({
    required this.group,
    required this.clock,
    required this.scale,
    required this.showSubject,
    required this.nameSubject,
    required this.open,
    required this.leadKeyPrimary,
    required this.grow,
    required this.onToggle,
    required this.onOpen,
    this.change,
    this.repeats,
  });

  final ChapterGroup group;

  /// What changed since the last look, or null.
  final ChapterChange? change;

  /// Papers the question of a mistake was missed in.
  final int Function(MistakeItem item)? repeats;
  final ReviewClock clock;
  final int scale;
  final bool showSubject;

  /// Whether the caption names the subject: on the first row and wherever the subject changes
  /// from the row above, so a run of one subject says it once.
  final bool nameSubject;
  final bool open;
  final bool leadKeyPrimary;
  final Animation<double> grow;
  final VoidCallback onToggle;
  final ValueChanged<MistakeItem> onOpen;

  static const _stripGlyph = EmblemSizes.chip;

  Widget _paperKey(List<PaperOpen> papers, int i) {
    final label = papers.length == 1
        ? ReviewCopy.repairGroupKey(papers[i].items.length)
        : ReviewCopy.repairGroupFromKey(papers[i].items.length, papers[i].source);
    void go() => onOpen(papers[i].items.first);
    if (i == 0 && leadKeyPrimary) return KeyButton(label: label, onPressed: go);
    if (i == 0) return KeyButton.secondary(label: label, onPressed: go);
    return Align(
      child: KeyButton.quiet(label: label, onPressed: go),
    );
  }

  /// The one quiet mark of a changed row: "New", "2 new" or "2 fewer". Null when nothing changed.
  String? get _markWord {
    final c = change;
    if (c == null) return null;
    if (c.isNew) return ReviewCopy.changedNew;
    if (c.delta > 0) return ReviewCopy.changedMore(c.delta);
    if (c.delta < 0) return ReviewCopy.changedFewer(-c.delta);
    return null;
  }

  List<MistakeItem> get _ordered {
    int rank(MistakeItem i) => i.stage.isOpen ? 0 : (i.stage == MistakeStage.repaired ? 1 : 2);
    return [...group.items]..sort((a, b) {
      final r = rank(a) - rank(b);
      if (r != 0) return r;
      final t = b.foundAt.compareTo(a.foundAt);
      return t != 0 ? t : a.number.compareTo(b.number);
    });
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final g = group;
    final summary = ReviewCopy.groupLine(subjectName(g.subjectId), g.openCount, g.repairedCount, g.setAsideCount);
    final papers = g.openByPaper;
    // Words that carry information: where the open ones were found, what is already done. The
    // subject only when the map spans several (otherwise the section's caption says it once).
    final caption = [
      if (showSubject && nameSubject) subjectName(g.subjectId),
      if (papers.isNotEmpty) ReviewCopy.fromPapers([for (final p in papers) p.source]),
      if (g.setAsideCount > 0) '${g.setAsideCount} set aside',
    ].join(', ');
    final indent = showSubject ? _stripGlyph + MmSpace.s12 : 0.0;

    // Shut, a row is typeset on the ground. Open, the chapter lifts onto `raised` (a fade of its own
    // surface, never a layout change) and its thread and keys sit on it.
    return Stack(
      children: [
        Positioned.fill(
          child: IgnorePointer(
            child: AnimatedOpacity(
              duration: Motion.of(context, Motion.card),
              curve: Motion.emphasized,
              opacity: open ? 1 : 0,
              child: DecoratedBox(
                decoration: ShapeDecoration(
                  color: colors.raised,
                  shape: mmShapeBorder(MmRadius.panelAll, side: BorderSide(color: colors.line)),
                ),
              ),
            ),
          ),
        ),
        _body(context, summary, caption, indent),
      ],
    );
  }

  Widget _body(BuildContext context, String summary, String caption, double indent) {
    final colors = context.mmColors;
    final type = context.mmType;
    final g = group;
    final papers = g.openByPaper;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        MmPressable(
          onTap: onToggle,
          pressedScale: 0.985,
          focusRadius: MmRadius.panelAll,
          semanticsLabel: '${g.chapter}. $summary.${_markWord == null ? '' : ' ${ReviewCopy.changedSpoken(_markWord!)}.'} ${ReviewCopy.groupExpandHint(open)}',
          builder: (context, pressed, _) => Padding(
            padding: const EdgeInsets.all(MmSpace.s12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    if (showSubject) ...[
                      SubjectEmblem(subject: g.subjectId, size: _stripGlyph, framed: false),
                      const SizedBox(width: MmSpace.s12),
                    ],
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(g.chapter, style: type.cardTitle, maxLines: 4, overflow: TextOverflow.ellipsis),
                          if (caption.isNotEmpty) ...[
                            const SizedBox(height: MmSpace.s2),
                            Text(
                              caption,
                              style: type.caption.copyWith(color: colors.ink2),
                              maxLines: 3,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ],
                        ],
                      ),
                    ),
                    const SizedBox(width: MmSpace.s8),
                    _Count(key: ValueKey('count-${change?.from}-${change?.to}'), group: g, from: change?.from, mark: _markWord),
                  ],
                ),
                const SizedBox(height: MmSpace.s12),
                Padding(
                  padding: EdgeInsets.only(left: indent),
                  child: Row(
                    children: [
                      // A row of only set-aside questions has no repaired share to draw: its
                      // caption and its number already say "set aside".
                      if (g.openCount > 0 || g.repairedCount > 0) ...[
                        Expanded(
                          child: ChapterTrack(repaired: g.repairedCount, total: g.items.length, grow: grow),
                        ),
                        const SizedBox(width: MmSpace.s12),
                        Text(
                          ReviewCopy.chapterRepaired(g.repairedCount, g.items.length),
                          style: type.caption.copyWith(color: colors.ink2),
                        ),
                      ] else
                        const Spacer(),
                      const SizedBox(width: MmSpace.s8),
                      AnimatedRotation(
                        turns: open ? 0.5 : 0,
                        duration: Motion.of(context, Motion.card),
                        curve: Motion.emphasized,
                        child: Icon(LucideIcons.chevronDown, size: 16, color: colors.ink2),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
        MmCollapsible(
          expanded: open,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Padding(
                padding: const EdgeInsets.only(bottom: MmSpace.s4),
                child: _Thread(items: _ordered, clock: clock, onOpen: onOpen, repeats: repeats),
              ),
              // One key per paper: a run covers one chapter of one paper, so the number on the
              // key is the number of mistakes the run holds. The first is the one filled key
              // (when the screen has no volt key of its own); the others are plain links.
              if (papers.isNotEmpty)
                Padding(
                  padding: const EdgeInsets.fromLTRB(MmSpace.s12, MmSpace.s8, MmSpace.s12, MmSpace.s12),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      for (var i = 0; i < papers.length; i++) ...[if (i > 0) const SizedBox(height: MmSpace.s4), _paperKey(papers, i)],
                    ],
                  ),
                )
              else
                const SizedBox(height: MmSpace.s12),
            ],
          ),
        ),
      ],
    );
  }
}

/// The chapter's number at the right of its row: what is still open, or what has been repaired
/// when nothing is.
class _Count extends StatelessWidget {
  const _Count({super.key, required this.group, this.from, this.mark});

  final ChapterGroup group;

  /// The open count at the last look: the number rolls from it. Null shows the number as it is.
  final int? from;

  /// The quiet mark under the word, or null.
  final String? mark;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final g = group;
    final (n, word, color) = g.openCount > 0
        ? (g.openCount, 'to repair', colors.ink)
        : g.repairedCount > 0
        ? (g.repairedCount, 'repaired', colors.accentText)
        : (g.setAsideCount, 'set aside', colors.ink2);
    return ExcludeSemantics(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          // A change rolls on from the number it showed (a repair finished), never from zero; a
          // change since the last look rolls from that look's number.
          MmCountUp(
            value: n,
            from: g.openCount > 0 && from != null ? from! : n,
            style: type.figureCompact.copyWith(fontSize: 28, height: 1.05, color: color),
          ),
          Text(word, style: type.caption.copyWith(fontSize: 11, height: 1.2, color: colors.ink2)),
          if (mark != null) ...[const SizedBox(height: MmSpace.s4), _ChangeMark(text: mark!)],
        ],
      ),
    );
  }
}

/// The one quiet mark of a chapter that changed since the last look: a small outlined tag that
/// fades in once (instant under reduced motion) and then stays still.
class _ChangeMark extends StatelessWidget {
  const _ChangeMark({required this.text});

  final String text;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return TweenAnimationBuilder<double>(
      tween: Tween(begin: 0, end: 1),
      duration: Motion.of(context, Motion.result),
      curve: Motion.out,
      builder: (context, t, child) => Opacity(opacity: t, child: child),
      child: DecoratedBox(
        decoration: ShapeDecoration(
          shape: StadiumBorder(side: BorderSide(color: colors.isNight ? colors.volt.withValues(alpha: 0.5) : colors.voltEdge)),
        ),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: MmSpace.s8, vertical: 1),
          child: Text(text, style: type.caption.copyWith(fontSize: 11, height: 1.3, fontWeight: FontWeight.w600, color: colors.accentText)),
        ),
      ),
    );
  }
}

/// One segment per mistake at one scale for the whole map: the longest bar is [scale] segments.
/// Coral is open, volt repaired, a ring set aside. [grow] (0 to 1) wipes it in from the left.
class MistakeBar extends StatelessWidget {
  const MistakeBar({
    super.key,
    required this.open,
    required this.repaired,
    required this.setAside,
    required this.scale,
    this.grow = const AlwaysStoppedAnimation(1),
    this.height = 10,
  });

  final int open;
  final int repaired;
  final int setAside;
  final int scale;
  final Animation<double> grow;
  final double height;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    return ExcludeSemantics(
      child: RepaintBoundary(
        child: CustomPaint(
          size: Size(double.infinity, height),
          painter: _BarPainter(
            open: open,
            repaired: repaired,
            setAside: setAside,
            scale: scale,
            grow: grow,
            // Night: a cooler, deeper coral than the bubble's, so a long bar does not shout.
            wrong: colors.isNight ? Color.lerp(colors.wrongBorder, colors.wrongMark, 0.72)! : colors.wrongMark,
            volt: colors.volt,
            voltEdge: colors.isNight ? null : colors.voltEdge,
            ring: colors.ink3,
          ),
        ),
      ),
    );
  }
}

class _BarPainter extends CustomPainter {
  _BarPainter({
    required this.open,
    required this.repaired,
    required this.setAside,
    required this.scale,
    required this.grow,
    required this.wrong,
    required this.volt,
    required this.voltEdge,
    required this.ring,
  }) : super(repaint: grow);

  final int open;
  final int repaired;
  final int setAside;
  final int scale;
  final Animation<double> grow;
  final Color wrong;
  final Color volt;
  final Color? voltEdge;
  final Color ring;

  /// The widest one mistake gets, so a chapter with a single mistake is a stub, not a slab.
  static const double _maxSegment = 48;

  @override
  void paint(Canvas canvas, Size size) {
    final total = open + repaired + setAside;
    if (total == 0 || size.width <= 0) return;
    final unit = math.min(size.width / math.max(scale, 1), _maxSegment);
    final gap = unit >= 12 ? 3.0 : (unit >= 6 ? 2.0 : 0.0);
    final h = size.height;
    final reveal = (total * unit * grow.value.clamp(0.0, 1.0)).clamp(0.0, size.width);

    canvas.save();
    canvas.clipRect(Rect.fromLTWH(0, -2, reveal + 0.5, h + 4));
    var x = 0.0;
    void run(int count, Paint? fill, Paint? stroke) {
      if (count <= 0) return;
      if (unit >= 6) {
        for (var i = 0; i < count; i++) {
          final r = RRect.fromRectAndRadius(Rect.fromLTWH(x, 0, unit - gap, h), const Radius.circular(4));
          if (fill != null) canvas.drawRRect(r, fill);
          if (stroke != null) canvas.drawRRect(r.deflate(0.6), stroke);
          x += unit;
        }
      } else {
        final r = RRect.fromRectAndRadius(Rect.fromLTWH(x, 0, count * unit - 1, h), const Radius.circular(4));
        if (fill != null) canvas.drawRRect(r, fill);
        if (stroke != null) canvas.drawRRect(r.deflate(0.6), stroke);
        x += count * unit;
      }
    }

    run(open, Paint()..color = wrong, null);
    run(
      repaired,
      Paint()..color = volt,
      voltEdge == null
          ? null
          : (Paint()
              ..style = PaintingStyle.stroke
              ..strokeWidth = 1
              ..color = voltEdge!),
    );
    run(
      setAside,
      null,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1.2
        ..color = ring,
    );
    canvas.restore();
  }

  @override
  bool shouldRepaint(_BarPainter old) =>
      old.open != open ||
      old.repaired != repaired ||
      old.setAside != setAside ||
      old.scale != scale ||
      old.grow != grow ||
      old.wrong != wrong ||
      old.volt != volt ||
      old.voltEdge != voltEdge ||
      old.ring != ring;
}


/// One filled track for a chapter: the share of its mistakes already repaired, in volt, on a
/// quiet rail. It is the whole bar of a row (one bar, not a segment per mistake); the words beside
/// it say the count with its denominator ("1 of 5 repaired"). [grow] (0 to 1) wipes it in.
class ChapterTrack extends StatelessWidget {
  const ChapterTrack({super.key, required this.repaired, required this.total, this.grow = const AlwaysStoppedAnimation(1), this.height = 8});

  final int repaired;
  final int total;
  final Animation<double> grow;
  final double height;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    return ExcludeSemantics(
      child: RepaintBoundary(
        child: CustomPaint(
          size: Size(double.infinity, height),
          painter: _TrackPainter(
            share: total <= 0 ? 0 : (repaired / total).clamp(0.0, 1.0),
            grow: grow,
            rail: colors.line,
            volt: colors.volt,
            voltEdge: colors.isNight ? null : colors.voltEdge,
          ),
        ),
      ),
    );
  }
}

class _TrackPainter extends CustomPainter {
  _TrackPainter({required this.share, required this.grow, required this.rail, required this.volt, required this.voltEdge}) : super(repaint: grow);

  final double share;
  final Animation<double> grow;
  final Color rail;
  final Color volt;
  final Color? voltEdge;

  @override
  void paint(Canvas canvas, Size size) {
    if (size.width <= 0) return;
    final r = Radius.circular(size.height / 2);
    canvas.drawRRect(RRect.fromRectAndRadius(Offset.zero & size, r), Paint()..color = rail);
    final width = size.width * share * grow.value.clamp(0.0, 1.0);
    if (width <= 0) return;
    // A repaired share never draws narrower than its own height: a stub is still a visible dot.
    final fill = RRect.fromRectAndRadius(Rect.fromLTWH(0, 0, math.max(width, size.height), size.height), r);
    canvas.drawRRect(fill, Paint()..color = volt);
    final edge = voltEdge;
    if (edge != null) {
      canvas.drawRRect(
        fill.deflate(0.5),
        Paint()
          ..style = PaintingStyle.stroke
          ..strokeWidth = 1
          ..color = edge,
      );
    }
  }

  @override
  bool shouldRepaint(_TrackPainter old) =>
      old.share != share || old.grow != grow || old.rail != rail || old.volt != volt || old.voltEdge != voltEdge;
}

/// The chapter's mistakes as a vertical thread: a rail under the row's glyph, one bubble per
/// mistake in its stage, the question and where it was found, the stage in words.
class _Thread extends StatelessWidget {
  const _Thread({required this.items, required this.clock, required this.onOpen, this.repeats});

  final List<MistakeItem> items;
  final ReviewClock clock;
  final ValueChanged<MistakeItem> onOpen;
  final int Function(MistakeItem item)? repeats;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        for (var i = 0; i < items.length; i++)
          ThreadRowIn(
            index: i,
            child: MistakeRow(
              item: items[i],
              clock: clock,
              first: i == 0,
              last: i == items.length - 1,
              missedTimes: repeats?.call(items[i]) ?? 1,
              onTap: () => onOpen(items[i]),
            ),
          ),
      ],
    );
  }
}

/// One mistake on the thread: its bubble on the rail, the question number, where and when it was
/// found, its stage in words.
class MistakeRow extends StatelessWidget {
  /// The rail column: 12 dp of row padding plus the 40 dp plate and its 12 dp gap, measured from
  /// the row's left edge (the card text edge E1), so the text begins on E2.
  static const double railWidth = 64;

  const MistakeRow({
    super.key,
    required this.item,
    required this.clock,
    required this.onTap,
    this.first = true,
    this.last = true,
    this.missedTimes = 1,
  });

  final MistakeItem item;

  /// How many papers this question was answered wrong in, from the student's own attempts. Two or
  /// more adds "Missed twice" with a doubled bubble.
  final int missedTimes;
  final ReviewClock clock;
  final VoidCallback onTap;
  final bool first;
  final bool last;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final found = ReviewCopy.foundIn(item.source, formatDayMonth(clock.local(item.foundAt)));
    final tappable = item.stage != MistakeStage.setAside;
    final repeat = missedTimes >= 2 ? ReviewCopy.missedTimes(missedTimes) : null;
    final label = '${ReviewCopy.questionLabel(item.number)}, ${item.chapter}. $found.${repeat == null ? '' : ' $repeat.'} ${_stageWord(item.stage)}.';
    // The bubble carries the stage's colour; the word beside it stays quiet, so red crosses and
    // volt text do not compete.
    final bubble = switch (item.stage) {
      MistakeStage.found => BubbleState.wrong,
      MistakeStage.reviewed => BubbleState.marked,
      MistakeStage.repaired => BubbleState.filled,
      MistakeStage.setAside => BubbleState.blank,
    };
    return MmPressable(
      onTap: tappable ? onTap : null,
      pressedScale: 0.985,
      focusRadius: MmRadius.keyAll,
      haptic: MmPressHaptic.selection,
      highlight: true,
      semanticsLabel: label,
      builder: (context, pressed, _) => ConstrainedBox(
        constraints: const BoxConstraints(minHeight: 56),
        child: IntrinsicHeight(
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              SizedBox(
                // The rail column ends on E2 (gutter 16 + 12 + 52), so the question text starts there;
                // its dot sits on the centre of the chapter's 40 dp mark above.
                width: MistakeRow.railWidth,
                child: CustomPaint(
                  painter: _RailPainter(color: colors.line, top: !first, bottom: !last),
                  child: Align(
                    alignment: Alignment.center,
                    child: DecoratedBox(
                      decoration: BoxDecoration(color: colors.ground, shape: BoxShape.circle),
                      child: Padding(
                        padding: const EdgeInsets.all(4),
                        child: Bubble(state: bubble, size: 14, animate: false),
                      ),
                    ),
                  ),
                ),
              ),
              Expanded(
                child: Padding(
                  padding: const EdgeInsets.symmetric(vertical: MmSpace.s12),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Text(ReviewCopy.questionLabel(item.number), style: type.labelLarge),
                      const SizedBox(height: MmSpace.s2),
                      Text(found, style: type.caption.copyWith(color: colors.ink2)),
                      if (repeat != null) ...[
                        const SizedBox(height: MmSpace.s4),
                        Row(
                          children: [
                            const MissedTwiceGlyph(size: 12),
                            const SizedBox(width: MmSpace.s4),
                            Flexible(child: Text(repeat, style: type.caption.copyWith(color: colors.badText))),
                          ],
                        ),
                      ],
                    ],
                  ),
                ),
              ),
              const SizedBox(width: MmSpace.s8),
              Align(
                alignment: Alignment.centerRight,
                child: Text(_stageWord(item.stage), style: type.caption.copyWith(color: colors.ink2)),
              ),
              // The word and the chevron end on E1 from the right (12 dp from the card edge).
              const SizedBox(width: MmSpace.s8),
              SizedBox(width: 16, child: tappable ? Icon(LucideIcons.chevronRight, size: 16, color: colors.ink3) : null),
              const SizedBox(width: MmSpace.s12),
            ],
          ),
        ),
      ),
    );
  }

  static String _stageWord(MistakeStage s) => switch (s) {
    MistakeStage.found => ReviewCopy.found,
    MistakeStage.reviewed => ReviewCopy.reviewed,
    MistakeStage.repaired => ReviewCopy.repaired,
    MistakeStage.setAside => ReviewCopy.setAside,
  };
}

class _RailPainter extends CustomPainter {
  const _RailPainter({required this.color, required this.top, required this.bottom});

  final Color color;
  final bool top;
  final bool bottom;

  @override
  void paint(Canvas canvas, Size size) {
    final x = size.width / 2, mid = size.height / 2;
    final p = Paint()
      ..color = color
      ..strokeWidth = 2;
    if (top) canvas.drawLine(Offset(x, 0), Offset(x, mid), p);
    if (bottom) canvas.drawLine(Offset(x, mid), Offset(x, size.height), p);
  }

  @override
  bool shouldRepaint(_RailPainter old) => old.color != color || old.top != top || old.bottom != bottom;
}


/// A thread row fading in as its chapter opens: 160 ms, each row 30 ms after the one above it
/// (capped, so a long chapter never takes long), the first starting when the section's own content
/// fade does ([MmCollapsible.fadeLead]), so the stagger is seen and not played under it. The rows are only built while the chapter is open,
/// so this plays on every opening and never while the list scrolls. Under reduced motion the row
/// is simply there.
@visibleForTesting
class ThreadRowIn extends StatefulWidget {
  const ThreadRowIn({super.key, required this.index, required this.child});

  final int index;
  final Widget child;

  @override
  State<ThreadRowIn> createState() => _ThreadRowInState();
}

class _ThreadRowInState extends State<ThreadRowIn> with SingleTickerProviderStateMixin {
  static const Duration _fade = Duration(milliseconds: 160);
  static const Duration _step = Duration(milliseconds: 30);
  static const int _cap = 8;

  late final AnimationController _c;
  late final Animation<double> _opacity;
  bool _started = false;

  @override
  void initState() {
    super.initState();
    final delay = MmCollapsible.fadeLead + _step * (widget.index < _cap ? widget.index : _cap);
    final total = delay + _fade;
    _c = AnimationController(vsync: this, duration: total);
    _opacity = CurvedAnimation(parent: _c, curve: Interval(delay.inMicroseconds / total.inMicroseconds, 1, curve: Curves.easeOut));
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_started) return;
    _started = true;
    if (Motion.reduced(context)) {
      _c.value = 1;
    } else {
      _c.forward();
    }
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => FadeTransition(opacity: _opacity, child: widget.child);
}
