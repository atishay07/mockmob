import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import '../data/du_repository.dart';
import '../domain/du_combos.dart';
import '../domain/du_helpers.dart';
import '../widgets/action_chip.dart';
import '../widgets/load_states.dart';
import '../widgets/subject_picker_sheet.dart';
import '../widgets/tools_card.dart';
import '../widgets/tools_page.dart';
import 'combo_controller.dart';
import 'combo_results.dart';

/// The Combo planner (`/tools/combo`): target DU programmes and the subjects the student could
/// take in, the best combinations out, ranked by targets opened, then all programmes opened,
/// then fewest papers. Subject rules only: no scores, no chances.
class ComboScreen extends ConsumerStatefulWidget {
  const ComboScreen({super.key});

  @override
  ConsumerState<ComboScreen> createState() => _ComboScreenState();
}

class _ComboScreenState extends ConsumerState<ComboScreen> {
  final _search = TextEditingController();
  String _query = '';

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final async = ref.watch(comboControllerProvider);
    final slivers = switch (async) {
      AsyncData(:final value) => _ready(context, value),
      AsyncError(:final error) => [
          SliverToBoxAdapter(
            child: ToolsLoadFailed(
              error: error,
              onRetry: () {
                ref.invalidate(duCatalogProvider);
                ref.invalidate(comboControllerProvider);
              },
            ),
          ),
        ],
      _ => const [SliverToBoxAdapter(child: ToolsLoading())],
    };
    return ToolsPage(title: ToolsCopy.comboTitle, lead: ToolsCopy.comboLead, slivers: slivers);
  }

  List<Widget> _ready(BuildContext context, ComboState s) {
    final colors = context.mmColors;
    final type = context.mmType;
    final controller = ref.read(comboControllerProvider.notifier);
    final q = _query.trim().toLowerCase();
    final matches = q.isEmpty ? const [] : s.catalog.groups.where((g) => g.name.toLowerCase().contains(q)).take(8).toList();
    final quick = [for (final name in duQuickTargets) ?s.catalog.groups.where((g) => g.name == name).firstOrNull];
    final plan = ref.watch(comboPlanProvider);
    final result = plan.value ?? DuComboPlan.empty;

    return [
      _Step(done: s.targets.isNotEmpty, title: ToolsCopy.targetsHeading, note: ToolsCopy.targetsHint(duMaxTargets, s.targets.length), top: 0),
      SliverToBoxAdapter(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: MmSpace.gutter + 4),
          child: Wrap(
            spacing: MmSpace.s8,
            children: [
              for (final g in quick)
                if (s.targets.contains(g.id)) MmChip(label: g.name, selected: true, onTap: () => controller.toggleTarget(g.id)),
              for (final g in quick)
                if (!s.targets.contains(g.id))
                  MmChip(label: g.name, selected: false, onTap: s.targetsFull ? null : () => controller.toggleTarget(g.id)),
            ],
          ),
        ),
      ),
      // Programmes chosen from search can have long names: rows, not chips.
      if (s.targets.where((id) => !quick.any((g) => g.id == id)).toList() case final others when others.isNotEmpty)
        SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(MmSpace.gutter, MmSpace.s8, MmSpace.gutter, 0),
            child: Column(
              children: [
                for (final id in others)
                  MmSelectRow(
                    title: s.catalog.group(id)?.name ?? id,
                    note: ToolsCopy.remove,
                    multi: true,
                    selected: true,
                    onTap: () => controller.toggleTarget(id),
                  ),
              ],
            ),
          ),
        ),
      SliverToBoxAdapter(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(MmSpace.gutter, MmSpace.s12, MmSpace.gutter, 0),
          child: ToolsSearchField(controller: _search, hint: ToolsCopy.searchAll, onChanged: (v) => setState(() => _query = v)),
        ),
      ),
      if (matches.isNotEmpty)
        SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(MmSpace.gutter, MmSpace.s8, MmSpace.gutter, 0),
            child: Column(
              children: [
                for (final g in matches)
                  MmSelectRow(
                    title: g.name,
                    note: g.stream,
                    multi: true,
                    selected: s.targets.contains(g.id),
                    onTap: !s.targets.contains(g.id) && s.targetsFull ? null : () => controller.toggleTarget(g.id),
                  ),
              ],
            ),
          ),
        ),
      if (s.targetsFull) const SliverToBoxAdapter(child: ToolsNote(ToolsCopy.targetFull, top: MmSpace.s8)),
      _Step(done: s.pool.isNotEmpty, title: ToolsCopy.poolHeading, note: ToolsCopy.poolHint(duMaxPool, s.pool.length, s.maxPapers)),
      SliverToBoxAdapter(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: MmSpace.gutter + 4),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (s.pool.isEmpty) ...[
                Text(ToolsCopy.quickStart, style: type.caption.copyWith(color: colors.ink3)),
                const SizedBox(height: MmSpace.s4),
                Wrap(
                  spacing: MmSpace.s8,
                  children: [
                    for (final p in duPresets)
                      ToolsActionChip(label: p.label, icon: LucideIcons.zap, onTap: () => controller.applyPreset(p)),
                  ],
                ),
              ] else
                Wrap(
                  spacing: MmSpace.s8,
                  children: [
                    for (final p in s.pool)
                      MmChip(label: p.name(s.catalog, short: true), selected: true, onTap: () => controller.togglePick(p)),
                  ],
                ),
              const SizedBox(height: MmSpace.s12),
              KeyButton.secondary(
                label: s.pool.isEmpty ? ToolsCopy.pickSubjects : ToolsCopy.editSubjects,
                expanded: false,
                onPressed: () => showSubjectPicker(
                  context: context,
                  catalog: s.catalog,
                  watch: (ref) => ref.watch(comboControllerProvider).value?.pool.toSet() ?? const {},
                  onToggle: controller.togglePick,
                  onPreset: controller.applyPreset,
                  onClear: controller.clearPool,
                  limit: duMaxPool,
                  limitNote: ToolsCopy.poolFull,
                ),
              ),
              const SizedBox(height: MmSpace.s24),
              Text(ToolsCopy.papersHeading, style: type.labelLarge),
              const SizedBox(height: MmSpace.s8),
              MmSegmented<int>(
                semanticsLabel: ToolsCopy.papersHeading,
                segments: const [MmSegment(3, '3'), MmSegment(4, '4'), MmSegment(5, '5')],
                value: s.maxPapers,
                onChanged: controller.setMaxPapers,
              ),
            ],
          ),
        ),
      ),
      _Step(
        done: result.ranked.isNotEmpty,
        title: ToolsCopy.resultsHeading,
        note: s.pool.isEmpty ? ToolsCopy.resultsEmpty : null,
      ),
      if (result.keep.isNotEmpty && s.pool.isNotEmpty && !plan.isLoading)
        SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(MmSpace.gutter + 4, 0, MmSpace.gutter + 4, MmSpace.s16),
            child: Text(
              ToolsCopy.keep([for (final k in result.keep) k.name(s.catalog, short: true)].join(', '), result.keep.length),
              style: type.body,
            ),
          ),
        ),
      if (s.pool.isNotEmpty)
        SliverToBoxAdapter(
          child: ComboResults(checking: plan.isLoading, ranked: result.ranked, catalog: s.catalog, targetCount: s.targets.length),
        ),
      if (plan.hasError && s.pool.isNotEmpty)
        SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: MmSpace.gutter),
            child: InlineBanner(
              tone: BannerTone.error,
              message: ToolsCopy.comboError,
              actionLabel: ToolsCopy.tryAgain,
              onAction: () => ref.invalidate(comboPlanProvider),
            ),
          ),
        ),
      const SliverToBoxAdapter(child: ToolsNote(ToolsCopy.dataLine, top: MmSpace.s8)),
    ];
  }
}

/// A step heading with an answer bubble that inks once the step has an answer.
class _Step extends StatelessWidget {
  const _Step({required this.done, required this.title, this.note, this.top = MmRhythm.section});

  final bool done;
  final String title;
  final String? note;
  final double top;

  @override
  Widget build(BuildContext context) {
    return SliverToBoxAdapter(
      child: ToolsHeading(
        title,
        note: note,
        top: top,
        leading: Bubble(state: done ? BubbleState.filled : BubbleState.hollow, size: 14, semanticsLabel: done ? 'Answered' : 'Not answered yet'),
      ),
    );
  }
}
