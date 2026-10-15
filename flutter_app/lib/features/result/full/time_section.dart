import 'package:flutter/material.dart';

import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../model/time_decisions.dart';

/// "Time and decisions" on the full result, the website's Lab Find step in the app: the paper's
/// pace, where the time went (the longest questions against the paper's time a question), the time
/// split by verdict and every answer change with its clock times and marks effect. Every sentence
/// comes finished from [buildTimeDecisions], the same words as the website. A row opens its answer
/// below, where the same question shows its own time and picks.
class TimeSection extends StatefulWidget {
  const TimeSection({super.key, required this.read, this.onOpenQuestion});

  final TimeDecisions read;

  /// Opens the answer of a question number (the answer map's own jump).
  final ValueChanged<int>? onOpenQuestion;

  @override
  State<TimeSection> createState() => _TimeSectionState();
}

class _TimeSectionState extends State<TimeSection> {
  bool _allChanges = false;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final read = widget.read;
    if (!read.isReady) {
      return MmSection(
        title: TimeCopy.title,
        child: Text(read.message ?? TimeCopy.notRecorded, style: type.small.copyWith(color: colors.ink2)),
      );
    }
    final lead = [?read.paceLine, ?read.medianLine].join(' ');
    final maxMs = read.longest.isEmpty ? 1 : read.longest.first.ms;
    final paceAt = read.pace == null ? null : (read.pace!.perQuestionMs / maxMs).clamp(0.0, 1.0);
    final folds = read.changeRows.length > TimeRules.changesShown + 1;
    final shown = folds && !_allChanges ? read.changeRows.take(TimeRules.changesShown).toList() : read.changeRows;
    final body = type.body.copyWith(color: colors.ink2);
    final fine = type.small.copyWith(color: colors.ink3);

    return MmSection(
      title: TimeCopy.title,
      caption: TimeCopy.sub,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (lead.isNotEmpty) Text(lead, style: type.body),
          if (read.longest.isNotEmpty) ...[
            const SizedBox(height: MmSpace.s20),
            Semantics(header: true, child: Text(TimeCopy.longestTitle, style: type.subhead.copyWith(fontSize: 16))),
            const SizedBox(height: MmSpace.s8),
            for (var i = 0; i < read.longest.length; i++) ...[
              if (i > 0) const SizedBox(height: MmSpace.s4),
              _LongRowTile(row: read.longest[i], maxMs: maxMs, paceAt: paceAt, onTap: widget.onOpenQuestion),
            ],
            if (read.longestNote != null) ...[const SizedBox(height: MmSpace.s8), Text(read.longestNote!, style: fine)],
          ],
          if (read.splitLine != null) ...[const SizedBox(height: MmSpace.s16), Text(read.splitLine!, style: body)],
          const SizedBox(height: MmSpace.s20),
          Semantics(header: true, child: Text(TimeCopy.changesTitle, style: type.subhead.copyWith(fontSize: 16))),
          const SizedBox(height: MmSpace.s8),
          if (read.changesLead != null) Text(read.changesLead!, style: body),
          if (read.changeParts.length > 1) ...[
            const SizedBox(height: MmSpace.s8),
            Wrap(
              spacing: MmSpace.s8,
              runSpacing: MmSpace.s8,
              children: [for (final p in read.changeParts) _PartChip(part: p)],
            ),
          ],
          if (shown.isNotEmpty) const SizedBox(height: MmSpace.s12),
          for (var i = 0; i < shown.length; i++) ...[
            if (i > 0) const SizedBox(height: MmSpace.s4),
            _ChangeRowTile(row: shown[i], onTap: widget.onOpenQuestion),
          ],
          if (folds)
            Align(
              alignment: Alignment.centerLeft,
              child: KeyButton.quiet(
                label: _allChanges ? TimeCopy.showFewer : TimeCopy.showAll(read.changeRows.length),
                onPressed: () => setState(() => _allChanges = !_allChanges),
              ),
            ),
          if (read.changesHeld != null) ...[const SizedBox(height: MmSpace.s8), Text(read.changesHeld!, style: fine)],
          if (read.changeRows.isNotEmpty) ...[const SizedBox(height: MmSpace.s8), Text(TimeCopy.clockNote, style: fine)],
        ],
      ),
    );
  }
}

Color _verdictColor(MmColors colors, String verdict) => switch (verdict) {
  'correct' => colors.goodText,
  'wrong' => colors.badText,
  _ => colors.lineStrong,
};

/// One of the longest questions: number, a bar against the longest with the paper's pace marked,
/// the time, and the verdict in words (colour never alone).
class _LongRowTile extends StatelessWidget {
  const _LongRowTile({required this.row, required this.maxMs, required this.paceAt, this.onTap});

