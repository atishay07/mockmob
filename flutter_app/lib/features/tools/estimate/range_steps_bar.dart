// The way to a range, drawn once for Today's range card and the estimate sheet's "I don't know my
// range yet" row: a segment per subject of the student's set (filled once its full mock is scored,
// outlined for the next one), each with its short name, then the count.

import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';
import '../../onboarding/data/subjects.dart' show SheetSubject;
import 'estimate_copy.dart';
import 'mock_estimate.dart';

/// A subject's name in a sentence ("Business Studies", "Maths").
String rangeSubjectName(String id) => switch (SheetSubject.byId(id)) {
      SheetSubject.mathematics => 'Maths',
      final SheetSubject s => s.label,
      null => id.isEmpty ? id : id[0].toUpperCase() + id.substring(1).replaceAll('_', ' '),
    };

/// A subject's short label under its segment ("Eng", "BSt").
String rangeSubjectAbbr(String id) => SheetSubject.byId(id)?.abbr ?? rangeSubjectName(id);

/// A segment per subject: filled when its full mock is done, outlined for the next one, quiet for
/// the rest, each with its short name under it; then the count.
class RangeStepsBar extends StatelessWidget {
  const RangeStepsBar({super.key, required this.progress});

  final RangeProgress progress;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final on = colors.isNight ? colors.volt : colors.accentText;
    final next = progress.next;
    final spoken = [
      for (final s in progress.steps) '${rangeSubjectName(s.id)} ${s.done ? 'done' : (s.id == next ? 'next' : 'to go')}',
    ].join(', ');
    return Semantics(
      label: '${EstimateCopy.count(progress.done, progress.total)}. $spoken.',
      child: ExcludeSemantics(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          mainAxisSize: MainAxisSize.min,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                for (final (i, s) in progress.steps.indexed) ...[
                  if (i > 0) const SizedBox(width: MmSpace.s4),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        AnimatedContainer(
                          duration: Motion.of(context, Motion.ui),
                          curve: Motion.out,
                          height: 8,
                          decoration: BoxDecoration(
                            color: s.done ? on : (s.id == next ? Colors.transparent : colors.line),
                            borderRadius: BorderRadius.circular(4),
                            border: s.id == next ? Border.all(color: on, width: 1.5) : null,
                          ),
                        ),
                        const SizedBox(height: MmSpace.s6),
                        Row(
                          children: [
                            if (s.done) ...[
                              Icon(LucideIcons.check, size: 12, color: on),
                              const SizedBox(width: 2),
                            ],
                            Flexible(
                              child: Text(
                                rangeSubjectAbbr(s.id),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: type.caption.copyWith(color: s.done || s.id == next ? colors.ink : colors.ink3, fontWeight: s.id == next ? FontWeight.w600 : null),
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ],
              ],
            ),
            const SizedBox(height: MmSpace.s8),
            Text(
              EstimateCopy.count(progress.done, progress.total),
              style: type.caption.copyWith(color: colors.ink2, fontFeatures: const [FontFeature.tabularFigures()]),
            ),
          ],
        ),
      ),
    );
  }
}
