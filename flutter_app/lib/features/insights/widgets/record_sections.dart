import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import '../data/insights_models.dart';
import '../data/subject_names.dart';
import '../../../core/models/attempt.dart';
import '../data/trend.dart';
import 'evidence.dart';
import 'insights_bits.dart';
import 'motion_bits.dart';

const _tabular = [FontFeature.tabularFigures()];

// ---- Chapters ------------------------------------------------------------------------------

/// Chapters by the marks their wrong and blank answers were worth, as a ranked bar chart: each
/// bar is that chapter's open marks against the largest, the figure sits at its end, and the
/// counts behind it are under it. Free accounts see the first three, as on the website. The bars
/// grow in one after another (70 ms apart) once per visit.
class ChaptersSection extends StatefulWidget {
  const ChaptersSection({super.key, required this.ranked, required this.thin, required this.pro, required this.onPractise});

  final List<ChapterLine> ranked;
  final List<ChapterLine> thin;
  final bool pro;
  final void Function(ChapterLine c) onPractise;

  static const freeLimit = 3;

  @override
  State<ChaptersSection> createState() => _ChaptersSectionState();
}

class _ChaptersSectionState extends State<ChaptersSection> {
  bool _thinOpen = false;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final shown = widget.pro ? widget.ranked : widget.ranked.take(ChaptersSection.freeLimit).toList();
    final locked = widget.ranked.length - shown.length;
    final maxOpen = shown.fold<int>(1, (m, c) => c.open > m ? c.open : m);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        for (var i = 0; i < shown.length; i++) ...[
          if (i > 0) Divider(height: 1, color: colors.line),
          _ChapterRow(rank: i + 1, line: shown[i], maxOpen: maxOpen, delay: Duration(milliseconds: 70 * i), onPractise: () => widget.onPractise(shown[i])),
        ],
        if (locked > 0) ...[const SizedBox(height: MmSpace.s12), ProRow(InsightsCopy.proMore(locked))],
        if (widget.thin.isNotEmpty) ...[
          const SizedBox(height: MmSpace.s8),
          MmPressable(
            onTap: () => setState(() => _thinOpen = !_thinOpen),
            semanticsLabel: InsightsCopy.thinToggle(widget.thin.length),
            builder: (context, pressed, _) => SizedBox(
              height: MmTarget.min,
              child: Row(
                children: [
                  Expanded(child: Text(InsightsCopy.thinToggle(widget.thin.length), style: context.mmType.label.copyWith(color: colors.ink2))),
                  Icon(_thinOpen ? LucideIcons.chevronUp : LucideIcons.chevronDown, size: 18, color: colors.ink2),
                ],
              ),
            ),
          ),
          if (_thinOpen)
            for (final t in widget.thin.take(12)) _ChapterRow(line: t, onPractise: () => widget.onPractise(t), compact: true),
        ],
      ],
    );
  }
}

class _ChapterRow extends StatelessWidget {
  const _ChapterRow({required this.line, required this.onPractise, this.compact = false, this.rank, this.maxOpen = 1, this.delay = Duration.zero});

  final ChapterLine line;
  final VoidCallback onPractise;
  final bool compact;

  /// 1-based rank in the chart; null for a chapter that is too thin to rank.
  final int? rank;
  final int maxOpen;
  final Duration delay;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final c = line;
    final ranked = rank != null && !compact;
    return Padding(
      padding: EdgeInsets.symmetric(vertical: compact ? MmSpace.s8 : MmSpace.s16),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (ranked)
            SizedBox(
              width: 34,
              child: Text(
                '$rank',
                style: type.figureCompact.copyWith(fontSize: 34, height: 1, color: rank == 1 ? colors.ink : colors.ink3, fontFeatures: _tabular),
              ),
            ),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(c.chapter, style: type.labelLarge, maxLines: 2, overflow: TextOverflow.ellipsis),
                Text(subjectDisplayName(c.subject), style: type.caption.copyWith(color: colors.ink3)),
                const SizedBox(height: MmSpace.s12),
                if (ranked)
                  Semantics(
                    label: InsightsCopy.chapterOpen(c.open),
                    child: Row(
                      children: [
                        Expanded(child: _OpenBar(fraction: c.open / maxOpen, delay: delay)),
                        const SizedBox(width: MmSpace.s12),
                        Text('${c.open}', style: type.figureCompact.copyWith(fontSize: 26, height: 1, fontFeatures: _tabular)),
                        const SizedBox(width: 3),
                        Text('marks', style: type.caption.copyWith(color: colors.ink3)),
                      ],
                    ),
                  )
                else
                  MarksBar(right: c.right, wrong: c.wrong, blank: c.skip, height: 6),
                const SizedBox(height: MmSpace.s8),
                Text(
                  ranked ? '${InsightsCopy.chapterCounts(c.right, c.wrong, c.skip, c.n)}.' : '${InsightsCopy.chapterCounts(c.right, c.wrong, c.skip, c.n)}. ${InsightsCopy.chapterOpen(c.open)}.',
                  style: type.caption.copyWith(color: colors.ink2, fontFeatures: _tabular),
                ),
              ],
            ),
          ),
          const SizedBox(width: MmSpace.s8),
          KeyButton.quiet(
            label: InsightsCopy.practiseChapter,
            semanticsLabel: 'Practise ${c.chapter}',
            onPressed: onPractise,
          ),
        ],
      ),
    );
  }
}

