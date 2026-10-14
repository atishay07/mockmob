import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/api/api_providers.dart';
import '../../../core/models/attempt.dart';
import '../../../core/repositories/attempts_repository.dart';
import '../../../core/repositories/remote_state.dart';
import '../../../core/router/routes.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import '../data/evidence.dart';
import '../data/insights_models.dart';
import '../data/insights_repository.dart';
import '../data/recovery_record.dart';
import '../data/subject_names.dart';
import '../data/trend.dart';
import '../insights_paths.dart';
import '../widgets/insights_bits.dart';
import '../widgets/ledger_hero.dart';
import '../widgets/recovery_sections.dart';
import '../widgets/record_sections.dart';
import '../widgets/trend_chart.dart';

/// What the record page reads, in one place so tests and goldens can replace it whole.
class InsightsInputs {
  InsightsInputs({
    required this.insights,
    List<Attempt>? attempts,
    RemoteState<List<Attempt>>? attemptsState,
    RemoteState<RecoveryRecord>? recovery,
    this.pro = false,
  })  : attemptsState = attemptsState ?? RemoteState(value: attempts),
        recovery = recovery ?? const RemoteState<RecoveryRecord>.idle();

  final RemoteState<PrepInsights> insights;

  /// The scored attempts (trend, by subject and the sessions behind every claim): loading,
  /// failed, stale or ready.
  final RemoteState<List<Attempt>> attemptsState;
  final bool pro;

  /// Concept checks and the playbook (`GET /api/recovery`). Idle means not asked for: nothing
  /// is drawn for it.
  final RemoteState<RecoveryRecord> recovery;

  /// The attempts on the phone, or null until loaded.
  List<Attempt>? get attempts => attemptsState.value;

  /// Still on their way, with nothing to show yet.
  bool get attemptsPending => attempts == null && !attemptsState.isFailedEmpty;

  /// Failed with nothing on the phone.
  bool get attemptsFailed => attemptsState.isFailedEmpty;
}

final insightsInputsProvider = Provider<InsightsInputs>(
  (ref) => InsightsInputs(
    insights: ref.watch(insightsRepositoryProvider),
    attemptsState: ref.watch(attemptsRepositoryProvider),
    recovery: ref.watch(recoveryRecordRepositoryProvider),
    pro: ref.watch(insightsProProvider),
  ),
);

/// `/review/insights`: the student's record (website Analytics and the PrepOS record). Every
/// figure comes from the server or from the scored attempts, and says what it counts. Every
/// claim carries Show me, opening the sessions behind it; a claim with no session on the phone
/// behind it is not shown. While the sessions load, their sections are skeletons; if they fail
/// with nothing kept, one plain row says so with Try again.
class InsightsScreen extends ConsumerWidget {
  const InsightsScreen({super.key});

