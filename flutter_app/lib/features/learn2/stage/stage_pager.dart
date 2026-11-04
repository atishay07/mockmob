/// The study stage's pager (the web's `usePager`, BUILD-1101 B1, A1 3.7): one item per item-area height, in a track
/// moved by translation only. It is not a `PageView`.
///
///   pages      each page is the item area less a 40 dp peek (R2 ruling 7): a card fills it, a question is its own
///              vertical scroll view (clamping, so the content never bounces) with its options at the foot in the thumb
///              zone and fades at its edges, a state is centred. Pages more than 2 away are not built.
///   peek       the page after the one in view shows its top 40 dp above the action bar as a real card edge with its
///              type label (the cap; a Key card's cap is its header band, R8: the next card in the deck); it fades out over
///              200 ms when its page comes into view. [StagePager.chip] is the
///              first visit's cue, centred in that strip (the label hides while it shows)
///   touch      the track follows the finger 1:1 only when the drag's first movement could not scroll the content in
///              its direction (the edge rule, the web's `scrollerThatCanMove`): a drag that starts at the content's
///              edge, or on a page that does not scroll, belongs to the pager for the whole gesture and the content
///              stays still; a drag that scrolled the content first belongs to the content for the whole gesture,
///              even after it reaches its edge. 0.35 resistance before the first page and after the last.
///   release    on past 18% of the item area or above 0.35 px/ms (350 dp/s) over the last 80 ms, in that
///              direction; never more than one item; else back. 320 ms on `Motion.drawer`.
///   keys       the screen moves the pager by changing [StagePager.index] (its own `go`, the same one it passes as
///              [StagePager.onGo]); the track slides one page (area less peek) from where it is. A jump of more than one
///              item, or any move under reduced motion, switches at once with a 120 ms cross-fade.
///   semantics  a label per page ("Card 3 of 21"), custom actions Next and Previous on the current page, and an
///              announcement of the new page after each move. No haptic on a move.
library;

import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';

import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/materials/shape.dart';
import '../../keycards/data/keycards_lines.dart' show KcFamily;
import 'pager_model.dart';
import 'stage_frame.dart';
import 'stage_keys.dart' show StageBelowChip;
import 'stage_motion.dart';
import 'stage_paper.dart';

/// How a page sits in the item area.
enum StagePageKind {
  /// Filling the page, 4 dp from the top and 12 from the foot (a Key card: a flashcard).
  card,

  /// From the top, 12 dp down, with the options at the foot and fades at the edges while it scrolls (a question).
  question,

  /// Centred both ways (the checkpoint, a state).
  centre,
}

/// One page of the pager, as the screen describes it.
class StagePage {
  const StagePage({required this.kind, required this.child, required this.label, this.announce, this.id, this.cap, this.capFamily});

  const StagePage.card({required this.child, required this.label, this.announce, this.id, this.cap, this.capFamily}) : kind = StagePageKind.card;
  const StagePage.question({required this.child, required this.label, this.announce, this.id, this.cap, this.capFamily})
    : kind = StagePageKind.question;
  const StagePage.centre({required this.child, required this.label, this.announce, this.id, this.cap, this.capFamily}) : kind = StagePageKind.centre;

  final StagePageKind kind;
  final Widget child;

  /// The label on the card edge this page shows in the peek while it is the next one: a card's kind ("Definition"), a
  /// mistake's own line else "Question", "So far" for a checkpoint. Null draws no edge.
  final String? cap;

  /// A Key card's kind family (`kindFamily`): its edge in the peek is its header band on the paper, the kind word in the
  /// family's colour (R8: the feed's deck is its peek). Null: the plain card edge (a question, a checkpoint).
  final KcFamily? capFamily;

  /// The page's name for a screen reader: "Card 3 of 21", "Question 4 of 21", "Checkpoint after 8 of 21".
  final String label;

  /// What is said when the page becomes the current one (the web's `announce`); defaults to [label].
  final String? announce;

  /// The item's identity (its id), so a page keeps its state when an item is inserted before it.
  final Object? id;
}

typedef StagePageBuilder = StagePage Function(BuildContext context, int index);