/// One chapter's open marks as a bar on a track: coral, rounded, growing in from the left.
class _OpenBar extends StatelessWidget {
  const _OpenBar({required this.fraction, required this.delay});

  final double fraction;
  final Duration delay;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    return ExcludeSemantics(
      child: GrowIn(
        delay: delay,
        duration: const Duration(milliseconds: 420),
        builder: (context, t) => SizedBox(
          height: 12,
          child: CustomPaint(painter: _BarPainter(fraction: fraction * t, fill: colors.wrongMark, track: colors.sunken, line: colors.line)),
        ),
      ),
    );
  }
}

class _BarPainter extends CustomPainter {
  const _BarPainter({required this.fraction, required this.fill, required this.track, required this.line});

  final double fraction;
  final Color fill;
  final Color track;
  final Color line;

  @override
  void paint(Canvas canvas, Size size) {
    final r = Radius.circular(size.height / 2);
    canvas.drawRRect(RRect.fromRectAndRadius(Offset.zero & size, r), Paint()..color = track);
    final w = size.width * fraction.clamp(0.0, 1.0);
    if (w <= 0) return;
    final bar = RRect.fromRectAndRadius(Rect.fromLTWH(0, 0, w < size.height ? size.height : w, size.height), r);
    canvas.drawRRect(
      bar,
      Paint()
        ..shader = LinearGradient(colors: [fill.withValues(alpha: 0.78), fill]).createShader(bar.outerRect),
    );
  }

  @override
  bool shouldRepaint(_BarPainter old) => old.fraction != fraction || old.fill != fill || old.track != track;
}

// ---- Shared bits ---------------------------------------------------------------------------

/// A labelled figure in a small grid.
class _Figure extends StatelessWidget {
  const _Figure({required this.value, required this.label, this.color, this.align = CrossAxisAlignment.start});

  final String value;
  final String label;
  final Color? color;
  final CrossAxisAlignment align;

  @override
  Widget build(BuildContext context) {
    final type = context.mmType;
    return Semantics(
      label: '$label, $value',
      excludeSemantics: true,
      child: Column(
        crossAxisAlignment: align,
        children: [
          Text(value, style: type.figureCompact.copyWith(fontSize: 36, height: 1.1, fontFeatures: _tabular, color: color)),
          Text(label, style: type.caption.copyWith(color: context.mmColors.ink2)),
        ],
      ),
    );
  }
}

Widget _pair(Widget a, Widget b) => Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [Expanded(child: a), const SizedBox(width: MmSpace.s16), Expanded(child: b)],
    );

String _sec(int? s) => s == null ? '-' : (s >= 60 ? '${s ~/ 60}:${(s % 60).toString().padLeft(2, '0')}' : '${s}s');

