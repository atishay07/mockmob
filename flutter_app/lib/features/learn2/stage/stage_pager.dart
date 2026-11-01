/// The study stage's pager (the web's `usePager`, BUILD-1101 B1, A1 3.7): one item per item-area height, in a track
/// moved by translation only. It is not a `PageView`.
///
///   pages      each page is its own vertical scroll view (clamping, so the content never bounces) one item area
///              tall: a card centred with a slight upward bias, a question from the top with fades at its edges, a
///              centred state. Pages more than 2 away are not built.
///   touch      the track follows the finger 1:1 only when the drag's first movement could not scroll the content in
///              its direction (the edge rule, the web's `scrollerThatCanMove`): a drag that starts at the content's
///              edge, or on a page that does not scroll, belongs to the pager for the whole gesture and the content
///              stays still; a drag that scrolled the content first belongs to the content for the whole gesture,
///              even after it reaches its edge. 0.35 resistance before the first page and after the last.
///   release    on past 18% of the item area or above 0.35 px/ms (350 dp/s) over the last 80 ms, in that
///              direction; never more than one item; else back. 320 ms on `Motion.drawer`.
///   keys       the screen moves the pager by changing [StagePager.index] (its own `go`, the same one it passes as
///              [StagePager.onGo]); the track slides from where it is. A jump of more than one item, or any move under
///              reduced motion, switches at once with a 120 ms cross-fade.
///   semantics  a label per page ("Card 3 of 21"), custom actions Next and Previous on the current page, and an
///              announcement of the new page after each move. No haptic on a move.
library;

import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/semantics.dart';

import '../../../core/motion/motion.dart';
import 'pager_model.dart';
import 'stage_frame.dart';

/// How a page sits in the item area.
enum StagePageKind {
  /// Centred with a slight upward bias (a Key card: it fits its words).
  card,

  /// From the top, 16 dp down, with fades at the edges while it scrolls (a question).
  question,

  /// Centred both ways (the checkpoint, a state).
  centre,
}

/// One page of the pager, as the screen describes it.
class StagePage {
  const StagePage({required this.kind, required this.child, required this.label, this.announce, this.id});

  const StagePage.card({required this.child, required this.label, this.announce, this.id}) : kind = StagePageKind.card;
  const StagePage.question({required this.child, required this.label, this.announce, this.id}) : kind = StagePageKind.question;
  const StagePage.centre({required this.child, required this.label, this.announce, this.id}) : kind = StagePageKind.centre;

  final StagePageKind kind;
  final Widget child;

  /// The page's name for a screen reader: "Card 3 of 21", "Question 4 of 21", "Checkpoint after 8 of 21".
  final String label;

  /// What is said when the page becomes the current one (the web's `announce`); defaults to [label].
  final String? announce;

  /// The item's identity (its id), so a page keeps its state when an item is inserted before it.
  final Object? id;
}

typedef StagePageBuilder = StagePage Function(BuildContext context, int index);

/// What a page's content can read from the pager: the item area's height, the physics for any scroll view of its
/// own (a card's long back), and whether it is the current page.
class StagePagerScope extends InheritedWidget {
  const StagePagerScope({super.key, required this.area, required this.physics, required this.current, required super.child});

  final double area;
  final ScrollPhysics physics;
  final bool current;

  static StagePagerScope? maybeOf(BuildContext context) => context.dependOnInheritedWidgetOfExactType<StagePagerScope>();

  @override
  bool updateShouldNotify(StagePagerScope old) => old.area != area || old.physics != physics || old.current != current;
}

class StagePager extends StatefulWidget {
  const StagePager({
    super.key,
    required this.count,
    required this.index,
    required this.onGo,
    required this.pageBuilder,
    this.enabled = true,
    this.feedLabel,
    this.nextLabel = 'Next',
    this.previousLabel = 'Previous',
  });

  /// Pages in all; [index] is the one shown.
  final int count;
  final int index;

