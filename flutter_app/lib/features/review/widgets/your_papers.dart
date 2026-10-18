// Your papers (19 Oct, owner D106 and G20): the stats strip, the subject filter and the papers, newest first. The rows keep
// the look Review's "Recent papers" had (a paper spine on the left edge, the marks counting up as the row comes into view,
// the change from the last paper of its kind with a small mark that nudges once), so nothing of the v15.2 polish is lost;
// what changed is where they sit (at the top) and how many show (every paper, filtered by subject).
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/copy/formatters.dart' show formatSignedNumber;
import '../../../core/haptics/haptics.dart';
import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../../today/widgets/sheet_section.dart' show CountedMarks;
import '../../today/widgets/today_entrance.dart' show todayEnterValue;
import '../../today/widgets/today_reveal.dart';
import '../../today/widgets/today_type.dart';
import '../copy.dart';
import '../model/your_papers.dart';

/// The strip at the top of Your papers: papers sat, the latest marks with their change, and the mistakes still to repair.
/// Three figures on the ground between hairlines, no box. Each is a way in: the papers figure and the repairs figure
/// scroll to their sections, the latest figure opens that paper.
class PapersStripView extends StatelessWidget {
  const PapersStripView({super.key, required this.strip, this.onPapers, this.onLatest, this.onRepairs});

  final PapersStrip strip;
  final VoidCallback? onPapers;
  final ValueChanged<PaperLine>? onLatest;
  final VoidCallback? onRepairs;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final latest = strip.latest;
    final rule = VerticalDivider(width: MmSpace.s16, thickness: 1, color: colors.line);
    return IntrinsicHeight(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Expanded(
            child: _Stat(
              key: const ValueKey('strip-papers'),
              figure: '${strip.papers}',
              memoryKey: 'papers.strip.count',
              value: strip.papers,
              caption: ReviewCopy.stripPapers(strip.papers),
              semantics: ReviewCopy.stripPapersSpoken(strip.papers),
              onTap: onPapers,
            ),
          ),
          rule,
          Expanded(
            flex: 5,
            child: latest == null || latest.marks == null
                ? _Stat(
                    key: const ValueKey('strip-latest'),
                    figure: '–',
                    caption: ReviewCopy.stripLatestNone,
                    semantics: ReviewCopy.stripLatestNone,
                  )
                : _Stat(
                    key: const ValueKey('strip-latest'),
                    figure: formatSignedNumber(latest.marks!),
                    value: latest.marks!,
                    memoryKey: 'papers.strip.latest.${latest.attemptId}',
                    unit: ReviewCopy.stripOf(latest.max ?? 0),
                    caption: latest.change ?? ReviewCopy.stripLatestCaption(latest.name),
                    up: latest.up,
                    semantics: ReviewCopy.stripLatestSpoken(latest.name, latest.marks!, latest.max ?? 0, latest.change),
                    onTap: onLatest == null ? null : () => onLatest!(latest),
                  ),
          ),
          rule,
          Expanded(
            flex: 4,
            child: _Stat(
              key: const ValueKey('strip-repairs'),
              figure: '${strip.toRepair}',
              value: strip.toRepair,
              memoryKey: 'papers.strip.repairs',
              caption: ReviewCopy.stripRepairs(strip.toRepair),
              semantics: ReviewCopy.stripRepairsSpoken(strip.toRepair),
              onTap: onRepairs,
            ),
          ),
        ],
      ),
    );
  }
}

class _Stat extends StatelessWidget {
  const _Stat({super.key, required this.figure, required this.caption, required this.semantics, this.value, this.memoryKey, this.unit, this.up, this.onTap});

  final String figure;
  final num? value;
  final String? memoryKey;

  /// "of 50", beside the figure.
  final String? unit;
  final String caption;

