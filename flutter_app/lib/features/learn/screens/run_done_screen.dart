import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:timezone/timezone.dart' as tz;

import '../../../core/copy/copy.dart';
import '../../../core/models/study.dart';
import '../../../core/notifications/timezones.dart';
import '../../../core/repositories/notification_prefs_repository.dart';
import '../../../core/router/routes.dart';
import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import '../data/catalog_repository.dart';
import '../data/run_controller.dart';
import '../models/run_item.dart';
import '../widgets/run_pips.dart';
import '../widgets/screen_bits.dart';

/// The ending of a lesson or a review (spec 5.9, `/learn/run/:runId/done`). It only follows a run
/// the server returned as complete, and says "Recorded" only from the server's own time.
///
/// A finished run gets a proportional moment: the pips ink in order (one per card or step put
/// away), then Mobi appears at 112 dp, cheering, or pointing at the cards to see again when most
/// came back Forgot, and the receipt line follows. The runner itself stays Mobi-free. Endings that
/// did not finish (set aside, changed, still on this phone) stay calm with no pose. Under reduced
/// motion everything is simply there and Mobi holds still. No streak and no score.
class LearnRunDoneScreen extends ConsumerStatefulWidget {
  const LearnRunDoneScreen({super.key, required this.runId});

  final String runId;

  @override
  ConsumerState<LearnRunDoneScreen> createState() => _LearnRunDoneScreenState();
}

class _LearnRunDoneScreenState extends ConsumerState<LearnRunDoneScreen> {
  /// True once a catalog read made after this run finished has come back.
  bool _dueFresh = false;

  /// True once the pips have inked: Mobi and the receipt follow.
  bool _settled = false;

  final _mobi = MobiController();
  final _firstAgain = GlobalKey();
  bool _pointed = false;

  @override
  void dispose() {
    _mobi.dispose();
    super.dispose();
  }

  void _onSettled() {
    if (!mounted || _settled) return;
    setState(() => _settled = true);
  }

  @override
  void initState() {
    super.initState();
    unawaited(_refreshDue());
  }

  Future<void> _refreshDue() async {
    await ref.read(learnCatalogProvider.notifier).refresh(force: true);
    if (!mounted) return;
    final state = ref.read(learnCatalogProvider);
    if (state.error == null && state.value != null) setState(() => _dueFresh = true);
  }

  void _backToLearn() => context.go(AppRoutes.learn);

