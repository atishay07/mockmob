import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/art/hybrid/hybrid.dart';
import '../../../core/connectivity/connectivity.dart';
import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import '../data/du_repository.dart';
import '../domain/du_eligibility.dart';
import '../domain/du_helpers.dart';
import '../domain/du_models.dart' show DuPick;
import '../tools_paths.dart';
import '../widgets/action_chip.dart';
import '../widgets/chip_flight.dart';
import '../widgets/load_states.dart';
import '../widgets/ranked_reveal.dart';
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
import '../widgets/size_reveal.dart';

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

  /// False until the results have been drawn once and a frame has passed: rows on screen as the
  /// page opens do not play their arrival (the page's own entrance did); rows that come later,
  /// from a filter, a sort, a stream, a category or new subjects, do.
  bool _readyOnce = false;
  bool _settled = false;

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
      // While the lists load the compass searches where the hero's compass will stand, and the
      // hero's own compass settles once the count is in.
      _ => const [SliverToBoxAdapter(child: _SearchingLoad())],
    };
    return ToolsPage(title: ToolsCopy.compassTitle, lead: ToolsCopy.compassQuestion, slivers: slivers);
  }

  List<Widget> _ready(BuildContext context, CompassState s) {
    if (!_readyOnce) {
      _readyOnce = true;
      WidgetsBinding.instance.addPostFrameCallback((_) => _settled = true);
    }
    // A change of order, stream, category or the could-clear switch replays the arrival of the
    // rows that stay (a search does not: new rows arrive, the rest hold still).
    final replay = '${_sort.name}|$_stream|${s.category}|$_onlyClearing';
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
                  child: _SlidingCount(count: rows.length),
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
                      for (final (i, r) in shown.indexed)
                        RankedReveal(
                          key: ValueKey('row-${r.group.id}'),
                          index: i,
                          replayKey: replay,
                          animateOnMount: _settled,
                          child: ProgrammeRow(
                            verdict: r,
                            category: s.category,
                            score: score,
                            couldClear: score != null && s.couldClear(r.group),
                            onTap: () => open(r.group.id),
                          ),
                        ),
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

/// The zero state: one line of action, not a paragraph (Mobi is already thinking in the hero card
/// above; one Mobi per screen). The subjects that would open something follow directly below,
/// each with the number of programmes it opens.
class _NoneOpen extends StatelessWidget {
  const _NoneOpen({required this.hasUnlocks});

  final bool hasUnlocks;

  @override
  Widget build(BuildContext context) {
    final type = context.mmType;
    return Padding(
      padding: const EdgeInsets.fromLTRB(MmSpace.gutter, MmSpace.s24, MmSpace.gutter, 0),
      child: Text(
        hasUnlocks ? ToolsCopy.noneOpenLine : ToolsCopy.noneOpenFar,
        style: type.title.copyWith(fontSize: 18, height: 24 / 18),
      ),
    );
  }
}

/// A group's count ("12"): when it changes the old figure slides out and the new one in (a half
/// line, 200 ms); still under reduced motion.
class _SlidingCount extends StatelessWidget {
  const _SlidingCount({required this.count});

  final int count;

  @override
  Widget build(BuildContext context) {
    final style = context.mmType.caption.copyWith(color: context.mmColors.ink3, fontFeatures: const [FontFeature.tabularFigures()]);
    final reduced = Motion.reduced(context);
    return AnimatedSwitcher(
      duration: reduced ? Duration.zero : Motion.crossFade,
      switchInCurve: Motion.glide,
      switchOutCurve: Motion.exit,
      transitionBuilder: (child, animation) {
        final incoming = child.key == ValueKey(count);
        return FadeTransition(
          opacity: animation,
          child: SlideTransition(
            position: Tween(begin: Offset(0, incoming ? 0.5 : -0.5), end: Offset.zero).animate(animation),
            child: child,
          ),
        );
      },
      child: Text('$count', key: ValueKey(count), style: style),
    );
  }
}

/// The subjects that would open more. A tap previews what one would open (the first two
/// programme names and how many more) with a key to add it, so nothing is added by a stray tap;
/// adding flies the chip into the subject list on the card above.
class _Unlocks extends ConsumerStatefulWidget {
  const _Unlocks({required this.state});

  final CompassState state;

  @override
  ConsumerState<_Unlocks> createState() => _UnlocksState();
}

class _UnlocksState extends ConsumerState<_Unlocks> {
  String? _preview;
  final Map<String, GlobalKey> _keys = {};

  void _commit(DuPick pick) {
    final at = _keys[pick.key]?.currentContext;
    final rect = at == null ? null : ChipFlight.rectOf(at);
    if (rect != null) ChipFlight.launch(pick.key, rect);
    setState(() => _preview = null);
    ref.read(compassControllerProvider.notifier).toggle(pick);
  }

  @override
  Widget build(BuildContext context) {
    final state = widget.state;
    final reduced = Motion.reduced(context);
    final previewed = [for (final u in state.unlocks) if (u.pick.key == _preview) u].firstOrNull;
    // One row that scrolls (with its edge fade), so the chips never stagger into a ragged block.
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        ToolsFadingScroller(
          padding: const EdgeInsets.symmetric(horizontal: MmSpace.gutter),
          child: Row(
            children: [
              for (final u in state.unlocks) ...[
                Semantics(
                  label: ToolsCopy.unlockSemantics(u.name, u.unlocks),
                  excludeSemantics: true,
                  button: true,
                  selected: u.pick.key == _preview,
                  child: KeyedSubtree(
                    key: _keys.putIfAbsent(u.pick.key, GlobalKey.new),
                    child: ToolsActionChip(
                      label: u.pick.name(state.catalog, short: true),
                      trailing: ToolsCopy.unlockValue(u.unlocks),
                      icon: LucideIcons.plus,
                      active: u.pick.key == _preview,
                      onTap: () => setState(() => _preview = u.pick.key == _preview ? null : u.pick.key),
                    ),
                  ),
                ),
                const SizedBox(width: MmSpace.s8),
              ],
            ],
          ),
        ),
        SizeReveal(
          child: AnimatedSwitcher(
            duration: reduced ? Duration.zero : Motion.crossFade,
            switchInCurve: Motion.glide,
            switchOutCurve: Motion.exit,
            layoutBuilder: (current, previous) => Stack(
              alignment: Alignment.topCenter,
              children: [...previous.map((w) => Positioned(left: 0, right: 0, top: 0, child: w)), ?current],
            ),
            child: previewed == null
                ? const SizedBox(key: ValueKey('no-preview'), width: double.infinity)
                : Padding(
                    key: ValueKey('preview-${previewed.pick.key}'),
                    padding: const EdgeInsets.fromLTRB(MmSpace.gutter, MmSpace.s12, MmSpace.gutter, 0),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          ToolsCopy.unlockPreview(previewed.programmes.take(2).toList(), previewed.unlocks),
                          style: context.mmType.body.copyWith(color: context.mmColors.ink2),
                        ),
                        const SizedBox(height: MmSpace.s12),
                        Row(
                          children: [
                            Expanded(
                              flex: 3,
                              child: KeyButton(
                                label: ToolsCopy.unlockAdd(previewed.pick.name(state.catalog, short: true)),
                                onPressed: () => _commit(previewed.pick),
                              ),
                            ),
                            const SizedBox(width: MmSpace.s8),
                            Expanded(
                              flex: 2,
                              child: KeyButton.quiet(label: ToolsCopy.unlockNotNow, onPressed: () => setState(() => _preview = null)),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
          ),
        ),
      ],
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

/// The loading outline with the compass searching in the hero's corner.
class _SearchingLoad extends StatelessWidget {
  const _SearchingLoad();

  @override
  Widget build(BuildContext context) {
    return const Stack(
      children: [
        ToolsLoading(),
        Positioned(
          top: MmSpace.s20,
          right: MmSpace.gutter + MmSpace.s20,
          child: HybridCompass(height: CompassHero.compassHeight, searching: true),
        ),
      ],
    );
  }
}