  /// The caption is a change: up in ink with its mark, down quieter.
  final bool? up;
  final String semantics;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final figureStyle = type.paperFigure;
    final number = value == null
        ? Text(figure, style: figureStyle)
        : MmCountUp(
            value: value!,
            style: figureStyle,
            memoryKey: memoryKey,
            format: (v) => formatSignedNumber(v.round()),
          );
    final body = Padding(
      padding: const EdgeInsets.symmetric(vertical: MmSpace.s8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          FittedBox(
            fit: BoxFit.scaleDown,
            alignment: Alignment.centerLeft,
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.baseline,
              textBaseline: TextBaseline.alphabetic,
              children: [
                number,
                if (unit != null) ...[
                  const SizedBox(width: MmSpace.s4),
                  Text(unit!, style: type.caption.copyWith(color: colors.ink3)),
                ],
              ],
            ),
          ),
          const SizedBox(height: MmSpace.s4),
          Row(
            children: [
              if (up != null) ...[
                Icon(up! ? LucideIcons.arrowUpRight : LucideIcons.arrowDownRight, size: 13, color: up! ? colors.ink : colors.ink2),
                const SizedBox(width: 2),
              ],
              Flexible(
                child: Text(
                  caption,
                  style: type.micro.copyWith(color: up == true ? colors.ink : colors.ink2, fontWeight: up == true ? FontWeight.w600 : null),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ],
          ),
        ],
      ),
    );
    if (onTap == null) return Semantics(container: true, label: semantics, excludeSemantics: true, child: body);
    return MmPressable(
      semanticsLabel: semantics,
      onTap: onTap,
      pressedScale: 0.97,
      focusRadius: MmRadius.smallAll,
      haptic: MmPressHaptic.selection,
      builder: (context, pressed, _) => body,
    );
  }
}

/// The subject filter: "All subjects" and one chip per subject with papers, on the app's one chip rail (it snaps, fades
/// the edge it runs past, peeks the next chip, and on its first view nudges sideways once so a student sees it scrolls).
class PaperSubjectFilter extends StatelessWidget {
  const PaperSubjectFilter({super.key, required this.subjects, required this.selected, required this.onSelected});

  final List<PaperSubject> subjects;

  /// The chosen subject's name, or null for every subject.
  final String? selected;
  final ValueChanged<String?> onSelected;

  @override
  Widget build(BuildContext context) {
    final labels = [ReviewCopy.allSubjects, for (final s in subjects) s.name];
    final at = selected == null ? 0 : 1 + subjects.indexWhere((s) => s.name == selected);
    return ChipRail.labelled(
      key: const ValueKey('papers-subject-filter'),
      labels: labels,
      selected: at < 0 ? 0 : at,
      semanticLabel: ReviewCopy.filterSpoken,
      nudge: true,
      onSelected: (i) => onSelected(i == 0 ? null : subjects[i - 1].name),
    );
  }
}

/// The papers, newest first: the first [firstRows], then "Show all N papers" opens the rest in place. A row brought in
/// by "See it in Your papers" ([focus]) is shown even past the first rows and is marked for a moment.
class PaperList extends StatefulWidget {
  const PaperList({super.key, required this.papers, required this.onOpen, this.subject, this.focus, this.keyFor});

  final List<PaperLine> papers;
  final ValueChanged<PaperLine> onOpen;

  /// The filter, for the heading's caption.
  final String? subject;

  /// The paper to mark (and to show, wherever it is in the list).
  final String? focus;

  /// A key per row, so the screen can scroll a row into view.
  final GlobalKey Function(String attemptId)? keyFor;

  static const int firstRows = 6;

  @override
  State<PaperList> createState() => _PaperListState();
}

class _PaperListState extends State<PaperList> {
  bool _all = false;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final papers = widget.papers;
    final focusAt = widget.focus == null ? -1 : papers.indexWhere((p) => p.attemptId == widget.focus);
    final all = _all || focusAt >= PaperList.firstRows || papers.length <= PaperList.firstRows + 1;
    final shown = all ? papers : papers.take(PaperList.firstRows).toList();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            Expanded(child: Semantics(header: true, child: Text(ReviewCopy.yourPapersHeading, style: type.title))),
            Text(ReviewCopy.newestFirst, style: type.caption.copyWith(color: colors.ink2)),
          ],
        ),
        const SizedBox(height: MmSpace.s2),
        Text(ReviewCopy.papersCaption(papers.length, widget.subject), style: type.small.copyWith(color: colors.ink2)),
        const SizedBox(height: MmSpace.s4),
        for (var k = 0; k < shown.length; k++) ...[
          if (k > 0) Divider(height: 1, thickness: 1, color: colors.line.withValues(alpha: 0.7)),
          KeyedSubtree(
            key: widget.keyFor?.call(shown[k].attemptId),
            child: PaperRowView(
              line: shown[k],
              index: k,
              marked: shown[k].attemptId == widget.focus,
              onTap: () => widget.onOpen(shown[k]),
            ),
          ),
        ],
        if (!all) ...[
          Divider(height: 1, thickness: 1, color: colors.line.withValues(alpha: 0.7)),
          MmPressable(
            onTap: () => setState(() => _all = true),
            pressedScale: 0.985,
            focusRadius: MmRadius.keyAll,
            haptic: MmPressHaptic.selection,
            highlight: true,
            semanticsLabel: ReviewCopy.showAllPapers(papers.length),
            builder: (context, pressed, _) => ConstrainedBox(
              constraints: const BoxConstraints(minHeight: 52),
              child: Row(
                children: [
                  Expanded(child: Text(ReviewCopy.showAllPapers(papers.length), style: type.labelLarge.copyWith(color: colors.ink2))),
                  Icon(LucideIcons.chevronDown, size: 18, color: colors.ink3),
                ],
              ),
            ),
          ),
        ],
      ],
    );
  }
}

