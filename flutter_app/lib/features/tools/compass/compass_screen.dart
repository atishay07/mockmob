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
import 'stream_fold.dart';
import '../widgets/tools_origin.dart';
import '../colleges/college_rung.dart' show collegeFigureProvider;
import '../colleges/colleges_screen.dart' show EstimateBar;
import '../estimate/estimate.dart';
import '../estimate/estimate_providers.dart';
import '../my_colleges/my_colleges_sheet.dart' show showMyCollegesSheet;
import '../my_colleges/college_search.dart' show duMatchRank;
import '../data/my_colleges_actions.dart' show myCollegesProvider;
import '../../onboarding/onboarding.dart' show onboardingAnswersProvider;
import '../pro/compass_pro_section.dart';
import '../widgets/size_reveal.dart';

enum CompassSort { colleges, cutoff, name }

/// How many "not eligible yet" rows show before "Show all".
const int _nearFirst = 5;

/// How many programmes a long stream group shows before "Show more".
const int _streamFirst = 6;

/// A programme at fewer colleges than this (or with no cutoff list) is folded under "Other
/// programmes" in its stream, so the rich ones lead.
const int _fewColleges = 3;

/// How many programmes "Your best options" names, and how many must be open before it shows (a
/// shorter list is its own best options).
const int _bestCount = 3;
const int _bestFrom = 6;

/// The best options: with an estimate (its top end [reach], else the typed score), the programmes
/// it could clear first; then the most colleges.
List<DuVerdict> compassBestOptions(CompassState s, [double? reach]) {
  final score = reach ?? s.score;
  final list = [...s.eligible.where((r) => r.group.hasCutoffs)];
  int clear(DuVerdict r) => score != null && s.couldClear(r.group, score) ? 0 : 1;
  list.sort((a, b) {
    final c = clear(a) - clear(b);
    if (c != 0) return c;
    final n = b.group.colleges - a.group.colleges;
    return n != 0 ? n : a.group.name.compareTo(b.group.name);
  });
  return list.take(_bestCount).toList();
}

/// A stream's rows split into the ones that lead and the smaller programmes folded under "Other
/// programmes". Nothing is folded while searching, when it would leave the stream empty, or
/// when only one row would be folded.
({List<DuVerdict> lead, List<DuVerdict> other}) compassSplitStream(List<DuVerdict> rows, {required bool searching}) {
  bool few(DuVerdict r) => !r.group.hasCutoffs || r.group.colleges < _fewColleges;
  final other = [for (final r in rows) if (few(r)) r];
  if (searching || other.length < 2 || other.length == rows.length) return (lead: rows, other: const <DuVerdict>[]);
  return (lead: [for (final r in rows) if (!few(r)) r], other: other);
}

/// Admission Compass (`/tools/compass`): the student's CUET subjects against DU's 2026-27
/// Bulletin rules, then the 2026 college cutoffs by category and round. The website's
/// admission-compass and cutoff calculator in one native screen, on the same data.
class CompassScreen extends ConsumerStatefulWidget {
  const CompassScreen({super.key, this.previewScore, this.previewCategory});

  /// From Check a score (`?score=600-650&category=OBC-NCL`): a score shown here without being
  /// saved as the student's estimate, until they choose to.
  final String? previewScore;
  final String? previewCategory;

  @override
  ConsumerState<CompassScreen> createState() => _CompassScreenState();
}

class _CompassScreenState extends ConsumerState<CompassScreen> {
  final _search = TextEditingController();
  final String _stream = ToolsCopy.all;
  String _query = '';
  CompassSort _sort = CompassSort.colleges;
  bool _onlyClearing = false;

  /// The student's own choice for the "Not eligible yet" list. Null until they choose: the
  /// list then opens by itself only when nothing is open (the nearest few are what they need).
  bool? _nearOpen;
  bool _nearAll = false;

  /// Streams the student has opened to the full list.
  final Set<String> _openStreams = {};

  /// Streams whose "Other programmes" are open.
  final Set<String> _openOther = {};

  /// False until the results have been drawn once and a frame has passed: rows on screen as the
  /// page opens do not play their arrival (the page's own entrance did); rows that come later,
  /// from a filter, a sort, a stream, a category or new subjects, do.
  bool _readyOnce = false;
  bool _settled = false;

