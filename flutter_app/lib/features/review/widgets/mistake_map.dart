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
import 'collapsible.dart';

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
/// any of them, open or shut. Each row carries a bar with one segment per mistake (coral open, volt repaired,
/// a ring for set aside), left-aligned and drawn at the same scale on every row, so a longer bar
/// means more mistakes and chapters compare at a glance. A row opens (one at a time) into the
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
  });

  final List<ChapterGroup> groups;
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
  late final AnimationController _enter = AnimationController(vsync: this, duration: const Duration(milliseconds: 900));
  String? _open;
  bool _started = false;

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
  void dispose() {
    _enter.dispose();
    super.dispose();
  }

  void _toggle(ChapterGroup g) {
    ref.read(hapticsProvider).tick();
    setState(() => _open = _open == keyOf(g) ? null : keyOf(g));
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
            // Rows grow in one after another: the bar of row i starts at i * 0.07 of the run.
            grow: _enter.drive(
              CurveTween(curve: Interval((i * 0.07).clamp(0.0, 0.5), (i * 0.07 + 0.55).clamp(0.2, 1.0), curve: Motion.emphasized)),
            ),
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
  });

  final ChapterGroup group;
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

  static const _stripGlyph = 40.0;

  Widget _paperKey(List<PaperOpen> papers, int i) {
    final label = papers.length == 1
        ? ReviewCopy.repairGroupKey(papers[i].items.length)
        : ReviewCopy.repairGroupFromKey(papers[i].items.length, papers[i].source);
    void go() => onOpen(papers[i].items.first);
    if (i == 0 && leadKeyPrimary) return KeyButton(label: label, onPressed: go);
    if (i == 0) return KeyButton.secondary(label: label, onPressed: go);
    return Align(child: KeyButton.quiet(label: label, onPressed: go));
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
    final type = context.mmType;
    final g = group;
    final summary = ReviewCopy.groupLine(subjectName(g.subjectId), g.openCount, g.repairedCount, g.setAsideCount);
    final papers = g.openByPaper;
    // Words that carry information: where the open ones were found, what is already done. The
    // subject only when the map spans several (otherwise the section's caption says it once).
    final caption = [
      if (showSubject && nameSubject) subjectName(g.subjectId),
      if (papers.isNotEmpty) ReviewCopy.fromPapers([for (final p in papers) p.source]),
      if (g.repairedCount > 0) '${g.repairedCount} repaired',
      if (g.setAsideCount > 0) '${g.setAsideCount} set aside',
    ].join(', ');
    final indent = showSubject ? _stripGlyph + MmSpace.s12 : 0.0;

    // No surface under the row, open or shut: the thread and its keys sit on the ground.
    return Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          MmPressable(
            onTap: onToggle,
            pressedScale: 0.985,
            focusRadius: MmRadius.panelAll,
            semanticsLabel: '${g.chapter}. $summary. ${ReviewCopy.groupExpandHint(open)}',
            builder: (context, pressed, _) => Padding(
              padding: const EdgeInsets.fromLTRB(MmSpace.s12, 14, MmSpace.s12, 14),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      if (showSubject) ...[SubjectEmblem(subject: g.subjectId, size: _stripGlyph, framed: false), const SizedBox(width: MmSpace.s12)],
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(g.chapter, style: type.cardTitle, maxLines: 2, overflow: TextOverflow.ellipsis),
                            const SizedBox(height: 2),
                            Text(caption, style: type.caption.copyWith(color: colors.ink2), maxLines: 2, overflow: TextOverflow.ellipsis),
                          ],
                        ),
                      ),
                      const SizedBox(width: MmSpace.s8),
                      _Count(group: g),
                    ],
                  ),
                  const SizedBox(height: MmSpace.s12),
                  Padding(
                    padding: EdgeInsets.only(left: indent),
                    child: Row(
                      children: [
                        Expanded(
                          child: MistakeBar(open: g.openCount, repaired: g.repairedCount, setAside: g.setAsideCount, scale: scale, grow: grow),
                        ),
                        const SizedBox(width: MmSpace.s8),
                        AnimatedRotation(
                          turns: open ? 0.5 : 0,
                          duration: Motion.of(context, Motion.card),
                          curve: Motion.emphasized,
                          child: Icon(LucideIcons.chevronDown, size: 20, color: colors.ink2),
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
                  child: _Thread(items: _ordered, clock: clock, onOpen: onOpen),
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
                        for (var i = 0; i < papers.length; i++) ...[
                          if (i > 0) const SizedBox(height: MmSpace.s4),
                          _paperKey(papers, i),
                        ],
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
  const _Count({required this.group});

  final ChapterGroup group;

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
          Text('$n', style: type.figureCompact.copyWith(fontSize: 28, height: 1.05, color: color)),
          Text(word, style: type.caption.copyWith(fontSize: 11, height: 1.2, color: colors.ink2)),
        ],
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

/// The chapter's mistakes as a vertical thread: a rail under the row's glyph, one bubble per
/// mistake in its stage, the question and where it was found, the stage in words.
class _Thread extends StatelessWidget {
  const _Thread({required this.items, required this.clock, required this.onOpen});

  final List<MistakeItem> items;
  final ReviewClock clock;
  final ValueChanged<MistakeItem> onOpen;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        for (var i = 0; i < items.length; i++)
          MistakeRow(item: items[i], clock: clock, first: i == 0, last: i == items.length - 1, onTap: () => onOpen(items[i])),
      ],
    );
  }
}

/// One mistake on the thread: its bubble on the rail, the question number, where and when it was
/// found, its stage in words.
class MistakeRow extends StatelessWidget {
  const MistakeRow({super.key, required this.item, required this.clock, required this.onTap, this.first = true, this.last = true});

  final MistakeItem item;
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
    final label = '${ReviewCopy.questionLabel(item.number)}, ${item.chapter}. $found. ${_stageWord(item.stage)}.';
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
                width: 64,
                child: CustomPaint(
                  painter: _RailPainter(color: colors.line, top: !first, bottom: !last),
                  child: Align(
                    alignment: Alignment.center,
                    child: DecoratedBox(
                      decoration: BoxDecoration(color: colors.ground, shape: BoxShape.circle),
                      child: Padding(padding: const EdgeInsets.all(4), child: Bubble(state: bubble, size: 14, animate: false)),
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
                      const SizedBox(height: 2),
                      Text(found, style: type.caption.copyWith(color: colors.ink2)),
                    ],
                  ),
                ),
              ),
              const SizedBox(width: MmSpace.s8),
              Align(
                alignment: Alignment.centerRight,
                child: Text(_stageWord(item.stage), style: type.caption.copyWith(color: colors.ink2)),
              ),
              SizedBox(width: 28, child: tappable ? Icon(LucideIcons.chevronRight, size: 16, color: colors.ink3) : null),
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
