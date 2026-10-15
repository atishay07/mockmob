import 'dart:math' as math;

import 'package:flutter/foundation.dart';
import 'package:flutter/physics.dart' show SpringSimulation;
import 'package:flutter/scheduler.dart';
import 'package:flutter/widgets.dart';

import '../haptics/haptics.dart';
import 'motion.dart';

/// What a flying object is drawn as. [build] lays the copy out at [size] once (it never lays out
/// again in flight) with its float pose at the given lift (0 on the ground, 1 at the top of its
/// float); [objectIn] is where the object itself sits inside that box, so [boxFor] can place the
/// box for any rect the object should cover. Translate and scale only.
@immutable
class MmFlightCopy {
  const MmFlightCopy({required this.size, required this.objectIn, required this.build});

  final Size size;
  final Rect objectIn;
  final Widget Function(ValueListenable<double> lift) build;

  /// The box's global rect when the object inside it covers [object] (global).
  Rect boxFor(Rect object) {
    final k = objectIn.width <= 0 ? 1.0 : object.width / objectIn.width;
    return Rect.fromLTWH(object.left - objectIn.left * k, object.top - objectIn.top * k, size.width * k, size.height * k);
  }
}

/// One object an [MmFlight] can leave from or land on. `SubjectEmblem` is one while it shows a
/// photo-real object; [MmFlightTarget] makes any widget one.
abstract class MmFlightPoint {
  BuildContext get context;

  /// Two points carry the same object when their keys are equal (the subject's render).
  Object get flightKey;

  /// Whether this point shows [subjectId]'s object (aliases included).
  bool carries(String subjectId);

  /// Of several landing places for one flight, the highest wins (an explicit target, then size).
  double get flightPriority;

  /// Where the object is now, in global coordinates; null when it is not laid out.
  Rect? get objectRect;

  /// How to draw this object in flight; null for a point that only receives.
  MmFlightCopy? get flightCopy;

  /// The object's float pose now (0 on the ground, 1 at the top of its float).
  double get flightLift;

  /// How long the point takes to show itself again after a landing (a framed tile fades its well
  /// in under the landed object); the copy stays on top until then.
  Duration get revealDuration;

  /// Hide or show the object (a flight is drawing it elsewhere).
  void setFlightHidden(bool hidden);

  /// The flight landed here: [back] is true when a pop brought it home.
  void flightLanded({required bool back});
}

/// Object flight (feature wave 1015, M2): the object the student tapped flies into the next screen.
///
/// The tap calls [launch] with the card's context (the object is inside it) before navigating. The
/// next screen's object of the same subject registers as it mounts; if one does within
/// [frameWindow] frames, an overlay draws the same render from the tapped object's rect to the
/// destination's, translate and scale only: the path on [Motion.emphasized] over [duration]
/// (420 ms), the scale on [Springs.settle], a low arc, the object rising to the top of its float
/// in the air so its shadow thins, and settling on the ground at landing. Both ends stay hidden
/// while the copy flies. On landing the destination shows itself, reacts at
/// [MmFlight.landAmplitude] and one `haptics.tick` fires. A pop flies it home, following the
/// route's own reverse (340 ms on a container page).
///
/// It does not fly, and the page simply uses its own transition, when no destination registers in
/// time, when the destination is an exam or runner page ([excluded]), or under reduced motion.
abstract final class MmFlight {
  /// The flight time.
  static const Duration duration = Motion.emphasizedDuration;

  /// The reverse on a pop when it is not driven by a route (a container page pops in 340 ms).
  static const Duration reverseDuration = Duration(milliseconds: 340);

  /// Frames a destination has to register in, after the tap.
  static const int frameWindow = 3;

  /// The landing reaction's amplitude.
  static const double landAmplitude = 0.4;

  /// The highest the arc rises above the straight path, in dp.
  static const double arcMax = 18;

  static final Map<MmFlightPoint, _Seat> _points = {};
  static int _seq = 0;
  static _Pending? _pending;
  static final List<_FlightLink> _links = [];

  /// Routes an object never flies into: the exam's and the runner's (a timed paper has no flight).
  static bool Function(Route<Object?> route) excluded = _examOrRunner;