/// A solid panel for a chart's group (the work layer: calm, no glass).
class _Panel extends StatelessWidget {
  const _Panel({required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    return DecoratedBox(
      decoration: ShapeDecoration(color: colors.raised, shape: mmShapeBorder(MmRadius.panelAll, side: BorderSide(color: colors.line))),
      child: Padding(padding: const EdgeInsets.fromLTRB(MmSpace.cardPadding, MmSpace.s20, MmSpace.cardPadding, MmSpace.s8), child: child),
    );
  }
}

// ---- Changed answers -----------------------------------------------------------------------

/// Changed answers as one split bar: the marks the changes gained (volt) against the marks they
/// cost (coral), in proportion, with both figures either side and the net under. The bar grows
/// from the middle once.
class ChangesSection extends StatelessWidget {
  const ChangesSection({super.key, required this.changes, this.evidence = const []});

  final ChangesSummary changes;

  /// Sessions with changed answers, newest first.
  final List<Attempt> evidence;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final c = changes;
    if (c.count == 0) return Text(InsightsCopy.changesNone, style: type.small.copyWith(color: colors.ink2));
    final net = c.net > 0 ? '+${c.net}' : '${c.net}';
    final total = c.marksGained + c.marksLost;
    final gain = total == 0 ? 0.5 : c.marksGained / total;
    return _Panel(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Expanded(child: _Figure(value: '+${c.marksGained}', label: '${c.gains} helped', color: colors.isNight ? colors.volt : colors.accentText)),
              Expanded(child: _Figure(value: '-${c.marksLost}', label: '${c.losses} hurt', color: colors.wrongMark, align: CrossAxisAlignment.end)),
            ],
          ),
          const SizedBox(height: MmSpace.s12),
          ExcludeSemantics(
            child: GrowIn(
              duration: const Duration(milliseconds: 500),
              builder: (context, t) => SizedBox(
                height: 14,
                width: double.infinity,
                child: CustomPaint(painter: _SplitPainter(gain: gain, t: t, helped: colors.volt, hurt: colors.wrongMark, track: colors.sunken, night: colors.isNight)),
              ),
            ),
          ),
          const SizedBox(height: MmSpace.s12),
          Text('${InsightsCopy.changesLine(c.count, c.gains, c.losses)}. Net $net marks.', style: type.small.copyWith(color: colors.ink)),
          EvidencePill(attempts: evidence, what: InsightsCopy.behindChanges),
          const SizedBox(height: MmSpace.s4),
        ],
      ),
    );
  }
}

class _SplitPainter extends CustomPainter {
  const _SplitPainter({required this.gain, required this.t, required this.helped, required this.hurt, required this.track, required this.night});

  final double gain;
  final double t;
  final Color helped;
  final Color hurt;
  final Color track;
  final bool night;

  @override
  void paint(Canvas canvas, Size size) {
    final r = Radius.circular(size.height / 2);
    canvas.drawRRect(RRect.fromRectAndRadius(Offset.zero & size, r), Paint()..color = track);
    // The split point grows out from the middle to its place.
    final split = size.width * (0.5 + (gain - 0.5) * t);
    const gap = 3.0;
    canvas.save();
    canvas.clipRRect(RRect.fromRectAndRadius(Offset.zero & size, r));
    canvas.drawRect(Rect.fromLTRB(0, 0, (split - gap / 2).clamp(0, size.width), size.height), Paint()..color = helped);
    canvas.drawRect(Rect.fromLTRB((split + gap / 2).clamp(0, size.width), 0, size.width, size.height), Paint()..color = hurt);
    canvas.restore();
  }

  @override
  bool shouldRepaint(_SplitPainter old) => old.gain != gain || old.t != t || old.helped != helped || old.hurt != hurt;
}

// ---- Pace ----------------------------------------------------------------------------------

/// Pace: the typical and the slowest question, then two bars that make the comparison the
/// closing sentence states: seconds on right answers against seconds on wrong answers.
class PaceSection extends StatelessWidget {
  const PaceSection({super.key, required this.pace, this.evidence = const []});

  final Pace pace;

