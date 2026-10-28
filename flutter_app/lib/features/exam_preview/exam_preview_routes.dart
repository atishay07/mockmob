import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../core/theme/theme.dart';
import 'exam_preview_copy.dart';
import 'exam_preview_screen.dart';

/// The free exam-screen preview's route. Registered in router.dart outside the shell (no dock,
/// like `/exam/nta` and `/run`); Practice's NTA mode row opens [ExamPreviewRoutes.path].
abstract final class ExamPreviewRoutes {
  static const String path = '/exam/nta/preview';
}

Widget examPreviewScreen(BuildContext context, GoRouterState state) => const ExamPreviewScreen();

/// The quiet row under NTA mode on Practice: "See the exam screen first", with what it holds.
/// A plain row (no card, no pill) so it sits under the NTA row without a second box.
class ExamPreviewEntry extends StatelessWidget {
  const ExamPreviewEntry({super.key});

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return Semantics(
      button: true,
      label: '${ExamPreviewCopy.entryTitle}. ${ExamPreviewCopy.entryNote}',
      excludeSemantics: true,
      child: InkWell(
        onTap: () => context.push(ExamPreviewRoutes.path),
        child: ConstrainedBox(
          constraints: const BoxConstraints(minHeight: 56),
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: MmSpace.s12),
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(ExamPreviewCopy.entryTitle, style: type.labelLarge.copyWith(color: colors.ink)),
                      const SizedBox(height: MmSpace.s2),
                      Text(ExamPreviewCopy.entryNote, style: type.caption.copyWith(color: colors.ink2)),
                    ],
                  ),
                ),
                const SizedBox(width: MmSpace.s12),
                Icon(LucideIcons.chevronRight, size: 18, color: colors.ink3),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
