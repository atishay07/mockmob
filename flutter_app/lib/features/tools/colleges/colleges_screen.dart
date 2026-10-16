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
import '../../../core/motion/entrance.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../../onboarding/onboarding.dart' as ob show DuCatalog;
import '../compass/category_score.dart' show showCategoryScoreSheet;
import '../compass/compass_controller.dart';
import '../data/my_colleges_actions.dart';
import '../estimate/estimate.dart';
import '../estimate/estimate_providers.dart';
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
    final view = ref.watch(myCollegesProvider);
    final empty = view.ready && view.list.isEmpty;
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
                  SliverToBoxAdapter(child: MmStaggerItem(index: 1, child: CompassCard(primary: !empty))),
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
class MyCollegesBlock extends ConsumerWidget {
  const MyCollegesBlock({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = context.mmColors;
    final type = context.mmType;
    final view = ref.watch(myCollegesProvider);
    final actions = ref.read(myCollegesActionsProvider.notifier);
    final estimate = ref.watch(estimateProvider);
    final category = ref.watch(estimateCategoryProvider);
    final rows = view.colleges;

    if (view.ready && rows.isEmpty) return const _EmptyColleges();

    final mobi = _mobiAct(ref, view, estimate, category);
    final children = <Widget>[
      ToolsHeading(
        CollegesCopy.myColleges,
        top: MmRhythm.group,
        note: view.ready ? CollegesCopy.caption(view.list.count) : null,
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
              CollegeRung(
                key: ValueKey('rung-${c.key}'),
                college: c,
                rank: i + 1,
                onTap: () => context.push('${ToolsPaths.programme(c.programmeId)}?college=${Uri.encodeQueryComponent(c.college)}'),
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

/// The student's estimate in one line, or what will fill it. Never a field.
class EstimateBar extends StatelessWidget {
  const EstimateBar({super.key, required this.estimate, required this.category});

  final Estimate? estimate;
  final String category;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final e = estimate;
    if (e == null) {
      return Padding(
        padding: const EdgeInsets.symmetric(horizontal: MmSpace.gutter),
        child: Row(
          children: [
            Expanded(child: Text(CollegesCopy.noEstimate, style: type.small.copyWith(color: colors.ink2))),
            KeyButton.quiet(label: CollegesCopy.typeEstimate, onPressed: () => showCategoryScoreSheet(context)),
          ],
        ),
      );
    }
    final range = estimateRange(e);
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: MmSpace.gutter),
      child: MmPressable(
        semanticsLabel: '${CollegesCopy.yourEstimate}, $range out of 1000, ${CollegesCopy.source(e.source, category)}. ${CollegesCopy.change}',
        onTap: () => showCategoryScoreSheet(context),
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

/// Admission Compass: what the student's subjects open, and the key in. The page's primary while
/// the list has colleges; secondary while the primary is Choose your colleges.
class CompassCard extends ConsumerWidget {
  const CompassCard({super.key, this.primary = true});

  final bool primary;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = context.mmColors;
    final type = context.mmType;
    final s = ref.watch(compassControllerProvider).value;
    final known = s != null && !s.selection.isEmpty;
    void open() => context.push('${ToolsPaths.compass}?from=colleges');
    return Padding(
      padding: const EdgeInsets.fromLTRB(MmSpace.gutter, MmRhythm.section, MmSpace.gutter, 0),
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
            if (primary)
              KeyButton(label: CollegesCopy.openCompass, onPressed: open)
            else
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
            onTap: () => context.push(ToolsPaths.collegesCutoff),
          ),
          ToolsLinkRow(
            icon: LucideIcons.layoutGrid,
            title: CollegesCopy.comboTitle,
            note: CollegesCopy.comboNote,
            onTap: () => context.push('${ToolsPaths.combo}?from=colleges'),
          ),
          ToolsLinkRow(
            icon: LucideIcons.calendarRange,
            title: 'CUET 2027 exam guide',
            note: 'Expected dates and a month-by-month plan',
            onTap: () => context.push(ToolsPaths.guide2027),
          ),
          ToolsLinkRow(
            icon: LucideIcons.bookOpen,
            title: 'Previous-year questions',
            note: 'How to practise with past papers. Opens the website',
            external: true,
            onTap: () => unawaited(openWebPage(ref, ToolsPaths.pyqGuideWebPath)),
          ),
          if (s != null)
            ToolsLinkRow(
              icon: LucideIcons.fileText,
              title: 'Official DU documents',
              note: 'The Bulletin and the three round lists',
              onTap: () => showSourcesSheet(context, s.catalog.meta.sources),
            ),
        ],
      ),
    );
  }
}