/// One paper: its spine, name, subject and date, the split of its answers, and its marks out of the maximum with the
/// change from the last paper of its kind. A sealed result shows no marks and opens the sealed sheet. Tapping it opens
/// its result and answers.
class PaperRowView extends ConsumerWidget {
  const PaperRowView({super.key, required this.line, required this.onTap, this.index = 0, this.marked = false});

  final PaperLine line;
  final VoidCallback onTap;

  /// The row's place from the top: its marks start counting 60 ms after the row above.
  final int index;

  /// Brought in by "See it in Your papers": a volt wash that fades over [markFor].
  final bool marked;

  static const Duration markFor = Duration(milliseconds: 1800);

  String get _semantics {
    final head = '${line.name}, ${line.subject}, ${line.when}';
    if (line.sealed) return '$head. ${ReviewCopy.paperSealed}. ${ReviewCopy.opensSealed}';
    return [
      head,
      '${formatSignedNumber(line.marks ?? 0)} of ${line.max} marks',
      '${line.right} right, ${line.wrong} wrong, ${line.blank} not attempted',
      ?line.change,
      ReviewCopy.opensResult,
    ].join('. ');
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = context.mmColors;
    final type = context.mmType;
    final row = MmPressable(
      semanticsLabel: _semantics,
      onTap: () {
        ref.read(hapticsProvider).selection();
        onTap();
      },
      pressedScale: 0.985,
      focusRadius: MmRadius.smallAll,
      // The row grows into the result it opens (MOTION.md C4).
      captureLaunch: true,
      builder: (context, pressed, _) => Padding(
        padding: const EdgeInsets.symmetric(vertical: MmSpace.s12),
        child: IntrinsicHeight(
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              _Spine(right: line.right, wrong: line.wrong, blank: line.blank, sealed: line.sealed),
              const SizedBox(width: MmSpace.s12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Text(line.name, style: type.cardTitle, maxLines: 1, overflow: TextOverflow.ellipsis),
                    const SizedBox(height: 2),
                    Text('${line.subject}, ${line.when}', style: type.caption.copyWith(color: colors.ink2), maxLines: 2, overflow: TextOverflow.ellipsis),
                    if (!line.sealed) ...[
                      const SizedBox(height: MmSpace.s6),
                      Text(ReviewCopy.paperSplit(line.right, line.wrong, line.blank), style: type.micro.copyWith(color: colors.ink3)),
                    ],
                  ],
                ),
              ),
              const SizedBox(width: MmSpace.s12),
              if (line.sealed)
                Row(
                  children: [
                    Icon(LucideIcons.mail, size: 16, color: colors.accentText),
                    const SizedBox(width: MmSpace.s6),
                    Text(ReviewCopy.openYourResult, style: type.caption.copyWith(color: colors.accentText, fontWeight: FontWeight.w600)),
                  ],
                )
              else
                TodayReveal(
                  child: Builder(
                    builder: (context) {
                      final stagger = Duration(milliseconds: 60 * math.min(index, 6));
                      final count = todayEnterValue(context, delay: stagger, length: Motion.numberRoll);
                      final nudge = todayEnterValue(context, delay: stagger + Motion.numberRoll, length: const Duration(milliseconds: 360), curve: Curves.linear);
                      return Column(
                        crossAxisAlignment: CrossAxisAlignment.end,
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Row(
                            crossAxisAlignment: CrossAxisAlignment.baseline,
                            textBaseline: TextBaseline.alphabetic,
                            children: [
                              CountedMarks(marks: line.marks ?? 0, style: type.paperFigure, progress: count),
                              const SizedBox(width: MmSpace.s4),
                              Text(ReviewCopy.stripOf(line.max ?? 0), style: type.caption.copyWith(color: colors.ink3)),
                            ],
                          ),
                          if (line.change != null) ...[
                            const SizedBox(height: 2),
                            _Change(text: line.change!, up: line.up, nudge: nudge),
                          ],
                        ],
                      );
                    },
                  ),
                ),
            ],
          ),
        ),
      ),
    );
    if (!marked) return row;
    // The mark: a volt wash behind the row that fades out, so the eye lands on the paper it came for.
    return TweenAnimationBuilder<double>(
      key: ValueKey('mark-${line.attemptId}'),
      tween: Tween(begin: 1, end: 0),
      duration: Motion.reduced(context) ? Duration.zero : markFor,
      curve: const Interval(0.35, 1, curve: Curves.easeOut),
      builder: (context, t, child) => DecoratedBox(
        key: const ValueKey('paper-row-mark'),
        decoration: BoxDecoration(
          color: colors.volt.withValues(alpha: (colors.isNight ? 0.14 : 0.22) * t),
          borderRadius: MmRadius.smallAll,
        ),
        child: child,
      ),
      child: row,
    );
  }
}

