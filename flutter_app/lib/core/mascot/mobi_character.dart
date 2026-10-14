import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/gestures.dart';
import 'package:flutter/scheduler.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../haptics/haptics.dart';
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

/// The living Mobi: a vector character that breathes, blinks, glances about, sways its antenna,
/// watches where the student taps and plays acts.
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
    this.watchTaps = true,
    this.lite = false,
    this.head = false,
  });

  final MobiController? controller;

  /// Height in dp. Width is [MobiFigure.widthFor] (or [size] for a [head]).
  final double size;

  /// The act played on appearing. A held act (think, point, rest...) sets how Mobi stands.
  final MobiAct entrance;

  /// Mobi is decorative (excluded from semantics) unless this is given.
  final String? semanticLabel;

  /// A tap makes Mobi react (a squash and a happy blink; a third quick tap cheers; a sleeping
  /// Mobi wakes). With a [semanticLabel] it is also a TalkBack button; without one it stays
  /// decorative.
  final bool interactive;

  /// Draw the contact shadow.
  final bool shadow;

  /// Seeds the idle rhythm, so two Mobis on one screen do not blink in step.
  final int seed;

  /// Glance toward taps anywhere on screen for a moment. Costs nothing until a tap.
  final bool watchTaps;

  /// Lite detail for small sizes and lists (see [MobiPainter.lite]).
  final bool lite;

  /// Only the head (body, visor, eyes, antenna) in a square [size] box: avatars and rows.
  final bool head;

  @override
  State<MobiCharacter> createState() => _MobiCharacterState();
}

class _MobiCharacterState extends State<MobiCharacter> with SingleTickerProviderStateMixin implements MobiHost, MobiAttentionHost {
  late final MobiSim _sim = MobiSim(seed: widget.seed);
  late final ValueNotifier<MobiRig> _rig = ValueNotifier(_sim.rig);
  late final Ticker _ticker = createTicker(_onTick);
  Duration _last = Duration.zero;
  Timer? _rest;
  double _restFor = 0;
  Timer? _still;
  bool _reduced = false;

  /// Quick, per-answer reactions. Under reduced motion their key pose shows for the act's length
  /// and then gives way to the stance; the bigger moments (hello, cheer, celebrate, proud) hold
  /// their pose until the next act, as before.
  static const Set<MobiAct> _reactions = {MobiAct.correct, MobiAct.encourage, MobiAct.wake};
  bool _started = false;
  bool _routed = false;
  int _taps = 0;
  DateTime _lastTap = DateTime.fromMillisecondsSinceEpoch(0);

  @override
  void initState() {
    super.initState();
    _route(widget.watchTaps);
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final reduced = Motion.reduced(context);
    if (_started && reduced == _reduced) return;
    _reduced = reduced;
    if (reduced) {
      _sleep();
      _rig.value = MobiMoves.keyPose(
        _started ? (_sim.act ?? _actForStance()) : widget.entrance,
        pointAngle: _sim.pointAngle,
        pointSide: _sim.pointSide,
      );
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
        MobiStance.loading => MobiAct.loading,
        MobiStance.sleep => MobiAct.sleep,
        MobiStance.listen => MobiAct.listen,
      };

  @override
  void didUpdateWidget(MobiCharacter old) {
    super.didUpdateWidget(old);
    if (old.controller != widget.controller) {
      old.controller?.detach(this);
      widget.controller?.attach(this);
    }
    if (old.entrance != widget.entrance) play(widget.entrance);
    if (old.watchTaps != widget.watchTaps) _route(widget.watchTaps);
  }

  @override
  void dispose() {
    _route(false);
    widget.controller?.detach(this);
    _rest?.cancel();
    _still?.cancel();
    _ticker.dispose();
    _rig.dispose();
    super.dispose();
  }

  // ---- Watching taps -----------------------------------------------------------------------

  void _route(bool on) {
    if (on == _routed) return;
    final router = GestureBinding.instance.pointerRouter;
    if (on) {
      router.addGlobalRoute(_onPointer);
    } else {
      router.removeGlobalRoute(_onPointer);
    }
    _routed = on;
  }

  void _onPointer(PointerEvent event) {
    if (event is! PointerDownEvent || _reduced || !mounted) return;
    final box = context.findRenderObject();
    if (box is! RenderBox || !box.attached || !box.hasSize) return;
    // A tap on Mobi itself is handled by the tap reaction.
    if ((Offset.zero & box.size).contains(box.globalToLocal(event.position))) return;
    glanceAtGlobal(event.position, 1.1);
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
      _still?.cancel();
      _still = null;
      if (MobiMoves.stanceAfter(act) != null && act != MobiAct.appear) {
        _sim.play(act);
        _rig.value = MobiMoves.keyPose(act, pointAngle: _sim.pointAngle, pointSide: _sim.pointSide);
        // A reaction still shows, without motion: its key pose for the act's length, then the
        // stance again. Nothing ticks.
        if (_reactions.contains(act)) {
          _still = Timer(Duration(milliseconds: (MobiMoves.duration(act) * 1000).round()), () {
            _still = null;
            if (mounted) _rig.value = MobiMoves.keyPose(_actForStance(), pointAngle: _sim.pointAngle, pointSide: _sim.pointSide);
          });
        }
      }
      return;
    }
    _sim.play(act, seconds: seconds);
    _wake();
  }