  /// Streams the student opened or folded themselves (their choice beats the default).
  final Map<String, bool> _folds = {};

  /// The Check a score preview is on show (until dismissed or saved).
  late bool _preview = _previewEstimate != null;

  Estimate? get _previewEstimate {
    final parts = widget.previewScore?.split('-');
    if (parts == null) return null;
    final lo = double.tryParse(parts.first.trim());
    final hi = parts.length > 1 ? double.tryParse(parts[1].trim()) : lo;
    if (lo == null || hi == null || lo < 0 || hi > 1000) return null;
    return Estimate(source: EstimateSource.typed, low: lo < hi ? lo : hi, high: lo < hi ? hi : lo);
  }

  @override
  void initState() {
    super.initState();
    final category = widget.previewCategory;
    if (category != null && _preview) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) ref.read(compassControllerProvider.notifier).setCategory(category);
      });
    }
  }

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  /// Combo Planner: back to it when Compass was opened from there, so the two never stack up.
  void _openCombo(BuildContext context) => ToolsOrigin.openOrReturn(context, to: ToolsPaths.combo, from: ToolsOrigin.compass);

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
    final est = _preview ? _previewEstimate : ref.watch(estimateProvider);
    final replay = '${_sort.name}|$_stream|${s.category}|$_onlyClearing|${est?.low}|${est?.high}';
    // Everything below reads the one estimate: its low end for the pin, its top for "could clear".
    final score = est?.low;
    final reach = est?.high;
    final q = _query.trim().toLowerCase();
    // One matcher with the chooser: "bcom", "B.Com" and "bcom hons" all find B.Com. (Hons.).
    int? rank(DuVerdict r) => duMatchRank(q, r.group.name, extra: [r.group.id.replaceAll('-', ' '), r.group.family]);
    // As in the chooser: when the words are found whole somewhere, the loose matches are noise.
    final strict = q.isNotEmpty && [...s.eligible, ...s.ineligible].any((r) => (rank(r) ?? 9) <= 1);
    bool matches(DuVerdict r) =>
        (_stream == ToolsCopy.all || r.group.stream == _stream) &&
        (q.isEmpty || ((rank(r) ?? 9) <= (strict ? 1 : 3)));

    var list = s.eligible.where(matches).toList();
    if (_onlyClearing && reach != null) list = list.where((r) => s.couldClear(r.group, reach)).toList();
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

    final best = s.eligible.length >= _bestFrom ? compassBestOptions(s, reach) : const <DuVerdict>[];
    final view = ref.watch(myCollegesProvider);
    final ownCourse = view.ready && view.colleges.isNotEmpty ? view.colleges.first.programmeId : ref.watch(onboardingAnswersProvider).value?.courseId;
    final ownStream = ownCourse == null ? null : s.catalog.group(ownCourse)?.stream;
    bool foldOpen(String st) => q.isNotEmpty || (_folds[st] ?? (ownStream == null ? st == streams.firstOrNull : st == ownStream));
    final unlocks = [
      const SliverToBoxAdapter(child: ToolsHeading(ToolsCopy.unlocksHeading, top: MmRhythm.group)),
      SliverToBoxAdapter(child: _Unlocks(state: s)),
    ];

    final previewing = _preview && est != null;
    return [
      if (previewing)
        SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(MmSpace.gutter, 0, MmSpace.gutter, MmSpace.s12),
            child: _PreviewLine(
              range: estimateRange(est),
              onUse: () {
                ref.read(compassControllerProvider.notifier).setEstimate(est.low, est.isPoint ? null : est.high);
                setState(() => _preview = false);
              },
              onClose: () => setState(() => _preview = false),
            ),
          ),
        ),
      SliverToBoxAdapter(child: CompassHero(state: s)),
      // The one primary action of the page, straight under the count: the score that makes the
      // list personal, or, once there is one, the programme to open first.
      // The category as a chip rail near the top (L26): it changes which figures show, so it sits
      // before the answer it changes. "Other quota" opens the rest in the sheet.
      if (!s.selection.isEmpty)
        SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.only(top: MmSpace.s12),
            child: ChipRail.labelled(
              semanticLabel: ToolsCopy.category,
              labels: [for (final c in duMainCategories) categoryLabel(c), ToolsCopy.otherQuota],
              selected: duMainCategories.contains(s.category) ? duMainCategories.indexOf(s.category) : duMainCategories.length,
              onSelected: (i) => i < duMainCategories.length
                  ? ref.read(compassControllerProvider.notifier).setCategory(duMainCategories[i])
                  : showOtherQuotaSheet(context, ref),
            ),
          ),
        ),
      if (!s.selection.isEmpty && !noneOpen) SliverToBoxAdapter(child: _FirstMove(state: s, reach: reach, onOpen: open)),
      // Nothing open: the way out comes first, straight under the count.
      if (noneOpen) SliverToBoxAdapter(child: _NoneOpen(hasUnlocks: s.unlocks.isNotEmpty, onCombo: () => _openCombo(context))),
      if (noneOpen && s.unlocks.isNotEmpty) ...unlocks,
      // The answer before the settings: the student's best options, then category and score.
      if (best.isNotEmpty) ...[
        SliverToBoxAdapter(
          child: ToolsHeading(ToolsCopy.bestHeading, note: score != null ? ToolsCopy.bestNoteScore : ToolsCopy.bestNote, top: MmRhythm.group),
        ),
        SliverToBoxAdapter(
          child: ToolsPanel(
            children: [
              for (final r in best)
                ProgrammeRow(
                  key: ValueKey('best-${r.group.id}'),
                  bar: true,
                  verdict: r,
                  category: s.category,
                  score: score,
                  scoreHigh: reach,
                  couldClear: reach != null && s.couldClear(r.group, reach),
                  onTap: () => open(r.group.id),
                ),
            ],
          ),
        ),
      ],
      // Where you stand: the estimate, below the answer it sharpens. Never a field (L26).
      if (!s.selection.isEmpty) ...[
        SliverToBoxAdapter(child: ToolsHeading(ToolsCopy.whereYouStand, top: best.isNotEmpty ? MmRhythm.group : MmRhythm.item)),
        SliverToBoxAdapter(child: EstimateBar(estimate: est, category: s.category)),
      ],
      if (!noneOpen && s.unlocks.isNotEmpty) ...unlocks,
      if (!s.selection.isEmpty) ...[
        if (!noneOpen)
          SliverToBoxAdapter(
            child: ToolsHeading(
              best.isNotEmpty ? ToolsCopy.allOpenHeading(s.eligible.length) : ToolsCopy.openHeading(s.eligible.length),
              note: ToolsCopy.openNote,
            ),
          ),
        if (s.eligible.isNotEmpty)
          SliverToBoxAdapter(
            child: _Filters(
              search: _search,
              onQuery: (v) => setState(() => _query = v),
              sort: _sort,
              onSort: (v) => setState(() => _sort = v),
              showClearing: reach != null,
              onlyClearing: _onlyClearing,
              onClearing: (v) => setState(() => _onlyClearing = v),
            ),
          ),
        if (s.eligible.isNotEmpty && list.isEmpty)
          SliverToBoxAdapter(child: ToolsNote(ToolsCopy.nothingMatches, top: MmSpace.s20)),
        for (final st in streams)
          if (list.where((r) => r.group.stream == st).toList() case final rows when rows.isNotEmpty)
            SliverToBoxAdapter(
              child: StreamFold(
                key: ValueKey('fold-$st'),
                stream: st,
                note: StreamFoldCopy.note(
                  rows.length,
                  rows.fold(0, (m, r) => r.group.colleges > m ? r.group.colleges : m),
                  reach == null ? null : rows.where((r) => s.couldClear(r.group, reach)).length,
                ),
                // Open while searching; otherwise the student's own stream by default, or their choice.
                open: foldOpen(st),
                onToggle: () => setState(() => _folds[st] = !foldOpen(st)),
                child: (context) {
                  // The rich programmes lead; the ones at one or two colleges fold under "Other
                  // programmes". A long lead opens on its first rows; the rest is one tap away.
                  final split = compassSplitStream(rows, searching: q.isNotEmpty);
                  final lead = split.lead;
                  final collapsible = lead.length > _streamFirst + 2;
                  final all = _openStreams.contains(st);
                  final otherOpen = _openOther.contains(st);
                  final shown = [
                    ...(collapsible && !all ? lead.take(_streamFirst) : lead),
                    if (otherOpen) ...split.other,
                  ];
                  return Padding(
                    padding: const EdgeInsets.only(bottom: MmSpace.s12),
                    child: ToolsPanel(
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
                              scoreHigh: reach,
                              couldClear: reach != null && s.couldClear(r.group, reach),
                              onTap: () => open(r.group.id),
                            ),
                          ),
                        if (collapsible)
                          ToolsRowFrame(
                            onTap: () => setState(() => all ? _openStreams.remove(st) : _openStreams.add(st)),
                            semanticsLabel: all ? ToolsCopy.showFewerRows : ToolsCopy.showMoreRows(lead.length - _streamFirst),
                            child: Row(
                              children: [
                                Expanded(
                                  child: Text(
                                    all ? ToolsCopy.showFewerRows : ToolsCopy.showMoreRows(lead.length - _streamFirst),
                                    style: context.mmType.labelLarge.copyWith(color: context.mmColors.accentText),
                                  ),
                                ),
                                Icon(all ? LucideIcons.chevronUp : LucideIcons.chevronDown, size: 18, color: context.mmColors.accentText),
                              ],
                            ),
                          ),
                        if (split.other.isNotEmpty)
                          _OtherProgrammes(
                            count: split.other.length,
                            open: otherOpen,
                            onTap: () => setState(() => otherOpen ? _openOther.remove(st) : _openOther.add(st)),
                          ),
                      ],
                    ),
                  );
                },
              ),
            ),
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
      SliverToBoxAdapter(child: _MyCollegesRow(estimate: est, category: s.category)),
      SliverToBoxAdapter(child: CompassProSection(state: s)),
      SliverToBoxAdapter(child: CompassPractise(state: s)),
      SliverToBoxAdapter(
        child: Padding(
          padding: const EdgeInsets.only(top: MmRhythm.section),
          child: ToolsPanel(
            dividerIndent: ToolsLinkRow.dividerIndent,
            children: [
              ToolsLinkRow(
                icon: LucideIcons.layoutGrid,
                title: ToolsCopy.comboLinkTitle,
                note: ToolsCopy.comboLinkNote,
                onTap: () => _openCombo(context),
              ),
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

/// The one primary under the hero: always a course to open, never a score to type (L26). The
/// student's own course (the first college on My colleges, else the course from onboarding) when
/// their subjects open it, otherwise the best option. Nothing when there is no programme to open.
class _FirstMove extends ConsumerWidget {
  const _FirstMove({required this.state, required this.onOpen, this.reach});

  final CompassState state;
  final double? reach;
  final void Function(String id) onOpen;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final view = ref.watch(myCollegesProvider);
    final own = view.ready && view.colleges.isNotEmpty ? view.colleges.first.programmeId : ref.watch(onboardingAnswersProvider).value?.courseId;
    final mine = own == null ? null : state.eligible.where((v) => v.group.id == own).firstOrNull;
    final pick = mine ?? compassBestOptions(state, reach).firstOrNull;
    if (pick == null) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.fromLTRB(MmSpace.gutter, MmSpace.s16, MmSpace.gutter, 0),
      child: KeyButton(
        key: const ValueKey('compass-first-move'),
        label: ToolsCopy.openProgramme(pick.group.name),
        onPressed: () => onOpen(pick.group.id),
      ),
    );
  }
}

/// The zero state: one line of action, not a paragraph (Mobi is already thinking in the hero card
/// above; one Mobi per screen). The subjects that would open something follow directly below,
/// each with the number of programmes it opens.
class _NoneOpen extends StatelessWidget {
  const _NoneOpen({required this.hasUnlocks, required this.onCombo});

  final bool hasUnlocks;
  final VoidCallback onCombo;

  @override
  Widget build(BuildContext context) {
    final type = context.mmType;
    return Padding(
      padding: const EdgeInsets.fromLTRB(MmSpace.gutter, MmSpace.s24, MmSpace.gutter, 0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            hasUnlocks ? ToolsCopy.noneOpenLine : ToolsCopy.noneOpenFar,
            style: type.title.copyWith(fontSize: 18, height: 24 / 18),
          ),
          if (!hasUnlocks) ...[
            const SizedBox(height: MmSpace.s12),
            KeyButton.secondary(label: ToolsCopy.openCombo, onPressed: onCombo),
          ],
        ],
      ),
    );
  }
}

