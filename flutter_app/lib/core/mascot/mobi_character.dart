import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/scheduler.dart';
import 'package:flutter/widgets.dart';

import '../motion/motion.dart';
import '../theme/theme.dart';
import 'mobi_acts.dart';
import 'mobi_controller.dart';
import 'mobi_figure.dart';
import 'mobi_geometry.dart';
import 'mobi_painter.dart';
import 'mobi_palette.dart';
import 'mobi_rig.dart';
import 'mobi_sim.dart';

/// The living Mobi: a vector character that breathes, blinks, sways its antenna and plays acts.
///
/// It plays [entrance] when it appears, then idles. Drive it through [controller]. Under reduced
/// motion it holds a still pose (the entrance's key pose) and never ticks. One RepaintBoundary;
/// each frame only repaints the painter (no rebuilds), and while idle between beats it does not
/// tick at all.
class MobiCharacter extends StatefulWidget {
  const MobiCharacter({
    super.key,
    this.controller,
    this.size = 120,
    this.entrance = MobiAct.appear,
    this.semanticLabel,
    this.interactive = false,
    this.shadow = true,
    this.seed = 7,
  });

  final MobiController? controller;

  /// Height in dp. Width is [MobiFigure.widthFor].
  final double size;

  /// The act played on appearing. A held act (think, point, rest...) sets how Mobi stands.
  final MobiAct entrance;

  /// Mobi is decorative (excluded from semantics) unless this is given.
  final String? semanticLabel;

  /// A tap makes Mobi react (a wave, then a hop). With a [semanticLabel] it is also a TalkBack
  /// button; without one it stays decorative.
  final bool interactive;

  /// Draw the contact shadow.
  final bool shadow;

  /// Seeds the idle rhythm, so two Mobis on one screen do not blink in step.
  final int seed;

  @override
  State<MobiCharacter> createState() => _MobiCharacterState();
}

class _MobiCharacterState extends State<MobiCharacter> with SingleTickerProviderStateMixin implements MobiHost {
  late final MobiSim _sim = MobiSim(seed: widget.seed);
  late final ValueNotifier<MobiRig> _rig = ValueNotifier(_sim.rig);
  late final Ticker _ticker = createTicker(_onTick);
  Duration _last = Duration.zero;
  Timer? _rest;
  double _restFor = 0;
  bool _reduced = false;
  bool _started = false;
  int _taps = 0;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final reduced = Motion.reduced(context);
    if (_started && reduced == _reduced) return;
    _reduced = reduced;
    if (reduced) {
      _sleep();
      _rig.value = MobiMoves.keyPose(_started ? (_sim.act ?? _actForStance()) : widget.entrance);
    } else if (!_started) {
      play(widget.entrance);
    } else {
      _wake();
    }
    if (!_started) widget.controller?.attach(this);
    _started = true;
  }

  MobiAct _actForStance() => switch (_sim.stance) {
        MobiStance.stand => MobiAct.idle,
        MobiStance.point => MobiAct.point,
        MobiStance.think => MobiAct.think,
        MobiStance.sleepy => MobiAct.sleepy,
        MobiStance.rest => MobiAct.rest,
        MobiStance.read => MobiAct.read,
      };

  @override
  void didUpdateWidget(MobiCharacter old) {
    super.didUpdateWidget(old);
    if (old.controller != widget.controller) {
      old.controller?.detach(this);
      widget.controller?.attach(this);
    }
    if (old.entrance != widget.entrance) play(widget.entrance);
  }

  @override
  void dispose() {
    widget.controller?.detach(this);
    _rest?.cancel();
    _ticker.dispose();
    _rig.dispose();
    super.dispose();
  }

  // ---- Ticking -----------------------------------------------------------------------------

  void _onTick(Duration elapsed) {
    final dt = (elapsed - _last).inMicroseconds / 1e6;
    _last = elapsed;
    _rig.value = _sim.step(dt);
    if (!_sim.busy) {
      _ticker.stop();
      _restFor = _sim.idleWait;
      _rest = Timer(Duration(microseconds: (_restFor * 1e6).round()), () {
        _sim.elapse(_restFor);
        _wake();
      });
    }
  }

  void _wake() {
    if (_reduced || !mounted) return;
    _rest?.cancel();
    _rest = null;
    if (!_ticker.isActive) {
      _last = Duration.zero;
      _ticker.start();
    }
  }

  void _sleep() {
    _rest?.cancel();
    _rest = null;
    if (_ticker.isActive) _ticker.stop();
  }

  // ---- MobiHost ----------------------------------------------------------------------------

  @override
  void play(MobiAct act, {double? seconds}) {
    if (_reduced) {
      if (MobiMoves.stanceAfter(act) != null && act != MobiAct.appear) {
        _sim.play(act);
        _rig.value = MobiMoves.keyPose(act);
      }
      return;
    }
    _sim.play(act, seconds: seconds);
    _wake();
  }

  Offset? _toDesign(Offset global) {
    final box = context.findRenderObject();
    if (box is! RenderBox || !box.hasSize) return null;
    final local = box.globalToLocal(global);
    final scale = box.size.height / MobiGeo.height;
    final dx = (box.size.width - MobiGeo.width * scale) / 2;
    return Offset((local.dx - dx) / scale, local.dy / scale);
  }

  @override
  void lookAtGlobal(Offset? point) {
    if (point == null) {
      _sim.lookAt(null);
    } else {
      final d = _toDesign(point);
      if (d == null) return;
      final v = d - (MobiGeo.visor + const Offset(0, MobiGeo.bodyDrop));
      _sim.lookAt(Offset(v.dx / 60, v.dy / 60));
    }
    _wake();
  }

  @override
  void pointAtGlobal(Offset point) {
    final d = _toDesign(point);
    if (d == null) return;
    final side = d.dx >= MobiGeo.pivot.dx ? 1.0 : -1.0;
    final shoulder = (side > 0 ? MobiGeo.shoulderR : MobiGeo.shoulderL) + const Offset(0, MobiGeo.bodyDrop);
    final v = d - shoulder;
    _sim.aim(math.atan2(side * v.dx, v.dy), side);
    final look = d - (MobiGeo.visor + const Offset(0, MobiGeo.bodyDrop));
    _sim.lookAt(Offset(look.dx / 60, look.dy / 60));
    play(MobiAct.point);
  }

  void _onTap() {
    _taps++;
    play(_taps.isOdd ? MobiAct.cheer : MobiAct.hello);
  }

  @override
  Widget build(BuildContext context) {
    final palette = MobiPalette.of(night: context.mmColors.isNight);
    Widget child = RepaintBoundary(
      child: CustomPaint(
        size: Size(MobiFigure.widthFor(widget.size), widget.size),
        painter: MobiPainter(rig: _rig, palette: palette, shadow: widget.shadow),
      ),
    );
    if (widget.interactive && !_reduced) {
      child = GestureDetector(behavior: HitTestBehavior.opaque, onTap: _onTap, child: child);
    }
    final label = widget.semanticLabel;
    // Decorative Mobi stays out of TalkBack. A labelled, interactive Mobi is a button whose
    // double tap plays the same reaction as a touch.
    if (label == null) return ExcludeSemantics(child: child);
    if (widget.interactive) {
      return Semantics(button: true, label: label, onTap: _onTap, child: ExcludeSemantics(child: child));
    }
    return Semantics(label: label, image: true, child: ExcludeSemantics(child: child));
  }
}
