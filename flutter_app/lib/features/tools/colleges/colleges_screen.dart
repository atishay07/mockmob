// The Colleges tab (`/colleges`, branch 3): "Are my marks heading to the colleges I want, and
// where do I go to find out more?" My colleges with each college's own Round 1 figure and, once
// there is an estimate, a verdict in words; then Admission Compass; then every CUET tool, each
// two taps from a cold start (L22). One primary: Choose your colleges while the list is empty,
// otherwise Open Compass. Nothing here asks for a score (L26).

import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/art/hybrid/hybrid.dart';
import '../../../core/motion/motion.dart';
import '../../../core/notes/sample_row.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../../onboarding/onboarding.dart' as ob show DuCatalog;
import '../compass/compass_controller.dart';
import '../data/my_colleges_actions.dart';
import '../estimate/estimate.dart';
import '../estimate/estimate_providers.dart';
import '../estimate/estimate_sheet.dart';
import '../my_colleges/my_colleges_copy.dart';
import '../my_colleges/my_colleges_sheet.dart';
import '../tools_paths.dart';
import '../widgets/sources_sheet.dart';
import '../widgets/tools_card.dart';
import '../widgets/tools_page.dart';
import '../widgets/web_link.dart';
import 'college_rung.dart';
import 'colleges_copy.dart';