  /// The pager asks the screen to show page `i` (a released drag, a semantics action). The screen changes [index].
  final ValueChanged<int> onGo;
  final StagePageBuilder pageBuilder;

  /// False: drags never move the track (a sheet is open, the stage is loading); pages still scroll their content.
  final bool enabled;

  /// The track's name for a screen reader ("Admission of a Partner, 21 items").
  final String? feedLabel;
  final String nextLabel;
  final String previousLabel;

  /// The physics a scroll view inside a page uses, so the edge rule holds for it too.
  static ScrollPhysics physicsOf(BuildContext context) => StagePagerScope.maybeOf(context)?.physics ?? const ClampingScrollPhysics();

  /// The item area's height around [context], or null outside a pager.
  static double? areaOf(BuildContext context) => StagePagerScope.maybeOf(context)?.area;

  @override
  State<StagePager> createState() => StagePagerState();
}

enum _Owner { idle, undecided, content, pager, side }

/// Who owns the current gesture, read by every page's physics.
class _Gate {
  _Gate(this._pager);

  final StagePagerState _pager;
  _Owner owner = _Owner.idle;

  /// The first movement of an undecided gesture, seen by a page's scroll view at its [pixels] of [min]..[max],
  /// in [dir] (1: toward its end, the finger moving up).
  void decide({required double pixels, required double min, required double max, required int dir}) {
    if (owner != _Owner.undecided) return;
    if (PagerModel.canScroll(pixels: pixels, min: min, max: max, dir: dir)) {
      owner = _Owner.content;
    } else {
      owner = _Owner.pager;
      _pager._takeOver();
    }
  }
}

/// Clamping physics that always take a drag (so a page that does not scroll still tells the pager) and give
/// nothing to the content while the pager owns the gesture. No parent: the stage's pages clamp on every platform.
class _PagePhysics extends ClampingScrollPhysics {
  // ignore: prefer_const_constructors_in_immutables
  _PagePhysics(this.gate);

  final _Gate gate;

  @override
  _PagePhysics applyTo(ScrollPhysics? ancestor) => this;

  @override
  bool shouldAcceptUserOffset(ScrollMetrics position) => true;

  @override
  double applyPhysicsToUserOffset(ScrollMetrics position, double offset) {
    if (gate.owner == _Owner.undecided && offset != 0) {
      gate.decide(pixels: position.pixels, min: position.minScrollExtent, max: position.maxScrollExtent, dir: offset < 0 ? 1 : -1);
    }
    return gate.owner == _Owner.pager ? 0 : offset;
  }

  @override
  Simulation? createBallisticSimulation(ScrollMetrics position, double velocity) {
    if (gate.owner == _Owner.pager) return null;
    return super.createBallisticSimulation(position, velocity);
  }
}

class StagePagerState extends State<StagePager> with TickerProviderStateMixin {
  late final _Gate _gate = _Gate(this);
  late final _PagePhysics _physics = _PagePhysics(_gate);

  /// The track's displacement from the current page, in dp (positive: moved down, toward the previous page).
  final ValueNotifier<double> _shift = ValueNotifier(0);
  late final AnimationController _home;
  double _homeFrom = 0;

  /// The reduced-motion and jump cross-fade (0 to 1 over 120 ms; the track shows from 0.35).
  late final AnimationController _fade = AnimationController(vsync: this, duration: Motion.reducedFade, value: 1);

  /// The one-time nudge (the track rises 24 dp and settles, 360 ms).
  late final AnimationController _nudge = AnimationController(vsync: this, duration: const Duration(milliseconds: 360));

  double _height = 0;

  // The gesture.
  int? _pointer;
  double _downX = 0;
  double _downY = 0;
  double _travel = 0;
  double _taken = 0;
  double _base = 0;
  bool _caught = false;
  PagerTouch? _lock;
  final List<PagerSample> _samples = [];

