import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import '../data/du_repository.dart';
import '../domain/du_eligibility.dart';
import '../domain/du_helpers.dart';
import '../domain/du_models.dart';
import '../widgets/load_states.dart';
import '../widgets/tools_card.dart';
import '../widgets/tools_page.dart';
import 'category_score.dart';
import 'compass_controller.dart';
import 'compass_hero.dart';
import 'cutoff_table.dart';
import 'programme_rows.dart';
import 'rules_list.dart';

/// One DU programme (`/tools/compass/:groupId`): whether the student's subjects open it and
/// through which Bulletin combination, every combination checked, then the colleges' 2026
/// cutoffs for the chosen category.
class ProgrammeScreen extends ConsumerWidget {
  const ProgrammeScreen({super.key, required this.groupId});

  final String groupId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(compassControllerProvider);
    final s = async.value;
    final group = s?.catalog.group(groupId);
    final title = group?.name ?? ToolsCopy.compassTitle;
    final List<Widget> slivers;
    if (s == null) {
      slivers = [
        SliverToBoxAdapter(
          child: async.hasError
              ? ToolsLoadFailed(
                  error: async.error!,
                  onRetry: () {
                    ref.invalidate(duCatalogProvider);
                    ref.invalidate(compassControllerProvider);
                  },
                )
              : const ToolsLoading(rows: 3),
        ),
      ];
    } else if (group == null) {
      slivers = [
        const SliverToBoxAdapter(
          child: Padding(
            padding: EdgeInsets.only(top: MmSpace.s32),
            child: StateView(kind: StateViewKind.empty, title: ToolsCopy.unknownProgramme, message: ToolsCopy.unknownProgrammeBody),
          ),
        ),
      ];
    } else {
      slivers = _ready(context, ref, s, group);
    }
    return ToolsPage(title: title, large: false, lead: group == null ? null : _lead(group), slivers: slivers);
  }

  String _lead(DuGroup g) {
    final parts = [g.stream, if (g.hasCutoffs) ToolsCopy.colleges(g.colleges) else ToolsCopy.noCutoffList];
    return '${parts.join('. ')}.';
  }

  List<Widget> _ready(BuildContext context, WidgetRef ref, CompassState s, DuGroup group) {
    final verdict = s.verdictFor(group.id) ?? duEvaluateGroup(group, s.selection);
    final rules = duExplainCombinations(group, s.selection, s.catalog);
    return [
      SliverToBoxAdapter(child: _VerdictCard(state: s, verdict: verdict)),
      const SliverToBoxAdapter(child: ToolsHeading(ToolsCopy.rulesHeading)),
      SliverToBoxAdapter(child: ToolsCard(child: RulesList(rows: rules))),
      SliverToBoxAdapter(
        child: ToolsHeading(
          ToolsCopy.cutoffsHeading,
          note: '${ToolsCopy.categoryNow(s.category)}${s.score != null ? ', score ${duFormatScore(s.score)}' : ''}',
          trailing: group.hasCutoffs ? KeyButton.quiet(label: ToolsCopy.change, onPressed: () => showCategoryScoreSheet(context)) : null,
        ),
      ),
      SliverToBoxAdapter(
        child: group.hasCutoffs
            ? CutoffTable(group: group, state: s)
            : const ToolsNote(ToolsCopy.noCutoffsBody, top: 0),
      ),
      if (group.eligibility.notes.isNotEmpty) ...[
        const SliverToBoxAdapter(child: ToolsHeading(ToolsCopy.notesHeading)),
        SliverToBoxAdapter(
          child: ToolsCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                for (final n in group.eligibility.notes)
                  Padding(
                    padding: const EdgeInsets.only(bottom: MmSpace.s8),
                    child: Text(n, style: context.mmType.small.copyWith(color: context.mmColors.ink2)),
                  ),
              ],
            ),
          ),
        ),
      ],
      const SliverToBoxAdapter(child: ToolsNote(ToolsCopy.honesty, top: MmSpace.s20, icon: LucideIcons.info)),
    ];
  }
}

/// The answer to "can I apply?": an inked bubble and the combination that opens it, or an empty
/// one with what the nearest combination still needs and the key to change subjects.
class _VerdictCard extends ConsumerWidget {
  const _VerdictCard({required this.state, required this.verdict});

  final CompassState state;
  final DuVerdict verdict;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = context.mmColors;
    final type = context.mmType;
    final v = verdict;
    final r1 = roundOneVerdict(v.group, state.category, state.score);
    final gaps = [for (final g in v.nearest?.gaps ?? const <DuGap>[]) duDescribeGap(g, state.catalog)];
    return ToolsCard(
      lit: v.eligible,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          MergeSemantics(
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Padding(
                  padding: const EdgeInsets.only(top: 1),
                  child: Bubble(state: v.eligible ? BubbleState.filled : BubbleState.hollow, size: 22, animate: false),
                ),
                const SizedBox(width: MmSpace.s12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        state.selection.isEmpty
                            ? ToolsCopy.emptyHeroTitle
                            : v.eligible
                                ? ToolsCopy.eligibleVia(v.matched!.label)
                                : ToolsCopy.notEligible,
                        style: type.cardTitle,
                      ),
                      const SizedBox(height: MmSpace.s4),
                      if (v.eligible)
                        Text(v.matched!.text, style: type.small.copyWith(color: colors.ink2))
                      else if (gaps.isNotEmpty)
                        Text(gaps.join(', '), style: type.small.copyWith(color: colors.ink2)),
                      if (v.secondary) ...[
                        const SizedBox(height: MmSpace.s4),
                        Text(ToolsCopy.secondaryNote, style: type.caption.copyWith(color: colors.warnText)),
                      ],
                      if (v.group.eligibility.performanceTest) ...[
                        const SizedBox(height: MmSpace.s4),
                        Text(ToolsCopy.performanceNote, style: type.caption.copyWith(color: colors.ink2)),
                      ],
                    ],
                  ),
                ),
              ],
            ),
          ),
          if (r1 != null) ...[
            const SizedBox(height: MmSpace.s12),
            ToolTag(r1.$1, tone: r1.$2),
          ],
          if (!v.eligible) ...[
            const SizedBox(height: MmSpace.s16),
            KeyButton.secondary(
              label: state.selection.isEmpty ? ToolsCopy.pickSubjects : ToolsCopy.editSubjects,
              expanded: false,
              onPressed: () => openCompassPicker(context, ref, state.catalog),
            ),
          ],
        ],
      ),
    );
  }
}
