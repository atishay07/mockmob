import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/connectivity/connectivity.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import '../data/du_repository.dart';
import '../domain/du_eligibility.dart';
import '../domain/du_helpers.dart';
import '../tools_paths.dart';
import '../widgets/action_chip.dart';
import '../widgets/load_states.dart';
import '../widgets/sort_key.dart';
import '../widgets/sources_sheet.dart';
import '../widgets/tools_card.dart';
import '../widgets/tools_page.dart';
import 'category_score.dart';
import 'compass_controller.dart';
import 'compass_hero.dart';
import 'compass_practise.dart';
import 'programme_rows.dart';
import '../pro/compass_pro_section.dart';

enum CompassSort { colleges, cutoff, name }

/// How many "not eligible yet" rows show before "Show all".
const int _nearFirst = 5;

/// How many programmes a long stream group shows before "Show more".
const int _streamFirst = 6;

/// Admission Compass (`/tools/compass`): the student's CUET subjects against DU's 2026-27
/// Bulletin rules, then the 2026 college cutoffs by category and round. The website's
/// admission-compass and cutoff calculator in one native screen, on the same data.
class CompassScreen extends ConsumerStatefulWidget {
  const CompassScreen({super.key});

  @override
  ConsumerState<CompassScreen> createState() => _CompassScreenState();
}

class _CompassScreenState extends ConsumerState<CompassScreen> {
  final _search = TextEditingController();
  String _stream = ToolsCopy.all;
  String _query = '';
  CompassSort _sort = CompassSort.colleges;
  bool _onlyClearing = false;

  /// The student's own choice for the "Not eligible yet" list. Null until they choose: the
  /// list then opens by itself only when nothing is open (the nearest few are what they need).
  bool? _nearOpen;
  bool _nearAll = false;

  /// Streams the student has opened to the full list.
  final Set<String> _openStreams = {};

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  void _retry() {
    ref.invalidate(duCatalogProvider);
    ref.invalidate(compassControllerProvider);
  }

  @override
  Widget build(BuildContext context) {
    final async = ref.watch(compassControllerProvider);
    final slivers = switch (async) {
      AsyncData(:final value) => _ready(context, value),
      // A refresh that failed while results are on the phone: keep them, and say so.
      AsyncError(:final error, value: final CompassState kept) => [
          SliverToBoxAdapter(child: _StaleBanner(error: error, onRetry: _retry)),
          ..._ready(context, kept),
        ],
      AsyncError(:final error) => [SliverToBoxAdapter(child: ToolsLoadFailed(error: error, onRetry: _retry))],
      _ => const [SliverToBoxAdapter(child: ToolsLoading())],
    };
    return ToolsPage(title: ToolsCopy.compassTitle, lead: ToolsCopy.compassQuestion, slivers: slivers);
  }

