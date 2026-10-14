import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/haptics/haptics.dart';
import '../../../core/router/routes.dart';
import '../../../core/sync/session/session_engine.dart';
import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import '../data/runner_effects.dart';
import '../data/runner_session.dart';
import '../nta/nta_action_bar.dart';
import '../nta/nta_copy.dart';
import '../nta/nta_header.dart';
import '../nta/nta_submit_summary.dart';
import '../widgets/answer_sheet_view.dart';
import '../widgets/runner_controls.dart';
import '../widgets/runner_motion.dart';
import '../widgets/runner_top_bar.dart';
import '../widgets/submit_sheet_card.dart';
import '../widgets/submit_stage_view.dart';

/// `/run/:sessionId/submit`: handing in the sheet (spec 5.5, Submit). The student sees the
/// whole sheet once more, then the stages of the real call. Received hands off to the sealed
/// sheet (full and NTA-style) or the practice result.
class SubmitPage extends ConsumerStatefulWidget {
  const SubmitPage({super.key, required this.session});

  final RunnerSession session;

  /// How long "Answers received. Saved on the server at ..." stays before the result opens: long
  /// enough to read the line, and for a tap on "See your answers" (or "Open your sheet") to land
  /// before it goes by itself.
  static const Duration handOffDelay = Duration(milliseconds: 2800);

  @override
  ConsumerState<SubmitPage> createState() => _SubmitPageState();
}

class _SubmitPageState extends ConsumerState<SubmitPage> {
  RunnerSession get _s => widget.session;
  Timer? _handOff;
  bool _left = false;

  @override
  void initState() {
    super.initState();
    _s.submitState.addListener(_onStage);
    // Arriving after the stage already moved (time up, a retry on open).
    WidgetsBinding.instance.addPostFrameCallback((_) => _onStage());
  }

  @override
  void dispose() {
    _handOff?.cancel();
    _s.submitState.removeListener(_onStage);
    super.dispose();
  }

  void _onStage() {
    if (!mounted || _left) return;
    final state = _s.submitState.value;
    if (state.stage != SubmitStage.received || _handOff != null) return;
    // The server has the answers: the success pattern, the follow-up reads, then the result.
    unawaited(ref.read(hapticsProvider).success());
    ref.read(runnerAfterSubmitProvider)(_s);
    _handOff = Timer(SubmitPage.handOffDelay, _openResult);
  }

  void _openResult() {
    final received = _s.submitState.value.received;
    if (!mounted || _left || received == null) return;
    _left = true;
    _handOff?.cancel();
    final id = received.attemptId.isNotEmpty ? received.attemptId : _s.sessionId;
    context.go(resultRouteFor(isMock: _s.isMock, attemptId: id));
  }

  void _go(String location) {
    if (_left) return;
    _left = true;
    context.go(location);
  }

  void _keepWorking() {
    if (_s.submitState.value.stage == SubmitStage.idle) Navigator.of(context).maybePop();
  }

  /// A count on the sheet card takes the student back to the first question it counts.
  void _goToQuestion(int index) {
    if (_s.submitState.value.stage != SubmitStage.idle) return;
    unawaited(_s.goTo(index));
    _keepWorking();
  }

  static SheetPhase _phaseOf(SubmitStage stage) => switch (stage) {
    SubmitStage.idle => SheetPhase.review,
    SubmitStage.sending => SheetPhase.sending,
    SubmitStage.received => SheetPhase.inked,
    SubmitStage.pending || SubmitStage.windowClosed || SubmitStage.rejected => SheetPhase.held,
  };

  void _onBack() {
    switch (_s.submitState.value.stage) {
      case SubmitStage.idle:
        Navigator.of(context).pop();
      case SubmitStage.sending:
      case SubmitStage.received:
        // The call decides; back cannot interrupt it.
        break;
      case SubmitStage.pending:
      case SubmitStage.windowClosed:
        _go(AppRoutes.today);
      case SubmitStage.rejected:
        _go(AppRoutes.practice);
    }
  }