  static bool _examOrRunner(Route<Object?> route) {
    final name = route.settings.name ?? '';
    return name.startsWith('/exam') || name.startsWith('/run') || name.startsWith('run/') || name.contains('/nta');
  }

  /// True while any flight is drawing an object (tests).
  @visibleForTesting
  static bool get inFlight => _links.any((l) => l.flying);

  /// Forgets every point and flight (tests).
  @visibleForTesting
  static void debugReset() {
    for (final link in List<_FlightLink>.of(_links)) {
      link.end();
    }
    _links.clear();
    _points.clear();
    _pending = null;
  }

  /// Registers [point] (a mounting object). Call once its route is known (didChangeDependencies).
  static void register(MmFlightPoint point, Route<Object?>? route) {
    _points[point] = _Seat(++_seq, route);
  }

  /// The route [point] registered with changed (rare: a subtree moved).
  static void updateRoute(MmFlightPoint point, Route<Object?>? route) {
    final seat = _points[point];
    if (seat != null) seat.route = route;
  }

  static void unregister(MmFlightPoint point) {
    _points.remove(point);
    if (_pending?.source == point) _cancel();
    for (final link in List<_FlightLink>.of(_links)) {
      if (link.source == point || link.target == point) link.end();
    }
  }

  /// Whether [point] should build hidden now: a fresh flight for its object is waiting and it may
  /// be where it lands. Asked on a point's first builds, so it never shows for a frame before the
  /// flight starts.
  static bool awaits(MmFlightPoint point) {
    final pending = _pending;
    final seat = _points[point];
    if (pending == null || seat == null || seat.order <= pending.order) return false;
    final route = seat.route;
    return pending.source.flightKey == point.flightKey && route != null && route != pending.sourceRoute && !excluded(route);
  }

  /// Whether [point] is hidden by a flight in the air or by a landed flight's source.
  static bool hides(MmFlightPoint point) =>
      awaits(point) || _links.any((l) => (l.target == point && l.targetHidden) || (l.source == point && l.sourceHidden));

  /// Arms a flight from the object inside [scope] (the tapped card) that shows [subjectId], or the
  /// largest object in it. Call it from the tap, right before navigating. Returns whether an object
  /// was found; nothing else changes until a destination registers.
  static bool launch(BuildContext scope, String? subjectId) {
    if (!scope.mounted || Motion.reduced(scope)) return false;
    MmFlightPoint? best;
    for (final MapEntry(key: point, value: seat) in _points.entries) {
      if (point.flightCopy == null || !point.context.mounted || seat.route == null) continue;
      if (subjectId != null && !point.carries(subjectId)) continue;
      if (!_inside(point.context, scope)) continue;
      if (best == null || point.flightPriority > best.flightPriority) best = point;
    }
    if (best == null) return false;
    final rect = best.objectRect;
    if (rect == null) return false;
    if (subjectId != null) MmLaunchRect.capturePair(subjectId, rect);
    _pending = _Pending(source: best, sourceRoute: _points[best]!.route, order: _seq, framesLeft: frameWindow);
    _schedule();
    return true;
  }

  static bool _inside(BuildContext child, BuildContext scope) {
    if (identical(child, scope)) return true;
    var found = false;
    child.visitAncestorElements((e) {
      if (identical(e, scope)) {
        found = true;
        return false;
      }
      return true;
    });
    return found;
  }

  static void _schedule() {
    SchedulerBinding.instance.addPostFrameCallback((_) => _check());
    SchedulerBinding.instance.scheduleFrame();
  }

  static void _cancel() {
    final pending = _pending;
    _pending = null;
    if (pending == null) return;
    // Any destination that built hidden in case it was the one shows itself again.
    for (final MapEntry(key: point, value: seat) in _points.entries) {
      if (seat.order > pending.order && point.flightKey == pending.source.flightKey) point.setFlightHidden(hides(point));
    }
  }