class CollegesScreen extends ConsumerWidget {
  const CollegesScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = context.mmColors;
    final bottom = MediaQuery.paddingOf(context).bottom;
    return Scaffold(
      backgroundColor: colors.ground,
      body: SafeArea(
        bottom: false,
        child: Align(
          alignment: Alignment.topCenter,
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: MmSpace.contentMaxWidth),
            child: MmStagger(
              child: CustomScrollView(
                key: const PageStorageKey('colleges'),
                slivers: [
                  const SliverPadding(
                    padding: EdgeInsets.fromLTRB(MmSpace.gutter, MmRhythm.screenTop, MmSpace.gutter, 0),
                    sliver: SliverToBoxAdapter(child: TabRootHeader(title: CollegesCopy.title)),
                  ),
                  const SliverToBoxAdapter(child: MmStaggerItem(index: 0, child: MyCollegesBlock())),
                  SliverToBoxAdapter(child: MmStaggerItem(index: 1, child: const CompassCard())),
                  const SliverToBoxAdapter(child: MmStaggerItem(index: 2, child: _ToolsList())),
                  const SliverToBoxAdapter(child: ToolsNote(CollegesCopy.dataLine, top: MmRhythm.group)),
                  SliverToBoxAdapter(child: SizedBox(height: bottom + MmRhythm.section)),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// My colleges: heading, the estimate, the rungs and "Add a college", or the empty state.
class MyCollegesBlock extends ConsumerStatefulWidget {
  const MyCollegesBlock({super.key});

  @override
  ConsumerState<MyCollegesBlock> createState() => _MyCollegesBlockState();
}

class _MyCollegesBlockState extends ConsumerState<MyCollegesBlock> {
  /// The colleges already drawn: one added later grows in at its place; the first paint does not.
  Set<String>? _seen;

  /// Past this many rungs the list folds, so the Compass card below it stays on the first screen
  /// (L22). Nothing is cut: "Show all N" opens the rest in place.
  static const int _foldAt = 4;
  bool _expanded = false;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final view = ref.watch(myCollegesProvider);
    final actions = ref.read(myCollegesActionsProvider.notifier);
    final estimate = ref.watch(estimateProvider);
    final category = ref.watch(estimateCategoryProvider);
    final rows = view.colleges;

    if (view.ready && rows.isEmpty) return const _EmptyColleges();

    final mobi = _mobiAct(ref, view, estimate, category);
    final seen = _seen;
    final fresh = <String>{if (seen != null) for (final c in rows) if (!seen.contains(c.key)) c.key};
    if (view.ready) _seen = {for (final c in rows) c.key};
    final children = <Widget>[
      _MyCollegesHeading(
        caption: view.ready ? CollegesCopy.caption(view.list.count) : null,
        trailing: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (mobi != null)
              ExcludeSemantics(
                child: MobiCharacter(key: ValueKey('colleges-mobi-${mobi.$2}'), size: 48, entrance: mobi.$1, shadow: false, watchTaps: false),
              ),
            if (view.ready && rows.isNotEmpty) KeyButton.quiet(label: CollegesCopy.edit, onPressed: () => showMyCollegesSheet(context, entry: MyCollegesEntry.list)),
          ],
        ),
      ),
    ];

    switch (view.status) {
      case MyCollegesStatus.signedOut:
        children.add(Padding(
          padding: const EdgeInsets.symmetric(horizontal: MmSpace.gutter),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(CollegesCopy.signedOut, style: type.body.copyWith(color: colors.ink2)),
              const SizedBox(height: MmSpace.s12),
              KeyButton.secondary(label: CollegesCopy.signIn, onPressed: () => context.push('/sign-in')),
            ],
          ),
        ));
      case MyCollegesStatus.loading:
        children.add(Padding(
          padding: const EdgeInsets.symmetric(horizontal: MmSpace.gutter),
          child: SkeletonGroup(
            label: CollegesCopy.loading,
            child: Column(
              children: [
                for (var i = 0; i < 3; i++)
                  const SizedBox(
                    height: 64,
                    child: Row(children: [Skeleton.circle(size: 24), SizedBox(width: MmSpace.s12), Expanded(child: Skeleton.line(width: 200)), Skeleton.line(width: 48)]),
                  ),
              ],
            ),
          ),
        ));
      case MyCollegesStatus.failed:
        children.add(Padding(
          padding: const EdgeInsets.symmetric(horizontal: MmSpace.gutter),
          child: InlineBanner(
            tone: view.offline ? BannerTone.offline : BannerTone.error,
            message: view.offline ? MyCollegesCopy.failedOffline : MyCollegesCopy.failed,
            actionLabel: MyCollegesCopy.tryAgain,
            onAction: () => actions.retry(),
          ),
        ));
      case MyCollegesStatus.ready:
        if (view.stale) {
          children.add(Padding(
            padding: const EdgeInsets.fromLTRB(MmSpace.gutter, 0, MmSpace.gutter, MmSpace.s12),
            child: InlineBanner(
              tone: view.offline ? BannerTone.offline : BannerTone.error,
              message: view.offline ? MyCollegesCopy.staleOffline : MyCollegesCopy.staleError,
              actionLabel: MyCollegesCopy.tryAgain,
              onAction: () => actions.retry(),
            ),
          ));
        }
        children.add(EstimateBar(estimate: estimate, category: category));
        children.add(const SizedBox(height: MmSpace.s12));
        children.add(ToolsPanel(
          children: [
            for (final (i, c) in rows.indexed)
              if (_expanded || rows.length <= _foldAt || i < _foldAt - 1 || fresh.contains(c.key))
              _GrowIn(
                key: ValueKey('rung-${c.key}'),
                animate: fresh.contains(c.key),
                child: CollegeRung(
                  college: c,
                  rank: i + 1,
                  onTap: () => context.push('${ToolsPaths.programme(c.programmeId)}?college=${Uri.encodeQueryComponent(c.college)}'),
                ),
              ),
            if (!_expanded && rows.length > _foldAt && !rows.any((c) => fresh.contains(c.key)))
              ToolsRowFrame(
                key: const ValueKey('show-all-colleges'),
                onTap: () => setState(() => _expanded = true),
                semanticsLabel: CollegesCopy.showAll(rows.length),
                padding: const EdgeInsets.symmetric(horizontal: MmSpace.s16, vertical: MmSpace.s12),
                child: Row(children: [
                  Expanded(child: Text(CollegesCopy.showAll(rows.length), style: type.labelLarge.copyWith(color: colors.ink2))),
                  Icon(LucideIcons.chevronDown, size: 18, color: colors.ink2),
                ]),
              ),
            if (!view.list.isFull)
              ToolsRowFrame(
                key: const ValueKey('add-college'),
                onTap: () => showMyCollegesSheet(context, entry: MyCollegesEntry.chooser, programmeId: rows.isEmpty ? null : rows.first.programmeId),
                semanticsLabel: CollegesCopy.addCollege,
                padding: const EdgeInsets.symmetric(horizontal: MmSpace.s16, vertical: MmSpace.s12),
                child: Row(children: [
                  Icon(LucideIcons.plus, size: 18, color: colors.accentText),
                  const SizedBox(width: MmSpace.s12),
                  Text(CollegesCopy.addCollege, style: type.labelLarge.copyWith(color: colors.accentText)),
                ]),
              ),
          ],
        ));
        if (view.list.isFull) {
          children.add(Padding(
            padding: const EdgeInsets.fromLTRB(MmSpace.gutter, MmSpace.s8, MmSpace.gutter, 0),
            child: Text(MyCollegesCopy.fullLine, style: type.caption.copyWith(color: colors.ink2)),
          ));
        }
    }
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: children);
  }

