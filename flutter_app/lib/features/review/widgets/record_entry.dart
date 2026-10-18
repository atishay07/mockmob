import 'package:flutter/material.dart';

import '../../../core/theme/theme.dart';
import '../../../core/copy/sentences.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import '../data/mistake_index.dart';
import '../data/paper_when.dart';
import '../data/review_providers.dart';
import 'mistake_map.dart' show MistakeRow;

export '../data/paper_when.dart' show whenText;

/// The record's entries: every mistake that moved past Found, newest first. Reviewed entries
/// have no server time and come last.
List<MistakeItem> recordEntries(ReviewIndex index) {
  final out = [
    for (final g in index.groups)
      for (final i in g.items)
        if (i.stage != MistakeStage.found) i,
  ];
  out.sort((a, b) {
    final x = a.stageAt, y = b.stageAt;
    if (x == null && y == null) return b.foundAt.compareTo(a.foundAt);
    if (x == null) return 1;
    if (y == null) return -1;
    return y.compareTo(x);
  });
  return out;
}

/// One mistake on the record's thread (spec 5.8 and 6.4): its node on a vertical 2 dp thread,
/// the life row, and the dated lines in words. History is never rewritten.
class RecordEntry extends StatelessWidget {
  const RecordEntry({super.key, required this.item, required this.clock, this.first = false, this.last = false});

  final MistakeItem item;
  final ReviewClock clock;
  final bool first;
  final bool last;

  List<String> get _lines {
    final at = item.stageAt;
    return [
      ReviewCopy.foundOn(whenText(clock, item.foundAt), item.source),
      switch (item.stage) {
        MistakeStage.repaired => at == null ? ReviewCopy.repaired : ReviewCopy.repairedOn(whenText(clock, at)),
        MistakeStage.reviewed => ReviewCopy.reviewedOn(at == null ? 'on this phone' : whenText(clock, at)),
        MistakeStage.setAside => ReviewCopy.setAsideOn(at == null ? 'on this phone' : whenText(clock, at)),
        MistakeStage.found => '',
      },
    ].where((l) => l.isNotEmpty).toList();
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final title = ReviewCopy.recordTitleLine(item.number, item.chapter);
    final lines = _lines;
    final node = switch (item.stage) {
      MistakeStage.repaired => BubbleState.filled,
      MistakeStage.reviewed => BubbleState.marked,
      _ => BubbleState.blank,
    };
    final (chip, chipColor) = switch (item.stage) {
      MistakeStage.repaired => (ReviewCopy.repaired, colors.accentText),
      MistakeStage.reviewed => (ReviewCopy.reviewed, colors.ink2),
      MistakeStage.setAside => (ReviewCopy.setAside, colors.ink2),
      MistakeStage.found => (ReviewCopy.found, colors.badText),
    };
    return Semantics(
      container: true,
      label: joinSentences([title, chip, ...lines]),
      excludeSemantics: true,
      child: IntrinsicHeight(
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // The same rail as the chapter threads on the map: the dot on the rail's centre and the
            // text on E2, so a mistake reads the same on the tab, the list and the record.
            SizedBox(
              width: MistakeRow.railWidth,
              child: CustomPaint(
                painter: _RailPainter(color: colors.line, top: !first, bottom: !last),
                child: Align(
                  alignment: Alignment.topCenter,
                  child: Padding(
                    padding: const EdgeInsets.only(top: MmSpace.s2),
                    child: ColoredBox(
                      color: colors.ground,
                      child: Padding(
                        padding: const EdgeInsets.all(MmSpace.s4),
                        child: Bubble(state: node, size: 16, animate: false),
                      ),
                    ),
                  ),
                ),
              ),
            ),
            Expanded(
              child: Padding(
                padding: const EdgeInsets.only(bottom: MmSpace.s24),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Expanded(child: Text(title, style: type.labelLarge)),
                        const SizedBox(width: MmSpace.s12),
                        // The stage, said in words: the legend on the record page explains the thread.
                        Text(chip, style: type.caption.copyWith(color: chipColor, fontWeight: FontWeight.w700)),
                      ],
                    ),
                    const SizedBox(height: MmSpace.s4),
                    for (final l in lines) Text(l, style: type.small.copyWith(color: colors.ink2)),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _RailPainter extends CustomPainter {
  const _RailPainter({required this.color, required this.top, required this.bottom});

  final Color color;
  final bool top;
  final bool bottom;

  @override
  void paint(Canvas canvas, Size size) {
    final x = size.width / 2;
    final paint = Paint()
      ..color = color
      ..strokeWidth = 2;
    canvas.drawLine(Offset(x, top ? 0 : 14), Offset(x, bottom ? size.height : 14), paint);
  }

  @override
  bool shouldRepaint(_RailPainter old) => old.color != color || old.top != top || old.bottom != bottom;
}