  static void _check() {
    final pending = _pending;
    if (pending == null) return;
    final source = pending.source;
    if (!source.context.mounted) return _cancel();
    MmFlightPoint? target;
    for (final MapEntry(key: point, value: seat) in _points.entries) {
      if (seat.order <= pending.order || point == source || !point.context.mounted) continue;
      if (point.flightKey != source.flightKey) continue;
      final route = seat.route;
      if (route == null || route == pending.sourceRoute || excluded(route)) continue;
      if (point.objectRect == null) continue;
      if (target == null || point.flightPriority > target.flightPriority) target = point;
    }
    if (target == null) {
      pending.framesLeft--;
      if (pending.framesLeft <= 0) return _cancel();
      return _schedule();
    }
    _pending = null;
    final started = _fly(pending, target);
    // The other places that built hidden in case they were the one show themselves again.
    for (final MapEntry(key: point, value: seat) in _points.entries) {
      if (seat.order > pending.order && point != target && point.flightKey == source.flightKey) point.setFlightHidden(hides(point));
    }
    if (!started) target.setFlightHidden(hides(target));
  }

  static bool _fly(_Pending pending, MmFlightPoint target) {
    final source = pending.source;
    final copy = source.flightCopy;
    final from = source.objectRect;
    final targetRoute = _points[target]?.route;
    if (copy == null || from == null || targetRoute == null || Motion.reduced(target.context)) return false;
    final overlay = Overlay.maybeOf(target.context, rootOverlay: true);
    if (overlay == null) return false;
    final link = _FlightLink(
      source: source,
      target: target,
      targetRoute: targetRoute,
      copy: copy,
      from: from,
      startLift: source.flightLift,
      haptics: hapticsOf(target.context),
    );
    _links.add(link);
    link.sourceHidden = true;
    link.targetHidden = true;
    source.setFlightHidden(true);
    target.setFlightHidden(true);
    link.entry = OverlayEntry(builder: (_) => _FlightLayer(link: link));
    overlay.insert(link.entry!);
    return true;
  }

  /// The object's centre and size at [t] (0 to 1) between [from] and [to]: the path on
  /// [Motion.emphasized] with a low arc, the size on [Springs.settle].
  static Rect pathAt(Rect from, Rect to, double t) {
    final tt = t.clamp(0.0, 1.0);
    final e = Motion.emphasized.transform(tt);
    final s = tt >= 1 ? 1.0 : _settle.x(tt * duration.inMicroseconds / Duration.microsecondsPerSecond).clamp(0.0, 1.0);
    final distance = (to.center - from.center).distance;
    final arc = math.min(arcMax, distance * 0.08) * math.sin(math.pi * e);
    final center = Offset.lerp(from.center, to.center, e)! - Offset(0, arc);
    final width = from.width + (to.width - from.width) * s;
    final height = from.height + (to.height - from.height) * s;
    return Rect.fromCenter(center: center, width: width, height: height);
  }

  static final _settleSim = SpringSimulation(Springs.settle, 0, 1, 0);
  static SpringSimulation get _settle => _settleSim;

  /// The copy's float pose at [t]: from the source's pose, up to the top of the float mid-air (its
  /// shadow thins), down to the ground at landing (the shadow settles).
  static double liftAt(double start, double t) {
    final tt = t.clamp(0.0, 1.0);
    if (tt >= 1) return 0;
    return (start * (1 - tt) + math.sin(math.pi * tt)).clamp(0.0, 1.0);
  }
}

class _Seat {
  _Seat(this.order, this.route);

  final int order;
  Route<Object?>? route;
}

class _Pending {
  _Pending({required this.source, required this.sourceRoute, required this.order, required this.framesLeft});

  final MmFlightPoint source;
  final Route<Object?>? sourceRoute;
  final int order;
  int framesLeft;
}

class _FlightLink {
  _FlightLink({
    required this.source,
    required this.target,
    required this.targetRoute,
    required this.copy,
    required this.from,
    required this.startLift,
    required this.haptics,
  });

  final MmFlightPoint source;
  final MmFlightPoint target;
  final Route<Object?> targetRoute;
  final MmFlightCopy copy;
  final Rect from;
  final double startLift;
  final Haptics? haptics;

  OverlayEntry? entry;
  bool sourceHidden = false;
  bool targetHidden = false;

  /// The copy is on screen.
  bool flying = true;

  bool _ended = false;

