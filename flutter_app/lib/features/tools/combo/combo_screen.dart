import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import '../data/du_repository.dart';
import '../domain/du_combos.dart';
import '../domain/du_helpers.dart';
import '../widgets/action_chip.dart';
import '../widgets/load_states.dart';
import '../widgets/pop_on_select.dart';
import '../widgets/ranked_reveal.dart';
import '../widgets/subject_picker_sheet.dart';
import '../widgets/tools_card.dart';
import '../widgets/tools_page.dart';
import '../my_colleges/college_search.dart' show duSearch;
import 'combo_controller.dart';
import 'combo_progress.dart';
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

  /// Each bump shakes the targets once, with the warn haptic: the student reached for a seventh
  /// target, and the note under them says why it did not go in. (The subject picker shakes its
  /// own limit line the same way for a thirteenth subject.)
  final ValueNotifier<int> _targetsLimit = ValueNotifier(0);

  /// The Targets and Subjects steps, for the progress header's jumps.
  final List<GlobalKey> _stepKeys = [GlobalKey(), GlobalKey()];

  @override
  void dispose() {
    _targetsLimit.dispose();
    _search.dispose();
    super.dispose();
  }

  /// A target that cannot be added because the limit is reached: a tap on it shakes the targets.
  Widget _refusable(bool refused, Widget child) =>
      refused ? GestureDetector(behavior: HitTestBehavior.opaque, onTap: () => _targetsLimit.value++, child: child) : child;

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

  Future<void> _pick(BuildContext context, ComboState s) {
    final controller = ref.read(comboControllerProvider.notifier);
    return showSubjectPicker(
      context: context,
      catalog: s.catalog,
      watch: (ref) => ref.watch(comboControllerProvider).value?.pool.toSet() ?? const {},
      onToggle: controller.togglePick,
      onPreset: controller.applyPreset,
      onClear: controller.clearPool,
      limit: duMaxPool,
      limitNote: ToolsCopy.poolFull,
    );
  }

  List<Widget> _ready(BuildContext context, ComboState s) {
    final colors = context.mmColors;
    final type = context.mmType;
    final controller = ref.read(comboControllerProvider.notifier);
    final q = _query.trim().toLowerCase();
    final matches = q.isEmpty ? const [] : duSearch(q, s.catalog.groups, (g) => g.name, extra: (g) => [g.id.replaceAll('-', ' '), g.family], weight: (g) => g.colleges).take(8).toList();
    final quick = [for (final name in duQuickTargets) ?s.catalog.groups.where((g) => g.name == name).firstOrNull];
    final plan = ref.watch(comboPlanProvider);
    final result = plan.value ?? DuComboPlan.empty;

    final hasResult = s.pool.isNotEmpty && s.targets.isNotEmpty && result.ranked.isNotEmpty;
    final inputs = <Widget>[
      _Step(anchor: _stepKeys[0], title: ToolsCopy.targetsHeading, note: s.targetsFromColleges ? '${ComboProgressCopy.fromColleges}. ${ToolsCopy.targetsHint(duMaxTargets, s.targets.length)}' : ToolsCopy.targetsHint(duMaxTargets, s.targets.length), top: hasResult ? MmRhythm.section : MmSpace.s8),
      SliverToBoxAdapter(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: MmSpace.gutter),
          child: MmShake(
            pulse: _targetsLimit,
            child: Wrap(
              spacing: MmSpace.s8,
              children: [
                for (final g in quick)
                  if (s.targets.contains(g.id))
                    PopOnSelect(
                      key: ValueKey('target-${g.id}'),
                      selected: true,
                      child: MmChip(label: g.name, selected: true, onTap: () => controller.toggleTarget(g.id)),
                    ),
                for (final g in quick)
                  if (!s.targets.contains(g.id))
                    PopOnSelect(
                      key: ValueKey('target-${g.id}'),
                      selected: false,
                      child: _refusable(
                        s.targetsFull,
                        MmChip(label: g.name, selected: false, onTap: s.targetsFull ? null : () => controller.toggleTarget(g.id)),
                      ),
                    ),
              ],
            ),
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
                  RankedReveal(
                    key: ValueKey('other-$id'),
                    index: 0,
                    child: MmSelectRow(
                      title: s.catalog.group(id)?.name ?? id,
                      note: ToolsCopy.remove,
                      multi: true,
                      selected: true,
                      onTap: () => controller.toggleTarget(id),
                    ),
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
                  _refusable(
                    !s.targets.contains(g.id) && s.targetsFull,
                    MmSelectRow(
                      title: g.name,
                      note: g.stream,
                      multi: true,
                      selected: s.targets.contains(g.id),
                      onTap: !s.targets.contains(g.id) && s.targetsFull ? null : () => controller.toggleTarget(g.id),
                    ),
                  ),
              ],
            ),
          ),
        ),
      // The line that says why shakes with the targets (one haptic, from the targets).
      if (s.targetsFull) SliverToBoxAdapter(child: MmShake(pulse: _targetsLimit, haptic: false, child: const ToolsNote(ToolsCopy.targetFull, top: MmSpace.s8))),
      _Step(anchor: _stepKeys[1], title: ToolsCopy.poolHeading, note: s.poolFromSheet ? '${ComboProgressCopy.fromSheet}. ${ToolsCopy.poolHint(duMaxPool, s.pool.length, s.maxPapers)}' : ToolsCopy.poolHint(duMaxPool, s.pool.length, s.maxPapers)),
      SliverToBoxAdapter(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: MmSpace.gutter),
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
                // Once chosen, the subjects are one quiet line and an edit key, not another chip cloud.
                Text(
                  [for (final p in s.pool) p.name(s.catalog, short: true)].join(', '),
                  style: type.body,
                  maxLines: 3,
                  overflow: TextOverflow.ellipsis,
                ),
              if (s.pool.isEmpty) ...[
                const SizedBox(height: MmSpace.s12),
                KeyButton.secondary(label: ToolsCopy.pickSubjects, expanded: false, onPressed: () => _pick(context, s)),
              ] else
                Transform.translate(
                  offset: const Offset(-MmSpace.s8, 0),
                  child: ToolsInlineAction(label: ToolsCopy.editSubjects, icon: LucideIcons.pencilLine, onTap: () => _pick(context, s)),
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
              const SizedBox(height: MmSpace.s12),
              PaperBubbles(used: result.ranked.isEmpty || s.pool.isEmpty ? 0 : result.ranked.first.items.length, limit: s.maxPapers),
            ],
          ),
        ),
      ),
    ];
    // Once there is a result it comes first (L27): the answer, then the inputs to change it.
    final results = <Widget>[
      if (s.pool.isNotEmpty) _Step(title: ToolsCopy.resultsHeading, top: hasResult ? MmSpace.s8 : MmRhythm.section),
      if (result.keep.isNotEmpty && s.pool.isNotEmpty && !plan.isLoading)
        SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(MmSpace.gutter, 0, MmSpace.gutter, MmSpace.s16),
            child: Builder(builder: (context) {
              // Each subject not to drop says why, in real counts (L27); the plain line stands in
              // while the reasons are worked out.
              final reasons = ref.watch(comboKeepReasonsProvider).value ?? const [];
              if (reasons.isEmpty) {
                return Text(
                  ToolsCopy.keep([for (final k in result.keep) k.name(s.catalog, short: true)].join(', '), result.keep.length),
                  style: type.body,
                );
              }
              return Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(ToolsCopy.keepHeading, style: type.labelLarge),
                  const SizedBox(height: MmSpace.s4),
                  for (final (i, r) in reasons.indexed)
                    RankedReveal(
                      key: ValueKey('keep-${r.pick.key}'),
                      index: i,
                      child: Padding(
                        padding: const EdgeInsets.only(top: MmSpace.s4),
                        child: Text(
                          ToolsCopy.keepReason(r.pick.name(s.catalog, short: true), r.lostTarget, r.fewer, r.nothing),
                          style: type.body.copyWith(color: colors.ink2),
                        ),
                      ),
                    ),
                ],
              );
            }),
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
    ];

    return [
      SliverToBoxAdapter(
        child: ComboProgress(
          done: [s.targets.isNotEmpty, s.pool.isNotEmpty, true],
          onStep: (i) {
            final ctx = _stepKeys[i.clamp(0, 1)].currentContext;
            if (ctx != null) Scrollable.ensureVisible(ctx, duration: Motion.of(context, Motion.glideDuration), curve: Motion.glide);
            if (i == 1 && s.pool.isEmpty) _pick(context, s);
          },
        ),
      ),
      if (hasResult) ...results,
      ...inputs,
      if (!hasResult) ...results,
      const SliverToBoxAdapter(child: ToolsNote(ToolsCopy.dataLine, top: MmSpace.s8)),
    ];
  }
}