/// What a page's content can read from the pager: the page's height (the item area less the peek), the physics for any
/// scroll view of its own (a card's long back), and whether it is the current page.
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
    this.peek = StagePager.peekHeight,
    this.chip,
  });

  /// The next page's top that always shows above the action bar (R2 ruling 7).
  static const double peekHeight = 40;

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

  /// The peek's height: 40 on the feed; 0 for a pager that never shows the next page (the run's one page).
  final double peek;

  /// The first visit's cue (`StageCue`), centred in the peek strip at the foot of the item area. While it shows, the next
  /// page's label on the card edge is hidden.
  final Widget? chip;

  /// The physics a scroll view inside a page uses, so the edge rule holds for it too.
  static ScrollPhysics physicsOf(BuildContext context) => StagePagerScope.maybeOf(context)?.physics ?? const ClampingScrollPhysics();

  /// The page's height (the item area less the peek) around [context], or null outside a pager.
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

  /// The item area's height (the release rule measures 18% of it) and one page's: the area less the peek.
  double _height = 0;
  double _stride = 0;

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
    if (Motion.reduced(context) || delta.abs() > 1 || _stride <= 0) {
      _home.stop();
      _shift.value = 0;
      _fade.forward(from: 0);
    } else {
      // The pages stay where they are on screen; the track then slides home to the new page.
      _shift.value += delta * _stride;
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
    _shift.dispose();
    super.dispose();
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

  Widget _page(BuildContext context, int i, StagePage page, double height) {
    final current = i == widget.index;
    final next = i == widget.index + 1;
    final Widget body = switch (page.kind) {
      StagePageKind.question => _QuestionScroll(physics: _physics, child: page.child),
      // A card fills its page (4 dp from the top, 12 from the foot): a flashcard, never a floating box in a void. It sits in a
      // scroll view as tall as the page, so a drag on its front still tells the pager (the gate is decided by a scroll view's
      // physics: without one, nothing would claim a swipe that starts on a card).
      StagePageKind.card => _CardScroll(physics: _physics, height: height, child: page.child),
      StagePageKind.centre => _FillScroll(physics: _physics, area: height, bias: 24, child: page.child),
    };
    final cap = page.cap;
    final nextAction = widget.nextLabel == 'Next' ? _nextAction : CustomSemanticsAction(label: widget.nextLabel);
    final previous = widget.previousLabel == 'Previous' ? _previousAction : CustomSemanticsAction(label: widget.previousLabel);
    return KeyedSubtree(
      key: ValueKey<Object>(page.id ?? i),
      child: SizedBox(
        height: height,
        child: RepaintBoundary(
          child: StagePagerScope(
            area: height,
            physics: _physics,
            current: current,
            child: TickerMode(
              enabled: current || next,
              child: IgnorePointer(
                ignoring: !current,
                child: ExcludeFocus(
                  excluding: !current,
                  child: Stack(
                    fit: StackFit.expand,
                    children: [
                      ExcludeSemantics(
                        excluding: !current,
                        child: Semantics(
                          container: true,
                          explicitChildNodes: true,
                          label: page.label,
                          customSemanticsActions: current
                              ? {
                                  if (i + 1 < widget.count) nextAction: () => widget.onGo(i + 1),
                                  if (i > 0) previous: () => widget.onGo(i - 1),
                                }
                              : null,
                          child: body,
                        ),
                      ),
                      // The page under the one in view shows its top as a real card edge with its type label.
                      if (cap != null && widget.peek > 0)
                        _PageCap(label: cap, family: page.capFamily, show: next, hideLabel: widget.chip != null, height: widget.peek + 24),
                    ],
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
        final stride = area - widget.peek.clamp(0.0, area);
        _height = area;
        _stride = stride;
        _built.clear();
        final first = math.max(0, widget.index - 2);
        final last = math.min(widget.count - 1, widget.index + 2);
        final pages = <int, Widget>{};
        for (var i = first; i <= last; i++) {
          final page = widget.pageBuilder(context, i);
          _built[i] = page;
          pages[i] = _page(context, i, page, stride);
        }
        final track = AnimatedBuilder(
          animation: Listenable.merge([_shift, _fade]),
          builder: (context, _) {
            final y = _shift.value;
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
                      height: stride,
                      child: Transform.translate(offset: Offset(0, (i - widget.index) * stride + y), child: page),
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
              child: ClipRect(
                child: SizedBox(
                  height: area,
                  width: c.maxWidth,
                  child: Stack(
                    clipBehavior: Clip.none,
                    children: [
                      Positioned.fill(child: track),
                      if (widget.chip != null) Positioned(left: 0, right: 0, bottom: 2, child: IgnorePointer(child: Center(child: widget.chip))),
                    ],
                  ),
                ),
              ),
            ),
          ),
        );
      },
    );
  }
}

/// A Key card's page: the card fills it (16 dp at the sides, 4 from the top, 12 from the foot) inside a scroll view exactly as
/// tall as the page. It never scrolls; it is there so the page's physics see the first movement of a drag on the card and hand
/// the gesture to the pager (a card's long back has a scroll view of its own, which decides the same way at its edges).
class _CardScroll extends StatelessWidget {
  const _CardScroll({required this.physics, required this.height, required this.child});

  final ScrollPhysics physics;
  final double height;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return ScrollConfiguration(
      behavior: ScrollConfiguration.of(context).copyWith(scrollbars: false, overscroll: false),
      child: SingleChildScrollView(
        physics: physics,
        child: SizedBox(
          height: height,
          child: Padding(padding: const EdgeInsets.fromLTRB(16, 4, 16, 12), child: child),
        ),
      ),
    );
  }
}

/// A page that fills its height: its content centred (a state, the checkpoint) with [bias] dp under it, and scrolling only
/// if it is taller than the page.
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

/// What a question's page offers its content: the first option row, watched for the "Options below" chip. A
/// `QuestionView` on the page sets it while the question is unanswered.
class StageQuestionScope extends InheritedWidget {
  const StageQuestionScope({super.key, required this.firstOption, required this.minHeight, required this.scroll, required super.child});

  final ValueNotifier<GlobalKey?> firstOption;

  /// The least height the question's content takes: the page less its padding, so the options can sit at its foot in the
  /// thumb zone (taller content: plain flow, and the page scrolls).
  final double minHeight;

  /// The page's scroll position, for the scroll after a wrong answer (`PagerModel.verdictScrollTop`).
  final ScrollController scroll;

  static StageQuestionScope? maybeOf(BuildContext context) => context.getInheritedWidgetOfExactType<StageQuestionScope>();

  @override
  bool updateShouldNotify(StageQuestionScope old) => old.firstOption != firstOption || old.minHeight != minHeight || old.scroll != scroll;
}

/// A question's page: from the top (12 dp down, 24 under the last line), its head fading 24 dp once it is scrolled and its
/// foot fading 56 dp while more waits below. The content is at least as tall as the page, so the options sit at its foot in the
/// thumb zone (R3 L2); taller than the page it flows plainly and the page scrolls. While the first option waits below the fold
/// (less than 28 dp of it above the page's foot, M10, R4 ui-correctness#5) a quiet "Options below" chip sits in a band under
/// the text, inside the page (never over the text, never on the peek strip); a tap brings option A to 12 dp under the top.
class _QuestionScroll extends StatefulWidget {
  const _QuestionScroll({required this.physics, required this.child});

  final ScrollPhysics physics;
  final Widget child;

  @override
  State<_QuestionScroll> createState() => _QuestionScrollState();
}

class _QuestionScrollState extends State<_QuestionScroll> {
  static const EdgeInsets _padding = EdgeInsets.fromLTRB(16, 12, 16, 24);

  final ValueNotifier<GlobalKey?> _first = ValueNotifier(null);
  final ScrollController _controller = ScrollController();
  bool _top = false;
  bool _more = false;
  bool _below = false;

  @override
  void initState() {
    super.initState();
    _first.addListener(_check);
  }

  @override
  void dispose() {
    _first.dispose();
    _controller.dispose();
    super.dispose();
  }

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
    _check();
    return false;
  }

  RenderBox? _firstRow() {
    final row = _first.value?.currentContext?.findRenderObject();
    return row is RenderBox && row.attached && row.hasSize ? row : null;
  }

  /// Whether option A waits below the fold (the page's own foot), read after the frame.
  void _check() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      final page = context.findRenderObject();
      final row = _firstRow();
      var below = false;
      if (page is RenderBox && page.hasSize && row != null) {
        below = PagerModel.optionsBelow(optionTop: row.localToGlobal(Offset.zero, ancestor: page).dy, edge: page.size.height);
      }
      if (below != _below) setState(() => _below = below);
    });
  }

  void _goToOptions() {
    final row = _firstRow();
    final rowContext = _first.value?.currentContext;
    if (row == null || rowContext == null) return;
    final viewport = RenderAbstractViewport.maybeOf(row);
    final position = Scrollable.maybeOf(rowContext)?.position;
    if (viewport == null || position == null) return;
    final target = (viewport.getOffsetToReveal(row, 0).offset - 12).clamp(position.minScrollExtent, position.maxScrollExtent);
    if (Motion.reduced(context)) {
      position.jumpTo(target);
    } else {
      unawaited(position.animateTo(target, duration: PagerModel.duration, curve: Motion.drawer));
    }
  }

  @override
  Widget build(BuildContext context) {
    final scroll = LayoutBuilder(
      builder: (context, c) {
        final minHeight = math.max(0.0, c.maxHeight - _padding.vertical);
        return NotificationListener<ScrollMetricsNotification>(
          onNotification: (n) => n.depth == 0 && _read(n.metrics),
          child: NotificationListener<ScrollNotification>(
            onNotification: (n) => n.depth == 0 && _read(n.metrics),
            child: ScrollConfiguration(
              behavior: ScrollConfiguration.of(context).copyWith(scrollbars: false, overscroll: false),
              child: SingleChildScrollView(
                controller: _controller,
                physics: widget.physics,
                padding: _padding,
                child: StageQuestionScope(firstOption: _first, minHeight: minHeight, scroll: _controller, child: widget.child),
              ),
            ),
          ),
        );
      },
    );
    // The chip is a band under the scrolling text, never a layer over it (4 Nov walk, I5: it covered a long question's last
    // line). The band takes 8 dp above the chip and 8 below; the text above it fades out at its own foot as before.
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Expanded(
          child: ShaderMask(
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
          ),
        ),
        if (_below)
          Padding(
            key: const ValueKey<String>('options-below-band'),
            padding: const EdgeInsets.symmetric(vertical: 8),
            child: Center(child: StageIn(child: StageBelowChip(onTap: _goToOptions))),
          ),
      ],
    );
  }
}