  Future<void> _refresh(WidgetRef ref) async {
    await Future.wait([
      ref.read(insightsRepositoryProvider.notifier).refresh(force: true),
      ref.read(attemptsRepositoryProvider.notifier).refresh(force: true),
      ref.read(recoveryRecordRepositoryProvider.notifier).refresh(force: true),
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
            if (state.isStale || inputs.attemptsState.isStale || inputs.recovery.isStale) ...[const InlineBanner.offlineStrip(), const SizedBox(height: MmSpace.s16)],
            ..._sections(context, ref, value, inputs),
            if (RecoverySections.shows(inputs.recovery)) ...[
              const SizedBox(height: MmSpace.group + MmSpace.s8),
              RecoverySections(
                state: inputs.recovery,
                onRetry: () => ref.read(recoveryRecordRepositoryProvider.notifier).refresh(force: true),
              ),
            ],
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

  List<Widget> _sections(BuildContext context, WidgetRef ref, PrepInsights v, InsightsInputs inputs) {
    final attempts = inputs.attempts;
    final ev = attempts == null ? null : RecordEvidence(attempts, now: ref.watch(nowProvider)());
    final series = trendSeries(attempts ?? const <Attempt>[]);
    final subjects = subjectLines(attempts ?? const <Attempt>[]);
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

    final head = <Widget>[
      LedgerHero(insights: v, evidence: ev?.ledger),
      const SizedBox(height: MmSpace.s20),
      Align(
        alignment: Alignment.centerLeft,
        child: KeyButton.secondary(label: InsightsCopy.askKey, expanded: false, onPressed: () => context.push(InsightsPaths.ask)),
      ),
    ];
    final chapters = <Widget>[
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
    ];

    // The sessions are still loading: their sections hold their place.
    if (ev == null && inputs.attemptsPending) {
      return [
        ...head,
        if (v.findings.isNotEmpty) ...[gap, const SectionTitle(InsightsCopy.findingsHeading), const _BlockSkeleton(height: 160)],
        gap,
        const SectionTitle(InsightsCopy.trendHeading),
        const _BlockSkeleton(height: 210),
        ...chapters,
        gap,
        const SectionTitle(InsightsCopy.subjectsHeading),
        const _BlockSkeleton(height: 150),
      ];
    }

    // The sessions failed with nothing on the phone: say so once, offer Try again.
    if (ev == null) {
      final offline = inputs.attemptsState.error?.isOffline ?? false;
      return [
        ...head,
        gap,
        _AttemptsErrorRow(
          message: offline ? InsightsCopy.attemptsOffline : InsightsCopy.attemptsFailed,
          onRetry: () => ref.read(attemptsRepositoryProvider.notifier).refresh(force: true),
        ),
        ...chapters,
      ];
    }

    final findings = [for (final f in v.findings) if (ev.forFinding(f, v).isNotEmpty) f];
    final c = v.changes;
    final p = v.pace;
    final quietWeek = v.thisWeek.sessions == 0 && v.lastWeek.sessions == 0;
    final showChanges = !inputs.pro || c.count == 0 || ev.changes.isNotEmpty;
    final showPace = !inputs.pro || !p.usable || ev.pace.isNotEmpty;
    final showWeek = quietWeek || ev.lastTwoWeeks.isNotEmpty;

    return [
      ...head,
      if (findings.isNotEmpty) ...[
        gap,
        const SectionTitle(InsightsCopy.findingsHeading),
        FindingsPanel(findings: findings, onAction: actionFor, evidence: (f) => ev.forFinding(f, v)),
      ],
      if (series.isNotEmpty) ...[
        gap,
        const SectionTitle(InsightsCopy.trendHeading),
        TrendSection(series: series),
      ],
      ...chapters,
      if (showChanges) ...[
        gap,
        const SectionTitle(InsightsCopy.changesHeading),
        if (inputs.pro) ChangesSection(changes: c, evidence: ev.changes) else const ProRow(InsightsCopy.proChanges),
      ],
      if (showPace) ...[
        gap,
        const SectionTitle(InsightsCopy.paceHeading),
        if (inputs.pro) PaceSection(pace: p, evidence: ev.pace) else const ProRow(InsightsCopy.proPace),
      ],
      if (showWeek) ...[
        gap,
        const SectionTitle(InsightsCopy.weekHeading),
        WeekSection(thisWeek: v.thisWeek, lastWeek: v.lastWeek, activeDays: v.activeDaysLast14, evidence: ev.lastTwoWeeks),
      ],
      if (subjects.isNotEmpty) ...[
        gap,
        const SectionTitle(InsightsCopy.subjectsHeading),
        SubjectsSection(lines: subjects),
      ],
    ];
  }
}

/// A grey block holding a section's place while the sessions load.
class _BlockSkeleton extends StatelessWidget {
  const _BlockSkeleton({required this.height});

  final double height;

  @override
  Widget build(BuildContext context) => SkeletonGroup(child: Skeleton(height: height, radius: MmRadius.panel));
}

/// One plain row when the sessions could not be read and none are on the phone.
class _AttemptsErrorRow extends StatelessWidget {
  const _AttemptsErrorRow({required this.message, required this.onRetry});

  final String message;
  final Future<void> Function() onRetry;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return Semantics(
      container: true,
      liveRegion: true,
      child: DecoratedBox(
        decoration: ShapeDecoration(
          color: colors.raised,
          shape: mmShapeBorder(MmRadius.panelAll, side: BorderSide(color: colors.line)),
        ),
        child: Padding(
          padding: const EdgeInsets.fromLTRB(MmSpace.cardPadding, MmSpace.s12, MmSpace.s8, MmSpace.s12),
          child: Row(
            children: [
              Expanded(child: Text(message, style: type.small.copyWith(color: colors.ink))),
              const SizedBox(width: MmSpace.s8),
              KeyButton.quiet(label: InsightsCopy.retry, onPressed: () => onRetry()),
            ],
          ),
        ),
      ),
    );
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
