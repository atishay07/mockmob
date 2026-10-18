import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/art/art.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../../result/model/weak_chapters.dart' show WeakChapter;
import '../../result/widgets/weak_chapters_list.dart' show WeakChapterRow;
import '../copy.dart';
import '../data/insights_models.dart';
import '../data/subject_names.dart';
import '../../../core/models/attempt.dart';
import '../../pro_nudge/pro_nudge.dart' show ProReason, proNudgesOnProvider;
import '../data/trend.dart';
import 'evidence.dart';
import 'insights_bits.dart';
import 'motion_bits.dart';

const _tabular = [FontFeature.tabularFigures()];

// ---- Chapters ------------------------------------------------------------------------------

/// The chapters that cost the most marks, in the one presentation the result uses for "Where your marks went" (v15 spec 3.1,
/// N15: the old "chapters by marks left open" bar chart is gone): each chapter with the marks lost of the marks it had, a bar of
/// that share, what happened in it and a Practise key. Free accounts see the first three, as on the website. A chapter with
/// fewer than four answers is too thin to rank and sits under one quiet row.
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
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        for (var i = 0; i < shown.length; i++) ...[
          if (i > 0) Divider(height: 1, color: colors.line),
          WeakChapterRow(chapter: _weak(shown[i]), subtitle: subjectDisplayName(shown[i].subject), onPractise: () => widget.onPractise(shown[i])),
        ],
        // The chapters past the free three are named as Pro's only while Pro can be had here
        // (PLAY_BILLING on); with the flag off no row names Pro (owner walk, 18 Oct).
        if (locked > 0)
          Consumer(
            builder: (context, ref, _) => ref.watch(proNudgesOnProvider)
                ? Padding(padding: const EdgeInsets.only(top: MmSpace.s12), child: ProRow(InsightsCopy.proMore(locked), reason: ProReason.insightsChapters))
                : const SizedBox.shrink(),
          ),
        if (widget.thin.isNotEmpty) ...[
          const SizedBox(height: MmSpace.s8),
          MmPressable(
            onTap: () => setState(() => _thinOpen = !_thinOpen),
            semanticsLabel: InsightsCopy.thinToggle(widget.thin.length),
            haptic: MmPressHaptic.selection,
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
            for (final t in widget.thin.take(12)) _ThinChapterRow(line: t, onPractise: () => widget.onPractise(t)),
        ],
      ],
    );
  }

  static WeakChapter _weak(ChapterLine c) => WeakChapter(chapter: c.chapter, questions: c.n, right: c.right, wrong: c.wrong, blank: c.skip);
}

/// A chapter too thin to rank: the whole row opens its practice (48 dp or more, with a chevron); the counts sit under its name.
class _ThinChapterRow extends StatelessWidget {
  const _ThinChapterRow({required this.line, required this.onPractise});