  /// Sessions with timed answers, newest first.
  final List<Attempt> evidence;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final p = pace;
    if (!p.usable) return Text(InsightsCopy.paceThin, style: type.small.copyWith(color: colors.ink2));
    final right = p.medianRightSec, wrong = p.medianWrongSec;
    final scale = [right ?? 0, wrong ?? 0, 1].reduce((a, b) => a > b ? a : b);
    return _Panel(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _pair(_Figure(value: _sec(p.medianSec), label: InsightsCopy.paceTypical), _Figure(value: _sec(p.p90Sec), label: InsightsCopy.paceSlow)),
          if (right != null || wrong != null) ...[
            const SizedBox(height: MmSpace.s20),
            if (right != null) _SecondsBar(label: InsightsCopy.paceRight, seconds: right, fraction: right / scale, color: colors.volt, delay: Duration.zero),
            if (right != null && wrong != null) const SizedBox(height: MmSpace.s12),
            if (wrong != null) _SecondsBar(label: InsightsCopy.paceWrong, seconds: wrong, fraction: wrong / scale, color: colors.wrongMark, delay: const Duration(milliseconds: 90)),
          ],
          const SizedBox(height: MmSpace.s16),
          if (p.shareOnWrong != null) Text(InsightsCopy.paceShare(p.shareOnWrong!), style: type.small.copyWith(color: colors.ink)),
          Text(InsightsCopy.paceBasis(p.questionsTimed), style: type.caption.copyWith(color: colors.ink3)),
          EvidencePill(attempts: evidence, what: InsightsCopy.behindPace),
          const SizedBox(height: MmSpace.s4),
        ],
      ),
    );
  }
}

class _SecondsBar extends StatelessWidget {
  const _SecondsBar({required this.label, required this.seconds, required this.fraction, required this.color, required this.delay});

  final String label;
  final int seconds;
  final double fraction;
  final Color color;
  final Duration delay;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return Semantics(
      label: '$label, ${_sec(seconds)}',
      excludeSemantics: true,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: type.caption.copyWith(color: colors.ink2)),
          const SizedBox(height: MmSpace.s6),
          Row(
            children: [
              Expanded(
                child: GrowIn(
                  delay: delay,
                  duration: const Duration(milliseconds: 460),
                  builder: (context, t) => SizedBox(
                    height: 12,
                    child: CustomPaint(painter: _BarPainter(fraction: fraction * t, fill: color, track: colors.sunken, line: colors.line)),
                  ),
                ),
              ),
              const SizedBox(width: MmSpace.s12),
              SizedBox(width: 44, child: Text(_sec(seconds), textAlign: TextAlign.right, style: type.labelLarge.copyWith(fontFeatures: _tabular))),
            ],
          ),
        ],
      ),
    );
  }
}

// ---- This week and last ----------------------------------------------------------------------

/// This week against last: net marks and what they count for each, with a row of seven day
/// bubbles under each (inked on the days a session was finished) when the sessions are on the
/// phone.
class WeekSection extends StatelessWidget {
  const WeekSection({super.key, required this.thisWeek, required this.lastWeek, required this.activeDays, this.evidence = const [], this.now});

  final WeekSummary thisWeek;
  final WeekSummary lastWeek;
  final int activeDays;

  /// Sessions in the last 14 days, newest first.
  final List<Attempt> evidence;

  /// Today, to place each session on its day. Without it no day bubbles are drawn.
  final DateTime? now;

  /// Seven flags for the week that ends [daysBack] days before today, oldest day first.
  List<bool>? _days(int daysBack) {
    final n = now;
    if (n == null || evidence.isEmpty) return null;
    final today = DateTime(n.year, n.month, n.day);
    final worked = {
      for (final a in evidence)
        () {
          final d = a.completedAt.toLocal();
          return DateTime(d.year, d.month, d.day);
        }(),
    };
    return [for (var i = 6; i >= 0; i--) worked.contains(today.subtract(Duration(days: daysBack + i)))];
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    Widget column(String title, WeekSummary w, int daysBack) {
      final days = _days(daysBack);
      return Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: type.label.copyWith(color: colors.ink2)),
          const SizedBox(height: MmSpace.s4),
          if (w.sessions == 0)
            Text(InsightsCopy.weekNone, style: type.body.copyWith(color: colors.ink3))
          else ...[
            // The figure says what it counts: net marks, beside the sessions and questions
            // they come from.
            Semantics(
              label: '${w.net > 0 ? '+' : ''}${w.net} ${InsightsCopy.netLabel}',
              excludeSemantics: true,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(w.net > 0 ? '+${w.net}' : '${w.net}', style: type.figureCompact.copyWith(fontSize: 36, height: 1.1, fontFeatures: _tabular)),
                  Text(InsightsCopy.netLabel, style: type.caption.copyWith(color: colors.ink2)),
                ],
              ),
            ),
            const SizedBox(height: MmSpace.s4),
            Text(InsightsCopy.weekLine(w.sessions, w.questions), style: type.caption.copyWith(color: colors.ink2)),
            if (w.accuracy.known) Text('${w.accuracy.pct}% right of ${w.accuracy.n}', style: type.caption.copyWith(color: colors.ink2)),
          ],
          if (days != null) ...[
            const SizedBox(height: MmSpace.s12),
            BubbleRow(
              states: [for (final d in days) d ? BubbleState.filled : BubbleState.hollow],
              bubbleSize: 13,
              gap: 5,
              semanticsLabel: '${days.where((d) => d).length} of 7 days with a session',
            ),
          ],
        ],
      );
    }

    return _Panel(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _pair(column(InsightsCopy.thisWeek, thisWeek, 0), column(InsightsCopy.lastWeek, lastWeek, 7)),
          const SizedBox(height: MmSpace.s16),
          Text(InsightsCopy.activeDays(activeDays), style: type.small.copyWith(color: colors.ink)),
          Text(InsightsCopy.weekNote, style: type.caption.copyWith(color: colors.ink3)),
          EvidencePill(attempts: evidence, what: InsightsCopy.behindWeek),
          const SizedBox(height: MmSpace.s4),
        ],
      ),
    );
  }
}

