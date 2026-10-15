import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/haptics/haptics.dart';
import '../../../core/models/session.dart' show SessionVia;
import '../../../core/router/routes.dart';
import '../../../core/sync/session/session_engine.dart';
import '../../../core/widgets/widgets.dart';
import '../../rhythm/rhythm.dart' show CelebrationMode, celebrationModeProvider;
import '../copy.dart';
import '../data/runner_session.dart';
import '../logic/sheet_cells.dart';
import '../widgets/leave_sheet.dart';
import '../widgets/palette_sheet.dart';
import '../widgets/runner_layout.dart';
import '../widgets/solid_sheet.dart';
import 'runner_host.dart';

/// The Night Sheet runner (spec 5.5) for practice and the Full mock. Concentration is the
/// feeling: the layout is still, selection answers on the next frame, and the only sounds are
/// the option tick and the 5 and 1 minute warnings. NTA mode has its own exam skin
/// (`nta/nta_runner_screen.dart`) over the same session.
class RunnerView extends ConsumerStatefulWidget {
  const RunnerView({super.key, required this.session});

  final RunnerSession session;

  @override
  ConsumerState<RunnerView> createState() => _RunnerViewState();
}

class _RunnerViewState extends ConsumerState<RunnerView> with RunnerHost<RunnerView> {
  @override
  RunnerSession get session => widget.session;

  @override
  void initState() {
    super.initState();
    initHost();
  }

  @override
  void dispose() {
    disposeHost();
    _filter.dispose();
    super.dispose();
  }

  /// The palette's legend filter, kept for this sitting so the "Go to question N" key walks the
  /// matches across openings.
  final ValueNotifier<SheetFilter?> _filter = ValueNotifier<SheetFilter?>(null);

  /// Mobi on the leave guard and the palette, unless Celebrations are Off.
  bool get _mobiOn => ref.read(celebrationModeProvider) != CelebrationMode.off;

  Future<void> _confirmLeave() async {
    if (session.submitState.value.stage != SubmitStage.idle) return;
    unawaited(ref.read(hapticsProvider).warn());
    final leave = await showRunnerSheet<bool>(
      context: context,
      title: RunnerCopy.leaveTitle(session.isMock),
      builder: (_) => LeaveSheet(isMock: session.isMock, until: session.endsAt, showMobi: _mobiOn),
    );
    // Leaving lands on Practice; the session stays resumable there and on Today.
    if (leave == true && mounted) context.go(AppRoutes.practice);
  }

  Future<void> _openPalette() async {
    final showMobi = _mobiOn;
    final jump = await showRunnerSheet<int>(
      context: context,
      title: RunnerCopy.paletteTitle,
      heightFactor: session.questions.length > 20 ? 0.88 : null,
      footer: (sheetContext) =>
          KeyButton(label: RunnerCopy.reviewAndSubmit, onPressed: () => Navigator.of(sheetContext).pop(-1), hapticOnCommit: false),
      builder: (sheetContext) => ListenableBuilder(
        listenable: Listenable.merge([session, _filter]),
        builder: (context, _) => PaletteSheet(
          cells: sheetCellsOf(session),
          onJump: (i) => Navigator.of(sheetContext).pop(i),
          onReview: () => Navigator.of(sheetContext).pop(-1),
          showSubmit: false,
          filter: _filter.value,
          onFilter: (f) => _filter.value = f,
          showMobi: showMobi,
          openUntil: session.isMock ? null : RunnerCopy.openUntil(session.endsAt.toLocal()),
        ),
      ),
    );
    if (!mounted || jump == null) return;
    session.dismissAway();
    if (jump < 0) {
      openSubmit();
    } else {
      unawaited(ref.read(hapticsProvider).tick());
      goTo(jump, via: SessionVia.palette);
    }
  }

  /// A tap on a bubble of the timing track: the same jump as the palette's.
  void _jump(int index) {
    if (index == session.currentIndex) return;
    unawaited(ref.read(hapticsProvider).tick());
    goTo(index, via: SessionVia.palette);
  }

  @override
  Widget build(BuildContext context) {
    watchNetwork();
    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) unawaited(_confirmLeave());
      },
      child: ListenableBuilder(
        listenable: session,
        builder: (context, _) => RunnerLayout(
          session: session,
          warning: timeWarning,
          onLeave: () => unawaited(_confirmLeave()),
          onQuestions: () => unawaited(_openPalette()),
          onSelect: (qid, option) => unawaited(select(qid, option)),
          onStrike: strike,
          onReady: () => unawaited(ref.read(hapticsProvider).tick()),
          onPrevious: previous,
          onNext: next,
          onSwipe: (step) => step > 0 ? next(via: SessionVia.swipe) : previous(via: SessionVia.swipe),
          onJump: _jump,
          onRetrySave: session.onConnectivityRestored,
        ),
      ),
    );
  }
}