  List<Widget> _ready(BuildContext context, CompassState s) {
    final score = s.score;
    final q = _query.trim().toLowerCase();
    bool matches(DuVerdict r) => (_stream == ToolsCopy.all || r.group.stream == _stream) && (q.isEmpty || r.group.name.toLowerCase().contains(q));

    var list = s.eligible.where(matches).toList();
    if (_onlyClearing && score != null) list = list.where((r) => s.couldClear(r.group)).toList();
    double top(DuVerdict r) => r.group.roundOne(s.category)?.high ?? -1;
    list.sort(switch (_sort) {
      CompassSort.name => (a, b) => a.group.name.compareTo(b.group.name),
      CompassSort.cutoff => (a, b) => top(b).compareTo(top(a)),
      CompassSort.colleges => (a, b) {
          final c = b.group.colleges - a.group.colleges;
          return c != 0 ? c : a.group.name.compareTo(b.group.name);
        },
    });
    final near = s.ineligible.where((r) => matches(r) && r.nearest != null).toList()
      ..sort((a, b) {
        final c = a.nearest!.size - b.nearest!.size;
        return c != 0 ? c : a.group.name.compareTo(b.group.name);
      });
    final streams = duStreamOrder.where((st) => s.catalog.groups.any((g) => g.stream == st)).toList();
    void open(String id) => context.push(ToolsPaths.programme(id));
    final noneOpen = !s.selection.isEmpty && s.eligible.isEmpty;
    final nearOpen = _nearOpen ?? noneOpen;
    final nearShown = _nearAll ? near : near.take(_nearFirst).toList();

    return [
      SliverToBoxAdapter(child: CompassHero(state: s)),
      SliverToBoxAdapter(
        child: Padding(
          padding: const EdgeInsets.only(top: MmRhythm.item),
          child: CategoryScoreBar(
            summary: ToolsCopy.categorySummary(s.category, score == null ? null : duFormatScore(score)),
            onTap: () => showCategoryScoreSheet(context),
          ),
        ),
      ),
      if (noneOpen) SliverToBoxAdapter(child: _NoneOpen(hasUnlocks: s.unlocks.isNotEmpty)),
      if (s.unlocks.isNotEmpty) ...[
        const SliverToBoxAdapter(child: ToolsHeading(ToolsCopy.unlocksHeading, top: MmRhythm.group)),
        SliverToBoxAdapter(child: _Unlocks(state: s)),
      ],
      if (!s.selection.isEmpty) ...[
        if (!noneOpen)
          SliverToBoxAdapter(
            child: ToolsHeading(
              '${s.eligible.length} open to you',
              note: '${ToolsCopy.categoryNow(s.category)}${score != null ? ', score ${duFormatScore(score)}' : ''}. Updates as you change subjects.',
            ),
          ),
        if (s.eligible.isNotEmpty)
          SliverToBoxAdapter(
            child: _Filters(
              streams: streams,
              stream: _stream,
              onStream: (v) => setState(() => _stream = v),
              search: _search,
              onQuery: (v) => setState(() => _query = v),
              sort: _sort,
              onSort: (v) => setState(() => _sort = v),
              showClearing: score != null,
              onlyClearing: _onlyClearing,
              onClearing: (v) => setState(() => _onlyClearing = v),
            ),
          ),
        if (s.eligible.isNotEmpty && list.isEmpty)
          SliverToBoxAdapter(child: ToolsNote(ToolsCopy.nothingMatches, top: MmSpace.s20)),
        for (final st in streams)
          if (list.where((r) => r.group.stream == st).toList() case final rows when rows.isNotEmpty) ...[
            SliverToBoxAdapter(
              child: GroupHeading(
                st,
                top: MmSpace.s20,
                trailing: Padding(
                  padding: const EdgeInsets.only(right: MmSpace.gutter),
                  child: Text('${rows.length}', style: context.mmType.caption.copyWith(color: context.mmColors.ink3, fontFeatures: const [FontFeature.tabularFigures()])),
                ),
              ),
            ),
            SliverToBoxAdapter(
              child: Builder(
                builder: (context) {
                  // A long group opens on its first rows; the rest is one tap away.
                  final collapsible = rows.length > _streamFirst + 2;
                  final all = _openStreams.contains(st);
                  final shown = collapsible && !all ? rows.take(_streamFirst).toList() : rows;
                  return ToolsPanel(
                    children: [
                      for (final r in shown) ProgrammeRow(verdict: r, category: s.category, score: score, onTap: () => open(r.group.id)),
                      if (collapsible)
                        ToolsRowFrame(
                          onTap: () => setState(() => all ? _openStreams.remove(st) : _openStreams.add(st)),
                          semanticsLabel: all ? ToolsCopy.showFewerRows : ToolsCopy.showMoreRows(rows.length - _streamFirst),
                          child: Row(
                            children: [
                              Expanded(
                                child: Text(
                                  all ? ToolsCopy.showFewerRows : ToolsCopy.showMoreRows(rows.length - _streamFirst),
                                  style: context.mmType.labelLarge.copyWith(color: context.mmColors.accentText),
                                ),
                              ),
                              Icon(all ? LucideIcons.chevronUp : LucideIcons.chevronDown, size: 18, color: context.mmColors.accentText),
                            ],
                          ),
                        ),
                    ],
                  );
                },
              ),
            ),
          ],
        if (near.isNotEmpty) ...[
          SliverToBoxAdapter(
            child: ToolsHeading(
              ToolsCopy.notEligibleHeading(near.length),
              note: nearOpen && !_nearAll && near.length > _nearFirst ? ToolsCopy.nearNearest(_nearFirst) : ToolsCopy.notEligibleNote,
              trailing: KeyButton.quiet(
                label: nearOpen ? ToolsCopy.nearHide : ToolsCopy.nearShow,
                onPressed: () => setState(() => _nearOpen = !nearOpen),
              ),
            ),
          ),
          if (nearOpen) ...[
            SliverToBoxAdapter(
              child: ToolsPanel(children: [for (final r in nearShown) NearRow(verdict: r, catalog: s.catalog, onTap: () => open(r.group.id))]),
            ),
            if (near.length > _nearFirst)
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(MmSpace.s8, MmSpace.s4, MmSpace.s8, 0),
                  child: Align(
                    alignment: Alignment.centerLeft,
                    child: KeyButton.quiet(
                      label: _nearAll ? ToolsCopy.nearShowFewer : ToolsCopy.nearShowAll(near.length),
                      onPressed: () => setState(() => _nearAll = !_nearAll),
                    ),
                  ),
                ),
              ),
          ],
        ],
      ],
      SliverToBoxAdapter(child: CompassProSection(state: s)),
      SliverToBoxAdapter(child: CompassPractise(state: s)),
      SliverToBoxAdapter(
        child: Padding(
          padding: const EdgeInsets.only(top: MmRhythm.section),
          child: ToolsPanel(
            dividerIndent: ToolsLinkRow.dividerIndent,
            children: [
              ToolsLinkRow(
                icon: LucideIcons.fileText,
                title: ToolsCopy.sourcesTitle,
                note: ToolsCopy.sourcesNote,
                onTap: () => showSourcesSheet(context, s.catalog.meta.sources),
              ),
            ],
          ),
        ),
      ),
      const SliverToBoxAdapter(child: ToolsNote(ToolsCopy.dataLine, top: MmSpace.s20)),
    ];
  }
}