  /// One Mobi, only at a real moment: proud when a college clears or is within the estimate,
  /// encourage when all are below. None without an estimate (nothing to react to). Keyed on the
  /// estimate and the list, so he reacts once per change and stays still on a tab return.
  (MobiAct, int)? _mobiAct(WidgetRef ref, MyCollegesView view, Estimate? estimate, String category) {
    if (view.status == MyCollegesStatus.failed) return (MobiAct.oops, 0);
    if (!view.ready || estimate == null || view.colleges.isEmpty) return null;
    var known = 0;
    var reach = 0;
    for (final c in view.colleges) {
      final f = ref.watch(collegeFigureProvider((c.programmeId, c.college, category)));
      if (!f.known || f.figure == null) continue;
      known++;
      final v = verdictFor(estimate, f.figure).v;
      if (v == Verdict.clears || v == Verdict.within) reach++;
    }
    if (known == 0) return null;
    final key = Object.hash(estimate, category, Object.hashAll(view.colleges.map((c) => c.key)));
    return (reach > 0 ? MobiAct.proud : MobiAct.encourage, key);
  }
}

/// "My colleges" with Edit centred on the title's line (the caption sits under both), so the key
/// never floats beside the caption.
class _MyCollegesHeading extends StatelessWidget {
  const _MyCollegesHeading({required this.caption, required this.trailing});

  final String? caption;
  final Widget trailing;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return Padding(
      padding: const EdgeInsets.fromLTRB(MmSpace.gutter, MmRhythm.group, MmSpace.s8, MmRhythm.item),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(child: Semantics(header: true, child: Text(CollegesCopy.myColleges, style: type.title))),
              trailing,
            ],
          ),
          if (caption != null) ...[
            const SizedBox(height: MmSpace.s4),
            Padding(
              padding: const EdgeInsets.only(right: MmSpace.s8),
              child: Text(caption!, style: type.caption.copyWith(color: colors.ink2)),
            ),
          ],
        ],
      ),
    );
  }
}

/// The student's estimate in one line, or what will fill it. Never a field.
class EstimateBar extends ConsumerWidget {
  const EstimateBar({super.key, required this.estimate, required this.category, this.padding = const EdgeInsets.symmetric(horizontal: MmSpace.gutter)});