class _Change extends StatelessWidget {
  const _Change({required this.text, required this.up, required this.nudge});

  final String text;
  final bool? up;
  final Animation<double> nudge;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final icon = up == null ? LucideIcons.minus : (up! ? LucideIcons.arrowUpRight : LucideIcons.arrowDownRight);
    final color = up == true ? colors.ink : colors.ink2;
    final dir = up == null ? Offset.zero : (up! ? const Offset(1, -1) : const Offset(1, 1));
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        AnimatedBuilder(
          animation: nudge,
          child: Icon(icon, size: 13, color: color),
          builder: (context, child) => Transform.translate(offset: dir * (2.5 * math.sin(math.pi * nudge.value)), child: child),
        ),
        const SizedBox(width: 2),
        Text(text, style: type.micro.copyWith(color: color, fontWeight: up == true ? FontWeight.w600 : FontWeight.w500)),
      ],
    );
  }
}

/// The paper's spine: a 6 dp bar the height of the row, where the marks went from the top down (right in ink, wrong in
/// coral, blank as the empty groove). It draws down the first time the row comes into view. A sealed paper has the
/// empty groove only.
class _Spine extends StatelessWidget {
  const _Spine({required this.right, required this.wrong, required this.blank, required this.sealed});

  final int right;
  final int wrong;
  final int blank;
  final bool sealed;

  @override
  Widget build(BuildContext context) => TodayReveal(
    child: Builder(
      builder: (context) => ExcludeSemantics(
        child: RepaintBoundary(
          child: CustomPaint(
            size: const Size(6, 0),
            painter: _SpinePainter(
              right: sealed ? 0 : right,
              wrong: sealed ? 0 : wrong,
              blank: sealed ? 0 : blank,
              colors: context.mmColors,
              draw: todayEnterValue(context, delay: const Duration(milliseconds: 40), length: Motion.drawIn),
            ),
          ),
        ),
      ),
    ),
  );
}

class _SpinePainter extends CustomPainter {
  _SpinePainter({required this.right, required this.wrong, required this.blank, required this.colors, required this.draw}) : super(repaint: draw);

  final int right;
  final int wrong;
  final int blank;
  final MmColors colors;
  final Animation<double> draw;

  @override
  void paint(Canvas canvas, Size size) {
    final w = size.width;
    final groove = RRect.fromRectAndRadius(Offset.zero & size, Radius.circular(w / 2));
    canvas.drawRRect(groove, Paint()..color = colors.ink.withValues(alpha: colors.isNight ? 0.1 : 0.08));
    final total = right + wrong + blank;
    if (total == 0) return;
    canvas
      ..save()
      ..clipRRect(groove)
      ..clipRect(Rect.fromLTWH(0, 0, w, size.height * draw.value));
    const gap = 2.0;
    var y = 0.0;
    void segment(int n, Color color) {
      if (n == 0) return;
      final h = size.height * n / total;
      canvas.drawRect(Rect.fromLTWH(0, y, w, (h - gap).clamp(1.0, size.height)), Paint()..color = color);
      y += h;
    }

    segment(right, colors.ink.withValues(alpha: colors.isNight ? 0.72 : 0.62));
    segment(wrong, colors.wrongMark);
    canvas.restore();
  }

  @override
  bool shouldRepaint(_SpinePainter old) => old.right != right || old.wrong != wrong || old.blank != blank || old.colors != colors || old.draw != draw;
}
