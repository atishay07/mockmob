// `/today/alternatives`: "Choose something else" (spec 5.3). The plan's own alternatives first,
// then the usual ways to practise, then Review. "Not today" hides only tonight's repair until
// 4:00 AM or the next submitted paper; nothing in Review or the record changes. Costs are not
// shown here: they live on the confirm sheet (brief section 8).
import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/router/action_router.dart';
import '../../../core/router/routes.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import '../data/today_providers.dart';
import '../logic/links.dart';
import '../logic/move_builder.dart';

class AlternativeRow {
  const AlternativeRow({required this.title, required this.note, required this.location, required this.icon});

  final String title;
  final String note;
  final String location;
  final IconData icon;
}

/// The rows for [subject] (public or internal id), with the plan's native alternatives first.
List<AlternativeRow> alternativeRows({String? subject, List<({String title, String? note, String? href})> plan = const []}) {
  return [
    for (final a in plan.take(2))
      if (ActionRouter.resolve(a.href) case NativeTarget(:final location))
        AlternativeRow(title: a.title, note: a.note ?? '', location: location, icon: LucideIcons.sparkles),
    AlternativeRow(title: TodayCopy.altFullMock, note: TodayCopy.altFullMockLine, location: TodayLinks.fullMock(subject: subject), icon: LucideIcons.fileText),
    AlternativeRow(title: TodayCopy.altQuick, note: TodayCopy.altQuickLine, location: TodayLinks.quick(subject: subject), icon: LucideIcons.zap),
    AlternativeRow(title: TodayCopy.altChapter, note: TodayCopy.altChapterLine, location: AppRoutes.practiceSetup('chapter'), icon: LucideIcons.bookOpen),
    const AlternativeRow(title: TodayCopy.altReview, note: TodayCopy.altReviewLine, location: AppRoutes.review, icon: LucideIcons.listChecks),
  ];
}

class AlternativesSheet extends ConsumerWidget {
  const AlternativesSheet({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final inputs = ref.watch(todayInputsProvider);
    final facts = MoveFacts(inputs);
    final basis = facts.basis;
    final canDismiss = basis != null && facts.candidates.isNotEmpty && !facts.dismissed;
    final plan = inputs.plan;
    final rows = alternativeRows(
      subject: basis?.subject ?? (inputs.subjects.isEmpty ? null : inputs.subjects.first),
      plan: [for (final a in plan?.alternatives ?? const []) (title: a.title, note: a.duration, href: a.href)],
    );
    return AlternativesSheetBody(
      rows: rows,
      onRow: (row) {
        final router = GoRouter.of(context);
        Navigator.of(context).maybePop();
        if (AppRoutes.tabRoots.contains(row.location)) {
          router.go(row.location);
        } else {
          unawaited(router.push(row.location));
        }
      },
      onNotToday: canDismiss
          ? () async {
              await ref.read(todayActionsProvider).notToday();
              if (context.mounted) await Navigator.of(context).maybePop();
            }
          : null,
    );
  }
}

class AlternativesSheetBody extends StatelessWidget {
  const AlternativesSheetBody({super.key, required this.rows, required this.onRow, this.onNotToday});

  final List<AlternativeRow> rows;
  final ValueChanged<AlternativeRow> onRow;
  final VoidCallback? onNotToday;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return Padding(
      padding: const EdgeInsets.fromLTRB(MmSpace.s20, MmSpace.s4, MmSpace.s20, MmSpace.s20),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Semantics(header: true, child: Text(TodayCopy.alternativesTitle, style: type.title)),
          const SizedBox(height: MmSpace.s12),
          for (final r in rows) ...[
            MmSelectRow(
              title: r.title,
              note: r.note,
              selected: false,
              leading: Icon(r.icon, size: 20, color: colors.ink2),
              trailing: const SizedBox.shrink(),
              onTap: () => onRow(r),
            ),
            const SizedBox(height: MmSpace.s8),
          ],
          if (onNotToday != null) ...[
            const SizedBox(height: MmSpace.s4),
            Center(child: KeyButton.quiet(label: TodayCopy.notToday, onPressed: onNotToday)),
            Text(TodayCopy.notTodayNote, textAlign: TextAlign.center, style: type.caption.copyWith(color: colors.ink3)),
          ],
        ],
      ),
    );
  }
}
