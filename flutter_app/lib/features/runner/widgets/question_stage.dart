import 'package:flutter/material.dart';

import 'runner_motion.dart';

/// Shows the current question and, for a moment after a switch, the one that was just left under
/// it (MOTION.md 1.1, finding 7). The leaving one stays as a still picture at full opacity until the
/// arriving question's text is half visible ([RunnerMotion.ghostHold]), then fades out over
/// [RunnerMotion.ghostFade]; the arriving text starts at 0.35, so the two texts together never drop
/// below 0.7 and a switch is never a blank frame. Each layer paints in its own RepaintBoundary.
///
/// Nothing queues and nothing blocks. The leaving layer takes no touches and is hidden from screen
/// readers, so a tap during the switch lands on the arriving question; a second switch while the
/// first is fading drops the older picture and the question just left takes its place. Every
/// layer has its own key, so the arriving question's entrance (its own controller) is never
/// replayed and never shared. Under reduced motion the question is simply swapped.
class QuestionStage extends StatefulWidget {
  const QuestionStage({super.key, required this.index, required this.layer});

  /// The question on show.
  final int index;

  /// Builds the layer for question [at]; [ghost] is true for the leaving picture.
  final Widget Function(int at, {required bool ghost}) layer;

  @override
  State<QuestionStage> createState() => _QuestionStageState();
}

class _QuestionStageState extends State<QuestionStage> with SingleTickerProviderStateMixin {
  late final AnimationController _fade;

  late final Animation<double> _ghostOpacity = _fade
      .drive(CurveTween(curve: Interval(RunnerMotion.ghostHold.inMicroseconds / RunnerMotion.crossFade.inMicroseconds, 1)))
      .drive(Tween<double>(begin: 1, end: 0));

  // Each layer is keyed by a serial that never repeats, not by its question: going 1, 2, 1 must
  // arrive afresh, never reuse the layer that is still fading out.
  int _serial = 0;
  late int _current = _serial;
  int? _leaving;
  late int _leavingIndex = widget.index;

  @override
  void initState() {
    super.initState();
    _fade = AnimationController(vsync: this, duration: RunnerMotion.crossFade)
      ..addStatusListener((status) {
        if (status == AnimationStatus.completed && mounted) setState(() => _leaving = null);
      });
  }

  @override
  void didUpdateWidget(QuestionStage old) {
    super.didUpdateWidget(old);
    if (old.index == widget.index) return;
    if (RunnerMotion.reduced(context)) {
      _leaving = null;
    } else {
      _leaving = _current;
      _leavingIndex = old.index;
      _fade.forward(from: 0);
    }
    _current = ++_serial;
  }

  @override
  void dispose() {
    _fade.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final leaving = _leaving;
    return Stack(
      fit: StackFit.expand,
      children: [
        if (leaving != null)
          _Layer(key: ValueKey<int>(leaving), fade: _ghostOpacity, ghost: true, child: widget.layer(_leavingIndex, ghost: true)),
        _Layer(key: ValueKey<int>(_current), fade: kAlwaysCompleteAnimation, ghost: false, child: widget.layer(widget.index, ghost: false)),
      ],
    );
  }
}

/// One layer of the stage. The structure is the same for the arriving and the leaving layer (only
/// values differ), so a layer that turns from arriving into leaving keeps its state.
class _Layer extends StatelessWidget {
  const _Layer({super.key, required this.fade, required this.ghost, required this.child});

  final Animation<double> fade;
  final bool ghost;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return IgnorePointer(
      ignoring: ghost,
      child: ExcludeSemantics(
        excluding: ghost,
        // The leaving picture's scroll metrics are not the question on show: the foot fade
        // listens to the arriving layer only.
        child: NotificationListener<ScrollMetricsNotification>(
          onNotification: (_) => ghost,
          child: NotificationListener<ScrollNotification>(
            onNotification: (_) => ghost,
            child: FadeTransition(
              opacity: fade,
              child: RepaintBoundary(child: child),
            ),
          ),
        ),
      ),
    );
  }
}