  final Estimate? estimate;
  final String category;
  final EdgeInsets padding;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = context.mmColors;
    final type = context.mmType;
    final e = estimate;
    if (e == null) {
      // No estimate: say what will fill it (the papers still missing, when some mocks exist) and
      // offer a typed one. Never a field, never volt.
      final partial = ref.watch(mockPartialProvider);
      final catalog = ref.watch(compassControllerProvider).value?.catalog;
      String subject(String id) => catalog?.language(id)?.shortName ?? catalog?.domain(id)?.shortName ?? id;
      return Padding(
        padding: padding,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              partial == null ? CollegesCopy.noEstimate : CollegesCopy.partial(partial.filled, [for (final m in partial.missing) subject(m)]),
              style: type.small.copyWith(color: colors.ink2),
            ),
            // A real key (glass pill, 48 dp) under the line, so it reads as the way to act on it.
            const SizedBox(height: MmSpace.s12),
            KeyButton.secondary(label: CollegesCopy.typeEstimate, expanded: false, minHeight: 48, onPressed: () => showEstimateSheet(context)),
          ],
        ),
      );
    }
    final range = estimateRange(e);
    return Padding(
      padding: padding,
      child: MmPressable(
        semanticsLabel: '${CollegesCopy.yourEstimate}, $range out of 1000, ${CollegesCopy.source(e.source, category)}. ${CollegesCopy.change}',
        onTap: () => showEstimateSheet(context),
        builder: (context, pressed, _) => Container(
          padding: const EdgeInsets.fromLTRB(MmSpace.s16, MmSpace.s12, MmSpace.s8, MmSpace.s12),
          decoration: BoxDecoration(color: colors.sunken, borderRadius: BorderRadius.circular(MmSpace.s16)),
          child: Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Wrap(
                      crossAxisAlignment: WrapCrossAlignment.end,
                      spacing: MmSpace.s8,
                      children: [
                        Text(CollegesCopy.yourEstimate, style: type.caption.copyWith(color: colors.ink2)),
                        Text(range, style: type.figureCompact.copyWith(fontSize: 20, color: colors.ink, fontFeatures: const [FontFeature.tabularFigures()])),
                        Text(CollegesCopy.of1000, style: type.caption.copyWith(color: colors.ink3)),
                      ],
                    ),
                    const SizedBox(height: 2),
                    Text(CollegesCopy.source(e.source, category), style: type.caption.copyWith(color: colors.ink3)),
                  ],
                ),
              ),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: MmSpace.s8),
                child: Text(CollegesCopy.change, style: type.labelLarge.copyWith(fontSize: 14, color: colors.accentText)),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Empty: the question, one line, the primary, then the six Commerce courses as a chip rail that
/// opens the chooser straight on that course's ladder. Mobi points at the key, once.
class _EmptyColleges extends StatelessWidget {
  const _EmptyColleges();

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(MmSpace.gutter, MmRhythm.group, MmSpace.gutter, 0),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(CollegesCopy.myColleges, style: type.caption.copyWith(color: colors.ink2)),
                    const SizedBox(height: MmSpace.s4),
                    Semantics(header: true, child: Text(CollegesCopy.emptyTitle, style: type.title)),
                    const SizedBox(height: MmSpace.s8),
                    Text(CollegesCopy.emptyBody, style: type.body.copyWith(color: colors.ink2)),
                  ],
                ),
              ),
              const ExcludeSemantics(child: MobiCharacter(size: 56, entrance: MobiAct.point, shadow: false, watchTaps: false)),
            ],
          ),
        ),
        // What a chosen college will look like here, tagged "Example" (an empty state that teaches).
        const SizedBox(height: MmSpace.s16),
        const Padding(
          padding: EdgeInsets.symmetric(horizontal: MmSpace.gutter),
          child: SampleRow(
            leading: SampleRank(1),
            title: CollegesCopy.sampleTitle,
            note: CollegesCopy.sampleNote,
          ),
        ),
        const SizedBox(height: MmSpace.s16),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: MmSpace.gutter),
          child: KeyButton(label: CollegesCopy.choose, onPressed: () => showMyCollegesSheet(context, entry: MyCollegesEntry.chooser)),
        ),
        const SizedBox(height: MmSpace.s12),
        SizedBox(
          height: 48,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: MmSpace.gutter),
            itemCount: ob.DuCatalog.courses.length,
            separatorBuilder: (_, _) => const SizedBox(width: MmSpace.s8),
            itemBuilder: (context, i) {
              final c = ob.DuCatalog.courses[i];
              return Center(
                child: MmChip(
                  label: c.short,
                  selected: false,
                  onTap: () => showMyCollegesSheet(context, entry: MyCollegesEntry.chooser, programmeId: c.id),
                ),
              );
            },
          ),
        ),
      ],
    );
  }
}