  int? _asked;
  final Map<int, StagePage> _built = {};

  /// True while the track is sliding or held by a finger.
  bool get moving => _home.isAnimating || _gate.owner == _Owner.pager;

  @override
  void initState() {
    super.initState();
    _home = AnimationController(vsync: this, duration: PagerModel.duration)..addListener(_onHome);
  }

  @override
  void didUpdateWidget(StagePager oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.index == oldWidget.index) return;
    final delta = widget.index - oldWidget.index;
    _asked = null;
    if (_pointer != null) {
      // The screen moved while a finger held the track: that gesture is over.
      _pointer = null;
    }
    if (Motion.reduced(context) || delta.abs() > 1 || _height <= 0) {
      _home.stop();
      _shift.value = 0;
      _fade.forward(from: 0);
    } else {
      // The pages stay where they are on screen; the track then slides home to the new page.
      _shift.value += delta * _height;
      _slideHome();
    }
    WidgetsBinding.instance.addPostFrameCallback((_) => _announce());
  }

  void _announce() {
    if (!mounted) return;
    final page = _built[widget.index];
    if (page == null) return;
    StageFrame.say(context, page.announce ?? page.label);
  }

  @override
  void dispose() {
    _home.dispose();
    _fade.dispose();
    _nudge.dispose();
    _shift.dispose();
    super.dispose();
  }

  /// The first feed's nudge: the track rises 24 dp and settles in 360 ms, once (nothing under reduced motion).
  void nudge() {
    if (!mounted || Motion.reduced(context) || _pointer != null) return;
    _nudge.forward(from: 0);
  }

  double get _nudgeOffset {
    final v = _nudge.value;
    if (v <= 0 || v >= 1) return 0;
    final rise = v < 0.5 ? Motion.out.transform(v * 2) : 1 - Motion.out.transform((v - 0.5) * 2);
    return -24 * rise;
  }

  void _onHome() => _shift.value = _homeFrom * (1 - Motion.drawer.transform(_home.value));

  void _slideHome() {
    if (_shift.value == 0) return;
    if (Motion.reduced(context)) {
      _home.stop();
      _shift.value = 0;
      return;
    }
    _homeFrom = _shift.value;
    _home.forward(from: 0);
  }

  void _takeOver() => _taken = _travel;

  void _go(int target) {
    if (target == widget.index) {
      _slideHome();
      return;
    }
    _asked = target;
    widget.onGo(target);
    // A screen that does not take the move by the next frame: the track goes back.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted || _asked != target) return;
      _asked = null;
      if (widget.index != target) _slideHome();
    });
  }

  static double _ms(Duration t) => t.inMicroseconds / 1000.0;

  void _down(PointerDownEvent e) {
    if (!widget.enabled || _pointer != null) return;
    _pointer = e.pointer;
    _downX = e.position.dx;
    _downY = e.position.dy;
    _travel = 0;
    _taken = 0;
    _lock = null;
    _samples
      ..clear()
      ..add((t: _ms(e.timeStamp), y: e.position.dy));
    // A finger on a moving track holds it where it is; the gesture is the pager's.
    _caught = _home.isAnimating || _shift.value.abs() > 0.5;
    _home.stop();
    _base = _shift.value;
    _gate.owner = _caught ? _Owner.pager : _Owner.undecided;
  }

  void _move(PointerMoveEvent e) {
    if (e.pointer != _pointer) return;
    _samples.add((t: _ms(e.timeStamp), y: e.position.dy));
    if (_samples.length > 12) _samples.removeAt(0);
    _travel = e.position.dy - _downY;
    if (_lock == null) {
      final lock = PagerModel.touchLock(e.position.dx - _downX, _travel);
      if (lock != PagerTouch.tap) {
        _lock = lock;
        if (lock == PagerTouch.side && _gate.owner == _Owner.undecided) _gate.owner = _Owner.side;
      }
    }
    if (_gate.owner == _Owner.pager) _shift.value = PagerModel.rubber(_base + _travel - _taken, widget.index, widget.count);
  }

  void _up(PointerUpEvent e) => _end(e.pointer, cancelled: false);

  void _cancel(PointerCancelEvent e) => _end(e.pointer, cancelled: true);

  void _end(int pointer, {required bool cancelled}) {
    if (pointer != _pointer) return;
    _pointer = null;
    if (_gate.owner == _Owner.pager) {
      var target = widget.index;
      if (!cancelled && !(_caught && _lock == null)) {
        target = PagerModel.releaseTarget(
          dy: _travel,
          v: PagerModel.releaseVelocity(_samples),
          height: _height,
          index: widget.index,
          count: widget.count,
        );
      }
      _go(target);
    } else if (_shift.value != 0) {
      _slideHome();
    }
    // The content's drag ends after this event (its fling is refused while the pager owns the gesture); the next
    // touch decides afresh.
    scheduleMicrotask(() {
      if (_pointer == null) _gate.owner = _Owner.idle;
    });
  }

  bool _onScrollStart(ScrollStartNotification n) {
    if (n.dragDetails == null || n.metrics.axis != Axis.vertical) return false;
    if (_gate.owner != _Owner.undecided) return false;
    final dir = _travel < 0 ? 1 : (_travel > 0 ? -1 : 0);
    if (dir == 0) return false;
    _gate.decide(pixels: n.metrics.pixels, min: n.metrics.minScrollExtent, max: n.metrics.maxScrollExtent, dir: dir);
    return false;
  }

  static const CustomSemanticsAction _nextAction = CustomSemanticsAction(label: 'Next');
  static const CustomSemanticsAction _previousAction = CustomSemanticsAction(label: 'Previous');

  Widget _page(BuildContext context, int i, StagePage page, double area) {
    final current = i == widget.index;
    final screen = MediaQuery.sizeOf(context).height;
    final Widget body = switch (page.kind) {
      StagePageKind.question => _QuestionScroll(physics: _physics, child: page.child),
      StagePageKind.card => _FillScroll(physics: _physics, area: area, bias: 0.04 * screen, child: page.child),
      StagePageKind.centre => _FillScroll(physics: _physics, area: area, bias: 0.04 * screen, child: page.child),
    };
    final next = widget.nextLabel == 'Next' ? _nextAction : CustomSemanticsAction(label: widget.nextLabel);
    final previous = widget.previousLabel == 'Previous' ? _previousAction : CustomSemanticsAction(label: widget.previousLabel);
    return KeyedSubtree(
      key: ValueKey<Object>(page.id ?? i),
      child: SizedBox(
        height: area,
        child: RepaintBoundary(
          child: StagePagerScope(
            area: area,
            physics: _physics,
            current: current,
            child: TickerMode(
              enabled: current,
              child: IgnorePointer(
                ignoring: !current,
                child: ExcludeFocus(
                  excluding: !current,
                  child: ExcludeSemantics(
                    excluding: !current,
                    child: Semantics(
                      container: true,
                      explicitChildNodes: true,
                      label: page.label,
                      customSemanticsActions: current
                          ? {
                              if (i + 1 < widget.count) next: () => widget.onGo(i + 1),
                              if (i > 0) previous: () => widget.onGo(i - 1),
                            }
                          : null,
                      child: body,
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, c) {
        final area = c.maxHeight.isFinite ? c.maxHeight : MediaQuery.sizeOf(context).height;
        _height = area;
        _built.clear();
        final first = math.max(0, widget.index - 2);
        final last = math.min(widget.count - 1, widget.index + 2);
        final pages = <int, Widget>{};
        for (var i = first; i <= last; i++) {
          final page = widget.pageBuilder(context, i);
          _built[i] = page;
          pages[i] = _page(context, i, page, area);
        }
        final track = AnimatedBuilder(
          animation: Listenable.merge([_shift, _nudge, _fade]),
          builder: (context, _) {
            final y = _shift.value + _nudgeOffset;
            return Opacity(
              opacity: _fade.value >= 1 ? 1 : 0.35 + 0.65 * _fade.value,
              child: Stack(
                clipBehavior: Clip.none,
                children: [
                  for (final MapEntry(key: i, value: page) in pages.entries)
                    Positioned(
                      left: 0,
                      right: 0,
                      top: 0,
                      height: area,
                      child: Transform.translate(offset: Offset(0, (i - widget.index) * area + y), child: page),
                    ),
                ],
              ),
            );
          },
        );
        return Semantics(
          container: true,
          label: widget.feedLabel,
          child: Listener(
            behavior: HitTestBehavior.translucent,
            onPointerDown: _down,
            onPointerMove: _move,
            onPointerUp: _up,
            onPointerCancel: _cancel,
            child: NotificationListener<ScrollStartNotification>(
              onNotification: _onScrollStart,
              child: ClipRect(child: SizedBox(height: area, width: c.maxWidth, child: track)),
            ),
          ),
        );
      },
    );
  }
}

/// A page that fills the item area: its content centred (a card, a state) with the upward [bias] under it, and
/// scrolling only if it is taller than the area.
class _FillScroll extends StatelessWidget {
  const _FillScroll({required this.physics, required this.area, required this.bias, required this.child});

  final ScrollPhysics physics;
  final double area;
  final double bias;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return ScrollConfiguration(
      behavior: ScrollConfiguration.of(context).copyWith(scrollbars: false, overscroll: false),
      child: SingleChildScrollView(
        physics: physics,
        child: ConstrainedBox(
          constraints: BoxConstraints(minHeight: area),
          child: Padding(
            padding: EdgeInsets.fromLTRB(16, 0, 16, bias),
            child: Center(child: child),
          ),
        ),
      ),
    );
  }
}

/// A question's page: from the top (16 dp down, 24 under the last line), its head fading 24 dp once it is scrolled
/// and its foot fading 56 dp while more waits below.
class _QuestionScroll extends StatefulWidget {
  const _QuestionScroll({required this.physics, required this.child});

  final ScrollPhysics physics;
  final Widget child;

  @override
  State<_QuestionScroll> createState() => _QuestionScrollState();
}

class _QuestionScrollState extends State<_QuestionScroll> {
  bool _top = false;
  bool _more = false;

  bool _read(ScrollMetrics m) {
    if (m.axis != Axis.vertical) return false;
    final top = m.extentBefore > 2;
    final more = m.extentAfter > 4;
    if (top != _top || more != _more) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!mounted) return;
        setState(() {
          _top = top;
          _more = more;
        });
      });
    }
    return false;
  }

  @override
  Widget build(BuildContext context) {
    final scroll = NotificationListener<ScrollMetricsNotification>(
      onNotification: (n) => n.depth == 0 && _read(n.metrics),
      child: NotificationListener<ScrollNotification>(
        onNotification: (n) => n.depth == 0 && _read(n.metrics),
        child: ScrollConfiguration(
          behavior: ScrollConfiguration.of(context).copyWith(scrollbars: false, overscroll: false),
          child: SingleChildScrollView(
            physics: widget.physics,
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
            child: widget.child,
          ),
        ),
      ),
    );
    return ShaderMask(
      blendMode: BlendMode.dstIn,
      shaderCallback: (rect) {
        final top = (24 / rect.height).clamp(0.0, 0.5);
        final bottom = (56 / rect.height).clamp(0.0, 0.5);
        const clear = Color(0x00FFFFFF);
        const solid = Color(0xFFFFFFFF);
        return LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [_top ? clear : solid, solid, solid, _more ? clear : solid],
          stops: [0, top, 1 - bottom, 1],
        ).createShader(rect);
      },
      child: scroll,
    );
  }
}
