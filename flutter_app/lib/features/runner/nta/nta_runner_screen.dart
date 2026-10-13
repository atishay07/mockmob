import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/auth/auth_state.dart';
import '../../../core/haptics/haptics.dart';
import '../../../core/router/routes.dart';
import '../../../core/sync/session/session_engine.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import '../data/runner_session.dart';
import '../logic/sheet_cells.dart';
import '../screens/runner_host.dart';
import '../widgets/solid_sheet.dart';
import 'nta_copy.dart';
import 'nta_integrity.dart';
import 'nta_layout.dart';
import 'nta_overlays.dart';
import 'nta_palette.dart';
import 'nta_question_paper.dart';
import 'nta_text_size.dart';

/// The student's name for the candidate card: the account's own, or nothing.
final ntaCandidateNameProvider = Provider<String?>((ref) => ref.watch(authSnapshotProvider).name);

/// NTA mode (NTA-MODE-SPEC): the exam-day screen over the same session engine as every other
/// run. Adds the exam's keys, palette and question paper, and the three-warning integrity guard.
class NtaRunnerView extends ConsumerStatefulWidget {
  const NtaRunnerView({super.key, required this.session});

  final RunnerSession session;

  @override
  ConsumerState<NtaRunnerView> createState() => _NtaRunnerViewState();
}

class _NtaRunnerViewState extends ConsumerState<NtaRunnerView> with RunnerHost<NtaRunnerView> {
  late final NtaIntegrity _integrity;
  int _seenStrikes = 0;

  @override
  RunnerSession get session => widget.session;

  @override
  void initState() {
    super.initState();
    initHost();
    _integrity = NtaIntegrity(
      sessionId: session.sessionId,
      store: ref.read(ntaPrefsProvider),
      onTerminate: () => unawaited(session.submit()),
      isLive: () => session.submitState.value.stage == SubmitStage.idle && session.remaining.value > Duration.zero,
    )..addListener(_onIntegrity);
    unawaited(_integrity.load());
    session.submitState.addListener(_onReceived);
  }

  @override
  void dispose() {
    session.submitState.removeListener(_onReceived);
    _integrity
      ..removeListener(_onIntegrity)
      ..dispose();
    disposeHost();
    super.dispose();
  }

  @override
  void onLifecycleChange(AppLifecycleState state) {
    switch (state) {
      case AppLifecycleState.inactive:
        _integrity.onInactive();
      case AppLifecycleState.hidden || AppLifecycleState.paused:
        _integrity.onLeft();
      case AppLifecycleState.resumed:
        _integrity.onReturned();
      case AppLifecycleState.detached:
        break;
    }
  }

  void _onIntegrity() {
    if (!mounted) return;
    if (_integrity.strikes > _seenStrikes) {
      unawaited(ref.read(hapticsProvider).warn());
      // A warning earned while the submit page (or the palette) is over the paper: come back to
      // the paper so the warning card is seen, unless a submit is already under way.
      final route = ModalRoute.of(context);
      // The third warning comes back too: the ended card holds the submit page until it is read.
      if (route != null && !route.isCurrent && (_integrity.terminated || session.submitState.value.stage == SubmitStage.idle)) {
        Navigator.of(context).popUntil((r) => r == route);
      }
    }
    _seenStrikes = _integrity.strikes;
    setState(() {});
  }

  void _onReceived() {
    if (session.submitState.value.stage == SubmitStage.received) unawaited(_integrity.clear());
  }

  /// After the third warning the "Session ended" card stays until the student continues, so the
  /// reason is read before the submit page opens.
  @override
  bool get holdSubmitPage => _integrity.showing && _integrity.terminated;

  void _continueAfterEnd() {
    _integrity.acknowledgeEnded();
    // Idle here means the submit did not start; the page still opens, with its own Submit key.
    openSubmit();
  }

  bool get _canAnswer => session.canAnswer && !_integrity.locksAnswers;

  String get _qid => session.questions[session.currentIndex].id;

  void _markAndNext() {
    if (!_canAnswer) return;
    session.setMarked(_qid, true);
    if (session.currentIndex < session.questions.length - 1) goTo(session.currentIndex + 1);
  }

  /// The warning card (or the ended notice) is up: "Return to the exam" is the only live control.
  bool get _modalUp => _integrity.locksAnswers;