/// "Other programmes": the stream's programmes at one or two colleges (or with no cutoff list),
/// folded into one row with their count and opened in place. Last in the stream's panel.
class _OtherProgrammes extends StatelessWidget {
  const _OtherProgrammes({required this.count, required this.open, required this.onTap});

  final int count;
  final bool open;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final reduced = Motion.reduced(context);
    return ToolsRowFrame(
      onTap: onTap,
      semanticsLabel: ToolsCopy.otherProgrammesSemantics(count, open),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(open ? ToolsCopy.otherProgrammesHide : ToolsCopy.otherProgrammes, style: type.labelLarge.copyWith(color: colors.accentText)),
                const SizedBox(height: MmSpace.s2),
                Text(ToolsCopy.otherProgrammesNote, style: type.caption.copyWith(color: colors.ink2)),
              ],
            ),
          ),
          const SizedBox(width: MmSpace.s12),
          Text('$count', style: type.labelLarge.copyWith(color: colors.ink2, fontFeatures: const [FontFeature.tabularFigures()])),
          const SizedBox(width: MmSpace.s8),
          AnimatedRotation(
            turns: open ? 0.5 : 0,
            duration: reduced ? Duration.zero : Motion.crossFade,
            curve: Motion.glide,
            child: Icon(LucideIcons.chevronDown, size: 18, color: colors.accentText),
          ),
        ],
      ),
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
    // One rail that scrolls, snaps to chip edges and always peeks a clean chip, so the chips never
    // stagger into a ragged block or end cut through a letter.
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        ChipRail(
          semanticLabel: ToolsCopy.unlocksHeading,
          children: [
            for (final u in state.unlocks)
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
          ],
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
    required this.search,
    required this.onQuery,
    required this.sort,
    required this.onSort,
    required this.showClearing,
    required this.onlyClearing,
    required this.onClearing,
  });

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
    // The streams are folded rows below, so the search and the sort are the only filters.
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
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

