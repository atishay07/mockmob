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
import 'mobi_mood.dart';
import 'mobi_painter.dart';
import 'mobi_palette.dart';
import 'mobi_ration.dart';
import 'mobi_rig.dart';
import 'mobi_sim.dart';
import 'mobi_tap_cycle.dart';

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
    this.lite,
    this.head = false,
    this.followPointer = false,
    this.tapCycle,
    this.still = false,
  });

  /// Holds the stance as a still frame: he never ticks, blinks or reacts, as under reduced
  /// motion, but only for this Mobi. For the older faces in a thread, so one Mobi moves at a time.
  final bool still;

  /// The eyes follow the finger (and, on the web, the pointer) anywhere on screen while it moves,
  /// and drift back ahead 1.2 s after it stops. One flag for a screen that wants Mobi watching.
  /// Off under reduced motion.
  final bool followPointer;

  /// How long the eyes keep following after the finger stops.
  static const Duration followHold = Duration(milliseconds: 1200);

  /// Taps closer together than this count toward the plain triple-tap cheer (no tap cycle).
  static const Duration quickTapWindow = Duration(milliseconds: 900);

  /// With [interactive], repeated taps play this cycle's acts (see [MobiTapCycle]) instead of the
  /// plain squash; each tap still gets a light haptic.
  final MobiTapCycle? tapCycle;

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

  /// Glance toward taps anywhere on screen for a moment, at most once every
  /// [MobiRation.glanceGap]. Costs nothing until a tap. Pass false on input-heavy screens and
  /// glance on purpose at what changed.
  final bool watchTaps;

  /// Lite detail for small sizes and lists (see [MobiPainter.lite]). Null (the default) picks it
  /// by size: lite under [liteBelow] dp.
  final bool? lite;

  /// Below this height a Mobi paints lite detail unless [lite] says otherwise: at row and header
  /// sizes the fine detail is under a pixel and only costs paint time.
  static const double liteBelow = 72;

  /// Only the head (body, visor, eyes, antenna) in a square [size] box: avatars and rows.
  final bool head;

  @override
  State<MobiCharacter> createState() => _MobiCharacterState();
}

class _MobiCharacterState extends State<MobiCharacter> with SingleTickerProviderStateMixin implements MobiHost, MobiAttentionHost, MobiLifeHost {
  late final MobiSim _sim = MobiSim(seed: widget.seed);
  late final ValueNotifier<MobiRig> _rig = ValueNotifier(_sim.rig);
  late final Ticker _ticker;
  Duration _last = Duration.zero;
  Timer? _rest;
  double _restFor = 0;
  Timer? _still;
  bool _reduced = false;

  /// Quick, per-answer reactions. Under reduced motion their key pose shows for the act's length
  /// and then gives way to the stance; the bigger moments (hello, cheer, celebrate, proud) hold
  /// their pose until the next act, as before.
  static const Set<MobiAct> _reactions = MobiMoves.reactions;
  bool _started = false;
  bool _tickerOn = true;
  Timer? _followRelease;
  static const Duration _followHold = MobiCharacter.followHold;
  MobiTapRun? _tapRun;
  bool _routed = false;
  int _taps = 0;
  DateTime _lastTap = DateTime.fromMillisecondsSinceEpoch(0);

  /// When Mobi last glanced at a tap elsewhere (for the [MobiRation.glanceGap] throttle).
  DateTime? _lastGlance;

  /// The Celebrations setting in force: big acts are calmed or skipped under it.
  MobiCelebrationLevel _level = MobiCelebrationLevel.full;

  /// A sheet or dialog covers this Mobi's screen: he hushes, looks at it and leaves the taps on
  /// it to the sheet's own Mobi (one Mobi per screen).
  bool _covered = false;

  bool get _wantsRoute => widget.watchTaps || widget.followPointer;

  @override
  void initState() {
    super.initState();
    // Made here, not on first use: a ticker first asked for in dispose looks up an ancestor of a
    // deactivated element.
    _ticker = createTicker(_onTick);
    _route(_wantsRoute);
    _tapRun = widget.tapCycle?.start();
  }