  /// Global screen point to design units, matching the painter's framing.
  Offset? _toDesign(Offset global) {
    final box = context.findRenderObject();
    if (box is! RenderBox || !box.hasSize) return null;
    final local = box.globalToLocal(global);
    if (widget.head) {
      const f = MobiPainter.headFrame;
      final scale = math.min(box.size.width / f.width, box.size.height / f.height);
      final dx = (box.size.width - f.width * scale) / 2 - f.left * scale;
      final dy = (box.size.height - f.height * scale) / 2 - f.top * scale;
      return Offset((local.dx - dx) / scale, (local.dy - dy) / scale);
    }
    final scale = box.size.height / MobiGeo.height;
    final dx = (box.size.width - MobiGeo.width * scale) / 2;
    return Offset((local.dx - dx) / scale, local.dy / scale);
  }

  Offset? _gaze(Offset global) {
    final d = _toDesign(global);
    if (d == null) return null;
    final v = d - (MobiGeo.visor + const Offset(0, MobiGeo.bodyDrop));
    // Far targets saturate; near ones move the eyes proportionally.
    return Offset(v.dx / 60, v.dy / 60);
  }

  @override
  void lookAtGlobal(Offset? point) {
    if (point == null) {
      _sim.lookAt(null);
    } else {
      final g = _gaze(point);
      if (g == null) return;
      _sim.lookAt(g);
    }
    _wake();
  }

  @override
  void glanceAtGlobal(Offset point, double seconds) {
    if (_reduced) return;
    final g = _gaze(point);
    if (g == null) return;
    _sim.glance(g, seconds: seconds);
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

  // ---- Touch -------------------------------------------------------------------------------

  void _haptic() {
    try {
      unawaited(ProviderScope.containerOf(context, listen: false).read(hapticsProvider).tick().catchError((Object _) {}));
    } catch (_) {
      // No ProviderScope above (previews): no haptic.
    }
  }

  void _onTapAt(Offset? global) {
    _haptic();
    if (_reduced) return;
    if (_sim.stance == MobiStance.sleep || _sim.stance == MobiStance.sleepy) {
      _taps = 0;
      play(MobiAct.wake);
      return;
    }
    final now = DateTime.now();
    _taps = now.difference(_lastTap) < const Duration(milliseconds: 900) ? _taps + 1 : 1;
    _lastTap = now;
    if (_taps >= 3) {
      _taps = 0;
      play(MobiAct.cheer);
      return;
    }
    double side = 0;
    if (global != null) {
      final d = _toDesign(global);
      if (d != null) side = ((d.dx - MobiGeo.pivot.dx) / 50).clamp(-1.0, 1.0);
      final g = _gaze(global);
      if (g != null) _sim.glance(g, seconds: 0.7);
    }
    _sim.boop(side: side);
    _wake();
  }

  @override
  Widget build(BuildContext context) {
    final palette = MobiPalette.of(night: context.mmColors.isNight);
    final box = widget.head ? Size.square(widget.size) : Size(MobiFigure.widthFor(widget.size), widget.size);
    Widget child = RepaintBoundary(
      child: CustomPaint(
        size: box,
        painter: MobiPainter(rig: _rig, palette: palette, shadow: widget.shadow, lite: widget.lite, head: widget.head),
      ),
    );
    if (widget.interactive && !_reduced) {
      child = GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTapUp: (d) => _onTapAt(d.globalPosition),
        child: child,
      );
    }
    final label = widget.semanticLabel;
    // Decorative Mobi stays out of TalkBack. A labelled, interactive Mobi is a button whose
    // double tap plays the same reaction as a touch.
    if (label == null) return ExcludeSemantics(child: child);
    if (widget.interactive) {
      return Semantics(button: true, label: label, onTap: () => _onTapAt(null), child: ExcludeSemantics(child: child));
    }
    return Semantics(label: label, image: true, child: ExcludeSemantics(child: child));
  }
}