  final ChapterLine line;
  final VoidCallback onPractise;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final c = line;
    final counts = InsightsCopy.chapterCounts(c.right, c.wrong, c.skip, c.n);
    return MmPressable(
      onTap: onPractise,
      semanticsLabel: '${InsightsCopy.practiseChapter} ${c.chapter}. $counts. ${InsightsCopy.chapterOpen(c.open)}',
      focusRadius: MmRadius.smallAll,
      haptic: MmPressHaptic.selection,
      highlight: true,
      pressedScale: 0.99,
      builder: (context, pressed, _) => Padding(
        padding: const EdgeInsets.symmetric(vertical: MmSpace.s8),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(c.chapter, style: type.labelLarge, maxLines: 2, overflow: TextOverflow.ellipsis),
                  Text(subjectDisplayName(c.subject), style: type.caption.copyWith(color: colors.ink3)),
                  const SizedBox(height: MmSpace.s12),
                  MarksBar(right: c.right, wrong: c.wrong, blank: c.skip, height: 6),
                  const SizedBox(height: MmSpace.s8),
                  Text('$counts. ${InsightsCopy.chapterOpen(c.open)}.', style: type.caption.copyWith(color: colors.ink2, fontFeatures: _tabular)),
                ],
              ),
            ),
            const SizedBox(width: MmSpace.s8),
            Padding(
              padding: const EdgeInsets.only(top: MmSpace.s2),
              child: Icon(LucideIcons.chevronRight, size: 20, color: colors.ink3),
            ),
          ],
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
  const _Figure({this.value, this.count, this.format, required this.label, this.color, this.align = CrossAxisAlignment.start})
      : assert(value != null || count != null);

  /// A figure that is already text (a time such as 0:58), shown as it is.
  final String? value;

  /// A figure that counts up when it comes into view and rolls from its old value when it changes.
  final int? count;
  final String Function(num value)? format;
  final String label;
  final Color? color;
  final CrossAxisAlignment align;

  @override
  Widget build(BuildContext context) {
    final type = context.mmType;
    final style = type.figureCompact.copyWith(fontSize: 36, height: 1.1, fontFeatures: _tabular, color: color);
    final text = value ?? (format ?? (n) => n.round().toString())(count!);
    return Semantics(
      label: '$label, $text',
      excludeSemantics: true,
      child: Column(
        crossAxisAlignment: align,
        children: [
          if (value != null) Text(value!, style: style) else CountOnView(value: count!, format: format, style: style),
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

/// The body of a chart group: no box. The hero and the lead finding are the page's only cards;
/// everything else sits on the ground and is set apart by space and hairlines.
class _Panel extends StatelessWidget {
  const _Panel({required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) => child;
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
    final net = InsightsCopy.signed(c.net);
    final total = c.marksGained + c.marksLost;
    final gain = total == 0 ? 0.5 : c.marksGained / total;
    return _Panel(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Expanded(child: _Figure(count: c.marksGained, format: (n) => '+${n.round()}', label: '${c.gains} helped', color: colors.isNight ? colors.volt : colors.accentText)),
              Expanded(child: _Figure(count: -c.marksLost, format: (n) => InsightsCopy.signed(n.round()), label: '${c.losses} hurt', color: colors.wrongMark, align: CrossAxisAlignment.end)),
            ],
          ),
          const SizedBox(height: MmSpace.s12),
          ExcludeSemantics(
            child: GrowIn(
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
          _pair(
            p.medianSec == null ? _Figure(value: _sec(null), label: InsightsCopy.paceTypical) : _Figure(count: p.medianSec, format: (n) => _sec(n.round()), label: InsightsCopy.paceTypical),
            p.p90Sec == null ? _Figure(value: _sec(null), label: InsightsCopy.paceSlow) : _Figure(count: p.p90Sec, format: (n) => _sec(n.round()), label: InsightsCopy.paceSlow),
          ),
          if (right != null || wrong != null) ...[
            const SizedBox(height: MmSpace.s20),
            if (right != null) _SecondsBar(label: InsightsCopy.paceRight, seconds: right, fraction: right / scale, color: colors.volt, delay: Duration.zero),
            if (right != null && wrong != null) const SizedBox(height: MmSpace.s12),
            if (wrong != null) _SecondsBar(label: InsightsCopy.paceWrong, seconds: wrong, fraction: wrong / scale, color: colors.wrongMark, delay: const Duration(milliseconds: 45)),
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
          const SizedBox(height: MmSpace.s4),
          Row(
            children: [
              Expanded(
                child: GrowIn(
                  delay: delay,
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

/// This week against last: net marks and what they count for each, with seven day columns under
/// each when the sessions are on the phone: the day's letter, and a bar for that day's net marks
/// (volt for a gain, coral for a loss, a hairline dot for a day with no session). Both weeks share
/// one scale, so the bars compare.
class WeekSection extends StatelessWidget {
  const WeekSection({super.key, required this.thisWeek, required this.lastWeek, required this.activeDays, this.evidence = const [], this.now});

  final WeekSummary thisWeek;
  final WeekSummary lastWeek;
  final int activeDays;

  /// Sessions in the last 14 days, newest first.
  final List<Attempt> evidence;

  /// Today, to place each session on its day. Without it no day columns are drawn.
  final DateTime? now;

  /// Seven days for the week that ends [daysBack] days before today, oldest day first: the
  /// weekday and its net marks, or a null net when no session ended on it.
  List<_Day>? _days(int daysBack) {
    final n = now;
    if (n == null || evidence.isEmpty) return null;
    final today = DateTime(n.year, n.month, n.day);
    final net = <DateTime, int>{};
    for (final a in evidence) {
      final d = a.completedAt.toLocal();
      final day = DateTime(d.year, d.month, d.day);
      net[day] = (net[day] ?? 0) + a.marks;
    }
    return [
      for (var i = 6; i >= 0; i--)
        () {
          final day = today.subtract(Duration(days: daysBack + i));
          return _Day(day.weekday, net[day]);
        }(),
    ];
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final all = [...?_days(0), ...?_days(7)];
    final scale = all.fold<int>(1, (m, d) => (d.net ?? 0).abs() > m ? (d.net ?? 0).abs() : m);
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
              label: '${InsightsCopy.signed(w.net)} ${InsightsCopy.netLabel}',
              excludeSemantics: true,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  CountOnView(value: w.net, format: (n) => InsightsCopy.signed(n.round()), style: type.figureCompact.copyWith(fontSize: 36, height: 1.1, fontFeatures: _tabular)),
                  Text(InsightsCopy.netLabel, style: type.caption.copyWith(color: colors.ink2)),
                ],
              ),
            ),
            const SizedBox(height: MmSpace.s4),
            Text(InsightsCopy.weekLine(w.sessions, w.questions), style: type.caption.copyWith(color: colors.ink2)),
            if (w.accuracy.known) Text('${w.accuracy.pct}% right of ${w.accuracy.n}', style: type.caption.copyWith(color: colors.ink2)),
          ],
          if (days != null) ...[
            const SizedBox(height: MmSpace.s16),
            _DayBars(days: days, scale: scale),
          ],
        ],
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _pair(column(InsightsCopy.thisWeek, thisWeek, 0), column(InsightsCopy.lastWeek, lastWeek, 7)),
        const SizedBox(height: MmSpace.s16),
        Text(InsightsCopy.activeDays(activeDays), style: type.small.copyWith(color: colors.ink)),
        Text(InsightsCopy.weekNote, style: type.caption.copyWith(color: colors.ink3)),
        EvidencePill(attempts: evidence, what: InsightsCopy.behindWeek),
      ],
    );
  }
}

class _Day {
  const _Day(this.weekday, this.net);

  /// DateTime.monday to DateTime.sunday.
  final int weekday;

  /// Net marks of the sessions that ended that day; null when none did.
  final int? net;

  static const _letters = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  String get letter => _letters[weekday - 1];
}

/// Seven day columns: a bar for the day's net marks above its letter.
class _DayBars extends StatelessWidget {
  const _DayBars({required this.days, required this.scale});

  final List<_Day> days;
  final int scale;

  static const _plot = 44.0;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final worked = days.where((d) => d.net != null).length;
    return Semantics(
      label: '$worked of 7 days with a session',
      excludeSemantics: true,
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          for (final d in days)
            Expanded(
              child: Column(
                children: [
                  SizedBox(
                    height: _plot,
                    child: Align(
                      alignment: Alignment.bottomCenter,
                      child: d.net == null
                          ? DecoratedBox(decoration: BoxDecoration(shape: BoxShape.circle, color: colors.line), child: const SizedBox.square(dimension: MmSpace.s4))
                          : GrowIn(
                              delay: Duration(milliseconds: 45 * days.indexOf(d)),
                              builder: (context, t) => DecoratedBox(
                                decoration: BoxDecoration(
                                  color: d.net! >= 0 ? colors.volt : colors.wrongMark,
                                  borderRadius: const BorderRadius.vertical(top: Radius.circular(3)),
                                ),
                                child: SizedBox(width: 10, height: ((d.net!.abs() / scale) * (_plot - 6) + 6) * t),
                              ),
                            ),
                    ),
                  ),
                  const SizedBox(height: MmSpace.s4),
                  Text(d.letter, style: type.caption.copyWith(fontSize: 12, color: d.net == null ? colors.ink4 : colors.ink2)),
                ],
              ),
            ),
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
    // Two to a row, each row as tall as its taller plate.
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        for (var r = 0; r < lines.length; r += 2) ...[
          if (r > 0) const SizedBox(height: MmSpace.s12),
          IntrinsicHeight(
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Expanded(child: _SubjectPlate(line: lines[r])),
                const SizedBox(width: MmSpace.s12),
                Expanded(child: r + 1 < lines.length ? _SubjectPlate(line: lines[r + 1]) : const SizedBox.shrink()),
              ],
            ),
          ),
        ],
      ],
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
    final light = SubjectLight.forSubject(l.subject)?.of(Theme.of(context).brightness);
    final name = subjectDisplayName(l.subject);
    final pct = l.accuracyPct;
    return Semantics(
      container: true,
      label: '$name, ${pct == null ? InsightsCopy.subjectNoneAnswered : InsightsCopy.subjectRight(pct)}, ${InsightsCopy.subjectLine(l.sessions, l.questions)}',
      excludeSemantics: true,
      // One neutral plate: the subject shows in its drawn object and a one pixel edge in its
      // colour, never as a wash over the whole plate.
      child: DecoratedBox(
        decoration: ShapeDecoration(
          color: colors.raised,
          shape: mmShapeBorder(MmRadius.panelAll, side: BorderSide(color: light == null ? colors.line : light.withValues(alpha: colors.isNight ? 0.55 : 0.7))),
        ),
        child: Padding(
          padding: const EdgeInsets.all(MmSpace.s16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // The subject's object, then its name on the full width: a long name wraps at a
              // word and is never cut.
              SubjectThumb(subject: l.subject, size: EmblemSizes.tile),
              const SizedBox(height: MmSpace.s8),
              Text(name, style: type.labelLarge),
              const SizedBox(height: MmSpace.s4),
              if (pct == null)
                Text(InsightsCopy.subjectNoneAnswered, style: type.cardTitle.copyWith(color: colors.ink2))
              else
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  textBaseline: TextBaseline.alphabetic,
                  children: [
                    CountOnView(value: pct, style: type.figure.copyWith(fontSize: 48, height: 1, fontFeatures: _tabular)),
                    Padding(
                      padding: const EdgeInsets.only(top: MmSpace.s4, left: MmSpace.s2),
                      child: Text('%', style: type.figureCompact.copyWith(fontSize: 22, height: 1, color: colors.ink2)),
                    ),
                  ],
                ),
              const SizedBox(height: MmSpace.s4),
              Text('right of ${l.answered} answered', style: type.caption.copyWith(color: colors.ink2, fontFeatures: _tabular)),
              const Spacer(),
              const SizedBox(height: MmSpace.s12),
              MarksBar(right: l.right, wrong: l.wrong, blank: l.blank, height: 6, engrave: true),
              const SizedBox(height: MmSpace.s8),
              Text(InsightsCopy.subjectLine(l.sessions, l.questions), style: type.caption.copyWith(color: colors.ink3, fontFeatures: _tabular)),
            ],
          ),
        ),
      ),
    );
  }
}