/// A step heading: the Bricolage title cut and a note. No mark before it: the volt of this screen
/// is for what the student has chosen and for the one key, not for every heading.
class _Step extends StatelessWidget {
  const _Step({required this.title, this.note, this.top = MmRhythm.section, this.anchor});

  /// Lets the progress header scroll this step into view.
  final GlobalKey? anchor;

  final String title;
  final String? note;
  final double top;

  @override
  Widget build(BuildContext context) => SliverToBoxAdapter(child: ToolsHeading(title, key: anchor, note: note, top: top));
}

/// A row of paper bubbles, one per paper the form allows (3, 4 or 5): inked for the papers the
/// best combination uses, hollow for the rest, with the count in words beside it. The bubbles
/// ink in turn when the figure changes; the real count is the line, so reduced motion loses
/// nothing. Shown only once a combination exists.
class PaperBubbles extends StatelessWidget {
  const PaperBubbles({super.key, required this.used, required this.limit});

  final int used;
  final int limit;

  @override
  Widget build(BuildContext context) {
    if (used <= 0) return const SizedBox.shrink();
    final colors = context.mmColors;
    final type = context.mmType;
    final reduced = Motion.reduced(context);
    final line = ComboWords.papersUsed(used, limit);
    return Semantics(
      label: line,
      excludeSemantics: true,
      child: Row(
        children: [
          for (var i = 0; i < limit; i++) ...[
            if (i > 0) const SizedBox(width: MmSpace.s6),
            Bubble(state: i < used ? BubbleState.filled : BubbleState.hollow, size: 14, animate: !reduced),
          ],
          const SizedBox(width: MmSpace.s12),
          Expanded(child: Text(line, style: type.caption.copyWith(color: colors.ink2))),
        ],
      ),
    );
  }
}
