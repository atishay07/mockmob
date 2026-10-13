import 'package:flutter/material.dart';

import '../../../core/copy/formatters.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import '../data/mistake_index.dart';
import '../data/review_providers.dart';
import 'life_row.dart';

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

/// "12 October, 11:08 PM".
String whenText(ReviewClock clock, DateTime t) {
  final local = clock.local(t);
  return '${formatDayMonth(local)}, ${formatTime12(local)}';
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
        MistakeStage.repaired => at == null ? '${ReviewCopy.repaired}.' : ReviewCopy.repairedOn(whenText(clock, at)),
        MistakeStage.reviewed => ReviewCopy.reviewedOn(at == null ? 'this phone' : whenText(clock, at)),
        MistakeStage.setAside => ReviewCopy.setAsideOn(at == null ? 'this phone' : whenText(clock, at)),
        MistakeStage.found => '',
      },
      if (item.stage == MistakeStage.repaired) ReviewCopy.checkedNotYet,
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
    return Semantics(
      container: true,
      label: '$title. ${lines.join(' ')}',
      excludeSemantics: true,
      child: IntrinsicHeight(
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            SizedBox(
              width: 28,
              child: CustomPaint(
                painter: _RailPainter(color: colors.line, top: !first, bottom: !last),
                child: Align(
                  alignment: Alignment.topCenter,
                  child: Padding(
                    padding: const EdgeInsets.only(top: 2),
                    child: ColoredBox(
                      color: colors.ground,
                      child: Padding(
                        padding: const EdgeInsets.all(3),
                        child: Bubble(state: node, size: 16, animate: false),
                      ),
                    ),
                  ),
                ),
              ),
            ),
            const SizedBox(width: MmSpace.s12),
            Expanded(
              child: Padding(
                padding: const EdgeInsets.only(bottom: MmSpace.s24),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(title, style: type.labelLarge),
                    const SizedBox(height: MmSpace.s12),
                    LifeRow(stage: item.stage, bubbleSize: 14, animate: false),
                    const SizedBox(height: MmSpace.s12),
                    for (final l in lines) ...[Text(l, style: type.small.copyWith(color: colors.ink2)), const SizedBox(height: 2)],
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
    canvas.drawLine(Offset(x, top ? 0 : 12), Offset(x, bottom ? size.height : 12), paint);
  }

  @override
  bool shouldRepaint(_RailPainter old) => old.color != color || old.top != top || old.bottom != bottom;
}
