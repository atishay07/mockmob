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
import '../../rhythm/rhythm.dart' show CelebrationMode, celebrationModeProvider;
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
    // The server has the answers: the success pattern, the follow-up reads, then the result. The
    // Celebrations setting Off is words only, so the buzz goes with the rest of the moment.
    if (ref.read(celebrationModeProvider) != CelebrationMode.off) unawaited(ref.read(hapticsProvider).success());
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
    // Celebrations (MOTION.md 1.2): Full keeps the ink and Mobi's hop, Quiet keeps the ink and the
    // words, Off shows the end state and the words.
    final celebrations = ref.watch(celebrationModeProvider);
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
                    child: _Body(
                      // The exam skin keeps its top-stacked page. The Night Sheet page is a moment
                      // (SPACING.md 7): its block rests at the optical centre, so no dead band opens
                      // above the keys, and it scrolls when the sheet is taller than the room.
                      centred: !nta,
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
                                        animateInk: celebrations != CelebrationMode.off,
                                        onGoTo: idle ? _goToQuestion : null,
                                      ),
                              ),
                            ),
                            if (idle && nta) ...[
                              const SizedBox(height: MmSpace.s16),
                              Text(RunnerCopy.cannotChange, style: type.body.copyWith(color: colors.ink2)),
                            ],
                            // Mobi is there for the hand-in only, once the server holds the sheet. His
                            // slot is held from the first stage, so the centred block never shifts when
                            // he lands.
                            if (!nta && celebrations == CelebrationMode.full) _HandInMobi(active: state.stage == SubmitStage.received),
                          ],
                        ),
                      ),
                    ),
                  ),
                  Padding(
                    padding: EdgeInsets.fromLTRB(MmSpace.gutter, MmSpace.s8, MmSpace.gutter, MmSpace.s16 + padding.bottom),
                    // The band keeps the height of its tallest stage, so the centred block above it holds
                    // still when the keys change (confirm, sending, received).
                    child: _HoldHeight(
                      hold: !nta,
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
                      arriveReceipt: !nta && celebrations != CelebrationMode.off,
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
                  ),
                ],
              ),
            );
            return page;
          },
        ),
      ),
    );
  }
}

/// Mobi under the inked sheet: it waits in a fixed slot while the bubbles ink in order, then hops
/// once for the hand-in (a living vector Mobi playing its cheer). The slot is held from the first
/// stage, with the same air above and below, so the centred page never shifts when Mobi lands. It
/// says nothing and is never about the student's marks. He appears only once the sheet is received.
class _HandInMobi extends StatefulWidget {
  const _HandInMobi({required this.active});

  /// The server holds the sheet: Mobi lands. Until then only his slot is held.
  final bool active;

  /// Mobi's own height and the air above and below it.
  static const double size = 128;
  static const double air = 20;

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
    _start();
  }

  @override
  void didUpdateWidget(_HandInMobi old) {
    super.didUpdateWidget(old);
    _start();
  }

  void _start() {
    if (_started || !widget.active) return;
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
    final colors = context.mmColors;
    return Padding(
      padding: const EdgeInsets.only(top: MmSpace.s8),
      child: SizedBox(
        height: _HandInMobi.size + 2 * _HandInMobi.air,
        child: Center(
          child: _landed
              // At Night a pool of volt light under Mobi (the one warm light of the page), so its dark
              // feet and antenna read against the near-black ground. Daylight has no glows
              // (MOTION.md 1.4): Mobi reads on the paper as he is.
              ? Stack(
                  alignment: Alignment.center,
                  clipBehavior: Clip.none,
                  children: [
                    if (colors.isNight)
                      ExcludeSemantics(
                        child: SizedBox.square(
                          dimension: _HandInMobi.size * 1.9,
                          child: DecoratedBox(
                            decoration: BoxDecoration(
                              shape: BoxShape.circle,
                              gradient: RadialGradient(colors: [colors.volt.withValues(alpha: 0.16), colors.volt.withValues(alpha: 0)]),
                            ),
                          ),
                        ),
                      ),
                    const Mobi(pose: MobiPose.cheer, size: _HandInMobi.size),
                  ],
                )
              : const SizedBox.shrink(),
        ),
      ),
    );
  }
}

/// The scrolling body of the submit page. [centred] lays the content block out as a moment
/// (SPACING.md 7): it rests at the optical centre of the room above the keys (the air above and below
/// in the ratio 2 to 3), and scrolls from the top when the block is taller than the room.
class _Body extends StatelessWidget {
  const _Body({required this.centred, required this.padding, required this.child});

  final bool centred;
  final EdgeInsets padding;
  final Widget child;

  /// Flex 2 above and 3 below the block puts its centre at 40% of the free height.
  static const Alignment optical = Alignment(0, -0.2);

  @override
  Widget build(BuildContext context) {
    if (!centred) return SingleChildScrollView(padding: padding, child: child);
    return LayoutBuilder(
      builder: (context, box) => SingleChildScrollView(
        physics: const ClampingScrollPhysics(),
        padding: padding,
        child: ConstrainedBox(
          constraints: BoxConstraints(minHeight: (box.maxHeight - padding.vertical).clamp(0.0, double.infinity)),
          child: Align(alignment: optical, child: child),
        ),
      ),
    );
  }
}

/// Keeps its child at least as tall as the tallest it has been ([hold]), top aligned. The submit
/// keys change with the stage and the page above centres in what is left, so without this the
/// whole block would step when the stage did.
class _HoldHeight extends StatefulWidget {
  const _HoldHeight({required this.hold, required this.child});

  final bool hold;
  final Widget child;

  @override
  State<_HoldHeight> createState() => _HoldHeightState();
}

class _HoldHeightState extends State<_HoldHeight> {
  final GlobalKey _inner = GlobalKey();
  double _held = 0;

  void _measure() {
    final box = _inner.currentContext?.findRenderObject();
    if (!mounted || box is! RenderBox || !box.hasSize) return;
    if (box.size.height > _held + 0.5) setState(() => _held = box.size.height);
  }

  @override
  Widget build(BuildContext context) {
    if (!widget.hold) return widget.child;
    WidgetsBinding.instance.addPostFrameCallback((_) => _measure());
    return ConstrainedBox(
      constraints: BoxConstraints(minHeight: _held),
      child: Align(alignment: Alignment.topCenter, child: KeyedSubtree(key: _inner, child: widget.child)),
    );
  }
}
