import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/models/mistake_lab_traps.dart';
import '../../../core/router/routes.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';

/// "Same mistakes later" in Prove (Mistake Lab v4 slice 4, spec 4.8): which of this paper's wrong
/// answers come back in Revise, and when, with the one honest difference between this and Prove's
/// fresh questions ("Same questions, so this checks memory. Fresh questions check the idea.").
///
/// Every sentence is the server's, finished, with its denominator; the count is never more than
/// the day's cap of 10. Revise costs no credits and writes no attempts row, and the fine line
/// says so. The key shows once questions are ready now, and opens Revise, a page of its own that
/// is never part of a paper. Nothing here promises a mark.
class SameMistakesLaterView extends StatelessWidget {
  const SameMistakesLaterView({super.key, required this.later, this.onOpen});

  final SameMistakesLater later;

  /// Opens Revise. Defaults to pushing `/review/revise` (tests and goldens pass their own).
  final VoidCallback? onOpen;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final l = later;
    return MmSection(
      title: l.title,
      child: MmSurface.inset(
        padding: const EdgeInsets.all(MmSpace.s16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Padding(padding: const EdgeInsets.only(top: 1), child: Icon(LucideIcons.calendarClock, size: 24, color: colors.accentText)),
                const SizedBox(width: MmSpace.s12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(l.line, style: type.cardTitle.copyWith(fontSize: 16, height: 22 / 16, fontFeatures: const [FontFeature.tabularFigures()])),
                      const SizedBox(height: MmSpace.s6),
                      Text(l.note, style: type.body.copyWith(color: colors.ink2)),
                    ],
                  ),
                ),
              ],
            ),
            if (l.ready) ...[
              const SizedBox(height: MmSpace.s16),
              KeyButton.secondary(
                label: l.open,
                expanded: false,
                onPressed: onOpen ?? () => context.push(AppRoutes.reviewRevise),
              ),
            ],
            if (l.fine != null) ...[
              const SizedBox(height: MmSpace.s12),
              Text(l.fine!, style: type.small.copyWith(color: colors.ink3)),
            ],
          ],
        ),
      ),
    );
  }
}