  final LongRow row;
  final int maxMs;
  final double? paceAt;
  final ValueChanged<int>? onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final verdict = TimeCopy.verdict[row.verdict] ?? TimeCopy.verdict['skipped']!;
    final fill = (row.ms / maxMs).clamp(0.02, 1.0);
    return MmPressable(
      onTap: onTap == null ? null : () => onTap!(row.number),
      pressedScale: 0.985,
      focusRadius: MmRadius.smallAll,
      haptic: MmPressHaptic.selection,
      highlight: true,
      semanticsLabel: 'Question ${row.number}, $verdict, ${row.time}${row.ratioText == null ? '' : ', ${row.ratioText}'}. Open the answer.',
      builder: (context, pressed, _) => Container(
        constraints: const BoxConstraints(minHeight: 52),
        padding: const EdgeInsets.symmetric(horizontal: MmSpace.s12, vertical: MmSpace.s8),
        decoration: ShapeDecoration(
          color: colors.sunken,
          shape: RoundedSuperellipseBorder(borderRadius: MmRadius.smallAll, side: BorderSide(color: colors.line)),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            SizedBox(width: 40, child: Text('Q${row.number}', style: type.subhead.copyWith(fontSize: 14, fontFeatures: const [FontFeature.tabularFigures()]))),
            const SizedBox(width: MmSpace.s8),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const SizedBox(height: 6),
                  SizedBox(
                    height: 8,
                    child: LayoutBuilder(
                      builder: (context, box) => Stack(
                        clipBehavior: Clip.none,
                        children: [
                          Positioned.fill(child: DecoratedBox(decoration: BoxDecoration(color: colors.line, borderRadius: BorderRadius.circular(4)))),
                          Positioned(
                            left: 0,
                            top: 0,
                            bottom: 0,
                            width: box.maxWidth * fill,
                            child: DecoratedBox(decoration: BoxDecoration(color: _verdictColor(colors, row.verdict), borderRadius: BorderRadius.circular(4))),
                          ),
                          if (paceAt != null)
                            Positioned(
                              left: (box.maxWidth * paceAt! - 1).clamp(0.0, box.maxWidth - 2),
                              top: -4,
                              bottom: -4,
                              width: 2,
                              child: DecoratedBox(decoration: BoxDecoration(color: colors.ink, borderRadius: BorderRadius.circular(1))),
                            ),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: MmSpace.s4),
                  Wrap(
                    spacing: MmSpace.s12,
                    children: [
                      Text(verdict, style: type.small.copyWith(color: row.verdict == 'skipped' ? colors.ink3 : _verdictColor(colors, row.verdict))),
                      if (row.ratioText != null) Text(row.ratioText!, style: type.small.copyWith(color: colors.ink3)),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(width: MmSpace.s12),
            Text(row.time, style: type.subhead.copyWith(fontSize: 14, fontFeatures: const [FontFeature.tabularFigures()])),
          ],
        ),
      ),
    );
  }
}

class _PartChip extends StatelessWidget {
  const _PartChip({required this.part});

  final ChangePart part;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final color = switch (part.kind) {
      'gained' => colors.goodText,
      'cost' => colors.badText,
      _ => colors.ink2,
    };
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: MmSpace.s8, vertical: 6),
      decoration: ShapeDecoration(
        shape: RoundedSuperellipseBorder(borderRadius: MmRadius.smallAll, side: BorderSide(color: colors.line)),
      ),
      child: Text(part.text, style: context.mmType.small.copyWith(color: color)),
    );
  }
}

/// One question whose answer changed: its number, every pick with its clock time, and the marks
/// the changes made (none for a question under re-check).
class _ChangeRowTile extends StatelessWidget {
  const _ChangeRowTile({required this.row, this.onTap});

  final ChangeRow row;
  final ValueChanged<int>? onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final net = row.net;
    final netColor = net == null || net == 0 ? colors.ink3 : (net > 0 ? colors.goodText : colors.badText);
    final netWords = net == null ? '' : (net == 0 ? '. No change in marks' : '. ${net > 0 ? 'Gained' : 'Cost'} ${net.abs()} marks');
    return MmPressable(
      onTap: onTap == null ? null : () => onTap!(row.number),
      pressedScale: 0.985,
      focusRadius: MmRadius.smallAll,
      haptic: MmPressHaptic.selection,
      highlight: true,
      semanticsLabel: 'Question ${row.number}. ${row.text}$netWords. Open the answer.',
      builder: (context, pressed, _) => Container(
        constraints: const BoxConstraints(minHeight: 48),
        padding: const EdgeInsets.symmetric(horizontal: MmSpace.s12, vertical: 10),
        decoration: ShapeDecoration(
          color: colors.sunken,
          shape: RoundedSuperellipseBorder(borderRadius: MmRadius.smallAll, side: BorderSide(color: colors.line)),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            SizedBox(width: 40, child: Text('Q${row.number}', style: type.subhead.copyWith(fontSize: 14, fontFeatures: const [FontFeature.tabularFigures()]))),
            const SizedBox(width: MmSpace.s8),
            Expanded(child: Text(row.text, style: type.small.copyWith(color: colors.ink2, fontFeatures: const [FontFeature.tabularFigures()]))),
            if (net != null) ...[
              const SizedBox(width: MmSpace.s12),
              Text(signedMarks(net), style: type.subhead.copyWith(fontSize: 15, color: netColor, fontFeatures: const [FontFeature.tabularFigures()])),
            ],
          ],
        ),
      ),
    );
  }
}