  /// Takes the copy away and shows both ends.
  void end() {
    if (_ended) return;
    _ended = true;
    flying = false;
    MmFlight._links.remove(this);
    final layer = entry;
    entry = null;
    if (layer != null) {
      // An object leaving the tree ends its flight from inside the frame (the tree is locked
      // then): the overlay lets go of the layer right after it.
      void drop() {
        layer.remove();
        layer.dispose();
      }

      if (SchedulerBinding.instance.schedulerPhase == SchedulerPhase.persistentCallbacks) {
        SchedulerBinding.instance.addPostFrameCallback((_) => drop());
      } else {
        drop();
      }
    }
    if (sourceHidden) {
      sourceHidden = false;
      if (source.context.mounted) source.setFlightHidden(MmFlight.hides(source));
    }
    if (targetHidden) {
      targetHidden = false;
      if (target.context.mounted) target.setFlightHidden(MmFlight.hides(target));
    }
  }
}

enum _Phase { out, revealing, landed, home }

/// The overlay that draws the flying copy. It owns the flight's clock.
class _FlightLayer extends StatefulWidget {
  const _FlightLayer({required this.link});

  final _FlightLink link;

  @override
  State<_FlightLayer> createState() => _FlightLayerState();
}

class _FlightLayerState extends State<_FlightLayer> with SingleTickerProviderStateMixin {
  late final AnimationController _t = AnimationController(vsync: this, duration: MmFlight.duration);
  final ValueNotifier<double> _lift = ValueNotifier<double>(0);
  final ValueNotifier<Rect?> _object = ValueNotifier<Rect?>(null);
  _Phase _phase = _Phase.out;

  /// The pop's start: where the object was and how far the route had come.
  Rect? _homeFrom;
  double _homeRoute = 1;

  _FlightLink get link => widget.link;
  Animation<double>? get _route {
    final route = link.targetRoute;
    return route is TransitionRoute<Object?> ? route.animation : null;
  }

  @override
  void initState() {
    super.initState();
    _lift.value = link.startLift;
    _object.value = link.from;
    _t.addListener(_tick);
    _t.forward();
    _route?.addListener(_routeMoved);
  }

  @override
  void dispose() {
    _route?.removeListener(_routeMoved);
    _t.dispose();
    _lift.dispose();
    _object.dispose();
    super.dispose();
  }

  void _tick() {
    if (_phase != _Phase.out) return;
    if (_popping) return _startHome();
    if (!link.targetRoute.isActive) return link.end();
    final to = link.target.objectRect;
    if (to == null) return link.end();
    final t = _t.value;
    _object.value = MmFlight.pathAt(link.from, to, t);
    _lift.value = MmFlight.liftAt(link.startLift, t);
    if (t >= 1) _land();
  }

  void _land() {
    _phase = _Phase.revealing;
    link.targetHidden = false;
    link.target.setFlightHidden(MmFlight.hides(link.target));
    final wait = link.target.revealDuration;
    if (wait <= Duration.zero) {
      _settle();
    } else {
      Future<void>.delayed(wait, () {
        if (mounted && _phase == _Phase.revealing) _settle();
      });
    }
  }

  /// The copy goes; the destination answers with its small reaction and one tick. The empty layer
  /// stays (it ignores touches) to fly the object home on a pop.
  void _settle() {
    _phase = _Phase.landed;
    link.flying = false;
    _object.value = null;
    if (link.target.context.mounted) {
      link.target.flightLanded(back: false);
      link.haptics?.tick();
    }
  }

  /// The destination's route is being popped (its own animation runs in reverse). A route pushed
  /// over it moves only its secondary animation, so that never sends the object home.
  bool get _popping => _route?.status == AnimationStatus.reverse;

  /// The destination's route moved: fly home with it when it is leaving.
  void _routeMoved() {
    if (_phase == _Phase.home) return _homeTick();
    if (_popping) _startHome();
  }

  void _startHome() {
    if (_phase == _Phase.home) return;
    final from = _phase == _Phase.out ? _object.value : link.target.objectRect;
    if (from == null || !link.source.context.mounted) return link.end();
    _t.stop();
    _phase = _Phase.home;
    _homeFrom = from;
    _homeRoute = (_route?.value ?? 1).clamp(0.001, 1.0);
    link.flying = true;
    link.targetHidden = true;
    link.target.setFlightHidden(true);
    link.sourceHidden = true;
    link.source.setFlightHidden(true);
    if (_route == null) {
      // No route clock to follow: fly home on our own.
      _t.duration = MmFlight.reverseDuration;
      _t.addListener(_homeTick);
      _t.forward(from: 0);
    }
    _homeTick();
  }

