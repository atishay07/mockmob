// `/today/alternatives`: "Choose something else" (spec 5.3). The plan's own alternatives first,
// then the usual ways to practise, then Review. "Not today" hides only tonight's repair until
// 4:00 AM or the next submitted paper; nothing in Review or the record changes. Costs are not
// shown here: they live on the confirm sheet (brief section 8).
import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/haptics/haptics.dart';
import '../../../core/router/action_router.dart';
import '../../../core/router/routes.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import '../data/today_providers.dart';
import '../logic/links.dart';
import '../../../core/domain/repair_candidates.dart' show repairDurationOptions;
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
    final durations = facts.tonight == null || facts.dismissed ? const <int>[] : [for (final o in repairDurationOptions(facts.tonight!.items.length)) o.minutes];
    return AlternativesSheetBody(
      durations: durations,
      // The same pick the Today card makes, so the sheet never highlights another length.
      minutes: repairMinutesSelected(inputs, facts),
      onMinutes: (m) => ref.read(todayMinutesProvider.notifier).choose(m),
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
  const AlternativesSheetBody({
    super.key,
    required this.rows,
    required this.onRow,
    this.onNotToday,
    this.durations = const [],
    this.minutes,
    this.onMinutes,
  });

  final List<AlternativeRow> rows;

  /// The lengths tonight's repair can take ("5 min", "10 min"), when it can change size.
  final List<int> durations;
  final int? minutes;
  final ValueChanged<int>? onMinutes;
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
          if (durations.length > 1 && minutes != null) ...[
            Text(TodayCopy.repairLength, style: type.labelLarge),
            const SizedBox(height: MmSpace.s8),
            MmSegmented<int>(
              semanticsLabel: TodayCopy.repairLength,
              segments: [for (final d in durations) MmSegment(d, '$d min')],
              value: minutes!,
              onChanged: onMinutes,
            ),
            const SizedBox(height: MmSpace.s20),
          ],
          for (final r in rows) ...[
            _AlternativeTile(row: r, onTap: () => onRow(r)),
            const SizedBox(height: MmSpace.s8),
          ],
          if (onNotToday != null) ...[
            const SizedBox(height: MmSpace.s4),
            Center(child: KeyButton.quiet(label: TodayCopy.notToday, onPressed: onNotToday)),
            Text(TodayCopy.notTodayNote, textAlign: TextAlign.center, style: type.caption.copyWith(color: colors.ink2)),
          ],
        ],
      ),
    );
  }
}

/// One way to practise: an icon, the title and its line, and a chevron. A row opens its screen
/// when tapped, so it carries no selection ring. 56 dp minimum.
class _AlternativeTile extends ConsumerWidget {
  const _AlternativeTile({required this.row, required this.onTap});

  final AlternativeRow row;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = context.mmColors;
    final type = context.mmType;
    return MmPressable(
      semanticsLabel: row.note.isEmpty ? row.title : '${row.title}. ${row.note}',
      focusRadius: MmRadius.keyAll,
      onTap: () {
        ref.read(hapticsProvider).selection();
        onTap();
      },
      builder: (context, pressed, _) => DecoratedBox(
        decoration: ShapeDecoration(
          color: MmSelection.fill(colors, selected: false, pressed: pressed),
          shape: mmShapeBorder(MmRadius.keyAll, side: MmSelection.side(colors, selected: false)),
        ),
        child: ConstrainedBox(
          constraints: const BoxConstraints(minHeight: 56),
          child: Padding(
            padding: const EdgeInsets.fromLTRB(MmSpace.s16, MmSpace.s8, MmSpace.s12, MmSpace.s8),
            child: Row(
              children: [
                Icon(row.icon, size: 20, color: colors.ink2),
                const SizedBox(width: MmSpace.s12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(row.title, style: type.body.copyWith(fontWeight: FontWeight.w500, color: colors.ink)),
                      if (row.note.isNotEmpty) ...[
                        const SizedBox(height: 2),
                        Text(row.note, style: type.caption.copyWith(color: colors.ink3)),
                      ],
                    ],
                  ),
                ),
                const SizedBox(width: MmSpace.s8),
                Icon(LucideIcons.chevronRight, size: 18, color: colors.ink3),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
