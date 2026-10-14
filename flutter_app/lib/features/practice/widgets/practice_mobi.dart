import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';

import '../../../core/motion/motion.dart';
import '../../../core/widgets/widgets.dart';

/// The resident Mobi of the Practice tab: 44 dp in the header's trailing slot. He says nothing
/// here (no bubble on this tab); he reacts. He arrives (a wave the first time today, sleepy or
/// asleep late at night, otherwise simply there), looks at the subject tile just tapped, thinks
/// while the quotes load, nudges once toward the hero's Start after [nudgeAfter] with no touch and
/// no scroll (once per visit to the tab), and answers a tap with the next move of his
/// [tapCycle]. Under reduced motion he holds a still pose (the character handles that itself).
///
/// The screen owns [controller] so it can send the looks and the loading state; this widget owns
/// the quiet clock and the tap.
class PracticeMobi extends StatefulWidget {
  const PracticeMobi({super.key, required this.controller, required this.entrance, required this.loading, this.aim});

  final MobiController controller;

  /// The act he arrives with ([MobiRation.greeting]), decided once by the screen.
  final MobiAct entrance;

  /// The modes' quotes have no answer yet: he thinks (after a beat, so a fast answer never shows it).
  final bool loading;

  /// The hero's Start: where he nudges.
  final GlobalKey? aim;

  static const double size = 44;

  /// How long he waits, with no touch and no scroll, before the nudge.
  static const Duration nudgeAfter = MobiRation.nudgeAfter;

  /// A short pause before he thinks, so a quote that answers at once never shows it.
  static const Duration loadingAfter = Duration(milliseconds: 400);

  @visibleForTesting
  static VoidCallback? debugOnNudge;

  @override
  State<PracticeMobi> createState() => _PracticeMobiState();
}

class _PracticeMobiState extends State<PracticeMobi> {
  Timer? _nudge;
  Timer? _think;
  Timer? _release;
  bool _listening = false;
  bool _nudgedThisVisit = false;
  bool _onScreen = false;
  bool _thinking = false;
  ScrollPosition? _position;

  @override
  void initState() {
    super.initState();
    if (widget.loading) _scheduleThink();
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final onScreen = TickerMode.valuesOf(context).enabled;
    if (onScreen != _onScreen) {
      _onScreen = onScreen;
      if (onScreen) {
        _armNudge();
      } else {
        // Left the tab: the next visit gets its own nudge.
        _nudgedThisVisit = false;
        _cancelNudge();
      }
    }
    final position = Scrollable.maybeOf(context)?.position;
    if (position != _position) {
      _position?.removeListener(_onScrolled);
      _position = position;
      if (_listening) _position?.addListener(_onScrolled);
    }
  }

  @override
  void didUpdateWidget(PracticeMobi old) {
    super.didUpdateWidget(old);
    if (old.loading != widget.loading) {
      if (widget.loading) {
        _scheduleThink();
      } else {
        _think?.cancel();
        if (_thinking) {
          _thinking = false;
          widget.controller.play(MobiAct.correct);
        }
      }
    }
  }

  @override
  void dispose() {
    _cancelNudge();
    _think?.cancel();
    _release?.cancel();
    super.dispose();
  }

  void _scheduleThink() {
    _think?.cancel();
    _think = Timer(PracticeMobi.loadingAfter, () {
      if (!mounted || !widget.loading) return;
      _thinking = true;
      widget.controller.play(MobiAct.loading);
    });
  }

  void _armNudge() {
    if (_nudgedThisVisit || _listening || Motion.reduced(context)) return;
    _listening = true;
    GestureBinding.instance.pointerRouter.addGlobalRoute(_onPointer);
    _position?.addListener(_onScrolled);
    _nudge?.cancel();
    _nudge = Timer(PracticeMobi.nudgeAfter, _nudgeNow);
  }

  /// Any touch or scroll restarts the quiet: he nudges only when the student has been still.
  void _restart() {
    if (!_listening) return;
    _nudge?.cancel();
    _nudge = Timer(PracticeMobi.nudgeAfter, _nudgeNow);
  }

  void _onScrolled() => _restart();

  void _onPointer(PointerEvent event) {
    if (event is PointerDownEvent) _restart();
  }

  void _cancelNudge() {
    _nudge?.cancel();
    if (_listening) {
      _listening = false;
      _position?.removeListener(_onScrolled);
      GestureBinding.instance.pointerRouter.removeGlobalRoute(_onPointer);
    }
  }

  void _nudgeNow() {
    if (!mounted || !_onScreen) return;
    // Thinking about the quotes: he waits for them, then the nudge comes on the next quiet.
    if (widget.loading) {
      _restart();
      return;
    }
    _cancelNudge();
    _nudgedThisVisit = true;
    _pointAtStart();
    widget.controller.play(MobiAct.nudge);
    PracticeMobi.debugOnNudge?.call();
    _releaseAfter(const Duration(milliseconds: 3200));
  }

  void _pointAtStart() {
    final key = widget.aim;
    if (key != null) widget.controller.pointAtWidget(key);
  }

  /// He lets go of a held point after a while, and looks ahead again.
  void _releaseAfter(Duration d) {
    _release?.cancel();
    _release = Timer(d, () {
      if (!mounted) return;
      widget.controller.lookAt(null);
      widget.controller.play(MobiAct.idle);
    });
  }

  @override
  Widget build(BuildContext context) {
    final width = MobiFigure.widthFor(PracticeMobi.size);
    // A tap plays the next act of the standard cycle (a wave, a tilt, a nod, a start): Mobi
    // answers with his body, never a line. His own tap handling gives the haptic and TalkBack's
    // button. He does not glance at every tap on the page: the screen aims him on purpose.
    return SizedBox(
      width: math.max(width, 48),
      height: math.max(PracticeMobi.size, 48),
      child: Align(
        alignment: Alignment.bottomRight,
        child: MobiCharacter(
          controller: widget.controller,
          size: PracticeMobi.size,
          entrance: widget.entrance,
          seed: 41,
          interactive: true,
          semanticLabel: 'Mobi',
          watchTaps: false,
          tapCycle: MobiTapCycle.standard,
        ),
      ),
    );
  }
}
