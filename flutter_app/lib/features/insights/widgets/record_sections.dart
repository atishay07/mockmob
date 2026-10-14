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

const _tabular = [FontFeature.tabularFigures()];

/// Chapters by the marks their wrong and blank answers were worth, with the counts behind each.
/// Free accounts see the first three, as on the website.
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
          _ChapterRow(line: shown[i], onPractise: () => widget.onPractise(shown[i])),
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
  const _ChapterRow({required this.line, required this.onPractise, this.compact = false});

  final ChapterLine line;
  final VoidCallback onPractise;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final c = line;
    return Padding(
      padding: EdgeInsets.symmetric(vertical: compact ? MmSpace.s8 : MmSpace.s12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(c.chapter, style: type.labelLarge, maxLines: 2, overflow: TextOverflow.ellipsis),
                Text(subjectDisplayName(c.subject), style: type.caption.copyWith(color: colors.ink3)),
                const SizedBox(height: MmSpace.s8),
                MarksBar(right: c.right, wrong: c.wrong, blank: c.skip, height: 6),
                const SizedBox(height: MmSpace.s6),
                Text(
                  '${InsightsCopy.chapterCounts(c.right, c.wrong, c.skip, c.n)}. ${InsightsCopy.chapterOpen(c.open)}.',
                  style: type.caption.copyWith(color: colors.ink2, fontFeatures: _tabular),
                ),
              ],
            ),
          ),
          const SizedBox(width: MmSpace.s12),
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

/// A labelled figure in a small grid.
class _Figure extends StatelessWidget {
  const _Figure({required this.value, required this.label});

  final String value;
  final String label;

  @override
  Widget build(BuildContext context) {
    final type = context.mmType;
    return Semantics(
      label: '$label, $value',
      excludeSemantics: true,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(value, style: type.figureCompact.copyWith(fontSize: 32, height: 1.1, fontFeatures: _tabular)),
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
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _pair(_Figure(value: '+${c.marksGained}', label: '${c.gains} helped'), _Figure(value: '-${c.marksLost}', label: '${c.losses} hurt')),
        const SizedBox(height: MmSpace.s12),
        Text('${InsightsCopy.changesLine(c.count, c.gains, c.losses)}. Net $net marks.', style: type.small.copyWith(color: colors.ink)),
        EvidencePill(attempts: evidence, what: InsightsCopy.behindChanges),
      ],
    );
  }
}

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
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _pair(_Figure(value: _sec(p.medianSec), label: InsightsCopy.paceTypical), _Figure(value: _sec(p.p90Sec), label: InsightsCopy.paceSlow)),
        const SizedBox(height: MmSpace.s16),
        _pair(
          _Figure(value: _sec(p.medianRightSec), label: InsightsCopy.paceRight),
          _Figure(value: _sec(p.medianWrongSec), label: InsightsCopy.paceWrong),
        ),
        const SizedBox(height: MmSpace.s12),
        if (p.shareOnWrong != null) Text(InsightsCopy.paceShare(p.shareOnWrong!), style: type.small.copyWith(color: colors.ink)),
        Text(InsightsCopy.paceBasis(p.questionsTimed), style: type.caption.copyWith(color: colors.ink3)),
        EvidencePill(attempts: evidence, what: InsightsCopy.behindPace),
      ],
    );
  }
}

class WeekSection extends StatelessWidget {
  const WeekSection({super.key, required this.thisWeek, required this.lastWeek, required this.activeDays, this.evidence = const []});

  final WeekSummary thisWeek;
  final WeekSummary lastWeek;
  final int activeDays;

  /// Sessions in the last 14 days, newest first.
  final List<Attempt> evidence;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    Widget column(String title, WeekSummary w) => Column(
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
                    Text(w.net > 0 ? '+${w.net}' : '${w.net}', style: type.figureCompact.copyWith(fontSize: 32, height: 1.1, fontFeatures: _tabular)),
                    Text(InsightsCopy.netLabel, style: type.caption.copyWith(color: colors.ink2)),
                  ],
                ),
              ),
              const SizedBox(height: MmSpace.s4),
              Text(InsightsCopy.weekLine(w.sessions, w.questions), style: type.caption.copyWith(color: colors.ink2)),
              if (w.accuracy.known) Text('${w.accuracy.pct}% right of ${w.accuracy.n}', style: type.caption.copyWith(color: colors.ink2)),
            ],
          ],
        );
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _pair(column(InsightsCopy.thisWeek, thisWeek), column(InsightsCopy.lastWeek, lastWeek)),
        const SizedBox(height: MmSpace.s12),
        Text(InsightsCopy.activeDays(activeDays), style: type.small.copyWith(color: colors.ink)),
        Text(InsightsCopy.weekNote, style: type.caption.copyWith(color: colors.ink3)),
        EvidencePill(attempts: evidence, what: InsightsCopy.behindWeek),
      ],
    );
  }
}

class SubjectsSection extends StatelessWidget {
  const SubjectsSection({super.key, required this.lines});

  final List<SubjectLine> lines;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return Column(
      children: [
        for (var i = 0; i < lines.length; i++) ...[
          if (i > 0) Divider(height: 1, color: colors.line),
          Padding(
            padding: const EdgeInsets.symmetric(vertical: MmSpace.s12),
            child: Row(
              children: [
                SubjectThumb(subject: lines[i].subject, size: 56),
                const SizedBox(width: MmSpace.s12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(subjectDisplayName(lines[i].subject), style: type.labelLarge),
                      Text(InsightsCopy.subjectLine(lines[i].sessions, lines[i].questions), style: type.caption.copyWith(color: colors.ink2)),
                    ],
                  ),
                ),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Text(
                      lines[i].accuracyPct == null ? InsightsCopy.subjectNoneAnswered : InsightsCopy.subjectRight(lines[i].accuracyPct!),
                      style: type.labelLarge.copyWith(fontFeatures: _tabular),
                    ),
                    Text('of ${lines[i].answered} answered', style: type.caption.copyWith(color: colors.ink3, fontFeatures: _tabular)),
                  ],
                ),
              ],
            ),
          ),
        ],
      ],
    );
  }
}
