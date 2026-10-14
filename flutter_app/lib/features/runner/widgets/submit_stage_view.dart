import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/motion/motion.dart';
import '../../../core/sync/session/session_engine.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import 'runner_motion.dart';

/// The foot of the submit page: the keys and the stage, only ever from real calls (spec 5.5).
/// Sending runs from the tap until `POST /api/attempts` answers; Received appears only on its
/// 200; anything else keeps the answers on this phone and says so.
class SubmitStageView extends StatelessWidget {
  const SubmitStageView({
    super.key,
    required this.state,
    required this.isMock,
    required this.timedOut,
    required this.onSubmit,
    required this.onKeepWorking,
    required this.onOpenResult,
    required this.onGoToday,
    required this.onGoPractice,
    this.submitLabel,
    this.submitKey,
    this.note,
    this.arriveReceipt = false,
  });

  final SubmitUiState state;
  final bool isMock;
  final bool timedOut;
  final VoidCallback onSubmit;
  final VoidCallback onKeepWorking;
  final VoidCallback onOpenResult;
  final VoidCallback onGoToday;
  final VoidCallback onGoPractice;

  /// The submit key's words when the skin names it (NTA mode: "Submit test").
  final String? submitLabel;

  /// The skin's own submit key (NTA mode: the exam's green "Submit test"), in place of the volt one.
  final Widget? submitKey;

  /// One quiet line above the submit key ("You cannot change answers after you submit."), so the
  /// confirm reads as a single decision.
  final Widget? note;

  /// The receipt line slides in once the sheet has inked (the Night Sheet skin), instead of
  /// being there at once.
  final bool arriveReceipt;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: switch (state.stage) {
        SubmitStage.idle => [
          if (note != null) ...[note!, const SizedBox(height: MmSpace.s12)],
          submitKey ?? KeyButton(label: submitLabel ?? RunnerCopy.submitKey(isMock), onPressed: onSubmit),
          const SizedBox(height: MmSpace.s8),
          Center(
            child: KeyButton.quiet(label: RunnerCopy.keepWorking, onPressed: onKeepWorking, hapticOnCommit: false),
          ),
        ],
        SubmitStage.sending => [
          const KeyButton(label: RunnerCopy.sending, onPressed: null, loading: true, semanticsLabel: RunnerCopy.sending),
          const SizedBox(height: 56),
        ],
        SubmitStage.received => [
          _Arrive(
            enabled: arriveReceipt,
            child: _Receipt(at: state.received?.receivedAt ?? DateTime.now()),
          ),
          const SizedBox(height: MmSpace.s16),
          KeyButton(label: RunnerCopy.openResult(isMock), onPressed: onOpenResult, hapticOnCommit: false),
        ],
        SubmitStage.pending => [
          // One message, one icon: where the answers are, and what happens next.
          InlineBanner(message: timedOut ? RunnerCopy.timeUpPending : RunnerCopy.pendingBody, tone: BannerTone.warning),
          const SizedBox(height: MmSpace.s16),
          KeyButton(label: RunnerCopy.tryAgain, onPressed: onSubmit),
          const SizedBox(height: MmSpace.s8),
          Center(
            child: KeyButton.quiet(label: RunnerCopy.goToToday, onPressed: onGoToday, hapticOnCommit: false),
          ),
        ],
        SubmitStage.windowClosed => [
          InlineBanner(message: RunnerCopy.windowClosed(isMock), tone: BannerTone.error),
          const SizedBox(height: MmSpace.s16),
          KeyButton.secondary(label: RunnerCopy.goToToday, onPressed: onGoToday),
        ],
        SubmitStage.rejected => [
          InlineBanner(message: RunnerCopy.rejected(isMock), tone: BannerTone.error),
          const SizedBox(height: MmSpace.s16),
          KeyButton.secondary(label: RunnerCopy.goToPractice, onPressed: onGoPractice),
        ],
      },
    );
  }
}

/// Slides a child up 12 dp and fades it in (260 ms, glide) once the sheet has inked: the receipt
/// is the last thing to land. Under reduced motion it is there at once.
class _Arrive extends StatefulWidget {
  const _Arrive({required this.enabled, required this.child});

  final bool enabled;
  final Widget child;

  @override
  State<_Arrive> createState() => _ArriveState();
}

class _ArriveState extends State<_Arrive> with SingleTickerProviderStateMixin {
  static const Duration _delay = Duration(milliseconds: 520);
  static const Duration _run = Duration(milliseconds: 260);

  late final AnimationController _controller = AnimationController(vsync: this, duration: _delay + _run);
  bool _started = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_started) return;
    _started = true;
    if (!widget.enabled || RunnerMotion.reduced(context)) {
      _controller.value = 1;
    } else {
      _controller.forward();
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final interval = Interval(_delay.inMicroseconds / (_delay + _run).inMicroseconds, 1, curve: Motion.glide);
    return AnimatedBuilder(
      animation: _controller,
      child: widget.child,
      builder: (context, child) {
        final t = interval.transform(_controller.value);
        return Opacity(
          opacity: t,
          alwaysIncludeSemantics: true,
          child: Transform.translate(offset: Offset(0, 12 * (1 - t)), child: child),
        );
      },
    );
  }
}

/// "Answers received. Saved on the server at 10:42 PM." with the inked, checked bubble that
/// means the server has it.
class _Receipt extends StatelessWidget {
  const _Receipt({required this.at});

  final DateTime at;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return Semantics(
      container: true,
      liveRegion: true,
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox.square(
            dimension: 24,
            child: Stack(
              alignment: Alignment.center,
              children: [
                const Bubble(state: BubbleState.filled, size: 22),
                Icon(LucideIcons.check, size: 13, color: colors.voltInk),
              ],
            ),
          ),
          const SizedBox(width: MmSpace.s12),
          Expanded(
            child: Text(RunnerCopy.received(at), style: type.body.copyWith(color: colors.ink)),
          ),
        ],
      ),
    );
  }
}