/// From Check a score: the score on show is not the student's estimate until they say so.
class _PreviewLine extends StatelessWidget {
  const _PreviewLine({required this.range, required this.onUse, required this.onClose});

  final String range;
  final VoidCallback onUse;
  final VoidCallback onClose;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return Semantics(
      liveRegion: true,
      child: Container(
        padding: const EdgeInsets.fromLTRB(MmSpace.s16, MmSpace.s12, MmSpace.s4, MmSpace.s4),
        decoration: BoxDecoration(color: colors.sunken, borderRadius: BorderRadius.circular(MmSpace.s16)),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Padding(
              padding: const EdgeInsets.only(right: MmSpace.s12),
              child: Text(ToolsCopy.previewLine(range), style: type.small.copyWith(color: colors.ink2)),
            ),
            Wrap(
              children: [
                KeyButton.quiet(label: ToolsCopy.previewUse, onPressed: onUse),
                KeyButton.quiet(label: ToolsCopy.previewClose, onPressed: onClose),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

/// My colleges on Compass: one row into the list (its full view is the Colleges tab), with how
/// many of them the estimate clears.
class _MyCollegesRow extends ConsumerWidget {
  const _MyCollegesRow({required this.estimate, required this.category});

  final Estimate? estimate;
  final String category;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final view = ref.watch(myCollegesProvider);
    if (!view.ready) return const SizedBox.shrink();
    final n = view.colleges.length;
    int? clears;
    final e = estimate;
    if (e != null && n > 0) {
      var c = 0;
      var known = 0;
      for (final m in view.colleges) {
        final f = ref.watch(collegeFigureProvider((m.programmeId, m.college, category)));
        if (!f.known) continue;
        known++;
        if (f.figure != null && verdictFor(e, f.figure).v == Verdict.clears) c++;
      }
      if (known > 0) clears = c;
    }
    return Padding(
      padding: const EdgeInsets.only(top: MmRhythm.section),
      child: ToolsPanel(
        dividerIndent: ToolsLinkRow.dividerIndent,
        children: [
          ToolsLinkRow(
            icon: LucideIcons.listOrdered,
            title: ToolsCopy.myCollegesRow,
            note: n == 0 ? ToolsCopy.myCollegesRowEmpty : ToolsCopy.myCollegesRowNote(n, clears),
            onTap: () => showMyCollegesSheet(context),
          ),
        ],
      ),
    );
  }
}
