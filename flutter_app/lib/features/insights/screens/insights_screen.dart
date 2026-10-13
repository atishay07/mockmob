import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/models/attempt.dart';
import '../../../core/repositories/attempts_repository.dart';
import '../../../core/repositories/remote_state.dart';
import '../../../core/router/routes.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import '../data/insights_models.dart';
import '../data/insights_repository.dart';
import '../data/subject_names.dart';
import '../data/trend.dart';
import '../insights_paths.dart';
import '../widgets/insights_bits.dart';
import '../widgets/ledger_hero.dart';
import '../widgets/record_sections.dart';
import '../widgets/trend_chart.dart';

/// What the record page reads, in one place so tests and goldens can replace it whole.
class InsightsInputs {
  const InsightsInputs({required this.insights, this.attempts, this.pro = false});

  final RemoteState<PrepInsights> insights;

  /// The scored attempts already on the phone (trend and by-subject), or null until loaded.
  final List<Attempt>? attempts;
  final bool pro;
}

final insightsInputsProvider = Provider<InsightsInputs>(
  (ref) => InsightsInputs(
    insights: ref.watch(insightsRepositoryProvider),
    attempts: ref.watch(attemptsRepositoryProvider).value,
    pro: ref.watch(insightsProProvider),
  ),
);

/// `/review/insights`: the student's record (website Analytics and the PrepOS record). Every
/// figure comes from the server or from the scored attempts, and says what it counts.
class InsightsScreen extends ConsumerWidget {
  const InsightsScreen({super.key});

  Future<void> _refresh(WidgetRef ref) async {
    await Future.wait([
      ref.read(insightsRepositoryProvider.notifier).refresh(force: true),
      ref.read(attemptsRepositoryProvider.notifier).refresh(force: true),
    ]);
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = context.mmColors;
    final inputs = ref.watch(insightsInputsProvider);
    final state = inputs.insights;
    final value = state.value;
    final pad = MediaQuery.paddingOf(context);

    Widget body;
    if (value == null) {
      if (state.isFailedEmpty) {
        final offline = state.error?.isOffline ?? false;
        body = StateView(
          kind: offline ? StateViewKind.offline : StateViewKind.error,
          title: offline ? InsightsCopy.offlineTitle : InsightsCopy.errorTitle,
          message: offline ? InsightsCopy.offlineMessage : InsightsCopy.errorMessage,
          primary: StateAction(InsightsCopy.retry, () => _refresh(ref)),
        );
      } else {
        body = const _RecordSkeleton();
      }
    } else if (!value.isReady) {
      body = StateView(
        kind: StateViewKind.empty,
        pose: MobiPose.read,
        title: InsightsCopy.emptyTitle,
        message: InsightsCopy.emptyMessage,
        primary: StateAction(InsightsCopy.emptyAction, () => context.push(Uri(path: AppRoutes.practiceStart, queryParameters: {'mode': 'quick', 'count': '10'}).toString())),
      );
    } else {
      body = RefreshIndicator(
        onRefresh: () => _refresh(ref),
        color: colors.ink,
        backgroundColor: colors.raised,
        child: ListView(
          padding: EdgeInsets.fromLTRB(MmSpace.gutter, MmSpace.s8, MmSpace.gutter, pad.bottom + MmSpace.s48),
          children: [
            if (state.isStale) ...[const InlineBanner.offlineStrip(), const SizedBox(height: MmSpace.s16)],
            ..._sections(context, value, inputs),
          ],
        ),
      );
    }

    return Scaffold(
      backgroundColor: colors.ground,
      body: Stack(
        children: [
          Positioned(left: 0, right: 0, top: 0, height: 420, child: IgnorePointer(child: LightField.lamp(context, strength: 0.7))),
          SafeArea(
            bottom: false,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                InsightsHeader(title: InsightsCopy.recordTitle, fallback: AppRoutes.review),
                Expanded(child: body),
              ],
            ),
          ),
        ],
      ),
    );
  }

  List<Widget> _sections(BuildContext context, PrepInsights v, InsightsInputs inputs) {
    final attempts = inputs.attempts ?? const <Attempt>[];
    final series = trendSeries(attempts);
    final subjects = subjectLines(attempts);
    const gap = SizedBox(height: MmSpace.group + MmSpace.s8);

    VoidCallback? actionFor(Finding f) {
      // The chapter finding opens that chapter, not the whole subject.
      if (f.id == 'chapter' && v.ranked.isNotEmpty) {
        final top = v.ranked.first;
        return () => context.push(InsightsPaths.practiseChapter(canonicalSubjectId(top.subject), top.chapter));
      }
      final href = f.actionHref;
      final location = href == null ? null : InsightsPaths.locationFor(href);
      return location == null ? null : () => context.push(location);
    }

    return [
      LedgerHero(insights: v),
      const SizedBox(height: MmSpace.s20),
      Align(
        alignment: Alignment.centerLeft,
        child: KeyButton.secondary(label: InsightsCopy.askKey, expanded: false, onPressed: () => context.push(InsightsPaths.ask)),
      ),
      if (v.findings.isNotEmpty) ...[
        gap,
        const SectionTitle(InsightsCopy.findingsHeading),
        FindingsPanel(findings: v.findings, onAction: actionFor),
      ],
      if (series.isNotEmpty) ...[
        gap,
        const SectionTitle(InsightsCopy.trendHeading),
        TrendSection(series: series),
      ],
      if (v.ranked.isNotEmpty || v.thin.isNotEmpty) ...[
        gap,
        const SectionTitle(InsightsCopy.chaptersHeading, caption: InsightsCopy.chaptersCaption),
        ChaptersSection(
          ranked: v.ranked,
          thin: v.thin,
          pro: inputs.pro,
          onPractise: (c) => context.push(InsightsPaths.practiseChapter(canonicalSubjectId(c.subject), c.chapter)),
        ),
      ],
      gap,
      const SectionTitle(InsightsCopy.changesHeading),
      if (inputs.pro) ChangesSection(changes: v.changes) else const ProRow(InsightsCopy.proChanges),
      gap,
      const SectionTitle(InsightsCopy.paceHeading),
      if (inputs.pro) PaceSection(pace: v.pace) else const ProRow(InsightsCopy.proPace),
      gap,
      const SectionTitle(InsightsCopy.weekHeading),
      WeekSection(thisWeek: v.thisWeek, lastWeek: v.lastWeek, activeDays: v.activeDaysLast14),
      if (subjects.isNotEmpty) ...[
        gap,
        const SectionTitle(InsightsCopy.subjectsHeading),
        SubjectsSection(lines: subjects),
      ],
    ];
  }
}

class _RecordSkeleton extends StatelessWidget {
  const _RecordSkeleton();

  @override
  Widget build(BuildContext context) {
    return const SkeletonGroup(
      child: Padding(
        padding: EdgeInsets.symmetric(horizontal: MmSpace.gutter, vertical: MmSpace.s8),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Skeleton.line(width: 220),
            SizedBox(height: MmSpace.s12),
            Skeleton(width: 180, height: 88),
            SizedBox(height: MmSpace.s16),
            Skeleton(height: 14, radius: 7),
            SizedBox(height: MmSpace.group),
            Skeleton(height: 220, radius: MmRadius.panel),
          ],
        ),
      ),
    );
  }
}