  void _homeTick() {
    if (_phase != _Phase.home) return;
    final route = _route;
    final double q;
    if (route != null) {
      q = ((_homeRoute - route.value) / _homeRoute).clamp(0.0, 1.0);
      // The pop was taken back (a cancelled back gesture): land where it was.
      if (route.status == AnimationStatus.completed || route.status == AnimationStatus.forward) {
        _phase = _Phase.landed;
        link.flying = false;
        _object.value = null;
        link.targetHidden = false;
        link.target.setFlightHidden(MmFlight.hides(link.target));
        return;
      }
    } else {
      q = _t.value;
    }
    final to = link.source.objectRect;
    final from = _homeFrom;
    if (to == null || from == null) return link.end();
    _object.value = MmFlight.pathAt(from, to, q);
    _lift.value = MmFlight.liftAt(0, q) * 0.6;
    final done = route != null ? route.status == AnimationStatus.dismissed || q >= 1 : q >= 1;
    if (done) {
      link.flying = false;
      link.end();
      if (link.source.context.mounted) link.source.flightLanded(back: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    final copy = link.copy;
    final child = copy.build(_lift);
    return IgnorePointer(
      child: ValueListenableBuilder<Rect?>(
        valueListenable: _object,
        child: RepaintBoundary(child: SizedBox.fromSize(size: copy.size, child: child)),
        builder: (context, object, child) {
          if (object == null) return const SizedBox.shrink();
          final box = copy.boxFor(object);
          final k = copy.size.width <= 0 ? 1.0 : box.width / copy.size.width;
          // Laid out once at the copy's own size; only a translate and a scale move it.
          return Stack(
            children: [
              Positioned(
                left: 0,
                top: 0,
                width: copy.size.width,
                height: copy.size.height,
                child: Transform(
                  transform: Matrix4.translationValues(box.left, box.top, 0)..scaleByDouble(k, k, 1, 1),
                  child: child,
                ),
              ),
            ],
          );
        },
      ),
    );
  }
}

/// Marks [child] as where an object of [flightKey] lands when it flies into this screen, ahead of
/// any subject object here (a `SubjectEmblem` registers itself). The child stays hidden until the
/// object lands on it, then shows; [onLanded] runs then.
class MmFlightTarget extends StatefulWidget {
  const MmFlightTarget({super.key, required this.flightKey, required this.child, this.onLanded});

  final Object flightKey;
  final Widget child;
  final VoidCallback? onLanded;

  @override
  State<MmFlightTarget> createState() => _MmFlightTargetState();
}

class _MmFlightTargetState extends State<MmFlightTarget> with SingleTickerProviderStateMixin implements MmFlightPoint {
  late final AnimationController _shown = AnimationController(vsync: this, duration: Motion.reducedFade, value: 1);
  bool _registered = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final route = ModalRoute.of(context);
    if (!_registered) {
      _registered = true;
      MmFlight.register(this, route);
      if (MmFlight.awaits(this)) _shown.value = 0;
    } else {
      MmFlight.updateRoute(this, route);
    }
  }

  @override
  void dispose() {
    MmFlight.unregister(this);
    _shown.dispose();
    super.dispose();
  }

  @override
  Object get flightKey => widget.flightKey;

  @override
  bool carries(String subjectId) => false;

  @override
  double get flightPriority => 1000 + (context.size?.width ?? 0);

  @override
  Rect? get objectRect {
    final box = context.findRenderObject();
    if (box is! RenderBox || !box.hasSize || !box.attached) return null;
    return box.localToGlobal(Offset.zero) & box.size;
  }

  @override
  MmFlightCopy? get flightCopy => null;

  @override
  double get flightLift => 0;

  @override
  Duration get revealDuration => Duration.zero;

  @override
  void setFlightHidden(bool hidden) {
    if (!mounted) return;
    _shown.value = hidden ? 0 : 1;
  }

  @override
  void flightLanded({required bool back}) => widget.onLanded?.call();

  @override
  Widget build(BuildContext context) => FadeTransition(opacity: _shown, child: widget.child);
}
