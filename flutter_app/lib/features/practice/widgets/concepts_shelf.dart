import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/models/study.dart';
import '../../../core/router/routes.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../../learn/copy.dart';
import '../../learn/data/catalog_repository.dart';
import '../../learn/models/learn_catalog.dart';
import '../copy.dart';
import 'mode_list.dart' show SectionHeading;

/// The lessons the shelf shows first: anything due, then what is in progress, then the server's
/// next lesson, then the rest in syllabus order. At most [max].
List<LearnUnit> shelfUnits(LearnCatalog catalog, {int max = 6}) {
  int rank(LearnUnit u) {
    if (u.dueCards > 0 || u.status == StudyUnitStatus.due) return 0;
    if (u.status == StudyUnitStatus.inProgress || u.status == StudyUnitStatus.lockIn) return 1;
    if (u.id == catalog.next?.id) return 2;
    if (u.status == StudyUnitStatus.learned) return 4;
    return 3;
  }

  final units = [
    for (final u in catalog.units)
      if (u.id.isNotEmpty && u.title.isNotEmpty) u,
  ];
  final order = {for (var i = 0; i < units.length; i++) units[i].id: i};
  units.sort((a, b) {
    final r = rank(a).compareTo(rank(b));
    return r != 0 ? r : order[a.id]!.compareTo(order[b.id]!);
  });
  return units.take(max).toList();
}

/// The Concepts shelf: short lessons, shown only while study content is switched on and there
/// is something to open. Otherwise it is not there at all (never a "not available" screen).
class ConceptsShelf extends ConsumerWidget {
  const ConceptsShelf({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final catalog = ref.watch(learnCatalogProvider.select((s) => s.value));
    if (catalog == null || catalog.isDisabled) return const SizedBox.shrink();
    final units = shelfUnits(catalog);
    if (units.isEmpty) return const SizedBox.shrink();
    final names = {for (final s in catalog.subjects) s.id: s.title};

    // A new section (SPACING.md 3.1): 32 of air, a hairline on the gutter, 16, the heading, 12.
    return Padding(
      padding: const EdgeInsets.only(top: MmSpace.s32),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: MmSpace.gutter),
            child: Divider(height: 1, thickness: 1, color: context.mmColors.line),
          ),
          const SizedBox(height: MmSpace.s16),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: MmSpace.gutter),
            child: SectionHeading(
              title: PracticeCopy.concepts,
              action: PracticeCopy.allConcepts,
              onAction: () => context.push(AppRoutes.learn),
            ),
          ),
          const SizedBox(height: MmSpace.s12),
          SizedBox(
            height: 148,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: MmSpace.gutter),
              itemCount: units.length,
              separatorBuilder: (_, _) => const SizedBox(width: MmSpace.s12),
              itemBuilder: (context, i) {
                final u = units[i];
                return ConceptCard(
                  unit: u,
                  subject: names[u.subject] ?? LearnCopy.subjectLabel(u.subject),
                  onTap: () => context.push(AppRoutes.learnUnit(u.id)),
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}

/// One lesson on the shelf: its status word, the title, and the subject with the time it takes.
class ConceptCard extends StatelessWidget {
  const ConceptCard({super.key, required this.unit, required this.subject, required this.onTap});

  final LearnUnit unit;
  final String subject;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final status = LearnCopy.statusWord(unit.status);
    final due = unit.dueCards > 0;
    final meta = unit.estimatedMinutes == null ? subject : '$subject, ${LearnCopy.minutes(unit.estimatedMinutes!)}';
    return MmPressable(
      semanticsLabel: '${unit.title}. $status. $meta',
      focusRadius: MmRadius.panelAll,
      haptic: MmPressHaptic.selection,
      onTap: onTap,
      builder: (context, pressed, _) => SizedBox(
        width: 216,
        child: FakeGlass(
          pressed: pressed,
          child: Padding(
            padding: const EdgeInsets.all(MmSpace.s16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Bubble(state: due ? BubbleState.filled : BubbleState.hollow, size: 10, animate: false),
                    const SizedBox(width: MmSpace.s8),
                    Text(
                      due ? LearnCopy.dueSummary(unit.dueCards).replaceAll('.', '') : status,
                      style: type.caption.copyWith(color: colors.ink2),
                    ),
                  ],
                ),
                const SizedBox(height: MmSpace.s12),
                Text(unit.title, maxLines: 2, overflow: TextOverflow.ellipsis, style: type.cardTitle.copyWith(fontSize: 16)),
                const Spacer(),
                Text(
                  meta,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: type.caption.copyWith(color: colors.ink2),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