  /// The server's own time, or null: the device clock is never presented as a record.
  DateTime? _recordedAt(StudyRun run, RunUiState ui) {
    final at = run.serverUpdatedAt ?? ui.ackedAt;
    if (at == null) return null;
    final zone = locationFor(ref.read(studentTimezoneProvider));
    return tz.TZDateTime.from(at, zone);
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final ui = ref.watch(runControllerProvider(widget.runId));
    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) _backToLearn();
      },
      child: Scaffold(
        backgroundColor: colors.ground,
        body: SafeArea(child: _body(ui)),
      ),
    );
  }

  Widget _body(RunUiState ui) {
    switch (ui.load) {
      case RunLoad.loading:
        return const SkeletonGroup(
          child: Padding(
            padding: EdgeInsets.all(MmSpace.gutter),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Skeleton(height: 28),
                SizedBox(height: MmSpace.s12),
                Skeleton.line(width: 180),
              ],
            ),
          ),
        );
      case RunLoad.offlineMissing:
        return StateView(
          kind: StateViewKind.offline,
          title: LearnCopy.runOfflineTitle,
          message: LearnCopy.runOfflineMessage,
          primary: StateAction(LearnCopy.tryAgain, () => unawaited(ref.read(runControllerProvider(widget.runId).notifier).load())),
          secondary: StateAction(LearnCopy.backToLearn, _backToLearn),
        );
      case RunLoad.unavailable:
        return StateView(
          kind: StateViewKind.error,
          title: LearnCopy.runUnavailableTitle,
          message: LearnCopy.runUnavailableMessage,
          primary: StateAction(LearnCopy.backToLearn, _backToLearn),
        );
      case RunLoad.changed:
        return _ended(
          line: LearnCopy.doneInvalidated,
          extra: LearnCopy.contentChangedOpening,
          keys: [
            KeyButton(
              label: LearnCopy.doneOpenNew,
              onPressed: () {
                final unit = ui.replacements.isEmpty ? null : ui.replacements.first.id;
                context.go(unit == null || unit.isEmpty ? AppRoutes.learn : AppRoutes.learnUnit(unit));
              },
            ),
          ],
        );
      case RunLoad.ready:
        final run = ui.run;
        if (run == null) return const SizedBox.shrink();
        if (run.isActive) return _stillActive(run, ui);
        if (run.state == 'set_aside') {
          return _ended(
            line: LearnCopy.doneSetAside,
            keys: [KeyButton(label: LearnCopy.doneBack, onPressed: _backToLearn)],
          );
        }
        return _finished(run, ui);
    }
  }

  /// The run is not finished (a deep link, or an event is still on this phone).
  Widget _stillActive(StudyRun run, RunUiState ui) {
    return _ended(
      line: ui.pending != null ? Receipts.notRecordedYet : LearnCopy.stillActive,
      pending: ui.pending != null,
      keys: [
        if (ui.pending != null)
          KeyButton(label: LearnCopy.doneRetry, onPressed: () => unawaited(ref.read(runControllerProvider(widget.runId).notifier).flush())),
        KeyButton.secondary(label: LearnCopy.resumeKey, onPressed: () => context.go(AppRoutes.learnRun(run.id))),
        Center(
          child: KeyButton.quiet(label: LearnCopy.doneBack, onPressed: _backToLearn),
        ),
      ],
    );
  }

  Widget _finished(StudyRun run, RunUiState ui) {
    final type = context.mmType;
    final colors = context.mmColors;
    final at = _recordedAt(run, ui);
    final line = run.isLearn
        ? LearnCopy.lessonFinished(run.lessonTitles.isEmpty ? run.title : run.lessonTitles.first)
        : LearnCopy.recallFinished(run.total, lessons: run.lessonTitles);
    final due = ref.watch(learnCatalogProvider).value?.queue.dueCount ?? 0;
    final again = run.againCards;
    final pointAtList = again.isNotEmpty && run.mostlyForgot;
    final reduced = Motion.reduced(context);
    final settled = _settled || run.total <= 0;
    final fade = Motion.of(context, Motion.result);
    return _frame(
      keys: [
        KeyButton(label: LearnCopy.doneBack, onPressed: _backToLearn),
        Center(
          child: KeyButton.quiet(label: LearnCopy.doneFinish, onPressed: () => context.go(AppRoutes.today)),
        ),
      ],
      children: [
        // Space is kept for Mobi so nothing below moves when it arrives.
        SizedBox(
          height: _mobiSize,
          child: Align(
            alignment: Alignment.bottomLeft,
            child: settled || reduced ? _mobiFor(pointAtList) : const SizedBox.shrink(),
          ),
        ),
        const SizedBox(height: MmSpace.s16),
        if (run.total > 0) SettlingPips(total: run.total, onSettled: _onSettled),
        const SizedBox(height: MmSpace.s24),
        Semantics(header: true, liveRegion: true, child: Text(line, style: type.title)),
        if (at != null) ...[
          const SizedBox(height: MmSpace.s8),
          AnimatedOpacity(
            opacity: settled ? 1 : 0,
            duration: fade,
            curve: Motion.out,
            child: ReceiptLine(text: LearnCopy.recordedAt(at)),
          ),
        ],
        if (_dueFresh && due > 0) ...[
          const SizedBox(height: MmSpace.s12),
          Text(LearnCopy.stillDue(due), style: type.body.copyWith(color: colors.ink2)),
        ],
        if (again.isNotEmpty) ...[
          const SizedBox(height: MmSpace.group),
          Semantics(header: true, child: Text(LearnCopy.doneAgainHeading, style: type.subhead)),
          const SizedBox(height: MmSpace.s8),
          DecoratedBox(
            key: _firstAgain,
            decoration: BoxDecoration(
              color: colors.raised,
              borderRadius: MmRadius.panelAll,
              border: Border.all(color: colors.line),
            ),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: MmSpace.s16, vertical: MmSpace.s12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  for (var i = 0; i < again.length && i < _againShown; i++) ...[
                    if (i > 0) Divider(height: MmSpace.s24, thickness: 1, color: colors.line),
                    Text(again[i].title!, style: type.body),
                  ],
                ],
              ),
            ),
          ),
          if (again.length > _againShown) _moreAgain(again),
        ],
      ],
    );
  }

  static const double _mobiSize = 112;
  static const int _againShown = 5;

  /// Mobi for a finished run: a cheer, or pointing at the list when most cards came back Forgot.
  Widget _mobiFor(bool pointAtList) {
    if (!pointAtList) {
      return const Mobi(pose: MobiPose.cheer, size: _mobiSize, motion: MobiMotion.hop);
    }
    if (!_pointed) {
      _pointed = true;
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) _mobi.pointAtWidget(_firstAgain);
      });
    }
    return Mobi(pose: MobiPose.point, size: _mobiSize, controller: _mobi, say: LearnCopy.doneMostlyForgot);
  }

  /// "and 3 more to see again", opening the lesson the first hidden card came from.
  Widget _moreAgain(List<ReviewedCard> again) {
    final type = context.mmType;
    final colors = context.mmColors;
    final hidden = again.length - _againShown;
    final unitId = again.skip(_againShown).map((c) => c.unitId).firstWhere((id) => id != null && id.isNotEmpty, orElse: () => null);
    final text = LearnCopy.againMore(hidden);
    return MmPressable(
      semanticsLabel: '$text. ${unitId == null ? LearnCopy.doneBack : LearnCopy.openLesson}',
      focusRadius: MmRadius.panelAll,
      onTap: () => context.go(unitId == null ? AppRoutes.learn : AppRoutes.learnUnit(unitId)),
      builder: (context, pressed, _) => SizedBox(
        height: MmTarget.min,
        child: Row(
          children: [
            Expanded(child: Text(text, style: type.body.copyWith(color: colors.ink2))),
            Text(
              unitId == null ? LearnCopy.doneBack : LearnCopy.openLesson,
              style: type.label.copyWith(color: colors.ink, decoration: TextDecoration.underline, decorationColor: colors.lineStrong),
            ),
          ],
        ),
      ),
    );
  }

  /// A plain ending with one line, used for runs that did not finish normally.
  Widget _ended({required String line, String? extra, bool pending = false, required List<Widget> keys}) {
    final type = context.mmType;
    final colors = context.mmColors;
    return _frame(
      keys: keys,
      children: [
        const SizedBox(height: MmSpace.s24),
        if (pending) const ReceiptLine.pending() else Semantics(header: true, liveRegion: true, child: Text(line, style: type.title)),
        if (extra != null) ...[const SizedBox(height: MmSpace.s12), Text(extra, style: type.body.copyWith(color: colors.ink2))],
      ],
    );
  }

  Widget _frame({required List<Widget> children, required List<Widget> keys}) {
    return Column(
      children: [
        Expanded(
          child: ListView(
            padding: const EdgeInsets.fromLTRB(MmSpace.gutter, MmSpace.s32, MmSpace.gutter, MmSpace.s24),
            children: [
              Center(
                child: ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: MmSpace.contentMaxWidth),
                  child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: children),
                ),
              ),
            ],
          ),
        ),
        PinnedActions(children: keys),
      ],
    );
  }
}