  static String _titleFor(SubmitStage stage, {required bool timeUp}) => switch (stage) {
    SubmitStage.idle => timeUp ? RunnerCopy.timeUpTitle : RunnerCopy.submitTitle,
    SubmitStage.sending => timeUp ? RunnerCopy.timeUpTitle : RunnerCopy.sendingTitle,
    SubmitStage.received => RunnerCopy.receivedTitle,
    SubmitStage.pending => timeUp ? RunnerCopy.timeUpTitle : RunnerCopy.pendingTitle,
    SubmitStage.windowClosed || SubmitStage.rejected => RunnerCopy.notRecordedTitle,
  };

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final padding = MediaQuery.viewPaddingOf(context);
    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) _onBack();
      },
      child: ColoredBox(
        color: colors.ground,
        child: ValueListenableBuilder<SubmitUiState>(
          valueListenable: _s.submitState,
          builder: (context, state, _) {
            final idle = state.stage == SubmitStage.idle;
            final timeUp = _s.endedByTimeUp;
            final nta = _s.mode == 'nta';
            final page = Padding(
              padding: EdgeInsets.only(top: nta ? 0 : padding.top),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  if (nta)
                    NtaBar(
                      subject: NtaCopy.subject(_s.subject),
                      leading: idle
                          ? NtaBarKey(icon: LucideIcons.arrowLeft, semanticsLabel: RunnerCopy.keepWorking, onTap: _keepWorking)
                          : null,
                      trailing: [if (idle) NtaTimerChip(remaining: _s.remaining)],
                    )
                  else
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: MmSpace.gutter),
                      child: SizedBox(
                        height: 60,
                        child: Row(
                          children: [
                            if (idle)
                              RoundIconKey(icon: LucideIcons.arrowLeft, semanticsLabel: RunnerCopy.keepWorking, onTap: _keepWorking),
                            const Spacer(),
                            if (idle && _s.isMock)
                              RunnerTimer(remaining: _s.remaining, style: type.figureCompact.copyWith(fontSize: 30, height: 1)),
                          ],
                        ),
                      ),
                    ),
                  Expanded(
                    child: SingleChildScrollView(
                      padding: EdgeInsets.fromLTRB(MmSpace.gutter, nta ? MmSpace.s20 : MmSpace.s8, MmSpace.gutter, MmSpace.s24),
                      // One authored entrance: the title, then the sheet (never in NTA mode, which keeps
                      // its exam skin still). The key at the foot is never part of it.
                      child: MmStagger(
                        enabled: !nta,
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            MmStaggerItem(
                              index: 0,
                              child: Semantics(
                                header: true,
                                child: Text(
                                  nta && idle && !timeUp ? NtaCopy.submitTitle : _titleFor(state.stage, timeUp: timeUp),
                                  style: type.headline,
                                ),
                              ),
                            ),
                            SizedBox(height: nta ? MmSpace.s12 : MmRhythm.group),
                            MmStaggerItem(
                              index: 1,
                              child: ListenableBuilder(
                                listenable: _s,
                                builder: (context, _) => nta
                                    ? NtaSubmitSummary(session: _s, showConfirm: idle)
                                    : SubmitSheetCard(
                                        session: _s,
                                        lit: state.stage.index <= SubmitStage.received.index,
                                        phase: _phaseOf(state.stage),
                                        onGoTo: idle ? _goToQuestion : null,
                                      ),
                              ),
                            ),
                            if (idle && nta) ...[
                              const SizedBox(height: MmSpace.s16),
                              Text(RunnerCopy.cannotChange, style: type.body.copyWith(color: colors.ink2)),
                            ],
                            // Mobi is there for the hand-in only, once the server holds the sheet.
                            if (!nta && state.stage == SubmitStage.received) const _HandInMobi(),
                          ],
                        ),
                      ),
                    ),
                  ),
                  Padding(
                    padding: EdgeInsets.fromLTRB(MmSpace.gutter, MmSpace.s8, MmSpace.gutter, MmSpace.s16 + padding.bottom),
                    child: SubmitStageView(
                      state: state,
                      isMock: _s.isMock,
                      timedOut: timeUp,
                      onSubmit: () => unawaited(_s.submit()),
                      onKeepWorking: _keepWorking,
                      onOpenResult: _openResult,
                      onGoToday: () => _go(AppRoutes.today),
                      onGoPractice: () => _go(AppRoutes.practice),
                      submitLabel: nta ? NtaCopy.submitTestShort : null,
                      arriveReceipt: !nta,
                      note: nta
                          ? null
                          : Text(
                              RunnerCopy.cannotChange,
                              style: type.body.copyWith(color: colors.ink2),
                              textAlign: TextAlign.center,
                            ),
                      submitKey: nta
                          ? SizedBox(
                              height: 52,
                              child: NtaKey(
                                label: NtaCopy.submitTestShort,
                                tone: NtaKeyTone.green,
                                onPressed: () => unawaited(_s.submit()),
                              ),
                            )
                          : null,
                    ),
                  ),
                ],
              ),
            );
            return Stack(
              children: [
                // The desk lamp comes up once the server has the sheet: the first warm light
                // after the work layer, leading into the result.
                Positioned.fill(
                  child: IgnorePointer(child: _ReceivedLamp(on: state.stage == SubmitStage.received)),
                ),
                page,
              ],
            );
          },
        ),
      ),
    );
  }
}

/// Mobi under the inked sheet: it waits in a fixed slot while the bubbles ink in order, then hops
/// once for the hand-in (a living vector Mobi playing its cheer). The slot is reserved from the
/// moment the sheet is received, with the same air above and below, so the page never shifts when
/// Mobi lands. It says nothing and is never about the student's marks. Present only on the
/// received stage.
class _HandInMobi extends StatefulWidget {
  const _HandInMobi();

  /// Mobi's own height and the air above and below it.
  static const double size = 104;
  static const double air = 28;

  @override
  State<_HandInMobi> createState() => _HandInMobiState();
}

class _HandInMobiState extends State<_HandInMobi> {
  Timer? _timer;
  bool _landed = false;
  bool _started = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_started) return;
    _started = true;
    if (Motion.reduced(context)) {
      _landed = true;
    } else {
      // The last bubble inks as the sheet finishes; Mobi hops as it does.
      _timer = Timer(RunnerMotion.inkInOrder, () {
        if (mounted) setState(() => _landed = true);
      });
    }
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(top: MmSpace.s8),
      child: SizedBox(
        height: _HandInMobi.size + 2 * _HandInMobi.air,
        child: Center(
          child: _landed ? const Mobi(pose: MobiPose.cheer, size: _HandInMobi.size) : const SizedBox.shrink(),
        ),
      ),
    );
  }
}

class _ReceivedLamp extends StatelessWidget {
  const _ReceivedLamp({required this.on});

  final bool on;

  @override
  Widget build(BuildContext context) {
    return AnimatedOpacity(
      opacity: on ? 1 : 0,
      duration: Motion.of(context, Motion.sweep),
      curve: Motion.glide,
      child: const LampScene(vignette: false),
    );
  }
}
