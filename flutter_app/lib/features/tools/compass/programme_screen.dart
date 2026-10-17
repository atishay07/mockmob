import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import '../data/du_repository.dart';
import '../domain/du_eligibility.dart';
import '../domain/du_models.dart';
import '../combo/combo_controller.dart';
import '../colleges/colleges_copy.dart';
import '../estimate/estimate.dart';
import '../estimate/estimate_providers.dart';
import '../estimate/estimate_sheet.dart';
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
  const ProgrammeScreen({super.key, required this.groupId, this.college});

  final String groupId;

  /// From a rung on the Colleges tab (`?college=`): the college to bring into view.
  final String? college;

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
    final estimate = ref.watch(estimateProvider);
    return [
      SliverToBoxAdapter(child: _VerdictCard(state: s, verdict: verdict, estimate: estimate)),
      if (group.hasCutoffs) SliverToBoxAdapter(child: _WhereYouStand(group: group, category: s.category, estimate: estimate)),
      const SliverToBoxAdapter(child: ToolsHeading(ToolsCopy.rulesHeading)),
      SliverToBoxAdapter(child: ToolsCard(child: RulesList(rows: rules, skipMissingFor: verdict.eligible ? null : verdict.nearest?.label))),
      // A programme the subjects do not open: its cutoffs are folded, not laid out as if the
      // student could act on them.
      SliverToBoxAdapter(child: _Cutoffs(group: group, state: s, estimate: estimate, highlight: college, folded: !s.selection.isEmpty && !verdict.eligible)),
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
class _Cutoffs extends ConsumerStatefulWidget {
  const _Cutoffs({required this.group, required this.state, required this.folded, this.estimate, this.highlight});

  final DuGroup group;
  final CompassState state;
  final bool folded;
  final Estimate? estimate;
  final String? highlight;

  @override
  ConsumerState<_Cutoffs> createState() => _CutoffsState();
}

class _CutoffsState extends ConsumerState<_Cutoffs> {
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
              ? '${ToolsCopy.categoryNow(s.category)}${widget.estimate != null ? ', your estimate ${estimateRange(widget.estimate!)}' : ''}'
              : ToolsCopy.cutoffsNotOpenNote,
        ),
        // The category as an inline rail (L26): it changes every figure below.
        if (open && group.hasCutoffs)
          Padding(
            padding: const EdgeInsets.only(bottom: MmSpace.s12),
            child: ChipRail.labelled(
              semanticLabel: ToolsCopy.category,
              labels: [for (final c in duMainCategories) categoryLabel(c), ToolsCopy.otherQuota],
              selected: duMainCategories.contains(s.category) ? duMainCategories.indexOf(s.category) : duMainCategories.length,
              onSelected: (i) => i < duMainCategories.length
                  ? ref.read(compassControllerProvider.notifier).setCategory(duMainCategories[i])
                  : showOtherQuotaSheet(context, ref),
            ),
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
        if (open)
          group.hasCutoffs
              ? CutoffTable(group: group, state: s, estimate: widget.estimate, highlight: widget.highlight)
              : const ToolsNote(ToolsCopy.noCutoffsBody, top: 0),
      ],
    );
  }
}

/// The answer to "can I apply?": an inked bubble and the combination that opens it, or an empty
/// one with what the nearest combination still needs and the key to change subjects.
class _VerdictCard extends ConsumerWidget {
  const _VerdictCard({required this.state, required this.verdict, this.estimate});

  final CompassState state;
  final DuVerdict verdict;
  final Estimate? estimate;

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
    final r1 = roundOneVerdict(v.group, state.category, estimate?.low, estimate?.high);
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

/// Where you stand on this course: how many of its colleges the estimate clears in Round 1 and how
/// many more sit within the range, with one Mobi beside it reacting to that (nod, think or
/// encourage, once per estimate and category). Without an estimate: what will fill it, and a
/// quiet "Type an estimate". Never a field.
class _WhereYouStand extends ConsumerWidget {
  const _WhereYouStand({required this.group, required this.category, required this.estimate});

  final DuGroup group;
  final String category;
  final Estimate? estimate;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = context.mmColors;
    final type = context.mmType;
    final e = estimate;
    if (e == null) {
      return Padding(
        padding: const EdgeInsets.fromLTRB(MmSpace.gutter, MmSpace.s16, MmSpace.gutter, 0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(CollegesCopy.noEstimate, style: type.small.copyWith(color: colors.ink2)),
            const SizedBox(height: MmSpace.s12),
            KeyButton.secondary(label: CollegesCopy.typeEstimate, expanded: false, minHeight: 48, onPressed: () => showEstimateSheet(context)),
          ],
        ),
      );
    }
    final offerings = ref.watch(duOfferingsProvider(group.id)).value;
    final catalog = ref.watch(compassControllerProvider).value?.catalog;
    if (offerings == null || catalog == null) return const SizedBox.shrink();
    final ci = catalog.categoryIndex(category);
    final seen = <String>{};
    var total = 0;
    var clears = 0;
    var within = 0;
    for (final seat in offerings.seats) {
      if (!seen.add(seat.college)) continue;
      final c = duEffectiveCutoff(seat.rounds[0], ci);
      if (c == null) continue;
      total++;
      switch (verdictFor(e, c).v) {
        case Verdict.clears:
          clears++;
        case Verdict.within:
          within++;
        case Verdict.below || Verdict.noSeat:
          break;
      }
    }
    if (total == 0) return const SizedBox.shrink();
    final act = clears > 0 ? MobiAct.nod : (within > 0 ? MobiAct.think : MobiAct.encourage);
    return Padding(
      padding: const EdgeInsets.fromLTRB(MmSpace.gutter, MmSpace.s16, MmSpace.gutter, 0),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          Expanded(
            child: Semantics(
              liveRegion: true,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(ToolsCopy.whereYouStand, style: type.caption.copyWith(color: colors.ink2)),
                  const SizedBox(height: MmSpace.s4),
                  Text(CollegesCopy.programmeStands(clears, total, within), style: type.body.copyWith(color: colors.ink)),
                ],
              ),
            ),
          ),
          const SizedBox(width: MmSpace.s12),
          ExcludeSemantics(
            child: MobiCharacter(
              key: ValueKey('programme-mobi-${Object.hash(e, category)}'),
              size: 40,
              entrance: act,
              shadow: false,
              watchTaps: false,
            ),
          ),
        ],
      ),
    );
  }
}
