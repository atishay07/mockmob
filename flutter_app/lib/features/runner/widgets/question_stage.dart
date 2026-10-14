import 'package:flutter/material.dart';

import '../../../core/haptics/haptics.dart';
import '../../../core/motion/motion.dart';
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
///
/// With [onSwipe] the question follows a sideways finger (the drag-commit policy of
/// [MmDragCommit]: it claims only a drag clearly sideways, so a long question and the passage well
/// still scroll). Past [commitDistance] or on a 700 dp/s fling it commits: the question just left
/// carries on from where the finger let go while it fades, and the next one arrives. A side with
/// nothing there rubber-bands; past the last question the swipe still commits (the host opens the
/// submit page) and the question springs home. Under reduced motion the finger is still followed,
/// and a commit is an instant swap.
class QuestionStage extends StatefulWidget {
  const QuestionStage({super.key, required this.index, required this.layer, this.onSwipe, this.hasPrevious = true, this.hasNext = true});

  /// The question on show.
  final int index;

  /// Builds the layer for question [at]; [ghost] is true for the leaving picture.
  final Widget Function(int at, {required bool ghost}) layer;

  /// A committed swipe: 1 for the next question (a swipe to the left), -1 for the previous one.
  final ValueChanged<int>? onSwipe;

  /// Whether there is a question before this one (no: a swipe to the right rubber-bands).
  final bool hasPrevious;

  /// Whether there is a question after this one (no: the swipe rubber-bands, yet still commits to
  /// the submit page).
  final bool hasNext;

  /// A swipe commits past this many dp (or on a fling).
  static const double commitDistance = 72;

  @override
  State<QuestionStage> createState() => _QuestionStageState();
}

class _QuestionStageState extends State<QuestionStage> with TickerProviderStateMixin {
  late final AnimationController _fade;

  /// The question on show, under the finger.
  late final AnimationController _x = AnimationController.unbounded(vsync: this);

  /// The leaving picture: still for a tap, carrying on from the finger after a swipe.
  late final AnimationController _ghostX = AnimationController.unbounded(vsync: this);

  late final Animation<double> _ghostOpacity = _fade
      .drive(CurveTween(curve: Interval(RunnerMotion.ghostHold.inMicroseconds / RunnerMotion.crossFade.inMicroseconds, 1)))
      .drive(Tween<double>(begin: 1, end: 0));

  // Each layer is keyed by a serial that never repeats, not by its question: going 1, 2, 1 must
  // arrive afresh, never reuse the layer that is still fading out.
  int _serial = 0;
  late int _current = _serial;
  int? _leaving;
  late int _leavingIndex = widget.index;

  // The swipe.
  double _raw = 0;
  bool _past = false;

  /// The offset and speed a committed swipe let go at, handed to the leaving picture.
  (double, double)? _handoff;

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
    final handoff = _handoff;
    _handoff = null;
    if (RunnerMotion.reduced(context)) {
      _leaving = null;
      _ghostX.value = 0;
    } else {
      _leaving = _current;
      _leavingIndex = old.index;
      _fade.forward(from: 0);
      if (handoff == null) {
        _ghostX.value = 0;
      } else {
        // The question just left keeps going the way the finger threw it, while it fades.
        final (from, velocity) = handoff;
        final away = (from == 0 ? velocity.sign : from.sign) * _width;
        _ghostX.value = from;
        _ghostX.animateWith(Motion.spring(Springs.lift, from, away, velocity: velocity));
      }
    }
    _x.stop();
    _x.value = 0;
    _past = false;
    _current = ++_serial;
  }

  @override
  void dispose() {
    _fade.dispose();
    _x.dispose();
    _ghostX.dispose();
    super.dispose();
  }

  /// The stage's width, measured when a drag starts (never during a build).
  double _width = 360;

  void _home({double velocity = 0}) {
    _past = false;
    if (_x.value == 0) return;
    if (Motion.reduced(context)) {
      _x.value = 0;
    } else {
      _x.animateWith(Motion.spring(Springs.smooth, _x.value, 0, velocity: velocity));
    }
  }

  void _down() {
    if (_x.isAnimating) _x.stop();
  }

  void _idle() {
    if (mounted) _home();
  }

  void _start() {
    _x.stop();
    _raw = _x.value;
    final size = context.size;
    if (size != null && size.width > 0) _width = size.width;
  }

  /// The travel a commit is judged on: the question's own offset, except past the last question,
  /// where the question rubber-bands but the finger's own travel still opens the submit page.
  double get _travel => !widget.hasNext && _raw < 0 ? _raw : _x.value;

  void _update(double dx) {
    _raw += dx;
    final next = MmDragPolicy.follow(_raw, left: widget.hasNext, right: widget.hasPrevious, maxTravel: _width);
    _x.value = next;
    final travel = _travel;
    final past = travel.abs() >= QuestionStage.commitDistance && (travel < 0 || widget.hasPrevious);
    if (past != _past) {
      _past = past;
      hapticsOf(context)?.selection();
    }
  }

  void _end(double velocity) {
    final onSwipe = widget.onSwipe;
    final side = onSwipe == null
        ? null
        : MmDragPolicy.commits(_travel, velocity, distance: QuestionStage.commitDistance, left: true, right: widget.hasPrevious);
    if (side == null) {
      _home(velocity: velocity);
      return;
    }
    _past = false;
    _handoff = (_x.value, velocity);
    final index = widget.index;
    onSwipe!(side == MmDragSide.left ? 1 : -1);
    // Past the last question the host opens the submit page and the question stays: it springs home.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted || widget.index != index) return;
      _handoff = null;
      _home(velocity: velocity);
    });
  }

  @override
  Widget build(BuildContext context) {
    final leaving = _leaving;
    final stack = Stack(
      fit: StackFit.expand,
      children: [
        if (leaving != null)
          _Layer(
            key: ValueKey<int>(leaving),
            fade: _ghostOpacity,
            offset: _ghostX,
            ghost: true,
            child: widget.layer(_leavingIndex, ghost: true),
          ),
        _Layer(
          key: ValueKey<int>(_current),
          fade: kAlwaysCompleteAnimation,
          offset: _x,
          ghost: false,
          child: widget.layer(widget.index, ghost: false),
        ),
      ],
    );
    if (widget.onSwipe == null) return stack;
    return RawGestureDetector(
      behavior: HitTestBehavior.translucent,
      gestures: {
        MmSidewaysDragRecognizer: GestureRecognizerFactoryWithHandlers<MmSidewaysDragRecognizer>(
          () => MmSidewaysDragRecognizer(debugOwner: this),
          (r) => r
            ..onDown = _down
            ..onIdle = _idle
            ..onStart = _start
            ..onUpdate = _update
            ..onEnd = _end
            ..onCancel = () => _home(),
        ),
      },
      child: stack,
    );
  }
}

/// One layer of the stage. The structure is the same for the arriving and the leaving layer (only
/// values differ), so a layer that turns from arriving into leaving keeps its state.
class _Layer extends StatelessWidget {
  const _Layer({super.key, required this.fade, required this.offset, required this.ghost, required this.child});

  final Animation<double> fade;

  /// The sideways offset in dp (a finger, or the leaving picture carrying on).
  final Animation<double> offset;
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
              child: AnimatedBuilder(
                animation: offset,
                builder: (context, child) => Transform.translate(offset: Offset(offset.value, 0), child: child),
                child: RepaintBoundary(child: child),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