/// The zero state: Mobi thinking and one line of action, not a paragraph. The subjects that
/// would open something follow directly below, each with the number of programmes it opens.
class _NoneOpen extends StatelessWidget {
  const _NoneOpen({required this.hasUnlocks});

  final bool hasUnlocks;

  @override
  Widget build(BuildContext context) {
    final type = context.mmType;
    return Padding(
      padding: const EdgeInsets.fromLTRB(MmSpace.gutter, MmSpace.s24, MmSpace.gutter, 0),
      child: Row(
        children: [
          const Mobi(pose: MobiPose.think, size: 72, motion: MobiMotion.settle),
          const SizedBox(width: MmSpace.s12),
          Expanded(
            child: Text(
              hasUnlocks ? ToolsCopy.noneOpenLine : ToolsCopy.noneOpenFar,
              style: type.title.copyWith(fontSize: 18, height: 24 / 18),
            ),
          ),
        ],
      ),
    );
  }
}

class _Unlocks extends ConsumerWidget {
  const _Unlocks({required this.state});

  final CompassState state;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final controller = ref.read(compassControllerProvider.notifier);
    // One row that scrolls (with its edge fade), so the chips never stagger into a ragged block.
    return ToolsFadingScroller(
      padding: const EdgeInsets.symmetric(horizontal: MmSpace.gutter),
      child: Row(
        children: [
          for (final u in state.unlocks) ...[
            Semantics(
              label: ToolsCopy.unlockSemantics(u.name, u.unlocks),
              excludeSemantics: true,
              button: true,
              child: ToolsActionChip(
                label: u.pick.name(state.catalog, short: true),
                trailing: ToolsCopy.unlockValue(u.unlocks),
                icon: LucideIcons.plus,
                onTap: () => controller.toggle(u.pick),
              ),
            ),
            const SizedBox(width: MmSpace.s8),
          ],
        ],
      ),
    );
  }
}

