import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/api/api_providers.dart';
import '../../../core/models/attempt.dart';
import '../../../core/motion/motion.dart';
import '../../../core/repositories/attempts_repository.dart';
import '../../../core/repositories/remote_state.dart';
import '../../../core/router/routes.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../ask_mobi.dart';
import '../copy.dart';
import '../data/evidence.dart';
import '../data/insights_models.dart';
import '../data/insights_repository.dart';
import '../data/recovery_record.dart';
import '../data/subject_names.dart';
import '../data/trend.dart';
import '../insights_paths.dart';
import '../../pro_nudge/pro_nudge.dart' show ProReason;
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
      body = MmPullRefresh(
        onRefresh: () => _refresh(ref),
        child: ListView(
          // The pull is drawn by the ring, so the list must always take a drag, even when short.
          physics: const AlwaysScrollableScrollPhysics(),
          padding: EdgeInsets.fromLTRB(MmSpace.gutter, MmSpace.s8, MmSpace.gutter, pad.bottom + MmSpace.s32),
          children: [
            // The same rounded inline banner as every other notice, in the flow with the page's gutter.
            if (state.isStale || inputs.attemptsState.isStale || inputs.recovery.isStale) ...[
              const InlineBanner(message: InsightsCopy.staleNote, tone: BannerTone.offline),
              const SizedBox(height: MmSpace.s16),
            ],
            ..._sections(context, ref, value, inputs),
            if (RecoverySections.shows(inputs.recovery)) ...[
              const SizedBox(height: MmSpace.group),
              Divider(height: 1, color: colors.line),
              const SizedBox(height: MmSpace.s16),
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
    const gap = SizedBox(height: MmSpace.group);

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
      const SizedBox(height: MmSpace.s12),
      AskMobiStrip(onTap: () => openAskMobi(context, const AskMobiContext.page())),
    ];
    // Sections are simply there: no fade-up as they are built or scrolled to (text never moves while
    // the record scrolls). Only the charts inside them draw, once, as they come into view.
    Widget section(String title, Widget child, {String? caption}) => Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          // A hairline and space set sections apart; only the hero and the lead finding are cards.
          children: [Divider(height: 1, color: context.mmColors.line), const SizedBox(height: MmSpace.s16), SectionTitle(title, caption: caption), child],
        );
    final chapters = <Widget>[
      if (v.ranked.isNotEmpty || v.thin.isNotEmpty) ...[
        gap,
        section(
          InsightsCopy.chaptersHeading,
          ChaptersSection(
            ranked: v.ranked,
            thin: v.thin,
            pro: inputs.pro,
            onPractise: (c) => context.push(InsightsPaths.practiseChapter(canonicalSubjectId(c.subject), c.chapter)),
          ),
          caption: InsightsCopy.chaptersCaption,
        ),
      ],
    ];

    // The sessions are still loading: their sections hold their place.
    if (ev == null && inputs.attemptsPending) {
      return [
        ...head,
        if (v.findings.isNotEmpty) ...[gap, const SectionTitle(InsightsCopy.findingsHeading), const _BlockSkeleton(MmSkeletonCard())],
        gap,
        const SectionTitle(InsightsCopy.trendHeading),
        const _BlockSkeleton(MmSkeletonCard()),
        ...chapters,
        gap,
        const SectionTitle(InsightsCopy.subjectsHeading),
        const _BlockSkeleton(MmSkeletonRows(rows: 2)),
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
          offline: offline,
          onRetry: () => ref.read(attemptsRepositoryProvider.notifier).refresh(force: true),
        ),
        ...chapters,
      ];
    }

    final findings = [for (final f in v.findings) if (ev.forFinding(f, v).isNotEmpty) f];
    final c = v.changes;
    final p = v.pace;
    final quietWeek = v.thisWeek.sessions == 0 && v.lastWeek.sessions == 0;
    // For a Free student these two sections are Pro rows, visible but locked (D101): a quiet Pro tag,
    // and a tap that says what Pro adds (no price or link while PLAY_BILLING is off).
    final showChanges = !inputs.pro || c.count == 0 || ev.changes.isNotEmpty;
    final showPace = !inputs.pro || !p.usable || ev.pace.isNotEmpty;
    final showWeek = quietWeek || ev.lastTwoWeeks.isNotEmpty;

    return [
      ...head,
      if (findings.isNotEmpty) ...[
        gap,
        section(
          InsightsCopy.findingsHeading,
          FindingsPanel(findings: findings, onAction: actionFor, evidence: (f) => ev.forFinding(f, v)),
        ),
      ],
      if (series.isNotEmpty) ...[
        gap,
        section(InsightsCopy.trendHeading, TrendSection(series: series)),
      ],
      ...chapters,
      if (showChanges) ...[
        gap,
        section(
          InsightsCopy.changesHeading,
          inputs.pro ? ChangesSection(changes: c, evidence: ev.changes) : const ProRow(InsightsCopy.proChanges, reason: ProReason.insightsChanges),
        ),
      ],
      if (showPace) ...[
        gap,
        section(
          InsightsCopy.paceHeading,
          inputs.pro ? PaceSection(pace: p, evidence: ev.pace) : const ProRow(InsightsCopy.proPace, reason: ProReason.insightsPace),
        ),
      ],
      if (showWeek) ...[
        gap,
        section(
          InsightsCopy.weekHeading,
          WeekSection(thisWeek: v.thisWeek, lastWeek: v.lastWeek, activeDays: v.activeDaysLast14, evidence: ev.lastTwoWeeks, now: ev.now),
        ),
      ],
      if (subjects.isNotEmpty) ...[
        gap,
        section(InsightsCopy.subjectsHeading, SubjectsSection(lines: subjects)),
      ],
    ];
  }
}