  /// A still frame: [act]'s pose (or the stance's), with the mood's face over it. [settled] takes
  /// the travel out (see [MobiMoves.settledPose]).
  MobiRig _pose(MobiAct act, {bool settled = false}) {
    final pose = settled
        ? MobiMoves.settledPose(act, from: _sim.stance, pointAngle: _sim.pointAngle, pointSide: _sim.pointSide)
        : MobiMoves.keyPose(act, pointAngle: _sim.pointAngle, pointSide: _sim.pointSide, from: _sim.stance);
    return MobiMoods.apply(_sim.mood, pose);
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _level = MobiCelebrations.of(context);
    // Offscreen (a tab kept alive behind another, a route under a page) the ticker is muted and
    // the idle timer does not wake it; it picks up again when shown.
    final tickerOn = TickerMode.valuesOf(context).enabled;
    if (tickerOn != _tickerOn) {
      _tickerOn = tickerOn;
      if (tickerOn && _started) _wake();
    }
    final reduced = widget.still || Motion.reduced(context);
    final covered = !(ModalRoute.of(context)?.isCurrent ?? true);
    if (_started && reduced == _reduced) {
      _cover(covered);
      return;
    }
    _reduced = reduced;
    if (reduced) {
      _sleep();
      _rig.value = _pose(_started ? (_sim.act ?? _actForStance()) : (MobiRation.underLevel(widget.entrance, _level) ?? MobiAct.idle));
    } else if (!_started) {
      play(widget.entrance);
    } else {
      _wake();
    }
    if (!_started) widget.controller?.attach(this);
    _started = true;
    _cover(covered);
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
    if (old.entrance != widget.entrance) {
      // Seen again after the late-night window: a Mobi that was sleepy or asleep wakes once
      // (ending on its feet) instead of jumping to the day's entrance.
      final wasLate = old.entrance == MobiAct.sleep || old.entrance == MobiAct.sleepy;
      final isLate = widget.entrance == MobiAct.sleep || widget.entrance == MobiAct.sleepy;
      play(wasLate && !isLate ? MobiAct.wake : widget.entrance);
    }
    if (old.watchTaps != widget.watchTaps || old.followPointer != widget.followPointer) _route(_wantsRoute);
    if (old.tapCycle != widget.tapCycle) _tapRun = widget.tapCycle?.start();
    if (old.followPointer && !widget.followPointer) followGlobal(null);
    if (old.still != widget.still) _syncStill();
  }

  /// [MobiCharacter.still] changed: freeze on the stance's key pose, or wake up again.
  void _syncStill() {
    final reduced = widget.still || Motion.reduced(context);
    if (reduced == _reduced) return;
    _reduced = reduced;
    if (reduced) {
      _still?.cancel();
      _still = null;
      _sleep();
      _rig.value = _pose(_actForStance());
    } else {
      _wake();
    }
  }

  bool _deactivated = false;

  @override
  void deactivate() {
    _deactivated = true;
    super.deactivate();
  }

  @override
  void activate() {
    super.activate();
    _deactivated = false;
  }

  @override
  void dispose() {
    _route(false);
    widget.controller?.detach(this);
    _rest?.cancel();
    _still?.cancel();
    _followRelease?.cancel();
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
    if (_reduced || _covered || !mounted || _deactivated) return;
    if (widget.followPointer && (event is PointerDownEvent || event is PointerMoveEvent || event is PointerHoverEvent)) {
      followGlobal(event.position);
      return;
    }
    if (event is! PointerDownEvent || !widget.watchTaps) return;
    final box = context.findRenderObject();
    if (box is! RenderBox || !box.attached || !box.hasSize) return;
    // A tap on Mobi itself is handled by the tap reaction.
    if ((Offset.zero & box.size).contains(box.globalToLocal(event.position))) return;
    // At most one glance per gap: on a busy screen a glance at every tap reads as twitching.
    final now = MobiRation.now();
    final last = _lastGlance;
    if (last != null && now.difference(last) < MobiRation.glanceGap) return;
    _lastGlance = now;
    glanceAtGlobal(event.position, 1.1);
  }