class _Filters extends StatelessWidget {
  const _Filters({
    required this.streams,
    required this.stream,
    required this.onStream,
    required this.search,
    required this.onQuery,
    required this.sort,
    required this.onSort,
    required this.showClearing,
    required this.onlyClearing,
    required this.onClearing,
  });

  final List<String> streams;
  final String stream;
  final ValueChanged<String> onStream;
  final TextEditingController search;
  final ValueChanged<String> onQuery;
  final CompassSort sort;
  final ValueChanged<CompassSort> onSort;
  final bool showClearing;
  final bool onlyClearing;
  final ValueChanged<bool> onClearing;

  static String sortLabel(CompassSort s) => switch (s) {
        CompassSort.colleges => ToolsCopy.sortColleges,
        CompassSort.cutoff => ToolsCopy.sortCutoff,
        CompassSort.name => ToolsCopy.sortName,
      };

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        ToolsFadingScroller(
          child: Row(
            children: [
              for (final st in [ToolsCopy.all, ...streams]) ...[
                MmChip(label: duStreamShort(st), selected: stream == st, onTap: () => onStream(st)),
                const SizedBox(width: MmSpace.s8),
              ],
            ],
          ),
        ),
        const SizedBox(height: MmSpace.s8),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: MmSpace.gutter),
          child: Row(
            children: [
              Expanded(child: ToolsSearchField(controller: search, hint: ToolsCopy.searchProgrammes, onChanged: onQuery)),
              const SizedBox(width: MmSpace.s8),
              ToolsSortKey<CompassSort>(
                options: CompassSort.values,
                value: sort,
                labelOf: sortLabel,
                onChanged: onSort,
                sheetTitle: 'Sort programmes',
              ),
            ],
          ),
        ),
        if (showClearing)
          Padding(
            padding: const EdgeInsets.only(top: MmSpace.s8),
            child: ToolsPanel(children: [_ClearingSwitch(value: onlyClearing, onChanged: onClearing)]),
          ),
      ],
    );
  }
}

class _ClearingSwitch extends StatelessWidget {
  const _ClearingSwitch({required this.value, required this.onChanged});

  final bool value;
  final ValueChanged<bool> onChanged;

  @override
  Widget build(BuildContext context) {
    return ToolsRowFrame(
      onTap: () => onChanged(!value),
      toggled: value,
      semanticsLabel: ToolsCopy.onlyClearing,
      child: Row(
        children: [
          Expanded(child: Text(ToolsCopy.onlyClearing, style: context.mmType.labelLarge)),
          const SizedBox(width: MmSpace.s12),
          ExcludeSemantics(child: IgnorePointer(child: Switch(value: value, onChanged: (_) {}))),
        ],
      ),
    );
  }
}

/// The DU data could not be refreshed but the last copy is on the phone: the screen stays, with
/// one banner that says why and offers Try again.
class _StaleBanner extends ConsumerWidget {
  const _StaleBanner({required this.error, required this.onRetry});

  final Object error;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final offline = ref.watch(networkStatusProvider) == NetworkStatus.offline || (error is DuLoadError && (error as DuLoadError).offline);
    return Padding(
      padding: const EdgeInsets.fromLTRB(MmSpace.gutter, 0, MmSpace.gutter, MmSpace.s16),
      child: InlineBanner(
        tone: offline ? BannerTone.offline : BannerTone.error,
        message: offline ? ToolsCopy.staleOffline : ToolsCopy.staleError,
        actionLabel: ToolsCopy.tryAgain,
        onAction: onRetry,
      ),
    );
  }
}