/// The shape of a section, holding its place while the sessions load.
class _BlockSkeleton extends StatelessWidget {
  const _BlockSkeleton(this.shape);

  final Widget shape;

  @override
  Widget build(BuildContext context) => SkeletonGroup(child: shape);
}

/// One plain notice when the sessions could not be read and none are on the phone: the same
/// rounded inline banner as the offline note, with Try again.
class _AttemptsErrorRow extends StatelessWidget {
  const _AttemptsErrorRow({required this.message, required this.offline, required this.onRetry});

  final String message;
  final bool offline;
  final Future<void> Function() onRetry;

  @override
  Widget build(BuildContext context) => InlineBanner(
        message: message,
        tone: offline ? BannerTone.offline : BannerTone.warning,
        actionLabel: InsightsCopy.retry,
        onAction: () => onRetry(),
      );
}

/// The record while it loads, in the shape of what is coming: the hero's figure and its sheet of
/// bubbles, then a finding and a few rows. One soft band of light crosses it, a few times.
class _RecordSkeleton extends StatelessWidget {
  const _RecordSkeleton();

  @override
  Widget build(BuildContext context) {
    // Taller than a small phone: a scroll view that does not scroll, so the rest simply runs off
    // the fold and nothing overflows at any text size.
    return const SkeletonGroup(
      shimmer: true,
      child: SingleChildScrollView(
        physics: NeverScrollableScrollPhysics(),
        padding: EdgeInsets.symmetric(horizontal: MmSpace.gutter, vertical: MmSpace.s8),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _HeroSkeleton(),
            SizedBox(height: MmSpace.s12),
            Skeleton(height: 56, radius: MmRadius.key),
            SizedBox(height: MmRhythm.section),
            Skeleton.line(width: 190, height: 20),
            SizedBox(height: MmSpace.s16),
            Skeleton(height: 132, radius: MmRadius.panel),
            SizedBox(height: MmRhythm.section),
            MmSkeletonRows(rows: 3),
          ],
        ),
      ),
    );
  }
}

/// The hero card's shape: a line of basis, the big figure, its meaning, a dot grid and the legend.
class _HeroSkeleton extends StatelessWidget {
  const _HeroSkeleton();

  static const int _cols = 12;
  static const int _rows = 6;
  static const double _gap = 6;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    return DecoratedBox(
      decoration: ShapeDecoration(
        color: colors.raised,
        shape: mmShapeBorder(MmRadius.panelAll, side: BorderSide(color: colors.line)),
      ),
      child: Padding(
        padding: const EdgeInsets.all(MmSpace.s20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Skeleton.line(width: 190, height: 14),
            const SizedBox(height: MmSpace.s12),
            const Skeleton(width: 150, height: 84, radius: MmRadius.key),
            const SizedBox(height: MmSpace.s12),
            const Skeleton.line(width: 230, height: 14),
            const SizedBox(height: MmSpace.s20),
            LayoutBuilder(
              builder: (context, box) {
                final d = (box.maxWidth - (_cols - 1) * _gap) / _cols;
                return Wrap(
                  spacing: _gap,
                  runSpacing: _gap,
                  children: [for (var i = 0; i < _cols * _rows; i++) Skeleton.circle(size: d)],
                );
              },
            ),
            const SizedBox(height: MmSpace.s16),
            const Row(
              children: [
                Skeleton.line(width: 70, height: 12),
                SizedBox(width: MmSpace.s16),
                Skeleton.line(width: 70, height: 12),
                SizedBox(width: MmSpace.s16),
                Skeleton.line(width: 70, height: 12),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
