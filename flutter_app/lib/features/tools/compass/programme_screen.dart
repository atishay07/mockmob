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
import '../combo/combo_controller.dart';
import '../tools_paths.dart';
import '../widgets/load_states.dart';
import '../widgets/tools_origin.dart';
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
      SliverToBoxAdapter(child: ToolsCard(child: RulesList(rows: rules, skipMissingFor: verdict.eligible ? null : verdict.nearest?.label))),
      // A programme the subjects do not open: its cutoffs are folded, not laid out as if the
      // student could act on them.
      SliverToBoxAdapter(child: _Cutoffs(group: group, state: s, folded: !s.selection.isEmpty && !verdict.eligible)),
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
      const SliverToBoxAdapter(child: ToolsNote(ToolsCopy.dataLine, top: MmSpace.s20)),
    ];
  }
}

/// The college cutoffs of one programme: open by default; folded under "See cutoffs anyway" when
/// the student's subjects do not open the programme.
class _Cutoffs extends StatefulWidget {
  const _Cutoffs({required this.group, required this.state, required this.folded});

  final DuGroup group;
  final CompassState state;
  final bool folded;

  @override
  State<_Cutoffs> createState() => _CutoffsState();
}

class _CutoffsState extends State<_Cutoffs> {
  bool _shown = false;

  @override
  Widget build(BuildContext context) {
    final s = widget.state;
    final group = widget.group;
    final open = !widget.folded || _shown;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        ToolsHeading(
          ToolsCopy.cutoffsHeading,
          note: open
              ? '${ToolsCopy.categoryNow(s.category)}${s.score != null ? ', score ${duFormatScore(s.score)}' : ''}'
              : ToolsCopy.cutoffsNotOpenNote,
          trailing: open && group.hasCutoffs
              ? ToolsInlineAction(label: ToolsCopy.change, icon: LucideIcons.pencilLine, onTap: () => showCategoryScoreSheet(context))
              : null,
        ),
        if (widget.folded)
          ToolsPanel(
            children: [
              ToolsRowFrame(
                onTap: () => setState(() => _shown = !_shown),
                semanticsLabel: _shown ? ToolsCopy.hideCutoffs : ToolsCopy.seeCutoffsAnyway,
                child: Row(
                  children: [
                    Expanded(child: Text(_shown ? ToolsCopy.hideCutoffs : ToolsCopy.seeCutoffsAnyway, style: context.mmType.labelLarge)),
                    Icon(_shown ? LucideIcons.chevronUp : LucideIcons.chevronDown, size: 18, color: context.mmColors.ink3),
                  ],
                ),
              ),
            ],
          ),
        if (widget.folded && _shown) const SizedBox(height: MmSpace.s16),
        if (open) group.hasCutoffs ? CutoffTable(group: group, state: s) : const ToolsNote(ToolsCopy.noCutoffsBody, top: 0),
      ],
    );
  }
}

/// The answer to "can I apply?": an inked bubble and the combination that opens it, or an empty
/// one with what the nearest combination still needs and the key to change subjects.
class _VerdictCard extends ConsumerWidget {
  const _VerdictCard({required this.state, required this.verdict});

  final CompassState state;
  final DuVerdict verdict;

  /// Adds this programme to Combo Planner's targets (unless it is there or the six are taken)
  /// and opens the planner.
  Future<void> _plan(BuildContext context, WidgetRef ref) async {
    try {
      final combo = await ref.read(comboControllerProvider.future);
      if (!combo.targets.contains(verdict.group.id)) ref.read(comboControllerProvider.notifier).toggleTarget(verdict.group.id);
    } on Object {
      // The planner opens on its own load-failed state with Try again.
    }
    if (context.mounted) await ToolsOrigin.openOrReturn(context, to: ToolsPaths.combo, from: ToolsOrigin.compass);
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = context.mmColors;
    final type = context.mmType;
    final v = verdict;
    final r1 = roundOneVerdict(v.group, state.category, state.score);
    final gaps = [for (final g in v.nearest?.gaps ?? const <DuGap>[]) duDescribeGap(g, state.catalog)];
    final empty = state.selection.isEmpty;
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
                        empty
                            ? ToolsCopy.emptyHeroTitle
                            : v.eligible
                                ? ToolsCopy.eligibleTitle
                                : ToolsCopy.notEligible,
                        style: type.cardTitle,
                      ),
                      // Which combination opens it is the rule list's job, once, just below. A
                      // programme not open yet says here what one more subject changes.
                      if (!v.eligible && gaps.isNotEmpty) ...[
                        const SizedBox(height: MmSpace.s4),
                        Text(gaps.join(', '), style: type.small.copyWith(color: colors.warnText)),
                      ],
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
            const SizedBox(height: MmSpace.s20),
            KeyButton(
              label: empty ? ToolsCopy.pickSubjects : ToolsCopy.editSubjects,
              onPressed: () => openCompassPicker(context, ref, state.catalog),
            ),
            // The other way round: this course as a Combo Planner target, and the papers that open it.
            const SizedBox(height: MmSpace.s8),
            KeyButton.secondary(label: ToolsCopy.planThisCourse, onPressed: () => _plan(context, ref)),
          ],
        ],
      ),
    );
  }
}