  /// A sheet rose over this Mobi's screen (or went away). Under it he looks down at the sheet
  /// and stops watching taps; when it goes he looks ahead again.
  void _cover(bool covered) {
    if (covered == _covered) return;
    _covered = covered;
    if (_reduced) return;
    // After this frame's layout, so the look is measured from where Mobi stands now.
    SchedulerBinding.instance.addPostFrameCallback((_) {
      if (!mounted || _covered != covered) return;
      final size = MediaQuery.maybeSizeOf(context);
      if (!covered) {
        lookAtGlobal(null);
      } else if (size != null) {
        lookAtGlobal(Offset(size.width / 2, size.height * 0.8));
      }
    });
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
    if (_reduced || !mounted || !_tickerOn) return;
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
  void play(MobiAct requested, {double? seconds}) {
    // The Celebrations setting: Quiet turns a celebration into a nod, Off into nothing.
    final act = MobiRation.underLevel(requested, _level);
    if (act == null) return;
    if (_reduced) {
      _still?.cancel();
      _still = null;
      if ((MobiMoves.stanceAfter(act) != null || _reactions.contains(act)) && act != MobiAct.appear) {
        _rig.value = _pose(act);
        _sim.play(act);
        // A reaction still shows, without motion: its key pose for the act's length, then the
        // stance again. Nothing ticks.
        if (_reactions.contains(act)) _holdStill(act);
      }
      return;
    }
    _sim.play(act, seconds: seconds);
    _wake();
  }

  void _holdStill(MobiAct act) {
    _still?.cancel();
    _still = Timer(Duration(milliseconds: (MobiMoves.duration(act) * 1000).round()), () {
      _still = null;
      if (mounted) _rig.value = _pose(_actForStance());
    });
  }

  // ---- MobiLifeHost ------------------------------------------------------------------------

  @override
  void setMood(MobiMood mood) {
    _sim.setMood(mood);
    if (_reduced) {
      // No blend under reduced motion: the face changes in one step.
      if (_still == null) _rig.value = _pose(_actForStance());
    } else {
      _wake();
    }
  }

  @override
  bool react(MobiAct requested) {
    final act = MobiRation.underLevel(requested, _level);
    if (act == null) return false;
    if (_reduced) {
      // No travel: the act's still pose where he stands, for the act's length, then his stance.
      _sim.play(act);
      _rig.value = _pose(act, settled: true);
      if (_reactions.contains(act) || MobiRation.celebrations.contains(act) || act == MobiAct.hello) _holdStill(act);
      return true;
    }
    play(act);
    return true;
  }

  @override
  void followGlobal(Offset? point) {
    if (_reduced || !mounted) return;
    if (point == null) {
      _followRelease?.cancel();
      _followRelease = null;
      _sim.lookAt(null);
      _wake();
      return;
    }
    final g = _gaze(point);
    if (g == null) return;
    // Clamped a little inside the eyes' travel, so a finger at the screen's edge does not pin
    // the eyes to the visor's rim.
    _sim.lookAt(Offset(g.dx.clamp(-0.85, 0.85), g.dy.clamp(-0.8, 0.8)));
    // Each new point restarts the hold: the eyes let go 1.2 s after the finger stops.
    _followRelease?.cancel();
    _followRelease = Timer(_followHold, _release);
    _wake();
  }

  void _release() {
    _followRelease = null;
    if (!mounted) return;
    _sim.lookAt(null);
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
    final run = _tapRun;
    if (run != null) {
      final act = run.tap(now);
      if (global != null) {
        final g = _gaze(global);
        if (g != null) _sim.glance(g, seconds: 0.5);
      }
      if (act != null) {
        play(act);
      } else {
        _sim.boop();
        _wake();
      }
      return;
    }
    _taps = now.difference(_lastTap) < MobiCharacter.quickTapWindow ? _taps + 1 : 1;
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
        painter: MobiPainter(rig: _rig, palette: palette, shadow: widget.shadow, lite: widget.lite ?? widget.size < MobiCharacter.liteBelow, head: widget.head),
      ),
    );
    if (widget.interactive && !_reduced) {
      // The reaction starts on touch down, so the finger is answered on the next frame.
      child = GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTapDown: (d) => _onTapAt(d.globalPosition),
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