/// The card edge of the page under the one in view (the web's `.st-cap`): the card's width and top radius, its 1 dp line, the
/// card surface and shadow, the next item's type label at the left (13 semibold ink-3, one line). A Key card's edge is its
/// header band ([family], R8): the band's wash on the paper with its 1 dp line, the kind word in the family's colour (15
/// semibold, AA on the wash), no shadow in Night. It sits on a page-coloured box so the page's own top never shows through the
/// corners, and fades in or out over 200 ms; the label hides (160 ms) while the first visit's chip covers the strip.
class _PageCap extends StatelessWidget {
  const _PageCap({required this.label, required this.show, required this.hideLabel, required this.height, this.family});

  final String label;
  final KcFamily? family;
  final bool show;
  final bool hideLabel;
  final double height;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final fam = family;
    final paper = colors.paper;
    final ink = fam == null ? null : StagePaper.ink(paper, fam);
    final edge = ink == null
        ? ShapeDecoration(
            color: colors.raised,
            shape: mmShapeBorder(BorderRadius.circular(24), side: BorderSide(color: colors.lineStrong)),
            shadows: colors.cardShadow,
          )
        : ShapeDecoration(
            color: ink.band,
            shape: mmShapeBorder(BorderRadius.circular(24), side: BorderSide(color: ink.line)),
            shadows: colors.isNight ? null : paper.shadow,
          );
    final style = ink == null
        ? type.label.copyWith(fontSize: 13, height: 1.3, color: colors.ink3)
        : type.label.copyWith(fontSize: 15, height: 1.3, fontWeight: FontWeight.w600, letterSpacing: 0, color: ink.text);
    return Positioned(
      left: 16,
      right: 16,
      top: 0,
      height: height,
      child: IgnorePointer(
        child: ExcludeSemantics(
          child: AnimatedOpacity(
            opacity: show ? 1 : 0,
            duration: Motion.of(context, const Duration(milliseconds: 200)),
            curve: Motion.out,
            child: Stack(
              children: [
                Positioned.fill(child: ColoredBox(color: colors.ground)),
                Positioned(left: 0, right: 0, top: 4, bottom: 0, child: DecoratedBox(decoration: edge)),
                Positioned(
                  left: ink == null ? 21 : StagePaper.side,
                  right: ink == null ? 21 : StagePaper.side,
                  top: ink == null ? 16 : 15,
                  child: AnimatedOpacity(
                    opacity: hideLabel ? 0 : 1,
                    duration: Motion.of(context, const Duration(milliseconds: 160)),
                    curve: Motion.out,
                    child: Text(label, maxLines: 1, softWrap: false, overflow: TextOverflow.ellipsis, style: style),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