  Future<void> _confirmLeave() async {
    if (_modalUp || session.submitState.value.stage != SubmitStage.idle) return;
    unawaited(ref.read(hapticsProvider).warn());
    final nextStrike = _integrity.strikes + 1;
    final ends = nextStrike >= NtaRules.strikes;
    final leave = await showRunnerSheet<bool>(
      context: context,
      title: RunnerCopy.leaveTitle(true),
      builder: (sheetContext) => _NtaLeaveBody(
        text: ends ? NtaCopy.leaveEnds : NtaCopy.leaveBody(nextStrike, session.endsAt.toLocal()),
        leaveLabel: RunnerCopy.leaveKey(true),
      ),
    );
    if (leave != true || !mounted) return;
    _integrity.onLeft();
    // The third warning submits; the submit page takes over from here.
    if (!_integrity.terminated) context.go(AppRoutes.practice);
  }

  Future<void> _openPalette() async {
    if (_modalUp) return;
    final pick = await showNtaDrawer<int>(
      context: context,
      builder: (drawerContext) => ListenableBuilder(
        listenable: session,
        builder: (context, _) => NtaPalettePanel(
          cells: sheetCellsOf(session),
          subject: NtaCopy.subject(session.subject),
          candidate: ref.read(ntaCandidateNameProvider),
          onJump: (i) => Navigator.of(drawerContext).pop(i),
          onSubmit: () => Navigator.of(drawerContext).pop(-1),
          onQuestionPaper: () => Navigator.of(drawerContext).pop(-2),
          onClose: () => Navigator.of(drawerContext).pop(),
        ),
      ),
    );
    if (!mounted || pick == null) return;
    switch (pick) {
      case -1:
        session.dismissAway();
        openSubmit();
      case -2:
        await _openQuestionPaper();
      default:
        _jump(pick);
    }
  }

  Future<void> _openQuestionPaper() async {
    if (_modalUp) return;
    final pick = await showNtaQuestionPaper(
      context,
      subject: NtaCopy.subject(session.subject),
      questions: session.questions,
      cells: sheetCellsOf(session),
    );
    if (mounted && pick != null) _jump(pick);
  }

  void _jump(int i) {
    if (_modalUp) return;
    unawaited(ref.read(hapticsProvider).tick());
    goTo(i);
  }

  @override
  Widget build(BuildContext context) {
    watchNetwork();
    final textStep = ref.watch(ntaTextStepProvider);
    final candidate = ref.watch(ntaCandidateNameProvider);
    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) unawaited(_confirmLeave());
      },
      child: ListenableBuilder(
        listenable: session,
        builder: (context, _) => Stack(
          children: [
            Positioned.fill(
              child: NtaLayout(
                session: session,
                canAnswer: _canAnswer,
                modalUp: _modalUp,
                strikes: _integrity.strikes,
                textScale: NtaTextStep.scales[textStep],
                candidate: candidate,
                warning: timeWarning,
                actions: NtaActions(
                  onPalette: () => unawaited(_openPalette()),
                  onSelect: (qid, option) {
                    if (_canAnswer) unawaited(select(qid, option));
                  },
                  onMark: (qid, value) {
                    if (_canAnswer) session.setMarked(qid, value);
                  },
                  onMarkAndNext: _markAndNext,
                  onClear: () {
                    if (_canAnswer) unawaited(select(_qid, null));
                  },
                  onPrevious: () {
                    if (!_modalUp) previous();
                  },
                  onSaveAndNext: () {
                    if (!_modalUp) next();
                  },
                  onJump: _jump,
                  onSubmit: () {
                    if (_modalUp) return;
                    session.dismissAway();
                    openSubmit();
                  },
                  onQuestionPaper: () => unawaited(_openQuestionPaper()),
                  onTextStep: (d) => ref.read(ntaTextStepProvider.notifier).step(d),
                ),
              ),
            ),
            if (_integrity.showing)
              NtaWarningOverlay(integrity: _integrity, submitState: session.submitState, onContinue: _continueAfterEnd),
          ],
        ),
      ),
    );
  }
}

class _NtaLeaveBody extends StatelessWidget {
  const _NtaLeaveBody({required this.text, required this.leaveLabel});

  final String text;
  final String leaveLabel;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(text, style: context.mmType.body.copyWith(color: context.mmColors.ink2)),
        const SizedBox(height: MmSpace.s24),
        KeyButton(label: RunnerCopy.keepGoing, onPressed: () => Navigator.of(context).pop(false), hapticOnCommit: false, autofocus: true),
        const SizedBox(height: MmSpace.s12),
        KeyButton.secondary(label: leaveLabel, onPressed: () => Navigator.of(context).pop(true), hapticOnCommit: false),
      ],
    );
  }
}