// ---- By subject ------------------------------------------------------------------------------

/// Subjects as plates, two to a row: the subject's object in its own light, its share right as
/// the figure, a thin marks bar and what it counts.
class SubjectsSection extends StatelessWidget {
  const SubjectsSection({super.key, required this.lines});

  final List<SubjectLine> lines;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, box) {
        final w = (box.maxWidth - MmSpace.s12) / 2;
        return Wrap(
          spacing: MmSpace.s12,
          runSpacing: MmSpace.s12,
          children: [
            for (final (i, l) in lines.indexed)
              SizedBox(
                width: w,
                child: RiseIn(delay: Duration(milliseconds: 60 * (i % 4)), child: _SubjectPlate(line: l)),
              ),
          ],
        );
      },
    );
  }
}

class _SubjectPlate extends StatelessWidget {
  const _SubjectPlate({required this.line});

  final SubjectLine line;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final l = line;
    final light = SubjectLight.forSubject(l.subject);
    final name = subjectDisplayName(l.subject);
    final pct = l.accuracyPct;
    return Semantics(
      container: true,
      label: '$name, ${pct == null ? InsightsCopy.subjectNoneAnswered : InsightsCopy.subjectRight(pct)}, ${InsightsCopy.subjectLine(l.sessions, l.questions)}',
      excludeSemantics: true,
      child: FakeGlass(
        child: Stack(
          children: [
            if (light != null)
              Positioned.fill(child: IgnorePointer(child: LightField.subject(context, light, center: const Alignment(0.9, -0.9), strength: 0.9))),
            Padding(
              padding: const EdgeInsets.all(MmSpace.s16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Expanded(child: Text(name, style: type.labelLarge, maxLines: 2, overflow: TextOverflow.ellipsis)),
                      SubjectThumb(subject: l.subject, size: 56),
                    ],
                  ),
                  const SizedBox(height: MmSpace.s8),
                  if (pct == null)
                    Text(InsightsCopy.subjectNoneAnswered, style: type.cardTitle.copyWith(color: colors.ink2))
                  else
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      textBaseline: TextBaseline.alphabetic,
                      children: [
                        Text('$pct', style: type.figure.copyWith(fontSize: 48, height: 1, fontFeatures: _tabular)),
                        Padding(
                          padding: const EdgeInsets.only(top: 4, left: 2),
                          child: Text('%', style: type.figureCompact.copyWith(fontSize: 22, height: 1, color: colors.ink2)),
                        ),
                      ],
                    ),
                  const SizedBox(height: MmSpace.s4),
                  Text('right of ${l.answered} answered', style: type.caption.copyWith(color: colors.ink2, fontFeatures: _tabular)),
                  const SizedBox(height: MmSpace.s12),
                  MarksBar(right: l.right, wrong: l.wrong, blank: l.blank, height: 6, engrave: true),
                  const SizedBox(height: MmSpace.s8),
                  Text(InsightsCopy.subjectLine(l.sessions, l.questions), style: type.caption.copyWith(color: colors.ink3, fontFeatures: _tabular)),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