/// Admission Compass: what the student's subjects open, and the key in. Always a secondary key:
/// the bar's Start key already holds the screen's volt (17 Oct).
class CompassCard extends ConsumerWidget {
  const CompassCard({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = context.mmColors;
    final type = context.mmType;
    final s = ref.watch(compassControllerProvider).value;
    final known = s != null && !s.selection.isEmpty;
    void open() => context.push('${ToolsPaths.compass}?from=colleges');
    return Padding(
      // ToolsCard brings the page gutter itself, so the card lines up with the panels around it.
      padding: const EdgeInsets.only(top: MmRhythm.section),
      child: ToolsCard(
        lit: true,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: MergeSemantics(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Semantics(header: true, child: Text(CollegesCopy.compassTitle, style: type.labelLarge.copyWith(color: colors.ink2))),
                        const SizedBox(height: MmSpace.s8),
                        if (known) ...[
                          Text(
                            CollegesCopy.compassFigure(s.eligible.length, s.total),
                            style: type.figure.copyWith(color: colors.ink, fontFeatures: const [FontFeature.tabularFigures()]),
                          ),
                          const SizedBox(height: MmSpace.s4),
                          Text(CollegesCopy.compassOpens(s.selection.count), style: type.small.copyWith(color: colors.ink2)),
                        ] else
                          Text(CollegesCopy.compassNoSubjects, style: type.body.copyWith(color: colors.ink2)),
                      ],
                    ),
                  ),
                ),
                const SizedBox(width: MmSpace.s12),
                ExcludeSemantics(
                  child: HybridCompass(
                    height: 56,
                    heading: known && s.eligible.isNotEmpty ? 0 : 0.6,
                    arc: known && s.total > 0 ? s.eligible.length / s.total : null,
                  ),
                ),
              ],
            ),
            const SizedBox(height: MmSpace.s16),
            KeyButton.secondary(label: CollegesCopy.openCompass, onPressed: open),
          ],
        ),
      ),
    );
  }
}

class _ToolsList extends ConsumerWidget {
  const _ToolsList();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final s = ref.watch(compassControllerProvider).value;
    return Padding(
      padding: const EdgeInsets.only(top: MmRhythm.section),
      child: ToolsPanel(
        dividerIndent: ToolsLinkRow.dividerIndent,
        children: [
          ToolsLinkRow(
            icon: LucideIcons.calculator,
            title: CollegesCopy.checkTitle,
            note: CollegesCopy.checkNote,
            onTap: () => showCheckScoreSheet(context),
          ),
          ToolsLinkRow(
            icon: LucideIcons.layoutGrid,
            title: CollegesCopy.comboTitle,
            note: CollegesCopy.comboNote,
            onTap: () => context.push('${ToolsPaths.combo}?from=colleges'),
          ),
          ToolsLinkRow(
            icon: LucideIcons.calendarRange,
            title: CollegesCopy.guideTitle,
            note: CollegesCopy.guideNote,
            onTap: () => context.push(ToolsPaths.guide2027),
          ),
          ToolsLinkRow(
            icon: LucideIcons.bookOpen,
            title: CollegesCopy.pyqTitle,
            note: CollegesCopy.pyqNote,
            external: true,
            onTap: () => unawaited(openWebPage(ref, ToolsPaths.pyqGuideWebPath)),
          ),
          if (s != null)
            ToolsLinkRow(
              icon: LucideIcons.fileText,
              title: CollegesCopy.docsTitle,
              note: CollegesCopy.docsNote,
              onTap: () => showSourcesSheet(context, s.catalog.meta.sources),
            ),
        ],
      ),
    );
  }
}

/// A college just added to the list: it opens its own room and fades in at its place (300 ms on
/// Glide), so the student sees where it landed in the order. Still under reduced motion.
class _GrowIn extends StatefulWidget {
  const _GrowIn({super.key, required this.animate, required this.child});

  final bool animate;
  final Widget child;

  @override
  State<_GrowIn> createState() => _GrowInState();
}

class _GrowInState extends State<_GrowIn> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(vsync: this, duration: Motion.glideDuration, value: widget.animate ? 0 : 1);
  late final Animation<double> _t = CurvedAnimation(parent: _c, curve: Motion.glide);

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_c.value < 1) {
      if (Motion.reduced(context)) {
        _c.value = 1;
      } else if (!_c.isAnimating) {
        _c.forward();
      }
    }
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => SizeTransition(
        sizeFactor: _t,
        alignment: Alignment.topCenter,
        child: FadeTransition(opacity: _t, child: widget.child),
      );
}
